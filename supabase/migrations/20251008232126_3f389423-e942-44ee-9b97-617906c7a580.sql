-- Drop the restrictive admin-only policy
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;

-- Allow authenticated users to view local and delivery roles (needed for order assignment)
CREATE POLICY "Users can view local and delivery roles" 
ON public.user_roles 
FOR SELECT 
USING (
  role IN ('local', 'delivery') OR 
  user_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role)
);