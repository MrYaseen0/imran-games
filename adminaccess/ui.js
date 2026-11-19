/* ==========================================================================
   Imran Games — Admin UI helpers (ui.js)
   Wave 2, Agent 2 — Design System. Vanilla JS only, no dependencies,
   no network calls, no secrets, no demo data.
   Every value rendered through these helpers is escaped first (same
   escHtml / igSafeImgUrl pattern as the existing admin page). Callers must
   pass REAL data in — these helpers never invent numbers, names, or stars.
   Usage (Wave 3): <script src="ui.js"></script> then
   IGAdminUI.initTheme(); IGAdminUI.initTopbar(); etc. All init functions
   are no-ops when their elements are absent, so the file is safe to load
   on the login page too.
   Global namespace: window.IGAdminUI
   ========================================================================== */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------------------
     Escaping — same pattern as adminaccess/index.html (H-04, 2026-11-19).
     Never insert unescaped text into innerHTML.
     ------------------------------------------------------------------------ */
  function escHtml(x) {
    return String(x == null ? "" : x)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/`/g, "&#96;");
  }
  function igSafeImgUrl(u) {
    var s = String(u || "").trim();
    if (!s) return "";
    if (/^(javascript|data|vbscript):/i.test(s)) return "";
    if (s.indexOf("//") === 0) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && s.toLowerCase().indexOf("https://") !== 0) return "";
    return s;
  }

  /* ------------------------------------------------------------------------
     Theme — localStorage key "ig-admin-theme", default is the BLUE light
     theme (Wave 5, owner decision). Nothing saved means light, even on a
     dark-mode OS — the no-flash snippet, the toggle and the Settings
     "System" choice all agree on this. "System" only clears the saved
     preference; the effective theme then returns to light.
     NO-FLASH: the snippet below must run in <head> BEFORE admin.css loads.
     ui.js initTheme() is only the fallback for pages that load it late.
     Paste in <head> (Wave 3, default updated Wave 5):
       <script>
       try{var t=localStorage.getItem("ig-admin-theme");
         if(!t)t="light";
         document.documentElement.setAttribute("data-theme",t);}catch(e){
         document.documentElement.setAttribute("data-theme","light");}
       </script>
     ------------------------------------------------------------------------ */
  var THEME_KEY = "ig-admin-theme";
  function systemTheme() {
    /* No saved preference: the default theme is light (blue sidebar). */
    return "light";
  }
  function getTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t === "dark" || t === "light") return t;
    } catch (e) {}
    return systemTheme();
  }
  function setTheme(theme) {
    var t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    syncThemeToggle();
    return t;
  }
  function toggleTheme() { return setTheme(getTheme() === "dark" ? "light" : "dark"); }
  function initTheme() {
    // Only set when the <head> snippet has not already set it.
    if (!document.documentElement.getAttribute("data-theme")) setTheme(getTheme());
    syncThemeToggle();
  }
  function syncThemeToggle() {
    var btns = document.querySelectorAll("[data-ig-theme-toggle]");
    var dark = getTheme() === "dark";
    btns.forEach(function (b) {
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      b.setAttribute("aria-pressed", dark ? "true" : "false");
      // Sun in light mode, moon in dark mode. Text only — no emoji icons.
      b.textContent = dark ? "☾" : "☀";
    });
  }

  /* ------------------------------------------------------------------------
     Formatting — PKR + dates. Reference shows ₦; this admin always uses PKR.
     ------------------------------------------------------------------------ */
  function formatPKR(n) {
    try { return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(Number(n) || 0); }
    catch (e) { return "Rs. " + (Number(n) || 0).toLocaleString("en-PK"); }
  }
  function formatNum(n) { // compact in cards: 98.7k
    var v = Number(n) || 0;
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(v);
  }
  function formatFull(n) { try { return (Number(n) || 0).toLocaleString("en-PK"); } catch (e) { return String(n); } }
  function formatDateDDMMYYYY(iso) { // DD-MM-YYYY, PKT
    try {
      return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) { return String(iso || ""); }
  }
  function formatDateTimePKT(iso) { // DD Mon YYYY, HH:MM:SS, PKT
    try {
      return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    } catch (e) { return String(iso || ""); }
  }

  /* ------------------------------------------------------------------------
     Toast — bottom-centre pill (same placement as the existing admin toast).
     toast("Saved ✓") / toast("Failed", "error")
     ------------------------------------------------------------------------ */
  var toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById("ig-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "ig-toast";
      el.className = "ig-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = String(msg == null ? "" : msg);
    el.className = "ig-toast show" + (type === "error" ? " ig-toast-error" : type === "success" ? " ig-toast-success" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  /* ------------------------------------------------------------------------
     Modal / Drawer — open/close, ESC + overlay click, focus return.
     openModal("my-modal") / closeModal("my-modal")
     openDrawer("my-drawer") / closeDrawer("my-drawer")
     Markup contract: overlay div.ig-overlay#id > div.ig-modal (role=dialog);
     drawer div.ig-drawer#id + div.ig-drawer-scrim[data-for="id"].
     ------------------------------------------------------------------------ */
  var lastFocused = null;
  function openModal(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    lastFocused = document.activeElement;
    el.classList.add("open");
    var focusable = el.querySelector("input,select,textarea,button,[tabindex]");
    if (focusable) focusable.focus();
    return true;
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.classList.remove("open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    return true;
  }
  function openDrawer(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    lastFocused = document.activeElement;
    el.classList.add("open");
    var scrim = document.querySelector('.ig-drawer-scrim[data-for="' + id + '"]');
    if (scrim) scrim.classList.add("open");
    var focusable = el.querySelector("input,select,textarea,button,[tabindex]");
    if (focusable) focusable.focus();
    return true;
  }
  function closeDrawer(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.classList.remove("open");
    var scrim = document.querySelector('.ig-drawer-scrim[data-for="' + id + '"]');
    if (scrim) scrim.classList.remove("open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    return true;
  }
  function wireOverlayDismiss() {
    document.querySelectorAll(".ig-overlay").forEach(function (ov) {
      ov.addEventListener("click", function (e) { if (e.target === ov) closeModal(ov.id); });
    });
    document.querySelectorAll(".ig-drawer-scrim").forEach(function (s) {
      s.addEventListener("click", function () { closeDrawer(s.getAttribute("data-for")); });
    });
    document.querySelectorAll("[data-ig-close-modal]").forEach(function (b) {
      b.addEventListener("click", function () { closeModal(b.getAttribute("data-ig-close-modal")); });
    });
    document.querySelectorAll("[data-ig-close-drawer]").forEach(function (b) {
      b.addEventListener("click", function () { closeDrawer(b.getAttribute("data-ig-close-drawer")); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".ig-overlay.open").forEach(function (ov) { closeModal(ov.id); });
      document.querySelectorAll(".ig-drawer.open").forEach(function (d) { closeDrawer(d.id); });
      document.querySelectorAll(".ig-avatar-drop.open").forEach(function (d) { d.classList.remove("open"); });
    });
  }

  /* ------------------------------------------------------------------------
     ConfirmTap — tap-twice delete (keeps the existing admin behaviour).
     armConfirm(button, { armLabel, timeoutMs, onConfirm })
     First tap arms (label + red), second tap within the window confirms.
     ------------------------------------------------------------------------ */
  function armConfirm(btn, opts) {
    if (!btn) return;
    var o = opts || {};
    var armLabel = o.armLabel || "Sure? Tap again to delete";
    var timeoutMs = o.timeoutMs || 5000;
    var origLabel = btn.textContent;
    var origBg = btn.style.background;
    var origBorder = btn.style.borderColor;
    function disarm() {
      btn.removeAttribute("data-ig-armed");
      btn.textContent = origLabel;
      btn.style.background = origBg;
      btn.style.borderColor = origBorder;
      clearTimeout(btn._igArmTimer);
    }
    btn.addEventListener("click", function () {
      if (btn.getAttribute("data-ig-armed") !== "1") {
        btn.setAttribute("data-ig-armed", "1");
        btn.textContent = armLabel;
        btn.style.background = "#7f1d1d";
        btn.style.borderColor = "#ef4444";
        btn._igArmTimer = setTimeout(disarm, timeoutMs);
        return;
      }
      disarm();
      if (typeof o.onConfirm === "function") o.onConfirm();
    });
  }

  /* ------------------------------------------------------------------------
     StatusPill — order statuses. Colours are in admin.css (.ig-pill-*).
     statusPill("Paid") -> HTML string (escaped). Unknown values fall back
     to a neutral pill showing the value as-is (escaped, never raw).
     ------------------------------------------------------------------------ */
  var STATUS_CLASS = {
    pending: "ig-pill-pending", paid: "ig-pill-paid",
    processing: "ig-pill-processing", shipped: "ig-pill-shipped",
    delivered: "ig-pill-delivered", canceled: "ig-pill-canceled",
    refunded: "ig-pill-refunded"
  };
  function statusPill(status) {
    var key = String(status || "").trim().toLowerCase();
    var cls = STATUS_CLASS[key] || "ig-pill-refunded";
    var label = key ? key.charAt(0).toUpperCase() + key.slice(1) : "—";
    return '<span class="ig-pill ' + cls + '">' + escHtml(label) + "</span>";
  }
  function statusPillEl(status) {
    var span = document.createElement("span");
    var key = String(status || "").trim().toLowerCase();
    span.className = "ig-pill " + (STATUS_CLASS[key] || "ig-pill-refunded");
    span.textContent = key ? key.charAt(0).toUpperCase() + key.slice(1) : "—";
    return span;
  }

  /* ------------------------------------------------------------------------
     KPI card + sparkline — values are passed in by the caller (real data
     only). sparkline() draws a tiny SVG polyline with a dot on the last
     point; empty arrays render nothing (no fake line).
     buildKpiCard({ label, value, deltaText, deltaKind, sparkValues, sub })
     deltaKind: "pos" | "neg" | "flat"
     ------------------------------------------------------------------------ */
  function sparklineSVG(values, stroke) {
    if (!values || !values.length) return "";
    var w = 72, h = 34, pad = 3;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var pts = values.map(function (v, i) {
      var x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    var last = pts.split(" ").pop().split(",");
    var col = stroke || "var(--primary)";
    return '<svg viewBox="0 0 ' + w + " " + h + '" aria-hidden="true">'
      + '<polyline points="' + escHtml(pts) + '" fill="none" stroke="' + escHtml(col)
      + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
      + '<circle cx="' + escHtml(last[0]) + '" cy="' + escHtml(last[1])
      + '" r="3" fill="' + escHtml(col) + '"/></svg>';
  }
  function buildKpiCard(opts) {
    var o = opts || {};
    var card = document.createElement("div");
    card.className = "ig-card ig-kpi";
    var deltaCls = o.deltaKind === "neg" ? "neg" : o.deltaKind === "flat" ? "flat" : "pos";
    var delta = o.deltaText ? '<span class="ig-kpi-delta ' + deltaCls + '">' + escHtml(o.deltaText) + "</span>" : "";
    var spark = o.sparkValues && o.sparkValues.length
      ? '<span class="ig-kpi-spark">' + sparklineSVG(o.sparkValues, o.sparkColor) + "</span>" : "";
    card.innerHTML =
      '<div class="ig-kpi-top"><span class="ig-kpi-label">' + escHtml(o.label || "") + "</span>" + delta + "</div>"
      + '<div class="ig-kpi-value">' + escHtml(o.value == null ? "—" : String(o.value)) + "</div>"
      + (o.sub ? '<div class="ig-kpi-sub">' + escHtml(o.sub) + "</div>" : "")
      + spark;
    return card;
  }

  /* ------------------------------------------------------------------------
     Empty state + skeleton helpers.
     emptyState({ title, message, actionLabel, onAction }) -> element.
     showSkeleton(container, rows) fills a container with skeleton rows;
     clearSkeleton(container) empties it. Callers replace skeletons with
     real rows (or an empty state) once data arrives.
     ------------------------------------------------------------------------ */
  function emptyState(opts) {
    var o = opts || {};
    var el = document.createElement("div");
    el.className = "ig-state";
    el.innerHTML = "<b>" + escHtml(o.title || "Nothing here yet") + "</b>"
      + "<p>" + escHtml(o.message || "") + "</p>";
    if (o.actionLabel && typeof o.onAction === "function") {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ig-btn ig-btn-primary";
      btn.textContent = o.actionLabel;
      btn.addEventListener("click", o.onAction);
      el.appendChild(btn);
    }
    return el;
  }
  function showSkeleton(container, rows) {
    if (!container) return;
    container.innerHTML = "";
    for (var i = 0; i < (rows || 3); i++) {
      var s = document.createElement("div");
      s.className = "ig-skeleton ig-skeleton-text";
      s.style.width = (92 - i * 7) + "%";
      container.appendChild(s);
    }
  }
  function clearSkeleton(container) { if (container) container.innerHTML = ""; }

  /* ------------------------------------------------------------------------
     Pagination (pure) + pager builder.
     paginate(total, page, pageSize) -> { totalPages, page, start, end }
     buildPagination(total, page, pageSize, onPage) -> nav element
     (‹ 1 2 3 … N ›, with a window around the current page).
     ------------------------------------------------------------------------ */
  function paginate(total, page, pageSize) {
    var size = Math.max(1, pageSize | 0 || 10);
    var totalPages = Math.max(1, Math.ceil((total | 0) / size));
    var p = Math.min(Math.max(1, page | 0 || 1), totalPages);
    return { totalPages: totalPages, page: p, start: (p - 1) * size + 1, end: Math.min(total | 0, p * size) };
  }
  function buildPagination(total, page, pageSize, onPage) {
    var pg = paginate(total, page, pageSize);
    var nav = document.createElement("nav");
    nav.className = "ig-pagination";
    nav.setAttribute("aria-label", "Pagination");
    function btn(label, target, disabled, active) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.disabled = !!disabled;
      if (active) b.classList.add("active");
      b.addEventListener("click", function () { if (typeof onPage === "function") onPage(target); });
      return b;
    }
    nav.appendChild(btn("‹", pg.page - 1, pg.page <= 1));
    var pages = [1];
    for (var i = pg.page - 1; i <= pg.page + 1; i++) if (i > 1 && i < pg.totalPages) pages.push(i);
    if (pg.totalPages > 1) pages.push(pg.totalPages);
    var last = 0;
    pages.forEach(function (p) {
      if (p - last > 1) { var s = document.createElement("span"); s.textContent = "…"; nav.appendChild(s); }
      nav.appendChild(btn(String(p), p, false, p === pg.page));
      last = p;
    });
    nav.appendChild(btn("›", pg.page + 1, pg.page >= pg.totalPages));
    var info = document.createElement("span");
    info.className = "ig-page-info";
    info.textContent = total ? ("Showing " + pg.start + "–" + pg.end + " of " + total) : "No records";
    nav.appendChild(info);
    return nav;
  }

  /* ------------------------------------------------------------------------
     Tabs — wire [data-ig-tabs] buttons: click switches .active and shows
     the matching [data-ig-tab-panel="<id>"] panel, hides the rest.
     ------------------------------------------------------------------------ */
  function initTabs(root) {
    (root || document).querySelectorAll("[data-ig-tabs]").forEach(function (group) {
      group.querySelectorAll("button[data-ig-tab]").forEach(function (b) {
        b.addEventListener("click", function () {
          group.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          var id = b.getAttribute("data-ig-tab");
          document.querySelectorAll("[data-ig-tab-panel]").forEach(function (p) {
            p.hidden = p.getAttribute("data-ig-tab-panel") !== id;
          });
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Topbar wiring — theme toggle, avatar menu, mobile sidebar, "/" search.
     initTopbar() is a no-op for elements that do not exist yet.
     ------------------------------------------------------------------------ */
  function initTopbar() {
    document.querySelectorAll("[data-ig-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", toggleTheme);
    });
    syncThemeToggle();
    document.querySelectorAll("[data-ig-avatar-btn]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var drop = b.parentElement && b.parentElement.querySelector(".ig-avatar-drop");
        if (drop) drop.classList.toggle("open");
      });
    });
    document.addEventListener("click", function () {
      document.querySelectorAll(".ig-avatar-drop.open").forEach(function (d) { d.classList.remove("open"); });
    });
    document.querySelectorAll("[data-ig-menu-btn]").forEach(function (b) {
      b.addEventListener("click", function () { document.body.classList.toggle("ig-sidebar-open"); });
    });
    document.querySelectorAll(".ig-sidebar-scrim").forEach(function (s) {
      s.addEventListener("click", function () { document.body.classList.remove("ig-sidebar-open"); });
    });
    document.querySelectorAll("[data-ig-bell]").forEach(function (b) {
      b.addEventListener("click", function () { setBellCount(0); });
    });
  }
  function setBellCount(n) {
    document.querySelectorAll("[data-ig-bell-badge]").forEach(function (el) {
      var v = Number(n) || 0;
      el.textContent = v > 99 ? "99+" : String(v);
      el.hidden = v <= 0;
    });
  }
  function initGlobalSearch(onQuery) {
    var input = document.querySelector("[data-ig-global-search]");
    if (input && typeof onQuery === "function") {
      input.addEventListener("input", function () { onQuery(input.value); });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) {
        var s = document.querySelector("[data-ig-global-search]");
        if (s) { e.preventDefault(); s.focus(); }
      }
    });
  }

  /* ------------------------------------------------------------------------
     Date-range picker — presets only; the caller filters with the returned
     range. buildDateRangePicker(container, { presets, onChange }) renders
     a <select> (Today / 7 days / 30 days / This month / Custom) + two date
     inputs shown for Custom. onChange({ preset, start, end, label }).
     Dates are real calendar dates; no data is fetched here.
     ------------------------------------------------------------------------ */
  function buildDateRangePicker(container, opts) {
    if (!container) return null;
    var o = opts || {};
    var presets = o.presets || ["Today", "7 days", "30 days", "This month", "Custom"];
    var wrap = document.createElement("div");
    wrap.className = "ig-daterange";
    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Date range");
    presets.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p; opt.textContent = p;
      sel.appendChild(opt);
    });
    if (o.defaultPreset) sel.value = o.defaultPreset;
    var from = document.createElement("input");
    from.type = "date"; from.style.display = "none"; from.setAttribute("aria-label", "From date");
    var to = document.createElement("input");
    to.type = "date"; to.style.display = "none"; to.setAttribute("aria-label", "To date");
    wrap.appendChild(sel); wrap.appendChild(from); wrap.appendChild(to);
    function emit() {
      if (typeof o.onChange !== "function") return;
      var preset = sel.value;
      var today = new Date();
      function iso(d) { return d.toISOString().slice(0, 10); }
      var start = null, end = iso(today);
      if (preset === "Today") start = end;
      else if (preset === "7 days") { var d7 = new Date(today); d7.setDate(d7.getDate() - 6); start = iso(d7); }
      else if (preset === "30 days") { var d30 = new Date(today); d30.setDate(d30.getDate() - 29); start = iso(d30); }
      else if (preset === "This month") { start = iso(today).slice(0, 8) + "01"; }
      else { start = from.value || null; end = to.value || end; }
      o.onChange({ preset: preset, start: start, end: end, label: preset });
    }
    sel.addEventListener("change", function () {
      var custom = sel.value === "Custom";
      from.style.display = custom ? "" : "none";
      to.style.display = custom ? "" : "none";
      emit();
    });
    from.addEventListener("change", emit);
    to.addEventListener("change", emit);
    container.appendChild(wrap);
    return { element: wrap, select: sel, getValue: function () { return { preset: sel.value, start: from.value, end: to.value }; } };
  }

  /* ------------------------------------------------------------------------
     Product tile builder — real product object in, escaped tile out.
     product: { name, category, price, oldPrice, imageUrl, discountPct,
       isHot, isNew, soldOut, rating, reviewCount }
     Rating: if rating/reviewCount are missing, the tile shows
     "No ratings yet" — it never invents stars.
     ------------------------------------------------------------------------ */
  function buildProductTile(product) {
    var p = product || {};
    var tile = document.createElement("div");
    tile.className = "ig-tile";
    var img = igSafeImgUrl(p.imageUrl) || "../logo.png";
    var discount = (p.discountPct != null) ? p.discountPct
      : (p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
    var ratingHtml;
    if (p.rating != null && p.reviewCount != null) {
      var stars = "★".repeat(Math.round(Number(p.rating) || 0)) + "☆".repeat(5 - Math.round(Number(p.rating) || 0));
      ratingHtml = '<div class="ig-tile-rating">' + escHtml(stars) + " (" + escHtml(formatFull(p.reviewCount)) + ")</div>";
    } else {
      ratingHtml = '<div class="ig-tile-rating"><span class="ig-no-rating">No ratings yet</span></div>';
    }
    tile.innerHTML =
      (discount > 0 ? '<span class="ig-badge ig-badge-discount">-' + escHtml(discount) + "%</span>" : "")
      + '<img class="ig-tile-img" src="' + escHtml(img) + '" alt="' + escHtml(p.name || "Product") + '" loading="lazy"/>'
      + '<div class="ig-tile-cat">' + escHtml(p.category || "") + "</div>"
      + '<div class="ig-tile-name">' + escHtml(p.name || "") + "</div>"
      + '<div class="ig-tile-price"><b>' + escHtml(formatPKR(p.price)) + "</b>"
      + (p.oldPrice > p.price ? "<s>" + escHtml(formatPKR(p.oldPrice)) + "</s>" : "") + "</div>"
      + ratingHtml
      + ((p.isHot || p.isNew || p.soldOut)
        ? '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">'
        + (p.isHot ? '<span class="ig-badge ig-badge-hot">Hot</span>' : "")
        + (p.isNew ? '<span class="ig-badge ig-badge-new">New</span>' : "")
        + (p.soldOut ? '<span class="ig-badge ig-badge-soldout">Sold out</span>' : "") + "</div>" : "");
    return tile;
  }

  /* Segmented control — buildSegmented(container, ["Weekly","Monthly","Yearly"], onChange) */
  function buildSegmented(container, options, onChange) {
    if (!container) return null;
    var wrap = document.createElement("div");
    wrap.className = "ig-segmented";
    wrap.setAttribute("role", "group");
    (options || []).forEach(function (label, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (i === 0) b.classList.add("active");
      b.addEventListener("click", function () {
        wrap.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        if (typeof onChange === "function") onChange(label);
      });
      wrap.appendChild(b);
    });
    container.appendChild(wrap);
    return wrap;
  }

  /* Auto-init (safe no-ops): theme fallback + overlay dismiss + tabs. */
  function initAll() {
    initTheme();
    wireOverlayDismiss();
    initTabs(document);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  global.IGAdminUI = {
    escHtml: escHtml, igSafeImgUrl: igSafeImgUrl,
    initTheme: initTheme, getTheme: getTheme, setTheme: setTheme, toggleTheme: toggleTheme,
    formatPKR: formatPKR, formatNum: formatNum, formatFull: formatFull,
    formatDateDDMMYYYY: formatDateDDMMYYYY, formatDateTimePKT: formatDateTimePKT,
    toast: toast,
    openModal: openModal, closeModal: closeModal, openDrawer: openDrawer, closeDrawer: closeDrawer,
    armConfirm: armConfirm,
    statusPill: statusPill, statusPillEl: statusPillEl,
    sparklineSVG: sparklineSVG, buildKpiCard: buildKpiCard,
    emptyState: emptyState, showSkeleton: showSkeleton, clearSkeleton: clearSkeleton,
    paginate: paginate, buildPagination: buildPagination,
    initTabs: initTabs, initTopbar: initTopbar, setBellCount: setBellCount,
    initGlobalSearch: initGlobalSearch, buildDateRangePicker: buildDateRangePicker,
    buildProductTile: buildProductTile, buildSegmented: buildSegmented,
    initAll: initAll
  };
})(window);
