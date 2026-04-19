-- Products catalog
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view products"
  ON public.products FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete products"
  ON public.products FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POS sales (header)
CREATE TABLE public.pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  payment_method payment_method NOT NULL DEFAULT 'cash',
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  sales_agent TEXT,
  notes TEXT,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and local can view pos sales"
  ON public.pos_sales FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Admin and local can insert pos sales"
  ON public.pos_sales FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

CREATE POLICY "Only admins can update pos sales"
  ON public.pos_sales FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete pos sales"
  ON public.pos_sales FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER pos_sales_set_updated_at
  BEFORE UPDATE ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create financial movement when POS sale is registered
CREATE OR REPLACE FUNCTION public.handle_pos_sale_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_movements
      (movement_type, source, currency, amount, payment_method, account_id,
       reference, reference_id, reference_type, notes, created_by, movement_date)
    VALUES
      ('income', 'sale', NEW.currency, NEW.total_amount, NEW.payment_method, NEW.account_id,
       'POS - ' || NEW.product_name ||
         CASE WHEN NEW.sales_agent IS NOT NULL AND NEW.sales_agent <> ''
              THEN ' (' || NEW.sales_agent || ')' ELSE '' END,
       NEW.id, 'pos_sale',
       COALESCE(NEW.notes, 'Venta POS'),
       NEW.created_by, NEW.sale_date);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER pos_sales_create_movement
  AFTER INSERT ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_pos_sale_movement();

-- Cleanup financial movement when POS sale is deleted
CREATE OR REPLACE FUNCTION public.cleanup_pos_sale_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_movements
    WHERE reference_type = 'pos_sale' AND reference_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER pos_sales_cleanup_movement
  BEFORE DELETE ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_pos_sale_movement();

CREATE INDEX idx_products_active ON public.products(is_active);
CREATE INDEX idx_pos_sales_date ON public.pos_sales(sale_date DESC);
CREATE INDEX idx_pos_sales_agent ON public.pos_sales(sales_agent);