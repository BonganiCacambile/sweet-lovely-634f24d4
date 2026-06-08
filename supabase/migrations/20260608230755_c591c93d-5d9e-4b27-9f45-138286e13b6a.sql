
-- =========================
-- Sweet & Lovely: core schema
-- =========================

-- Enums
CREATE TYPE public.order_status AS ENUM ('pending','preparing','out_for_delivery','delivered','cancelled');
CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected');

-- ---------- Categories ----------
CREATE TABLE public.categories (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  image       TEXT,
  intro       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Products ----------
CREATE TABLE public.products (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  price_zar    NUMERIC(10,2) NOT NULL DEFAULT 0,
  category_slug TEXT NOT NULL REFERENCES public.categories(slug) ON DELETE RESTRICT,
  image        TEXT,
  allergens    TEXT,
  nutrition    TEXT,
  portion      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read active" ON public.products FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_products_category ON public.products(category_slug);

-- ---------- Orders ----------
CREATE SEQUENCE public.order_number_seq START 10293;
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT NOT NULL UNIQUE DEFAULT ('SL-' || nextval('public.order_number_seq')),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status          public.order_status NOT NULL DEFAULT 'pending',
  customer_name   TEXT NOT NULL,
  customer_email  TEXT,
  customer_phone  TEXT,
  address         TEXT,
  notes           TEXT,
  subtotal_zar    NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_zar    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_zar       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders user read own" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orders user insert own" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orders admin update" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "orders admin delete" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(status);

-- ---------- Order items ----------
CREATE TABLE public.order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_slug    TEXT REFERENCES public.products(slug) ON DELETE SET NULL,
  title_snapshot  TEXT NOT NULL,
  quantity        INT NOT NULL CHECK (quantity > 0),
  unit_price_zar  NUMERIC(10,2) NOT NULL,
  line_total_zar  NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items read via order" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "order_items write via order" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "order_items admin update" ON public.order_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "order_items admin delete" ON public.order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- ---------- Reviews ----------
CREATE TABLE public.reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_slug TEXT REFERENCES public.products(slug) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  status       public.review_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read approved" ON public.reviews FOR SELECT
  USING (status = 'approved' OR auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reviews user insert own" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews admin manage" ON public.reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "reviews admin delete" ON public.reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Notifications ----------
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own read" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications admin insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE POLICY "notifications admin delete" ON public.notifications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read, created_at DESC);

-- ---------- Audit logs ----------
CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit admin insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

-- =========================
-- Seed: promote existing user to admin
-- =========================
INSERT INTO public.user_roles (user_id, role)
VALUES ('9841c4b9-0499-42b0-88e1-c0ba653eab52','admin')
ON CONFLICT DO NOTHING;

-- =========================
-- Seed: categories
-- =========================
INSERT INTO public.categories (slug,label,image,intro,sort_order) VALUES
('pizza','Pizza','https://framerusercontent.com/images/O35ad4eRtufs0gpp6JZXayT5IM.png?scale-down-to=512','From classic Margherita to truffle indulgence — hand-tossed, fresh, golden.',1),
('pasta','Pasta','https://framerusercontent.com/images/xd9Oo3dlguei8tJ9fP0wq4BtTtE.png','Slow-simmered sauces, al dente noodles, bright fresh ingredients.',2),
('sides','Sides','https://framerusercontent.com/images/8LagT2GMawnySp6zGEeZrsG4JJU.png','Crispy, cheesy, dippable — the perfect supporting cast.',3),
('deserts','Deserts','https://framerusercontent.com/images/8G7eGuuOmijUEO3VXSdPJ9i4VU.png','Warm, indulgent desserts made fresh in-house every day.',4),
('drinks','Drinks','https://framerusercontent.com/images/eQS6ke7KFxu839Roxv77gisTY0Y.png','Sodas, juices, smoothies and coffee — perk up or treat yourself.',5);

-- =========================
-- Seed: products (subset from current menu mocks)
-- =========================
INSERT INTO public.products (slug,title,description,price_zar,category_slug,image,allergens,nutrition,portion,sort_order) VALUES
('cheese-avalanche','Cheese Avalanche','Mozzarella, cheddar, Parmesan, gouda, ricotta, marinara, oregano',80,'pizza','https://framerusercontent.com/images/Q4djsExkm2dVJLND8pnRkbmHKy8.png','Dairy, Gluten','Calories: 340 · Fat: 18g · Carbs: 29g · Protein: 16g','from',1),
('buffalo-bliss','Buffalo Bliss','Buffalo chicken, blue cheese, mozzarella, ranch, red onions',80,'pizza','https://framerusercontent.com/images/fOcW4cqVIKe7O6jovEeqZ46Cg.png','Dairy, Gluten, Eggs','Calories: 310 · Fat: 15g · Carbs: 28g · Protein: 14g','from',2),
('mediterranean-marvel','Mediterranean Marvel','Feta, olives, red onions, sun-dried tomato, spinach, mozzarella',80,'pizza','https://framerusercontent.com/images/vtNegrYfppnZJV5SpQd607Hls8.png','Dairy, Gluten','Calories: 260 · Fat: 12g · Carbs: 27g · Protein: 11g','from',3),
('meat-lovers','Meat Lover''s Feast','Pepperoni, sausage, bacon, ham, mozzarella, marinara',80,'pizza','https://framerusercontent.com/images/ilD3FzfskejkXM7jRyVgKSBEE5I.png','Dairy, Gluten','Calories: 350 · Fat: 19g · Carbs: 29g · Protein: 18g','from',4),
('margarita-muse','Margarita Muse','Fresh mozzarella, ripe tomatoes, basil, EVOO, sea salt',80,'pizza','https://framerusercontent.com/images/O35ad4eRtufs0gpp6JZXayT5IM.png','Dairy, Gluten','Calories: 220 · Fat: 10g · Carbs: 26g · Protein: 9g','from',5),
('spaghetti-bolognese','Spaghetti Bolognese Classic','Spaghetti, ground beef, marinara, Parmesan',139.90,'pasta','https://framerusercontent.com/images/5hnOM2Oj39MAVQMF4xIQDQBBvA.png','Gluten, Dairy','Calories: 690 · Fat: 22g · Carbs: 85g · Protein: 32g',NULL,1),
('alfredo-bliss','Creamy Alfredo Bliss','Fettuccine, butter, cream, Parmesan, parsley',129.90,'pasta','https://framerusercontent.com/images/7WJgsBXCnl7ov0Uhe1ZthASTgQc.png','Dairy, Gluten, Eggs','Calories: 780 · Fat: 48g · Carbs: 72g · Protein: 18g',NULL,2),
('pesto-penne','Pesto Penne Delight','Penne, basil pesto, cherry tomatoes, Parmesan',124.90,'pasta','https://framerusercontent.com/images/2c91DIhm8wc9cAbmFFUBzc7ZAg.png','Dairy, Gluten, Nuts','Calories: 620 · Fat: 32g · Carbs: 65g · Protein: 18g',NULL,3),
('buffalo-wings','Buffalo Wings','Chicken wings, buffalo sauce, celery, blue cheese dip',89.90,'sides','https://framerusercontent.com/images/5HkrLakvJ1QS8k9yeljgtboX9A.png','Dairy','Calories: 430 · Fat: 31g · Carbs: 6g · Protein: 32g','/6 wings',1),
('mozzarella-sticks','Mozzarella Sticks','Breaded mozzarella, marinara',79.90,'sides','https://framerusercontent.com/images/B0jk06Tv3FYjGVJFSdifH3Zt2w.png','Dairy, Gluten, Eggs','Calories: 450 · Fat: 25g · Carbs: 39g · Protein: 18g','/6 sticks',2),
('caesar-salad','Classic Caesar Salad','Romaine, Parmesan, croutons, Caesar dressing',64.90,'sides','https://framerusercontent.com/images/8LagT2GMawnySp6zGEeZrsG4JJU.png','Dairy, Gluten, Eggs','Calories: 310 · Fat: 24g · Carbs: 17g · Protein: 8g',NULL,3),
('potato-wedges','Loaded Potato Wedges','Crispy wedges, cheddar, bacon, sour cream, chives',69.90,'sides','https://framerusercontent.com/images/jiKYTXVS1dGzHHn9InYt6POHbT4.png','Dairy, Gluten','Calories: 520 · Fat: 28g · Carbs: 52g · Protein: 12g',NULL,4);

-- =========================
-- Seed: sample orders + items for the admin user
-- =========================
WITH new_orders AS (
  INSERT INTO public.orders (user_id, status, customer_name, customer_email, customer_phone, address, subtotal_zar, delivery_zar, total_zar, created_at)
  VALUES
    ('9841c4b9-0499-42b0-88e1-c0ba653eab52','delivered','Aluwani M.','aluwani@example.com','+27 71 000 0001','12 Vilakazi St, Soweto', 384, 0, 384, now() - interval '2 minutes'),
    ('9841c4b9-0499-42b0-88e1-c0ba653eab52','out_for_delivery','Themba K.','themba@example.com','+27 82 111 2222','5 Long St, Cape Town', 219, 25, 244, now() - interval '11 minutes'),
    ('9841c4b9-0499-42b0-88e1-c0ba653eab52','preparing','Naledi P.','naledi@example.com','+27 73 333 4444','77 Jan Smuts Ave, Joburg', 612, 0, 612, now() - interval '24 minutes'),
    ('9841c4b9-0499-42b0-88e1-c0ba653eab52','delivered','Sipho D.','sipho@example.com','+27 60 555 6666','9 Marine Dr, Durban', 158, 0, 158, now() - interval '1 hour'),
    ('9841c4b9-0499-42b0-88e1-c0ba653eab52','cancelled','Lerato N.','lerato@example.com','+27 74 777 8888','21 Rivonia Rd, Sandton', 472, 0, 472, now() - interval '2 hours'),
    ('9841c4b9-0499-42b0-88e1-c0ba653eab52','delivered','Kabelo R.','kabelo@example.com','+27 83 999 0000','3 Church St, Pretoria', 295, 0, 295, now() - interval '3 hours')
  RETURNING id, order_number
)
INSERT INTO public.order_items (order_id, product_slug, title_snapshot, quantity, unit_price_zar, line_total_zar)
SELECT id, 'cheese-avalanche', 'Cheese Avalanche', 2, 80, 160 FROM new_orders WHERE order_number IN (SELECT order_number FROM new_orders LIMIT 1);

-- Seed simple items for every order so dashboards have content
INSERT INTO public.order_items (order_id, product_slug, title_snapshot, quantity, unit_price_zar, line_total_zar)
SELECT o.id, 'margarita-muse','Margarita Muse', 1, 80, 80 FROM public.orders o WHERE o.customer_email IN ('themba@example.com','sipho@example.com','kabelo@example.com');

INSERT INTO public.order_items (order_id, product_slug, title_snapshot, quantity, unit_price_zar, line_total_zar)
SELECT o.id, 'spaghetti-bolognese','Spaghetti Bolognese Classic', 2, 139.90, 279.80 FROM public.orders o WHERE o.customer_email IN ('naledi@example.com','lerato@example.com');

-- =========================
-- Seed: reviews
-- =========================
INSERT INTO public.reviews (user_id, product_slug, author_name, rating, comment, status) VALUES
('9841c4b9-0499-42b0-88e1-c0ba653eab52','cheese-avalanche','Aluwani M.',5,'Cheesiest pizza I''ve had in Joburg. 10/10.','approved'),
('9841c4b9-0499-42b0-88e1-c0ba653eab52','margarita-muse','Sipho D.',4,'Classic done right. Crust was perfect.','approved'),
('9841c4b9-0499-42b0-88e1-c0ba653eab52','alfredo-bliss','Naledi P.',5,'Creamy, comforting, came hot.','pending');

-- =========================
-- Seed: notifications for admin user
-- =========================
INSERT INTO public.notifications (user_id, title, body, category) VALUES
('9841c4b9-0499-42b0-88e1-c0ba653eab52','New order received','Order SL-10293 from Aluwani M. — R384','orders'),
('9841c4b9-0499-42b0-88e1-c0ba653eab52','Review pending','Naledi P. left a 5★ review awaiting approval.','reviews'),
('9841c4b9-0499-42b0-88e1-c0ba653eab52','Welcome to Sweet & Lovely','Your admin dashboard is ready. Explore KPIs, orders, and more.','system');

-- =========================
-- Seed: audit log
-- =========================
INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, metadata) VALUES
('9841c4b9-0499-42b0-88e1-c0ba653eab52','b.cacambile1@gmail.com','role.granted','user_roles','{"role":"admin"}'::jsonb),
('9841c4b9-0499-42b0-88e1-c0ba653eab52','b.cacambile1@gmail.com','catalog.seeded','products','{"count":12}'::jsonb);
