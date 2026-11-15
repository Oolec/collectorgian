# Collector Gian — Pokémon TCG site

Static site (HTML/CSS/JS, no build step). Hosted on Cloudflare Pages.

## Updating content
Everything on the site comes from **`data.json`** — edit it on GitHub and the site redeploys automatically.

- **listings** — `category`: `Singles` | `Graded` | `Sealed`; `status`: `Available` | `Pending` | `Sold`;
  `type` sets the card color (`fire`, `water`, `grass`, `electric`, `psychic`, `dark`, `dragon`).
  Add a photo by uploading it to `/images` and setting `"image": "images/your-card.jpg"`.
- **deals** — `kind`: `Bought` | `Sold` | `Traded`, `date` as `YYYY-MM-DD`.
- **events** — past events move to "Past Shows" automatically. Use `end` for multi-day events.
- **wantlist**, **faq**, **stats**, **profile** — plain text.

## Cloudflare Pages
Framework preset: None · Build command: (blank) · Output directory: `/`
