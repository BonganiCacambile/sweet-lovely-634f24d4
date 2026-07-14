
-- Lock down SECURITY DEFINER functions in public schema so anon/authenticated
-- can't call them directly via PostgREST. Trigger fns fire as owner regardless.
-- Helpers used in RLS are called via the private.* schema (see policies).

-- Move helpers still in public that RLS uses under private schema.
ALTER FUNCTION public.can_access_zone(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.has_permission(uuid, app_permission) SET SCHEMA private;

-- Revoke EXECUTE from anon/authenticated/PUBLIC on remaining SECURITY DEFINER
-- functions in the public schema. service_role retains access (bypasses).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_main_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_zone_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_zone(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_customer_on_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_customer_on_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollback_order_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_stock_availability(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
