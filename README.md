# RentLease

Rental agency platform for **RentLease**: tenants submit applications, upload documents (ID, pay stubs, etc.), and complete due diligence; the leasing team reviews applications, runs screening, and generates leases and other documents.

**Link to the site:** [https://rentlease.app](https://rentlease.app) (or your [custom domain](DEPLOY.md) if configured).

## Features

- **Tenant flow:** Multi-step application, property selection, credit/background consent, then document upload (ID, paystub, bank statement).
- **Landlord dashboard:** List applications, view screening results (credit score, income), approve/reject, view uploaded documents, generate and store lease PDFs.
- **Documents:** Tenant uploads stored in Supabase Storage and linked to applications; generated leases saved to Storage and `documents` table.
- **PWA:** Installable on mobile; manifest and service worker included.
- **Deploy:** Cloudflare Pages (via `@cloudflare/next-on-pages`).

## Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS
- **Backend / DB / Storage:** Supabase (Postgres, Storage)
- **PDFs:** pdf-lib
- **Hosting:** Cloudflare Pages

## Go live

**Ready to launch?** Use the step-by-step checklist: **[docs/GO-LIVE.md](./docs/GO-LIVE.md)** (DB migrations, first admin, Stripe webhook, env vars, deploy, smoke test).

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run schema and migrations in order: see **[database/README.md](./database/README.md)** (schema → seed → `001_maintenance_and_audit.sql` → `002_payments_lease_esign.sql`).
3. In **Storage**, create a **public** bucket named `documents` (tenant uploads and generated lease PDFs).
4. Copy env vars into `.env.local` (see `.env.example` and **ENV.md**).

### 3. Environment

See **[ENV.md](./ENV.md)** for all variables and where to set them (local, GitHub, Cloudflare). Create `.env.local` with at least:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# For document uploads and saving leases to Storage
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run

```bash
npm run dev
```

- **Home:** [http://localhost:3000](http://localhost:3000)
- **Apply:** [http://localhost:3000/apply](http://localhost:3000/apply)
- **Upload documents (after applying):** `/apply/documents?applicationId=<id>`
- **Dashboard:** [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Repo

**[GitHub – RentLease.App](https://github.com/Eddiebm/LeasingApp)**

## PWA

- Manifest: `public/manifest.json`
- Service worker: `public/sw.js` (registered in production)
- Add `public/icons/icon-192.png` and `public/icons/icon-512.png` for install icons.

## Deploy (Cloudflare Pages)

**Easiest path (no build config in Cloudflare):** see **[DEPLOY.md](./DEPLOY.md)** — add 5 GitHub secrets, push to `main`, then set `nodejs_compat` once in Cloudflare.

### Deploy checklist (do in order)

1. **GitHub Secrets** (repo → Settings → Secrets and variables → Actions):  
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.  
   Optional: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `DASHBOARD_STAFF_EMAILS` (see [ENV.md](./ENV.md)).
2. **Push to `main`** – the GitHub Action builds and deploys.
3. **Cloudflare** → your Pages project → **Settings** → **Functions** → **Compatibility flags**: add **`nodejs_compat`** for **Production** and **Preview** and save. (Required or the app errors at runtime.)
4. **Cloudflare env vars** (optional for Actions): if you use Option B or want overrides, set the same vars under Pages → **Settings** → **Environment variables**.

**Stripe webhook:** The route `POST /api/webhooks/stripe` runs in Node (raw body required). See **[docs/WEBHOOK.md](./docs/WEBHOOK.md)**. On Cloudflare Pages, use a separate Node endpoint (e.g. Vercel) for the webhook. **[docs/RUNBOOK.md](./docs/RUNBOOK.md)** covers first admin, webhook URL, and migrations.

### Option A: GitHub Actions (recommended)

On push to `main`, the workflow builds and deploys. No Cloudflare build command needed.

1. **GitHub** → repo **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:
   - `CLOUDFLARE_API_TOKEN` – [Create Token](https://dash.cloudflare.com/profile/api-tokens) with “Cloudflare Pages Edit”.
   - `CLOUDFLARE_ACCOUNT_ID` – from Cloudflare Dashboard (URL or sidebar).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` – same as `.env.local`.
2. Push to `main`; the **Actions** tab runs the deploy.
3. In **Cloudflare** → Pages project → **Settings** → **Functions** → add **nodejs_compat** for Production and Preview.

### Option B: Cloudflare Git build

If you connect the repo via **Connect to Git**, Cloudflare may read `wrangler.toml` but **will not run a build** unless you set it in the dashboard. If you see **"Output directory .vercel/output/static not found"** or **"No build command specified"**, do this:

1. **Cloudflare Dashboard** → **Workers & Pages** → your project → **Settings** → **Builds & deployments**.
2. Under **Build configuration**, set:
   - **Build command:** `npm ci --legacy-peer-deps && npm run build:cloudflare`
   - **Build output directory:** `.vercel/output/static`
3. Save and **retry the deployment** (e.g. push a commit or click **Retry deployment**).

Then:

4. **Settings** → **Functions** → **Compatibility flags**: add **`nodejs_compat`** for Production and Preview.
5. **Settings** → **Environment variables**: add your env vars (Supabase, etc.).
6. Optional: **Custom domains** for your own URL.

## Screening

Screening is mocked in `lib/runScreening.ts`. To use **Checkr** or **RentPrep**:

1. Add `CHECKR_API_KEY` or `RENTPREP_API_KEY` to env.
2. In `lib/runScreening.ts`, call the provider’s API and map the response to `ScreeningResult`.

## Document types

- **Tenant uploads:** `tenant_id`, `paystub`, `bank_statement`, `other` (via `/apply/documents`).
- **Generated (cradle to exit):** From the dashboard, per application, you can generate:
  - **Cradle:** Lease/Rental Agreement, Letter of Intent (LOI), Move-in Checklist.
  - **During tenancy:** Rent Reminder, Late Rent Notice, Rent Receipt, Rental Agreement Reminder, Notice of Violation (Cure or Quit), Entry Notice (24-hour), General Notice.
  - **Exit:** Pay or Quit, Eviction Notice, Move-out Checklist, Security Deposit Disposition.
  - All are PDFs built from application/tenant/property data; optional payload (due date, amount, reason) can be sent to `POST /api/documents/generate` for notices.

## Docs

- **[DEPLOY.md](./DEPLOY.md)** – Deploy in 3 steps (GitHub Actions; no Cloudflare build config).
- **[ENV.md](./ENV.md)** – Environment variables and where to set them.
- **[database/README.md](./database/README.md)** – Schema, migrations, and storage bucket.
- **[TESTING.md](./TESTING.md)** – Step-by-step testing checklist for apply, dashboard, portal, sign-lease, pay, and maintenance.

## License

Private – RentLease.
