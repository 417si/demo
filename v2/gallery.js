/* =====================================================================
   gallery.js — 本をひらいたあとの、ふつうのギャラリーサイト（v2/index.html の .site）
   ・写真はXのハッシュタグ版ギャラリーと同じデータ（スプレッドシート）。投稿順（新しい順）に並べる
   ・一定の枚数（gallery.perPage、初期値 48）ごとにページを分ける
   ・キャラクターで絞り込み、タップで拡大（左右スワイプ / ← → で前後へ）
   ・ハンバーガーメニュー（物語・キャラクター・公演情報・About）
   ===================================================================== */
(function () {
  "use strict";

  var G = window.MKPGallery, V = window.V2;
  if (!G) return;
  var esc = G.esc, S = G.store, cfg = G.cfg, SITE = V.site;
  var root = document.documentElement;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var filterBar = $("[data-filter-bar]"), toggleEl = $("[data-filter-toggle]"), panelEl = $("[data-panel-filter]"), activeEl = $("[data-active]"), countEl = $("[data-filter-count]");
  var filterEl = $("[data-filter]"), modeBox = $("[data-mode-box]"), statusEl = $("[data-status]"), grid = $("[data-grid]"), pagerEl = $("[data-pager]");
  var all = [], view = [], active = [], mode = "any", cols = [], colH = [], nCols = 0, page = 1;
  var PER = Math.max(12, Math.min(200, +cfg.perPage || 48));
  var visible = false, loaded = false, lbOpen = false, pendingData = null;
  var CACHE = "mkp26-gallery-cache-x-" + G.hashtag; // 今のギャラリーと同じ保存先（一度見た人は、すぐ表示できる）

  var CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3l2-2h6l2 2h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"/></svg>';

  /* ------------------------------------------------------------ hash（#gallery&tag=…&all&page=2） */
  function parseHash() {
    var parts = location.hash.replace(/^#/, "").split("&"), on = parts[0] === "gallery";
    if (!on) return false;
    active = []; mode = "any"; page = 1;
    parts.slice(1).forEach(function (kv) {
      var i = kv.indexOf("="), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "" : kv.slice(i + 1);
      if (k === "tag") { try { active = v.split(",").map(decodeURIComponent).filter(Boolean); } catch (e) { active = []; } }
      else if (k === "all") mode = "all";
      else if (k === "page") page = Math.max(1, parseInt(v, 10) || 1);
    });
    return true;
  }
  function writeHash() {
    if (!visible) return;
    var parts = ["gallery"];
    if (active.length) parts.push("tag=" + active.map(encodeURIComponent).join(","));
    if (mode === "all" && active.length > 1) parts.push("all");
    if (page > 1) parts.push("page=" + page);
    try { history.replaceState(history.state, "", "#" + parts.join("&")); } catch (e) { /* noop */ }
  }

  /* ------------------------------------------------------------ data */
  function readCache() { try { var c = JSON.parse(S.get(CACHE) || "null"); return Array.isArray(c) ? c : null; } catch (e) { return null; } }
  function load() {
    var cached = readCache();
    if (cached && cached.length) { all = G.sortPhotos(cached); loaded = true; if (visible) paintAll(); }
    G.api.list().then(function (list) {
      var sorted = G.sortPhotos(list);
      var same = loaded && JSON.stringify(sorted) === JSON.stringify(all);
      S.set(CACHE, JSON.stringify(list));
      if (same) return;
      if (lbOpen) { pendingData = sorted; return; }
      all = sorted; loaded = true;
      if (visible) paintAll();
    }).catch(function (e) {
      if (loaded) return;
      statusEl.innerHTML = '写真を読み込めませんでした。<button type="button" class="gal__retry" data-retry>もう一度読み込む</button>';
      var r = $("[data-retry]"); if (r) r.addEventListener("click", function () { statusEl.textContent = "写真を読み込んでいます…"; load(); });
      if (window.console) console.warn("[gallery]", e);
    });
  }

  /* ------------------------------------------------------------ 絞り込み */
  function counts() { var c = {}; all.forEach(function (p) { (p.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); }); return c; }
  function paintFilter() {
    var c = counts(), names = G.tags().filter(function (t) { return c[t]; });
    Object.keys(c).forEach(function (t) { if (names.indexOf(t) < 0 && G.tags().indexOf(t) < 0) names.push(t); });
    active = active.filter(function (t) { return c[t]; });
    filterBar.hidden = !all.length;
    filterEl.innerHTML =
      '<button type="button" class="fchip" data-f="" aria-pressed="' + (!active.length) + '"><i style="background:linear-gradient(135deg,#bdf2dc,#c8b4f2,#f6c4dd)"></i>すべて<small>' + all.length + "</small></button>" +
      names.map(function (t) {
        var st = G.tagStyle(t);
        return '<button type="button" class="fchip" data-f="' + esc(t) + '" aria-pressed="' + (active.indexOf(t) >= 0) + '"' + (st ? ' style="' + esc(st) + '"' : "") + "><i></i>" + esc(t) + "<small>" + c[t] + "</small></button>";
      }).join("");
    countEl.textContent = names.length;
    paintActive(); paintMode();
  }
  function paintActive() {
    activeEl.innerHTML = active.map(function (t) {
      var st = G.tagStyle(t);
      return '<button type="button" class="fchip fchip--sm" data-a="' + esc(t) + '" aria-pressed="false" aria-label="' + esc(t) + ' の絞り込みを外す"' + (st ? ' style="' + esc(st) + '"' : "") + "><i></i>" + esc(t) + '<span class="x" aria-hidden="true">×</span></button>';
    }).join("");
  }
  function paintMode() {
    modeBox.hidden = active.length < 2;
    $$("[data-mode]", modeBox).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
  }
  function setPanel(open) { panelEl.hidden = !open; toggleEl.setAttribute("aria-expanded", String(open)); }
  toggleEl.addEventListener("click", function () { setPanel(panelEl.hidden); });
  activeEl.addEventListener("click", function (e) { var b = e.target.closest("[data-a]"); if (b) setFilter(b.getAttribute("data-a"), false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panelEl.hidden && !lbOpen && !(V.panelOpen && V.panelOpen())) setPanel(false); });
  // t = "" で全解除 / "名前" でそのキャラを追加・解除 / only = true でそのキャラだけにする
  function setFilter(t, only) {
    if (!t) active = [];
    else if (only) active = [t];
    else { var i = active.indexOf(t); if (i >= 0) active.splice(i, 1); else active.push(t); }
    $$("[data-f]", filterEl).forEach(function (b) { var f = b.getAttribute("data-f"); b.setAttribute("aria-pressed", String(f ? active.indexOf(f) >= 0 : !active.length)); });
    paintMode(); paintActive();
    page = 1;
    paintGrid();
    scrollToList();
    if (t && window.innerWidth < 700) setPanel(false);
  }
  filterEl.addEventListener("click", function (e) { var b = e.target.closest("[data-f]"); if (b) setFilter(b.getAttribute("data-f"), false); });
  modeBox.addEventListener("click", function (e) { var b = e.target.closest("[data-mode]"); if (!b) return; mode = b.getAttribute("data-mode"); paintMode(); page = 1; paintGrid(); });

  function scrollToList() {
    var hh = parseFloat(getComputedStyle(root).getPropertyValue("--top-h")) || 54;
    var top = $(".gal").getBoundingClientRect().top + window.scrollY - hh - (filterBar.offsetHeight || 0);
    if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }

  /* ------------------------------------------------------------ 一覧（列の高さをそろえながら、投稿順に並べる） */
  function colCount() { var w = grid.clientWidth || window.innerWidth; return w < 560 ? 2 : w < 900 ? 3 : 4; }
  function resetCols() {
    nCols = colCount();
    grid.innerHTML = ""; cols = []; colH = [];
    for (var i = 0; i < nCols; i++) { var c = document.createElement("div"); c.className = "gal__col"; grid.appendChild(c); cols.push(c); colH.push(0); }
  }
  function sizesAttr() { return "calc((min(100vw, 1100px) - 32px) / " + nCols + ")"; }
  function tile(p, idx) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "tile"; b.setAttribute("data-i", idx);
    var ratio = p.w && p.h ? p.w / p.h : 1.5;
    b.style.aspectRatio = ratio.toFixed(4);
    var label = G.creditLabel(p);
    b.setAttribute("aria-label", "写真" + (label ? "（撮影：" + label + "）" : "") + " を拡大");
    var img = document.createElement("img");
    img.alt = ""; img.loading = "lazy"; img.decoding = "async";
    if (!p.src) { img.srcset = G.imgUrl(p, 400) + " 400w, " + G.imgUrl(p, 800) + " 800w, " + G.imgUrl(p, 1200) + " 1200w"; img.sizes = sizesAttr(); }
    G.bindFallback(img, p, 800);
    img.addEventListener("load", function () { b.classList.add("is-loaded"); });
    img.src = G.imgUrl(p, 800);
    b.appendChild(img);
    if (label) { var cap = document.createElement("span"); cap.className = "tile__cap"; cap.textContent = label; b.appendChild(cap); }
    return { el: b, h: 1 / ratio };
  }
  function pageCount() { return Math.max(1, Math.ceil(view.length / PER)); }
  function pageOf(i) { return Math.floor(i / PER) + 1; }
  function renderPage() {
    resetCols();
    var from = (page - 1) * PER, end = Math.min(view.length, from + PER);
    for (var i = from; i < end; i++) {
      var t = tile(view[i], i), k = 0;
      for (var j = 1; j < nCols; j++) if (colH[j] < colH[k] - 0.02) k = j;
      cols[k].appendChild(t.el);
      colH[k] += t.h + 0.05;
    }
  }
  function paintPager() {
    var n = pageCount();
    pagerEl.hidden = n <= 1;
    if (n <= 1) { pagerEl.innerHTML = ""; return; }
    var nums = [], last = 0;
    for (var i = 1; i <= n; i++) {
      if (i === 1 || i === n || Math.abs(i - page) <= 1 || (page <= 3 && i <= 4) || (page >= n - 2 && i >= n - 3)) {
        if (last && i - last > 1) nums.push("…");
        nums.push(i); last = i;
      }
    }
    pagerEl.innerHTML =
      '<button type="button" class="pager__nav" data-pg="' + (page - 1) + '"' + (page <= 1 ? " disabled" : "") + ' aria-label="前のページ">‹</button>' +
      nums.map(function (v) {
        return v === "…" ? '<span class="pager__gap" aria-hidden="true">…</span>'
          : '<button type="button" class="pager__num" data-pg="' + v + '"' + (v === page ? ' aria-current="page"' : "") + ' aria-label="' + v + 'ページ目">' + v + "</button>";
      }).join("") +
      '<button type="button" class="pager__nav" data-pg="' + (page + 1) + '"' + (page >= n ? " disabled" : "") + ' aria-label="次のページ">›</button>';
  }
  function setStatus() {
    var n = pageCount();
    statusEl.textContent = (active.length ? active.join("・") + " の写真 " : "全 ") + view.length + " 枚" + (n > 1 ? "（" + page + " / " + n + " ページ）" : "");
  }
  function gotoPage(n) {
    n = Math.max(1, Math.min(pageCount(), n));
    if (n === page) return;
    page = n;
    renderPage(); paintPager(); setStatus(); writeHash(); scrollToList();
  }
  pagerEl.addEventListener("click", function (e) { var b = e.target.closest("[data-pg]"); if (b && !b.disabled) gotoPage(+b.getAttribute("data-pg")); });
  function paintGrid() {
    view = !active.length ? all.slice() : all.filter(function (p) {
      var tg = p.tags || [], hit = function (t) { return tg.indexOf(t) >= 0; };
      return mode === "all" ? active.every(hit) : active.some(hit);
    });
    page = Math.max(1, Math.min(pageCount(), page));
    resetCols();
    if (!all.length) {
      statusEl.innerHTML = '<span class="gal__empty"><img src="../assets/img/emblem-ink.png" alt="">まだ写真はありません。<br>公演のあと、順次公開していきます。</span>';
      pagerEl.hidden = true;
      return;
    }
    setStatus(); renderPage(); paintPager(); writeHash();
  }
  function paintAll() { paintFilter(); paintGrid(); }
  grid.addEventListener("click", function (e) { var b = e.target.closest("[data-i]"); if (b) openLb(+b.getAttribute("data-i")); });
  var rT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () { if (visible && loaded && all.length && colCount() !== nCols) renderPage(); }, 150);
  });

  /* ------------------------------------------------------------ 拡大表示 */
  var lb = $("[data-lb]"), lbImg = $("[data-lb-img]"), lbPrint = $("[data-lb-print]"), lbIdx = 0, lastFocus = null;
  function paintLb() {
    var p = view[lbIdx]; if (!p) return;
    lb.classList.add("is-loading"); lbPrint.classList.remove("is-in");
    var big = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) > 1400 ? 2000 : 1400;
    lbImg.onload = function () { lb.classList.remove("is-loading"); lbPrint.classList.add("is-in"); };
    lbImg.onerror = function () {
      var fb = !p.src && "https://drive.google.com/thumbnail?id=" + encodeURIComponent(p.f) + "&sz=w" + big;
      if (fb && lbImg.src !== fb) lbImg.src = fb; else lb.classList.remove("is-loading");
    };
    lbImg.removeAttribute("srcset");
    lbImg.src = G.imgUrl(p, big);
    lbImg.alt = (p.tags || []).join("、");
    $("[data-lb-count]").textContent = "No. " + (lbIdx + 1) + " / " + view.length;
    var label = G.creditLabel(p), x = p.x ? G.parseX(p.x) : null;
    var credit = label ? (x && x.url
      ? '<a class="lb__credit" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + CAMERA + "<u>" + esc(label) + "</u>" + XICON + "</a>"
      : '<span class="lb__credit">' + CAMERA + esc(label) + "</span>") : "";
    var tags = (p.tags || []).map(function (t) {
      var st = G.tagStyle(t);
      return '<button type="button" class="chip" data-vt="' + esc(t) + '"' + (st ? ' style="' + esc(st) + '"' : "") + "><i></i>" + esc(t) + "</button>";
    }).join("");
    $("[data-lb-info]").innerHTML = (tags ? '<div class="lb__tags">' + tags + "</div>" : "") + credit;
    $("[data-lb-prev]").disabled = lbIdx <= 0;
    $("[data-lb-next]").disabled = lbIdx >= view.length - 1;
    [lbIdx - 1, lbIdx + 1].forEach(function (k) { if (view[k]) { var im = new Image(); im.src = G.imgUrl(view[k], big); } });
  }
  function openLb(i) {
    lbIdx = i; lbOpen = true; lastFocus = document.activeElement;
    lb.hidden = false; root.classList.add("is-locked");
    requestAnimationFrame(function () { lb.classList.add("is-open"); });
    paintLb();
    try { history.pushState({ v2Lb: 1 }, ""); } catch (e) { /* noop */ }
    $("[data-lb-close]").focus({ preventScroll: true });
  }
  function closeLb(fromPop) {
    if (!lbOpen) return;
    lbOpen = false;
    lb.classList.remove("is-open"); root.classList.remove("is-locked");
    setTimeout(function () { if (!lbOpen) { lb.hidden = true; lbImg.removeAttribute("src"); } }, 250);
    if (!fromPop && history.state && history.state.v2Lb) { try { history.back(); } catch (e) { /* noop */ } }
    if (pendingData) { all = pendingData; pendingData = null; paintAll(); }
    else if (pageOf(lbIdx) !== page) { page = pageOf(lbIdx); renderPage(); paintPager(); setStatus(); writeHash(); } // 拡大表示で別のページまで進んだら、そのページを開く
    var t = grid.querySelector('[data-i="' + lbIdx + '"]');
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) { /* noop */ } var r = t.getBoundingClientRect(); if (r.top < 90 || r.bottom > window.innerHeight) t.scrollIntoView({ block: "center" }); }
    else if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
  }
  function lbGo(d) { var n = lbIdx + d; if (n < 0 || n >= view.length) return; lbIdx = n; paintLb(); }
  window.addEventListener("popstate", function () { if (lbOpen) closeLb(true); });
  $("[data-lb-close]").addEventListener("click", function () { closeLb(false); });
  $("[data-lb-prev]").addEventListener("click", function () { lbGo(-1); });
  $("[data-lb-next]").addEventListener("click", function () { lbGo(1); });
  $("[data-lb-stage]").addEventListener("click", function (e) { if (e.target === e.currentTarget) closeLb(false); });
  $("[data-lb-info]").addEventListener("click", function (e) {
    var t = e.target.closest("[data-vt]"); if (!t) return;
    var name = t.getAttribute("data-vt");
    closeLb(false);
    setTimeout(function () { setFilter(name, true); }, 80);
  });
  document.addEventListener("keydown", function (e) {
    if (!lbOpen) return;
    if (e.key === "Escape") closeLb(false); else if (e.key === "ArrowRight") lbGo(1); else if (e.key === "ArrowLeft") lbGo(-1);
  });
  var lx = null, ly = 0, stg = $("[data-lb-stage]");
  stg.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { lx = e.touches[0].clientX; ly = e.touches[0].clientY; } else lx = null; }, { passive: true });
  stg.addEventListener("touchend", function (e) {
    if (lx == null) return;
    var dx = e.changedTouches[0].clientX - lx, dy = e.changedTouches[0].clientY - ly; lx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lbGo(dx < 0 ? 1 : -1);
    else if (dy > 90 && dy > Math.abs(dx)) closeLb(false);
  });

  /* ------------------------------------------------------------ ハンバーガーメニュー */
  var drawer = $("[data-drawer]"), menuBtn = $("[data-menu]"), menuOpen = false;
  function setMenu(on) {
    if (on === menuOpen) return;
    menuOpen = on;
    menuBtn.setAttribute("aria-expanded", String(on));
    menuBtn.setAttribute("aria-label", on ? "メニューを閉じる" : "メニューをひらく");
    if (on) {
      drawer.hidden = false; root.classList.add("is-locked");
      requestAnimationFrame(function () { requestAnimationFrame(function () { drawer.classList.add("is-open"); }); });
    } else {
      drawer.classList.remove("is-open"); root.classList.remove("is-locked");
      setTimeout(function () { if (!menuOpen) drawer.hidden = true; }, 420);
    }
  }
  menuBtn.addEventListener("click", function () { setMenu(!menuOpen); });
  $$("[data-drawer-close]").forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
  // メニューの項目をおしたら、メニューを閉じてパネルをひらく
  $$(".drawer [data-open]").forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen && !(V.panelOpen && V.panelOpen())) setMenu(false); });
  $("[data-top]").addEventListener("click", function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ------------------------------------------------------------ フッターの文 */
  $("[data-credit]").textContent = G.xmode ? "X（旧Twitter）の「#" + G.hashtag + "」の投稿から自動で集めています。写真の著作権は各投稿者に帰属します。掲載の削除をご希望の場合は、公式アカウントまでご連絡ください。" : "";
  $("[data-copy]").textContent = SITE.copyright || "";

  /* ------------------------------------------------------------ 外から使う（landing.js） */
  window.V2G = {
    parseHash: parseHash,
    // 本をひらいたあと、ギャラリーを表示する
    enter: function () {
      visible = true;
      window.scrollTo({ top: 0, behavior: "instant" });
      if (loaded) paintAll(); else statusEl.textContent = "写真を読み込んでいます…";
      writeHash();
    },
    leave: function () { visible = false; setMenu(false); setPanel(false); },
    isVisible: function () { return visible; },
  };
  load();
})();
