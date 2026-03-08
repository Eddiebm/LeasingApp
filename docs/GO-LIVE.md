# Go live checklist

Do these in order. Everything under **You do (dashboards)** requires your Supabase / Stripe / Vercel (or Cloudflare) accounts.

---

## 1. Database (Supabase)

**In Supabase → SQL Editor**, run in this order (copy/paste each file’s contents):

1. `database/schema.sql` (if not already run)
2. `database/migrations/001_maintenance_and_audit.sql`
3. `database/migrations/002_payments_lease_esign.sql`
4. `database/migrations/003_multi_tenancy.sql` (or `003_tables_only.sql` then `003_multi_tenancy.sql`)
5. `database/migrations/004_landlord_slug.sql`
6. `database/migrations/005_billing.sql`
7. `database/migrations/006_payment_type.sql`

**Storage:** Supabase → **Storage** → **New bucket** → name: `documents`, set to **Public**. Create it.

---

## 2. First admin user

1. Open your app (local or deployed) and go to **`/dashboard/signup`**. Sign up with the email you want as admin.
2. In **Supabase → Authentication → Users**, find that user and copy their **UID**.
3. In **Supabase → SQL Editor**, run (replace `USER_UUID` with the UID):

```sql
insert into user_roles (user_id, role)
values ('USER_UUID', 'admin')
on conflict (user_id) do update set role = 'admin';
```

---

## 3. Stripe

**Products & prices**

- Create a **Product** (e.g. “Leasing subscription”) and a **Price** (recurring or one-time). Copy the **Price ID** (starts with `price_`). You’ll set it as `STRIPE_SUBSCRIPTION_PRICE_ID`.

**Webhook (required for payments and billing)**

- The webhook **must** run in a **Node** environment (see `docs/WEBHOOK.md`). Easiest: deploy the app to **Vercel** (see step 5); then the webhook runs on Node.
- In **Stripe Dashboard → Developers → Webhooks → Add endpoint**:
  - **URL:** `https://your-production-domain.com/api/webhooks/stripe` (use your Vercel URL after deploy)
  - **Events:** `payment_intent.succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the **Signing secret** (starts with `whsec_`). Set it as `STRIPE_WEBHOOK_SECRET` in your host.

---

## 4. Environment variables

Set these in **Vercel** (Project → Settings → Environment Variables) or **Cloudflare Pages** (Settings → Environment variables). Use **Production** (and Preview if you want).

**Required**

| Variable | Example / note |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page, “service_role” (secret) |

**Payments & billing**

| Variable | Example / note |
|----------|-----------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from webhook endpoint |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | `price_...` for landlord billing |

**Email**

| Variable | Example / note |
|----------|-----------------|
| `RESEND_API_KEY` | From Resend dashboard |
| `EMAIL_FROM` | `RentLease <noreply@yourdomain.com>` |
| `LANDLORD_EMAIL` | (Optional) Where to email new application alerts |

**Optional**

- `SCREENING_FEE_CENTS` – default 3500 ($35)
- `DASHBOARD_STAFF_EMAILS` – comma-separated emails for legacy staff access
- `CHECKR_API_KEY` / `RENTPREP_API_KEY` – real screening (otherwise mocked)

See **ENV.md** for full list.

---

## 5. Deploy

**Option A – Vercel (recommended so the Stripe webhook runs on Node)**

1. Install Vercel CLI if needed: `npm i -g vercel`
2. In the project root: `vercel` (link the project) then `vercel --prod`
3. Set all env vars in Vercel (step 4). Redeploy if you add vars after first deploy.
4. Point Stripe webhook URL to `https://your-vercel-url.vercel.app/api/webhooks/stripe`.

**Option B – Cloudflare Pages**

1. Deploy via your existing flow (e.g. `npm run deploy` or GitHub Actions).
2. The Stripe webhook on CF may not get a raw body. Use a **separate Node endpoint** (e.g. a small Vercel serverless function) that receives Stripe events and calls your API or DB; see **docs/WEBHOOK.md**.

---

## 6. Smoke test

- [ ] Visit `/dashboard` and sign in as the admin user.
- [ ] Go to **Settings** and set company name and **slug** (e.g. `rentlease`). Save.
- [ ] Open **`/apply/<your-slug>`** in an incognito window; confirm the application form loads.
- [ ] Submit a test application; check that you get a confirmation (and optional email).
- [ ] In the dashboard, open the application and approve it; check that the tenant gets the sign-lease email (if Resend is set).
- [ ] (Optional) **Dashboard → Billing**: start a subscription and confirm webhook updates the landlord row.

---

## Done

Once the checklist is complete, you’re live. For runbooks and screening details see **RUNBOOK.md** and **SCREENING.md**.
