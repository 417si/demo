/* =====================================================================
   panels.js — 物語のパネル（巻物）
   中身は data/content.js の story から作ります
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

  buildStory();
  if (/^#story$/.test(location.hash)) open("story");
})();
