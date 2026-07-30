
-- Roles enum
create type public.app_role as enum ('admin', 'user');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- has_role helper
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Profile policies
create policy "Users view own profile" on public.profiles
  for select to authenticated using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Role policies
create policy "Users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default user role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user')
    on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

alter function public.set_updated_at() set search_path = public;

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

ALTER POLICY "Admins manage roles" ON public.user_roles
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "Users read own roles" ON public.user_roles
  USING ((user_id = auth.uid()) OR private.has_role('admin'::public.app_role));

ALTER POLICY "Users view own profile" ON public.profiles
  USING ((auth.uid() = id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "audit admin insert" ON public.audit_logs
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "audit admin read" ON public.audit_logs
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "categories admin write" ON public.categories
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "notifications admin delete" ON public.notifications
  USING (private.has_role('admin'::public.app_role) OR (auth.uid() = user_id));

ALTER POLICY "notifications admin insert" ON public.notifications
  WITH CHECK (private.has_role('admin'::public.app_role) OR (auth.uid() = user_id));

ALTER POLICY "notifications own read" ON public.notifications
  USING ((auth.uid() = user_id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "order_items admin delete" ON public.order_items
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "order_items admin update" ON public.order_items
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "order_items read via order" ON public.order_items
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND ((o.user_id = auth.uid()) OR private.has_role('admin'::public.app_role))
  ));

ALTER POLICY "order_items write via order" ON public.order_items
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND ((o.user_id = auth.uid()) OR private.has_role('admin'::public.app_role))
  ));

ALTER POLICY "orders admin delete" ON public.orders
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "orders admin update" ON public.orders
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "orders user insert own" ON public.orders
  WITH CHECK ((auth.uid() = user_id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "orders user read own" ON public.orders
  USING ((auth.uid() = user_id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "products admin write" ON public.products
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "products public read active" ON public.products
  USING (is_active OR private.has_role('admin'::public.app_role));

ALTER POLICY "reviews admin delete" ON public.reviews
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "reviews admin manage" ON public.reviews
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "reviews public read approved" ON public.reviews
  USING ((status = 'approved'::public.review_status) OR (auth.uid() = user_id) OR private.has_role('admin'::public.app_role));ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paystack_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_paystack_reference_key ON public.orders(paystack_reference) WHERE paystack_reference IS NOT NULL;
-- 1) Products inventory columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- 2) Extend order_status enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'order_status'::regtype AND enumlabel = 'processing') THEN
    ALTER TYPE order_status ADD VALUE 'processing';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'order_status'::regtype AND enumlabel = 'completed') THEN
    ALTER TYPE order_status ADD VALUE 'completed';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'order_status'::regtype AND enumlabel = 'refunded') THEN
    ALTER TYPE order_status ADD VALUE 'refunded';
  END IF;
END $$;

-- 3) inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL REFERENCES public.products(slug) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('restock','sale','adjustment','return')),
  quantity integer NOT NULL,
  balance_after integer NOT NULL,
  reason text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON public.inventory_movements(created_at DESC);

GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements admin read" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin read" ON public.inventory_movements
  FOR SELECT TO authenticated USING (private.has_role('admin'::app_role));
DROP POLICY IF EXISTS "inventory_movements admin insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin insert" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (private.has_role('admin'::app_role));

-- 4) log_audit_event helper
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, entity_id, metadata)
  VALUES (auth.uid(), v_email, _action, _entity, _entity_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

-- 5) adjust_product_stock RPC (admin only)
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  _slug text,
  _delta integer,
  _type text,
  _reason text DEFAULT NULL,
  _order_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
AS $$
DECLARE
  v_new_balance integer;
  v_email text;
BEGIN
  IF NOT private.has_role('admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF _type NOT IN ('restock','sale','adjustment','return') THEN
    RAISE EXCEPTION 'Invalid movement type: %', _type;
  END IF;

  UPDATE public.products
     SET stock = GREATEST(0, stock + _delta), updated_at = now()
   WHERE slug = _slug
   RETURNING stock INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', _slug;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.inventory_movements
    (product_slug, type, quantity, balance_after, reason, actor_id, actor_email, order_id)
  VALUES
    (_slug, _type, _delta, v_new_balance, _reason, auth.uid(), v_email, _order_id);

  RETURN v_new_balance;
END $$;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) TO authenticated;

-- 6) Permissions system
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'orders.read','orders.write','orders.refund',
    'products.read','products.write',
    'categories.read','categories.write',
    'inventory.read','inventory.write',
    'reviews.read','reviews.moderate',
    'users.read','users.write',
    'roles.read','roles.write',
    'audit.read',
    'content.read','content.write',
    'notifications.read','notifications.write',
    'reports.read',
    'analytics.read',
    'integrations.read','integrations.write',
    'security.read','security.write',
    'settings.read','settings.write'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions read" ON public.role_permissions;
CREATE POLICY "role_permissions read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_permissions admin write" ON public.role_permissions;
CREATE POLICY "role_permissions admin write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role))
  WITH CHECK (private.has_role('admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) TO authenticated;

-- Seed: admin role gets every permission
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::app_role, p::app_permission
FROM unnest(enum_range(NULL::public.app_permission)) AS p
ON CONFLICT DO NOTHING;

-- 7) Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_movements REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;

CREATE TABLE public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  seo_title text,
  seo_description text,
  publish_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_pages_status_chk CHECK (status IN ('draft','published','archived'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_pages TO authenticated;
GRANT ALL ON public.content_pages TO service_role;
GRANT SELECT ON public.content_pages TO anon;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content public read published" ON public.content_pages FOR SELECT
  USING (status = 'published' OR private.has_role('admin'::app_role));
CREATE POLICY "content admin write" ON public.content_pages FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role)) WITH CHECK (private.has_role('admin'::app_role));
CREATE TRIGGER trg_content_pages_updated BEFORE UPDATE ON public.content_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_status_chk CHECK (status IN ('connected','disconnected','error','pending'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations admin all" ON public.integrations FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role)) WITH CHECK (private.has_role('admin'::app_role));
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.system_settings (
  group_key text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_key, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings admin all" ON public.system_settings FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role)) WITH CHECK (private.has_role('admin'::app_role));
CREATE TRIGGER trg_system_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.integrations (provider, display_name, category, status) VALUES
  ('paystack','Paystack','payments','disconnected'),
  ('resend','Resend','email','disconnected'),
  ('twilio','Twilio','sms','disconnected'),
  ('google_analytics','Google Analytics','analytics','disconnected'),
  ('slack','Slack','notifications','disconnected')
ON CONFLICT (provider) DO NOTHING;

INSERT INTO public.system_settings (group_key, key, value, description) VALUES
  ('store','currency','"ZAR"','Store currency code'),
  ('store','low_stock_threshold','5','Default low-stock threshold for new products'),
  ('store','order_prefix','"SL"','Order number prefix'),
  ('email','from_address','"orders@example.com"','Default from-address for transactional email'),
  ('email','from_name','"Saucy Lemon"','Default sender name'),
  ('security','password_min_length','8','Minimum password length'),
  ('security','session_idle_minutes','60','Idle minutes before re-auth required'),
  ('branding','site_name','"Saucy Lemon"','Site display name'),
  ('branding','support_email','"help@example.com"','Public support email')
ON CONFLICT DO NOTHING;
INSERT INTO public.products (slug, title, description, price_zar, category_slug, image, allergens, nutrition, portion, is_active, sort_order, stock, low_stock_threshold) VALUES
('cheese-avalanche', 'Cheese Avalanche', 'Mozzarella, cheddar, Parmesan, gouda, ricotta, marinara sauce, oregano', 80, 'pizza', 'https://framerusercontent.com/images/Q4djsExkm2dVJLND8pnRkbmHKy8.png', 'Dairy, Gluten', 'Calories: 340 · Fat: 18g · Carbs: 29g · Protein: 16g', 'from', true, 0, 50, 10),
('buffalo-bliss', 'Buffalo Bliss', 'Buffalo chicken, blue cheese crumbles, mozzarella, ranch dressing, red onions', 80, 'pizza', 'https://framerusercontent.com/images/fOcW4cqVIKe7O6jovEeqZ46Cg.png', 'Dairy, Gluten, Eggs', 'Calories: 310 · Fat: 15g · Carbs: 28g · Protein: 14g', 'from', true, 10, 50, 10),
('mediterranean-marvel', 'Mediterranean Marvel', 'Feta, Kalamata olives, red onions, sun-dried tomatoes, spinach, mozzarella, olive oil, oregano', 80, 'pizza', 'https://framerusercontent.com/images/vtNegrYfppnZJV5SpQd607Hls8.png', 'Dairy, Gluten', 'Calories: 260 · Fat: 12g · Carbs: 27g · Protein: 11g', 'from', true, 20, 50, 10),
('hawaiian-heatwave', 'Hawaiian Heatwave', 'Grilled pineapple, Canadian bacon, mozzarella, marinara sauce, jalapeños', 80, 'pizza', 'https://framerusercontent.com/images/z0tpcmuGY42myUTNyLF9LCXg.png', 'Dairy, Gluten', 'Calories: 270 · Fat: 11g · Carbs: 30g · Protein: 12g', 'from', true, 30, 50, 10),
('meat-lovers', 'Meat Lover''s Feast', 'Pepperoni, Italian sausage, bacon, ham, mozzarella, marinara sauce', 80, 'pizza', 'https://framerusercontent.com/images/ilD3FzfskejkXM7jRyVgKSBEE5I.png', 'Dairy, Gluten', 'Calories: 350 · Fat: 19g · Carbs: 29g · Protein: 18g', 'from', true, 40, 50, 10),
('garden-delight', 'Garden Delight', 'Zucchini, bell peppers, cherry tomatoes, spinach, red onions, mozzarella, pesto sauce', 80, 'pizza', 'https://framerusercontent.com/images/Jo0m3edxzWNVUCgzB4ukskOgTHw.png', 'Dairy, Gluten, Nuts', 'Calories: 240 · Fat: 11g · Carbs: 27g · Protein: 10g', 'from', true, 50, 50, 10),
('pepperoni-popper', 'Pepperoni Popper', 'Double pepperoni, mozzarella, spicy marinara sauce, crushed red pepper, black olives', 80, 'pizza', 'https://framerusercontent.com/images/bo5PFGtg1mLU0lWO3J9CWKVAcM.png', 'Dairy, Gluten', 'Calories: 320 · Fat: 17g · Carbs: 29g · Protein: 14g', 'from', true, 60, 50, 10),
('truffle-temptation', 'Truffle Temptation', 'Truffle oil, wild mushrooms, mozzarella, Parmesan, arugula, garlic cream sauce', 80, 'pizza', 'https://framerusercontent.com/images/EvzWDEqJkdunx7f5YzmUVnArM4.png', 'Dairy, Gluten', 'Calories: 300 · Fat: 15g · Carbs: 28g · Protein: 12g', 'from', true, 70, 50, 10),
('bbq-blaze', 'BBQ Blaze', 'Grilled chicken, red onions, smoky BBQ sauce, cheddar, mozzarella, cilantro', 80, 'pizza', 'https://framerusercontent.com/images/dQKnVrygQTPBTqZDioB8akNs.png', 'Dairy, Gluten', 'Calories: 290 · Fat: 12g · Carbs: 29g · Protein: 15g', 'from', true, 80, 50, 10),
('garlic-supreme', 'Garlic Supreme', 'Roasted garlic, caramelized onions, mozzarella, Parmesan, Alfredo, fresh parsley', 80, 'pizza', 'https://framerusercontent.com/images/Q2rEr3IGpX893CKsEuhm5IGMKk.png', 'Dairy, Gluten', 'Calories: 270 · Fat: 13g · Carbs: 27g · Protein: 11g', 'from', true, 90, 50, 10),
('margarita-muse', 'Margarita Muse', 'Fresh mozzarella, ripe tomatoes, basil, EVOO, sea salt, marinara sauce', 80, 'pizza', 'https://framerusercontent.com/images/O35ad4eRtufs0gpp6JZXayT5IM.png', 'Dairy, Gluten', 'Calories: 220 · Fat: 10g · Carbs: 26g · Protein: 9g', 'from', true, 100, 50, 10),
('firecracker-inferno', 'Firecracker Inferno', 'Spicy pepperoni, jalapeños, crushed red pepper, mozzarella, marinara, sriracha drizzle', 80, 'pizza', 'https://framerusercontent.com/images/lp6wNgrYu7ClOrMG4ibaVQNDWLo.png', 'Dairy, Gluten', 'Calories: 280 · Fat: 14g · Carbs: 28g · Protein: 12g', 'from', true, 110, 50, 10),
('veggie-primavera', 'Veggie Primavera', 'Spaghetti, seasonal vegetables, garlic, olive oil, Parmesan', 11.99, 'pasta', 'https://framerusercontent.com/images/QQhZmek5g8r84veBoeGYpfAtA.png', 'Gluten, Dairy', 'Calories: 600 · Fat: 22g · Carbs: 80g · Protein: 16g', NULL, true, 0, 50, 10),
('shrimp-scampi', 'Shrimp Scampi Linguine', 'Linguine, sautéed shrimp, garlic, white wine, butter, lemon juice, parsley', 15.99, 'pasta', 'https://framerusercontent.com/images/yhhROFh0XVmvTgfHG75VtLFiCU.png', 'Shellfish, Gluten, Dairy', 'Calories: 700 · Fat: 28g · Carbs: 72g · Protein: 32g', NULL, true, 10, 50, 10),
('baked-ziti', 'Cheesy Baked Ziti', 'Penne, marinara, ricotta, mozzarella, Parmesan, baked golden', 13.49, 'pasta', 'https://framerusercontent.com/images/yNtyemqpPEBb8vP6SUEqoTsd74.png', 'Dairy, Gluten', 'Calories: 850 · Fat: 40g · Carbs: 86g · Protein: 34g', NULL, true, 20, 50, 10),
('pesto-penne', 'Pesto Penne Delight', 'Penne, basil pesto, cherry tomatoes, Parmesan', 12.49, 'pasta', 'https://framerusercontent.com/images/2c91DIhm8wc9cAbmFFUBzc7ZAg.png', 'Dairy, Gluten, Nuts', 'Calories: 620 · Fat: 32g · Carbs: 65g · Protein: 18g', NULL, true, 30, 50, 10),
('spaghetti-bolognese', 'Spaghetti Bolognese Classic', 'Spaghetti, ground beef, marinara, Parmesan', 13.99, 'pasta', 'https://framerusercontent.com/images/5hnOM2Oj39MAVQMF4xIQDQBBvA.png', 'Gluten, Dairy', 'Calories: 690 · Fat: 22g · Carbs: 85g · Protein: 32g', NULL, true, 40, 50, 10),
('alfredo-bliss', 'Creamy Alfredo Bliss', 'Fettuccine, butter, cream, Parmesan, black pepper, parsley', 12.99, 'pasta', 'https://framerusercontent.com/images/7WJgsBXCnl7ov0Uhe1ZthASTgQc.png', 'Dairy, Gluten, Eggs', 'Calories: 780 · Fat: 48g · Carbs: 72g · Protein: 18g', NULL, true, 50, 50, 10),
('buffalo-wings', 'Buffalo Wings', 'Chicken wings, buffalo sauce, celery sticks, blue cheese dip', 8.99, 'sides', 'https://framerusercontent.com/images/5HkrLakvJ1QS8k9yeljgtboX9A.png', 'Dairy (blue cheese dip)', 'Calories: 430 · Fat: 31g · Carbs: 6g · Protein: 32g', '/6 wings', true, 0, 50, 10),
('caesar-salad', 'Classic Caesar Salad', 'Romaine, Parmesan, croutons, Caesar dressing', 6.49, 'sides', 'https://framerusercontent.com/images/8LagT2GMawnySp6zGEeZrsG4JJU.png', 'Dairy, Gluten, Eggs', 'Calories: 310 · Fat: 24g · Carbs: 17g · Protein: 8g', NULL, true, 10, 50, 10),
('potato-wedges', 'Loaded Potato Wedges', 'Crispy wedges, cheddar, bacon bits, sour cream, chives', 6.99, 'sides', 'https://framerusercontent.com/images/jiKYTXVS1dGzHHn9InYt6POHbT4.png', 'Dairy, Gluten', 'Calories: 520 · Fat: 28g · Carbs: 52g · Protein: 12g', NULL, true, 20, 50, 10),
('jalapeno-poppers', 'Zesty Jalapeño Poppers', 'Breaded jalapeños stuffed with cream cheese, ranch dressing', 6.99, 'sides', 'https://framerusercontent.com/images/v22l8NZfmOTbAFs0d5EbWfiMAg.png', 'Dairy, Gluten, Eggs', 'Calories: 380 · Fat: 22g · Carbs: 35g · Protein: 8g', '/6 pieces', true, 30, 50, 10),
('mozzarella-sticks', 'Mozzarella Sticks', 'Breaded mozzarella sticks, marinara sauce', 7.99, 'sides', 'https://framerusercontent.com/images/B0jk06Tv3FYjGVJFSdifH3Zt2w.png', 'Dairy, Gluten, Eggs', 'Calories: 450 · Fat: 25g · Carbs: 39g · Protein: 18g', '/6 sticks', true, 40, 50, 10),
('garlic-breadsticks', 'Garlic Parmesan Breadsticks', 'Freshly baked breadsticks, garlic butter, Parmesan, parsley', 5.99, 'sides', 'https://framerusercontent.com/images/9j2NHhkAXP2iAtcjjDAsukDeTQY.png', 'Dairy, Gluten', 'Calories: 350 · Fat: 16g · Carbs: 42g · Protein: 9g', '/6 pieces', true, 50, 50, 10),
('nutella-pizza', 'Nutella Pizza', 'Pizza dough, Nutella, powdered sugar, strawberries, whipped cream', 7.99, 'deserts', 'https://framerusercontent.com/images/pRzalLce4KvcQSggYuXBvUC174.png', 'Dairy, Gluten', 'Calories: 480 · Fat: 22g · Carbs: 62g · Protein: 7g', NULL, true, 0, 50, 10),
('apple-crumble', 'Warm Cinnamon Apple Crumble', 'Apples, cinnamon, oats, brown sugar, butter, flour, vanilla ice cream', 6.49, 'deserts', 'https://framerusercontent.com/images/QlVQ0YNHzBhb2nPfKPz2btr7A.png', 'Dairy, Gluten', 'Calories: 430 · Fat: 18g · Carbs: 64g · Protein: 5g', NULL, true, 10, 50, 10),
('cannoli', 'Classic Cannoli', 'Cannoli shells, ricotta, powdered sugar, chocolate chips, vanilla', 5.99, 'deserts', 'https://framerusercontent.com/images/Ru7hW8Qi1bQ8fHES0Gh6mmxA.png', 'Dairy, Gluten, Eggs', 'Calories: 350 · Fat: 18g · Carbs: 42g · Protein: 8g', '/2 cannoli', true, 20, 50, 10),
('strawberry-cheesecake', 'Strawberry Cheesecake Dream', 'Cream cheese, graham crust, vanilla, eggs, strawberries, glaze', 6.99, 'deserts', 'https://framerusercontent.com/images/vMak0Ur0vXKMxZVQdWSEqHQ8.png', 'Dairy, Gluten, Eggs', 'Calories: 500 · Fat: 32g · Carbs: 46g · Protein: 7g', NULL, true, 30, 50, 10),
('tiramisu', 'Tiramisu Temptation', 'Ladyfingers, mascarpone, espresso, cocoa, sugar, heavy cream', 7.49, 'deserts', 'https://framerusercontent.com/images/h1Hhi9tTURbTtNpS1UYhUefZ2o.png', 'Dairy, Gluten, Eggs', 'Calories: 420 · Fat: 27g · Carbs: 40g · Protein: 6g', NULL, true, 40, 50, 10),
('lava-cake', 'Chocolate Lava Cake', 'Dark chocolate, butter, eggs, sugar, flour, vanilla, powdered sugar', 6.99, 'deserts', 'https://framerusercontent.com/images/oBhv3dWqSzhJiOXKFp8TTQYurWE.png', 'Dairy, Gluten, Eggs', 'Calories: 450 · Fat: 28g · Carbs: 44g · Protein: 6g', NULL, true, 50, 50, 10),
('sparkling-water', 'Sparkling Water', 'Carbonated water', 2.50, 'drinks', 'https://framerusercontent.com/images/6Q81jFXnOd0aCCaxN40e6MaKAjw.png', 'None', 'Calories: 0', NULL, true, 0, 50, 10),
('cola', 'Classic Cola', 'Carbonated water, syrup, caramel color, caffeine', 2.50, 'drinks', 'https://framerusercontent.com/images/EPNDN5Z7pJqFluBKR5CiYN6BCk.png', 'None', 'Calories: 140 · Carbs: 39g', NULL, true, 10, 50, 10),
('peach-tea', 'Peach Iced Tea', 'Brewed black tea, peach syrup, sugar, ice', 3.50, 'drinks', 'https://framerusercontent.com/images/pP3gKt2J5BBczlpi1XsyafZRBo.png', 'None', 'Calories: 130 · Carbs: 32g', NULL, true, 20, 50, 10),
('lemon-tea', 'Lemon Iced Tea', 'Brewed black tea, lemon juice, sugar, ice', 3.50, 'drinks', 'https://framerusercontent.com/images/GrMb28ZBimSdmMOxXPl9kD2dlE.png', 'None', 'Calories: 120 · Carbs: 30g', NULL, true, 30, 50, 10),
('coconut-water', 'Coconut Water Cooler', 'Fresh coconut water, lime juice, mint, ice', 3.99, 'drinks', 'https://framerusercontent.com/images/T2Y59fsEAALVITHlwJ6Q6qIfXM.png', 'None', 'Calories: 60 · Carbs: 15g', NULL, true, 40, 50, 10),
('limeade', 'Limeade Spritzer', 'Lime juice, sparkling water, sugar, ice', 3.99, 'drinks', 'https://framerusercontent.com/images/yGzPQ8ney2W9hfUPI3xLyZvCujI.png', 'None', 'Calories: 110 · Carbs: 29g', NULL, true, 50, 50, 10),
('green-lemonade', 'Green Tea Lemonade', 'Brewed green tea, lemon juice, sugar, ice', 3.99, 'drinks', 'https://framerusercontent.com/images/npNVZEAs2uN3JKihJpXH4G5SLs.png', 'None', 'Calories: 100 · Carbs: 25g', NULL, true, 60, 50, 10),
('orange-juice', 'Orange Juice', 'Freshly squeezed oranges', 3.99, 'drinks', 'https://framerusercontent.com/images/9Cicx54hrMJ97UB6dKmDk7nkA.png', 'None', 'Calories: 160 · Carbs: 38g · Protein: 2g', NULL, true, 70, 50, 10),
('strawberry-smoothie', 'Strawberry Banana Smoothie', 'Strawberries, bananas, yogurt, honey, ice', 4.99, 'drinks', 'https://framerusercontent.com/images/iK4nikPZd41d6ONam9M77AuwI.png', 'Dairy', 'Calories: 210 · Fat: 2.5g · Carbs: 44g · Protein: 5g', NULL, true, 80, 50, 10),
('mango-smoothie', 'Mango Smoothie', 'Fresh mango, yogurt, ice, honey', 4.99, 'drinks', 'https://framerusercontent.com/images/M1MzsJOs5zYPAhZxzEc3a4ANDrw.png', 'Dairy', 'Calories: 220 · Fat: 3g · Carbs: 48g · Protein: 5g', NULL, true, 90, 50, 10),
('cold-brew', 'Cold Brew Coffee', 'Cold-brewed coffee, ice', 3.99, 'drinks', 'https://framerusercontent.com/images/tIfpe9e1OErjHRIbmmQBkDwQM1s.png', 'None', 'Calories: 5', NULL, true, 100, 50, 10),
('chocolate-shake', 'Chocolate Milkshake', 'Chocolate ice cream, milk, chocolate syrup, whipped cream', 6.50, 'drinks', 'https://framerusercontent.com/images/EkkZLIaKFdPxUlbZmBpnvY65CA.png', 'Dairy', 'Calories: 350 · Fat: 15g · Carbs: 48g · Protein: 8g', NULL, true, 110, 50, 10),
('matcha-latte', 'Matcha Latte', 'Matcha green tea powder, milk, honey, ice', 5.99, 'drinks', 'https://framerusercontent.com/images/RU0prChVZMldKW9jnFH9P8QuXjc.png', 'Dairy', 'Calories: 170 · Fat: 6g · Carbs: 24g · Protein: 6g', NULL, true, 120, 50, 10),
('caramel-frappe', 'Caramel Frappé', 'Coffee, milk, caramel syrup, whipped cream, ice', 5.99, 'drinks', 'https://framerusercontent.com/images/e6wGiwadjdC8f3V7LauaQ6HyT8.png', 'Dairy', 'Calories: 280 · Fat: 11g · Carbs: 41g · Protein: 5g', NULL, true, 130, 50, 10),
('hot-chocolate', 'Hot Chocolate', 'Milk, cocoa powder, sugar, whipped cream', 3.99, 'drinks', 'https://framerusercontent.com/images/olKbdfRkDrsCIjYs4ZNyoDyZh8g.png', 'Dairy', 'Calories: 250 · Fat: 11g · Carbs: 32g · Protein: 8g', NULL, true, 140, 50, 10),
('vanilla-latte', 'Vanilla Iced Latte', 'Espresso, milk, vanilla syrup, ice', 5.49, 'drinks', 'https://framerusercontent.com/images/rqsRZRQzpFTcZFnBQBRx54WG8Q.png', 'Dairy', 'Calories: 190 · Fat: 6g · Carbs: 28g · Protein: 6g', NULL, true, 150, 50, 10)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category_slug = EXCLUDED.category_slug,
  image = COALESCE(EXCLUDED.image, public.products.image),
  allergens = EXCLUDED.allergens,
  nutrition = EXCLUDED.nutrition,
  portion = EXCLUDED.portion,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.categories SET label='Pizza', image='https://framerusercontent.com/images/O35ad4eRtufs0gpp6JZXayT5IM.png', intro='From the classic simplicity of a traditional Margherita to the rich indulgence of gourmet truffle oil creations, we artfully blend the best of old-world charm with modern culinary innovation. Each pizza is hand-tossed with care, topped with fresh, high-quality ingredients, and baked to golden perfection.', sort_order=0 WHERE slug='pizza';
UPDATE public.categories SET label='Pasta', image='https://framerusercontent.com/images/xd9Oo3dlguei8tJ9fP0wq4BtTtE.png', intro='Twirl into comfort with our handcrafted pasta — slow-simmered sauces, al dente noodles, and bright, fresh ingredients in every bowl.', sort_order=10 WHERE slug='pasta';
UPDATE public.categories SET label='Sides', image='https://framerusercontent.com/images/8LagT2GMawnySp6zGEeZrsG4JJU.png', intro='Crispy, cheesy, golden and dippable — the perfect supporting cast to any Sweet & Lovely meal.', sort_order=20 WHERE slug='sides';
UPDATE public.categories SET label='Deserts', image='https://framerusercontent.com/images/8G7eGuuOmijUEO3VXSdPJ9i4VU.png', intro='End on a sweet note with warm, indulgent desserts made fresh in-house every day.', sort_order=30 WHERE slug='deserts';
UPDATE public.categories SET label='Drinks', image='https://framerusercontent.com/images/eQS6ke7KFxu839Roxv77gisTY0Y.png', intro='Cool down, perk up or treat yourself with a curated lineup of sodas, juices, smoothies and coffee.', sort_order=40 WHERE slug='drinks';REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon, authenticated;DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','content_pages','system_settings','reviews','order_items','audit_logs','integrations']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- Public read access for catalog tables so unauthenticated visitors can see live menu
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='Public can view active products') THEN
    CREATE POLICY "Public can view active products" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='Public can view categories') THEN
    CREATE POLICY "Public can view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.categories TO anon;
-- ============== PROMOTIONS ==============
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('percent','fixed','free_delivery','bogo')),
  value numeric(10,2) NOT NULL DEFAULT 0,
  min_subtotal_zar numeric(10,2) NOT NULL DEFAULT 0,
  usage_limit integer,
  times_used integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active promotions" ON public.promotions FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Admins manage promotions" ON public.promotions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== DISCOUNTS ==============
CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('product','category')),
  target_slug text NOT NULL,
  percent_off numeric(5,2) NOT NULL CHECK (percent_off > 0 AND percent_off <= 100),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.discounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT ALL ON public.discounts TO service_role;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active discounts" ON public.discounts FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Admins manage discounts" ON public.discounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX discounts_target_idx ON public.discounts(target_type, target_slug);

-- ============== DELIVERY ZONES ==============
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  postal_codes text[] NOT NULL DEFAULT '{}',
  fee_zar numeric(10,2) NOT NULL DEFAULT 0,
  min_order_zar numeric(10,2) NOT NULL DEFAULT 0,
  eta_minutes integer NOT NULL DEFAULT 45,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active zones" ON public.delivery_zones FOR SELECT TO anon, authenticated
  USING (is_active);
CREATE POLICY "Admins manage zones" ON public.delivery_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== RESERVATIONS ==============
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  party_size integer NOT NULL CHECK (party_size > 0),
  reserved_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','seated','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own reservations" ON public.reservations FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own reservations" ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel own pending reservations" ON public.reservations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending','confirmed'))
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage reservations" ON public.reservations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX reservations_user_idx ON public.reservations(user_id);
CREATE INDEX reservations_reserved_at_idx ON public.reservations(reserved_at);

-- ============== LOYALTY ==============
CREATE TABLE public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  points_per_zar numeric(8,4) NOT NULL DEFAULT 1,
  redemption_rate_zar numeric(8,4) NOT NULL DEFAULT 0.05,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_programs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active programs" ON public.loyalty_programs FOR SELECT TO anon, authenticated
  USING (is_active);
CREATE POLICY "Admins manage programs" ON public.loyalty_programs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.loyalty_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.loyalty_programs(id) ON DELETE SET NULL,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'bronze',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty" ON public.loyalty_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage loyalty" ON public.loyalty_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== BANNERS ==============
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image text,
  cta_label text,
  cta_href text,
  placement text NOT NULL DEFAULT 'home' CHECK (placement IN ('home','menu','checkout','global')),
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active banners" ON public.banners FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Admins manage banners" ON public.banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== STORE HOURS ==============
CREATE TABLE public.store_hours (
  day_of_week integer PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.store_hours TO authenticated;
GRANT ALL ON public.store_hours TO service_role;
ALTER TABLE public.store_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view hours" ON public.store_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage hours" ON public.store_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== FEATURED ITEMS ==============
CREATE TABLE public.featured_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL REFERENCES public.products(slug) ON DELETE CASCADE,
  placement text NOT NULL DEFAULT 'home' CHECK (placement IN ('home','menu','desserts','offers')),
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_slug, placement)
);
GRANT SELECT ON public.featured_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.featured_items TO authenticated;
GRANT ALL ON public.featured_items TO service_role;
ALTER TABLE public.featured_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active featured" ON public.featured_items FOR SELECT TO anon, authenticated
  USING (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Admins manage featured" ON public.featured_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== updated_at triggers ==============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['promotions','discounts','delivery_zones','reservations','loyalty_programs','loyalty_accounts','banners','featured_items']
  LOOP
    EXECUTE format('CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- ============== Realtime publication ==============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['promotions','discounts','delivery_zones','reservations','loyalty_programs','loyalty_accounts','banners','store_hours','featured_items']
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "email": {"orders": true, "security": true, "promotions": false, "account": true},
    "sms":   {"orders": false, "security": true, "promotions": false, "account": false},
    "push":  {"orders": true, "security": true, "promotions": false, "account": true}
  }'::jsonb;

-- Saved addresses
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  recipient text,
  phone text,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  province text,
  postal_code text,
  country text NOT NULL DEFAULT 'ZA',
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON public.user_addresses(user_id, is_default DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;
GRANT ALL ON public.user_addresses TO service_role;

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addresses owner select" ON public.user_addresses;
CREATE POLICY "addresses owner select" ON public.user_addresses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "addresses owner insert" ON public.user_addresses;
CREATE POLICY "addresses owner insert" ON public.user_addresses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addresses owner update" ON public.user_addresses;
CREATE POLICY "addresses owner update" ON public.user_addresses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addresses owner delete" ON public.user_addresses;
CREATE POLICY "addresses owner delete" ON public.user_addresses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER user_addresses_set_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One default address per user
CREATE OR REPLACE FUNCTION public.user_addresses_enforce_single_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER user_addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.user_addresses
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.user_addresses_enforce_single_default();

ALTER TABLE public.user_addresses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_addresses;

DROP POLICY IF EXISTS "avatars read" ON storage.objects;
CREATE POLICY "avatars read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars insert own" ON storage.objects;
CREATE POLICY "avatars insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Atomic order stock deduction + availability check, with realtime on products

CREATE OR REPLACE FUNCTION public.check_stock_availability(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_slug text;
  v_qty int;
  v_stock int;
  v_short jsonb := '[]'::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    SELECT stock INTO v_stock FROM public.products WHERE slug = v_slug;
    IF v_stock IS NULL OR v_stock < v_qty THEN
      v_short := v_short || jsonb_build_object(
        'slug', v_slug,
        'requested', v_qty,
        'available', COALESCE(v_stock, 0)
      );
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', jsonb_array_length(v_short) = 0, 'shortages', v_short);
END $$;

GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO anon, authenticated, service_role;

-- Atomically locks each product row, validates stock, deducts, and writes an
-- inventory_movements log row per item. Raises on insufficient stock so the
-- caller transaction can react. Service-role only (called from server fn).
CREATE OR REPLACE FUNCTION public.process_order_stock_deduction(_order_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_slug text;
  v_qty int;
  v_before int;
  v_after int;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  -- Phase 1: lock + validate every row up-front so we never partially deduct.
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT stock INTO v_before
      FROM public.products
     WHERE slug = v_slug
     FOR UPDATE;

    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_slug USING ERRCODE = 'P0002';
    END IF;
    IF v_before < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_slug, v_before, v_qty
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Phase 2: apply deductions + audit log.
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.products
       SET stock = stock - v_qty,
           updated_at = now()
     WHERE slug = v_slug
     RETURNING stock INTO v_after;

    INSERT INTO public.inventory_movements
      (product_slug, type, quantity, balance_after, reason, order_id)
    VALUES
      (v_slug, 'sale', -v_qty, v_after,
       'Order ' || _order_id::text || ' deduction', _order_id);

    v_movements := v_movements || jsonb_build_object(
      'slug', v_slug,
      'before', v_after + v_qty,
      'deducted', v_qty,
      'after', v_after,
      'order_id', _order_id
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movements', v_movements);
END $$;

REVOKE ALL ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) TO service_role;

-- Rollback for cancelled/failed orders. Adds stock back + writes a 'return'
-- movement row. Idempotent per order_id via the guard select.
CREATE OR REPLACE FUNCTION public.rollback_order_stock(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mov record;
  v_after int;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  -- Guard: only rollback if a sale was previously recorded and not yet returned.
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
     WHERE order_id = _order_id AND type = 'return'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_rolled_back', true);
  END IF;

  FOR mov IN
    SELECT product_slug, quantity
      FROM public.inventory_movements
     WHERE order_id = _order_id AND type = 'sale'
  LOOP
    UPDATE public.products
       SET stock = stock + ABS(mov.quantity),
           updated_at = now()
     WHERE slug = mov.product_slug
     RETURNING stock INTO v_after;

    INSERT INTO public.inventory_movements
      (product_slug, type, quantity, balance_after, reason, order_id)
    VALUES
      (mov.product_slug, 'return', ABS(mov.quantity), v_after,
       'Order ' || _order_id::text || ' rollback', _order_id);

    v_movements := v_movements || jsonb_build_object(
      'slug', mov.product_slug,
      'restored', ABS(mov.quantity),
      'after', v_after
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movements', v_movements);
END $$;

REVOKE ALL ON FUNCTION public.rollback_order_stock(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rollback_order_stock(uuid) TO service_role;

-- Enable realtime so admin + customer views update instantly on stock changes.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products REPLICA IDENTITY FULL;

REVOKE EXECUTE ON FUNCTION public.check_stock_availability(jsonb) FROM anon, authenticated;

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS hours_text text,
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_zone_name text;

CREATE INDEX IF NOT EXISTS orders_delivery_zone_id_idx ON public.orders(delivery_zone_id);

INSERT INTO public.delivery_zones (slug, name, postal_codes, fee_zar, min_order_zar, eta_minutes, is_active, sort_order, description, contact_phone, contact_email, hours_text, color)
SELECT * FROM (VALUES
  ('sandton',  'Sandton',  ARRAY['2196','2031','2146']::text[], 45, 150, 35, true, 1, 'Sandton CBD, Sandhurst, Morningside', '+27 11 555 0101', 'sandton@sweetnlovely.co.za',  'Mon–Sun 10:00–22:00', '#ff003c'),
  ('rosebank', 'Rosebank', ARRAY['2196','2132','2193']::text[], 40, 120, 30, true, 2, 'Rosebank, Parkwood, Hyde Park',       '+27 11 555 0102', 'rosebank@sweetnlovely.co.za', 'Mon–Sun 10:00–22:00', '#f59e0b'),
  ('fourways', 'Fourways', ARRAY['2055','2191','2068']::text[], 55, 180, 45, true, 3, 'Fourways, Lonehill, Bryanston',       '+27 11 555 0103', 'fourways@sweetnlovely.co.za', 'Mon–Sun 11:00–22:00', '#10b981'),
  ('midrand',  'Midrand',  ARRAY['1685','1682','1684']::text[], 60, 200, 50, true, 4, 'Midrand, Halfway House, Carlswald',   '+27 11 555 0104', 'midrand@sweetnlovely.co.za',  'Mon–Sun 11:00–21:30', '#6366f1')
) AS v(slug, name, postal_codes, fee_zar, min_order_zar, eta_minutes, is_active, sort_order, description, contact_phone, contact_email, hours_text, color)
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones);
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated, anon;
-- 1. Add zone_admin enum value (can't be used as ::app_role literal in same tx, so we use ::text comparisons below)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'zone_admin';

-- 2. Extend user_roles with optional zone assignment
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS assigned_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- One zone-admin assignment per user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_zone_admin_unique
  ON public.user_roles (user_id)
  WHERE assigned_zone_id IS NOT NULL;

-- 3. Trigger: enforce role/assigned_zone_id consistency
CREATE OR REPLACE FUNCTION public.user_roles_validate_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role::text = 'zone_admin' THEN
    IF NEW.assigned_zone_id IS NULL THEN
      RAISE EXCEPTION 'zone_admin role requires assigned_zone_id';
    END IF;
  ELSE
    IF NEW.assigned_zone_id IS NOT NULL THEN
      RAISE EXCEPTION 'assigned_zone_id only allowed for zone_admin role';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_roles_validate_zone_trg ON public.user_roles;
CREATE TRIGGER user_roles_validate_zone_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.user_roles_validate_zone();

-- 4. Helper functions (column-based, so no enum literal needed in same tx)
CREATE OR REPLACE FUNCTION public.is_main_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_zone(_uid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_zone_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_zone(_uid uuid, _zone_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_main_admin(_uid)
      OR public.get_user_zone(_uid) = _zone_id
$$;

GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_zone(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_zone_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_zone(uuid, uuid) TO authenticated, anon;

-- 5. delivery_zones: allow zone-admin SELECT/UPDATE on their own zone
DROP POLICY IF EXISTS "Admins manage zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Zone admin reads own zone" ON public.delivery_zones;
DROP POLICY IF EXISTS "Zone admin updates own zone" ON public.delivery_zones;

CREATE POLICY "Main admin full access zones"
  ON public.delivery_zones FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "Zone admin reads own zone"
  ON public.delivery_zones FOR SELECT TO authenticated
  USING (id = public.get_user_zone(auth.uid()));

CREATE POLICY "Zone admin updates own zone"
  ON public.delivery_zones FOR UPDATE TO authenticated
  USING (id = public.get_user_zone(auth.uid()))
  WITH CHECK (id = public.get_user_zone(auth.uid()));

-- 6. orders: zone admin can read/update orders in their zone
DROP POLICY IF EXISTS "Zone admin reads zone orders" ON public.orders;
DROP POLICY IF EXISTS "Zone admin updates zone orders" ON public.orders;

CREATE POLICY "Zone admin reads zone orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    delivery_zone_id IS NOT NULL
    AND delivery_zone_id = public.get_user_zone(auth.uid())
  );

CREATE POLICY "Zone admin updates zone orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    delivery_zone_id IS NOT NULL
    AND delivery_zone_id = public.get_user_zone(auth.uid())
  )
  WITH CHECK (
    delivery_zone_id IS NOT NULL
    AND delivery_zone_id = public.get_user_zone(auth.uid())
  );

-- 7. order_items: zone admin can read items of orders in their zone
DROP POLICY IF EXISTS "Zone admin reads zone order items" ON public.order_items;
CREATE POLICY "Zone admin reads zone order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_items.order_id
         AND o.delivery_zone_id IS NOT NULL
         AND o.delivery_zone_id = public.get_user_zone(auth.uid())
    )
  );

-- 8. inventory_movements: zone admin reads movements for their zone's orders only
DROP POLICY IF EXISTS "Zone admin reads zone inventory" ON public.inventory_movements;
CREATE POLICY "Zone admin reads zone inventory"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (
    order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = inventory_movements.order_id
         AND o.delivery_zone_id = public.get_user_zone(auth.uid())
    )
  );

-- 9. user_roles: zone admin can read only their own row (existing policy already allows this via user_id = auth.uid()). No write changes.
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS image_url text;-- Zone admins can read audit log rows tagged with their assigned zone_id
-- (logAudit stamps metadata.zone_id automatically for zone-scoped actors).
CREATE POLICY "audit zone admin read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_zone_admin(auth.uid())
    AND (metadata->>'zone_id') = public.get_user_zone(auth.uid())::text
  );
-- =========================================================
-- 1) Notifications: remove user self-insert branch
-- =========================================================
DROP POLICY IF EXISTS "notifications admin insert" ON public.notifications;
CREATE POLICY "notifications admin insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role('admin'::app_role));

-- =========================================================
-- 2) Orders: require non-null user_id on user inserts
-- =========================================================
DROP POLICY IF EXISTS "orders user insert own" ON public.orders;
CREATE POLICY "orders user insert own"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR private.has_role('admin'::app_role)
  );

-- =========================================================
-- 3) Delivery zones: hide staff contact columns from anon
-- =========================================================
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM anon;

-- =========================================================
-- 4) Realtime messages: deny anon/authenticated subscriptions
-- =========================================================
DROP POLICY IF EXISTS "deny anon realtime subscriptions" ON realtime.messages;
DROP POLICY IF EXISTS "deny authenticated realtime subscriptions" ON realtime.messages;

CREATE POLICY "deny anon realtime subscriptions"
  ON realtime.messages
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny authenticated realtime subscriptions"
  ON realtime.messages
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- =========================================================
-- 5) SECURITY DEFINER functions: move RLS helpers to private
--    schema and revoke EXECUTE on public-schema copies from
--    anon/authenticated. Functions used only server-side via
--    the service role have EXECUTE revoked entirely from
--    anon/authenticated.
-- =========================================================

-- Private mirrors of helpers (callable only by superuser/owner via
-- SECURITY DEFINER inside policies; private schema is not exposed
-- to PostgREST so the linter no longer flags them).
CREATE OR REPLACE FUNCTION private.is_main_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_zone(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_zone_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_uid uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND role = _role
  )
$$;

-- Rewrite policies that referenced unqualified (public) helpers
-- so they call the private-schema equivalents.

-- orders zone-admin policies
DROP POLICY IF EXISTS "Zone admin reads zone orders" ON public.orders;
CREATE POLICY "Zone admin reads zone orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (delivery_zone_id IS NOT NULL AND delivery_zone_id = private.get_user_zone(auth.uid()));

DROP POLICY IF EXISTS "Zone admin updates zone orders" ON public.orders;
CREATE POLICY "Zone admin updates zone orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (delivery_zone_id IS NOT NULL AND delivery_zone_id = private.get_user_zone(auth.uid()))
  WITH CHECK (delivery_zone_id IS NOT NULL AND delivery_zone_id = private.get_user_zone(auth.uid()));

-- order_items zone-admin read
DROP POLICY IF EXISTS "Zone admin reads zone order items" ON public.order_items;
CREATE POLICY "Zone admin reads zone order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = order_items.order_id
       AND o.delivery_zone_id IS NOT NULL
       AND o.delivery_zone_id = private.get_user_zone(auth.uid())
  ));

-- audit_logs zone-admin read
DROP POLICY IF EXISTS "audit zone admin read" ON public.audit_logs;
CREATE POLICY "audit zone admin read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    private.is_zone_admin(auth.uid())
    AND (metadata ->> 'zone_id') = (private.get_user_zone(auth.uid()))::text
  );

-- inventory_movements zone-admin read
DROP POLICY IF EXISTS "Zone admin reads zone inventory" ON public.inventory_movements;
CREATE POLICY "Zone admin reads zone inventory"
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = inventory_movements.order_id
       AND o.delivery_zone_id = private.get_user_zone(auth.uid())
  ));

-- promotions
DROP POLICY IF EXISTS "Admins manage promotions" ON public.promotions;
CREATE POLICY "Admins manage promotions"
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- discounts
DROP POLICY IF EXISTS "Admins manage discounts" ON public.discounts;
CREATE POLICY "Admins manage discounts"
  ON public.discounts
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- delivery_zones (main admin + zone admin)
DROP POLICY IF EXISTS "Main admin full access zones" ON public.delivery_zones;
CREATE POLICY "Main admin full access zones"
  ON public.delivery_zones
  FOR ALL
  TO authenticated
  USING (private.is_main_admin(auth.uid()))
  WITH CHECK (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "Zone admin reads own zone" ON public.delivery_zones;
CREATE POLICY "Zone admin reads own zone"
  ON public.delivery_zones
  FOR SELECT
  TO authenticated
  USING (id = private.get_user_zone(auth.uid()));

DROP POLICY IF EXISTS "Zone admin updates own zone" ON public.delivery_zones;
CREATE POLICY "Zone admin updates own zone"
  ON public.delivery_zones
  FOR UPDATE
  TO authenticated
  USING (id = private.get_user_zone(auth.uid()))
  WITH CHECK (id = private.get_user_zone(auth.uid()));

-- reservations
DROP POLICY IF EXISTS "Users view own reservations" ON public.reservations;
CREATE POLICY "Users view own reservations"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage reservations" ON public.reservations;
CREATE POLICY "Admins manage reservations"
  ON public.reservations
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- loyalty_programs
DROP POLICY IF EXISTS "Admins manage programs" ON public.loyalty_programs;
CREATE POLICY "Admins manage programs"
  ON public.loyalty_programs
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- loyalty_accounts
DROP POLICY IF EXISTS "Admins manage loyalty" ON public.loyalty_accounts;
CREATE POLICY "Admins manage loyalty"
  ON public.loyalty_accounts
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own loyalty" ON public.loyalty_accounts;
CREATE POLICY "Users view own loyalty"
  ON public.loyalty_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- banners
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners"
  ON public.banners
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- store_hours
DROP POLICY IF EXISTS "Admins manage hours" ON public.store_hours;
CREATE POLICY "Admins manage hours"
  ON public.store_hours
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- featured_items
DROP POLICY IF EXISTS "Admins manage featured" ON public.featured_items;
CREATE POLICY "Admins manage featured"
  ON public.featured_items
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- user_addresses owner select
DROP POLICY IF EXISTS "addresses owner select" ON public.user_addresses;
CREATE POLICY "addresses owner select"
  ON public.user_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- Revoke EXECUTE from anon/authenticated on the now-unused public helpers
REVOKE EXECUTE ON FUNCTION public.is_main_admin(uuid)              FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_zone(uuid)              FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_zone_admin(uuid)              FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)         FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_zone(uuid, uuid)      FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_stock_availability(jsonb)  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rollback_order_stock(uuid)       FROM anon, authenticated, PUBLIC;

-- 1) Orders / order_items: remove direct INSERT for authenticated users.
--    Order creation now flows exclusively through the verified Paystack
--    server function, which uses the service role (bypasses RLS).
DROP POLICY IF EXISTS "orders user insert own" ON public.orders;
DROP POLICY IF EXISTS "order_items write via order" ON public.order_items;

-- 2) Delivery zones: hide staff contact columns from authenticated users
--    too (already revoked from anon). Admin reads use the service role.
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM authenticated;

-- 3) role_permissions: restrict read to admins only
DROP POLICY IF EXISTS "role_permissions read" ON public.role_permissions;
CREATE POLICY "role_permissions admin read"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 1) SUPA_rls_policy_always_true: drop overly-permissive anon insert on home_content_events
DROP POLICY IF EXISTS "events anon insert" ON public.home_content_events;

-- 2) delivery_zones_contact_info_public: revoke sensitive columns from anon + authenticated
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM anon;
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM authenticated;

-- 3 & 4) Normalize has_role calls to the explicit (auth.uid(), role) signature
-- audit_logs
DROP POLICY IF EXISTS "audit admin insert" ON public.audit_logs;
CREATE POLICY "audit admin insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "audit admin read" ON public.audit_logs;
CREATE POLICY "audit admin read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- categories
DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- content_pages
DROP POLICY IF EXISTS "content admin write" ON public.content_pages;
CREATE POLICY "content admin write" ON public.content_pages
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "content public read published" ON public.content_pages;
CREATE POLICY "content public read published" ON public.content_pages
  FOR SELECT
  USING ((status = 'published'::text) OR private.has_role(auth.uid(), 'admin'::app_role));

-- integrations
DROP POLICY IF EXISTS "integrations admin all" ON public.integrations;
CREATE POLICY "integrations admin all" ON public.integrations
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- inventory_movements
DROP POLICY IF EXISTS "inventory_movements admin insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin insert" ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "inventory_movements admin read" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin read" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- notifications
DROP POLICY IF EXISTS "notifications admin delete" ON public.notifications;
CREATE POLICY "notifications admin delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications admin insert" ON public.notifications;
CREATE POLICY "notifications admin insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "notifications own read" ON public.notifications;
CREATE POLICY "notifications own read" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- order_items
DROP POLICY IF EXISTS "order_items admin delete" ON public.order_items;
CREATE POLICY "order_items admin delete" ON public.order_items
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "order_items admin update" ON public.order_items;
CREATE POLICY "order_items admin update" ON public.order_items
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "order_items read via order" ON public.order_items;
CREATE POLICY "order_items read via order" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  ));

-- orders
DROP POLICY IF EXISTS "orders admin delete" ON public.orders;
CREATE POLICY "orders admin delete" ON public.orders
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders admin update" ON public.orders;
CREATE POLICY "orders admin update" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders user read own" ON public.orders;
CREATE POLICY "orders user read own" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- products
DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products admin write" ON public.products
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- reviews
DROP POLICY IF EXISTS "reviews admin delete" ON public.reviews;
CREATE POLICY "reviews admin delete" ON public.reviews
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "reviews admin manage" ON public.reviews;
CREATE POLICY "reviews admin manage" ON public.reviews
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- system_settings ("settings admin all")
DROP POLICY IF EXISTS "settings admin all" ON public.system_settings;
CREATE POLICY "settings admin all" ON public.system_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- role_permissions write
DROP POLICY IF EXISTS "role_permissions admin write" ON public.role_permissions;
CREATE POLICY "role_permissions admin write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 5) promotions_full_details_public: hide internal metrics from public/authenticated reads
REVOKE SELECT (value, usage_limit, times_used) ON public.promotions FROM anon;
REVOKE SELECT (value, usage_limit, times_used) ON public.promotions FROM authenticated;
-- Fix: restrict delivery_zones public reads to safe columns only.
-- Revoke table-level SELECT and grant only non-sensitive columns.
REVOKE SELECT ON public.delivery_zones FROM anon, authenticated;

GRANT SELECT (
  id, slug, name, postal_codes, fee_zar, min_order_zar, eta_minutes,
  is_active, sort_order, created_at, updated_at, description,
  hours_text, color, image_url
) ON public.delivery_zones TO anon, authenticated;

-- Fix: avatars storage SELECT policy must enforce ownership by folder name.
DROP POLICY IF EXISTS "avatars read" ON storage.objects;
CREATE POLICY "avatars read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
-- Promotions: hide sensitive columns from public reads
REVOKE SELECT ON public.promotions FROM anon, authenticated;
GRANT SELECT (
  id, name, description, min_subtotal_zar,
  starts_at, ends_at, is_active, created_at, updated_at
) ON public.promotions TO anon, authenticated;

-- user_roles: pass auth.uid() to private.has_role
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- reviews: pass auth.uid() to private.has_role
DROP POLICY IF EXISTS "reviews public read approved" ON public.reviews;
CREATE POLICY "reviews public read approved"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'::review_status
    OR auth.uid() = user_id
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );

ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "notifications own read" ON public.notifications;
CREATE POLICY "notifications own read"
  ON public.notifications FOR SELECT
  USING (
    (auth.uid() = user_id)
    OR (user_id IS NULL AND private.has_role(auth.uid(), 'admin'::app_role))
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (
    NULL,
    'New order ' || COALESCE(NEW.order_number, NEW.id::text),
    COALESCE(NEW.customer_name, 'Customer')
      || ' placed an order for R'
      || to_char(COALESCE(NEW.total_zar, 0), 'FM999G999G990D00')
      || CASE WHEN NEW.delivery_zone_name IS NOT NULL
              THEN ' (' || NEW.delivery_zone_name || ')'
              ELSE '' END,
    'order',
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_order();

REVOKE EXECUTE ON FUNCTION public.notify_admin_on_new_order() FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Public can view active promotions" ON public.promotions;
REVOKE ALL ON public.promotions FROM anon, authenticated;
GRANT ALL ON public.promotions TO service_role;
-- Customer-facing order notifications: insert into public.notifications whenever
-- a new order is placed or an existing order's status changes.

CREATE OR REPLACE FUNCTION public.notify_customer_on_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (
    NEW.user_id,
    'Order received',
    'We received your order ' || COALESCE(NEW.order_number, NEW.id::text)
      || '. We''ll let you know as soon as it''s being prepared.',
    'order',
    false
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_customer_on_new_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_customer_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_customer_on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_new_order();


CREATE OR REPLACE FUNCTION public.notify_customer_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_num   text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_num := COALESCE(NEW.order_number, NEW.id::text);

  CASE NEW.status
    WHEN 'pending' THEN
      v_title := 'Order received';
      v_body  := 'Order ' || v_num || ' is awaiting confirmation.';
    WHEN 'preparing' THEN
      v_title := 'Your order is being prepared';
      v_body  := 'Our kitchen is preparing order ' || v_num || ' right now.';
    WHEN 'processing' THEN
      v_title := 'Your order is being processed';
      v_body  := 'Order ' || v_num || ' is being processed.';
    WHEN 'out_for_delivery' THEN
      v_title := 'Out for delivery';
      v_body  := 'Order ' || v_num || ' is on the way to you.';
    WHEN 'completed' THEN
      v_title := 'Ready for pickup';
      v_body  := 'Order ' || v_num || ' is ready for pickup. See you soon!';
    WHEN 'delivered' THEN
      v_title := 'Delivered';
      v_body  := 'Order ' || v_num || ' has been delivered. Enjoy!';
    WHEN 'cancelled' THEN
      v_title := 'Order cancelled';
      v_body  := 'Order ' || v_num || ' has been cancelled.';
    WHEN 'refunded' THEN
      v_title := 'Order refunded';
      v_body  := 'A refund has been issued for order ' || v_num || '.';
    ELSE
      v_title := 'Order updated';
      v_body  := 'Order ' || v_num || ' status changed to ' || NEW.status || '.';
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (NEW.user_id, v_title, v_body, 'order', false);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_customer_on_order_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_customer_on_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_customer_on_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_order_status_change();

-- Ensure realtime payloads include enough row data for client-side filtering.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE TABLE public.admin_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','active','idle','away','offline')),
  assigned_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  user_agent text,
  login_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_presence TO authenticated;
GRANT ALL ON public.admin_presence TO service_role;

ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Main admin can view all presence"
  ON public.admin_presence FOR SELECT
  TO authenticated
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Users can view own presence"
  ON public.admin_presence FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own presence"
  ON public.admin_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own presence"
  ON public.admin_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_admin_presence_updated_at
  BEFORE UPDATE ON public.admin_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_presence;
ALTER TABLE public.admin_presence REPLICA IDENTITY FULL;
UPDATE public.delivery_zones
SET image_url = regexp_replace(image_url, '^https?://github\.com/([^/]+)/([^/]+)/blob/(.+?)(\?.*)?$', 'https://raw.githubusercontent.com/\1/\2/\3')
WHERE image_url ~* '^https?://github\.com/[^/]+/[^/]+/blob/';
CREATE OR REPLACE VIEW public.delivery_zones_public
WITH (security_invoker = off) AS
SELECT id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
       hours_text, color, postal_codes, sort_order, image_url,
       contact_phone, contact_email
  FROM public.delivery_zones
 WHERE is_active = true;

GRANT SELECT ON public.delivery_zones_public TO anon, authenticated;

DROP VIEW IF EXISTS public.delivery_zones_public;

ALTER VIEW IF EXISTS public.delivery_zones_public SET (security_invoker = on);

-- Recreate as a security_invoker view so it respects RLS / column grants of the caller.
CREATE VIEW public.delivery_zones_public
WITH (security_invoker = on) AS
SELECT id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
       hours_text, color, postal_codes, sort_order, image_url,
       contact_phone, contact_email
  FROM public.delivery_zones
 WHERE is_active = true;

GRANT SELECT
  (id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
   hours_text, color, postal_codes, sort_order, image_url,
   contact_phone, contact_email, is_active)
  ON public.delivery_zones TO anon, authenticated;

GRANT SELECT ON public.delivery_zones_public TO anon, authenticated;
DROP POLICY IF EXISTS "Main admin can view all presence" ON public.admin_presence;

CREATE POLICY "Main admin can view all presence"
  ON public.admin_presence FOR SELECT
  TO authenticated
  USING (private.is_main_admin(auth.uid()));
CREATE POLICY "events public insert" ON public.home_content_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_type IN ('view','click')
    AND content_type IN ('popular','hot_deal','special','banner','featured')
  );
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
-- Dedupe existing rows keeping latest per (section, zone_id) treating NULL zones as equal
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY section, COALESCE(zone_id::text, 'null') ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.home_section_visibility
)
DELETE FROM public.home_section_visibility WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE public.home_section_visibility DROP CONSTRAINT IF EXISTS home_section_visibility_section_zone_id_key;
ALTER TABLE public.home_section_visibility ADD CONSTRAINT home_section_visibility_section_zone_id_key UNIQUE NULLS NOT DISTINCT (section, zone_id);

CREATE TABLE public.home_desserts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text,
  price text,
  product_slug text,
  category text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_desserts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_desserts TO authenticated;
GRANT ALL ON public.home_desserts TO service_role;

ALTER TABLE public.home_desserts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desserts public read active" ON public.home_desserts
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now()));

CREATE POLICY "desserts admin read" ON public.home_desserts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR (zone_id IS NOT NULL AND can_access_zone(auth.uid(), zone_id)));

CREATE POLICY "desserts admin write" ON public.home_desserts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR (zone_id IS NOT NULL AND can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
              OR (zone_id IS NOT NULL AND can_access_zone(auth.uid(), zone_id)));

CREATE TRIGGER home_desserts_set_updated_at
  BEFORE UPDATE ON public.home_desserts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS free_delivery_threshold_zar numeric(10,2) NOT NULL DEFAULT 0;GRANT SELECT ON public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;GRANT SELECT (contact_phone, contact_email, free_delivery_threshold_zar) ON public.delivery_zones TO anon, authenticated;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_medium_zar numeric,
  ADD COLUMN IF NOT EXISTS price_large_zar numeric;

UPDATE public.products
   SET price_medium_zar = COALESCE(price_medium_zar, 80),
       price_large_zar  = COALESCE(price_large_zar, 150)
 WHERE category_slug = 'pizza';
-- 1) Extend delivery_zones with fulfilment options
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS collection_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_instructions text,
  ADD COLUMN IF NOT EXISTS collection_prep_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS collection_address text;

-- Anon customers query delivery_zones directly with the publishable key; grant SELECT on the new columns
GRANT SELECT (delivery_enabled, collection_enabled, collection_instructions, collection_prep_minutes, collection_address)
  ON public.delivery_zones TO anon;
GRANT SELECT (delivery_enabled, collection_enabled, collection_instructions, collection_prep_minutes, collection_address)
  ON public.delivery_zones TO authenticated;

-- 2) Extend orders with fulfilment method + snapshots
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS collection_location text,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('delivery','collection'));

-- 3) Refresh the public zones view so the storefront sees fulfilment fields
DROP VIEW IF EXISTS public.delivery_zones_public;
CREATE VIEW public.delivery_zones_public
WITH (security_invoker = true)
AS SELECT
  id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
  hours_text, color, postal_codes, sort_order, image_url,
  delivery_enabled, collection_enabled, collection_instructions,
  collection_prep_minutes, collection_address
FROM public.delivery_zones
WHERE is_active = true;

GRANT SELECT ON public.delivery_zones_public TO anon;
GRANT SELECT ON public.delivery_zones_public TO authenticated;
GRANT ALL ON public.delivery_zones_public TO service_role;
-- 1) Fix ambiguous single-arg has_role usage
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT
  USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "products public read active" ON public.products;
CREATE POLICY "products public read active" ON public.products
  FOR SELECT
  USING (is_active OR private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Drop the ambiguous single-argument helper
DROP FUNCTION IF EXISTS private.has_role(app_role);

-- 3) Move home_* policies off public.has_role onto private.has_role
DROP POLICY IF EXISTS "banners admin read" ON public.home_banners;
CREATE POLICY "banners admin read" ON public.home_banners
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "banners admin write" ON public.home_banners;
CREATE POLICY "banners admin write" ON public.home_banners
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "events admin read" ON public.home_content_events;
CREATE POLICY "events admin read" ON public.home_content_events
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "desserts admin read" ON public.home_desserts;
CREATE POLICY "desserts admin read" ON public.home_desserts
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "desserts admin write" ON public.home_desserts;
CREATE POLICY "desserts admin write" ON public.home_desserts
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "deals admin read" ON public.home_hot_deals;
CREATE POLICY "deals admin read" ON public.home_hot_deals
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "deals admin write" ON public.home_hot_deals;
CREATE POLICY "deals admin write" ON public.home_hot_deals
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "popular admin read" ON public.home_popular_items;
CREATE POLICY "popular admin read" ON public.home_popular_items
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "popular admin write" ON public.home_popular_items;
CREATE POLICY "popular admin write" ON public.home_popular_items
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "visibility admin write" ON public.home_section_visibility;
CREATE POLICY "visibility admin write" ON public.home_section_visibility
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "specials admin read" ON public.home_specials;
CREATE POLICY "specials admin read" ON public.home_specials
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "specials admin write" ON public.home_specials;
CREATE POLICY "specials admin write" ON public.home_specials
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

-- 4) Revoke direct RPC access to public.has_role from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_zones;GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_zone(uuid, uuid) TO anon, authenticated;
-- pizza_toppings table
CREATE TABLE public.pizza_toppings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_zar numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pizza_toppings TO anon, authenticated;
GRANT ALL ON public.pizza_toppings TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.pizza_toppings TO authenticated;

ALTER TABLE public.pizza_toppings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active toppings"
  ON public.pizza_toppings FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage toppings"
  ON public.pizza_toppings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pizza_toppings_updated
  BEFORE UPDATE ON public.pizza_toppings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pizza_toppings;

-- Extras on order items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS extras_total_zar numeric(10,2) NOT NULL DEFAULT 0;

-- Seed 11 toppings
INSERT INTO public.pizza_toppings (name, slug, price_zar, display_order) VALUES
  ('Cheese', 'cheese', 35, 10),
  ('Feta Cheese', 'feta-cheese', 26, 20),
  ('Ham', 'ham', 26, 30),
  ('Ribs', 'ribs', 35, 40),
  ('Salami', 'salami', 35, 50),
  ('Chicken', 'chicken', 35, 60),
  ('Mince', 'mince', 35, 70),
  ('Chorizo', 'chorizo', 35, 80),
  ('Bacon', 'bacon', 35, 90),
  ('Veggies', 'veggies', 20, 100),
  ('Beef', 'beef', 35, 110)
ON CONFLICT (slug) DO NOTHING;
DROP POLICY IF EXISTS "pizza_toppings public read" ON public.pizza_toppings;
DROP POLICY IF EXISTS "pizza_toppings admin manage" ON public.pizza_toppings;

CREATE POLICY "pizza_toppings public read"
  ON public.pizza_toppings FOR SELECT
  USING (is_active = true OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "pizza_toppings admin manage"
  ON public.pizza_toppings FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));DROP POLICY IF EXISTS "Anyone can view active toppings" ON public.pizza_toppings;
DROP POLICY IF EXISTS "Admins manage toppings" ON public.pizza_toppings;DROP POLICY IF EXISTS "pizza_toppings public read" ON public.pizza_toppings;

CREATE POLICY "pizza_toppings anon read active"
  ON public.pizza_toppings FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "pizza_toppings auth read"
  ON public.pizza_toppings FOR SELECT
  TO authenticated
  USING (is_active = true OR private.has_role(auth.uid(), 'admin'));
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

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ingredients text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS allergens   text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS calories    integer,
  ADD COLUMN IF NOT EXISTS fat_g       numeric(6,2),
  ADD COLUMN IF NOT EXISTS carbs_g     numeric(6,2),
  ADD COLUMN IF NOT EXISTS protein_g   numeric(6,2);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_nutrition_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT products_nutrition_non_negative CHECK (
    (calories  IS NULL OR calories  >= 0) AND
    (fat_g     IS NULL OR fat_g     >= 0) AND
    (carbs_g   IS NULL OR carbs_g   >= 0) AND
    (protein_g IS NULL OR protein_g >= 0)
  );
ALTER TABLE public.home_popular_items REPLICA IDENTITY FULL;
ALTER TABLE public.home_hot_deals REPLICA IDENTITY FULL;
ALTER TABLE public.home_specials REPLICA IDENTITY FULL;
ALTER TABLE public.home_banners REPLICA IDENTITY FULL;
ALTER TABLE public.home_desserts REPLICA IDENTITY FULL;
ALTER TABLE public.home_section_visibility REPLICA IDENTITY FULL;
-- Fix Realtime propagation for home_* content tables.
-- Supabase Realtime evaluates the SELECT policy against the NEW row for UPDATEs.
-- When an admin toggles is_active=false (or moves out of the schedule window),
-- the row failed the anon policy, so the UPDATE event was dropped and the
-- customer home page did not update in real time.
-- The customer queries already filter is_active/starts_at/ends_at client-side,
-- so broadening the anon SELECT to all rows is safe (home content is public).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['home_popular_items','home_hot_deals','home_specials','home_banners','home_desserts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t,'home_','')||' public read active', t);
  END LOOP;
END $$;

-- Recreate broadened public read policies (client filters visibility).
DROP POLICY IF EXISTS "popular public read active" ON public.home_popular_items;
CREATE POLICY "popular public read" ON public.home_popular_items
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "hot_deals public read active" ON public.home_hot_deals;
CREATE POLICY "hot_deals public read" ON public.home_hot_deals
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "specials public read active" ON public.home_specials;
CREATE POLICY "specials public read" ON public.home_specials
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "banners public read active" ON public.home_banners;
CREATE POLICY "banners public read" ON public.home_banners
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "desserts public read active" ON public.home_desserts;
CREATE POLICY "desserts public read" ON public.home_desserts
  FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_desserts;
ALTER TABLE public.home_desserts REPLICA IDENTITY FULL;GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
-- Replace unconditional public SELECT policies with scoped ones on home_* tables

DROP POLICY IF EXISTS "banners public read" ON public.home_banners;
CREATE POLICY "banners public read active" ON public.home_banners
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

DROP POLICY IF EXISTS "desserts public read" ON public.home_desserts;
CREATE POLICY "desserts public read active" ON public.home_desserts
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

DROP POLICY IF EXISTS "hot_deals public read" ON public.home_hot_deals;
-- "deals public read active" already exists and enforces the same window.

DROP POLICY IF EXISTS "popular public read" ON public.home_popular_items;
CREATE POLICY "popular public read active" ON public.home_popular_items
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

DROP POLICY IF EXISTS "specials public read" ON public.home_specials;
CREATE POLICY "specials public read active" ON public.home_specials
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

-- home_section_visibility has no active/date columns; restrict public reads to global (zone_id IS NULL) rows.
DROP POLICY IF EXISTS "visibility public read" ON public.home_section_visibility;
CREATE POLICY "visibility public read global" ON public.home_section_visibility
  FOR SELECT TO anon, authenticated
  USING (zone_id IS NULL);
UPDATE public.categories SET image = 'https://raw.githubusercontent.com/BonganiCacambile/sweet-lovely-634f24d4/main/Pork%20Ribs.png' WHERE slug = 'sides';
-- 1) products: enable-size-selection toggle
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_selection_enabled boolean NOT NULL DEFAULT false;

-- 2) product_sizes table
CREATE TABLE IF NOT EXISTS public.product_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_slug text NOT NULL REFERENCES public.products(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  description text,
  portion text,
  price_zar numeric NOT NULL DEFAULT 0 CHECK (price_zar >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_sizes_product_slug_idx
  ON public.product_sizes(product_slug, sort_order);

-- 3) Grants
GRANT SELECT ON public.product_sizes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sizes TO authenticated;
GRANT ALL ON public.product_sizes TO service_role;

-- 4) RLS
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view available sizes"
  ON public.product_sizes
  FOR SELECT
  TO anon, authenticated
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.slug = product_sizes.product_slug AND p.is_active = true
    )
  );

CREATE POLICY "Admins can view all sizes"
  ON public.product_sizes
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sizes"
  ON public.product_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sizes"
  ON public.product_sizes
  FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sizes"
  ON public.product_sizes
  FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 5) updated_at trigger (reuse existing set_updated_at)
DROP TRIGGER IF EXISTS product_sizes_set_updated_at ON public.product_sizes;
CREATE TRIGGER product_sizes_set_updated_at
  BEFORE UPDATE ON public.product_sizes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Realtime
ALTER TABLE public.product_sizes REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_sizes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_sizes';
  END IF;
END $$;
