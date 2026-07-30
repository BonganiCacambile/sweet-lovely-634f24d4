--
-- Sweet 'n Lovely Pizza — 09_security.sql
-- Row Level Security: enable RLS on every public table and (re)create all policies.
-- Idempotent: every policy is dropped first, so this file can be re-run safely.
-- Run AFTER 07_functions.sql (policies reference private.* helper functions).
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_content_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_desserts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_hot_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_popular_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_section_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pizza_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Main admin can view all presence" ON public.admin_presence;
CREATE POLICY "Main admin can view all presence" ON public.admin_presence AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own presence" ON public.admin_presence;
CREATE POLICY "Users can update own presence" ON public.admin_presence AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can upsert own presence" ON public.admin_presence;
CREATE POLICY "Users can upsert own presence" ON public.admin_presence AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own presence" ON public.admin_presence;
CREATE POLICY "Users can view own presence" ON public.admin_presence AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS "audit admin insert" ON public.audit_logs;
CREATE POLICY "audit admin insert" ON public.audit_logs AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "audit admin read" ON public.audit_logs;
CREATE POLICY "audit admin read" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "audit zone admin read" ON public.audit_logs;
CREATE POLICY "audit zone admin read" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated
  USING ((private.is_zone_admin(auth.uid()) AND ((metadata ->> 'zone_id'::text) = (private.get_user_zone(auth.uid()))::text)));

DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners" ON public.banners AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners" ON public.banners AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories" ON public.categories AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "categories public read" ON public.categories;
CREATE POLICY "categories public read" ON public.categories AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "content admin write" ON public.content_pages;
CREATE POLICY "content admin write" ON public.content_pages AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "content public read published" ON public.content_pages;
CREATE POLICY "content public read published" ON public.content_pages AS PERMISSIVE FOR SELECT TO public
  USING (((status = 'published'::text) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Main admin full access zones" ON public.delivery_zones;
CREATE POLICY "Main admin full access zones" ON public.delivery_zones AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_main_admin(auth.uid()))
  WITH CHECK (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "Public can view active zones" ON public.delivery_zones;
CREATE POLICY "Public can view active zones" ON public.delivery_zones AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "Zone admin reads own zone" ON public.delivery_zones;
CREATE POLICY "Zone admin reads own zone" ON public.delivery_zones AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id = private.get_user_zone(auth.uid())));

DROP POLICY IF EXISTS "Zone admin updates own zone" ON public.delivery_zones;
CREATE POLICY "Zone admin updates own zone" ON public.delivery_zones AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((id = private.get_user_zone(auth.uid())))
  WITH CHECK ((id = private.get_user_zone(auth.uid())));

DROP POLICY IF EXISTS "Admins manage discounts" ON public.discounts;
CREATE POLICY "Admins manage discounts" ON public.discounts AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can view active discounts" ON public.discounts;
CREATE POLICY "Public can view active discounts" ON public.discounts AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "Admins manage featured" ON public.featured_items;
CREATE POLICY "Admins manage featured" ON public.featured_items AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can view active featured" ON public.featured_items;
CREATE POLICY "Public can view active featured" ON public.featured_items AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "banners admin read" ON public.home_banners;
CREATE POLICY "banners admin read" ON public.home_banners AS PERMISSIVE FOR SELECT TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "banners admin write" ON public.home_banners;
CREATE POLICY "banners admin write" ON public.home_banners AS PERMISSIVE FOR ALL TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "banners public read active" ON public.home_banners;
CREATE POLICY "banners public read active" ON public.home_banners AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "events admin read" ON public.home_content_events;
CREATE POLICY "events admin read" ON public.home_content_events AS PERMISSIVE FOR SELECT TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "events public insert" ON public.home_content_events;
CREATE POLICY "events public insert" ON public.home_content_events AS PERMISSIVE FOR INSERT TO anon, authenticated
  WITH CHECK (((event_type = ANY (ARRAY['view'::text, 'click'::text])) AND (content_type = ANY (ARRAY['popular'::text, 'hot_deal'::text, 'special'::text, 'banner'::text, 'featured'::text]))));

DROP POLICY IF EXISTS "desserts admin read" ON public.home_desserts;
CREATE POLICY "desserts admin read" ON public.home_desserts AS PERMISSIVE FOR SELECT TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "desserts admin write" ON public.home_desserts;
CREATE POLICY "desserts admin write" ON public.home_desserts AS PERMISSIVE FOR ALL TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "desserts public read active" ON public.home_desserts;
CREATE POLICY "desserts public read active" ON public.home_desserts AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "deals admin read" ON public.home_hot_deals;
CREATE POLICY "deals admin read" ON public.home_hot_deals AS PERMISSIVE FOR SELECT TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "deals admin write" ON public.home_hot_deals;
CREATE POLICY "deals admin write" ON public.home_hot_deals AS PERMISSIVE FOR ALL TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "deals public read active" ON public.home_hot_deals;
CREATE POLICY "deals public read active" ON public.home_hot_deals AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "popular admin read" ON public.home_popular_items;
CREATE POLICY "popular admin read" ON public.home_popular_items AS PERMISSIVE FOR SELECT TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "popular admin write" ON public.home_popular_items;
CREATE POLICY "popular admin write" ON public.home_popular_items AS PERMISSIVE FOR ALL TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "popular public read active" ON public.home_popular_items;
CREATE POLICY "popular public read active" ON public.home_popular_items AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "visibility admin write" ON public.home_section_visibility;
CREATE POLICY "visibility admin write" ON public.home_section_visibility AS PERMISSIVE FOR ALL TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "visibility public read global" ON public.home_section_visibility;
CREATE POLICY "visibility public read global" ON public.home_section_visibility AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((zone_id IS NULL));

DROP POLICY IF EXISTS "specials admin read" ON public.home_specials;
CREATE POLICY "specials admin read" ON public.home_specials AS PERMISSIVE FOR SELECT TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "specials admin write" ON public.home_specials;
CREATE POLICY "specials admin write" ON public.home_specials AS PERMISSIVE FOR ALL TO public
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))))
  WITH CHECK ((private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));

DROP POLICY IF EXISTS "specials public read active" ON public.home_specials;
CREATE POLICY "specials public read active" ON public.home_specials AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS "integrations admin all" ON public.integrations;
CREATE POLICY "integrations admin all" ON public.integrations AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Zone admin reads zone inventory" ON public.inventory_movements;
CREATE POLICY "Zone admin reads zone inventory" ON public.inventory_movements AS PERMISSIVE FOR SELECT TO authenticated
  USING (((order_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = inventory_movements.order_id) AND (o.delivery_zone_id = private.get_user_zone(auth.uid())))))));

DROP POLICY IF EXISTS "inventory_movements admin insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin insert" ON public.inventory_movements AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "inventory_movements admin read" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin read" ON public.inventory_movements AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage loyalty" ON public.loyalty_accounts;
CREATE POLICY "Admins manage loyalty" ON public.loyalty_accounts AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own loyalty" ON public.loyalty_accounts;
CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage programs" ON public.loyalty_programs;
CREATE POLICY "Admins manage programs" ON public.loyalty_programs AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can view active programs" ON public.loyalty_programs;
CREATE POLICY "Public can view active programs" ON public.loyalty_programs AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "notifications admin delete" ON public.notifications;
CREATE POLICY "notifications admin delete" ON public.notifications AS PERMISSIVE FOR DELETE TO authenticated
  USING ((private.has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = user_id)));

DROP POLICY IF EXISTS "notifications admin insert" ON public.notifications;
CREATE POLICY "notifications admin insert" ON public.notifications AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "notifications own read" ON public.notifications;
CREATE POLICY "notifications own read" ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = user_id) OR ((user_id IS NULL) AND private.has_role(auth.uid(), 'admin'::app_role)) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "notifications own update" ON public.notifications;
CREATE POLICY "notifications own update" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Zone admin reads zone order items" ON public.order_items;
CREATE POLICY "Zone admin reads zone order items" ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND (o.delivery_zone_id IS NOT NULL) AND (o.delivery_zone_id = private.get_user_zone(auth.uid()))))));

DROP POLICY IF EXISTS "order_items admin delete" ON public.order_items;
CREATE POLICY "order_items admin delete" ON public.order_items AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "order_items admin update" ON public.order_items;
CREATE POLICY "order_items admin update" ON public.order_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "order_items read via order" ON public.order_items;
CREATE POLICY "order_items read via order" ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role))))));

DROP POLICY IF EXISTS "Zone admin reads zone orders" ON public.orders;
CREATE POLICY "Zone admin reads zone orders" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (((delivery_zone_id IS NOT NULL) AND (delivery_zone_id = private.get_user_zone(auth.uid()))));

DROP POLICY IF EXISTS "Zone admin updates zone orders" ON public.orders;
CREATE POLICY "Zone admin updates zone orders" ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((delivery_zone_id IS NOT NULL) AND (delivery_zone_id = private.get_user_zone(auth.uid()))))
  WITH CHECK (((delivery_zone_id IS NOT NULL) AND (delivery_zone_id = private.get_user_zone(auth.uid()))));

DROP POLICY IF EXISTS "orders admin delete" ON public.orders;
CREATE POLICY "orders admin delete" ON public.orders AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders admin update" ON public.orders;
CREATE POLICY "orders admin update" ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders user read own" ON public.orders;
CREATE POLICY "orders user read own" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "pizza_toppings admin manage" ON public.pizza_toppings;
CREATE POLICY "pizza_toppings admin manage" ON public.pizza_toppings AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "pizza_toppings anon read active" ON public.pizza_toppings;
CREATE POLICY "pizza_toppings anon read active" ON public.pizza_toppings AS PERMISSIVE FOR SELECT TO anon
  USING ((is_active = true));

DROP POLICY IF EXISTS "pizza_toppings auth read" ON public.pizza_toppings;
CREATE POLICY "pizza_toppings auth read" ON public.pizza_toppings AS PERMISSIVE FOR SELECT TO authenticated
  USING (((is_active = true) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins can delete sizes" ON public.product_sizes;
CREATE POLICY "Admins can delete sizes" ON public.product_sizes AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert sizes" ON public.product_sizes;
CREATE POLICY "Admins can insert sizes" ON public.product_sizes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update sizes" ON public.product_sizes;
CREATE POLICY "Admins can update sizes" ON public.product_sizes AS PERMISSIVE FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all sizes" ON public.product_sizes;
CREATE POLICY "Admins can view all sizes" ON public.product_sizes AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can view available sizes" ON public.product_sizes;
CREATE POLICY "Public can view available sizes" ON public.product_sizes AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((is_available = true) AND (EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.slug = product_sizes.product_slug) AND (p.is_active = true))))));

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products" ON public.products AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING ((is_active = true));

DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products admin write" ON public.products AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "products public read active" ON public.products;
CREATE POLICY "products public read active" ON public.products AS PERMISSIVE FOR SELECT TO public
  USING ((is_active OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Admins manage promotions" ON public.promotions;
CREATE POLICY "Admins manage promotions" ON public.promotions AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage reservations" ON public.reservations;
CREATE POLICY "Admins manage reservations" ON public.reservations AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users cancel own pending reservations" ON public.reservations;
CREATE POLICY "Users cancel own pending reservations" ON public.reservations AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text]))))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users create own reservations" ON public.reservations;
CREATE POLICY "Users create own reservations" ON public.reservations AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Users view own reservations" ON public.reservations;
CREATE POLICY "Users view own reservations" ON public.reservations AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "reviews admin delete" ON public.reviews;
CREATE POLICY "reviews admin delete" ON public.reviews AS PERMISSIVE FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "reviews admin manage" ON public.reviews;
CREATE POLICY "reviews admin manage" ON public.reviews AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "reviews public read approved" ON public.reviews;
CREATE POLICY "reviews public read approved" ON public.reviews AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (((status = 'approved'::review_status) OR (auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "reviews user insert own" ON public.reviews;
CREATE POLICY "reviews user insert own" ON public.reviews AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "role_permissions admin read" ON public.role_permissions;
CREATE POLICY "role_permissions admin read" ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "role_permissions admin write" ON public.role_permissions;
CREATE POLICY "role_permissions admin write" ON public.role_permissions AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage hours" ON public.store_hours;
CREATE POLICY "Admins manage hours" ON public.store_hours AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public can view hours" ON public.store_hours;
CREATE POLICY "Public can view hours" ON public.store_hours AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "settings admin all" ON public.system_settings;
CREATE POLICY "settings admin all" ON public.system_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "addresses owner delete" ON public.user_addresses;
CREATE POLICY "addresses owner delete" ON public.user_addresses AS PERMISSIVE FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "addresses owner insert" ON public.user_addresses;
CREATE POLICY "addresses owner insert" ON public.user_addresses AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "addresses owner select" ON public.user_addresses;
CREATE POLICY "addresses owner select" ON public.user_addresses AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "addresses owner update" ON public.user_addresses;
CREATE POLICY "addresses owner update" ON public.user_addresses AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role)));


--
-- End of 09_security.sql
--
