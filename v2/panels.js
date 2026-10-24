/* =====================================================================
   panels.js — 物語・キャラクター・公演情報のパネル（巻物）
   中身は data/content.js（story / characters / event / performances / notes / goods）から作ります
   ===================================================================== */
(function () {
  "use strict";
  var V = window.V2, SITE = V.site, esc = V.esc;
  var root = document.documentElement;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  var asset = function (p) { return p && !/^(https?:)?\/\//.test(p) ? "../" + p : p; };

  /* ------------------------------------------------------------ 物語 */
  function buildStory() {
    $("[data-story]").innerHTML = (SITE.story || []).map(function (s) {
      var cls = s.style === "quote" ? "is-quote" : s.style === "finale" ? "is-finale" : "";
      return "<p" + (cls ? ' class="' + cls + '"' : "") + ">" + (s.lines || []).map(esc).join("<br>") + "</p>";
    }).join("");
  }

  /* ------------------------------------------------------------ キャラクター */
  var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  function buildChars() {
    var box = $("[data-chars]");
    box.innerHTML = (SITE.characters || []).map(function (c, i) {
      var names = (c.names || []).map(function (n) { return '<div class="char__n"><small>' + esc(n.role) + "</small><b>" + esc(n.name) + "</b></div>"; }).join("");
      return '<article class="char"><div class="char__media" data-v="' + i + '"><img src="' + esc(asset(c.poster)) + '" alt="" loading="lazy">' +
        '<button class="char__play" type="button" aria-label="' + esc(c.label || "") + ' の動画を再生">' + PLAY + "</button></div>" +
        '<div class="char__names">' + names + "</div></article>";
    }).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".char__play"); if (!b) return;
      var m = b.closest(".char__media"), c = SITE.characters[+m.getAttribute("data-v")];
      stopVideos();
      var v = document.createElement("video");
      v.src = asset(c.video); v.poster = asset(c.poster); v.controls = true; v.autoplay = true; v.playsInline = true; v.setAttribute("playsinline", "");
      m.innerHTML = ""; m.appendChild(v);
      v.play && v.play().catch(function () { /* 再生ボタンで開始 */ });
    });
  }
  function stopVideos() {
    $$("[data-chars] video").forEach(function (v) {
      v.pause();
      var m = v.closest(".char__media"), c = SITE.characters[+m.getAttribute("data-v")];
      m.innerHTML = '<img src="' + esc(asset(c.poster)) + '" alt="" loading="lazy"><button class="char__play" type="button" aria-label="' + esc(c.label || "") + ' の動画を再生">' + PLAY + "</button>";
    });
  }

  /* ------------------------------------------------------------ 公演情報 */
  function ymd(s) { var m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function wd(s) { var p = ymd(s); return p ? "日月火水木金土"[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()] : ""; }
  function md(s) { var p = ymd(s); return p ? p.m + "/" + p.d : s; }
  function jstToday() { var t = new Date(Date.now() + 9 * 3600e3); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); }
  function dayNum(s) { var p = ymd(s); return p ? Date.UTC(p.y, p.m - 1, p.d) : NaN; }
  function buildInfo() {
    var ev = SITE.event || {}, h = "";
    var today = jstToday(), st = dayNum(ev.start), en = dayNum(ev.end || ev.start);
    if (!isNaN(st)) {
      if (today > en) h += '<p class="info__thanks">公演は無事に終了しました。<br>ご来場・ご声援、ありがとうございました。</p>';
      else if (today >= st) h += '<p class="info__count">いま、<b>開催中</b>です</p>';
      else h += '<p class="info__count">開催まで あと<b>' + Math.round((st - today) / 864e5) + "</b>日</p>";
    }
    h += '<p class="info__name">' + esc(ev.name || "") + "</p>";
    var perfs = SITE.performances || [];
    if (perfs.length) {
      h += "<h3>Schedule<small>公演スケジュール</small></h3><ul class=\"info__sched\">" + perfs.map(function (p) {
        return "<li><b>" + esc(p.label || "") + "</b><span>" + esc(md(p.date)) + "（" + wd(p.date) + "）</span><em>" + (p.times || []).map(esc).join(" / ") + "</em></li>";
      }).join("") + "</ul>";
    }
    var rows = [];
    if (SITE.venue) rows.push(["会場", esc(SITE.venue) + (SITE.venueNote ? "<br><small>" + esc(SITE.venueNote) + "</small>" : "")]);
    if (ev.campus) rows.push(["場所", esc(ev.campus)]);
    if (ev.hours) rows.push(["開場時間", esc(ev.hours)]);
    if (rows.length) h += "<h3>Venue<small>会場・時間</small></h3><dl>" + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>";
    var links = [];
    if (ev.officialUrl) links.push('<a class="plate-btn" href="' + esc(ev.officialUrl) + '" target="_blank" rel="noopener"><span class="plate-btn__en">Geisai 2026</span><span class="plate-btn__ja">芸術祭公式サイト</span></a>');
    if (ev.accessUrl) links.push('<a class="plate-btn" href="' + esc(ev.accessUrl) + '" target="_blank" rel="noopener"><span class="plate-btn__en">Access</span><span class="plate-btn__ja">アクセス</span></a>');
    if (links.length) h += '<div class="info__links">' + links.join("") + "</div>";
    if ((SITE.notes || []).length) h += "<h3>Notes<small>観覧のお願い</small></h3><ul class=\"notes\">" + SITE.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>";
    var g = SITE.goods || {};
    if (g.intro || g.image) {
      h += "<h3>Goods<small>グッズ</small></h3><div class=\"info__goods\">" + (g.intro ? "<p>" + esc(g.intro) + "</p>" : "") +
        (g.image ? '<img src="' + esc(asset(g.image)) + '" alt="' + esc(g.imageAlt || "") + '" loading="lazy">' : '<span class="info__soon">Coming soon</span>') +
        (g.saleInfo ? "<p>" + esc(g.saleInfo) + "</p>" : "") + "</div>";
    }
    var news = SITE.news || [];
    if (news.length) h += "<h3>News<small>お知らせ</small></h3><ul class=\"notes\">" + news.map(function (n) { return "<li>" + esc(n.date || "") + "　" + (n.url ? '<a href="' + esc(n.url) + '">' + esc(n.text) + "</a>" : esc(n.text)) + "</li>"; }).join("") + "</ul>";
    $("[data-info]").innerHTML = h;
  }

  /* ------------------------------------------------------------ 開く・閉じる */
  var openEl = null, lastFocus = null;
  function open(name) {
    var p = $('[data-panel="' + name + '"]'); if (!p) return;
    if (openEl) closeNow(openEl);
    openEl = p; lastFocus = document.activeElement;
    p.hidden = false; root.classList.add("is-locked");
    requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.add("is-open"); }); });
    $(".sheet__scroll", p).scrollTop = 0;
    try { history.pushState({ v2panel: name }, ""); } catch (e) { /* noop */ }
    $("[data-close]", p).focus({ preventScroll: true });
    window.dispatchEvent(new Event("v2:panel"));
  }
  function closeNow(p) { p.classList.remove("is-open"); setTimeout(function () { if (openEl !== p) p.hidden = true; }, 700); if (p.getAttribute("data-panel") === "characters") stopVideos(); }
  function close(fromPop) {
    if (!openEl) return;
    var p = openEl; openEl = null;
    closeNow(p); root.classList.remove("is-locked");
    if (!fromPop && history.state && history.state.v2panel) { try { history.back(); } catch (e) { /* noop */ } }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
    window.dispatchEvent(new Event("v2:panel"));
  }
  $$("[data-open]").forEach(function (b) { b.addEventListener("click", function () { open(b.getAttribute("data-open")); }); });
  $$("[data-panel]").forEach(function (p) {
    $("[data-close]", p).addEventListener("click", function () { close(false); });
    p.addEventListener("click", function (e) { if (e.target === p) close(false); });
  });
  window.addEventListener("popstate", function () { if (openEl) close(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && openEl) close(false); });
  window.V2.panelOpen = function () { return !!openEl; };
  window.V2.openPanel = open;

  buildStory(); buildChars(); buildInfo();
  var q = location.hash.match(/^#(story|characters|info)$/);
  if (q) open(q[1]);
})();
