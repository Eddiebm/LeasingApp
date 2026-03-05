# Stripe webhook

The Stripe webhook at `POST /api/webhooks/stripe` **must run in a Node.js environment** so the raw request body is available for signature verification. It uses `config.api.bodyParser: false` and reads the body stream.

## Deployments

- **Vercel / Node serverless:** The route runs in Node by default; no extra config. Set `STRIPE_WEBHOOK_SECRET` and point Stripe to `https://your-domain.com/api/webhooks/stripe`.
- **Cloudflare Pages / Edge:** The Next.js API route may be run on Edge where raw body handling differs. To avoid flaky verification:
  1. Use a **separate Node endpoint** (e.g. a small Vercel serverless function or another host) that receives Stripe events and forwards them or replicates the logic, or
  2. Deploy the app to a Node-capable host (e.g. Vercel) so this route runs in Node.

## Events handled

- `payment_intent.succeeded`  
  - Updates `payments.status` to `paid` and `paid_at`.  
  - If `payment_type === 'screening_fee'`, runs tenant screening and updates the application (`credit_score`, `background_result`).

- `customer.subscription.updated` / `customer.subscription.deleted` (SaaS billing)  
  - Looks up landlord by `stripe_customer_id` and updates `landlords.subscription_status` and `subscription_current_period_end`.

## Local testing

Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the CLI’s signing secret.
