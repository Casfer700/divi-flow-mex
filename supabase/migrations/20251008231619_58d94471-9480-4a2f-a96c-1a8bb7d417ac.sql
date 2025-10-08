-- Add policy to allow authenticated users to view all profiles (needed for assignment selectors)
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Add policy to allow admins to view all user_roles
CREATE POLICY "Admins can view all user_roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));