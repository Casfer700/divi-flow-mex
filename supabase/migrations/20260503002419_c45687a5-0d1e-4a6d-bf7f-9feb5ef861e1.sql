
-- Fix product_stock view: cost_mxn and cost_usd are already per-unit, no division needed
CREATE OR REPLACE VIEW public.product_stock AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  COALESCE(sum(b.remaining_quantity), 0::numeric) AS stock,
  CASE
    WHEN COALESCE(sum(b.remaining_quantity), 0::numeric) > 0::numeric
    THEN sum(b.remaining_quantity * b.cost_usd) / sum(b.remaining_quantity)
    ELSE 0::numeric
  END AS avg_cost_usd,
  CASE
    WHEN COALESCE(sum(b.remaining_quantity), 0::numeric) > 0::numeric
    THEN sum(b.remaining_quantity * b.cost_mxn) / sum(b.remaining_quantity)
    ELSE 0::numeric
  END AS avg_cost_mxn
FROM products p
LEFT JOIN product_batches b ON b.product_id = p.id
GROUP BY p.id, p.name;

-- Fix FIFO consumption function: cost fields are per-unit, no division needed
CREATE OR REPLACE FUNCTION public.consume_batches_fifo(
  _sale_id UUID,
  _product_id UUID,
  _quantity NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_to_consume NUMERIC := _quantity;
  consumed_total NUMERIC := 0;
  batch_record RECORD;
  take_qty NUMERIC;
BEGIN
  IF _product_id IS NULL OR _quantity IS NULL OR _quantity <= 0 THEN
    RETURN 0;
  END IF;

  FOR batch_record IN
    SELECT id, remaining_quantity, cost_usd, cost_mxn, quantity
    FROM public.product_batches
    WHERE product_id = _product_id AND remaining_quantity > 0
    ORDER BY purchase_date ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining_to_consume <= 0;

    take_qty := LEAST(batch_record.remaining_quantity, remaining_to_consume);

    UPDATE public.product_batches
       SET remaining_quantity = remaining_quantity - take_qty
     WHERE id = batch_record.id;

    INSERT INTO public.pos_sale_batch_consumption
      (sale_id, batch_id, product_id, quantity,
       cost_usd_per_unit, cost_mxn_per_unit,
       total_cost_usd, total_cost_mxn)
    VALUES
      (_sale_id, batch_record.id, _product_id, take_qty,
       batch_record.cost_usd,
       batch_record.cost_mxn,
       batch_record.cost_usd * take_qty,
       batch_record.cost_mxn * take_qty);

    consumed_total := consumed_total + take_qty;
    remaining_to_consume := remaining_to_consume - take_qty;
  END LOOP;

  RETURN consumed_total;
END;
$$;
