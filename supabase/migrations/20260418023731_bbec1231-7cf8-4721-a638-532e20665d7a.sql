-- 1. Enums
CREATE TYPE public.movement_type AS ENUM ('income', 'expense');
CREATE TYPE public.movement_source AS ENUM ('sale', 'manual', 'commission', 'purchase', 'currency_exchange');
CREATE TYPE public.payment_method AS ENUM ('cash', 'transfer');
CREATE TYPE public.account_type AS ENUM ('cash', 'bank', 'wallet', 'other');

-- 2. Accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  account_type public.account_type NOT NULL DEFAULT 'cash',
  currency TEXT NOT NULL DEFAULT 'MXN',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view accounts"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'local'));

CREATE POLICY "Only admins can insert accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete accounts"
  ON public.accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Financial movements table
CREATE TABLE public.financial_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  movement_type public.movement_type NOT NULL,
  source public.movement_source NOT NULL DEFAULT 'manual',
  currency TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  reference TEXT,
  reference_id UUID,
  reference_type TEXT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_movements_date ON public.financial_movements(movement_date DESC);
CREATE INDEX idx_financial_movements_account ON public.financial_movements(account_id);
CREATE INDEX idx_financial_movements_reference ON public.financial_movements(reference_type, reference_id);

ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view movements"
  ON public.financial_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'local'));

CREATE POLICY "Admin and local can insert movements"
  ON public.financial_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'local'));

CREATE POLICY "Only admins can update movements"
  ON public.financial_movements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete movements"
  ON public.financial_movements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_financial_movements_updated_at
  BEFORE UPDATE ON public.financial_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Default account
INSERT INTO public.accounts (name, account_type, currency, notes)
VALUES ('Caja Principal', 'cash', 'MXN', 'Cuenta por defecto del sistema');

-- 5. Trigger: auto-create financial movement when order paid, remove if reverted
CREATE OR REPLACE FUNCTION public.handle_order_payment_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_account_id UUID;
BEGIN
  -- INSERT: order created already paid
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IN ('paid', 'verified') THEN
      SELECT id INTO default_account_id FROM public.accounts
        WHERE currency = 'MXN' AND is_active = true
        ORDER BY created_at ASC LIMIT 1;

      INSERT INTO public.financial_movements
        (movement_type, source, currency, amount, payment_method, account_id,
         reference, reference_id, reference_type, notes, created_by)
      VALUES
        ('income', 'sale', 'MXN', NEW.total_mxn, 'cash', default_account_id,
         'Orden ' || NEW.id, NEW.id, 'order',
         'Cobro automático de orden', NEW.created_by);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: payment status transitioned to paid
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
      IF NEW.payment_status IN ('paid', 'verified')
         AND (OLD.payment_status IS NULL OR OLD.payment_status = 'pending') THEN
        SELECT id INTO default_account_id FROM public.accounts
          WHERE currency = 'MXN' AND is_active = true
          ORDER BY created_at ASC LIMIT 1;

        INSERT INTO public.financial_movements
          (movement_type, source, currency, amount, payment_method, account_id,
           reference, reference_id, reference_type, notes, created_by)
        VALUES
          ('income', 'sale', 'MXN', NEW.total_mxn, 'cash', default_account_id,
           'Orden ' || NEW.id, NEW.id, 'order',
           'Cobro automático de orden', NEW.created_by);

      -- Reverted from paid to pending → remove movement
      ELSIF (OLD.payment_status IN ('paid', 'verified'))
            AND NEW.payment_status = 'pending' THEN
        DELETE FROM public.financial_movements
          WHERE reference_type = 'order' AND reference_id = NEW.id AND source = 'sale';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER orders_payment_to_movement
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_payment_movement();

-- 6. Cleanup movement when order is deleted
CREATE OR REPLACE FUNCTION public.cleanup_order_financial_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_movements
    WHERE reference_type = 'order' AND reference_id = OLD.id AND source = 'sale';
  RETURN OLD;
END;
$$;

CREATE TRIGGER orders_delete_cleanup_movement
  BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_order_financial_movement();