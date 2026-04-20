-- Recreate the view with security_invoker so RLS of the querying user is applied
DROP VIEW IF EXISTS public.product_stock;

CREATE VIEW public.product_stock
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  COALESCE(SUM(b.remaining_quantity), 0) AS stock,
  CASE WHEN COALESCE(SUM(b.remaining_quantity), 0) > 0
       THEN SUM(b.remaining_quantity * (b.cost_usd / NULLIF(b.quantity, 0))) / SUM(b.remaining_quantity)
       ELSE 0 END AS avg_cost_usd,
  CASE WHEN COALESCE(SUM(b.remaining_quantity), 0) > 0
       THEN SUM(b.remaining_quantity * (b.cost_mxn / NULLIF(b.quantity, 0))) / SUM(b.remaining_quantity)
       ELSE 0 END AS avg_cost_mxn
FROM public.products p
LEFT JOIN public.product_batches b ON b.product_id = p.id
GROUP BY p.id, p.name;