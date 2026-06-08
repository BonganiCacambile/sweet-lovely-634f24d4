
# Admin Portal & Dashboard — Phased Build Plan

This is a very large scope (auth portal + MFA + 12 dashboard modules). To ship something polished and stable rather than 12 shallow stubs, I'll build it in phases. Please confirm the plan and the **Phase 1** scope below — I'll then proceed phase by phase, checking in between each.

---

## Design language (applies to every screen)

Inherit the existing Sweet & Lovely / Pepper-template visual language already in the app:

- **Logo/wordmark:** Cherry Bomb One, `rgb(255, 0, 60)` (Fire Red) — same as homepage and current auth.
- **Type:** existing display + body pair already loaded in `__root.tsx`.
- **Surfaces:** warm off-white background, soft cream cards, large rounded corners (`rounded-3xl`), generous whitespace, subtle shadows, soft red→peach gradient accents, faint grain/glass overlay on hero panels.
- **Motion:** Framer Motion — quiet fade/slide-up entrances, 200–400ms, no bounce. Counter tween on KPIs.
- **Tokens:** all colors via existing `src/styles.css` semantic tokens; no raw hex in components.
- **A11y:** semantic HTML, aria-labels on icon buttons, focus rings, 44px tap targets.

---

## Architecture

- All admin routes under `src/routes/_authenticated/admin/` (already gated; admin role check via existing `has_role` + `useAuth.isAdmin`).
- Login + MFA stay public at `/auth/admin` and `/auth/admin/mfa`.
- Reusable shell: `AdminAuthLayout`, `AdminShell` (sidebar + topbar + content), `KpiCard`, `SectionCard`, `DataTable`, `EmptyState`.
- Sidebar: collapsible, mobile drawer via shadcn `Sheet`. Sections: Main / Management / Administration / Account.
- Global ⌘K command palette (shadcn `Command` in a `Dialog`).
- Data: Phase 1 uses well-typed mock fixtures in `src/data/admin/*.ts` so the UI is real and demonstrable; later phases wire real Supabase queries via `createServerFn` + `requireSupabaseAuth` with admin role check.

---

## Phase 1 — Auth Portal + Dashboard Shell + Home (this turn)

1. **Admin Login (`/auth/admin`)** — redesign existing route with two-panel layout:
   - Left: brand lockup, welcome copy, security statement, trust chips, animated soft-gradient blobs.
   - Right: card with Email, Password, Remember device, Sign in; links for Forgot password, Contact support, Security info.
2. **MFA screen (`/auth/admin/mfa`)** — 6-digit OTP (auto-focus, auto-paste, countdown, resend), method tabs (Authenticator / SMS / Email / Recovery), "Trust this device" toggle. Verification is mocked in Phase 1 (any 6 digits ⇒ success) and clearly noted; real TOTP enrollment ships in Phase 4.
3. **Admin Shell** — collapsible sidebar (desktop) + mobile drawer, top bar with search trigger (⌘K), notifications bell, profile menu.
4. **Dashboard Home (`/_authenticated/admin/`)** — KPI grid (Users, Active, Revenue, Orders, Conversions, Growth) with animated counters + sparklines, Revenue Trends area chart, Recent Orders table, Recent Signups list. Uses `recharts` (already a common dep; will install if missing).
5. **Stub routes** for the other modules so the sidebar links work and route-not-found never fires: each renders the shell with a "Coming in next phase" empty state.

## Phase 2 — Analytics, Users, Roles & Permissions
Real charts (revenue, growth, funnels, geo), Users data table with filters/search/actions, Roles matrix UI backed by `user_roles` table.

## Phase 3 — Content, Orders, Products, Inventory, Reviews, Categories
CMS-style list/detail screens, media manager, publish workflow.

## Phase 4 — Security Center, MFA enrollment (real TOTP), Audit Logs, Notifications, System Monitoring, Settings, Profile, Integrations
Server functions, database tables (`audit_logs`, `admin_notifications`, `admin_sessions`, `mfa_factors`), RLS, real auth flows.

---

## Phase 1 — files to create/edit

**New components**
- `src/components/admin/admin-auth-layout.tsx`
- `src/components/admin/mfa-input.tsx`
- `src/components/admin/admin-shell.tsx`
- `src/components/admin/admin-sidebar.tsx`
- `src/components/admin/admin-topbar.tsx`
- `src/components/admin/command-palette.tsx`
- `src/components/admin/kpi-card.tsx`
- `src/components/admin/section-card.tsx`
- `src/components/admin/coming-soon.tsx`

**New routes**
- `src/routes/auth.admin.mfa.tsx`
- `src/routes/_authenticated/admin.index.tsx` (dashboard home)
- Stub routes: `admin.analytics.tsx`, `admin.users.tsx`, `admin.orders.tsx`, `admin.products.tsx`, `admin.content.tsx`, `admin.categories.tsx`, `admin.inventory.tsx`, `admin.reviews.tsx`, `admin.notifications.tsx`, `admin.reports.tsx`, `admin.roles.tsx`, `admin.security.tsx`, `admin.audit.tsx`, `admin.integrations.tsx`, `admin.settings.tsx`, `admin.profile.tsx`

**Edits**
- `src/routes/auth.admin.tsx` — replace with new two-panel layout; on submit, route to `/auth/admin/mfa`.
- `src/routes/_authenticated/admin.tsx` — convert from current single page into the AdminShell layout that renders `<Outlet />`; move existing admin content into `admin.index.tsx`.

**Mock data**
- `src/data/admin/kpis.ts`, `src/data/admin/revenue.ts`, `src/data/admin/recent.ts`

**Deps**
- `recharts` (if not installed), `framer-motion` (already present).

---

## What I need from you

1. Confirm I should proceed with **Phase 1 only** in this turn (auth + MFA + shell + dashboard home + stubs), then continue phases on request.
2. Confirm Phase 1 MFA can be **UI-only / mocked** (any 6 digits passes) with real TOTP/SMS coming in Phase 4 — implementing real MFA requires database tables and an MFA provider decision.
3. Confirm KPIs/orders/users in Phase 1 use **mock fixtures** for demo, with real Supabase wiring in later phases.
