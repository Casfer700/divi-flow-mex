
-- 1) Add commission source to movement_source enum (if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'movement_source' AND e.enumlabel = 'purchase_invoice'
  ) THEN
    ALTER TYPE public.movement_source ADD VALUE 'purchase_invoice';
  END IF;
END$$;

-- 2) sales_agents table
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  default_commission_mxn NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view sales agents"
  ON public.sales_agents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can insert sales agents"
  ON public.sales_agents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update sales agents"
  ON public.sales_agents FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete sales agents"
  ON public.sales_agents FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sales_agents_updated_at
  BEFORE UPDATE ON public.sales_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Add columns to products and pos_sales
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_invoice_tracked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS sales_agent_id UUID REFERENCES public.sales_agents(id),
  ADD COLUMN IF NOT EXISTS commission_mxn NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pos_sales_agent_id ON public.pos_sales(sales_agent_id);

-- 4) batch_invoices table
CREATE TABLE IF NOT EXISTS public.batch_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  invoice_number TEXT NOT NULL,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  cost_mxn NUMERIC NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  payment_currency TEXT NOT NULL DEFAULT 'MXN',
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold')),
  sale_id UUID REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_batch_invoices_batch ON public.batch_invoices(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_invoices_product ON public.batch_invoices(product_id);
CREATE INDEX IF NOT EXISTS idx_batch_invoices_status ON public.batch_invoices(status);
CREATE INDEX IF NOT EXISTS idx_batch_invoices_sale ON public.batch_invoices(sale_id);

ALTER TABLE public.batch_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view batch invoices"
  ON public.batch_invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert batch invoices"
  ON public.batch_invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can update batch invoices"
  ON public.batch_invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can delete batch invoices"
  ON public.batch_invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_batch_invoices_updated_at
  BEFORE UPDATE ON public.batch_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) currency_exchanges table
CREATE TABLE IF NOT EXISTS public.currency_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL CHECK (operation IN ('buy','sell')),
  currency TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  exchange_rate NUMERIC NOT NULL,
  mxn_equivalent NUMERIC NOT NULL,
  currency_account_id UUID REFERENCES public.accounts(id),
  mxn_account_id UUID REFERENCES public.accounts(id),
  operation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_currency_exchanges_date ON public.currency_exchanges(operation_date);

ALTER TABLE public.currency_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view currency exchanges"
  ON public.currency_exchanges FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert currency exchanges"
  ON public.currency_exchanges FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can update currency exchanges"
  ON public.currency_exchanges FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete currency exchanges"
  ON public.currency_exchanges FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_currency_exchanges_updated_at
  BEFORE UPDATE ON public.currency_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Trigger: commission expense on POS sale insert
CREATE OR REPLACE FUNCTION public.handle_pos_sale_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_account_id UUID;
  agent_name TEXT;
BEGIN
  IF NEW.commission_mxn IS NOT NULL AND NEW.commission_mxn > 0 THEN
    SELECT id INTO default_account_id FROM public.accounts
      WHERE currency = 'MXN' AND is_active = true
      ORDER BY created_at ASC LIMIT 1;

    IF NEW.sales_agent_id IS NOT NULL THEN
      SELECT name INTO agent_name FROM public.sales_agents WHERE id = NEW.sales_agent_id;
    ELSE
      agent_name := COALESCE(NEW.sales_agent, 'Agente');
    END IF;

    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('expense', 'commission', 'MXN', NEW.commission_mxn, 'cash', default_account_id,
       'Comisión - ' || agent_name, NEW.id, 'pos_sale_commission',
       'Comisión automática por venta POS', NEW.created_by, NEW.sale_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_sale_commission ON public.pos_sales;
CREATE TRIGGER trg_pos_sale_commission
  AFTER INSERT ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_pos_sale_commission();

CREATE OR REPLACE FUNCTION public.cleanup_pos_sale_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_movements
    WHERE reference_type = 'pos_sale_commission' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_sale_commission_cleanup ON public.pos_sales;
CREATE TRIGGER trg_pos_sale_commission_cleanup
  BEFORE DELETE ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_pos_sale_commission();

-- 7) Trigger: purchase expense on batch_invoice insert
CREATE OR REPLACE FUNCTION public.handle_batch_invoice_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_amount IS NOT NULL AND NEW.payment_amount > 0 THEN
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('expense', 'purchase_invoice', NEW.payment_currency, NEW.payment_amount,
       NEW.payment_method, NEW.account_id,
       'Factura ' || NEW.invoice_number, NEW.id, 'batch_invoice',
       COALESCE(NEW.notes, 'Compra de factura'), NEW.created_by, NEW.payment_date::timestamptz);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_invoice_purchase ON public.batch_invoices;
CREATE TRIGGER trg_batch_invoice_purchase
  AFTER INSERT ON public.batch_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_batch_invoice_purchase();

CREATE OR REPLACE FUNCTION public.cleanup_batch_invoice_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_movements
    WHERE reference_type = 'batch_invoice' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_invoice_purchase_cleanup ON public.batch_invoices;
CREATE TRIGGER trg_batch_invoice_purchase_cleanup
  BEFORE DELETE ON public.batch_invoices
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_batch_invoice_purchase();

-- 8) Trigger: currency exchange financial movements
CREATE OR REPLACE FUNCTION public.handle_currency_exchange()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.operation = 'sell' THEN
    -- Decrease currency balance (expense in foreign currency)
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('expense', 'currency_exchange', NEW.currency, NEW.amount, 'cash', NEW.currency_account_id,
       'Venta ' || NEW.currency || ' @ ' || NEW.exchange_rate,
       NEW.id, 'currency_exchange_out',
       COALESCE(NEW.notes, 'Venta de divisa'), NEW.created_by, NEW.operation_date);

    -- Increase MXN balance (income in MXN)
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('income', 'currency_exchange', 'MXN', NEW.mxn_equivalent, 'cash', NEW.mxn_account_id,
       'Venta ' || NEW.currency || ' @ ' || NEW.exchange_rate,
       NEW.id, 'currency_exchange_in',
       COALESCE(NEW.notes, 'Venta de divisa'), NEW.created_by, NEW.operation_date);
  ELSIF NEW.operation = 'buy' THEN
    -- Increase currency balance (income in foreign currency)
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('income', 'currency_exchange', NEW.currency, NEW.amount, 'cash', NEW.currency_account_id,
       'Compra ' || NEW.currency || ' @ ' || NEW.exchange_rate,
       NEW.id, 'currency_exchange_in',
       COALESCE(NEW.notes, 'Compra de divisa'), NEW.created_by, NEW.operation_date);

    -- Decrease MXN balance (expense in MXN)
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('expense', 'currency_exchange', 'MXN', NEW.mxn_equivalent, 'cash', NEW.mxn_account_id,
       'Compra ' || NEW.currency || ' @ ' || NEW.exchange_rate,
       NEW.id, 'currency_exchange_out',
       COALESCE(NEW.notes, 'Compra de divisa'), NEW.created_by, NEW.operation_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_currency_exchange ON public.currency_exchanges;
CREATE TRIGGER trg_currency_exchange
  AFTER INSERT ON public.currency_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.handle_currency_exchange();

CREATE OR REPLACE FUNCTION public.cleanup_currency_exchange()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_movements
    WHERE reference_type IN ('currency_exchange_in','currency_exchange_out')
      AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_currency_exchange_cleanup ON public.currency_exchanges;
CREATE TRIGGER trg_currency_exchange_cleanup
  BEFORE DELETE ON public.currency_exchanges
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_currency_exchange();
