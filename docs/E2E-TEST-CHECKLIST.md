# End-to-End Test Checklist

Use this checklist to verify core flows on rentlease.app (or local/staging). Run through in order where flows depend on previous steps.

---

## Landlord Onboarding

- [ ] Go to `/dashboard/signup`
- [ ] Sign up with a test email and password
- [ ] Verify onboarding creates a `landlords` row in Supabase
- [ ] Set company name and slug (e.g. `test-landlord`)
- [ ] Verify apply link works: `/apply/test-landlord`

---

## Property Management

- [ ] Add a property from the dashboard
- [ ] Verify property appears in `/api/properties?slug=test-landlord` (or dashboard properties list)
- [ ] Verify property appears on `/apply/test-landlord`

---

## Tenant Application Flow

- [ ] Go to `/apply/test-landlord`
- [ ] Submit a test application with all required fields
- [ ] Verify application appears in dashboard
- [ ] Verify confirmation email is sent to tenant (check `RESEND_API_KEY` is set)

---

## Application Approval

- [ ] Approve the test application from dashboard
- [ ] Verify status updates to `"approved"`
- [ ] Verify tenant receives approval notification

---

## Lease Generation

- [ ] Generate a lease for the approved application
- [ ] Verify PDF is generated correctly
- [ ] Send lease to tenant for signing

---

## Lease Signing

- [ ] Go to `/sign-lease?applicationId=...&email=...` (use real IDs from the application)
- [ ] Sign the lease
- [ ] Verify `signed_at` timestamp is recorded (e.g. in Supabase or dashboard)

---

## Rent Payment

- [ ] Go to `/pay?applicationId=...&email=...`
- [ ] Complete test payment with Stripe test card: `4242 4242 4242 4242`
- [ ] Verify payment recorded in Supabase

---

## Maintenance Request

- [ ] Go to `/report`
- [ ] Submit a maintenance request
- [ ] Verify it appears in dashboard

---

## Legal Tools

- [ ] Go to `/generate-lease`
- [ ] Complete the form for a UK AST (England & Wales, property details, landlord, tenant, etc.)
- [ ] Verify AI generates a complete lease (preview + clause count)
- [ ] Test the payment flow (Download Full Lease — £15 / $18)
- [ ] Go to `/eviction`
- [ ] Complete the questionnaire for a Section 8 notice (UK, rent arrears, etc.)
- [ ] Verify AI generates the correct notice type and document

---

## Known Issues / Env to Check

- [ ] `OPENAI_API_KEY` set in Cloudflare Pages env vars
- [ ] `RESEND_API_KEY` set in Cloudflare Pages env vars
- [ ] `STRIPE_SECRET_KEY` set in Cloudflare Pages env vars
- [ ] `STRIPE_WEBHOOK_SECRET` set in Cloudflare Pages env vars
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Cloudflare Pages env vars
