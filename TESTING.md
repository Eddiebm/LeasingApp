# Testing checklist

Use this after deploy or locally to verify core flows.

## 1. Apply

- Open **Apply** (e.g. `/apply`).
- Complete the form (name, email, phone, DOB, property if any, income, landlord, etc.) and submit.
- You should get a success message and an **application ID**. (If Resend is configured, a confirmation email is sent.)
- Note the application ID and email for the portal and pay tests.

## 2. Upload documents (optional)

- Go to `/apply/documents?applicationId=<your-application-id>`.
- Upload at least one document (ID, paystub, or other). Confirm it appears in the list.

## 3. Dashboard

- Go to **Dashboard** (`/dashboard`). You should be redirected to **Dashboard login** (`/dashboard/login`).
- Sign in with a Supabase user (create one in Supabase Auth if needed). If `DASHBOARD_STAFF_EMAILS` is set, use one of those emails.
- You should see the dashboard with **Applications** and **Maintenance requests**.
- **Property filter:** If you have properties, use the dropdown and confirm the lists filter.
- **Application:** Find your test application. Use **Approve** or **Reject** and confirm the status updates.
- **Generate Lease:** Click **Generate Lease**. A PDF should download and a **Sign lease link** should appear; copy that link for the sign-lease test.
- **Export:** Click **Export** and confirm a JSON file downloads (application + status history + documents).

## 4. Tenant portal

- Open **Tenant Portal** (`/portal`).
- Enter the **email** and **application ID** from the apply step. Submit.
- Confirm you see: status, documents list, maintenance (if any), payments (if any), and signed lease link if the lease was signed.
- **Pay:** If payments are enabled, use the “Pay now” link (see below) and complete a test payment.

## 5. Sign lease

- Open the **Sign lease** link from the dashboard (e.g. `/sign-lease?token=...`). If you don’t have one, generate a lease from the dashboard first and use the link shown.
- Confirm the tenant/property info appears. Draw a signature and submit.
- You should see “Lease signed” and a link to download the signed PDF.
- In the dashboard, the sign link for that application should no longer appear (token cleared). In the portal, the signed lease PDF link should appear.

## 6. Pay

- Open **Pay** (`/pay`) or `/pay?applicationId=<your-application-id>`.
- Enter application ID and amount (e.g. 100 for $100). Click **Continue to payment**.
- Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postal code.
- Complete the flow; you should see “Payment successful.”
- If the Stripe webhook is configured and running, the payment should show as **paid** in the dashboard and in the tenant portal payments list.

## 7. Report a problem (maintenance)

- Open **Report a problem** (`/report`).
- Enter application ID and the **same email** as the application. Choose category, description, optional photo URL. Submit.
- You should get a success message and request ID. (If Resend is configured, a confirmation email is sent.)
- In the **dashboard**, the new maintenance request should appear. Change status to **In progress** then **Resolved**.
- In the **portal**, the maintenance section should list the request and its status.

## 8. Privacy

- Open **Privacy** (`/privacy`). Use **Request my data** and **Delete my data** links to hit the request-data and delete-data flows (test with a real or test application/email as needed).

## Quick smoke test (minimal)

1. Submit one application → note ID and email.  
2. Log in to dashboard → approve application → generate lease → copy sign link.  
3. Open portal with that email + ID → confirm data.  
4. Open sign-lease link → sign → confirm signed PDF.  
5. Open `/pay` with that application ID → pay with `4242...` → confirm success.
