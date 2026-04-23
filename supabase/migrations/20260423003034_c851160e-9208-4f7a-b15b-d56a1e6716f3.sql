-- 1. pos_sales: add status + commission_currency
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS commission_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 2. batch_invoices: due_date + cancelled_at for bulk operations
ALTER TABLE public.batch_invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 3. Update commission trigger to use commission_currency
CREATE OR REPLACE FUNCTION public.handle_pos_sale_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  default_account_id UUID;
  agent_name TEXT;
  comm_currency TEXT;
BEGIN
  IF NEW.commission_mxn IS NOT NULL AND NEW.commission_mxn > 0 THEN
    comm_currency := COALESCE(NEW.commission_currency, 'USD');

    SELECT id INTO default_account_id FROM public.accounts
      WHERE currency = comm_currency AND is_active = true
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
      ('expense', 'commission', comm_currency, NEW.commission_mxn, 'cash', default_account_id,
       'Comisión - ' || agent_name, NEW.id, 'pos_sale_commission',
       'Comisión automática por venta POS', NEW.created_by, NEW.sale_date);
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Cancel sale trigger: when status flips to 'cancelled', reverse everything
CREATE OR REPLACE FUNCTION public.handle_pos_sale_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND COALESCE(OLD.status, 'active') <> 'cancelled' THEN
    -- 1. delete linked financial movements (sale income, commission, payments)
    DELETE FROM public.financial_movements
      WHERE reference_id = NEW.id
        AND reference_type IN ('pos_sale', 'pos_sale_commission');

    DELETE FROM public.financial_movements
      WHERE reference_type = 'pos_payment'
        AND reference_id IN (SELECT id FROM public.pos_sale_payments WHERE sale_id = NEW.id);

    -- 2. restore consumed batches
    FOR c IN
      SELECT batch_id, quantity FROM public.pos_sale_batch_consumption WHERE sale_id = NEW.id
    LOOP
      UPDATE public.product_batches
         SET remaining_quantity = remaining_quantity + c.quantity
       WHERE id = c.batch_id;
    END LOOP;
    DELETE FROM public.pos_sale_batch_consumption WHERE sale_id = NEW.id;

    -- 3. free any linked invoice
    UPDATE public.batch_invoices
       SET status = 'available', sale_id = NULL
     WHERE sale_id = NEW.id;

    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pos_sale_cancel ON public.pos_sales;
CREATE TRIGGER trg_pos_sale_cancel
  BEFORE UPDATE ON public.pos_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pos_sale_cancel();