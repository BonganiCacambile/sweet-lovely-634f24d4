--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

--
-- Name: admin_presence admin_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_presence
    ADD CONSTRAINT admin_presence_pkey PRIMARY KEY (user_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (slug);


--
-- Name: content_pages content_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_slug_key UNIQUE (slug);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: delivery_zones delivery_zones_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_slug_key UNIQUE (slug);


--
-- Name: discounts discounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discounts
    ADD CONSTRAINT discounts_pkey PRIMARY KEY (id);


--
-- Name: featured_items featured_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_items
    ADD CONSTRAINT featured_items_pkey PRIMARY KEY (id);


--
-- Name: featured_items featured_items_product_slug_placement_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_items
    ADD CONSTRAINT featured_items_product_slug_placement_key UNIQUE (product_slug, placement);


--
-- Name: home_banners home_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_banners
    ADD CONSTRAINT home_banners_pkey PRIMARY KEY (id);


--
-- Name: home_content_events home_content_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_content_events
    ADD CONSTRAINT home_content_events_pkey PRIMARY KEY (id);


--
-- Name: home_desserts home_desserts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_desserts
    ADD CONSTRAINT home_desserts_pkey PRIMARY KEY (id);


--
-- Name: home_hot_deals home_hot_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_hot_deals
    ADD CONSTRAINT home_hot_deals_pkey PRIMARY KEY (id);


--
-- Name: home_popular_items home_popular_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_popular_items
    ADD CONSTRAINT home_popular_items_pkey PRIMARY KEY (id);


--
-- Name: home_section_visibility home_section_visibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_section_visibility
    ADD CONSTRAINT home_section_visibility_pkey PRIMARY KEY (id);


--
-- Name: home_section_visibility home_section_visibility_section_zone_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_section_visibility
    ADD CONSTRAINT home_section_visibility_section_zone_id_key UNIQUE NULLS NOT DISTINCT (section, zone_id);


--
-- Name: home_specials home_specials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_specials
    ADD CONSTRAINT home_specials_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_provider_key UNIQUE (provider);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (user_id);


--
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: pizza_toppings pizza_toppings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_toppings
    ADD CONSTRAINT pizza_toppings_pkey PRIMARY KEY (id);


--
-- Name: pizza_toppings pizza_toppings_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizza_toppings
    ADD CONSTRAINT pizza_toppings_slug_key UNIQUE (slug);


--
-- Name: product_sizes product_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: reservations reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_permission_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_permission_key UNIQUE (role, permission);


--
-- Name: store_hours store_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_hours
    ADD CONSTRAINT store_hours_pkey PRIMARY KEY (day_of_week);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (group_key, key);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: discounts_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX discounts_target_idx ON public.discounts USING btree (target_type, target_slug);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_home_events_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_home_events_recent ON public.home_content_events USING btree (occurred_at DESC);


--
-- Name: idx_home_events_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_home_events_target ON public.home_content_events USING btree (content_type, content_id);


--
-- Name: idx_inventory_movements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_created ON public.inventory_movements USING btree (created_at DESC);


--
-- Name: idx_inventory_movements_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_movements_product ON public.inventory_movements USING btree (product_slug, created_at DESC);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read, created_at DESC);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_slug);


--
-- Name: idx_user_addresses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_addresses_user ON public.user_addresses USING btree (user_id, is_default DESC, created_at DESC);


--
-- Name: orders_delivery_zone_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_delivery_zone_id_idx ON public.orders USING btree (delivery_zone_id);


--
-- Name: orders_paystack_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_paystack_reference_key ON public.orders USING btree (paystack_reference) WHERE (paystack_reference IS NOT NULL);


--
-- Name: product_sizes_product_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_sizes_product_slug_idx ON public.product_sizes USING btree (product_slug, sort_order);


--
-- Name: reservations_reserved_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservations_reserved_at_idx ON public.reservations USING btree (reserved_at);


--
-- Name: reservations_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reservations_user_idx ON public.reservations USING btree (user_id);


--
-- Name: user_roles_zone_admin_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_roles_zone_admin_unique ON public.user_roles USING btree (user_id) WHERE (assigned_zone_id IS NOT NULL);


--
-- Name: home_desserts home_desserts_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER home_desserts_set_updated_at BEFORE UPDATE ON public.home_desserts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_sizes product_sizes_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER product_sizes_set_updated_at BEFORE UPDATE ON public.product_sizes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: admin_presence set_admin_presence_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_admin_presence_updated_at BEFORE UPDATE ON public.admin_presence FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: banners set_banners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: delivery_zones set_delivery_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: discounts set_discounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_discounts_updated_at BEFORE UPDATE ON public.discounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: featured_items set_featured_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_featured_items_updated_at BEFORE UPDATE ON public.featured_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: loyalty_accounts set_loyalty_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_loyalty_accounts_updated_at BEFORE UPDATE ON public.loyalty_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: loyalty_programs set_loyalty_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: promotions set_promotions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reservations set_reservations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories trg_categories_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: content_pages trg_content_pages_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_content_pages_updated BEFORE UPDATE ON public.content_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: home_banners trg_home_banners_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_home_banners_updated BEFORE UPDATE ON public.home_banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: home_hot_deals trg_home_hot_deals_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_home_hot_deals_updated BEFORE UPDATE ON public.home_hot_deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: home_popular_items trg_home_popular_items_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_home_popular_items_updated BEFORE UPDATE ON public.home_popular_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: home_section_visibility trg_home_section_visibility_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_home_section_visibility_updated BEFORE UPDATE ON public.home_section_visibility FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: home_specials trg_home_specials_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_home_specials_updated BEFORE UPDATE ON public.home_specials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: integrations trg_integrations_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: orders trg_notify_admin_on_new_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_admin_on_new_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_admin_on_new_order();


--
-- Name: orders trg_notify_customer_on_new_order; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_customer_on_new_order AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_new_order();


--
-- Name: orders trg_notify_customer_on_order_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_customer_on_order_status_change AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_order_status_change();


--
-- Name: orders trg_orders_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pizza_toppings trg_pizza_toppings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pizza_toppings_updated BEFORE UPDATE ON public.pizza_toppings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products trg_products_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reviews trg_reviews_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: system_settings trg_system_settings_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_addresses user_addresses_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_addresses_set_updated_at BEFORE UPDATE ON public.user_addresses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_addresses user_addresses_single_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_addresses_single_default AFTER INSERT OR UPDATE OF is_default ON public.user_addresses FOR EACH ROW WHEN ((new.is_default = true)) EXECUTE FUNCTION public.user_addresses_enforce_single_default();


--
-- Name: user_roles user_roles_validate_zone_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_roles_validate_zone_trg BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.user_roles_validate_zone();


--
-- Name: admin_presence admin_presence_assigned_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_presence
    ADD CONSTRAINT admin_presence_assigned_zone_id_fkey FOREIGN KEY (assigned_zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;


--
-- Name: admin_presence admin_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_presence
    ADD CONSTRAINT admin_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: content_pages content_pages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: featured_items featured_items_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_items
    ADD CONSTRAINT featured_items_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON DELETE CASCADE;


--
-- Name: home_banners home_banners_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_banners
    ADD CONSTRAINT home_banners_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: home_desserts home_desserts_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_desserts
    ADD CONSTRAINT home_desserts_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;


--
-- Name: home_hot_deals home_hot_deals_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_hot_deals
    ADD CONSTRAINT home_hot_deals_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON DELETE SET NULL;


--
-- Name: home_hot_deals home_hot_deals_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_hot_deals
    ADD CONSTRAINT home_hot_deals_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: home_popular_items home_popular_items_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_popular_items
    ADD CONSTRAINT home_popular_items_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON DELETE SET NULL;


--
-- Name: home_popular_items home_popular_items_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_popular_items
    ADD CONSTRAINT home_popular_items_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: home_section_visibility home_section_visibility_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_section_visibility
    ADD CONSTRAINT home_section_visibility_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: home_specials home_specials_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_specials
    ADD CONSTRAINT home_specials_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON DELETE CASCADE;


--
-- Name: loyalty_accounts loyalty_accounts_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.loyalty_programs(id) ON DELETE SET NULL;


--
-- Name: loyalty_accounts loyalty_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON DELETE SET NULL;


--
-- Name: orders orders_delivery_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivery_zone_id_fkey FOREIGN KEY (delivery_zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: product_sizes product_sizes_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_sizes
    ADD CONSTRAINT product_sizes_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_category_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_slug_fkey FOREIGN KEY (category_slug) REFERENCES public.categories(slug) ON DELETE RESTRICT;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reservations reservations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reservations
    ADD CONSTRAINT reservations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_product_slug_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_slug_fkey FOREIGN KEY (product_slug) REFERENCES public.products(slug) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_zone_id_fkey FOREIGN KEY (assigned_zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: product_sizes Admins can delete sizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete sizes" ON public.product_sizes FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_sizes Admins can insert sizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert sizes" ON public.product_sizes FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_sizes Admins can update sizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update sizes" ON public.product_sizes FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_sizes Admins can view all sizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all sizes" ON public.product_sizes FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: banners Admins manage banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage banners" ON public.banners TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: discounts Admins manage discounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage discounts" ON public.discounts TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: featured_items Admins manage featured; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage featured" ON public.featured_items TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: store_hours Admins manage hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage hours" ON public.store_hours TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: loyalty_accounts Admins manage loyalty; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage loyalty" ON public.loyalty_accounts TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: loyalty_programs Admins manage programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage programs" ON public.loyalty_programs TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: promotions Admins manage promotions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage promotions" ON public.promotions TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reservations Admins manage reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage reservations" ON public.reservations TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage roles" ON public.user_roles TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: admin_presence Main admin can view all presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Main admin can view all presence" ON public.admin_presence FOR SELECT TO authenticated USING (private.is_main_admin(auth.uid()));


--
-- Name: delivery_zones Main admin full access zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Main admin full access zones" ON public.delivery_zones TO authenticated USING (private.is_main_admin(auth.uid())) WITH CHECK (private.is_main_admin(auth.uid()));


--
-- Name: banners Public can view active banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active banners" ON public.banners FOR SELECT TO authenticated, anon USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: discounts Public can view active discounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active discounts" ON public.discounts FOR SELECT TO authenticated, anon USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: featured_items Public can view active featured; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active featured" ON public.featured_items FOR SELECT TO authenticated, anon USING ((is_active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: products Public can view active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active products" ON public.products FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: loyalty_programs Public can view active programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active programs" ON public.loyalty_programs FOR SELECT TO authenticated, anon USING (is_active);


--
-- Name: delivery_zones Public can view active zones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active zones" ON public.delivery_zones FOR SELECT TO authenticated, anon USING (is_active);


--
-- Name: product_sizes Public can view available sizes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view available sizes" ON public.product_sizes FOR SELECT TO authenticated, anon USING (((is_available = true) AND (EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.slug = product_sizes.product_slug) AND (p.is_active = true))))));


--
-- Name: categories Public can view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view categories" ON public.categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: store_hours Public can view hours; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view hours" ON public.store_hours FOR SELECT TO authenticated, anon USING (true);


--
-- Name: admin_presence Users can update own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own presence" ON public.admin_presence FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: admin_presence Users can upsert own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can upsert own presence" ON public.admin_presence FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: admin_presence Users can view own presence; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own presence" ON public.admin_presence FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: reservations Users cancel own pending reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users cancel own pending reservations" ON public.reservations FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text])))) WITH CHECK ((auth.uid() = user_id));


--
-- Name: reservations Users create own reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users create own reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: user_roles Users read own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: loyalty_accounts Users view own loyalty; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles Users view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: reservations Users view own reservations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users view own reservations" ON public.reservations FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: delivery_zones Zone admin reads own zone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone admin reads own zone" ON public.delivery_zones FOR SELECT TO authenticated USING ((id = private.get_user_zone(auth.uid())));


--
-- Name: inventory_movements Zone admin reads zone inventory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone admin reads zone inventory" ON public.inventory_movements FOR SELECT TO authenticated USING (((order_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = inventory_movements.order_id) AND (o.delivery_zone_id = private.get_user_zone(auth.uid())))))));


--
-- Name: order_items Zone admin reads zone order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone admin reads zone order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.delivery_zone_id IS NOT NULL) AND (o.delivery_zone_id = private.get_user_zone(auth.uid()))))));


--
-- Name: orders Zone admin reads zone orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone admin reads zone orders" ON public.orders FOR SELECT TO authenticated USING (((delivery_zone_id IS NOT NULL) AND (delivery_zone_id = private.get_user_zone(auth.uid()))));


--
-- Name: delivery_zones Zone admin updates own zone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone admin updates own zone" ON public.delivery_zones FOR UPDATE TO authenticated USING ((id = private.get_user_zone(auth.uid()))) WITH CHECK ((id = private.get_user_zone(auth.uid())));


--
-- Name: orders Zone admin updates zone orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Zone admin updates zone orders" ON public.orders FOR UPDATE TO authenticated USING (((delivery_zone_id IS NOT NULL) AND (delivery_zone_id = private.get_user_zone(auth.uid())))) WITH CHECK (((delivery_zone_id IS NOT NULL) AND (delivery_zone_id = private.get_user_zone(auth.uid()))));


--
-- Name: user_addresses addresses owner delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "addresses owner delete" ON public.user_addresses FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_addresses addresses owner insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "addresses owner insert" ON public.user_addresses FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_addresses addresses owner select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "addresses owner select" ON public.user_addresses FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: user_addresses addresses owner update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "addresses owner update" ON public.user_addresses FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: admin_presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit admin insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs audit admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_logs audit zone admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "audit zone admin read" ON public.audit_logs FOR SELECT TO authenticated USING ((private.is_zone_admin(auth.uid()) AND ((metadata ->> 'zone_id'::text) = (private.get_user_zone(auth.uid()))::text)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: home_banners banners admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banners admin read" ON public.home_banners FOR SELECT USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_banners banners admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banners admin write" ON public.home_banners USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id)))) WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_banners banners public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "banners public read active" ON public.home_banners FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories admin write" ON public.categories TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories categories public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);


--
-- Name: content_pages content admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "content admin write" ON public.content_pages TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: content_pages content public read published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "content public read published" ON public.content_pages FOR SELECT USING (((status = 'published'::text) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: content_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: home_hot_deals deals admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deals admin read" ON public.home_hot_deals FOR SELECT USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_hot_deals deals admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deals admin write" ON public.home_hot_deals USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id)))) WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_hot_deals deals public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "deals public read active" ON public.home_hot_deals FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: delivery_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: home_desserts desserts admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "desserts admin read" ON public.home_desserts FOR SELECT USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_desserts desserts admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "desserts admin write" ON public.home_desserts USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id)))) WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_desserts desserts public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "desserts public read active" ON public.home_desserts FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: discounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

--
-- Name: home_content_events events admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "events admin read" ON public.home_content_events FOR SELECT USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_content_events events public insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "events public insert" ON public.home_content_events FOR INSERT TO authenticated, anon WITH CHECK (((event_type = ANY (ARRAY['view'::text, 'click'::text])) AND (content_type = ANY (ARRAY['popular'::text, 'hot_deal'::text, 'special'::text, 'banner'::text, 'featured'::text]))));


--
-- Name: featured_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.featured_items ENABLE ROW LEVEL SECURITY;

--
-- Name: home_banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

--
-- Name: home_content_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_content_events ENABLE ROW LEVEL SECURITY;

--
-- Name: home_desserts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_desserts ENABLE ROW LEVEL SECURITY;

--
-- Name: home_hot_deals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_hot_deals ENABLE ROW LEVEL SECURITY;

--
-- Name: home_popular_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_popular_items ENABLE ROW LEVEL SECURITY;

--
-- Name: home_section_visibility; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_section_visibility ENABLE ROW LEVEL SECURITY;

--
-- Name: home_specials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_specials ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: integrations integrations admin all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "integrations admin all" ON public.integrations TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements inventory_movements admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inventory_movements admin insert" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inventory_movements inventory_movements admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "inventory_movements admin read" ON public.inventory_movements FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: loyalty_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications admin delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications admin delete" ON public.notifications FOR DELETE TO authenticated USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR (auth.uid() = user_id)));


--
-- Name: notifications notifications admin insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications admin insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notifications notifications own read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications own read" ON public.notifications FOR SELECT USING (((auth.uid() = user_id) OR ((user_id IS NULL) AND private.has_role(auth.uid(), 'admin'::public.app_role)) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: notifications notifications own update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items admin delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items admin delete" ON public.order_items FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items order_items admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items admin update" ON public.order_items FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items order_items read via order; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items read via order" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders admin delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders orders admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders admin update" ON public.orders FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders orders user read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders user read own" ON public.orders FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: pizza_toppings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pizza_toppings ENABLE ROW LEVEL SECURITY;

--
-- Name: pizza_toppings pizza_toppings admin manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pizza_toppings admin manage" ON public.pizza_toppings TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pizza_toppings pizza_toppings anon read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pizza_toppings anon read active" ON public.pizza_toppings FOR SELECT TO anon USING ((is_active = true));


--
-- Name: pizza_toppings pizza_toppings auth read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pizza_toppings auth read" ON public.pizza_toppings FOR SELECT TO authenticated USING (((is_active = true) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: home_popular_items popular admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "popular admin read" ON public.home_popular_items FOR SELECT USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_popular_items popular admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "popular admin write" ON public.home_popular_items USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id)))) WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_popular_items popular public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "popular public read active" ON public.home_popular_items FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: product_sizes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "products admin write" ON public.products TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products products public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "products public read active" ON public.products FOR SELECT USING ((is_active OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: reservations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews admin delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews admin delete" ON public.reviews FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reviews reviews admin manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews admin manage" ON public.reviews TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: reviews reviews public read approved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews public read approved" ON public.reviews FOR SELECT TO authenticated, anon USING (((status = 'approved'::public.review_status) OR (auth.uid() = user_id) OR private.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: reviews reviews user insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "reviews user insert own" ON public.reviews FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: role_permissions role_permissions admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "role_permissions admin read" ON public.role_permissions FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: role_permissions role_permissions admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "role_permissions admin write" ON public.role_permissions TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: system_settings settings admin all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "settings admin all" ON public.system_settings TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: home_specials specials admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "specials admin read" ON public.home_specials FOR SELECT USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_specials specials admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "specials admin write" ON public.home_specials USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id)))) WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_specials specials public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "specials public read active" ON public.home_specials FOR SELECT TO authenticated, anon USING (((is_active = true) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));


--
-- Name: store_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: home_section_visibility visibility admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "visibility admin write" ON public.home_section_visibility USING ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id)))) WITH CHECK ((private.has_role(auth.uid(), 'admin'::public.app_role) OR ((zone_id IS NOT NULL) AND private.can_access_zone(auth.uid(), zone_id))));


--
-- Name: home_section_visibility visibility public read global; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "visibility public read global" ON public.home_section_visibility FOR SELECT TO authenticated, anon USING ((zone_id IS NULL));


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


