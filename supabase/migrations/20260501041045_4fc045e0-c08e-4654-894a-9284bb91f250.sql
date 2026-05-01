ALTER TABLE public.currency_exchanges
  ADD COLUMN IF NOT EXISTS customer_name text;

-- Update the currency exchange trigger to include customer name in the reference/notes
CREATE OR REPLACE FUNCTION public.handle_currency_exchange()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_suffix TEXT := '';
BEGIN
  IF NEW.customer_name IS NOT NULL AND NEW.customer_name <> '' THEN
    customer_suffix := ' · ' || NEW.customer_name;
  END IF;

  IF NEW.operation = 'sell' THEN
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('expense', 'currency_exchange', NEW.currency, NEW.amount, 'cash', NEW.currency_account_id,
       'Venta ' || NEW.currency || ' @ ' || NEW.exchange_rate || customer_suffix,
       NEW.id, 'currency_exchange_out',
       COALESCE(NEW.notes, 'Venta de divisa'), NEW.created_by, NEW.operation_date);

    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('income', 'currency_exchange', 'MXN', NEW.mxn_equivalent, 'cash', NEW.mxn_account_id,
       'Venta ' || NEW.currency || ' @ ' || NEW.exchange_rate || customer_suffix,
       NEW.id, 'currency_exchange_in',
       COALESCE(NEW.notes, 'Venta de divisa'), NEW.created_by, NEW.operation_date);
  ELSIF NEW.operation = 'buy' THEN
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('income', 'currency_exchange', NEW.currency, NEW.amount, 'cash', NEW.currency_account_id,
       'Compra ' || NEW.currency || ' @ ' || NEW.exchange_rate || customer_suffix,
       NEW.id, 'currency_exchange_in',
       COALESCE(NEW.notes, 'Compra de divisa'), NEW.created_by, NEW.operation_date);

    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('expense', 'currency_exchange', 'MXN', NEW.mxn_equivalent, 'cash', NEW.mxn_account_id,
       'Compra ' || NEW.currency || ' @ ' || NEW.exchange_rate || customer_suffix,
       NEW.id, 'currency_exchange_out',
       COALESCE(NEW.notes, 'Compra de divisa'), NEW.created_by, NEW.operation_date);
  END IF;
  RETURN NEW;
END;
$function$;

-- Update batch_invoice purchase trigger to handle UPDATE (not just INSERT) so editing keeps movement in sync
CREATE OR REPLACE FUNCTION public.handle_batch_invoice_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
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
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If any payment-related field changed, regenerate the linked movement
    IF (OLD.payment_amount IS DISTINCT FROM NEW.payment_amount)
       OR (OLD.payment_currency IS DISTINCT FROM NEW.payment_currency)
       OR (OLD.payment_method IS DISTINCT FROM NEW.payment_method)
       OR (OLD.account_id IS DISTINCT FROM NEW.account_id)
       OR (OLD.payment_date IS DISTINCT FROM NEW.payment_date)
       OR (OLD.invoice_number IS DISTINCT FROM NEW.invoice_number)
       OR (OLD.notes IS DISTINCT FROM NEW.notes) THEN
      DELETE FROM public.financial_movements
        WHERE reference_type = 'batch_invoice' AND reference_id = NEW.id;
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
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_batch_invoice_purchase ON public.batch_invoices;
CREATE TRIGGER trg_batch_invoice_purchase
AFTER INSERT OR UPDATE ON public.batch_invoices
FOR EACH ROW EXECUTE FUNCTION public.handle_batch_invoice_purchase();