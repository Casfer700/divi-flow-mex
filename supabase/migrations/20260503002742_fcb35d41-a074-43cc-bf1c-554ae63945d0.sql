
-- Revoke anon execute on all public SECURITY DEFINER functions
-- Trigger functions (no args)
REVOKE EXECUTE ON FUNCTION public.cleanup_batch_invoice_purchase() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_currency_exchange() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_order_financial_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_pos_payment_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_pos_sale_commission() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_pos_sale_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_batch_invoice_purchase() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_currency_exchange() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_order_payment_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_payment_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_batch_consumption() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_cancel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_commission() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_pos_sale_movement() FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_batches_on_sale_delete() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_balance_difference() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_role_limit() FROM anon;

-- Functions with args
REVOKE EXECUTE ON FUNCTION public.compute_expected_closing(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_batches_fifo(uuid, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;

-- has_role must stay accessible to anon because RLS policies on public role use it
-- But get_user_role doesn't need anon access
