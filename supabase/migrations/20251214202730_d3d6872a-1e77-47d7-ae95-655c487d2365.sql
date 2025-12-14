-- Allow delivery role to insert inventory movements when marking orders as delivered
DROP POLICY IF EXISTS "Admins and locals can insert inventory movements" ON inventory_movements;

CREATE POLICY "Authenticated users can insert inventory movements" 
ON public.inventory_movements 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'local'::app_role) OR 
  has_role(auth.uid(), 'delivery'::app_role)
);