
-- 1. Fix product_stock view: SECURITY INVOKER instead of DEFINER
DROP VIEW IF EXISTS public.product_stock;
CREATE VIEW public.product_stock WITH (security_invoker = true) AS
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

-- 2. Fix profiles: restrict public SELECT to authenticated
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Also fix the other public policies on profiles to authenticated
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- 3. Fix whatsapp_templates: restrict all policies from public to authenticated
DROP POLICY IF EXISTS "Anyone can view templates" ON public.whatsapp_templates;
CREATE POLICY "Authenticated users can view templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can insert templates" ON public.whatsapp_templates;
CREATE POLICY "Only admins can insert templates"
  ON public.whatsapp_templates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update templates" ON public.whatsapp_templates;
CREATE POLICY "Only admins can update templates"
  ON public.whatsapp_templates FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete templates" ON public.whatsapp_templates;
CREATE POLICY "Only admins can delete templates"
  ON public.whatsapp_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix inventory_movements INSERT: public -> authenticated
DROP POLICY IF EXISTS "Authenticated users can insert inventory movements" ON public.inventory_movements;
CREATE POLICY "Authenticated users can insert inventory movements"
  ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role) OR has_role(auth.uid(), 'delivery'::app_role));

-- 5. Fix user_roles: add explicit restrictive write policies (admin only)
DROP POLICY IF EXISTS "Users can view local and delivery roles" ON public.user_roles;
CREATE POLICY "Users can view local and delivery roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING ((role = ANY (ARRAY['local'::app_role, 'delivery'::app_role])) OR (user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix customers: restrict write to admin+local
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
CREATE POLICY "Admin and local can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Admin and local can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
CREATE POLICY "Only admins can delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Fix orders: restrict INSERT/DELETE, keep UPDATE open for delivery
DROP POLICY IF EXISTS "Authenticated users can insert orders" ON public.orders;
CREATE POLICY "Admin and local can insert orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

DROP POLICY IF EXISTS "Authenticated users can delete orders" ON public.orders;
CREATE POLICY "Only admins can delete orders"
  ON public.orders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can update orders" ON public.orders;
CREATE POLICY "Admin and local can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'local'::app_role));

-- Keep delivery update policy (already has public role but fix to authenticated)
DROP POLICY IF EXISTS "Delivery users can update delivery info" ON public.orders;
CREATE POLICY "Delivery users can update delivery info"
  ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'delivery'::app_role) AND (auth.uid() = assigned_to))
  WITH CHECK (has_role(auth.uid(), 'delivery'::app_role) AND (auth.uid() = assigned_to));

-- 8. Fix check_role_limit: add search_path
CREATE OR REPLACE FUNCTION public.check_role_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  role_count INT;
BEGIN
  SELECT COUNT(*) INTO role_count
  FROM public.user_roles
  WHERE role = NEW.role;
  IF role_count >= 1 THEN
    RAISE EXCEPTION 'Ya existe un usuario con el rol %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Revoke EXECUTE from anon on internal functions
REVOKE EXECUTE ON FUNCTION public.consume_batches_fifo(uuid, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_batch_consumption() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_commission() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_cancel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_payment_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_order_financial_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_pos_sale_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_pos_payment_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_payment_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_batches_on_sale_delete() FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_expected_closing(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_balance_difference() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_pos_sale_commission() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_batch_invoice_purchase() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_currency_exchange() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_batch_invoice_purchase() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_currency_exchange() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_role_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
