REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_admin_on_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_customer_on_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_customer_on_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_stock_availability(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollback_order_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_order_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_main_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_zone_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_zone(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_zone_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_zone(uuid) TO anon, authenticated, service_role;