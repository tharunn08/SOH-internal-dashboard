# Sake of Health — Internal Dashboard

Offline sales, customer CRM, product/inventory, events, feedback/follow-ups,
and analytics — for the Sake of Health team. This is **not** the public
e-commerce site; it's an internal tool for the team to use at stalls, expos,
and pop-ups.

## Architecture

```
React + TypeScript + Vite + Tailwind CSS  (Vercel hosts this — static frontend only)
              |
              v
      Supabase JS client (auth + queries + RPC)
              |
              v
   Supabase PostgreSQL (source of truth — RLS-protected)
```

No business data ever lives in `localStorage`, `sessionStorage`, or the
Vercel filesystem. Every read/write goes through Supabase. See
`supabase/migrations/0001_init.sql` for the full schema, indexes, audit
log, and Row Level Security policies, and `0002_seed.sql` for the real
product catalog plus tagged `[DEMO]` sample data you can delete before
going live.

Order creation (`create_offline_order` RPC) is a single atomic Postgres
transaction: it validates stock, creates the order + line items, decrements
inventory, logs the movement, records the payment, updates customer
segmentation, and writes an audit log entry — all or nothing. It also
accepts a client-generated `client_txn_id` so retrying a submission (e.g.
after a dropped connection at an event) never creates a duplicate order.

## 1. Set up Supabase

1. Create a project at supabase.com.
2. In the SQL Editor, run the migrations **in order**:
   `0001_init.sql` -> `0002_seed.sql` -> `0003_fix_user_trigger.sql`
   (the seed file includes demo data — delete the `do $$ ... end $$;` block
   at the bottom of that file first if you don't want sample
   customers/orders in production).
3. In **Authentication -> Users**, add your team's email/password accounts.
   The **first user to ever sign in becomes Admin** automatically; change
   other people's roles afterward from the Users page in the app.
4. Copy your **Project URL** and **anon public key** from
   **Project Settings -> API**.

> **If "Create user" in the Supabase dashboard ever fails with "Database
> error creating new user":** that means the trigger that mirrors new
> signups into `public.users` hit a problem (most commonly a leftover row
> with the same email from an earlier failed attempt). Run
> `0003_fix_user_trigger.sql` — it replaces the trigger with a version that
> upserts on email and can never block account creation, and it backfills
> any accounts that were created while the old trigger was broken.

## 2. Configure the frontend

```bash
cp .env.example .env
# edit .env and paste your Supabase URL + anon key
npm install
npm run dev
```

Never put your Supabase **service role** key in this project — only the
anon key, which is safe to expose because every table is protected by Row
Level Security.

## 3. Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. In **Project Settings -> Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. `vercel.json` is already configured to rewrite all routes to
   `index.html` so client-side routing works on page refresh.

## 4. Enable "Add User" from the dashboard (Edge Function)

Admins can create team logins directly from the **Users** page in the app,
instead of using the Supabase dashboard. This requires deploying one small
Edge Function, because creating an auth account needs the Supabase
`service_role` key — a secret that must never be shipped to the browser.

1. Install the Supabase CLI and log in:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref syjvtjgrvxjbiyqoqzeh
   ```
2. Deploy the function:
   ```bash
   supabase functions deploy create-user
   ```
3. Set your service role key as a **function secret** (Project Settings ->
   API -> `service_role` key — copy it from there, never put it in `.env`
   or anywhere in the frontend):
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
4. That's it — the Users page's **+ Add User** button now works for admins.
   It creates the login, assigns the chosen role, and logs an audit entry,
   all without ever touching a privileged key in the browser.

If you skip this step, admins can still create accounts the manual way
(Supabase Dashboard -> Authentication -> Users -> Add User), and the app
will pick up their profile automatically on first login — the **+ Add
User** button will just show an error until the function is deployed.



- `npm run dev` — local dev server
- `npm run build` — type-check + production build
- `npm run preview` — preview the production build locally

## Project structure

```
src/
  components/   UI primitives, layout, and feature-specific components
  pages/        One file per route
  services/     All Supabase data access (customers, orders, products, ...)
  hooks/        useAuth (session + role)
  types/        Domain types matching the DB schema
  utils/        Formatting, CSV export
supabase/
  migrations/   0001_init.sql (schema + RLS + RPCs), 0002_seed.sql (catalog + demo data), 0003_fix_user_trigger.sql (auth trigger fix — see below)
  functions/
    create-user/  Edge Function admins call from the Users page to create new team logins
```

## Roles

- **Admin** — full access, manages users, can permanently delete records.
- **Manager** — analytics, reports, feedback management, product edits.
- **Staff** — day-to-day: add customers, create orders, collect feedback.

Deletions are soft by default (archive + `deleted_at`); an admin can
restore archived customers. Only admins can hard-delete.

## What's stubbed vs. complete

Everything listed in the spec is implemented against the real schema and
routed in the app: Dashboard, Sales/Orders, New Order (POS flow), Customers
+ detail, Products, Inventory, Events + detail, Feedback, Follow-ups
(with WhatsApp deep links), Analytics, Reports (CSV), Users, and
Settings/Backup (full JSON backup + per-table CSV).

Not built in this pass (flagged in the original spec as optional/"if
practical"): Excel (.xlsx) export and PDF invoice generation — CSV and
print-to-PDF (via the browser's native print dialog on the Order Detail
page) cover the same need today. True offline queueing with IndexedDB +
service worker sync is also not implemented; the app currently shows clear
save-in-progress/error states and never clears a form before a confirmed
save, but a dropped connection mid-submit requires retrying manually rather
than auto-queueing. Both are straightforward additions if you need them.
