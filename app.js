// Collector Gian — all content lives in data.json. Edit that file to update the site.
const ICON = { fire: "🔥", water: "💧", grass: "🌿", electric: "⚡", psychic: "🔮", dark: "🌙", dragon: "🐉" };
const DEAL_ICON = { Bought: "📥", Sold: "💸", Traded: "🔁" };
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n).toLocaleString();
const parseDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

let DATA, filter = "All", query = "", sort = "featured", dealFilter = "All";

fetch("data.json", { cache: "no-store" })
  .then(r => r.json())
  .then(d => { DATA = d; init(); })
  .catch(() => { document.body.insertAdjacentHTML("afterbegin", '<p style="padding:1rem;background:#e3350d">Could not load data.json</p>'); });

function init() {
  const p = DATA.profile;
  document.querySelectorAll("[data-ig-dm]").forEach(a => { a.href = p.dm; a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll("[data-ig]").forEach(a => (a.href = p.instagram));
  $("#year").textContent = new Date().getFullYear();

  renderHero(); renderStats(); renderChips(); renderGrid();
  renderDeals(); renderEvents(); renderWant(); renderFaq();
  bindUI(); reveal();
}

/* ---------- Card visuals ---------- */
function cardArt(item, big = false) {
  const t = `--t:var(--${item.type || "electric"})`;
  if (item.category === "Sealed") {
    return `<div class="sealed" style="${t}"><div class="sealed-box">
      ${item.image ? `<img src="${esc(item.image)}" alt="" style="position:absolute;inset:0;object-fit:cover">` : `<span class="ico">${ICON[item.type] || "📦"}</span>`}
      <span>${esc(item.name.toUpperCase())}</span></div></div>`;
  }
  const card = `<div class="tcg${item.image ? " photo" : ""}" style="${t}"><div class="tcg-inner">
      ${item.image ? "" : `<div class="tcg-top"><span>${esc(item.name)}</span><small>${item.hp ? item.hp + " HP " : ""}${ICON[item.type] || ""}</small></div>`}
      <div class="tcg-art">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">` : ICON[item.type] || "✨"}</div>
      ${item.image ? "" : `<div class="tcg-lines"><i></i><i></i><i></i></div><div class="tcg-foot"><span>${esc((item.set || "").split("·")[0])}</span><span>★</span></div>`}
    </div></div>`;
  if (item.category === "Graded") {
    return `<div class="slab"><div class="slab-label"><span>${esc(item.name)}<br><small style="opacity:.6">${esc((item.set || "").split("·")[0])}</small></span><b>${esc(item.grade || "")}</b></div>${card}</div>`;
  }
  return card;
}

function renderHero() {
  const picks = DATA.listings.filter(l => l.category !== "Sealed" && l.status !== "Sold").slice(0, 3);
  $("#heroCards").innerHTML = picks.map(p => cardArt({ ...p, category: "Singles" })).join("");
}

function renderStats() {
  $("#stats").innerHTML = DATA.stats.map(s => `<div class="stat reveal"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("");
}

/* ---------- Listings ---------- */
function renderChips() {
  const cats = ["All", ...new Set(DATA.listings.map(l => l.category)), "Available"];
  $("#chips").innerHTML = cats.map(c => {
    const n = c === "All" ? DATA.listings.length : c === "Available" ? DATA.listings.filter(l => l.status === "Available").length : DATA.listings.filter(l => l.category === c).length;
    return `<button class="chip${c === filter ? " active" : ""}" data-f="${c}">${c === "Available" ? "In stock only" : c}<span class="n">${n}</span></button>`;
  }).join("");
}

function visibleListings() {
  let list = DATA.listings.filter(l => {
    if (filter === "Available") return l.status === "Available";
    return filter === "All" || l.category === filter;
  });
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(l => `${l.name} ${l.set} ${l.condition} ${l.category}`.toLowerCase().includes(q));
  }
  const rank = { Available: 0, Pending: 1, Sold: 2 };
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  else if (sort === "high") list.sort((a, b) => b.price - a.price);
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => rank[a.status] - rank[b.status]);
  return list;
}

function renderGrid() {
  const list = visibleListings();
  $("#grid").innerHTML = list.map(l => `
    <article class="item${l.status === "Sold" ? " is-sold" : ""}" style="--t:var(--${l.type})" data-id="${l.id}" tabindex="0">
      <span class="badge ${l.status}">${l.status}</span>
      <div class="visual">${cardArt(l)}</div>
      <div><h3>${esc(l.name)}</h3><p class="set">${esc(l.set)}</p></div>
      <div class="item-foot"><span class="price">${money(l.price)}</span><span class="cond">${esc(l.condition)}</span></div>
    </article>`).join("");
  $("#empty").hidden = list.length > 0;
  tilt();
}

function openListing(id) {
  const l = DATA.listings.find(x => x.id == id);
  if (!l) return;
  const sold = l.status === "Sold";
  const msg = `Hey Gian! Is the ${l.name} (${l.condition}) listed for ${money(l.price)} still available?`;
  $("#modalBody").innerHTML = `
    <div class="visual">${cardArt(l, true)}</div>
    <div>
      <span class="badge ${l.status}" style="position:static">${l.status}</span>
      <h3 id="modalTitle">${esc(l.name)}</h3>
      <p class="muted">${esc(l.set)}</p>
      <dl class="spec">
        <dt>Category</dt><dd>${esc(l.category)}</dd>
        <dt>Condition</dt><dd>${esc(l.condition)}</dd>
        ${l.grade ? `<dt>Grade</dt><dd>${esc(l.grade)}</dd>` : ""}
        <dt>Type</dt><dd>${ICON[l.type] || ""} ${esc(l.type[0].toUpperCase() + l.type.slice(1))}</dd>
      </dl>
      <div class="price">${money(l.price)}</div>
      ${sold
        ? `<button class="btn btn-ghost" data-similar>Ask about similar cards</button>`
        : `<button class="btn btn-primary" data-claim>Claim it — DM Gian</button>
           <p class="muted small" style="margin-top:.6rem">We'll copy a message to your clipboard and open Instagram — just paste &amp; send.</p>`}
    </div>`;
  const go = text => sendDM(text);
  $("[data-claim]", $("#modalBody"))?.addEventListener("click", () => go(msg));
  $("[data-similar]", $("#modalBody"))?.addEventListener("click", () => go(`Hey Gian! Saw the ${l.name} sold — got anything similar?`));
  $("#modal").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }

function sendDM(text) {
  const open = () => window.open(DATA.profile.dm, "_blank", "noopener");
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { toast("Message copied — paste it in the DM"); open(); }, open);
  else open();
}

/* ---------- Deals ---------- */
function renderDeals() {
  const kinds = ["All", ...new Set(DATA.deals.map(d => d.kind))];
  $("#dealChips").innerHTML = kinds.map(k => `<button class="chip${k === dealFilter ? " active" : ""}" data-k="${k}">${k}</button>`).join("");
  const list = DATA.deals.filter(d => dealFilter === "All" || d.kind === dealFilter).sort((a, b) => b.date.localeCompare(a.date));
  $("#dealList").innerHTML = list.map(d => `
    <div class="deal reveal in" style="--t:var(--${d.type || "electric"})">
      <div class="deal-ico">${DEAL_ICON[d.kind] || "✨"}</div>
      <div>
        <div class="deal-meta"><span class="kind ${d.kind}">${d.kind}</span><span class="muted">${timeAgo(parseDate(d.date))}</span></div>
        <h4>${esc(d.title)}</h4><p>${esc(d.detail)}</p>
      </div>
    </div>`).join("");
}
function timeAgo(date) {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - date) / 864e5);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ---------- Events ---------- */
function renderEvents() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const evs = DATA.events.map(e => ({ ...e, d: parseDate(e.date), e: parseDate(e.end || e.date) }));
  const upcoming = evs.filter(e => e.e >= today).sort((a, b) => a.d - b.d);
  const past = evs.filter(e => e.e < today).sort((a, b) => b.d - a.d);

  const block = (e, isPast) => {
    const days = Math.ceil((e.d - today) / 864e5);
    const range = e.end ? `${e.d.getDate()}–${e.e.getDate()}` : e.d.getDate();
    return `
    <div class="event reveal${isPast ? " past" : ""}">
      <div class="date-block">
        <div class="m">${e.d.toLocaleString("en", { month: "short" }).toUpperCase()}</div>
        <div class="d"${e.end ? ' style="font-size:1.4rem;padding:.55rem 0 .35rem"' : ""}>${range}</div>
        <div class="w">${e.d.getFullYear()}</div>
      </div>
      <div>
        <h3>${esc(e.name)}</h3>
        <div class="meta"><span>📍 ${esc(e.venue)}</span><span>${esc(e.city)}</span><span>🕙 ${esc(e.time)}</span></div>
        <p class="note">${esc(e.note)}</p>
      </div>
      <div class="actions">
        ${isPast ? `<span class="pixel muted">WRAPPED ✓</span>`
          : `<div class="countdown">${days <= 0 ? "HAPPENING<b>NOW</b>" : `IN<b>${days}</b>DAY${days === 1 ? "" : "S"}`}</div>
             <button class="btn btn-ghost btn-sm" data-ics="${esc(e.name)}">+ Add to calendar</button>`}
        ${e.link ? `<a class="btn btn-ghost btn-sm" href="${esc(e.link)}" target="_blank" rel="noopener">Event page ↗</a>` : ""}
      </div>
    </div>`;
  };

  $("#eventList").innerHTML =
    (upcoming.length ? upcoming.map(e => block(e, false)).join("") : `<p class="muted">No shows booked right now — follow on Instagram for the next one.</p>`) +
    (past.length ? `<h3 class="past-title">Past Shows</h3><div class="events past-list">${past.map(e => block(e, true)).join("")}</div>` : "");

  document.querySelectorAll("[data-ics]").forEach(b => b.addEventListener("click", () => downloadICS(evs.find(e => e.name === b.dataset.ics))));
}

function downloadICS(e) {
  const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const end = new Date(e.e); end.setDate(end.getDate() + 1);
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CollectorGian//EN", "BEGIN:VEVENT",
    `UID:${f(e.d)}-${e.name.replace(/\W/g, "")}@collectorgian`, `DTSTAMP:${f(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${f(e.d)}`, `DTEND;VALUE=DATE:${f(end)}`,
    `SUMMARY:${e.name} — Collector Gian`, `LOCATION:${e.venue}, ${e.city}`, `DESCRIPTION:${e.note}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([ics], { type: "text/calendar" })), download: `${e.name.replace(/\W+/g, "-")}.ics` });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- Want list / FAQ ---------- */
function renderWant() { $("#wantList").innerHTML = DATA.wantlist.map(w => `<li>${esc(w)}</li>`).join(""); }
function renderFaq() {
  $("#faqList").innerHTML = DATA.faq.map(f => `<details class="reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  $("#payments").innerHTML = DATA.profile.payments.map(p => `<span class="pay">${esc(p)}</span>`).join("");
}

/* ---------- UI ---------- */
function bindUI() {
  $("#chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; filter = b.dataset.f; renderChips(); renderGrid(); });
  $("#dealChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; dealFilter = b.dataset.k; renderDeals(); });
  $("#search").addEventListener("input", e => { query = e.target.value.trim(); renderGrid(); });
  $("#sort").addEventListener("change", e => { sort = e.target.value; renderGrid(); });
  $("#grid").addEventListener("click", e => { const c = e.target.closest(".item"); if (c) openListing(c.dataset.id); });
  $("#grid").addEventListener("keydown", e => { const c = e.target.closest(".item"); if (c && e.key === "Enter") openListing(c.dataset.id); });
  $("#modal").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  const links = $("#navLinks");
  $("#menuBtn").addEventListener("click", () => links.classList.toggle("open"));
  links.addEventListener("click", e => { if (e.target.tagName === "A") links.classList.remove("open"); });

  $("#sellForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const msg = `Hey Gian! I'd like an offer on my cards.\nName: ${f.name}\nContact: ${f.contact}\nSelling: ${f.what}\nDetails: ${f.details || "—"}`;
    $("#formNote").textContent = "Request copied! Opening Instagram — paste it and attach photos.";
    sendDM(msg);
  });
}

function tilt() {
  if (matchMedia("(hover: none)").matches) return;
  document.querySelectorAll(".item, .hero-cards .tcg").forEach(el => {
    const card = el.classList.contains("tcg") ? el : el.querySelector(".tcg, .sealed");
    if (!card) return;
    el.onmousemove = e => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--hx", `${x * 100}%`); card.style.setProperty("--hy", `${y * 100}%`);
      if (el === card) return;
      card.style.transform = `rotateY(${(x - .5) * 14}deg) rotateX(${(.5 - y) * 14}deg)`;
    };
    el.onmouseleave = () => { if (el !== card) card.style.transform = ""; };
  });
}

function toast(text) {
  const t = $("#toast"); t.textContent = text; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 2600);
}

function reveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in), .section-head, .item").forEach(el => { el.classList.add("reveal"); io.observe(el); });
  new MutationObserver(() => document.querySelectorAll(".item:not(.reveal)").forEach(el => el.classList.add("reveal", "in"))).observe($("#grid"), { childList: true });
}
