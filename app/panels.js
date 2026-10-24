/* =====================================================================
   panels.js — 物語・About のパネル（巻物）
   中身は data/content.js の story / about / archive / sns から作ります
   ※公演情報・キャラクター紹介のパネルは、今は外してあります（data/content.js には残っています）
   ===================================================================== */
(function () {
  "use strict";
  var V = window.V2, SITE = V.site, esc = V.esc;
  var root = document.documentElement;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* ------------------------------------------------------------ 物語 */
  function buildStory() {
    $("[data-story]").innerHTML = (SITE.story || []).map(function (s) {
      var cls = s.style === "quote" ? "is-quote" : s.style === "finale" ? "is-finale" : "";
      return "<p" + (cls ? ' class="' + cls + '"' : "") + ">" + (s.lines || []).map(esc).join("<br>") + "</p>";
    }).join("");
  }

  /* ------------------------------------------------------------ About（MKPとは） */
  function buildAbout() {
    var A = SITE.about || {}, h = "";
    h += '<div class="about__lead">' + (A.lead ? '<p class="about__main">' + esc(A.lead) + "</p>" : "") + (A.body || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>";
    if ((A.teams || []).length) {
      h += "<h3>Teams<small>各班の紹介</small></h3><div class=\"about__teams\">" + A.teams.map(function (t) {
        var inner = "<b>" + esc(t.name) + "</b><span>" + esc(t.desc) + "</span>" + (t.url ? "<small>紹介ポストを見る →</small>" : "");
        return t.url ? '<a class="team" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + inner + "</a>" : '<div class="team">' + inner + "</div>";
      }).join("") + "</div>";
    }
    if ((SITE.archive || []).length) {
      h += "<h3>Works<small>これまでの公演</small></h3><ul class=\"about__works\">" + SITE.archive.map(function (w) {
        return "<li><span>" + esc(w.year) + "</span>" + esc(w.title) + "</li>";   // 年とタイトルだけ（リンクや「いま」の表示はなし）
      }).join("") + "</ul>";
    }
    h += '<h3>Follow<small>最新情報は SNS で</small></h3><div class="about__sns" data-sns="cards"></div>';
    $("[data-about]").innerHTML = h;
    V.renderSns();
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
  }
  function closeNow(p) { p.classList.remove("is-open"); setTimeout(function () { if (openEl !== p) p.hidden = true; }, 500); }
  function close(fromPop) {
    if (!openEl) return;
    var p = openEl; openEl = null;
    closeNow(p); root.classList.remove("is-locked");
    if (!fromPop && history.state && history.state.v2panel) { try { history.back(); } catch (e) { /* noop */ } }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
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

  buildStory(); buildAbout();
  var hm = location.hash.match(/^#(story|about)$/);
  if (hm) open(hm[1]);
})();
