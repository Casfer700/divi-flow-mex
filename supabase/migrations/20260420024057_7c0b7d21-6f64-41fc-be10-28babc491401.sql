-- =========================================
-- 1. product_batches: purchase lots
-- =========================================
CREATE TABLE public.product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  remaining_quantity NUMERIC NOT NULL CHECK (remaining_quantity >= 0),
  cost_usd NUMERIC NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  cost_mxn NUMERIC NOT NULL DEFAULT 0 CHECK (cost_mxn >= 0),
  supplier_invoice TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_batches_product_fifo
  ON public.product_batches (product_id, purchase_date ASC, created_at ASC)
  WHERE remaining_quantity > 0;

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view batches"
  ON public.product_batches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'local'));

CREATE POLICY "Only admins can insert batches"
  ON public.product_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update batches"
  ON public.product_batches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete batches"
  ON public.product_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 2. pos_sale_batch_consumption: sale ↔ batch link
-- =========================================
CREATE TABLE public.pos_sale_batch_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  cost_usd_per_unit NUMERIC NOT NULL DEFAULT 0,
  cost_mxn_per_unit NUMERIC NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC NOT NULL DEFAULT 0,
  total_cost_mxn NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_sale_batch_consumption_sale ON public.pos_sale_batch_consumption(sale_id);
CREATE INDEX idx_pos_sale_batch_consumption_batch ON public.pos_sale_batch_consumption(batch_id);

ALTER TABLE public.pos_sale_batch_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view consumption"
  ON public.pos_sale_batch_consumption FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'local'));

CREATE POLICY "Admin and local can insert consumption"
  ON public.pos_sale_batch_consumption FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'local'));

CREATE POLICY "Only admins can update consumption"
  ON public.pos_sale_batch_consumption FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete consumption"
  ON public.pos_sale_batch_consumption FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- 3. FIFO consume function
-- =========================================
CREATE OR REPLACE FUNCTION public.consume_batches_fifo(
  _sale_id UUID,
  _product_id UUID,
  _quantity NUMERIC
)
RETURNS NUMERIC -- returns quantity actually consumed (may be < requested if stock insufficient)
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
       CASE WHEN batch_record.quantity > 0 THEN batch_record.cost_usd / batch_record.quantity ELSE 0 END,
       CASE WHEN batch_record.quantity > 0 THEN batch_record.cost_mxn / batch_record.quantity ELSE 0 END,
       CASE WHEN batch_record.quantity > 0 THEN (batch_record.cost_usd / batch_record.quantity) * take_qty ELSE 0 END,
       CASE WHEN batch_record.quantity > 0 THEN (batch_record.cost_mxn / batch_record.quantity) * take_qty ELSE 0 END);

    consumed_total := consumed_total + take_qty;
    remaining_to_consume := remaining_to_consume - take_qty;
  END LOOP;

  RETURN consumed_total;
END;
$$;

-- =========================================
-- 4. Auto-consume trigger on pos_sales INSERT
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_pos_sale_batch_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.quantity > 0 THEN
    PERFORM public.consume_batches_fifo(NEW.id, NEW.product_id, NEW.quantity);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_sales_consume_batches
  AFTER INSERT ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_pos_sale_batch_consumption();

-- =========================================
-- 5. Restore stock when a sale is deleted
-- =========================================
CREATE OR REPLACE FUNCTION public.restore_batches_on_sale_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT batch_id, quantity
    FROM public.pos_sale_batch_consumption
    WHERE sale_id = OLD.id
  LOOP
    UPDATE public.product_batches
       SET remaining_quantity = remaining_quantity + c.quantity
     WHERE id = c.batch_id;
  END LOOP;
  RETURN OLD;
END;
$$;

CREATE TRIGGER pos_sales_restore_batches
  BEFORE DELETE ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.restore_batches_on_sale_delete();

-- =========================================
-- 6. Stock view (current stock + weighted avg cost)
-- =========================================
CREATE OR REPLACE VIEW public.product_stock AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  COALESCE(SUM(b.remaining_quantity), 0) AS stock,
  CASE WHEN COALESCE(SUM(b.remaining_quantity), 0) > 0
       THEN SUM(b.remaining_quantity * (b.cost_usd / NULLIF(b.quantity, 0))) / SUM(b.remaining_quantity)
       ELSE 0 END AS avg_cost_usd,
  CASE WHEN COALESCE(SUM(b.remaining_quantity), 0) > 0
       THEN SUM(b.remaining_quantity * (b.cost_mxn / NULLIF(b.quantity, 0))) / SUM(b.remaining_quantity)
       ELSE 0 END AS avg_cost_mxn
FROM public.products p
LEFT JOIN public.product_batches b ON b.product_id = p.id
GROUP BY p.id, p.name;