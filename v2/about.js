/* =====================================================================
   about.js — About ページ（v2/about.html）。中身は data/content.js の about / archive から作ります
   ===================================================================== */
(function () {
  "use strict";
  var V = window.V2, SITE = V.site, esc = V.esc, A = SITE.about || {};
  function $(s) { return document.querySelector(s); }
  $("[data-lead]").innerHTML = (A.lead ? '<p class="lead__main">' + esc(A.lead) + "</p>" : "") + (A.body || []).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");
  $("[data-teams]").innerHTML = (A.teams || []).map(function (t) {
    var inner = "<b>" + esc(t.name) + "</b><span>" + esc(t.desc) + "</span>" + (t.url ? '<small>紹介ポストを見る →</small>' : "");
    return t.url ? '<a class="team" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + inner + "</a>" : '<div class="team">' + inner + "</div>";
  }).join("");
  $("[data-works]").innerHTML = (SITE.archive || []).map(function (w) {
    var inner = '<span class="work__y">' + esc(w.year) + '</span><span class="work__t">' + esc(w.title) + "</span>" + (w.current ? '<em class="work__now">いま</em>' : w.url ? '<small>サイトを見る →</small>' : "");
    return "<li>" + (w.url ? '<a class="work" href="' + esc(w.url) + '" target="_blank" rel="noopener">' + inner + "</a>" : '<div class="work">' + inner + "</div>") + "</li>";
  }).join("");
  $("[data-copy]").textContent = SITE.copyright || "";
  V.renderSns();
})();
