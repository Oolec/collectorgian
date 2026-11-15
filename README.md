# Collector Gian — Pokémon TCG seller site

Live: https://collectorgian.alecslodarz.workers.dev · Admin: `/admin/`

A Cloudflare Worker with static assets. Every push to `main` redeploys automatically.

```
public/            the website (index.html, app.js, styles.css, images/, admin/)
worker/index.js    API: public data, photo storage, admin login + saving
data.json          starter ("seed") content — used only until the first save from the admin page
wrangler.jsonc     Cloudflare config (KV storage binding)
```

## One-time setup: admin password

The admin page stays locked (it shows setup steps) until a password exists as a Cloudflare **secret**. It is never stored in this repo or in any frontend code.

1. Cloudflare dashboard → **Workers & Pages** → **collectorgian** → **Settings** → **Variables and Secrets** → **Add**
2. Type **Secret**, name `ADMIN_PASSWORD`, value = a password of at least 10 characters → **Deploy**
3. Open `/admin/` and log in.

To change the password, edit that secret; everyone is logged out automatically. Five wrong tries locks logins from that network for 15 minutes.

## How Gian manages the site (from his phone)

Go to `/admin/` (there's a "Seller login" link in the site footer). Changes save automatically and appear on the site right away.

- **Listings** — change a price, set Available / Pending / Sold, or tick **Live on site** straight from the list. **Edit** opens everything else, including photos. **+ Add listing** creates a new one.
- **Photos** — add front, back and closeup shots from the camera roll; the first photo is the cover. A photo labelled **Reference artwork** is shown to buyers as "not a photo of Gian's actual copy".
- **Shows** — date, hours, venue, address, city, table number, and a short "what I'm bringing" preview. Blank fields are simply not shown.
- **Deals** and **Site info** (want list, payment methods, FAQ) — hidden from the site until ticked to show.

### Demo rows
The starter listings, prices, grades and deals are sample data. They are marked **DEMO · HIDDEN** in the admin and are **not** on the live site. For each one: correct it and tick **Live on site**, or delete it. To preview the site with the samples (clearly bannered), open `/?demo`.

## Where data lives

- Listings, shows, deals and site info: Cloudflare KV namespace `collectorgian-store`, key `data`.
- Uploaded photos: same namespace, keys `img:<id>`, served at `/media/<id>`. Photos are shrunk on the phone before upload (max 1500px).
- `data.json` has the same shape and is still the fallback if KV is empty, but **after the first admin save, editing `data.json` no longer changes the live site** — use the admin page. (To start over from `data.json`, delete the `data` key in the KV namespace.)
- Backup: while logged in, open `/api/admin/data` to download the full JSON.
- Logo, gallery photos and Instagram links are in `data.json` → `profile` / `gallery` and `public/images/`.

### `data.json` shape (listings)
```json
{ "id": 1, "name": "…", "set": "…", "category": "Singles | Graded | Sealed", "type": "fire | water | grass | electric | psychic | dark | dragon",
  "condition": "…", "grade": "10", "price": 85, "status": "Available | Pending | Sold", "verified": false,
  "photos": [{ "src": "images/x.webp", "label": "Front", "reference": false }] }
```
The older single-image form (`"image": "…", "imageKind": "reference"`) is still read.

## Local development
```
npm install
echo 'ADMIN_PASSWORD=some-long-test-password' > .dev.vars
npm run dev
```
