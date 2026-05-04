
-- Add optional supplier commission fields to product_batches
ALTER TABLE public.product_batches
  ADD COLUMN commission_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN commission_mxn numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.product_batches.commission_usd IS 'Optional supplier commission in USD';
COMMENT ON COLUMN public.product_batches.commission_mxn IS 'Optional supplier commission in MXN, included in total acquisition cost';
