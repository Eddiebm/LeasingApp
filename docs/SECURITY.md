# Security overview

Summary of how the app handles auth, data, and APIs, plus known risks and recommendations.

---

## What’s in good shape

- **Dashboard auth**  
  `/dashboard/*` (except login/signup) is protected by the layout: `supabase.auth.getSession()` and redirect to login; `/api/dashboard/me` and other dashboard APIs use `getLandlordOrAdmin(req)` and return 401 when unauthenticated or not landlord/admin.

- **Landlord-scoped APIs**  
  Properties, applications, maintenance, billing, settings, onboarding, bulk CSV: all use `getLandlordOrAdmin()` and (where needed) RLS or `createSupabaseForUser(token)` so landlords only see their own data. Admin path uses `getAdminClient()` only after role check.

- **Stripe webhooks**  
  `POST /api/webhooks/stripe` verifies the `Stripe-Signature` header with `STRIPE_WEBHOOK_SECRET` (HMAC) and rejects invalid signatures. Do not skip this; use a Node/raw-body capable host if your runtime strips the body.

- **Secrets**  
  Supabase service role, Stripe secret, OpenAI key, Resend: read from env (and on Cloudflare from `getRequestContext().env`), not committed. Publishable Stripe key is public by design.

- **Download / sign tokens**  
  Document download and lease-download flows use UUID tokens in the DB; fulfill endpoints check payment (Stripe session) before returning content. Lease sign links use either application UUID or a long random `lease_sign_token`; both are “possession of link” as auth.

- **Tenant portal**  
  `/api/tenant/me` requires `applicationId` + `email` and checks that the email matches the application’s tenant before returning data (knowledge-based auth).

- **RLS**  
  Migrations enable RLS on landlords, properties, applications, etc. Service role bypasses RLS; anon/user clients are constrained by policies.

---

## Critical: fix soon

### 1. **`POST /api/request-data` — unauthenticated data export**

- **Issue:** The handler accepts an email in the body and returns **full PII** (name, email, phone, DOB, applications, documents) for that email. There is no proof that the caller owns that email (e.g. no email verification, no signed link).
- **Risk:** Anyone can call the API with any email and receive that person’s data (GDPR/privacy breach and abuse).
- **Recommendation:**  
  - Do **not** return the data in the API response.  
  - Send an email to the given address with a **one-time, time-limited link** (e.g. token in `request_data_tokens` table).  
  - A GET endpoint that accepts that token (and only that token) can then return or serve the export (and invalidate the token after use).  
  - Optionally add a CAPTCHA or rate limit on the “request my data” form to reduce enumeration.

### 2. **Public AI endpoints — cost and abuse**

- **Endpoints:**  
  - `POST /api/documents/chat`  
  - `POST /api/documents/generate`  
  - `POST /api/generate-eviction-notice`  
  - `POST /api/generate-lease` (and any other public doc-gen that calls OpenAI)
- **Issue:** No authentication or rate limiting. Anyone can send requests and consume OpenAI (and server) resources.
- **Recommendation:**  
  - Add **rate limiting** per IP (and optionally per session/cookie) with a low ceiling (e.g. 10–20 requests per minute per IP).  
  - Optionally require sign-in or a lightweight “session” (e.g. cookie) for document generation so you can rate limit or cap per user.  
  - Keep Stripe paywall for actual document download; rate limiting protects the lead-up steps.

---

## Important: improve when you can

### 3. **Stripe webhook secret on Cloudflare**

- Webhook handler uses `process.env.STRIPE_WEBHOOK_SECRET`. On Cloudflare Pages/Edge, build-time env can be missing; runtime env is in `getRequestContext().env`. If webhooks run on CF, read the secret from `(getRequestContext().env as Record<string, string>).STRIPE_WEBHOOK_SECRET` (and fallback to `process.env` for local/Node).

### 4. **Lease sign token = application id in one path**

- In `applications/[id].ts`, when a lease is generated on approve, `lease_sign_token` is set to the application `id`. So “sign lease” can be done with the application UUID. That’s acceptable only if you treat the application UUID as a secret link (not guessable). Prefer a separate random token (e.g. from `generate-document.ts`) so the sign link is not the same as the application id.

### 5. **Tenant “me” and “request data”**

- `/api/tenant/me` uses `applicationId` + `email`; anyone who knows both can read that application’s data. That’s acceptable for a “tenant portal” link sent by email; avoid exposing application IDs in URLs that are guessable or enumerable.
- Once request-data is fixed (email-based one-time link), document that “request my data” does not return data in the browser; it sends an email with a secure link.

### 6. **CORS and origin**

- Document checkout builds redirect URLs from `req.headers.origin || req.headers.referer`. Ensure in production you only allow known origins (e.g. your app domain) so Stripe success/cancel URLs cannot be pointed at an attacker’s site. Optionally validate origin in the handler.

### 7. **File upload (CSV, images)**

- Bulk CSV: validated and inserted server-side; landlord id comes from `getLandlordOrAdmin`. Ensure max rows and request size (e.g. 1–2 MB) to avoid DoS.
- Maintenance images: check file type and size; storage path should use UUIDs or non-guessable names. No user-supplied path.

---

## Checklist (quick reference)

| Area | Status | Action |
|------|--------|--------|
| Dashboard + landlord APIs | OK | Keep using `getLandlordOrAdmin` and RLS. |
| Stripe webhook | OK | Verify signature; use runtime env on CF. |
| Request-data API | Critical | Don’t return PII by email; use one-time link. |
| Documents/chat + generate | Critical | Add rate limiting (and optionally auth). |
| Download/fulfill tokens | OK | UUID + payment check. |
| Tenant me | OK | applicationId + email match. |
| Lease sign token | Improve | Prefer random token, not application id. |
| Secrets | OK | Env only; CF via `getRequestContext().env`. |
| RLS | OK | Enabled; service role for server writes. |

---

## Where auth lives

- **Landlord/dashboard:** `lib/apiAuth.ts` — `getLandlordOrAdmin(req)` (Bearer token from Supabase session); `getAdminClient()` only after role check.
- **Tenant portal:** `applicationId` + `email` in query/body; server checks tenant email matches application.
- **Sign lease:** Token in URL (application id or `lease_sign_token`); possession of link.
- **Document download:** Token in URL; DB + Stripe payment check in fulfill.
- **Public (no auth):** Apply flow, report, pay, documents chat/generate, request-data, generate-lease, generate-eviction-notice. Of these, request-data and AI endpoints need the fixes above.

If you add new APIs, decide up front: authenticated (dashboard/landlord vs tenant vs admin) or public; if public, add rate limiting and avoid returning PII without proof of identity.
