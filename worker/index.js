// Collector Gian — API Worker. Serves public site data, uploaded photos and the admin API.
// Secrets: ADMIN_PASSWORD (Cloudflare dashboard → Settings → Variables and Secrets). Storage: KV binding STORE.
import seed from "../data.json";

const TYPES = ["fire", "water", "grass", "electric", "psychic", "dark", "dragon"];
const CATS = ["Singles", "Graded", "Sealed"];
const STATUS = ["Available", "Pending", "Sold"];
const KINDS = ["Bought", "Sold", "Traded"];
const IMG_TYPES = { "image/webp": 1, "image/jpeg": 1, "image/png": 1 };
const SRC = /^(\/media\/[0-9a-f-]{36}|images\/[\w.\-]+|https:\/\/[^\s"'<>\\]{1,500})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_DAYS = 7, MAX_FAILS = 5, LOCK_SECONDS = 900;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const S = (v, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const link = v => { v = S(v, 500); return /^https:\/\/[^\s"'<>\\]+$/.test(v) ? v : ""; };
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

/* ---------- data ---------- */
async function loadData(env) { return (await env.STORE.get("data", "json")) || seed; }

function legacyPhotos(l) {
  if (Array.isArray(l.photos)) return l.photos;
  return l.image ? [{ src: l.image, label: l.imageKind === "reference" ? "Reference artwork" : "Photo", reference: l.imageKind === "reference" }] : [];
}
function cleanListing(l, i) {
  const o = {
    id: Number.isFinite(+l.id) && +l.id > 0 ? +l.id : Date.now() + i,
    name: S(l.name, 120), set: S(l.set, 160),
    type: TYPES.includes(l.type) ? l.type : "electric",
    category: CATS.includes(l.category) ? l.category : "Singles",
    condition: S(l.condition, 60),
    price: Math.max(0, Math.round((+l.price || 0) * 100) / 100),
    status: STATUS.includes(l.status) ? l.status : "Available",
    verified: l.verified === true,
  };
  if (S(l.grade, 10)) o.grade = S(l.grade, 10);
  if (+l.hp > 0) o.hp = Math.round(+l.hp);
  o.photos = legacyPhotos(l).slice(0, 8)
    .map(p => ({ src: S(p && p.src, 520), label: S(p && p.label, 40) || "Photo", reference: !!(p && p.reference === true) }))
    .filter(p => SRC.test(p.src));
  return o;
}
function cleanEvent(e) {
  const o = { name: S(e.name, 120), date: DATE.test(e.date) ? e.date : "" };
  if (DATE.test(e.end) && e.end > o.date) o.end = e.end;
  for (const [k, n] of [["time", 60], ["venue", 120], ["address", 160], ["city", 80], ["table", 40], ["bringing", 300]]) if (S(e[k], n)) o[k] = S(e[k], n);
  if (link(e.link)) o.link = link(e.link);
  return o;
}
function cleanDeal(x) {
  return { title: S(x.title, 140), detail: S(x.detail, 200), kind: KINDS.includes(x.kind) ? x.kind : "Sold", date: DATE.test(x.date) ? x.date : "", type: TYPES.includes(x.type) ? x.type : "electric", verified: x.verified === true };
}
function sanitize(input, current) {
  const arr = v => (Array.isArray(v) ? v : []);
  const seen = new Set();
  const listings = arr(input.listings).slice(0, 500).map(cleanListing).filter(l => l.name).map(l => { while (seen.has(l.id)) l.id++; seen.add(l.id); return l; });
  const c = input.confirmed || {};
  return {
    profile: current.profile, gallery: current.gallery || [],
    listings,
    events: arr(input.events).slice(0, 100).map(cleanEvent).filter(e => e.name && e.date),
    deals: arr(input.deals).slice(0, 100).map(cleanDeal).filter(x => x.title && x.date),
    wantlist: arr(input.wantlist).map(v => S(v, 80)).filter(Boolean).slice(0, 30),
    faq: arr(input.faq).map(f => ({ q: S(f && f.q, 160), a: S(f && f.a, 600) })).filter(f => f.q && f.a).slice(0, 20),
    payments: arr(input.payments).map(v => S(v, 30)).filter(Boolean).slice(0, 12),
    confirmed: { wantlist: c.wantlist === true, faq: c.faq === true, payments: c.payments === true },
  };
}
// What visitors get: only listings/deals Gian has confirmed. ?demo=1 adds the sample rows, flagged as demo.
function publicView(d, demo) {
  const c = d.confirmed || {};
  return {
    demo,
    profile: d.profile, gallery: d.gallery || [], events: d.events || [],
    listings: (d.listings || []).filter(l => demo || l.verified === true).map(l => (l.verified === true ? l : { ...l, demo: true })),
    deals: (d.deals || []).filter(x => demo || x.verified === true),
    wantlist: demo || c.wantlist ? d.wantlist || [] : [],
    faq: demo || c.faq ? d.faq || [] : [],
    payments: demo || c.payments ? d.payments || [] : [],
  };
}

/* ---------- auth ---------- */
const configured = env => typeof env.ADMIN_PASSWORD === "string" && env.ADMIN_PASSWORD.length >= 10;
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(msg));
}
async function safeEqual(a, b) { // constant-time: compare fixed-length digests under a throwaway key
  const k = crypto.randomUUID();
  const [x, y] = await Promise.all([hmac(k, a), hmac(k, b)]);
  return crypto.subtle.timingSafeEqual(x, y);
}
const sessionSig = async (env, exp) => hex(await hmac(env.ADMIN_PASSWORD + ":cg-session-v1", "session:" + exp));
async function isAuthed(req, env) {
  if (!configured(env)) return false;
  const m = /(?:^|;\s*)cg_admin=(\d+)\.([0-9a-f]{64})(?:;|$)/.exec(req.headers.get("cookie") || "");
  if (!m || +m[1] < Date.now()) return false;
  return safeEqual(m[2], await sessionSig(env, m[1]));
}
const cookie = (value, maxAge) => `cg_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
function sameOrigin(req, url) { // blocks cross-site form posts / fetches
  const o = req.headers.get("origin");
  return !!o && o === url.origin;
}

async function login(req, env) {
  if (!configured(env)) return json({ error: "not_configured" }, 503);
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const failKey = "fail:" + ip;
  const fails = +(await env.STORE.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return json({ error: "locked", retryMinutes: LOCK_SECONDS / 60 }, 429);
  let body = {}; try { body = await req.json(); } catch {}
  if (!(await safeEqual(S(body.password, 300), env.ADMIN_PASSWORD))) {
    await env.STORE.put(failKey, String(fails + 1), { expirationTtl: LOCK_SECONDS });
    return json({ error: "wrong_password", attemptsLeft: MAX_FAILS - fails - 1 }, 401);
  }
  if (fails) await env.STORE.delete(failKey);
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return json({ ok: true }, 200, { "set-cookie": cookie(`${exp}.${await sessionSig(env, exp)}`, SESSION_DAYS * 86400) });
}

/* ---------- photos ---------- */
function sniff(b) { // trust the bytes, not the header
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return "";
}
async function uploadPhoto(req, env) {
  const buf = await req.arrayBuffer();
  if (buf.byteLength < 100 || buf.byteLength > 2_500_000) return json({ error: "Photo must be under 2.5 MB" }, 413);
  const type = sniff(new Uint8Array(buf, 0, 12));
  if (!IMG_TYPES[type]) return json({ error: "Only JPEG, PNG or WebP photos" }, 415);
  const id = crypto.randomUUID();
  await env.STORE.put("img:" + id, buf, { metadata: { type } });
  return json({ src: "/media/" + id });
}
async function media(id, env) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.STORE.getWithMetadata("img:" + id, "arrayBuffer");
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, { headers: { "content-type": (metadata && metadata.type) || "image/jpeg", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}

/* ---------- router ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname, m = req.method;
    try {
      if (p.startsWith("/media/") && m === "GET") return media(p.slice(7), env);
      if (!p.startsWith("/api/")) return env.ASSETS.fetch(req);

      if (p === "/api/data" && m === "GET") return json(publicView(await loadData(env), url.searchParams.get("demo") === "1"));
      if (p === "/api/session" && m === "GET") return json({ configured: configured(env), authed: await isAuthed(req, env) });

      if (m !== "GET" && !sameOrigin(req, url)) return json({ error: "Bad origin" }, 403);
      if (p === "/api/login" && m === "POST") return login(req, env);
      if (p === "/api/logout" && m === "POST") return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });

      if (p.startsWith("/api/admin/")) {
        if (!(await isAuthed(req, env))) return json({ error: "unauthorized" }, 401);
        if (p === "/api/admin/data" && m === "GET") return json(await loadData(env));
        if (p === "/api/admin/data" && m === "PUT") {
          const text = await req.text();
          if (text.length > 400_000) return json({ error: "Too much data" }, 413);
          let input; try { input = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
          const clean = sanitize(input || {}, await loadData(env));
          await env.STORE.put("data", JSON.stringify(clean));
          return json(clean);
        }
        if (p === "/api/admin/photo" && m === "POST") return uploadPhoto(req, env);
      }
      return json({ error: "Not found" }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: "Server error" }, 500);
    }
  },
};
