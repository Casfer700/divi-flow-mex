-- Drop the existing check constraint for rate_type
ALTER TABLE public.exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_rate_type_check;

-- Add a new check constraint that includes 'individual'
ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_rate_type_check 
CHECK (rate_type IN ('wholesale', 'retail', 'individual'));

-- Insert a new exchange rate for CUP with "individual" rate type
INSERT INTO public.exchange_rates (currency, rate_type, buy_rate, sell_rate)
VALUES ('CUP', 'individual', 0, 22.0);