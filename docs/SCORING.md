# Site score (Lighthouse)

## How to run

**Option A – Chrome DevTools (easiest)**  
1. Open [https://rentlease.app](https://rentlease.app) in Chrome.  
2. DevTools → **Lighthouse** tab.  
3. Select **Performance**, **Accessibility**, **Best practices**, **SEO**.  
4. Choose **Mobile** or **Desktop**, then **Analyze page load**.

**Option B – CLI (local)**  
With Chrome installed:

```bash
npx lighthouse https://rentlease.app --view --output=html --output-path=./lighthouse-report.html
```

Open `lighthouse-report.html` in a browser to see the report.

**Option C – PageSpeed Insights**  
[https://pagespeed.web.dev/](https://pagespeed.web.dev/) → enter `https://rentlease.app` for mobile/desktop scores and suggestions.

---

## Quick checklist (from codebase)

| Area | Status | Notes |
|------|--------|--------|
| **Performance** | ✓ | Next.js, minimal JS on home; watch bundle size and images. |
| **Accessibility** | ✓ | Semantic `<main>`, `<header>`, `<h1>`; good contrast (slate on white). Add `aria-label` on icon-only buttons if any. |
| **Best practices** | ✓ | HTTPS, no deprecated APIs; PWA manifest + service worker. |
| **SEO** | ✓ | Root `title` and `description` in layout; add page-specific `metadata` on key routes (apply, dashboard, terms). |
| **PWA** | ✓ | `manifest.json`, theme/background color, icons 192/512. |

Improvements that often raise scores: compress images, add `width`/`height` to images, ensure form inputs have `<label>`s, and add a meta `og:image` for sharing.
