-- Create exchange rates table for wholesale and retail prices
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR', 'CUP')),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('wholesale', 'retail')),
  buy_rate NUMERIC(10, 4) NOT NULL,
  sell_rate NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(currency, rate_type)
);

-- Create inventory movements table
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR', 'CUP')),
  amount NUMERIC(10, 2) NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  reference_type TEXT CHECK (reference_type IN ('order', 'manual')),
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add new columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'retail' CHECK (price_type IN ('wholesale', 'retail'));

-- Enable RLS on new tables
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_rates
CREATE POLICY "Anyone can view exchange rates"
  ON public.exchange_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert exchange rates"
  ON public.exchange_rates FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update exchange rates"
  ON public.exchange_rates FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete exchange rates"
  ON public.exchange_rates FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for inventory_movements
CREATE POLICY "Authenticated users can view inventory movements"
  ON public.inventory_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and locals can insert inventory movements"
  ON public.inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'local')
  );

CREATE POLICY "Only admins can update inventory movements"
  ON public.inventory_movements FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete inventory movements"
  ON public.inventory_movements FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on exchange_rates
CREATE TRIGGER update_exchange_rates_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default exchange rates
INSERT INTO public.exchange_rates (currency, rate_type, buy_rate, sell_rate) VALUES
  ('USD', 'retail', 19.50, 20.00),
  ('USD', 'wholesale', 19.00, 19.50),
  ('EUR', 'retail', 21.00, 21.50),
  ('EUR', 'wholesale', 20.50, 21.00),
  ('CUP', 'retail', 0.75, 0.85),
  ('CUP', 'wholesale', 0.70, 0.80)
ON CONFLICT (currency, rate_type) DO NOTHING;