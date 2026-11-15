// Collector Gian admin. Talks to the Worker API; the session lives in an HttpOnly cookie, so there are no secrets in this file.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = "") => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CATS = ["Singles", "Graded", "Sealed"], STATUS = ["Available", "Pending", "Sold"], KINDS = ["Bought", "Sold", "Traded"];
const TYPES = ["fire", "water", "grass", "electric", "psychic", "dark", "dragon"];
const LABELS = ["Front", "Back", "Closeup", "Photo", "Reference artwork"];
const src = s => (s && s.startsWith("images/") ? "/" + s : s);

// [key, label, kind, required] — kind: text | number | date | area | url | check | status | [options]
const FIELDS = {
  listings: [["name", "Card / item name", "text", 1], ["set", "Set / details", "text"], ["status", "Status", "status"], ["price", "Price ($)", "number"], ["category", "Category", CATS], ["condition", "Condition (e.g. Near Mint, PSA 10)", "text"], ["grade", "Grade number (graded only)", "text"], ["type", "Card colour theme", TYPES], ["verified", "Show on the live site", "check"]],
  events: [["name", "Show name", "text", 1], ["date", "Date", "date", 1], ["end", "Last day (multi-day shows only)", "date"], ["time", "Hours (e.g. 10:00 AM – 5:00 PM)", "text"], ["venue", "Venue", "text"], ["address", "Street address", "text"], ["city", "City", "text"], ["table", "Table number", "text"], ["bringing", "What you're bringing (short preview)", "area"], ["link", "Event page link (https://…)", "url"]],
  deals: [["title", "What happened", "text", 1], ["detail", "Extra detail", "text"], ["kind", "Type", KINDS], ["date", "Date", "date", 1], ["verified", "Show on the live site", "check"]],
  faq: [["q", "Question", "text", 1], ["a", "Answer", "area", 1]],
};
const NAMES = { listings: "listing", events: "show", deals: "deal", faq: "question" };
const KEYOF = { listings: "name", events: "name", deals: "title", faq: "q" };

let D = null, tab = "listings", listFilter = "all", saveTimer = null, dirty = false;

/* ---------- api ---------- */
async function api(path, opt = {}) {
  const r = await fetch(path, { credentials: "same-origin", ...opt });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path.startsWith("/api/admin")) { show("login"); $("#loginMsg").textContent = "Your session ended — log in again."; }
  if (!r.ok) throw Object.assign(new Error(data.error || String(r.status)), { status: r.status, data });
  return data;
}
function show(id) { ["loading", "setup", "login", "app"].forEach(x => ($("#" + x).hidden = x !== id)); }
function setState(text, cls = "") { const s = $("#state"); s.textContent = text; s.className = "state " + cls; }

// Every change autosaves the whole document a moment later.
function save() {
  dirty = true; setState("Saving…", "busy");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await api("/api/admin/data", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(D) });
      dirty = false; setState("Saved ✓");
    } catch (e) { setState(e.status === 401 ? "Logged out" : "Not saved — tap to retry", "err"); }
  }, 600);
}
addEventListener("beforeunload", e => { if (dirty) e.preventDefault(); });

/* ---------- boot + login ---------- */
async function boot() {
  try {
    const s = await api("/api/session");
    if (!s.configured) return show("setup");
    if (!s.authed) return show("login");
    await load();
  } catch { show("login"); $("#loginMsg").textContent = "Couldn't reach the server — check your connection."; }
}
async function load() {
  D = await api("/api/admin/data");
  D.listings.forEach(l => { // older rows had a single `image`
    if (!Array.isArray(l.photos)) l.photos = l.image ? [{ src: l.image, label: l.imageKind === "reference" ? "Reference artwork" : "Photo", reference: l.imageKind === "reference" }] : [];
    delete l.image; delete l.imageKind;
  });
  for (const k of ["events", "deals", "wantlist", "faq", "payments"]) D[k] = D[k] || [];
  D.confirmed = D.confirmed || {};
  show("app"); render();
}
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#loginMsg"), btn = $("#loginBtn");
  msg.className = "msg"; msg.textContent = ""; btn.disabled = true;
  try {
    await api("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: $("#pw").value }) });
    $("#pw").value = ""; await load();
  } catch (err) {
    msg.className = "msg err";
    msg.textContent = err.message === "wrong_password" ? `Wrong password. ${err.data.attemptsLeft} ${err.data.attemptsLeft === 1 ? "try" : "tries"} left.`
      : err.message === "locked" ? `Too many wrong tries. Wait ${err.data.retryMinutes} minutes and try again.`
      : err.message === "not_configured" ? "Admin isn't switched on yet — refresh this page for setup steps." : "Couldn't log in. Try again.";
  }
  btn.disabled = false;
});
$("#logout").addEventListener("click", async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); D = null; show("login"); $("#loginMsg").textContent = "Logged out."; });
$("#state").addEventListener("click", () => { if ($("#state").classList.contains("err")) save(); });
$("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { tab = b.dataset.t; render(); scrollTo(0, 0); } });

/* ---------- tabs ---------- */
function render() {
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === tab));
  ({ listings: renderListings, events: renderEvents, deals: renderDeals, info: renderInfo })[tab]();
}
const opts = (list, val) => list.map(o => `<option${o === val ? " selected" : ""}>${esc(o)}</option>`).join("");

function renderListings() {
  const L = D.listings, live = L.filter(l => l.verified), demo = L.length - live.length;
  const rows = L.filter(l => listFilter === "all" || (listFilter === "live" ? l.verified : !l.verified));
  $("#view").innerHTML = `
    <div class="intro"><div><h1>Listings</h1><p class="muted">${live.filter(l => l.status !== "Sold").length} live · ${live.filter(l => l.status === "Sold").length} sold · ${demo} hidden demo</p></div><button class="btn gold" data-add="listings">+ Add listing</button></div>
    ${demo ? `<p class="note">Rows marked <b>DEMO</b> are sample data and are hidden from the site. Fix the details, then tick <b>Live on site</b> — or delete them.</p>` : ""}
    <div class="tabs" id="lf">${[["all", "All"], ["live", "Live"], ["demo", "Demo"]].map(([k, t]) => `<button data-lf="${k}" class="${k === listFilter ? "on" : ""}">${t}</button>`).join("")}</div>
    ${rows.map(l => { const p = l.photos[0]; return `
      <div class="row${l.verified ? "" : " off"}" data-id="${l.id}">
        <div class="row-top">${p ? `<img class="th" src="${esc(src(p.src))}" alt="" loading="lazy">` : `<div class="th none">🃏</div>`}
          <div class="grow"><b>${esc(l.name) || "Untitled"}</b><span class="muted">${esc(l.set || l.category)}</span>${l.verified ? "" : `<br><span class="tag">DEMO · HIDDEN</span>`}</div>
          <button class="btn sm" data-edit="listings">Edit</button></div>
        <div class="quick">
          <div class="money"><input type="number" inputmode="decimal" min="0" step="any" data-f="price" value="${esc(l.price)}" aria-label="Price"></div>
          <select data-f="status" class="${l.status}" aria-label="Status">${opts(STATUS, l.status)}</select>
          <label class="c"><input type="checkbox" data-f="verified"${l.verified ? " checked" : ""}> Live on site</label>
        </div>
      </div>`; }).join("") || `<p class="muted">Nothing here yet.</p>`}`;
}
function renderEvents() {
  const E = [...D.events].sort((a, b) => b.date.localeCompare(a.date));
  $("#view").innerHTML = `<div class="intro"><div><h1>Shows</h1><p class="muted">Only the fields you fill in appear on the site.</p></div><button class="btn gold" data-add="events">+ Add show</button></div>
    ${E.map(e => `<div class="row" data-i="${D.events.indexOf(e)}"><div class="row-top"><div class="grow"><b>${esc(e.name)}</b><span class="muted">${esc(e.date)}${e.end ? " → " + esc(e.end) : ""}${e.city ? " · " + esc(e.city) : ""}${e.table ? " · Table " + esc(e.table) : ""}</span></div><button class="btn sm" data-edit="events">Edit</button></div></div>`).join("") || `<p class="muted">No shows yet.</p>`}`;
}
function renderDeals() {
  $("#view").innerHTML = `<div class="intro"><div><h1>Recent deals</h1><p class="muted">The deals section only appears on the site when at least one deal is ticked to show.</p></div><button class="btn gold" data-add="deals">+ Add deal</button></div>
    ${D.deals.some(x => !x.verified) ? `<p class="note">The sample deals below are made up and hidden. Edit them into real ones or delete them.</p>` : ""}
    ${D.deals.map((x, i) => `<div class="row${x.verified ? "" : " off"}" data-i="${i}"><div class="row-top"><div class="grow"><b>${esc(x.title)}</b><span class="muted">${esc(x.kind)} · ${esc(x.date)}</span>${x.verified ? "" : `<br><span class="tag">DEMO · HIDDEN</span>`}</div><button class="btn sm" data-edit="deals">Edit</button></div></div>`).join("") || `<p class="muted">No deals yet.</p>`}`;
}
function renderInfo() {
  const c = D.confirmed;
  $("#view").innerHTML = `<h1>Site info</h1><p class="muted">These sections are hidden until you tick "Show on the site". The starter text was written as a placeholder — make sure it's true for you first.</p>
    <div class="row"><h2>Want list</h2><label class="f">One per line<textarea id="want" rows="6">${esc(D.wantlist.join("\n"))}</textarea></label><label class="c"><input type="checkbox" data-c="wantlist"${c.wantlist ? " checked" : ""}> Show on the site</label></div>
    <div class="row"><h2>Payment methods</h2><label class="f">Separated by commas<input id="pay" value="${esc(D.payments.join(", "))}"></label><label class="c"><input type="checkbox" data-c="payments"${c.payments ? " checked" : ""}> Show on the site</label></div>
    <div class="row"><div class="intro"><h2>FAQ</h2><button class="btn sm" data-add="faq">+ Add question</button></div>
      ${D.faq.map((f, i) => `<div class="row-top" data-i="${i}"><div class="grow"><b>${esc(f.q)}</b></div><button class="btn sm" data-edit="faq">Edit</button></div>`).join("")}
      <label class="c"><input type="checkbox" data-c="faq"${c.faq ? " checked" : ""}> Show on the site</label></div>
    <p class="muted">Logo, Instagram link and gallery photos are part of the site files — ask Alec to change those.</p>`;
}

$("#view").addEventListener("click", e => {
  const lf = e.target.closest("[data-lf]"); if (lf) { listFilter = lf.dataset.lf; return renderListings(); }
  const add = e.target.closest("[data-add]")?.dataset.add;
  if (add) {
    const today = new Date().toISOString().slice(0, 10);
    const item = { listings: { id: Date.now(), name: "", set: "", category: "Singles", type: "electric", condition: "", price: 0, status: "Available", verified: true, photos: [] }, events: { name: "", date: today }, deals: { title: "", detail: "", kind: "Sold", date: today, type: "electric", verified: true }, faq: { q: "", a: "" } }[add];
    D[add].unshift(item); return openSheet(add, item, true);
  }
  const kind = e.target.closest("[data-edit]")?.dataset.edit;
  if (kind) { const row = e.target.closest("[data-id],[data-i]"); openSheet(kind, kind === "listings" ? D.listings.find(l => l.id == row.dataset.id) : D[kind][+row.dataset.i]); }
});
$("#view").addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.c) { D.confirmed[t.dataset.c] = t.checked; return save(); }
  if (t.id === "want") { D.wantlist = t.value.split("\n").map(s => s.trim()).filter(Boolean); return save(); }
  if (t.id === "pay") { D.payments = t.value.split(",").map(s => s.trim()).filter(Boolean); return save(); }
  const row = t.closest("[data-id]"); if (!row || !t.dataset.f) return;
  const l = D.listings.find(x => x.id == row.dataset.id), f = t.dataset.f;
  l[f] = f === "price" ? Math.max(0, parseFloat(t.value) || 0) : f === "verified" ? t.checked : t.value;
  save(); if (f !== "price") renderListings();
});

/* ---------- editor sheet ---------- */
let cur = null;
function openSheet(kind, item, isNew) {
  cur = { kind, item };
  $("#sheetTitle").textContent = (isNew ? "New " : "Edit ") + NAMES[kind];
  const field = ([k, label, type, req]) => {
    const v = item[k] ?? "";
    if (type === "check") return `<label class="c"><input type="checkbox" data-k="${k}"${v ? " checked" : ""}> ${label}</label>`;
    if (type === "status") return `<div class="f" style="font-size:.82rem;font-weight:600;color:var(--mute);margin-bottom:.3rem">${label}</div><div class="seg" data-k="status">${STATUS.map(s => `<button type="button" data-v="${s}" class="${s}${v === s ? " on" : ""}">${s}</button>`).join("")}</div>`;
    if (Array.isArray(type)) return `<label class="f">${label}<select data-k="${k}">${opts(type, v)}</select></label>`;
    if (type === "area") return `<label class="f">${label}${req ? " *" : ""}<textarea data-k="${k}" rows="3">${esc(v)}</textarea></label>`;
    return `<label class="f">${label}${req ? " *" : ""}<input data-k="${k}" type="${type}"${type === "number" ? ' inputmode="decimal" min="0" step="any"' : ""} value="${esc(v)}"></label>`;
  };
  $("#sheetBody").innerHTML = FIELDS[kind].map(field).join("") + (kind === "listings" ? `<hr><h2>Photos</h2><p class="muted">The first photo is the cover. Add front, back and closeups of the actual item. Anything labelled "Reference artwork" is flagged to buyers as not your copy.</p><div class="photos" id="photos"></div><label class="btn" style="width:100%">📷 Add photos<input type="file" id="file" accept="image/*" multiple hidden></label><p class="msg" id="upMsg"></p>` : "")
    + `<hr><button class="btn danger" id="del" style="width:100%">Delete this ${NAMES[kind]}</button>`;
  if (kind === "listings") drawPhotos();
  $("#sheet").hidden = false; $("#sheet").scrollTop = 0; document.body.style.overflow = "hidden";
}
function drawPhotos() {
  const P = cur.item.photos;
  $("#photos").innerHTML = P.map((p, i) => `<div class="ph" data-i="${i}"><img src="${esc(src(p.src))}" alt=""><select aria-label="Photo label">${opts(LABELS, p.reference ? "Reference artwork" : LABELS.includes(p.label) ? p.label : "Photo")}</select>
    <div class="acts"><button type="button" data-a="up" aria-label="Move up"${i ? "" : " disabled"}>↑</button><button type="button" data-a="rm" aria-label="Remove">✕</button></div>${p.reference ? `<small>Buyers see: "Reference artwork — not a photo of Gian's actual copy"</small>` : ""}${i === 0 ? `<small style="color:var(--mute)">Cover photo</small>` : ""}</div>`).join("") || `<p class="muted">No photos yet.</p>`;
}
function closeSheet() {
  const { kind, item } = cur;
  if (!String(item[KEYOF[kind]] || "").trim()) { D[kind] = D[kind].filter(x => x !== item); save(); } // never keep nameless rows
  $("#sheet").hidden = true; document.body.style.overflow = ""; cur = null; render();
}
$("#sheetDone").addEventListener("click", closeSheet);
$("#sheetBody").addEventListener("input", e => {
  const k = e.target.dataset.k; if (!k) return;
  const t = e.target;
  cur.item[k] = t.type === "checkbox" ? t.checked : t.type === "number" ? Math.max(0, parseFloat(t.value) || 0) : t.value;
  if (!cur.item[k] && ["end", "time", "venue", "address", "city", "table", "bringing", "link", "grade"].includes(k)) delete cur.item[k];
  save();
});
$("#sheetBody").addEventListener("change", e => {
  const ph = e.target.closest(".ph"); if (!ph || e.target.tagName !== "SELECT") return;
  const p = cur.item.photos[+ph.dataset.i]; p.label = e.target.value; p.reference = e.target.value === "Reference artwork";
  save(); drawPhotos();
});
$("#sheetBody").addEventListener("click", e => {
  const seg = e.target.closest(".seg button"); if (seg) { cur.item.status = seg.dataset.v; $$(".seg button").forEach(b => b.classList.toggle("on", b === seg)); return save(); }
  const act = e.target.closest(".ph [data-a]");
  if (act) { const P = cur.item.photos, i = +act.closest(".ph").dataset.i; if (act.dataset.a === "rm") P.splice(i, 1); else if (i) [P[i - 1], P[i]] = [P[i], P[i - 1]]; save(); return drawPhotos(); }
  const del = e.target.closest("#del");
  if (del) {
    if (!del.classList.contains("arm")) { del.classList.add("arm"); del.textContent = "Tap again to delete for good"; return setTimeout(() => { del.classList.remove("arm"); del.textContent = `Delete this ${NAMES[cur?.kind] || ""}`; }, 4000); }
    D[cur.kind] = D[cur.kind].filter(x => x !== cur.item); cur.item[KEYOF[cur.kind]] = "x"; save();
    $("#sheet").hidden = true; document.body.style.overflow = ""; cur = null; render();
  }
});

/* ---------- photo upload: shrink on the phone, then send ---------- */
async function shrink(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const s = Math.min(1, 1500 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const blob = t => new Promise(r => c.toBlob(r, t, .82));
  let b = await blob("image/webp");
  if (!b || b.type !== "image/webp") b = await blob("image/jpeg"); // Safari can't encode WebP
  return b;
}
$("#sheetBody").addEventListener("change", async e => {
  if (e.target.id !== "file") return;
  const files = [...e.target.files], msg = $("#upMsg"), P = cur.item.photos; let done = 0, failed = 0;
  for (const f of files) {
    msg.className = "msg"; msg.textContent = `Uploading ${done + failed + 1} of ${files.length}…`;
    try {
      const b = await shrink(f);
      const { src: s } = await api("/api/admin/photo", { method: "POST", headers: { "content-type": b.type }, body: b });
      const real = P.filter(p => !p.reference).length, firstRef = P.findIndex(p => p.reference);
      P.splice(firstRef < 0 ? P.length : firstRef, 0, { src: s, label: real === 0 ? "Front" : real === 1 ? "Back" : "Closeup", reference: false }); // real photos go ahead of reference art
      done++; drawPhotos();
    } catch { failed++; }
  }
  e.target.value = "";
  msg.className = failed ? "msg err" : "msg"; msg.textContent = failed ? `${done} uploaded, ${failed} failed — try those again.` : `${done} photo${done === 1 ? "" : "s"} added ✓`;
  if (done) save();
});

boot();
