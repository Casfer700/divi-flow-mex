-- Table for split/multi-currency payments per POS sale
CREATE TABLE public.pos_sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  amount_mxn NUMERIC NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view pos payments"
  ON public.pos_sale_payments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert pos payments"
  ON public.pos_sale_payments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can update pos payments"
  ON public.pos_sale_payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete pos payments"
  ON public.pos_sale_payments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_pos_sale_payments_sale ON public.pos_sale_payments(sale_id);

-- Replace single-payment trigger: now movements come from each payment row
DROP TRIGGER IF EXISTS pos_sales_create_movement ON public.pos_sales;

CREATE OR REPLACE FUNCTION public.handle_pos_payment_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_record RECORD;
BEGIN
  SELECT product_name, sales_agent, sale_date INTO sale_record
    FROM public.pos_sales WHERE id = NEW.sale_id;

  INSERT INTO public.financial_movements
    (movement_type, source, currency, amount, payment_method, account_id,
     reference, reference_id, reference_type, notes, created_by, movement_date)
  VALUES
    ('income', 'sale', NEW.currency, NEW.amount, NEW.payment_method, NEW.account_id,
     'POS - ' || COALESCE(sale_record.product_name, '') ||
       CASE WHEN sale_record.sales_agent IS NOT NULL AND sale_record.sales_agent <> ''
            THEN ' (' || sale_record.sales_agent || ')' ELSE '' END,
     NEW.id, 'pos_payment',
     COALESCE(NEW.notes, 'Pago de venta POS'),
     NEW.created_by, COALESCE(sale_record.sale_date, now()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER pos_payments_create_movement
  AFTER INSERT ON public.pos_sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_pos_payment_movement();

CREATE OR REPLACE FUNCTION public.cleanup_pos_payment_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_movements
    WHERE reference_type = 'pos_payment' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER pos_payments_cleanup_movement
  BEFORE DELETE ON public.pos_sale_payments
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_pos_payment_movement();