# Deploy in 3 steps (no Cloudflare build config)

Use **GitHub Actions** so the build runs in CI. You never set a build command in Cloudflare.

## 1. GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:

| Secret | Where to get it |
|--------|------------------|
| `CLOUDFLARE_API_TOKEN` | [Cloudflare](https://dash.cloudflare.com/profile/api-tokens) → Create Token → “Cloudflare Pages Edit” |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard URL or sidebar |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (service_role, not anon) |

## 2. Push to main

```bash
git push origin main
```

Then open the repo **Actions** tab and watch the “Deploy to Cloudflare Pages” workflow. When it’s green, the app is live.

## 3. Cloudflare (one-time)

In **Cloudflare** → your Pages project → **Settings** → **Functions** → **Compatibility flags**: add **`nodejs_compat`** for **Production** and **Preview** and save. Without this, the app will error at runtime.

---

**Live URL:** `https://leasingapp.pages.dev` (or your custom domain if you added one).
