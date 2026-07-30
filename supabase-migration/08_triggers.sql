-- ============================================================================
-- Sweet 'n Lovely Pizza — 08_triggers.sql
-- All triggers (public schema + auth.users). Fully idempotent:
-- every trigger is dropped if present before being (re)created.
-- Run AFTER 07_functions.sql.
-- ============================================================================

-- ---------------------------------------------------------------- updated_at
DROP TRIGGER IF EXISTS set_admin_presence_updated_at ON public.admin_presence;
CREATE TRIGGER set_admin_presence_updated_at BEFORE UPDATE ON public.admin_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_banners_updated_at ON public.banners;
CREATE TRIGGER set_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated ON public.categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_content_pages_updated ON public.content_pages;
CREATE TRIGGER trg_content_pages_updated BEFORE UPDATE ON public.content_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_delivery_zones_updated_at ON public.delivery_zones;
CREATE TRIGGER set_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_discounts_updated_at ON public.discounts;
CREATE TRIGGER set_discounts_updated_at BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_featured_items_updated_at ON public.featured_items;
CREATE TRIGGER set_featured_items_updated_at BEFORE UPDATE ON public.featured_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_home_banners_updated ON public.home_banners;
CREATE TRIGGER trg_home_banners_updated BEFORE UPDATE ON public.home_banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS home_desserts_set_updated_at ON public.home_desserts;
CREATE TRIGGER home_desserts_set_updated_at BEFORE UPDATE ON public.home_desserts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_home_hot_deals_updated ON public.home_hot_deals;
CREATE TRIGGER trg_home_hot_deals_updated BEFORE UPDATE ON public.home_hot_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_home_popular_items_updated ON public.home_popular_items;
CREATE TRIGGER trg_home_popular_items_updated BEFORE UPDATE ON public.home_popular_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_home_section_visibility_updated ON public.home_section_visibility;
CREATE TRIGGER trg_home_section_visibility_updated BEFORE UPDATE ON public.home_section_visibility
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_home_specials_updated ON public.home_specials;
CREATE TRIGGER trg_home_specials_updated BEFORE UPDATE ON public.home_specials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_integrations_updated ON public.integrations;
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_loyalty_accounts_updated_at ON public.loyalty_accounts;
CREATE TRIGGER set_loyalty_accounts_updated_at BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_loyalty_programs_updated_at ON public.loyalty_programs;
CREATE TRIGGER set_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON public.orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pizza_toppings_updated ON public.pizza_toppings;
CREATE TRIGGER trg_pizza_toppings_updated BEFORE UPDATE ON public.pizza_toppings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS product_sizes_set_updated_at ON public.product_sizes;
CREATE TRIGGER product_sizes_set_updated_at BEFORE UPDATE ON public.product_sizes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_promotions_updated_at ON public.promotions;
CREATE TRIGGER set_promotions_updated_at BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_reservations_updated_at ON public.reservations;
CREATE TRIGGER set_reservations_updated_at BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated ON public.reviews;
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_system_settings_updated ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS user_addresses_set_updated_at ON public.user_addresses;
CREATE TRIGGER user_addresses_set_updated_at BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------- order notices
DROP TRIGGER IF EXISTS trg_notify_admin_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_on_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_new_order();

DROP TRIGGER IF EXISTS trg_notify_customer_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_customer_on_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_new_order();

DROP TRIGGER IF EXISTS trg_notify_customer_on_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_customer_on_order_status_change AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_order_status_change();

-- ------------------------------------------------------- business-rule guards
DROP TRIGGER IF EXISTS user_addresses_single_default ON public.user_addresses;
CREATE TRIGGER user_addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.user_addresses
  FOR EACH ROW WHEN (new.is_default = true)
  EXECUTE FUNCTION public.user_addresses_enforce_single_default();

DROP TRIGGER IF EXISTS user_roles_validate_zone_trg ON public.user_roles;
CREATE TRIGGER user_roles_validate_zone_trg
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_validate_zone();

-- ------------------------------------------------------------- auth.users hook
-- Requires owner/superuser privileges on auth.users (Supabase SQL editor is fine).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 32 triggers total (31 public + 1 auth). Safe to re-run at any time.
-- ============================================================================