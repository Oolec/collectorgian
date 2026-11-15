// Collector Gian — all content lives in data.json. Edit that file to update the site.
const ICON = { fire: "🔥", water: "💧", grass: "🌿", electric: "⚡", psychic: "🔮", dark: "🌙", dragon: "🐉" };
const DEAL_ICON = { Bought: "📥", Sold: "💸", Traded: "🔁" };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n).toLocaleString();
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let DATA, filter = "All", query = "", sort = "featured", dealFilter = "All";

fetch("data.json", { cache: "no-store" }).then(r => r.json()).then(d => { DATA = d; init(); })
  .catch(() => document.body.insertAdjacentHTML("afterbegin", '<p style="padding:1rem;background:#ef3b24">Could not load data.json</p>'));

function init() {
  const p = DATA.profile;
  $$("[data-ig-dm]").forEach(a => { a.href = p.dm; a.target = "_blank"; a.rel = "noopener"; });
  $$("[data-ig]").forEach(a => (a.href = p.instagram));
  $("#year").textContent = new Date().getFullYear();
  $("#stats").innerHTML = DATA.stats.map(s => `<div class="stat rv"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("");
  $("#wantList").innerHTML = DATA.wantlist.map(w => `<li>${esc(w)}</li>`).join("");
  $("#faqList").innerHTML = DATA.faq.map(f => `<details class="rv"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  $("#payments").innerHTML = p.payments.map(x => `<span>${esc(x)}</span>`).join("");
  renderTicker(); renderChips(); renderGrid(); renderDeals(); renderEvents();
  setupPack(); bindUI(); setupFx(); reveal();
}

/* ---------- card visuals ---------- */
function card(l, slab = true) {
  const t = `--t:var(--${l.type || "electric"})`, fx = `<div class="foil"></div><div class="glare"></div>`;
  const setName = esc((l.set || "").split("·")[0].trim());
  let inner;
  if (l.category === "Sealed") {
    inner = `<div class="sealed">${l.image ? `<img src="${esc(l.image)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : `<div><em>${ICON[l.type] || "📦"}</em><strong>${esc(l.name)}</strong></div>`}${fx}</div>`;
  } else {
    const face = l.image
      ? `<div class="card photo"><img src="${esc(l.image)}" alt="${esc(l.name)}" loading="lazy">${fx}</div>`
      : `<div class="card"><div class="card-in"><div class="c-top"><b>${esc(l.name)}</b>${l.hp ? `<span>${l.hp} HP</span>` : ""}</div><div class="c-art"><span>${ICON[l.type] || "✨"}</span></div><div class="c-bot"><span>${setName}</span><span>★★★</span></div></div>${fx}</div>`;
    inner = slab && l.category === "Graded"
      ? `<div class="slab"><div class="slab-label"><span>${esc(l.name)}<small>${setName}</small></span><b>${esc(l.grade || "")}</b></div>${face}</div>` : face;
  }
  return `<div class="card3d" style="${t}"><div class="tilt">${inner}</div></div>`;
}

/* ---------- pack rip ---------- */
function setupPack() {
  const stage = $("#stage"), pulls = $("#pulls"), hint = $("#packHint");
  let busy = false;
  const rip = () => {
    if (busy) return;
    busy = true;
    if (stage.classList.contains("open")) {           // reset, then let them rip again
      stage.classList.remove("open"); pulls.innerHTML = "";
      hint.textContent = "👆 Tap the pack to rip it open";
      return setTimeout(() => (busy = false), 650);
    }
    const pool = DATA.listings.filter(l => l.category !== "Sealed" && l.status === "Available").sort(() => Math.random() - .5).slice(0, 3);
    pulls.innerHTML = pool.map(l => `<div class="pull" data-id="${l.id}"><div class="flipper"><div class="front">${card(l, false)}</div><div class="cardback">CG</div></div><span class="pull-tag">${money(l.price)}</span></div>`).join("");
    stage.classList.add("ripping");
    setTimeout(() => {
      stage.classList.remove("ripping"); stage.classList.add("open");
      const r = stage.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height * .45, 90);
      $$(".pull", pulls).forEach((el, i) => setTimeout(() => { el.classList.add("flipped"); const b = el.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2, 18); }, 700 + i * 380));
      setTimeout(() => { hint.textContent = "↻ Rip another pack"; busy = false; }, 2000);
    }, reduced ? 0 : 700);
  };
  $("#pack").addEventListener("click", rip);
  hint.addEventListener("click", rip);
  pulls.addEventListener("click", e => { const p = e.target.closest(".pull"); if (p) openListing(p.dataset.id); });
}

/* ---------- ticker ---------- */
function renderTicker() {
  const items = DATA.deals.map(d => `<span><b>${d.kind}</b> · ${esc(d.title)}</span><i>✦</i>`).join("");
  $("#ticker").innerHTML = items + items;
}

/* ---------- listings ---------- */
function renderChips() {
  const L = DATA.listings, cats = ["All", ...new Set(L.map(l => l.category)), "In stock"];
  $("#chips").innerHTML = cats.map(c => {
    const n = c === "All" ? L.length : c === "In stock" ? L.filter(l => l.status === "Available").length : L.filter(l => l.category === c).length;
    return `<button class="chip${c === filter ? " active" : ""}" data-f="${c}">${c}<span class="n">${n}</span></button>`;
  }).join("");
}
function renderGrid() {
  let list = DATA.listings.filter(l => filter === "All" || (filter === "In stock" ? l.status === "Available" : l.category === filter));
  if (query) { const q = query.toLowerCase(); list = list.filter(l => `${l.name} ${l.set} ${l.condition} ${l.category}`.toLowerCase().includes(q)); }
  const rank = { Available: 0, Pending: 1, Sold: 2 };
  list.sort(sort === "low" ? (a, b) => a.price - b.price : sort === "high" ? (a, b) => b.price - a.price : sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => rank[a.status] - rank[b.status]);
  $("#grid").innerHTML = list.map((l, i) => `
    <article class="item rv in${l.status === "Sold" ? " is-sold" : ""}" style="--t:var(--${l.type});transition-delay:${Math.min(i, 8) * 40}ms" data-id="${l.id}" tabindex="0">
      <span class="badge ${l.status}">${l.status}</span>
      <div class="visual">${card(l)}</div>
      <div><h3>${esc(l.name)}</h3><p class="set">${esc(l.set)}</p></div>
      <div class="item-foot"><span class="price">${money(l.price)}</span><span class="cond">${esc(l.condition)}</span></div>
    </article>`).join("");
  $("#empty").hidden = list.length > 0;
}
function openListing(id) {
  const l = DATA.listings.find(x => x.id == id); if (!l) return;
  const sold = l.status === "Sold";
  $(".modal-card").style.setProperty("--t", `var(--${l.type})`);
  $("#modalBody").innerHTML = `
    <div class="visual">${card(l)}</div>
    <div>
      <span class="badge ${l.status}">${l.status}</span>
      <h3>${esc(l.name)}</h3><p class="muted">${esc(l.set)}</p>
      <dl class="spec"><dt>Category</dt><dd>${esc(l.category)}</dd><dt>Condition</dt><dd>${esc(l.condition)}</dd>${l.grade ? `<dt>Grade</dt><dd>${esc(l.grade)}</dd>` : ""}<dt>Type</dt><dd>${ICON[l.type] || ""} ${esc(l.type)}</dd></dl>
      <span class="price">${money(l.price)}</span>
      <button class="btn ${sold ? "btn-glass" : "btn-gold"}" id="claim">${sold ? "Ask about similar cards" : "Claim it — DM Gian"}</button>
      <small>Copies a ready-to-send message and opens Instagram — just paste &amp; send.</small>
    </div>`;
  $("#claim").onclick = () => sendDM(sold ? `Hey Gian! Saw the ${l.name} sold — got anything similar?` : `Hey Gian! Is the ${l.name} (${l.condition}) for ${money(l.price)} still available?`);
  $("#modal").hidden = false; document.body.style.overflow = "hidden";
}
function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }
function sendDM(text) {
  const open = () => { const a = Object.assign(document.createElement("a"), { href: DATA.profile.dm, target: "_blank", rel: "noopener" }); document.body.append(a); a.click(); a.remove(); };
  try { navigator.clipboard.writeText(text).then(() => { toast("Message copied — paste it in the DM ✓"); setTimeout(open, 500); }, open); } catch { open(); }
}

/* ---------- deals ---------- */
function renderDeals() {
  const kinds = ["All", ...new Set(DATA.deals.map(d => d.kind))];
  $("#dealChips").innerHTML = kinds.map(k => `<button class="chip${k === dealFilter ? " active" : ""}" data-k="${k}">${k}</button>`).join("");
  $("#dealList").innerHTML = DATA.deals.filter(d => dealFilter === "All" || d.kind === dealFilter).sort((a, b) => b.date.localeCompare(a.date)).map(d => `
    <div class="deal ${d.kind}"><div class="deal-ico">${DEAL_ICON[d.kind] || "✨"}</div>
      <div><div class="deal-meta"><b>${d.kind}</b><span class="muted">${ago(parseDate(d.date))}</span></div><h4>${esc(d.title)}</h4><p>${esc(d.detail)}</p></div></div>`).join("");
}
function ago(date) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - date) / 864e5);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : days < 30 ? `${Math.floor(days / 7)} wk ago` : date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

/* ---------- events + countdown ---------- */
function renderEvents() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const evs = DATA.events.map(e => ({ ...e, d: parseDate(e.date), e: parseDate(e.end || e.date) }));
  const up = evs.filter(e => e.e >= today).sort((a, b) => a.d - b.d), past = evs.filter(e => e.e < today).sort((a, b) => b.d - a.d);
  const mon = d => d.toLocaleString("en", { month: "short" }).toUpperCase();
  const row = (e, isPast) => `
    <div class="event rv${isPast ? " past" : ""}">
      <div class="date"><div class="m">${mon(e.d)}</div><div class="d${e.end ? " sm" : ""}">${e.end ? `${e.d.getDate()}–${e.e.getDate()}` : e.d.getDate()}</div><div class="y">${e.d.getFullYear()}</div></div>
      <div><h3>${esc(e.name)}</h3><div class="meta"><span>📍 ${esc(e.venue)}</span><span>${esc(e.city)}</span><span>🕙 ${esc(e.time)}</span></div><p class="note">${esc(e.note)}</p></div>
      <div class="side"><span class="pill ${isPast ? "done" : "up"}">${isPast ? "WRAPPED ✓" : "UPCOMING"}</span>
        ${isPast ? "" : `<button class="btn btn-glass btn-sm" data-ics="${esc(e.name)}">+ Calendar</button>`}
        ${e.link ? `<a class="btn btn-glass btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">Event page ↗</a>` : ""}</div>
    </div>`;
  $("#eventList").innerHTML = (up.length ? up.map(e => row(e, false)).join("") : `<p class="muted">No shows booked right now — follow on Instagram for the next one.</p>`)
    + (past.length ? `<p class="sub">Past shows</p>` + past.map(e => row(e, true)).join("") : "");

  const n = up[0];
  if (n) {
    const nice = n.d.toLocaleDateString("en", { month: "short", day: "numeric" });
    $("#heroTag span").textContent = `${DATA.profile.location} · Next show ${nice}`;
    $("#next").innerHTML = `<div class="next rv"><div><p class="label">Next stop · ${n.d.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</p><h2>${esc(n.name)}</h2><p>${esc(n.city)} — ${esc(n.note)}</p>
      <div class="actions"><button class="btn btn-gold btn-sm" data-ics="${esc(n.name)}">+ Add to calendar</button>${n.link ? `<a class="btn btn-glass btn-sm" href="${esc(n.link)}" target="_blank" rel="noopener">Event page ↗</a>` : ""}</div></div>
      <div class="clock" id="clock">${["DAYS", "HRS", "MIN", "SEC"].map(u => `<div><b>00</b><span>${u}</span></div>`).join("")}</div></div>`;
    const target = new Date(n.d).setHours(10), cells = $$("#clock b");
    const tick = () => { let s = Math.max(0, Math.floor((target - Date.now()) / 1000)); [86400, 3600, 60, 1].forEach((u, i) => { cells[i].textContent = String(Math.floor(s / u)).padStart(2, "0"); s %= u; }); };
    tick(); setInterval(tick, 1000);
  }
  document.addEventListener("click", ev => { const b = ev.target.closest("[data-ics]"); if (b) ics(evs.find(e => e.name === b.dataset.ics)); });
}
function ics(e) {
  const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date(e.e); end.setDate(end.getDate() + 1);
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CollectorGian//EN", "BEGIN:VEVENT", `UID:${f(e.d)}-${e.name.replace(/\W/g, "")}@collectorgian`, `DTSTAMP:${f(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${f(e.d)}`, `DTEND;VALUE=DATE:${f(end)}`, `SUMMARY:${e.name} — Collector Gian`, `LOCATION:${e.venue}, ${e.city}`, `DESCRIPTION:${e.note}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([body], { type: "text/calendar" })), download: `${e.name.replace(/\W+/g, "-")}.ics` });
  document.body.append(a); a.click(); a.remove();
}

/* ---------- UI ---------- */
function bindUI() {
  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) { filter = b.dataset.f; renderChips(); renderGrid(); } });
  $("#dealChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) { dealFilter = b.dataset.k; renderDeals(); } });
  $("#search").addEventListener("input", e => { query = e.target.value.trim(); renderGrid(); });
  $("#sort").addEventListener("change", e => { sort = e.target.value; renderGrid(); });
  $("#grid").addEventListener("click", e => { const c = e.target.closest(".item"); if (c) openListing(c.dataset.id); });
  $("#grid").addEventListener("keydown", e => { const c = e.target.closest(".item"); if (c && e.key === "Enter") openListing(c.dataset.id); });
  $("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  const links = $("#navLinks");
  $("#menuBtn").addEventListener("click", () => links.classList.toggle("open"));
  links.addEventListener("click", () => links.classList.remove("open"));
  $("#shinyBtn").addEventListener("click", e => {
    const on = document.documentElement.classList.toggle("shiny");
    burst(e.clientX, e.clientY, 60); toast(on ? "✨ Shiny mode activated!" : "Back to normal");
  });
  $("#sellForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    $("#formNote").textContent = "Request copied! Opening Instagram — paste it and attach photos.";
    sendDM(`Hey Gian! I'd like an offer on my cards.\nName: ${f.name}\nContact: ${f.contact}\nSelling: ${f.what}\nDetails: ${f.details || "—"}`);
  });

  // holo tilt (delegated) + cursor glow + scroll progress
  let hot = null;
  const cool = () => { if (hot) { hot.classList.remove("hot"); ["--rx", "--ry"].forEach(v => hot.style.removeProperty(v)); hot = null; } };
  document.addEventListener("pointermove", e => {
    $("#glow").style.cssText = `--x:${e.clientX}px;--y:${e.clientY}px`;
    const el = e.target.closest?.(".card3d");
    if (el !== hot) cool();
    if (!el || e.pointerType === "touch") return;
    hot = el; el.classList.add("hot");
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", x * 100); el.style.setProperty("--my", y * 100);
    el.style.setProperty("--ry", `${(x - .5) * 26}deg`); el.style.setProperty("--rx", `${(.5 - y) * 26}deg`);
  });
  document.addEventListener("pointerleave", cool);
  const prog = () => $("#progress").style.setProperty("--p", scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight));
  addEventListener("scroll", prog, { passive: true }); prog();
}
function toast(text) { const t = $("#toast"); t.textContent = text; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2600); }
function reveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .1 });
  $$(".rv:not(.in), .head, .sell, .want, .deal").forEach(el => { el.classList.add("rv"); io.observe(el); });
}

/* ---------- particles: ambient sparkles + bursts ---------- */
let parts = [];
function burst(x, y, n = 40) {
  if (reduced) return;
  const cols = ["#ffcb05", "#b565ff", "#ff6b3d", "#3d9bff", "#ffffff", "#3dff9a"];
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 9; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, g: .25, life: 1, d: .012 + Math.random() * .02, r: 2 + Math.random() * 4, c: cols[i % cols.length], star: i % 3 === 0 }); }
}
function setupFx() {
  if (reduced) return;
  const c = $("#fx"), ctx = c.getContext("2d");
  let w, h; const size = () => { w = c.width = innerWidth; h = c.height = innerHeight; }; size(); addEventListener("resize", size);
  const amb = Array.from({ length: innerWidth < 760 ? 22 : 45 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: .6 + Math.random() * 1.6, v: .15 + Math.random() * .4, p: Math.random() * 6.28 }));
  (function loop(t) {
    ctx.clearRect(0, 0, w, h);
    for (const a of amb) { a.y -= a.v; a.x += Math.sin(t / 1400 + a.p) * .25; if (a.y < -5) { a.y = h + 5; a.x = Math.random() * w; }
      ctx.globalAlpha = .25 + .25 * Math.sin(t / 600 + a.p); ctx.fillStyle = a.p > 3 ? "#ffcb05" : "#c9a8ff"; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.28); ctx.fill(); }
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) { p.vy += p.g; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.life -= p.d; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      if (p.star) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 6); ctx.fillRect(-p.r, -p.r / 4, p.r * 2, p.r / 2); ctx.fillRect(-p.r / 4, -p.r, p.r / 2, p.r * 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); } }
    ctx.globalAlpha = 1; requestAnimationFrame(loop);
  })(0);
}
