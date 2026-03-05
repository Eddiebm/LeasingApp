# Runbook

## First-time setup

### 1. Database migrations

Run in **order** (Supabase SQL Editor or `npm run db:migrate` with `DATABASE_URL`):

1. Schema + seed (see database/README.md)
2. `001_maintenance_and_audit.sql`
3. `002_payments_lease_esign.sql`
4. `003_multi_tenancy.sql` (or `003_tables_only.sql` then `003_multi_tenancy.sql`)
5. `004_landlord_slug.sql`
6. `005_billing.sql`
7. `006_payment_type.sql`

Create a **public** Storage bucket named **`documents`** in Supabase.

### 2. First admin user

Admins are users with `user_roles.role = 'admin'`.

1. Have the admin user **sign up** (e.g. at `/dashboard/signup`) or ensure they exist in **Supabase Auth**.
2. In Supabase **SQL Editor**, run (replace `USER_UUID` with the user’s `auth.users.id`):

```sql
insert into user_roles (user_id, role)
values ('USER_UUID', 'admin')
on conflict (user_id) do update set role = 'admin';
```

To find `USER_UUID`: Supabase Dashboard → **Authentication** → **Users** → copy the user’s **UID**.

### 3. Stripe webhook (payments and screening)

The webhook at **`POST /api/webhooks/stripe`** must run in a **Node.js** environment (raw body required for signature verification). See **docs/WEBHOOK.md**.

1. **Local:** Use Stripe CLI:  
   `stripe listen --forward-to localhost:3000/api/webhooks/stripe`  
   Set `STRIPE_WEBHOOK_SECRET` to the CLI’s signing secret.
2. **Production (Vercel / Node):** Point Stripe to  
   `https://your-domain.com/api/webhooks/stripe`  
   and set `STRIPE_WEBHOOK_SECRET` to the webhook’s signing secret from the Stripe Dashboard.
3. **Production (Cloudflare Pages):** This route may run on Edge where raw body handling can fail. Use a **separate Node endpoint** (e.g. Vercel serverless) for the webhook and set the secret there; see README and WEBHOOK.md.

In Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**, select (at least):

- `payment_intent.succeeded` (mark payments paid, trigger screening for screening_fee)
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 4. Environment variables

See **ENV.md**. Minimum for app: Supabase URL and keys. For payments: Stripe keys and webhook secret. For SaaS billing: `STRIPE_SUBSCRIPTION_PRICE_ID`. For emails: Resend key and `EMAIL_FROM`.

## Common tasks

- **New landlord:** They sign up at `/dashboard/signup`, complete onboarding (name, company, slug), then use the dashboard and apply link.
- **Screening:** Tenant pays screening fee on `/apply/screening-payment`; when Stripe fires `payment_intent.succeeded`, the webhook marks the payment paid and runs screening (mock or real if keys set).
- **Billing:** Landlords subscribe from **Dashboard → Billing**. Ensure a Stripe Price exists and `STRIPE_SUBSCRIPTION_PRICE_ID` is set.
