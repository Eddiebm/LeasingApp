# Handoff to Manus — What’s Been Done

Summary of changes and features added to the RentLease (Next.js on Cloudflare Pages, edge runtime, Supabase). Use this to bring Manus up to speed.

---

## 1. Bulk CSV Property Upload (Landlord Dashboard)

- **Location:** Dashboard “Add a property” section.
- **UI:** “Upload Properties (CSV)” opens a modal with:
  - File input (`.csv` only)
  - “Download CSV Template” (columns: `address`, `city`, `state`, `zip`, `rent`, `status`, `application_deadline`)
  - Preview table with per-row validation errors
  - “Upload All” sends only valid rows
- **Validation:** `status` = `active` | `inactive` (default `active`); `application_deadline` optional, ISO date `YYYY-MM-DD`; `rent` must be a number.
- **API:** `POST /api/properties/bulk` — body `{ properties: Array<{ address, city, state, zip, rent, status?, application_deadline? }> }`, returns `{ inserted, errors }`. Uses `getAdminClient()` from `lib/apiAuth`, landlord from `getLandlordOrAdmin(req)`.
- **Client:** CSV parsed in the browser (no library); “X properties ready to upload” shown.

---

## 2. AI Lease Generator (`/generate-lease`)

- **Flow:** Multi-step form (6 steps): Jurisdiction (UK + region or US + state) → Property details (address, type, furnished, rent/deposit with £ or $, deposit note for UK 5 weeks max) → Landlord details (name, address, email, phone) → Tenant details (up to 4, “Add another tenant”) → Special clauses → Preview & Download.
- **Step 6:** “Generating your lease with AI…” → preview of **first 3 clauses only** (rest faded) → banner “Your full lease is ready — download to get all clauses” → **Download Full Lease — £15 / $18** (Stripe one-time) and **Subscribe from £19/month** (→ `/dashboard/signup`). After payment, full document + “Download PDF”.
- **API:** `POST /api/generate-lease` — uses `getRequestContext().env` for `OPENAI_API_KEY`, builds prompt (UK AST/Scotland PRT/US state-specific), returns `{ previewClauses, clauseCount, token }`. Full lease stored in `lease_download_tokens` (migration `007`).
- **Checkout:** `POST /api/generate-lease/checkout` with `{ token }` — creates Stripe session £15 (UK) / $18 (US), stores `stripe_session_id` on row, redirects to Stripe. Success URL includes `token`.
- **Fulfill:** `GET /api/generate-lease/fulfill?token=` — verifies Stripe session paid, returns `{ leaseText, formData }`.
- **PDF:** `POST /api/generate-lease-pdf` (existing) with `leaseText` + landlord/tenant/property for PDF.

---

## 3. AI Eviction Assistant (`/eviction`)

- **Flow:** One-question-at-a-time questionnaire (UK/US, tenancy type or state, reason, rent owed, previous notice, landlord/tenant/property). Progress bar. Results: notice type, notice period, generated notice text, “What happens next” steps with “Track this step” → `/dashboard/signup`.
- **API:** `POST /api/generate-eviction-notice` — OpenAI with specialist solicitor/attorney prompt. UK: Section 8 (Form 3, grounds, notice periods), Section 21 (Form 6A, 2 months), Scotland 2016 Act. US: Pay or Quit / Cure or Quit / Unconditional Quit, state-specific. Returns `{ noticeType, noticePeriod, documentText, nextSteps }`. **Disclaimer appended at end** of document text.
- **PDF:** `POST /api/generate-eviction-pdf` with `documentText` and `noticeType`.

---

## 4. Single Conversational Tool (`/documents`)

- **Goal:** One text box, one button; no forms or dropdowns; “so simple a 5-year-old could use it.”
- **Flow:** User types situation (e.g. “I need a lease for my flat in London”) → **Generate**. Then **chat**: AI asks **one question at a time** (e.g. “Is the property in the UK or US?”, “What’s the full address?”). When it has enough info it says “I have everything I need. Generating your [lease/eviction notice] now...” and returns the document.
- **Preview:** First ~700 chars visible, rest blurred. Then paywall card:
  - **“Your document is ready”**
  - **[ Download PDF — £15 ]** (lease) or **£10** (eviction) — “One-time payment, no account”
  - **─────────── or ───────────**
  - **[ Get unlimited documents ]** — “Subscribe from £19/month” / “Includes e-signature + dashboard” → `/dashboard/signup`
- **API:** `POST /api/documents/chat` — body `{ messages, sessionId? }`. System prompt: detect document type (lease, Section 8, Section 21, Pay or Quit, Cure or Quit, rent increase), ask one question at a time, max 6–8 questions. When ready, AI returns JSON `{ ready, documentType, jurisdiction, data }`. Then **second OpenAI call** generates full document from that data. Response: `{ message, ready, documentType, documentText?, documentLabel? }`.
- **Checkout:** `POST /api/documents/checkout` — body `{ documentText, documentType }`. Inserts into `document_download_tokens` (migration `008`), creates Stripe session **£15** (lease) or **£10** (eviction), returns `{ url }`.
- **Fulfill:** `GET /api/documents/fulfill?token=` — verifies payment, returns `{ documentText, documentType }`. After payment, user sees full doc + “Download PDF” (uses `generate-eviction-pdf` with appropriate title).

---

## 5. Document Generation API (Stored Documents)

- **API:** `POST /api/documents/generate` — handler `(req: Request)`. Body: `{ documentType, jurisdiction, data }`. Uses `getRequestContext().env` for `OPENAI_API_KEY`, `getAdminClient()` for Supabase.
- **Behaviour:** Picks system prompt by `documentType` (`ast_lease`, `section_8`, `section_21`, `pay_or_quit`, `cure_or_quit`, `rent_increase`), calls OpenAI, then stores in **`generated_documents`** with `id: crypto.randomUUID()`, `expires_at: now + 24h`, `paid: false`.
- **Response:** `{ documentId, preview, documentType, fullLength }` — `preview` = first 3 sections (split `\n\n`).
- **Migration:** `009_generated_documents.sql` — table `generated_documents` (id, document_type, jurisdiction, document_text, paid, expires_at, created_at).

---

## 6. Home Page

- **Primary CTA:** “Get a lease or eviction notice” → `/documents` (plain English, no forms).
- **Secondary:** “Generate a Lease (step-by-step)” → `/generate-lease`, “Eviction notice (questionnaire)” → `/eviction`, plus Apply, Report, Dashboard, etc.

---

## 7. Technical Conventions (for Manus)

- **Edge:** All API routes use `export const runtime = "edge"`.
- **Env:** Server env only inside handlers via `(getRequestContext().env as Record<string, string>).VAR_NAME` from `@cloudflare/next-on-pages`. **Never** read secret env at module level.
- **OpenAI:** Use `fetch` to `https://api.openai.com/v1/chat/completions` (no `openai` npm package).
- **Supabase:** Use `getSupabaseServer()` (from `lib/supabaseServer`) or `getAdminClient()` (from `lib/apiAuth`) **inside** request handlers only.
- **Stripe:** Instantiate Stripe inside the handler using env (e.g. `getRequestContext().env.STRIPE_SECRET_KEY` or equivalent).

---

## 8. Migrations to Run

- `007_lease_download_tokens.sql` — lease one-time download tokens (for `/generate-lease` paywall).
- `008_document_download_tokens.sql` — document tokens for `/documents` paywall (lease/eviction).
- `009_generated_documents.sql` — stored generated documents (preview + 24h expiry).

---

## 9. Env Vars (Cloudflare Pages / Local)

- `OPENAI_API_KEY` — lease + eviction + documents chat + document generate.
- `STRIPE_SECRET_KEY` — generate-lease checkout, documents checkout.
- `STRIPE_WEBHOOK_SECRET` — if using webhooks.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase (tokens, generated_documents, etc.).
- `RESEND_API_KEY` — tenant/confirmation emails (if used).

---

## 10. E2E Test Checklist

- **File:** `docs/E2E-TEST-CHECKLIST.md` — covers landlord onboarding, properties, tenant application, approval, lease generation, lease signing, rent payment, maintenance, legal tools (generate-lease + eviction), and env vars to check.

---

## 11. Key Files (Quick Reference)

| Area | Files |
|------|--------|
| Bulk upload | `app/dashboard/page.tsx` (CSV modal + state), `pages/api/properties/bulk.ts` |
| Generate lease | `app/generate-lease/page.tsx`, `pages/api/generate-lease.ts`, `pages/api/generate-lease/checkout.ts`, `pages/api/generate-lease/fulfill.ts`, `pages/api/generate-lease-pdf.ts` |
| Eviction | `app/eviction/page.tsx`, `pages/api/generate-eviction-notice.ts`, `pages/api/generate-eviction-pdf.ts` |
| Documents (chat) | `app/documents/page.tsx`, `pages/api/documents/chat.ts`, `pages/api/documents/checkout.ts`, `pages/api/documents/fulfill.ts` |
| Document generate | `pages/api/documents/generate.ts` |
| PDF from text | `lib/pdfFromText.ts` (lease + notice helpers) |
| Migrations | `database/migrations/007_*.sql`, `008_*.sql`, `009_*.sql` |

---

That’s everything that’s been done that Manus should know about. Run the three migrations, ensure the env vars above are set, and use `docs/E2E-TEST-CHECKLIST.md` to verify flows.
