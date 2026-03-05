# Database

## Order of operations

1. Run **schema** and **seed** first (creates tables and optional seed data) in Supabase SQL Editor.
2. Run **migrations** in order (Supabase SQL Editor or `npm run db:migrate` with `DATABASE_URL` in `.env.local`):
   - `001_maintenance_and_audit.sql`
   - `002_payments_lease_esign.sql`
   - `003_multi_tenancy.sql` (or run `003_tables_only.sql` first, then `003_multi_tenancy.sql`) — multi-tenant RLS
   - `004_landlord_slug.sql` — optional slug for public apply URLs (`/apply/<slug>`)
   - `005_billing.sql` — SaaS billing fields on landlords (optional)
   - `006_payment_type.sql` — `payments.payment_type` (e.g. screening_fee)

## Files

- **schema.sql** – Core tables: tenants, properties, applications, documents.
- **seed.sql** – Optional seed data (properties, etc.).
- **migrations/001_maintenance_and_audit.sql** – Maintenance requests, application status history, application snapshot and audit fields, `updated_at` on applications.
- **migrations/002_payments_lease_esign.sql** – Payments table (Stripe), lease e-sign fields on applications.
- **migrations/003_multi_tenancy.sql** – Landlords, user_roles, RLS (run after 001 and 002).
- **migrations/004_landlord_slug.sql** – `landlords.slug` for SaaS public apply URLs.
- **migrations/005_billing.sql** – Billing fields on landlords.
- **migrations/006_payment_type.sql** – `payments.payment_type` for screening fee vs rent.

## Storage bucket

Create a **public** bucket named **`documents`** in Supabase (**Storage** in the dashboard).  
Used for: tenant uploads (ID, paystub, etc.) and generated/signed lease PDFs.  
If the bucket doesn’t exist, document uploads and lease generation will fail.

## RLS (optional)

If you enable RLS on `applications`, `documents`, or `maintenance_requests`, add policies that allow:

- Service role (server) to read/write as needed.
- Anon or authenticated access only where intended (e.g. tenant portal reads by applicationId + email match).
