# Leasing App

Rental agency platform for **Bannerman Group**: tenants submit applications, upload documents (ID, pay stubs, etc.), and complete due diligence; the leasing team reviews applications, runs screening, and generates leases and other documents.

## Features

- **Tenant flow:** Multi-step application, property selection, credit/background consent, then document upload (ID, paystub, bank statement).
- **Landlord dashboard:** List applications, view screening results (credit score, income), approve/reject, view uploaded documents, generate and store lease PDFs.
- **Documents:** Tenant uploads stored in Supabase Storage and linked to applications; generated leases saved to Storage and `documents` table.
- **PWA:** Installable on mobile; manifest and service worker included.
- **Deploy:** Ready for Vercel or Cloudflare Pages.

## Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS
- **Backend / DB / Storage:** Supabase (Postgres, Storage)
- **PDFs:** pdf-lib
- **Hosting:** Vercel or Cloudflare Pages

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `database/schema.sql`, then `database/seed.sql`.
3. In **Storage**, create a **public** bucket named `documents` (tenant uploads and generated lease PDFs).
4. Copy env vars into `.env.local` (see `.env.example`).

### 3. Environment

Create `.env.local`:

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

**[GitHub – Eddiebm/LeasingApp](https://github.com/Eddiebm/LeasingApp)**

## PWA

- Manifest: `public/manifest.json`
- Service worker: `public/sw.js` (registered in production)
- Add `public/icons/icon-192.png` and `public/icons/icon-512.png` for install icons.

## Deploy (Cloudflare Pages)

1. Push to GitHub and connect the repo in Cloudflare Dashboard → Pages.
2. Build command: `npm run build` (or `npm run build:cloudflare` with `@cloudflare/next-on-pages`).
3. Set env vars in the Pages project.
4. Add custom domain (e.g. `leasing.bannermangroup.com`).

## Deploy (Vercel)

1. Import the GitHub repo in Vercel.
2. Add environment variables.
3. Deploy; optional custom domain.

## Screening

Screening is mocked in `lib/runScreening.ts`. To use **Checkr** or **RentPrep**:

1. Add `CHECKR_API_KEY` or `RENTPREP_API_KEY` to env.
2. In `lib/runScreening.ts`, call the provider’s API and map the response to `ScreeningResult`.

## Document types

- **Tenant uploads:** `tenant_id`, `paystub`, `bank_statement`, `other` (via `/apply/documents`).
- **Generated:** `lease` (via dashboard “Generate Lease”); optional LOI, move-in checklist, rent receipt can be added in `lib/` and API routes.

## License

Private – Bannerman Group.
