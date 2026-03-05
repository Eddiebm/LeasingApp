# Database

## Order of operations

1. Run **schema** and **seed** first (creates tables and optional seed data) in Supabase SQL Editor.
2. Run **migrations** either:
   - **From your machine:** Add `DATABASE_URL` to `.env.local` (Supabase → Settings → Database → Connection string → URI), then run:
     ```bash
     npm run db:migrate
     ```
   - **In Supabase:** SQL Editor → New query → paste and run `migrations/001_maintenance_and_audit.sql`, then `migrations/002_payments_lease_esign.sql`.

## Files

- **schema.sql** – Core tables: tenants, properties, applications, documents.
- **seed.sql** – Optional seed data (properties, etc.).
- **migrations/001_maintenance_and_audit.sql** – Maintenance requests, application status history, application snapshot and audit fields, `updated_at` on applications.
- **migrations/002_payments_lease_esign.sql** – Payments table (Stripe), lease e-sign fields on applications (`lease_signed_at`, `lease_signed_pdf_url`, `lease_sign_token`).

## Storage bucket

Create a **public** bucket named **`documents`** in Supabase (**Storage** in the dashboard).  
Used for: tenant uploads (ID, paystub, etc.) and generated/signed lease PDFs.  
If the bucket doesn’t exist, document uploads and lease generation will fail.

## RLS (optional)

If you enable RLS on `applications`, `documents`, or `maintenance_requests`, add policies that allow:

- Service role (server) to read/write as needed.
- Anon or authenticated access only where intended (e.g. tenant portal reads by applicationId + email match).
