# Redoubt — Design Previews

Working name: **Redoubt** (not finalized). Status: **design preview stage** — static HTML/CSS/JS mockups, no backend, no real functionality beyond a couple of genuinely functional bits called out below.

## Pages

| File | What it is |
|---|---|
| `index.html` | Marketing/pitch landing page (hero, capabilities, pricing, mega-footer) |
| `welcome-screen.html` | Post-landing sign-in screen (OAuth buttons + email continue) |
| `chat-interface.html` | Post-signin AI chat UI — sidebar, conversation, connectors panel, and the `+` tools menu |
| `upgrade-plans.html` | Free vs. Pro plan comparison modal |

All files are self-contained (no build step, no dependencies) — open locally, or drag-and-drop onto Vercel/Netlify to deploy as-is.

`chat-interface.html` links to `customization.html` and `business.html`, which aren't in this pass yet — add them alongside these files when ready and the nav links will pick them up automatically.

## Chat input `+` tools menu

The chat input's `+` button opens a small popover with:

- **Add photos & files** — opens a real file picker; selected files show as removable chips above the input (images get a thumbnail preview).
- **Take screenshot** — uses the browser's `getDisplayMedia` screen-capture API to grab a real frame of whatever the user shares, and attaches it as a thumbnail chip. Falls back to a toast message if the browser doesn't support it or the user declines the permission prompt.
- **Web search** / **Research mode** — togglable mode switches; when on, they show as dismissible pills above the input (UI state only, not wired to a backend yet).
- **Connectors** — opens the existing full connectors browser modal to see and toggle the list of integrated apps (GitHub, Slack, GitLab, etc.).

## Brand system

**Theme:** light (white background).

**Colors**

| Token | Hex | Use |
|---|---|---|
| Background | `#FFFFFF` | Base page background |
| Panel | `#F6F7FA` | Cards, sidebar, raised surfaces |
| Panel 2 | `#EEF0F4` | Slightly deeper panel variant |
| Panel 3 | `#E5E8EF` | Deepest panel variant (chat input, hover states) |
| Cyan (baseline/primary) | `#1C9A8D` | Primary accent, "normal" signal, CTAs |
| Amber (warning) | `#C97F0F` | Elevated/under-review states |
| Red (alert) | `#D93B3F` | Flagged anomalies, high severity |
| Violet | `#6B5ECF` | Code/vulnerability scanning icon |
| Coral | `#E2603F` | Phishing detection icon |
| Text | `#0B1220` | Primary text |

**Typography**
- Headlines: `Space Grotesk` (600/700)
- Body: `Inter` (400/500/600)
- Data/labels/mono: `JetBrains Mono`

**Logo:** a Spartan hoplite shield with a lambda (Λ) mark, rendered in the cyan accent.

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
3. Wire the `+` menu's Web search / Research mode toggles and Connectors list to a real backend
4. Wire up DNS/IP lookup as the first real backend feature
