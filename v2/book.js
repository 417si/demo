/* =====================================================================
   book.js — トップページの本（v2/index.html）
   ・表紙（ポスター）をタップすると本がひらき、公演写真のギャラリーが出てくる
   ・PC は見開き、スマホは1ページずつ。ページをめくる動きつき（ページ送り＝ギャラリーのページ分け）
   ・キャラクターで絞り込み（扉ページの一覧 / 右上のしおり）
   ・写真をタップで拡大（左右スワイプ / ← → で前後へ）
   設定は data/content.js の book: { perPage, perPageSmall, note } で変えられます
   ===================================================================== */
(function () {
  "use strict";

  var G = window.MKPGallery, V2 = window.V2;
  if (!G) return;
  var SITE = window.SITE || {}, CFG = SITE.book || {};
  var esc = G.esc, S = G.store, ASSET = "../assets/";
  var root = document.documentElement;

  function $(s, c) { return (c || document).querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var bookEl = $("[data-book]"), slotL = $("[data-slot-l]"), slotR = $("[data-slot-r]"), hintEl = $("[data-hint]"), hintSub = $("[data-hint-sub]"), ctrlEl = $("[data-ctrl]");
  var btnPrev = $("[data-prev]"), btnNext = $("[data-next]"), rangeEl = $("[data-range]"), labelEl = $("[data-label]");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var all = [], view = [], filterTag = "", leaves = [], pos = -1, spread = true, PW = 420, PH = 568, PER = 5;
  var busy = false, loaded = false, wantOpen = false, lbOpen = false;
  var CACHE = "mkp26-gallery-cache-x-" + G.hashtag; // 今のギャラリーと同じ保存先を使う（一度見た人はすぐ表示できる）

  var CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3l2-2h6l2 2h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"/></svg>';

  /* ------------------------------------------------------------ small helpers */
  function hash(str) { var h = 2166136261; str = String(str); for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(seed, k) { var x = Math.sin(hash(seed + ":" + k)) * 10000; return x - Math.floor(x); } // 0〜1（同じ入力なら同じ値）
  function shortName(n) { var i = n.lastIndexOf("の"); return i > 0 && i < n.length - 1 ? n.slice(i + 1) : n; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function dateOf(p) { var d = new Date(p.at); return isNaN(d) ? null : d; }
  function fmtDate(d) { return d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate()); }
  function aspect(p) { return p.w && p.h ? p.w / p.h : 1.5; }

  /* ------------------------------------------------------------ data */
  function sortAsc(list) {
    return list.slice().sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1; });
  }
  var NOTE = CFG.note != null ? CFG.note : "※公演の写真が出てきます（ネタバレにご注意ください）";
  function setHint(t, withNote) { hintSub.innerHTML = esc(t) + (withNote && NOTE ? "<br>" + esc(NOTE) : ""); }
  var appliedOnce = false;
  function applyData(list) {
    all = sortAsc(list);
    loaded = true;
    // 最初の1回だけ、URLの #c=キャラ名&p=ページ を読み込む（共有されたリンクを開いたとき、そのページから始まる）
    var deep = !appliedOnce && bootHash.page;
    if (deep) bookEl.style.transition = "none"; // リンクから直接ページを開くときは、表紙からのスライドを見せない
    rebuild(deep ? "p" + bootHash.page : null);
    if (deep) { void bookEl.offsetWidth; bookEl.style.transition = ""; }
    appliedOnce = true;
    setHint("表紙をタップして、本をひらく", true);
    if (wantOpen) { wantOpen = false; goTo(0, true); }
  }
  function load() {
    var cached = null;
    try { cached = JSON.parse(S.get(CACHE) || "null"); } catch (e) { cached = null; }
    var haveCache = Array.isArray(cached) && cached.length;
    if (haveCache) applyData(cached);
    else setHint("ギャラリーを用意しています…");
    G.api.list().then(function (list) {
      var same = haveCache && JSON.stringify(sortAsc(list)) === JSON.stringify(all);
      S.set(CACHE, JSON.stringify(list));
      if (same) return;
      if (lbOpen || busy) { pendingData = list; return; }
      var anchor = anchorIndex();
      applyData(list);
      if (anchor != null) restoreAnchor(anchor);
    }).catch(function (e) {
      if (haveCache) return;
      hintSub.innerHTML = '写真を読み込めませんでした。<button type="button" data-retry style="margin-left:6px;border:0;background:none;color:#5b3a8f;text-decoration:underline;cursor:pointer;font:inherit;pointer-events:auto">もう一度</button>';
      var r = $("[data-retry]"); if (r) r.addEventListener("click", function (ev) { ev.stopPropagation(); setHint("ギャラリーを用意しています…"); load(); });
      if (window.console) console.warn("[book]", e);
    });
  }
  var pendingData = null;

  /* ------------------------------------------------------------ hash（#c=キャラ名&p=ページ） */
  function readHash() {
    var out = {};
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) {
      var i = kv.indexOf("="); if (i < 0) return;
      var k = kv.slice(0, i), v = kv.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (e) { return; }
      if (k === "c") out.c = v; else if (k === "p") out.page = Math.max(1, parseInt(v, 10) || 1);
    });
    return out;
  }
  var bootHash = readHash();
  function writeHash() {
    if (!loaded) return;
    var parts = [], pn = currentPhotoPageNo();
    if (filterTag) parts.push("c=" + encodeURIComponent(filterTag));
    if (pn) parts.push("p=" + pn);
    var h = parts.length ? "#" + parts.join("&") : "";
    try { history.replaceState(history.state, "", h || location.pathname + location.search); } catch (e) { /* noop */ }
  }

  /* ------------------------------------------------------------ サイズ（画面に合わせてページの大きさを決める） */
  function computeSize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    spread = vw >= 900 && vw / vh >= 1.15;
    bookEl.classList.toggle("single", !spread); // CSSの値を読む前に切り替える（表紙が一瞬ずれて見えないように）
    var topH = parseFloat(getComputedStyle(root).getPropertyValue("--top-h")) || 52;
    var ctrlH = parseFloat(getComputedStyle(root).getPropertyValue("--ctrl-h")) || 76;
    var dockH = (document.querySelector(".dock") || {}).offsetHeight || 70;
    var availH = vh - topH - ctrlH - dockH - 24;
    var pw, ph;
    if (spread) {
      ph = Math.min(availH, 800); pw = ph * 0.74;
      if (pw * 2 > vw - 150) { pw = (vw - 150) / 2; ph = pw / 0.74; }
    } else {
      pw = Math.min(vw - 30, 520); ph = pw / 0.74;
      if (ph > availH) { ph = availH; pw = ph * 0.74; }
    }
    PW = Math.max(250, Math.floor(pw)); PH = Math.max(340, Math.floor(ph));
    PER = spread ? (+CFG.perPage || 8) : (+CFG.perPageSmall || 6);
    root.style.setProperty("--pw", PW + "px");
    root.style.setProperty("--ph", PH + "px");
  }

  /* ------------------------------------------------------------ ページの並び（leaves） */
  function buildLeaves() {
    leaves = [{ t: "front" }];
    var n = Math.ceil(view.length / PER);
    for (var i = 0; i < n; i++) leaves.push({ t: "photos", from: i * PER, items: view.slice(i * PER, (i + 1) * PER), no: i + 1, of: n });
    leaves.push({ t: "end" });
  }
  function photoPageCount() { return Math.ceil(view.length / PER); }
  function maxPos() { return spread ? Math.floor(leaves.length / 2) : leaves.length - 1; }
  function sidesAt(p) {
    if (p < 0) return { l: null, r: "cover" };
    if (spread) return { l: p === 0 ? "endpaper" : (leaves[2 * p - 1] || "blank"), r: leaves[2 * p] || "blank" };
    return { l: null, r: leaves[p] };
  }
  function posForLeaf(i) { return spread ? Math.ceil(i / 2) : i; }
  function posForPhotoPage(no) { return posForLeaf(Math.min(Math.max(1, photoPageCount()), Math.max(1, no))); }
  function posForPhotoIndex(idx) { return posForPhotoPage(Math.floor(idx / PER) + 1); }
  function currentPhotoPageNo() {
    if (pos < 0) return 0;
    var s = sidesAt(pos), a = [s.l, s.r];
    for (var i = 0; i < a.length; i++) if (a[i] && a[i].t === "photos") return a[i].no;
    return 0;
  }
  function anchorIndex() { // いま開いているページの先頭の写真（画面サイズが変わっても同じ場所に戻れるように）
    if (pos < 0) return null;
    var s = sidesAt(pos), a = [s.l, s.r];
    for (var i = 0; i < a.length; i++) if (a[i] && a[i].t === "photos") return a[i].from;
    return null;
  }
  function restoreAnchor(idx) { goTo(posForPhotoIndex(idx), false); }

  /* ------------------------------------------------------------ 写真の並べ方（ページいっぱいに、バランスよく） */
  // 写真の順番はそのまま、何段にするか・どこで改行するかを全パターン試して、いちばん大きく使えるものを選ぶ
  function layoutPage(items, W, H) {
    var n = items.length, GAP = 14, best = null;
    if (!n) return [];
    var a = items.map(aspect);
    for (var mask = 0; mask < (1 << (n - 1)); mask++) {
      var rows = [[]];
      for (var i = 0; i < n; i++) { rows[rows.length - 1].push(i); if (i < n - 1 && ((mask >> i) & 1)) rows.push([]); }
      var hs = rows.map(function (r) { var sa = 0; r.forEach(function (k) { sa += a[k]; }); return (W - (r.length - 1) * GAP) / sa; });
      var tot = (rows.length - 1) * GAP; hs.forEach(function (h) { tot += h; });
      var sc = Math.min(1, H / tot), area = 0, minA = Infinity;
      rows.forEach(function (r, ri) { r.forEach(function (k) { var ar = a[k] * Math.pow(hs[ri] * sc, 2); area += ar; if (ar < minA) minA = ar; }); });
      var minH = Math.min.apply(null, hs) * sc, maxH = Math.max.apply(null, hs) * sc;
      // 使う面積が大きく、いちばん小さい写真も小さくなりすぎず、段の高さがそろっているものを選ぶ
      var score = area / (W * H) * 0.5 + Math.min(1, minA / (W * H / n)) * 0.5 - (maxH - minH) / H * 0.12;
      if (!best || score > best.score) best = { score: score, rows: rows, hs: hs, sc: sc };
    }
    var rects = new Array(n), totH = (best.rows.length - 1) * GAP;
    best.hs.forEach(function (h) { totH += h * best.sc; });
    var free = Math.max(0, H - totH), vgap = GAP + Math.min(free / (best.rows.length + 1), 26);
    var used = 0; best.hs.forEach(function (h) { used += h * best.sc; }); used += (best.rows.length - 1) * vgap;
    var y = Math.max(0, (H - used) / 2);
    best.rows.forEach(function (r, ri) {
      var h = best.hs[ri] * best.sc, rowW = (r.length - 1) * GAP;
      r.forEach(function (k) { rowW += a[k] * h; });
      var x = (W - rowW) / 2;
      r.forEach(function (k) { var w = a[k] * h; rects[k] = { x: x, y: y, w: w, h: h }; x += w + GAP; });
      y += h + vgap;
    });
    return rects;
  }

  /* ------------------------------------------------------------ ページの中身 */
  function pageShell(side, extra) {
    var pg = el("div", "pg pg--" + side + (extra ? " " + extra : ""));
    // ふち飾り（細い二重線と、四隅の銀の唐草）
    pg.appendChild(el("i", "frame"));
    ["tl", "tr", "bl", "br"].forEach(function (c) { pg.appendChild(el("i", "fc fc--" + c)); });
    return pg;
  }

  function printEl(p, idx, rect, k) {
    var b = el("button", "print");
    b.type = "button";
    b.setAttribute("data-i", idx);
    var label = G.creditLabel(p);
    b.setAttribute("aria-label", "写真を拡大" + (label ? "（撮影：" + label + "）" : ""));
    b.style.cssText = "left:" + rect.x.toFixed(1) + "px;top:" + rect.y.toFixed(1) + "px;width:" + rect.w.toFixed(1) + "px;height:" + rect.h.toFixed(1) + "px";
    var img = new Image();
    var want = Math.ceil(rect.w * Math.min(window.devicePixelRatio || 1, 2) * 1.05);
    var w = want <= 420 ? 400 : want <= 640 ? 640 : 960;
    img.alt = ""; img.decoding = "async";
    G.bindFallback(img, p, w);
    img.addEventListener("load", function () { b.classList.add("is-loaded"); });
    img.src = G.imgUrl(p, w);
    if (img.complete && img.naturalWidth) b.classList.add("is-loaded");
    b.appendChild(img);
    if (label) b.appendChild(el("span", "print__cap", esc(label)));
    return b;
  }

  function photosPage(leaf, side) {
    var pg = pageShell(side, "pg--photos");
    var padT = 52, padB = 50, padO = 34, padG = 46;
    var W = PW - padO - padG, H = PH - padT - padB;
    var area = el("div", "pg__area");
    area.style.cssText = "left:" + (side === "l" ? padO : padG) + "px;top:" + padT + "px;width:" + W + "px;height:" + H + "px";
    var rects = layoutPage(leaf.items, W, H);
    leaf.items.forEach(function (p, k) { area.appendChild(printEl(p, leaf.from + k, rects[k], k)); });
    var d = leaf.items.length ? dateOf(leaf.items[0]) : null;
    if (d) pg.appendChild(el("span", "pg__date", fmtDate(d)));
    pg.appendChild(area);
    pg.appendChild(el("span", "pg__no foil", String(leaf.no)));
    return pg;
  }

  function counts() { var c = {}; all.forEach(function (p) { (p.tags || []).forEach(function (t) { c[t] = (c[t] || 0) + 1; }); }); return c; }
  function dotStyle(t) {
    var st = G.tagStyle(t), m = st.match(/--c1:([^;]+)/), m2 = st.match(/--c:([^;]+);--c1/);
    return "background:" + (m2 && /gradient/.test(m2[1]) ? m2[1] : (m ? m[1] : "#c8b4f2"));
  }

  // 扉：タイトルと、キャラクターの一覧（ここから、その子の写真だけのページに切り替え）
  function frontPage(side) {
    var pg = pageShell(side, "pg--front"), c = counts();
    var names = G.tags().filter(function (t) { return c[t]; });
    Object.keys(c).forEach(function (t) { if (names.indexOf(t) < 0) names.push(t); });
    var ds = all.map(dateOf).filter(Boolean).sort(function (a, b) { return a - b; });
    var range = ds.length ? (fmtDate(ds[0]) === fmtDate(ds[ds.length - 1]) ? fmtDate(ds[0]) : fmtDate(ds[0]) + " – " + fmtDate(ds[ds.length - 1])) : "";
    var box = el("div", "front");
    var items = '<button type="button" class="item item--all" data-char="" aria-pressed="' + (!filterTag) + '"><i style="background:linear-gradient(135deg,#bdf2dc,#c8b4f2,#f6c4dd)"></i><span>すべての写真</span><small>' + all.length + "</small></button>";
    items += names.map(function (t) {
      var st = G.tagStyle(t);
      return '<button type="button" class="item" data-char="' + esc(t) + '" aria-pressed="' + (filterTag === t) + '" title="' + esc(t) + '"' + (st ? ' style="' + esc(st) + '"' : "") + "><i></i><span>" + esc(shortName(t)) + "</span><small>" + c[t] + "</small></button>";
    }).join("");
    box.innerHTML =
      '<img class="front__crest" src="' + ASSET + 'img/emblem-silver.png" alt="" width="40" height="49">' +
      '<h2 class="front__h foil">Gallery</h2><p class="front__sub">公演写真ギャラリー</p>' +
      '<img class="foil-rule" src="foil-rule.svg" alt="" width="320" height="24" style="margin:6px auto 2px;width:180px">' +
      (view.length ? '<p class="front__stat">' + (range ? range + "　" : "") + "<b>" + view.length + "</b> photographs</p>" : '<p class="front__stat">写真は、公演のあとに少しずつ増えていきます</p>') +
      (filterTag ? '<span class="front__who"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;' + dotStyle(filterTag) + '"></i>' + esc(filterTag) + "</span>" : "") +
      '<div class="front__list">' + items + "</div>";
    var list = box.querySelector(".front__list");
    function more() { box.classList.toggle("is-more", list.scrollTop + list.clientHeight < list.scrollHeight - 6); }
    list.addEventListener("scroll", more, { passive: true });
    setTimeout(more, 60);
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-char]"); if (!b) return;
      chooseChar(b.getAttribute("data-char"));
    });
    pg.appendChild(box);
    return pg;
  }

  function endPage(side) {
    var pg = pageShell(side, "pg--endp"), body = el("div", "pg__body");
    var by = {};
    all.forEach(function (p) { var h = G.creditLabel(p); if (h) by[h] = (by[h] || 0) + 1; });
    var hs = Object.keys(by).sort(function (a, b) { return by[b] - by[a] || (a < b ? -1 : 1); });
    var links = hs.map(function (h) { var x = G.parseX(h); return x && x.url ? '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(h) + "</a>" : "<span>" + esc(h) + "</span>"; }).join("");
    body.innerHTML =
      '<h2 class="endp__h foil">Thank you</h2>' +
      '<img class="foil-rule" src="foil-rule.svg" alt="" width="320" height="24" style="margin:4px auto 0;width:170px">' +
      '<p class="endp__p">見に来てくれたみなさん、<br>写真を撮って、投稿してくれたみなさん、<br>ありがとうございました。</p>' +
      (hs.length ? '<p class="endp__who">撮影・投稿（' + hs.length + '人）</p><div class="endp__list">' + links + "</div>" : "") +
      '<p class="endp__fine">Xの「#' + esc(G.hashtag) + '」の投稿から自動で集めています。写真の著作権は各投稿者に帰属します。掲載の削除をご希望の場合は、公式アカウントまでご連絡ください。</p>';
    pg.appendChild(body);
    return pg;
  }

  // 表紙：公演ポスターを、箔押しの表紙に
  function coverEl() {
    var c = el("div", "cover");
    c.setAttribute("role", "button"); c.tabIndex = 0;
    c.setAttribute("aria-label", "本をひらく");
    c.innerHTML = '<img src="' + ASSET + 'img/poster-1200.webp" alt="La Magica＊Prism Ceremony 公演ポスター" width="1200" height="1697" fetchpriority="high"><i class="cover__frame"></i>';
    return c;
  }
  // 見返し（表紙のうら）
  function endpaperEl(side) {
    var pg = pageShell(side, "pg--end");
    pg.appendChild(el("img", "endp-crest")).src = ASSET + "img/emblem-silver.png";
    return pg;
  }
  function pageEl(x, side) {
    if (x === "cover") return coverEl();
    if (x === "endpaper") return endpaperEl(side);
    if (x === "blank" || !x) return pageShell(side, "pg--blank");
    if (x.t === "front") return frontPage(side);
    if (x.t === "photos") return photosPage(x, side);
    if (x.t === "end") return endPage(side);
    return pageShell(side, "pg--blank");
  }

  /* ------------------------------------------------------------ 表示・ページめくり */
  function put(slot, node) { slot.innerHTML = ""; if (node) slot.appendChild(node); }

  function paintCtrl() {
    var mp = maxPos();
    rangeEl.min = -1; rangeEl.max = mp; rangeEl.value = pos;
    btnPrev.disabled = pos <= -1;
    btnNext.disabled = pos >= mp;
    var s = sidesAt(pos), txt;
    if (pos < 0) txt = "表紙";
    else {
      var nums = [s.l, s.r].filter(function (x) { return x && x.t === "photos"; }).map(function (x) { return x.no; });
      var pn = photoPageCount();
      if (nums.length) txt = (nums.length > 1 ? nums[0] + "–" + nums[1] : nums[0]) + " / " + pn + " ページ";
      else {
        var k = s.r && s.r.t || (s.l && s.l.t);
        txt = k === "front" ? "もくじ" : k === "end" ? "おしまい" : "見返し";
      }
    }
    labelEl.textContent = txt;
    ctrlEl.classList.toggle("is-closed", pos < 0);
    writeHash();
  }
  function render() {
    bookEl.classList.toggle("is-closed", pos < 0);
    var s = sidesAt(pos);
    put(slotL, spread && s.l ? pageEl(s.l, "l") : null);
    put(slotR, pageEl(s.r, "r"));
    paintCtrl();
    warm();
  }
  function warm() { // 前後のページの写真を先に読んでおく
    [pos - 1, pos + 1, pos + 2].forEach(function (q) {
      if (q < 0 || q > maxPos()) return;
      var s = sidesAt(q);
      [s.l, s.r].forEach(function (x) { if (x && x.t === "photos") x.items.forEach(function (p) { var im = new Image(); im.src = G.imgUrl(p, 640); }); });
    });
  }
  function rebuild(targetPos) {
    computeSize();
    view = filterTag ? all.filter(function (p) { return (p.tags || []).indexOf(filterTag) >= 0; }) : all.slice();
    buildLeaves();
    if (typeof targetPos === "string") targetPos = posForPhotoPage(+targetPos.slice(1)); // "p3" = 写真の3ページ目
    pos = targetPos != null ? Math.min(Math.max(-1, targetPos), maxPos()) : Math.min(pos, maxPos());
    render();
  }
  function chooseChar(tag) {
    if ((tag || "") === filterTag) return;
    filterTag = tag || "";
    view = filterTag ? all.filter(function (p) { return (p.tags || []).indexOf(filterTag) >= 0; }) : all.slice();
    buildLeaves();
    bookEl.classList.remove("fade"); void bookEl.offsetWidth; bookEl.classList.add("fade");
    var first = view.length ? posForLeaf(1) : posForLeaf(0);
    pos = Math.min(first, maxPos());
    render();
  }

  function goTo(np, animate) {
    np = Math.max(-1, Math.min(maxPos(), np));
    if (np === pos || busy) return;
    if (animate && !reduce && Math.abs(np - pos) === 1) flip(np > pos ? 1 : -1);
    else {
      pos = np;
      bookEl.classList.remove("fade"); void bookEl.offsetWidth; bookEl.classList.add("fade");
      render();
    }
  }
  function flip(dir) {
    busy = true;
    var from = sidesAt(pos), to = sidesAt(pos + dir);
    var leaf = el("div", "leaf " + (dir > 0 ? "leaf--fwd" : "leaf--back"));
    var front = el("div", "face face--front"), back = el("div", "face face--back");
    var oldL = slotL.firstChild, oldR = slotR.firstChild;
    var done = false;
    function finish() {
      if (done) return; done = true;
      leaf.remove();
      // めくった面のページは作り直さず、そのまま置く（写真がちらつかないように）
      if (spread) { if (dir > 0) put(slotL, back.firstChild); else put(slotR, back.firstChild); }
      else if (dir < 0) put(slotR, front.firstChild);
      pos += dir;
      bookEl.classList.toggle("is-closed", pos < 0);
      paintCtrl(); warm();
      busy = false;
      if (pendingData) { var d = pendingData; pendingData = null; var a = anchorIndex(); applyData(d); if (a != null) restoreAnchor(a); }
    }
    if (!spread) {
      // 1ページずつ：めくる側のページを、折り返して消す／折り返して出す
      if (dir > 0) {
        front.appendChild(oldR);
        leaf.appendChild(front);
        put(slotR, pageEl(to.r, "r"));
        bookEl.appendChild(leaf);
        bookEl.classList.toggle("is-closed", pos + dir < 0);
        leaf.style.transition = "transform var(--turn) cubic-bezier(.45,.05,.25,1), opacity var(--turn) ease-in";
        requestAnimationFrame(function () { requestAnimationFrame(function () { leaf.style.transform = "translateZ(1px) rotateY(-118deg)"; leaf.style.opacity = "0"; }); });
      } else {
        front.appendChild(pageEl(to.r, "r"));
        leaf.appendChild(front);
        leaf.style.transition = "none"; leaf.style.transform = "translateZ(1px) rotateY(-118deg)"; leaf.style.opacity = "0";
        bookEl.appendChild(leaf);
        bookEl.classList.toggle("is-closed", pos + dir < 0);
        void leaf.offsetWidth;
        requestAnimationFrame(function () { requestAnimationFrame(function () { leaf.style.transition = "transform var(--turn) cubic-bezier(.45,.05,.25,1), opacity .4s ease-out"; leaf.style.transform = "translateZ(1px) rotateY(0deg)"; leaf.style.opacity = "1"; }); });
      }
    } else if (dir > 0) {
      // 見開き：右のページを左へめくる（裏面は次の左ページ）
      front.appendChild(oldR);
      back.appendChild(to.l ? pageEl(to.l, "l") : el("div"));
      leaf.appendChild(front); leaf.appendChild(back);
      put(slotR, to.r ? pageEl(to.r, "r") : null);
      bookEl.appendChild(leaf);
      bookEl.classList.toggle("is-closed", false);
      requestAnimationFrame(function () { requestAnimationFrame(function () { leaf.style.transform = "translateZ(1px) rotateY(-180deg)"; }); });
    } else {
      // 見開き：左のページを右へ戻す（裏面は前の右ページ）
      front.appendChild(oldL || el("div"));
      back.appendChild(pageEl(to.r, "r"));
      leaf.appendChild(front); leaf.appendChild(back);
      put(slotL, to.l ? pageEl(to.l, "l") : null);
      bookEl.appendChild(leaf);
      bookEl.classList.toggle("is-closed", pos + dir < 0);
      requestAnimationFrame(function () { requestAnimationFrame(function () { leaf.style.transform = "translateZ(1px) rotateY(180deg)"; }); });
    }
    leaf.addEventListener("transitionend", function (e) { if (e.target === leaf && e.propertyName === "transform") finish(); });
    setTimeout(finish, (parseFloat(getComputedStyle(root).getPropertyValue("--turn")) || 0.95) * 1000 + 700); // 念のため
  }

  /* ------------------------------------------------------------ 操作（ボタン・スワイプ・キー） */
  function turn(d) {
    if (busy || (V2 && V2.panelOpen && V2.panelOpen())) return;
    if (!loaded && pos < 0 && d > 0) { wantOpen = true; setHint("ギャラリーを用意しています…"); return; }
    goTo(pos + d, true);
  }
  btnNext.addEventListener("click", function () { turn(1); });
  btnPrev.addEventListener("click", function () { turn(-1); });
  $("[data-hit-next]").addEventListener("click", function () { turn(1); });
  $("[data-hit-prev]").addEventListener("click", function () { turn(-1); });
  rangeEl.addEventListener("input", function () { if (!busy) goTo(+rangeEl.value, false); });
  $("[data-toc]").addEventListener("click", function () {
    if (!loaded) return;
    goTo(posForLeaf(0), true);
  });
  bookEl.addEventListener("click", function (e) {
    var c = e.target.closest(".cover");
    if (c && pos < 0) turn(1);
    var pr = e.target.closest(".print");
    if (pr && !busy) openLb(+pr.getAttribute("data-i"));
  });
  bookEl.addEventListener("keydown", function (e) { if (e.target.closest(".cover") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); turn(1); } });
  document.addEventListener("keydown", function (e) {
    if (lbOpen || (V2 && V2.panelOpen && V2.panelOpen())) return;
    if (e.key === "ArrowRight") turn(1); else if (e.key === "ArrowLeft") turn(-1);
  });
  // スワイプでめくる
  var tx = null, ty = 0, tt = 0;
  bookEl.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now(); } else tx = null; }, { passive: true });
  bookEl.addEventListener("touchend", function (e) {
    if (tx == null) return;
    var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - tt < 800) turn(dx < 0 ? 1 : -1);
  });
  var rT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () { if (!loaded || busy) return; var a = anchorIndex(), wasPos = pos; rebuild(a != null ? null : wasPos); if (a != null) restoreAnchor(a); }, 180);
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
    var d = dateOf(p);
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
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add("is-open"); });
    paintLb();
    try { history.pushState({ v2Lb: 1 }, ""); } catch (e) { /* noop */ }
    $("[data-lb-close]").focus({ preventScroll: true });
  }
  function closeLb(fromPop) {
    if (!lbOpen) return;
    lbOpen = false;
    lb.classList.remove("is-open");
    setTimeout(function () { if (!lbOpen) { lb.hidden = true; lbImg.removeAttribute("src"); } }, 250);
    if (!fromPop && history.state && history.state.v2Lb) { try { history.back(); } catch (e) { /* noop */ } }
    var np = posForPhotoIndex(lbIdx);
    if (np !== pos && !busy) { pos = np; render(); } // 拡大表示で別のページの写真まで進んだら、そのページを開く
    if (pendingData) { var d = pendingData; pendingData = null; var a = anchorIndex(); applyData(d); if (a != null) restoreAnchor(a); }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
  }
  function lbGo(d) { var n = lbIdx + d; if (n < 0 || n >= view.length) return; lbIdx = n; paintLb(); }
  window.addEventListener("popstate", function () { if (lbOpen) closeLb(true); });
  $("[data-lb-close]").addEventListener("click", function () { closeLb(false); });
  $("[data-lb-prev]").addEventListener("click", function () { lbGo(-1); });
  $("[data-lb-next]").addEventListener("click", function () { lbGo(1); });
  $("[data-lb-stage]").addEventListener("click", function (e) { if (e.target === e.currentTarget) closeLb(false); });
  $("[data-lb-info]").addEventListener("click", function (e) {
    var t = e.target.closest("[data-vt]"); if (!t) return;
    closeLb(false);
    setTimeout(function () { chooseChar(t.getAttribute("data-vt")); }, 80);
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

  /* ------------------------------------------------------------ boot */
  bookEl.classList.add("no-anim"); // 最初の表示では、動かさない
  computeSize();
  filterTag = bootHash.c || "";
  pos = -1;
  view = []; buildLeaves(); render();
  setTimeout(function () { bookEl.classList.remove("no-anim"); }, 150);
  load();
})();
