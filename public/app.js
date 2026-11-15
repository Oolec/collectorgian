// Collector Gian — public site. Content comes from /api/data (managed in /admin; seeded from data.json).
const ICON = { fire: "🔥", water: "💧", grass: "🌿", electric: "⚡", psychic: "🔮", dark: "🌙", dragon: "🐉" };
const DEAL_ICON = { Bought: "📥", Sold: "💸", Traded: "🔁" };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n).toLocaleString();
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEMO = new URLSearchParams(location.search).has("demo");
const REF_NOTE = "Reference artwork — not a photo of Gian's actual copy";

let DATA, filter = "All", query = "", sort = "featured";

fetch("/api/data" + (DEMO ? "?demo=1" : ""), { cache: "no-store" })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => { DATA = d; init(); })
  .catch(() => document.body.insertAdjacentHTML("afterbegin", '<p style="padding:1rem;background:#ef3b24;position:relative;z-index:99">Couldn\'t load the site data — please refresh.</p>'));

// Listings may carry several photos ({src,label,reference}); older data used a single `image`.
function photosOf(l) {
  if (l.photos && l.photos.length) return l.photos;
  return l.image ? [{ src: l.image, label: l.imageKind === "reference" ? "Reference artwork" : "Photo", reference: l.imageKind === "reference" }] : [];
}
const dropSection = id => { $("#" + id)?.remove(); $(`[data-nav="${id}"]`)?.remove(); };

function init() {
  const p = DATA.profile;
  $$("[data-ig-dm]").forEach(a => { a.href = p.dm; a.target = "_blank"; a.rel = "noopener"; });
  $$("[data-ig]").forEach(a => (a.href = p.instagram));
  $("#year").textContent = new Date().getFullYear();
  $("#demoBar").hidden = !DATA.demo;
  if (p.avatar) {
    $$(".brand-mark").forEach(b => { b.classList.add("has-img"); b.innerHTML = `<img src="${esc(p.avatar)}" alt="CollectorGian logo">`; });
    $(".pack-logo").innerHTML = `<img src="${esc(p.avatar)}" alt="">`;
  }
  // Optional sections only appear once Gian has confirmed their content.
  if (DATA.wantlist.length) $("#wantList").innerHTML = DATA.wantlist.map(w => `<li>${esc(w)}</li>`).join(""); else dropSection("want");
  if (!DATA.faq.length && !DATA.payments.length) dropSection("faq");
  else {
    $("#faqList").innerHTML = DATA.faq.map(f => `<details class="rv"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
    if (DATA.payments.length) $("#payments").innerHTML = DATA.payments.map(x => `<span>${esc(x)}</span>`).join(""); else $("#pays").remove();
  }
  renderEvents(); renderStats(); renderTicker(); renderGallery(); renderDeals(); renderChips(); renderGrid();
  setupPack(); bindUI(); setupFx(); reveal();
}

/* ---------- card visuals ---------- */
function card(l, slab = true) {
  const t = `--t:var(--${l.type || "electric"})`, fx = `<div class="foil"></div><div class="glare"></div>`;
  const setName = esc((l.set || "").split("·")[0].trim());
  const ph = photosOf(l)[0];
  let inner;
  if (l.category === "Sealed") {
    inner = `<div class="sealed">${ph ? `<img src="${esc(ph.src)}" alt="${esc(l.name)}" loading="lazy" class="${ph.reference ? "fit" : "cover"}">` : `<div><em>${ICON[l.type] || "📦"}</em><strong>${esc(l.name)}</strong></div>`}${fx}</div>`;
  } else {
    const face = ph
      ? `<div class="card photo${ph.reference ? " reference" : ""}"><img src="${esc(ph.src)}" alt="${esc(l.name)}${ph.reference ? " reference artwork" : ""}" loading="lazy">${fx}</div>`
      : `<div class="card"><div class="card-in"><div class="c-top"><b>${esc(l.name)}</b>${l.hp ? `<span>${l.hp} HP</span>` : ""}</div><div class="c-art"><span>${ICON[l.type] || "✨"}</span></div><div class="c-bot"><span>${setName}</span><span>★★★</span></div></div>${fx}</div>`;
    inner = slab && l.category === "Graded" && !ph
      ? `<div class="slab"><div class="slab-label"><span>${esc(l.name)}<small>${setName}</small></span><b>${esc(l.grade || "")}</b></div>${face}</div>` : face;
  }
  return `<div class="card3d" style="${t}"><div class="tilt">${inner}</div></div>`;
}

/* ---------- pack rip ---------- */
function setupPack() {
  const stage = $("#stage"), pulls = $("#pulls"), hint = $("#packHint");
  const pool = () => DATA.listings.filter(l => l.category !== "Sealed" && l.status === "Available");
  const idle = () => (hint.textContent = pool().length ? "👆 Tap the pack to rip it open" : "✦ New pulls dropping soon");
  let busy = false; idle();
  const rip = () => {
    if (busy) return;
    if (!pool().length) return toast("New inventory is on the way — DM Gian to ask what's in the case");
    busy = true;
    if (stage.classList.contains("open")) { stage.classList.remove("open"); pulls.innerHTML = ""; idle(); return setTimeout(() => (busy = false), 650); }
    const picks = pool().sort(() => Math.random() - .5).slice(0, 3);
    pulls.className = "pulls n" + picks.length;
    pulls.innerHTML = picks.map(l => `<div class="pull" data-id="${l.id}"><div class="flipper"><div class="front">${card(l, false)}</div><div class="cardback">CG</div></div><span class="pull-tag">${l.demo ? "DEMO · " : ""}${money(l.price)}</span></div>`).join("");
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

/* ---------- stats + ticker (built only from real profile / show / inventory data) ---------- */
function renderStats() {
  const yr = new Date().getFullYear(), shows = DATA.events.filter(e => e.date.startsWith(yr)).length, live = DATA.listings.filter(l => l.status === "Available").length;
  const tiles = [[DATA.profile.location, "Home base"], ["Buy · Sell · Trade", "Slabs, singles & sealed"]];
  if (shows) tiles.push([shows, `Card show${shows === 1 ? "" : "s"} in ${yr}`]);
  if (live) tiles.push([live, `Listing${live === 1 ? "" : "s"} available now`]);
  $("#stats").innerHTML = tiles.map(([v, l]) => `<div class="stat rv"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("");
}
function renderTicker() {
  const bits = ["Buy · Sell · Trade", DATA.profile.location, "Graded slabs", "Sealed product", "Singles", "@" + DATA.profile.handle];
  if (NEXT) bits.splice(2, 0, `Next show · ${NEXT.name} · ${NEXT.d.toLocaleDateString("en", { month: "short", day: "numeric" })}`);
  DATA.deals.forEach(d => bits.push(`${d.kind} · ${d.title}`));
  const html = bits.map(b => `<span>${esc(b)}</span><i>✦</i>`).join("");
  $("#ticker").innerHTML = html.repeat(4);
}

/* ---------- gallery + lightbox ---------- */
function renderGallery() {
  const g = DATA.gallery || [];
  if (!g.length) return dropSection("gallery");
  $("#galleryGrid").innerHTML = g.map((x, i) => `<figure class="shot rv${x.big ? " big" : ""}" data-i="${i}" tabindex="0"><img src="${esc(x.src)}" alt="${esc(x.caption)}" loading="lazy"><figcaption>${esc(x.caption)}</figcaption></figure>`).join("");
  $("#galleryGrid").addEventListener("click", e => { const f = e.target.closest(".shot"); if (f) openLB(g, +f.dataset.i); });
}
let LB = { items: [], i: 0 };
function openLB(items, i = 0) { LB = { items, i }; drawLB(); $("#lightbox").hidden = false; document.body.style.overflow = "hidden"; }
function drawLB() {
  const x = LB.items[LB.i], many = LB.items.length > 1;
  $("#lbImg").src = x.src; $("#lbImg").alt = x.caption || x.label || "";
  $("#lbCap").innerHTML = (x.reference ? `<b class="ref-tag">${REF_NOTE}</b>` : esc(x.caption || x.label || "")) + (many ? ` <span>${LB.i + 1} / ${LB.items.length}</span>` : "");
  $$(".lb-nav").forEach(b => (b.hidden = !many));
}
function stepLB(n) { LB.i = (LB.i + n + LB.items.length) % LB.items.length; drawLB(); }
function closeLB() { $("#lightbox").hidden = true; if ($("#modal").hidden) document.body.style.overflow = ""; }

/* ---------- listings ---------- */
function renderChips() {
  const L = DATA.listings.filter(l => l.status !== "Sold"), cats = ["All", ...new Set(DATA.listings.map(l => l.category))];
  $("#chips").innerHTML = cats.length > 2 ? cats.map(c => `<button class="chip${c === filter ? " active" : ""}" data-f="${c}">${c}<span class="n">${c === "All" ? L.length : L.filter(l => l.category === c).length}</span></button>`).join("") : "";
}
function itemHTML(l, i) {
  const ph = photosOf(l), ref = ph[0] && ph[0].reference;
  return `<article class="item rv in${l.status === "Sold" ? " is-sold" : ""}" style="--t:var(--${l.type});transition-delay:${Math.min(i, 8) * 40}ms" data-id="${l.id}" tabindex="0">
      <span class="badge ${l.status}">${l.status}</span>${l.demo ? `<span class="badge demo">Demo</span>` : ""}
      <div class="visual">${card(l)}${ph.length > 1 ? `<span class="ph-count">📷 ${ph.length}</span>` : ""}</div>
      ${ref ? `<p class="ref-note">Reference artwork · not the actual copy</p>` : ""}
      <div><h3>${esc(l.name)}</h3><p class="set">${esc(l.set)}</p></div>
      <div class="item-foot"><span class="price">${money(l.price)}</span>${l.condition ? `<span class="cond">${esc(l.condition)}</span>` : ""}</div>
      ${l.status === "Available" && !l.demo ? `<button class="btn btn-glass btn-sm offer-open" data-offer>Make an offer</button>` : ""}
    </article>`;
}
function renderGrid() {
  const all = DATA.listings;
  let list = all.filter(l => filter === "All" || l.category === filter);
  if (query) { const q = query.toLowerCase(); list = list.filter(l => `${l.name} ${l.set} ${l.condition} ${l.category} ${l.grade || ""}`.toLowerCase().includes(q)); }
  const rank = { Available: 0, Pending: 1, Sold: 2 };
  list.sort(sort === "low" ? (a, b) => a.price - b.price : sort === "high" ? (a, b) => b.price - a.price : sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => rank[a.status] - rank[b.status]);
  // "Featured" puts available first, then pending; an explicit sort is honoured as-is. Sold items get their own section below.
  const live = list.filter(l => l.status !== "Sold"), sold = list.filter(l => l.status === "Sold");
  $("#grid").innerHTML = live.map(itemHTML).join("");
  $("#soldGrid").innerHTML = sold.map(itemHTML).join("");
  $("#soldWrap").hidden = !sold.length;
  $("#soldCount").textContent = sold.length ? `${sold.length} item${sold.length === 1 ? "" : "s"}` : "";
  $("#emptyAll").hidden = all.length > 0;
  $("#toolbar").hidden = $("#chips").hidden = $("#listSub").hidden = !all.length;
  const empty = $("#empty");
  empty.hidden = !all.length || live.length > 0;
  if (!empty.hidden) empty.textContent = query || filter !== "All"
    ? (sold.length ? "Nothing available matches that — but see the sold items below." : "Nothing matches that search. DM Gian — he might have it off the list.")
    : "Everything listed has sold. New inventory is on the way — DM Gian to ask what's coming.";
}

function openListing(id, focusOffer) {
  const l = DATA.listings.find(x => x.id == id); if (!l) return;
  const ph = photosOf(l), dm = esc(DATA.profile.dm), link = (cls, idAttr, text) => `<a class="btn ${cls}" id="${idAttr}" href="${dm}" target="_blank" rel="noopener">${text}</a>`;
  const viewer = ph.length ? `<div class="pv">
      <button class="pv-main card3d" id="pvMain" style="--t:var(--${l.type})" aria-label="Enlarge photo"><span class="tilt"><span class="pv-frame${l.category === "Sealed" ? " light" : ""}"><img id="pvImg" alt=""><span class="foil"></span><span class="glare"></span></span></span></button>
      <p class="pv-label" id="pvLabel"></p>
      ${ph.length > 1 ? `<div class="pv-thumbs">${ph.map((p, i) => `<button data-i="${i}" aria-label="${esc(p.label)}"><img src="${esc(p.src)}" alt=""><span>${esc(p.reference ? "Reference" : p.label)}</span></button>`).join("")}</div>` : ""}
    </div>` : `<div class="visual">${card(l)}</div>`;
  let actions;
  if (l.demo) actions = `<p class="demo-note">Demo listing — sample data Gian hasn't confirmed. Not for sale yet.</p>`;
  else if (l.status === "Available") actions = `${link("btn-gold", "claim", `Claim at ${money(l.price)} — DM Gian`)}
      <form class="offer" id="offerForm" novalidate>
        <label for="offerAmt">Or make an offer</label>
        <div class="offer-row"><span class="cur">$</span><input id="offerAmt" type="number" inputmode="decimal" min="1" step="any" placeholder="Your offer" autocomplete="off">${link("btn-glass", "offerBtn", "Copy offer &amp; open DMs")}</div>
        <p class="offer-note" id="offerNote">Nothing is sent from this site. Your offer is copied to your clipboard — paste it into Gian's Instagram DMs and press send.</p>
      </form>`;
  else actions = link("btn-glass", "claim", l.status === "Pending" ? "Ask if it's still pending" : "Ask about similar cards") + `<small>Copies a message for you to paste into Gian's DMs.</small>`;

  $(".modal-card").style.setProperty("--t", `var(--${l.type})`);
  $("#modalBody").innerHTML = `${viewer}
    <div class="info">
      <span class="badge ${l.status}">${l.status}</span>${l.demo ? ` <span class="badge demo">Demo</span>` : ""}
      <h3>${esc(l.name)}</h3><p class="muted">${esc(l.set)}</p>
      <dl class="spec"><dt>Category</dt><dd>${esc(l.category)}</dd>${l.condition ? `<dt>Condition</dt><dd>${esc(l.condition)}</dd>` : ""}${l.grade ? `<dt>Grade</dt><dd>${esc(l.grade)}</dd>` : ""}</dl>
      <span class="price">${money(l.price)}</span>
      ${actions}
    </div>`;

  if (ph.length) {
    let cur = 0;
    const show = i => {
      cur = i; const p = ph[i];
      $("#pvImg").src = p.src; $("#pvImg").alt = `${l.name} — ${p.label}`;
      $("#pvLabel").innerHTML = (p.reference ? `<b class="ref-tag">${REF_NOTE}</b>` : esc(p.label)) + ` <span>· tap photo to enlarge</span>`;
      $$(".pv-thumbs button").forEach((b, k) => b.classList.toggle("on", k === i));
    };
    show(0);
    $("#pvMain").onclick = () => openLB(ph.map(p => ({ ...p, caption: `${l.name} — ${p.label}` })), cur);
    $(".pv-thumbs")?.addEventListener("click", e => { const b = e.target.closest("button"); if (b) show(+b.dataset.i); });
  }
  const desc = `${l.name}${l.condition ? ` (${l.condition})` : ""}`;
  const claim = $("#claim");
  if (claim) claim.onclick = () => copyForDM(l.status === "Available" ? `Hey Gian! Is the ${desc} listed at ${money(l.price)} still available? I'd like to claim it.` : l.status === "Pending" ? `Hey Gian! Is the ${desc} still pending? I'm interested if it falls through.` : `Hey Gian! Saw the ${l.name} sold — got anything similar?`);
  const form = $("#offerForm");
  if (form) {
    const amt = $("#offerAmt"), note = $("#offerNote");
    $("#offerBtn").onclick = e => {
      const v = Math.round(parseFloat(amt.value) * 100) / 100;
      if (!(v > 0)) { e.preventDefault(); note.className = "offer-note err"; note.textContent = "Enter your offer amount first."; return amt.focus(); }
      copyForDM(`Hey Gian! I'd like to offer ${money(v)} for the ${desc} — listed at ${money(l.price)} on your site.`, true);
      note.className = "offer-note ok";
      note.textContent = `✓ Your ${money(v)} offer is copied. Instagram is opening — paste the message and press send. Gian won't see it until you do.`;
    };
    form.onsubmit = e => { e.preventDefault(); $("#offerBtn").click(); };
    if (focusOffer) setTimeout(() => amt.focus(), 350);
  }
  $("#modal").hidden = false; document.body.style.overflow = "hidden";
}
function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }

// Copy a ready-to-send message. The link the visitor tapped opens Instagram itself; if copying is blocked we show the text to copy by hand.
function copyForDM(text, quiet) {
  const manual = () => {
    const host = $("#modal").hidden ? $("#formNote") : $("#modalBody .info");
    $(".manual", host.parentNode)?.remove();
    host.insertAdjacentHTML(host.id === "formNote" ? "afterend" : "beforeend", `<div class="manual"><p>Couldn't copy automatically — copy this message and paste it into Gian's DMs:</p><textarea readonly rows="4">${esc(text)}</textarea></div>`);
    $(".manual textarea").select();
  };
  try { navigator.clipboard.writeText(text).then(() => quiet || toast("Copied ✓ Paste it into Gian's DMs and press send"), manual); } catch { manual(); }
}

/* ---------- deals (only ones Gian has confirmed) ---------- */
function renderDeals() {
  if (!DATA.deals.length) return dropSection("deals");
  $("#dealList").innerHTML = [...DATA.deals].sort((a, b) => b.date.localeCompare(a.date)).map(d => `
    <div class="deal ${d.kind}"><div class="deal-ico">${DEAL_ICON[d.kind] || "✨"}</div>
      <div><div class="deal-meta"><b>${d.kind}</b><span class="muted">${parseDate(d.date).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</span></div><h4>${esc(d.title)}</h4>${d.detail ? `<p>${esc(d.detail)}</p>` : ""}</div></div>`).join("");
}

/* ---------- shows + countdown. Only fields Gian has filled in are shown. ---------- */
let NEXT = null;
function showFacts(e) {
  const where = [e.venue, e.address, e.city].filter(Boolean).join(" · ");
  return [where && `<span>📍 ${esc(where)}</span>`, e.time && `<span>🕙 ${esc(e.time)}</span>`, e.table && `<span>🎟️ Table ${esc(e.table)}</span>`].filter(Boolean).join("");
}
function renderEvents() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const evs = DATA.events.map(e => ({ ...e, d: parseDate(e.date), e: parseDate(e.end || e.date) }));
  const up = evs.filter(e => e.e >= today).sort((a, b) => a.d - b.d), past = evs.filter(e => e.e < today).sort((a, b) => b.d - a.d);
  const mon = d => d.toLocaleString("en", { month: "short" }).toUpperCase();
  const row = (e, isPast) => `
    <div class="event rv${isPast ? " past" : ""}">
      <div class="date"><div class="m">${mon(e.d)}</div><div class="d${e.end ? " sm" : ""}">${e.end ? `${e.d.getDate()}–${e.e.getDate()}` : e.d.getDate()}</div><div class="y">${e.d.getFullYear()}</div></div>
      <div><h3>${esc(e.name)}</h3><div class="meta">${showFacts(e)}</div>${e.bringing && !isPast ? `<p class="note"><b>Bringing:</b> ${esc(e.bringing)}</p>` : ""}</div>
      <div class="side"><span class="pill ${isPast ? "done" : "up"}">${isPast ? "WRAPPED ✓" : "UPCOMING"}</span>
        ${isPast ? "" : `<button class="btn btn-glass btn-sm" data-ics="${esc(e.name)}">+ Calendar</button>`}
        ${e.link ? `<a class="btn btn-glass btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">Event page ↗</a>` : ""}</div>
    </div>`;
  $("#eventList").innerHTML = (up.length ? up.map(e => row(e, false)).join("") : `<div class="empty-card slim"><p class="muted">No upcoming shows announced yet — follow <b>@${esc(DATA.profile.handle)}</b> on Instagram for the next one.</p></div>`)
    + (past.length ? `<p class="sub">Past shows</p>` + past.map(e => row(e, true)).join("") : "");

  NEXT = up[0] || null;
  if (NEXT) {
    const n = NEXT, facts = showFacts(n);
    $("#heroTag span").textContent = `${DATA.profile.location} · Next show ${n.d.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
    $("#next").innerHTML = `<div class="next rv"><div><p class="label">Next stop · ${n.d.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</p><h2>${esc(n.name)}</h2>
      ${facts ? `<div class="next-facts">${facts}</div>` : ""}${n.bringing ? `<p class="next-bring"><b>What Gian's bringing:</b> ${esc(n.bringing)}</p>` : ""}
      <div class="actions"><button class="btn btn-gold btn-sm" data-ics="${esc(n.name)}">+ Add to calendar</button>${n.link ? `<a class="btn btn-glass btn-sm" href="${esc(n.link)}" target="_blank" rel="noopener">Event page ↗</a>` : ""}</div></div>
      <div><div class="clock" id="clock">${["DAYS", "HRS", "MIN", "SEC"].map(u => `<div><b>00</b><span>${u}</span></div>`).join("")}</div><p class="clock-note" id="clockNote"></p></div></div>`;
    // Count down to the posted start time when there is one, otherwise to the start of show day.
    const t = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i.exec(n.time || ""), target = new Date(n.d);
    if (t) target.setHours((+t[1] % 12) + (/pm/i.test(t[3]) ? 12 : 0), +(t[2] || 0));
    $("#clockNote").textContent = t ? "until doors" : "until show day";
    const cells = $$("#clock b");
    const tick = () => { let s = Math.max(0, Math.floor((target - Date.now()) / 1000)); [86400, 3600, 60, 1].forEach((u, i) => { cells[i].textContent = String(Math.floor(s / u)).padStart(2, "0"); s %= u; }); };
    tick(); setInterval(tick, 1000);
  } else $("#next").remove();
  document.addEventListener("click", ev => { const b = ev.target.closest("[data-ics]"); if (b) ics(evs.find(e => e.name === b.dataset.ics)); });
}
function ics(e) {
  const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date(e.e); end.setDate(end.getDate() + 1);
  const where = [e.venue, e.address, e.city].filter(Boolean).join(", "), about = [e.table && `Table ${e.table}`, e.bringing].filter(Boolean).join(" — ");
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CollectorGian//EN", "BEGIN:VEVENT", `UID:${f(e.d)}-${e.name.replace(/\W/g, "")}@collectorgian`, `DTSTAMP:${f(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${f(e.d)}`, `DTEND;VALUE=DATE:${f(end)}`, `SUMMARY:${e.name} — Collector Gian`, where && `LOCATION:${where}`, about && `DESCRIPTION:${about}`, "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([body], { type: "text/calendar" })), download: `${e.name.replace(/\W+/g, "-")}.ics` });
  document.body.append(a); a.click(); a.remove();
}

/* ---------- UI ---------- */
function bindUI() {
  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) { filter = b.dataset.f; renderChips(); renderGrid(); } });
  $("#search").addEventListener("input", e => { query = e.target.value.trim(); renderGrid(); });
  $("#sort").addEventListener("change", e => { sort = e.target.value; renderGrid(); });
  $("#listings").addEventListener("click", e => { const c = e.target.closest(".item"); if (c) openListing(c.dataset.id, !!e.target.closest("[data-offer]")); });
  $("#listings").addEventListener("keydown", e => { const c = e.target.closest(".item"); if (c && e.key === "Enter" && e.target === c) openListing(c.dataset.id); });
  $("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  const lb = $("#lightbox"); let sx = null;
  lb.addEventListener("click", e => { const a = e.target.closest("[data-lb]")?.dataset.lb; if (a === "prev") stepLB(-1); else if (a === "next") stepLB(1); else if (a === "close" || e.target === lb || e.target.tagName === "FIGURE") closeLB(); });
  lb.addEventListener("touchstart", e => (sx = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50 && LB.items.length > 1) stepLB(dx < 0 ? 1 : -1); });
  document.addEventListener("keydown", e => {
    if (!lb.hidden) { if (e.key === "Escape") closeLB(); else if (e.key === "ArrowLeft") stepLB(-1); else if (e.key === "ArrowRight") stepLB(1); }
    else if (e.key === "Escape") closeModal();
  });
  const links = $("#navLinks");
  $("#menuBtn").addEventListener("click", () => links.classList.toggle("open"));
  links.addEventListener("click", () => links.classList.remove("open"));
  $("#shinyBtn").addEventListener("click", e => { const on = document.documentElement.classList.toggle("shiny"); burst(e.clientX, e.clientY, 60); toast(on ? "✨ Shiny mode activated!" : "Back to normal"); });
  $("#sellForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    copyForDM(`Hey Gian! I'd like an offer on my cards.\nName: ${f.name}\nContact: ${f.contact}\nSelling: ${f.what}\nDetails: ${f.details || "—"}`, true);
    $("#formNote").innerHTML = `✓ Request copied. <a href="${esc(DATA.profile.dm)}" target="_blank" rel="noopener"><b>Open Gian's DMs ↗</b></a>, paste it, attach your photos and press send.`;
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
function toast(text) { const t = $("#toast"); t.textContent = text; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3200); }
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
