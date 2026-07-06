# Tower of Babylon AI — Design Previews

Working name: **Tower of Babylon AI** (short form "Babylon AI" used in the UI). Status:
**design preview stage** — mostly static HTML/CSS/JS, plus one real backend function (the
chat, see below) and a couple of other genuinely functional bits called out below.

## Pages

| File | What it is |
|---|---|
| `index.html` | Marketing/pitch landing page (hero, capabilities, pricing, mega-footer) |
| `welcome-screen.html` | Post-landing sign-in screen (Google sign-in is real once configured, see below; GitHub/Apple buttons are still decorative; email continue is real) |
| `chat-interface.html` | Post-signin AI chat UI — sidebar, conversation, connectors panel, and the `+` tools menu |
| `upgrade-plans.html` | Free vs. Pro plan comparison modal |

All files are self-contained (no build step, no dependencies) — open locally, or drag-and-drop onto Vercel/Netlify to deploy as-is.

`chat-interface.html` links to `customization.html` and `business.html`, which aren't in this pass yet — add them alongside these files when ready and the nav links will pick them up automatically.

## Chat input `+` tools menu

The chat input's `+` button opens a small popover with:

- **Add photos & files** — opens a real file picker; selected files show as removable chips above the input (images get a thumbnail preview).
- **Take screenshot** — uses the browser's `getDisplayMedia` screen-capture API to grab a real frame of whatever the user shares, and attaches it as a thumbnail chip. Falls back to a toast message if the browser doesn't support it or the user declines the permission prompt.
- **Web search** — toggle switch, shown as a dismissible pill above the input when on. Wired to a real lookup (see below); needs `TAVILY_API_KEY` to actually find anything.
- **Research mode** — same togglable pill, but still UI state only (no backend behind it yet).
- **Connectors** — opens the existing full connectors browser modal to see and toggle the list of integrated apps (GitHub, Slack, GitLab, etc.).

## Brand system

**Theme:** light, warm parchment/clay ground — a tower built from knowledge, not a cold
security console. Grounded in real Babylonian material culture (sun-baked brick, the lapis
lazuli + gold glazed brick of the Ishtar Gate) rather than a generic palette.

**Colors**

| Token | Hex | Use |
|---|---|---|
| Background | `#F5EDDC` | Base page background (parchment/sandstone) |
| Panel | `#EADFC5` | Cards, sidebar, raised surfaces |
| Panel 2 | `#E0D3AF` | Slightly deeper panel variant |
| Panel 3 | `#D4C39B` | Deepest panel variant (chat input, hover states) |
| Lapis (baseline/primary) | `#26417A` | Primary accent, "normal" signal, CTAs |
| Terracotta (warning) | `#B5502D` | Elevated/under-review states |
| Oxide red (alert) | `#9C2B2B` | Flagged anomalies, high severity |
| Amethyst | `#5B3A8C` | Code/vulnerability scanning icon |
| Clay | `#C2632E` | Phishing detection icon |
| Antique gold | `#C9962B` | Pro badge, beacon accent |
| Text | `#2B2013` | Primary text (umber-black) |

**Typography**
- Headlines: `Cinzel` (600/700) — a Roman-inscription-style serif, for a monumental/carved-stone feel
- Body: `Inter` (400/500/600)
- Data/labels/mono: `JetBrains Mono`

**Logo:** a ziggurat (stepped tower) silhouette with a small gold beacon at the apex —
imagery only, no explicit religious branding. The tower reads as a watchtower/vantage
point built up from accumulated knowledge, not the Babel story's hubris-and-collapse arc.

## Real AI answers (chat is now wired to Groq)

`chat-interface.html` opens blank and sends real messages to `api/chat.js` — a serverless
function that calls [Groq](https://groq.com)'s free-tier, OpenAI-compatible chat completions
API, running open models (Llama 3.1/3.3 for Foundation/Sentinel, a DeepSeek R1 distill for
Apex). Note: **GitHub Pages cannot run this** — it's static-only. The chat will still load
there but every message will show a "no backend here" message. Deploy to Vercel (or Netlify)
to actually get answers:

1. Get a free API key at [console.groq.com/keys](https://console.groq.com/keys).
2. Import this repo into [Vercel](https://vercel.com/new) — no build settings needed, it
   auto-detects the static site plus the `api/` function.
3. In the Vercel project's **Settings → Environment Variables**, add `GROQ_API_KEY`
   with your key. Never commit it to git or paste it into a chat — this is the only place
   it should live.
4. Redeploy. Your Vercel URL now gives real answers in `chat-interface.html`.

For local testing, copy `.env.example` to `.env.local`, fill in your key, and run
`vercel dev` (or any Node server that mounts `api/chat.js` at `/api/chat`).

Note: Groq's free tier has generous but real rate limits (requests/tokens per minute and per
day) shared across every visitor to your site, and can change without notice — if the chat
starts erroring under real traffic, check usage in the
[Groq console](https://console.groq.com) before assuming it's a code bug. Unlike the previous
Gemini backend, there's no built-in web-search grounding here — see the next section for how
that's now handled instead.

## Real web search (the "Web search" toggle)

Groq's models have no built-in equivalent to Gemini's search grounding, so live/current-event
questions get answered from training data alone unless the user turns on **Web search** in
the chat input's `+` menu. When that's on, `api/chat.js` calls
[Tavily](https://tavily.com)'s search API for the latest message, drops the top results into
the model's context, and asks it to cite sources when it uses them.

1. Get a free key at [app.tavily.com](https://app.tavily.com) — 1,000 searches/month, no card
   required.
2. In Vercel's **Settings → Environment Variables**, add `TAVILY_API_KEY` with your key.
3. Redeploy. Toggling **Web search** on now does a real lookup; leaving it off (or leaving
   the key unset) just answers from the model's own knowledge, same as before.

**Research mode** (the other toggle in the same menu) is still UI-only — no backend behind
it yet.

## Real Google sign-in

The "Continue with Google" button on `welcome-screen.html` uses Google Identity
Services' OAuth token client (popup-based, no redirect page needed) to get the user's
verified email, then feeds it into the same plan-check-and-redirect logic the email
sign-in flow uses. It needs a Client ID before it's live:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create
   (or reuse) a project, then **Credentials → Create Credentials → OAuth client ID**,
   type **Web application**.
2. Under **Authorized JavaScript origins**, add your deployed origin (e.g.
   `https://your-app.vercel.app`) and `http://localhost:3000` for local testing.
3. Copy the resulting Client ID into `GOOGLE_CLIENT_ID` near the top of the `<script>`
   block in `welcome-screen.html`. This is a public identifier, not a secret — safe to
   hand-edit directly, same as `STRIPE_PAYMENT_LINK` below.
4. Redeploy. "Continue with Google" now signs in with the real Google account email;
   until this is set, clicking it shows a toast explaining it isn't configured yet.

## Real Stripe checkout with auto-granted Pro access

There's no real user auth in this project — sign-in is email-only, no passwords. Paying
marks that email as Pro; entering the same email again unlocks it. Setup:

1. **Add a Redis store** — Vercel project → **Storage** tab → add a **Redis** integration
   (Marketplace, free tier). This auto-injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` — nothing to copy/paste yourself.
2. **Create a Payment Link** — Stripe Dashboard (start in **Test mode**) → Payment Links →
   Create link for the Pro plan. Paste the resulting public URL into `STRIPE_PAYMENT_LINK`
   in `index.html` and `upgrade-plans.html` (this is a public checkout URL, not a secret —
   safe to hand-edit directly).
3. **Add a webhook** — Stripe Dashboard → Developers → Webhooks → Add endpoint, URL
   `https://<your-vercel-domain>/api/stripe-webhook`, listening for `checkout.session.completed`
   and `customer.subscription.deleted`. Stripe shows a signing secret (`whsec_...`) once the
   endpoint is created.
4. In Vercel's **Settings → Environment Variables**, add `STRIPE_SECRET_KEY` (Stripe
   Dashboard → Developers → API keys) and `STRIPE_WEBHOOK_SECRET` (from step 3). Both are
   real secrets — env vars only, never git, never chat.
5. Redeploy. Paying via the Payment Link now marks that email Pro in Redis; entering the
   same email on the sign-in screen shows the Pro badge and unlocks the upgrade-gated UI.

`api/stripe-webhook.js` verifies Stripe's signature on every request (tested against
forged/tampered payloads — both are rejected) before writing anything, so a request can't
grant itself Pro without a genuine signed event from Stripe.

**Testing your own account as Pro** without paying: add your email to `PRO_OVERRIDE_EMAILS`
(comma-separated) in Vercel's environment variables and redeploy. Any email in that list
always resolves to Pro — no Stripe, no Redis required. It's read server-side only (`api/
_lib/plan.js`); nothing in the UI exposes or hints at it. Leave it unset in normal operation.

## Usage limits + admin email alerts

Chat requests are metered per email, per calendar month, in Redis (the same store as the
Stripe plan lookup): Free gets 50,000 tokens/month, Pro gets 2,000,000 — edit `PLAN_LIMITS`
in `api/chat.js` to change either number. Once someone hits their limit, `/api/chat` returns
a clear 403 instead of calling the model. A small ring badge in the bottom-right corner of
the chat page shows live usage (hidden until the first message, hover for the exact numbers
and percentage), color-shifting cyan → amber → red as it climbs.

Two admin notifications are wired up via [Resend](https://resend.com):
- **New Pro signup** — fires from the Stripe webhook the moment someone pays.
- **Heavy usage alert** — fires once per billing period the first time an account crosses
  80% of its plan (tracked via a flag in Redis so it won't repeat every message after).

Setup: get a key at resend.com, then in Vercel's environment variables add `RESEND_API_KEY`
and `ADMIN_EMAIL` (where alerts land). `RESEND_FROM_EMAIL` is optional — it defaults to
Resend's shared test address, which works immediately but isn't meant for real production
volume; verify your own sending domain in Resend when you're ready for that. Leaving
`RESEND_API_KEY`/`ADMIN_EMAIL` unset just skips emails silently — nothing else depends on
them.

## Explicitly out of scope (by design)

No live execution of offensive tooling (password cracking, unrestricted network scanning, SQL injection execution, site cloning). DNS/IP lookup, WHOIS, and SSL cert checking are public-data lookups and are fine to include; anything that executes against a target isn't.

## Live preview (GitHub Pages)

A workflow at `.github/workflows/pages.yml` publishes this site to GitHub Pages on every push. One-time setup (not something I can flip via git):

1. Go to **Settings → Pages** in this repo.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not "Deploy from a branch").
3. Push anything (or re-run the "Deploy static site to GitHub Pages" workflow from the **Actions** tab) — the Actions tab will show a URL like `https://<owner>.github.io/<repo>/` once it finishes.

After that, every push updates the same live URL automatically, and all the internal links (sign-in → chat → upgrade, etc.) work exactly as they do locally, since it's the same static files.

## Next steps

1. Add `business.html` and `customization.html` to complete the nav
2. Finalize the product name (domain + trademark check)
3. Wire the `+` menu's Research mode toggle into the actual chat request — it's still UI state only (Web search is now real, see below)
4. Wire up DNS/IP lookup as the first real backend feature
5. Add real Stripe checkout (see `STRIPE_PAYMENT_LINK` in `index.html` / `upgrade-plans.html`)
