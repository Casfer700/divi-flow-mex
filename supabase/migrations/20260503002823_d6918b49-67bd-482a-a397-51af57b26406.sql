
-- Revoke from PUBLIC (which anon inherits from), then grant to authenticated
-- Trigger functions
REVOKE ALL ON FUNCTION public.cleanup_batch_invoice_purchase() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_currency_exchange() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_order_financial_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_pos_payment_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_pos_sale_commission() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_pos_sale_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_batch_invoice_purchase() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_currency_exchange() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_order_payment_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_pos_payment_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_pos_sale_batch_consumption() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_pos_sale_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_pos_sale_commission() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_pos_sale_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_batches_on_sale_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_balance_difference() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_role_limit() FROM PUBLIC;

-- Functions with args
REVOKE ALL ON FUNCTION public.compute_expected_closing(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_batches_fifo(uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;

-- Grant back to authenticated for functions that need it
GRANT EXECUTE ON FUNCTION public.compute_expected_closing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_batches_fifo(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- has_role needs to stay accessible for RLS - keep PUBLIC grant
-- (it's already granted by default)
