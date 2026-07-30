-- public.admin_presence
INSERT INTO public."admin_presence" ("user_id", "status", "assigned_zone_id", "user_agent", "login_at", "last_active_at", "last_heartbeat_at", "updated_at") VALUES ('9841c4b9-0499-42b0-88e1-c0ba653eab52', 'offline', NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36', '2026-07-26 14:43:42.218+00', '2026-07-26 14:43:44.729+00', '2026-07-26 14:43:48.554+00', '2026-07-26 14:43:48.677455+00');

-- public.reviews
INSERT INTO public."reviews" ("id", "user_id", "product_slug", "author_name", "rating", "comment", "status", "created_at", "updated_at") VALUES ('4ce67d6d-3382-4837-8927-eb9b43e146f1', '9841c4b9-0499-42b0-88e1-c0ba653eab52', 'cheese-avalanche', 'Aluwani M.', 5, 'Cheesiest pizza I''ve had in Joburg. 10/10.', 'approved', '2026-06-08 23:07:53.87796+00', '2026-06-08 23:07:53.87796+00');
INSERT INTO public."reviews" ("id", "user_id", "product_slug", "author_name", "rating", "comment", "status", "created_at", "updated_at") VALUES ('4fbf0b30-fe1b-40c2-a2f2-3436e8be9d15', '9841c4b9-0499-42b0-88e1-c0ba653eab52', 'margarita-muse', 'Sipho D.', 4, 'Classic done right. Crust was perfect.', 'approved', '2026-06-08 23:07:53.87796+00', '2026-06-08 23:07:53.87796+00');
INSERT INTO public."reviews" ("id", "user_id", "product_slug", "author_name", "rating", "comment", "status", "created_at", "updated_at") VALUES ('d25f469d-ae29-40bb-87e5-5b69230c439e', '9841c4b9-0499-42b0-88e1-c0ba653eab52', 'alfredo-bliss', 'Naledi P.', 5, 'Creamy, comforting, came hot.', 'pending', '2026-06-08 23:07:53.87796+00', '2026-06-08 23:07:53.87796+00');

-- public.role_permissions
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('0b90e77a-9e9e-4dff-920d-b8f232f7d815', 'admin', 'integrations.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('0bb97978-1194-404c-b573-549cad6c2219', 'admin', 'users.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('14b93302-c4c9-4cbe-beb9-c251f89c6afa', 'admin', 'security.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('16579c65-c9f9-49da-bde7-83c4a7e8dd24', 'admin', 'reports.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('191d7772-485d-45d3-b35a-b3a7ad0f5338', 'admin', 'users.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('2132964f-420c-4bbf-8066-b5d57e203427', 'admin', 'inventory.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('2492e41d-4b78-4355-b9db-c00c257cf453', 'admin', 'audit.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('36c888ea-d55d-46fb-a86e-9f99f3d6c3c6', 'admin', 'categories.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('44ddde2e-8cbb-44ae-800f-f96176b7c56d', 'admin', 'roles.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('4a7e8219-9060-408c-81f7-9830c80dfc5f', 'admin', 'categories.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('5450fce5-807b-4324-a910-658c3742fe29', 'admin', 'notifications.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('59ece338-7f4b-429c-98d2-37bf378d55f1', 'admin', 'products.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('7442d4b7-5081-4e5b-8216-718ff9636471', 'admin', 'orders.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('78a15a2d-fe5a-4449-851e-7a29dfb87397', 'admin', 'reviews.moderate', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('7ad312a9-c746-4b4c-be29-71dc191be19b', 'admin', 'settings.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('8327f5ea-7bbf-4b36-97a4-b2e1a50cdfbb', 'admin', 'notifications.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('8e459346-820e-4db9-b3c3-c350614e4d0e', 'admin', 'content.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('9b7e8b5e-b75b-43a8-a8a5-ca5d44c1145d', 'admin', 'analytics.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('9da491dd-71f4-4e1c-b82d-ebdb32e7cd28', 'admin', 'orders.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('a62357de-5875-4337-94de-1e55a4f90079', 'admin', 'integrations.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('b5983ff5-96a8-4dc7-af84-432bc3811aa0', 'admin', 'settings.write', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('bd3a0a5e-cf28-42fe-ab72-641b54cf8026', 'admin', 'orders.refund', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('cd25aea2-ba3f-4a96-966e-11f640b7554b', 'admin', 'inventory.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('cf3dcf0f-7561-40ba-adeb-e30bca837a90', 'admin', 'security.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('f919ce37-6230-44f8-95fb-88cadc836a18', 'admin', 'content.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('fb492a4c-b91d-46fb-b755-3e4d0f4db059', 'admin', 'reviews.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('fcad39e3-23c4-48f1-8aae-2090161e1190', 'admin', 'products.read', '2026-06-15 20:57:03.630489+00');
INSERT INTO public."role_permissions" ("id", "role", "permission", "created_at") VALUES ('fcbb9b6f-41af-4dac-819c-669c27b95410', 'admin', 'roles.write', '2026-06-15 20:57:03.630489+00');

-- public.store_hours
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (0, '11:00:00', '22:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (1, '11:00:00', '22:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (2, '11:00:00', '22:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (3, '11:00:00', '22:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (4, '11:00:00', '22:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (5, '11:00:00', '23:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');
INSERT INTO public."store_hours" ("day_of_week", "opens_at", "closes_at", "is_closed", "note", "updated_at") VALUES (6, '11:00:00', '23:00:00', false, NULL, '2026-06-15 22:30:45.73373+00');

-- public.system_settings
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('branding', 'site_name', '"Saucy Lemon"', 'Site display name', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('branding', 'support_email', '"help@example.com"', 'Public support email', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('email', 'from_address', '"orders@example.com"', 'Default from-address for transactional email', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('email', 'from_name', '"Saucy Lemon"', 'Default sender name', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('security', 'password_min_length', '8', 'Minimum password length', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('security', 'session_idle_minutes', '60', 'Idle minutes before re-auth required', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('store', 'currency', '"ZAR"', 'Store currency code', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('store', 'low_stock_threshold', '5', 'Default low-stock threshold for new products', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
INSERT INTO public."system_settings" ("group_key", "key", "value", "description", "updated_by", "created_at", "updated_at") VALUES ('store', 'order_prefix', '"SL"', 'Order number prefix', NULL, '2026-06-15 21:23:44.715477+00', '2026-06-15 21:23:44.715477+00');
