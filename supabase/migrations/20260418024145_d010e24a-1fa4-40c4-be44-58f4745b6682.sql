ALTER TABLE public.financial_movements
  ADD COLUMN category TEXT;

CREATE INDEX idx_financial_movements_category
  ON public.financial_movements(category)
  WHERE category IS NOT NULL;