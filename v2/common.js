/* =====================================================================
   common.js — v2 のページで共通の小さな道具（SNSのアイコン・文字のエスケープ）
   ===================================================================== */
(function () {
  "use strict";
  var SITE = window.SITE || {};
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  var ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-2.6a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8C22 15.2 22 12 22 12s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z"/></svg>',
  };
  // [data-sns] = アイコンだけ / [data-sns="cards"] = 名前つきのカード
  function renderSns() {
    var list = SITE.sns || [];
    Array.prototype.forEach.call(document.querySelectorAll("[data-sns]"), function (el) {
      var cards = el.getAttribute("data-sns") === "cards";
      el.innerHTML = list.map(function (s) {
        var ic = ICON[s.type] || "";
        return cards
          ? '<a class="follow__card" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + ic + "<b>" + esc(s.label) + "</b><small>" + esc(s.handle) + "</small></a>"
          : '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label) + '">' + ic + "</a>";
      }).join("");
    });
  }
  window.V2 = { esc: esc, ICON: ICON, renderSns: renderSns, site: SITE };
  renderSns();
})();
