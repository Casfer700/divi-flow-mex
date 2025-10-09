-- Add delivery_notes column to orders table
ALTER TABLE public.orders ADD COLUMN delivery_notes text;

-- Update RLS policy to allow delivery users to update delivery_status and delivery_notes
CREATE POLICY "Delivery users can update delivery info"
ON public.orders
FOR UPDATE
USING (
  has_role(auth.uid(), 'delivery'::app_role) AND 
  auth.uid() = assigned_to
)
WITH CHECK (
  has_role(auth.uid(), 'delivery'::app_role) AND 
  auth.uid() = assigned_to
);