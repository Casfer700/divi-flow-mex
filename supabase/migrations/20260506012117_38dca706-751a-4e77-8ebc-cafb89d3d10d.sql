
-- Currency lots table for FIFO cost tracking
CREATE TABLE public.currency_lots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  remaining_quantity NUMERIC NOT NULL,
  cost_mxn_total NUMERIC NOT NULL DEFAULT 0,
  cost_mxn_per_unit NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual', -- 'pos_sale', 'manual', 'batch'
  reference_id UUID NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.currency_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view currency lots"
  ON public.currency_lots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert currency lots"
  ON public.currency_lots FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can update currency lots"
  ON public.currency_lots FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete currency lots"
  ON public.currency_lots FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Currency lot consumption for FIFO tracking on orders
CREATE TABLE public.currency_lot_consumption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES public.currency_lots(id),
  order_id UUID NULL,
  exchange_id UUID NULL,
  currency TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  cost_mxn_per_unit NUMERIC NOT NULL,
  total_cost_mxn NUMERIC NOT NULL,
  mxn_received NUMERIC NOT NULL DEFAULT 0,
  fx_profit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.currency_lot_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view lot consumption"
  ON public.currency_lot_consumption FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert lot consumption"
  ON public.currency_lot_consumption FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can update lot consumption"
  ON public.currency_lot_consumption FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete lot consumption"
  ON public.currency_lot_consumption FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- FIFO consumption function for currency lots
CREATE OR REPLACE FUNCTION public.consume_currency_lots_fifo(
  _currency TEXT,
  _quantity NUMERIC,
  _order_id UUID DEFAULT NULL,
  _exchange_id UUID DEFAULT NULL,
  _mxn_received NUMERIC DEFAULT 0
)
RETURNS TABLE(total_cost_mxn NUMERIC, total_fx_profit NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  remaining_to_consume NUMERIC := _quantity;
  lot_record RECORD;
  take_qty NUMERIC;
  cost_total NUMERIC := 0;
  profit_total NUMERIC := 0;
  proportion NUMERIC;
BEGIN
  FOR lot_record IN
    SELECT id, remaining_quantity, cost_mxn_per_unit
    FROM public.currency_lots
    WHERE currency = _currency AND remaining_quantity > 0
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining_to_consume <= 0;

    take_qty := LEAST(lot_record.remaining_quantity, remaining_to_consume);

    UPDATE public.currency_lots
      SET remaining_quantity = remaining_quantity - take_qty
    WHERE id = lot_record.id;

    -- Calculate proportion of MXN received for this chunk
    proportion := CASE WHEN _quantity > 0 THEN take_qty / _quantity ELSE 0 END;

    INSERT INTO public.currency_lot_consumption
      (lot_id, order_id, exchange_id, currency, quantity, cost_mxn_per_unit, total_cost_mxn, mxn_received, fx_profit)
    VALUES
      (lot_record.id, _order_id, _exchange_id, _currency, take_qty,
       lot_record.cost_mxn_per_unit,
       lot_record.cost_mxn_per_unit * take_qty,
       _mxn_received * proportion,
       (_mxn_received * proportion) - (lot_record.cost_mxn_per_unit * take_qty));

    cost_total := cost_total + (lot_record.cost_mxn_per_unit * take_qty);
    profit_total := profit_total + ((_mxn_received * proportion) - (lot_record.cost_mxn_per_unit * take_qty));
    remaining_to_consume := remaining_to_consume - take_qty;
  END LOOP;

  total_cost_mxn := cost_total;
  total_fx_profit := profit_total;
  RETURN NEXT;
END;
$$;

-- Trigger to update updated_at on currency_lots
CREATE TRIGGER update_currency_lots_updated_at
  BEFORE UPDATE ON public.currency_lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
