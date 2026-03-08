# Environment variables

Use `.env.local` for local dev. For Cloudflare Pages, set variables in the dashboard (Settings → Environment variables) or pass them via GitHub Actions secrets (see README).

## Required (app + deploy)

| Variable | Where | Description |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Local + GitHub/CF | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local + GitHub/CF | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Local + GitHub/CF | Supabase service role key (document uploads, lease storage, server writes) |

## Optional

| Variable | Where | Description |
|----------|--------|-------------|
| `DASHBOARD_STAFF_EMAILS` | Local + CF | Comma-separated emails allowed to use the dashboard. If unset, any signed-in Supabase user can access. |
| `STRIPE_SECRET_KEY` | Local + CF (server only) | Stripe secret key for Payment Intents (rent, etc.). Read via `getRequestContext().env` on Cloudflare. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Local + GitHub/CF | Stripe publishable key for `/pay` page. |
| `STRIPE_WEBHOOK_SECRET` | Webhook host only | Stripe webhook signing secret. Use on the host that serves `POST /api/webhooks/stripe` (see README). |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Webhook host only | Stripe **Connect** webhook signing secret. Required for bank-account onboarding: Stripe sends `account.updated` to `POST /api/webhooks/stripe-connect` so the app can set `stripe_connect_onboarded`. Without this, landlords can add a bank on Stripe but the app will still show "Connect bank account". |
| `RESEND_API_KEY` | Local + CF | Resend API key for transactional email (application confirmation, landlord notification, approve/reject, maintenance ticket). Read via `(getRequestContext().env as Record<string, string>).RESEND_API_KEY` on Cloudflare. |
| `LANDLORD_EMAIL` | Local + CF | Email address to notify when a tenant submits an application. Read via `getRequestContext().env` on Cloudflare. |
| `EMAIL_FROM` | Local + CF | Sender for Resend (e.g. `RentLease <noreply@yourdomain.com>`). Defaults to Resend onboarding address. |
| `CHECKR_API_KEY` / `RENTPREP_API_KEY` | Local + CF | For real screening in `lib/runScreening.ts` (otherwise mocked) |
| `SCREENING_FEE_CENTS` | Local + CF | Screening fee in cents (tenant pays). Default 3500 ($35). |
| `STRIPE_SUBSCRIPTION_PRICE_ID` | Local + CF (server only) | Stripe Price ID for landlord SaaS subscription in GBP (e.g. `price_xxx`). Used when currency is GBP. |
| `STRIPE_SUBSCRIPTION_PRICE_ID_USD` | Local + CF (server only) | Stripe Price ID for US landlords ($24.99/month). Same product as GBP; used when currency is USD. |
| `OPENAI_API_KEY` | Local + CF (server only) | OpenAI API key for AI-generated state-specific leases and eviction notices. If set, documents generated with `stateCode` and `useAi: true` use GPT-4o-mini. Optional. |

## GitHub Actions

The deploy workflow only needs build-time vars that are baked into the output. Set these as **repository secrets**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `DASHBOARD_STAFF_EMAILS`.  
Do **not** put `STRIPE_SECRET_KEY` in the build if you don’t need it at build time; you can set it only in Cloudflare env vars so it’s available at runtime.
