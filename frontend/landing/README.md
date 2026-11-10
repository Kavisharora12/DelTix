# DelTix landing page

The public marketing page for DelTix (Screen 1 in [`../docs.md`](../docs.md)). It's plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Files

| File | What it holds |
| :--- | :--- |
| `index.html` | Page markup: nav, hero, product dashboard, product tour, use cases, guardrails, developers, FAQ, footer |
| `styles.css` | All styles: design tokens at the top, then each section, then breakpoints |
| `app.js` | Dropdowns, mobile menu, product tour, code tabs, mockup scaling, sign-in links |
| `config.js` | **The only file you need to edit before you deploy**: API URL, docs URL, emails |
| `favicon.svg` | Browser tab icon |

## Run it locally

Serve the **repo root** so the documentation links (`../../docs/...`) resolve:

```bash
cd DelTix
python3 -m http.server 3000
```

Then open http://localhost:3000/frontend/landing/

Port 3000 is already in `GATEWAY_CORS_ORIGINS` in `.env.example`. Opening `index.html` straight from disk also works, but the docs links will open raw files.

## Configure

Edit `config.js`:

```js
window.DELTIX_CONFIG = {
  apiBase: "http://localhost:8080",   // API gateway (backend/api-gateway)
  docsBase: "../..",                  // or "https://github.com/<org>/DelTix/blob/main"
  demoEmail: "demo@deltix.example",   // replace before going public
  contactEmail: "hello@deltix.example"
};
```

## How sign-in works

Every "Get started" and "Sign in" button, plus the email form, goes to:

```
{apiBase}/v1/auth/google/login?tenant_id=<id>&redirect=true
```

- `redirect=true` makes the gateway send the browser to Google instead of returning JSON.
- `tenant_id` is required by `HandleGoogleLogin`. The gateway creates the tenant on callback (`UpsertTenantAndUser`). The page picks it like this:
  - If the visitor typed a company email, it's `ws_<domain>`, for example `ws_acme-com`, so colleagues share a workspace.
  - Otherwise it's a random `ws_xxxxxxxxxxxx`, saved in `localStorage` so the same browser keeps the same workspace.
- The email itself is never sent anywhere.

## Sections

1. Announcement bar
2. Sticky nav with Product and Use cases dropdowns. Under 1100px it becomes a full-screen menu.
3. Hero with an email sign-up and a full dashboard mockup (Screen 2), with floating "Math verified" and "Approval needed" cards
4. "Built on" row: PayPal, Gemini, LangGraph, Supabase, PostgreSQL, Redis, Go. Logos come from [Simple Icons](https://simpleicons.org) via jsDelivr.
5. How it works: Describe, Test, Approve, Audit
6. Product tour: click between Compiler Studio, Live sandbox, Approval gate and Audit ledger (Screens 3–6)
7. Use cases: refunds, vendor payouts, chargeback defense
8. Six guardrails
9. Developers: Agent IR JSON and a `curl` example
10. FAQ, closing call to action, footer

The app mockups are drawn at a fixed size (1200×700 and 880×560) and scaled to fit their container in `app.js`, so they stay sharp on phones.

## External requests

- Google Fonts: Schibsted Grotesk and JetBrains Mono
- jsDelivr: `simple-icons@13.0.0` brand SVGs

## Before going public

- [ ] Set `apiBase` to the deployed gateway and add the site's origin to `GATEWAY_CORS_ORIGINS`
- [ ] Set `docsBase` to the public repo or docs site
- [ ] Replace the `.example` email addresses
- [ ] Add Privacy and Terms pages and link them in the footer
- [ ] Replace the sample numbers in the dashboard mockups if you want real figures
- [ ] `HandleGoogleCallback` currently returns JSON. Redirect it to the dashboard once one exists.
