-- Add delivery_date column to orders table
ALTER TABLE public.orders 
ADD COLUMN delivery_date TIMESTAMP WITH TIME ZONE;