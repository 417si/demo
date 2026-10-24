/* =====================================================================
   landing.js — 最初の画面（本の表紙）と、表紙をひらいてギャラリーへ入る動き
   ・表紙（ポスター）をタップ → 表紙がひらく → ふつうのギャラリーサイトに切り替わる
   ・URLの #gallery… から開くと、表紙を飛ばしてギャラリーを直接表示（戻るボタンで表紙にもどる）
   ===================================================================== */
(function () {
  "use strict";

  var V = window.V2, G = window.V2G, SITE = V.site, esc = V.esc;
  var root = document.documentElement;
  function $(s, c) { return (c || document).querySelector(s); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var landing = $("[data-landing]"), bookEl = $("[data-book]"), hintEl = $("[data-hint]"), hintSub = $("[data-hint-sub]");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PW = 420, PH = 568, spread = true, busy = false;
  var ASSET = "../assets/";
  var NOTE = (SITE.book && SITE.book.note != null) ? SITE.book.note : "※公演の写真が出てきます（ネタバレにご注意ください）";

  /* ------------------------------------------------------------ サイズ（画面に合わせて本の大きさを決める） */
  function computeSize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    spread = vw >= 900 && vw / vh >= 1.15;
    bookEl.classList.toggle("single", !spread); // CSSの値を読む前に切り替える（表紙が一瞬ずれて見えないように）
    var cs = getComputedStyle(root);
    var topH = parseFloat(cs.getPropertyValue("--top-h")) || 54, hintH = parseFloat(cs.getPropertyValue("--hint-h")) || 72;
    var dockH = ($(".dock") || {}).offsetHeight || 70;
    var availH = vh - topH - hintH - dockH - 14;
    var pw, ph;
    if (spread) {
      ph = Math.min(availH, 760); pw = ph * 0.74;
      if (pw * 2 > vw - 150) { pw = (vw - 150) / 2; ph = pw / 0.74; }
    } else {
      pw = Math.min(vw - 36, 500); ph = pw / 0.74;
      if (ph > availH) { ph = availH; pw = ph * 0.74; }
    }
    PW = Math.max(240, Math.floor(pw)); PH = Math.max(320, Math.floor(ph));
    root.style.setProperty("--pw", PW + "px");
    root.style.setProperty("--ph", PH + "px");
  }

  /* ------------------------------------------------------------ 本の中身 */
  function shell(side, extra) {
    var pg = el("div", "pg pg--" + side + (extra ? " " + extra : ""));
    return pg;
  }
  function endpaper() { var pg = shell("l", "pg--end"); var im = el("img", "endp-crest"); im.src = ASSET + "img/emblem-silver.png"; im.alt = ""; pg.appendChild(im); return pg; }
  function titlePage(side) {
    var pg = shell(side, "pg--title"), body = el("div", "pg__body");
    body.innerHTML = '<img class="title__crest" src="' + ASSET + 'img/emblem-silver.png" alt="" width="60" height="74">' +
      '<h2 class="title__h foil">Gallery</h2><p class="title__sub">公演写真ギャラリー</p>' +
      '<hr class="rule">' +
      '<p class="title__p">La Magica＊Prism Ceremony<br>Magic Kingdom Project 2026</p>';
    pg.appendChild(body);
    return pg;
  }
  function coverEl() {
    var c = el("div", "cover");
    c.setAttribute("role", "button"); c.tabIndex = 0;
    c.setAttribute("aria-label", "本をひらく");
    c.innerHTML = '<img src="' + ASSET + 'img/poster-1200.webp" alt="La Magica＊Prism Ceremony 公演ポスター" width="1200" height="1697" fetchpriority="high">';
    return c;
  }
  var cover = null, leaf = null;
  function initBook() {
    computeSize();
    bookEl.innerHTML = "";
    bookEl.classList.add("no-anim", "is-closed");
    var slotL = el("div", "slot slot--l"), slotR = el("div", "slot slot--r");
    if (spread) slotL.appendChild(el("div"));
    slotR.appendChild(titlePage("r"));
    bookEl.appendChild(slotL); bookEl.appendChild(slotR);
    cover = coverEl();
    var hit = el("button", "hit"); hit.type = "button"; hit.setAttribute("aria-label", "表紙をひらく"); hit.tabIndex = -1;
    slotR.appendChild(cover);
    cover.style.zIndex = 4;
    bookEl.appendChild(hit);
    hit.addEventListener("click", openBook);
    cover.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBook(); } });
    cover.addEventListener("click", openBook);
    landing.classList.remove("is-opening", "is-leaving");
    hintEl.classList.remove("is-off");
    hintSub.innerHTML = esc("表紙をタップして、本をひらく") + (NOTE ? "<br>" + esc(NOTE) : "");
    setTimeout(function () { bookEl.classList.remove("no-anim"); }, 120);
    busy = false; leaf = null;
  }

  /* ------------------------------------------------------------ 表紙をひらく → ギャラリーへ */
  function showGallery() {
    root.classList.remove("is-landing"); root.classList.add("is-gallery");
    landing.classList.remove("is-leaving", "is-opening");
    G.enter();
  }
  function openBook() {
    if (busy || !bookEl.classList.contains("is-closed")) return;
    busy = true;
    try { history.pushState({ v2: "gallery" }, "", "#gallery"); } catch (e) { location.hash = "gallery"; }
    landing.classList.add("is-opening");
    hintEl.classList.add("is-off");
    if (reduce) { showGallery(); return; }
    // 表紙をひらく（PC：見開きに / スマホ：表紙がめくれて消える）
    leaf = el("div", "leaf leaf--fwd");
    var front = el("div", "face face--front"), back = el("div", "face face--back");
    var slotR = bookEl.querySelector(".slot--r"), slotL = bookEl.querySelector(".slot--l");
    cover.style.zIndex = "";
    front.appendChild(cover);
    if (spread) { back.appendChild(endpaper()); leaf.appendChild(front); leaf.appendChild(back); }
    else leaf.appendChild(front);
    bookEl.appendChild(leaf);
    bookEl.classList.remove("is-closed");
    var ms = 1000;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      leaf.style.transform = spread ? "translateZ(1px) rotateY(-180deg)" : "translateZ(1px) rotateY(-118deg)";
      if (!spread) leaf.style.opacity = "0";
    }); });
    var done = false;
    function next() {
      if (done) return; done = true;
      if (spread) { slotL.innerHTML = ""; slotL.appendChild(back.firstChild); leaf.remove(); }
      // ひらいた本を、ぐっと近づけながら、ギャラリーサイトに切り替える
      setTimeout(function () {
        landing.classList.add("is-leaving");
        setTimeout(showGallery, 520);
      }, 380);
    }
    leaf.addEventListener("transitionend", function (e) { if (e.target === leaf && e.propertyName === "transform") next(); });
    setTimeout(next, ms + 700);
  }

  /* ------------------------------------------------------------ 表紙にもどる（戻るボタン / メニューの「本の表紙にもどる」） */
  function showLanding() {
    G.leave();
    root.classList.remove("is-gallery"); root.classList.add("is-landing");
    window.scrollTo(0, 0);
    initBook();
  }
  window.addEventListener("popstate", function () {
    // 拡大表示・パネルの履歴は、それぞれのスクリプトが閉じる。ここでは「表紙 ⇔ ギャラリー」だけを見る
    var inG = root.classList.contains("is-gallery"), want = /^#gallery/.test(location.hash);
    if (want && !inG) { bookEl.classList.remove("is-closed"); G.parseHash(); showGallery(); }
    else if (!want && inG && !/^#story$/.test(location.hash)) showLanding();
  });
  $("[data-back]").addEventListener("click", function (e) {
    e.preventDefault();
    if (history.state && history.state.v2 === "gallery") { try { history.back(); return; } catch (err) { /* noop */ } }
    try { history.replaceState({}, "", location.pathname + location.search); } catch (err) { /* noop */ }
    showLanding();
  });
  var rT = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(function () { if (root.classList.contains("is-landing") && !busy) initBook(); }, 160);
  });

  /* ------------------------------------------------------------ boot */
  if (G.parseHash()) { // リンクから直接ギャラリーを開く
    initBook();
    root.classList.remove("is-landing"); root.classList.add("is-gallery");
    G.enter();
  } else initBook();
})();
