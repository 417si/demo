/* =====================================================================
   gallery.js — 公演写真ギャラリー（gallery.html）
   ・最初にネタバレ注意を表示（同じタブでは1回だけ）
   ・写真は投稿順に上から並べる（列の高さをそろえながら左上→右下へ）
   ・キャラクターで絞り込み、タップで拡大（スワイプ / ← → で前後へ）
   ===================================================================== */
(function () {
  "use strict";

  var G = window.MKPGallery;
  if (!G) return;
  var esc = G.esc, S = G.store, cfg = G.cfg;
  var root = document.documentElement;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function lock(on) { root.classList.toggle("is-locked", !!on); }

  var grid = $("[data-grid]"), statusEl = $("[data-status]"), filterEl = $("[data-filter]"), moreEl = $("[data-more]");
  var all = [], view = [], active = [], mode = "any", rendered = 0, cols = [], colH = [], nCols = 0;
  var PAGE = 36, accepted = false, loaded = false;
  var CACHE = "mkp26-gallery-cache";

  var CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3l2-2h6l2 2h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>';
  var XICON = '<svg class="x" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"/></svg>';

  /* ------------------------------------------------------------ spoiler notice */
  function spoiler() {
    var el = $("[data-spoiler]");
    var msg = cfg.spoiler || "このページには公演内容に関する情報が含まれています。\nまだ公演をご覧になっていない方は、ご注意ください。";
    $("[data-spoiler-msg]").innerHTML = esc(msg).replace(/\n/g, "<br>");
    if (S.sget("mkp26-spoiler-ok") === "1") { accept(); return; }
    el.hidden = false;
    lock(true);
    root.classList.add("is-spoiler");
    var ok = $("[data-spoiler-ok]");
    ok.addEventListener("click", function () {
      S.sset("mkp26-spoiler-ok", "1");
      el.classList.add("is-leaving");
      root.classList.remove("is-spoiler");
      lock(false);
      setTimeout(function () { el.hidden = true; }, 600);
      accept();
    });
    setTimeout(function () { ok.focus({ preventScroll: true }); }, 50);
  }
  function accept() {
    accepted = true;
    if (loaded) paintAll(); else statusEl.textContent = "写真を読み込んでいます…";
  }

  /* ------------------------------------------------------------ data */
  function readCache() {
    if (G.demo) return null;
    try { var c = JSON.parse(S.get(CACHE) || "null"); return Array.isArray(c) ? c : null; } catch (e) { return null; }
  }
  function load() {
    var cached = readCache();
    if (cached && cached.length) { all = G.sortPhotos(cached); loaded = true; if (accepted) paintAll(); }
    G.api.list().then(function (list) {
      var sorted = G.sortPhotos(list);
      var same = loaded && JSON.stringify(sorted) === JSON.stringify(all);
      all = sorted; loaded = true;
      if (!G.demo) S.set(CACHE, JSON.stringify(list));
      if (accepted && (!same || !rendered)) {
        if (viewerOpen) pendingRepaint = true; else paintAll();
      }
    }).catch(function (e) {
      if (loaded) return; // キャッシュで表示できている
      statusEl.innerHTML = "写真を読み込めませんでした。" + ' <button type="button" class="gal__retry" data-retry>もう一度読み込む</button>';
      $("[data-retry]").addEventListener("click", function () { statusEl.textContent = "写真を読み込んでいます…"; load(); });
      if (window.console) console.warn("[gallery]", e);
    });
  }

  /* ------------------------------------------------------------ filter */
  function counts() {
    var c = {};
    all.forEach(function (p) { (p.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return c;
  }
  function paintFilter() {
    var c = counts();
    var names = G.tags().filter(function (t) { return c[t]; });
    Object.keys(c).forEach(function (t) { if (names.indexOf(t) < 0 && G.tags().indexOf(t) < 0) names.push(t); }); // シートで直接追加されたタグも出す
    active = active.filter(function (t) { return c[t]; });
    $("[data-filter-bar]").hidden = !all.length;
    filterEl.innerHTML =
      '<button type="button" class="chip chip--all" data-f="" aria-pressed="' + (!active.length) + '">すべて<small>' + all.length + "</small></button>" +
      names.map(function (t) {
        var col = G.tagColor(t);
        return '<button type="button" class="chip" data-f="' + esc(t) + '" aria-pressed="' + (active.indexOf(t) >= 0) + '"' + (col ? ' style="--c:' + esc(col) + '"' : "") +
          "><i></i>" + esc(t) + "<small>" + c[t] + "</small></button>";
      }).join("");
    paintMode();
  }
  // 2人以上選んだときだけ「いずれか / 全員」を切り替えられる
  function paintMode() {
    modeEl.hidden = active.length < 2;
    $$("[data-mode]", modeEl).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
  }
  function writeHash() {
    var h = active.length ? "#tag=" + active.map(encodeURIComponent).join(",") + (mode === "all" && active.length > 1 ? "&all" : "") : "";
    try { history.replaceState(history.state, "", h || location.pathname + location.search); } catch (e) { /* noop */ }
  }
  // t = "" で全解除、t = "名前" でそのキャラを追加/解除、only = true でそのキャラだけにする
  function setFilter(t, scroll, only) {
    if (!t) active = [];
    else if (only) active = [t];
    else {
      var i = active.indexOf(t);
      if (i >= 0) active.splice(i, 1); else active.push(t);
    }
    $$("[data-f]", filterEl).forEach(function (b) {
      var f = b.getAttribute("data-f");
      b.setAttribute("aria-pressed", String(f ? active.indexOf(f) >= 0 : !active.length));
    });
    paintMode();
    writeHash();
    paintGrid();
    if (scroll) {
      var top = $(".gal").getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 64);
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: "auto" });
    }
    var sel = t && $('[data-f="' + (window.CSS && CSS.escape ? CSS.escape(t) : t) + '"]', filterEl);
    if (sel) {
      var bar = filterEl, br = bar.getBoundingClientRect(), r = sel.getBoundingClientRect();
      if (r.left < br.left || r.right > br.right) bar.scrollBy({ left: r.left - br.left - br.width / 2 + r.width / 2, behavior: "smooth" });
    }
  }
  filterEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return;
    setFilter(b.getAttribute("data-f"), true, false);
  });
  var modeEl = document.createElement("div");
  modeEl.className = "gal__mode";
  modeEl.setAttribute("role", "group");
  modeEl.setAttribute("aria-label", "絞り込みの条件");
  modeEl.hidden = true;
  modeEl.innerHTML = '<button type="button" data-mode="any">いずれかが写っている</button><button type="button" data-mode="all">全員が写っている</button>';
  $(".gal__wrap").insertBefore(modeEl, statusEl);
  modeEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-mode]"); if (!b) return;
    mode = b.getAttribute("data-mode");
    paintMode(); writeHash(); paintGrid();
  });

  /* ------------------------------------------------------------ masonry (順番を保ったまま、いちばん短い列へ) */
  function colCount() {
    var w = grid.clientWidth || window.innerWidth;
    return w < 560 ? 2 : w < 900 ? 3 : 4;
  }
  function resetCols() {
    nCols = colCount();
    grid.innerHTML = "";
    grid.style.setProperty("--cols", nCols);
    cols = []; colH = [];
    for (var i = 0; i < nCols; i++) {
      var c = document.createElement("div"); c.className = "gal__col"; grid.appendChild(c);
      cols.push(c); colH.push(0);
    }
    rendered = 0;
  }
  function sizesAttr() { return "calc((min(100vw, 1080px) - 32px) / " + nCols + ")"; }

  function tile(p, idx) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "gal__item";
    b.setAttribute("data-i", idx);
    var ratio = p.w && p.h ? p.w / p.h : 1.5;
    b.style.aspectRatio = ratio.toFixed(4);
    var label = G.creditLabel(p);
    b.setAttribute("aria-label", "写真" + (p.tags && p.tags.length ? "：" + p.tags.join("、") : "") + (label ? "（撮影：" + label + "）" : "") + " を拡大");
    var img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    if (!p.src) {
      img.srcset = G.imgUrl(p, 400) + " 400w, " + G.imgUrl(p, 800) + " 800w, " + G.imgUrl(p, 1200) + " 1200w";
      img.sizes = sizesAttr();
    }
    G.bindFallback(img, p, 800);
    img.addEventListener("load", function () { b.classList.add("is-loaded"); });
    img.src = G.imgUrl(p, 800);
    b.appendChild(img);
    if (label) {
      var cap = document.createElement("span");
      cap.className = "gal__cap";
      cap.innerHTML = CAMERA + esc(label);
      b.appendChild(cap);
    }
    return { el: b, h: 1 / ratio };
  }
  function renderMore() {
    var end = Math.min(view.length, rendered + PAGE);
    for (var i = rendered; i < end; i++) {
      var t = tile(view[i], i);
      var k = 0;
      for (var j = 1; j < nCols; j++) if (colH[j] < colH[k] - 0.02) k = j;
      cols[k].appendChild(t.el);
      colH[k] += t.h + 0.04;
    }
    rendered = end;
    moreEl.hidden = rendered >= view.length;
  }
  function paintGrid() {
    view = !active.length ? all.slice() : all.filter(function (p) {
      var tg = p.tags || [];
      var hit = function (t) { return tg.indexOf(t) >= 0; };
      return mode === "all" ? active.every(hit) : active.some(hit);
    });
    resetCols();
    if (!all.length) {
      statusEl.innerHTML = '<span class="gal__empty"><img src="assets/svg/emblem-ink.svg" alt="">まだ写真はありません。<br>公演のあと、順次公開していきます。</span>';
      moreEl.hidden = true;
      return;
    }
    statusEl.textContent = (active.length ? active.join("・") + " の写真 " : "全 ") + view.length + " 枚";
    renderMore();
  }
  function paintAll() { paintFilter(); paintGrid(); }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && rendered < view.length) renderMore();
    }, { rootMargin: "1400px 0px" }).observe(moreEl);
  }
  var rT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      if (!accepted || !loaded || !all.length) return;
      if (colCount() !== nCols) { var keep = rendered; paintGrid(); while (rendered < keep && rendered < view.length) renderMore(); }
    }, 150);
  });
  grid.addEventListener("click", function (e) {
    var b = e.target.closest("[data-i]"); if (!b) return;
    openViewer(+b.getAttribute("data-i"));
  });

  /* ------------------------------------------------------------ viewer */
  var vEl = $("[data-viewer]"), vImg = $("[data-v-img]"), vIdx = 0, viewerOpen = false, pendingRepaint = false, lastFocus = null;
  function paintViewer() {
    var p = view[vIdx]; if (!p) return;
    vEl.classList.add("is-loading");
    vImg.classList.remove("is-in");
    vImg.removeAttribute("srcset");
    var big = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) > 1400 ? 2000 : 1400;
    vImg.onload = function () { vEl.classList.remove("is-loading"); vImg.classList.add("is-in"); };
    vImg.onerror = function () {
      var fb = !p.src && "https://drive.google.com/thumbnail?id=" + encodeURIComponent(p.f) + "&sz=w" + big;
      if (fb && vImg.src !== fb) vImg.src = fb; else vEl.classList.remove("is-loading");
    };
    vImg.src = G.imgUrl(p, big);
    vImg.alt = (p.tags || []).join("、");
    $("[data-v-count]").textContent = (vIdx + 1) + " / " + view.length;
    var label = G.creditLabel(p);
    var x = p.x ? G.parseX(p.x) : null;
    var credit = label ? (x && x.url
      ? '<a class="credit" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + CAMERA + "<u>" + esc(label) + "</u>" + XICON + "</a>"
      : '<span class="credit">' + CAMERA + esc(label) + "</span>") : "";
    var tags = (p.tags || []).map(function (t) {
      var col = G.tagColor(t);
      return '<button type="button" class="chip chip--sm" data-vt="' + esc(t) + '"' + (col ? ' style="--c:' + esc(col) + '"' : "") + "><i></i>" + esc(t) + "</button>";
    }).join("");
    $("[data-v-info]").innerHTML = (tags ? '<div class="viewer__tags">' + tags + "</div>" : "") + credit;
    $("[data-v-prev]").disabled = vIdx <= 0;
    $("[data-v-next]").disabled = vIdx >= view.length - 1;
    // 前後を先読み
    [vIdx - 1, vIdx + 1].forEach(function (k) { if (view[k]) { var im = new Image(); im.src = G.imgUrl(view[k], big); } });
    if (vIdx >= rendered - 4 && rendered < view.length) renderMore();
  }
  function openViewer(i) {
    vIdx = i; viewerOpen = true; lastFocus = document.activeElement;
    vEl.hidden = false; lock(true);
    requestAnimationFrame(function () { vEl.classList.add("is-open"); });
    paintViewer();
    try { history.pushState({ mkpViewer: 1 }, ""); } catch (e) { /* noop */ }
    $("[data-v-close]").focus({ preventScroll: true });
  }
  function closeViewer(fromPop) {
    if (!viewerOpen) return;
    viewerOpen = false;
    vEl.classList.remove("is-open");
    lock(false);
    setTimeout(function () { if (!viewerOpen) { vEl.hidden = true; vImg.removeAttribute("src"); } }, 250);
    if (!fromPop && history.state && history.state.mkpViewer) { try { history.back(); } catch (e) { /* noop */ } }
    var t = grid.querySelector('[data-i="' + vIdx + '"]');
    if (t) { t.focus({ preventScroll: true }); var r = t.getBoundingClientRect(); if (r.top < 80 || r.bottom > window.innerHeight) t.scrollIntoView({ block: "center" }); }
    else if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (pendingRepaint) { pendingRepaint = false; paintAll(); }
  }
  function go(d) {
    var n = vIdx + d;
    if (n < 0 || n >= view.length) return;
    vIdx = n; paintViewer();
  }
  window.addEventListener("popstate", function () { if (viewerOpen) closeViewer(true); });
  $("[data-v-close]").addEventListener("click", function () { closeViewer(false); });
  $("[data-v-prev]").addEventListener("click", function () { go(-1); });
  $("[data-v-next]").addEventListener("click", function () { go(1); });
  $("[data-v-stage]").addEventListener("click", function (e) { if (e.target === e.currentTarget) closeViewer(false); });
  $("[data-v-info]").addEventListener("click", function (e) {
    var t = e.target.closest("[data-vt]"); if (!t) return;
    closeViewer(false);
    setTimeout(function () { setFilter(t.getAttribute("data-vt"), true, true); }, 60);
  });
  document.addEventListener("keydown", function (e) {
    if (!viewerOpen) return;
    if (e.key === "Escape") closeViewer(false);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  });
  // スワイプ（左右で前後、下で閉じる）
  var sx = null, sy = 0, st = $("[data-v-stage]");
  st.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } else sx = null; }, { passive: true });
  st.addEventListener("touchmove", function (e) {
    if (sx == null) return;
    var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy)) vImg.style.transform = "translateX(" + dx * 0.6 + "px)";
    else if (dy > 0) vImg.style.transform = "translateY(" + dy * 0.6 + "px)";
  }, { passive: true });
  st.addEventListener("touchend", function (e) {
    vImg.style.transform = "";
    if (sx == null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && dy > Math.abs(dx)) closeViewer(false);
  });

  /* ------------------------------------------------------------ boot */
  var m = location.hash.match(/^#tag=(.+)$/);
  if (m) {
    var parts = m[1].split("&");
    try { active = parts[0].split(",").map(decodeURIComponent).filter(Boolean); } catch (e) { active = []; }
    if (parts.indexOf("all") > 0) mode = "all";
  }
  if (G.demo) {
    var note = document.createElement("p");
    note.className = "gal__demo";
    note.innerHTML = "デモモードで表示中です（データベース未接続）。見本の写真が表示されています。";
    $(".gal__wrap").insertBefore(note, statusEl);
  }
  load();
  spoiler();
})();
