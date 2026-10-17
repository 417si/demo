/* =====================================================================
   La Magica＊Prism Ceremony — main.js
   data/content.js（window.SITE）の中身をページに流し込みます。
   ふだんの更新は content.js だけでOK。ここは動きを変えたいときだけ触ってください。
   動画はすべてサイト内の mp4 を <video> で再生します（YouTube / X の埋め込みは使いません）。
   ===================================================================== */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var root = document.documentElement;
  var pageEl = document.querySelector("[data-page]");
  var page = pageEl ? pageEl.getAttribute("data-page") : "home";
  root.classList.add("js");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ utils */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function sget(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* noop */ } }
  function lock(on) { root.classList.toggle("is-locked", !!on); }

  function jstDate(s) { return new Date(s + "T00:00:00+09:00"); }
  var WEEK = ["日", "月", "火", "水", "木", "金", "土"];
  function md(s) {
    var j = new Date(jstDate(s).getTime() + 9 * 3600e3);
    return { m: j.getUTCMonth() + 1, d: j.getUTCDate(), w: WEEK[j.getUTCDay()] };
  }
  function dotDate(s) { var x = md(s); return s.slice(0, 4) + "." + String(x.m).padStart(2, "0") + "." + String(x.d).padStart(2, "0"); }
  function decorate(text) {
    return esc(text).replace(/([A-Za-z][A-Za-z' ]*[A-Za-z])/g, '<span class="lat">$1</span>');
  }

  var ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85C2.42 3.92 3.94 2.38 7.15 2.27 8.42 2.21 8.8 2.2 12 2.2Zm0 4.86a4.94 4.94 0 1 0 0 9.88 4.94 4.94 0 0 0 0-9.88Zm0 8.15a3.21 3.21 0 1 1 0-6.42 3.21 3.21 0 0 1 0 6.42Zm5.14-9.5a1.15 1.15 0 1 0 0 2.3 1.15 1.15 0 0 0 0-2.3Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.6 6.7a5 5 0 0 1-3.9-4.4V2h-3.4v13.5a2.9 2.9 0 1 1-2-2.7V9.3a6.3 6.3 0 1 0 5.4 6.2V8.7a8.3 8.3 0 0 0 4.9 1.6V6.9l-1-.2Z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4-2.7-2.7Z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM5 6h6v2H6v10h10v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg>',
  };

  /* ------------------------------------------------------------ common: title, SNS, header, footer */
  function common() {
    if (SITE.title) $$("[data-site-title]").forEach(function (el) { el.textContent = SITE.title; });

    var list = SITE.sns || [];
    $$('[data-sns="icons"]').forEach(function (el) {
      el.innerHTML = list.map(function (s) {
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label) + '">' + (ICON[s.type] || "") + "</a>";
      }).join("");
    });
    $$('[data-sns="cards"]').forEach(function (el) {
      el.innerHTML = list.map(function (s) {
        return '<a class="snscard" href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
          '<span class="snscard__ic">' + (ICON[s.type] || "") + "</span>" +
          '<span class="snscard__tx"><b>' + esc(s.label) + "</b><small>" + esc(s.handle || "") + "</small></span></a>";
      }).join("");
    });

    // メニュー：トップでは「About / Gallery」。About・Gallery のページでは、そのページの位置が「Home」に入れ替わる
    var gal = SITE.gallery || {};
    var MENU = {
      home:    { href: "index.html",   en: "Home",    ja: "トップ" },
      about:   { href: "about.html",   en: "About",   ja: "MKPについて" },
      gallery: { href: "gallery.html", en: "Gallery", ja: "写真ギャラリー" },
    };
    var slots = ["about"];
    if (gal.showInMenu) slots.push("gallery");
    var items = slots.map(function (k) { return k === page ? MENU.home : MENU[k]; });
    $$(".gh__nav").forEach(function (nav) {
      nav.innerHTML = items.map(function (m) { return '<a href="' + m.href + '">' + m.en + "</a>"; }).join("");
    });
    $$("[data-drawer] nav").forEach(function (nav) {
      nav.innerHTML = items.map(function (m) { return '<a href="' + m.href + '"><span>' + m.en + "</span><small>" + m.ja + "</small></a>"; }).join("");
    });

    var gh = $("[data-header]");
    if (gh) {
      var alwaysSolid = page !== "home";
      var onScroll = function () { gh.classList.toggle("is-solid", alwaysSolid || window.scrollY > 40); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      var btn = $("[data-menu]"), drawer = $("[data-drawer]");
      if (btn && drawer) {
        var set = function (open) {
          btn.setAttribute("aria-expanded", String(open));
          drawer.hidden = !open;
          lock(open);
          gh.classList.toggle("is-solid", open || alwaysSolid || window.scrollY > 40);
        };
        btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
        $$("a", drawer).forEach(function (a) { a.addEventListener("click", function () { set(false); }); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawer.hidden) set(false); });
      }
    }

    var ft = $("[data-footer]");
    if (ft) {
      var base = page === "home" ? "" : "index.html";
      ft.innerHTML =
        '<p class="gf__mark"><img src="assets/svg/emblem-silver.svg" alt="" width="64" height="79"><span>' + esc(SITE.title) + "</span></p>" +
        '<p class="gf__sub">' + esc(SITE.circle) + " " + esc(SITE.year) + "</p>" +
        '<nav class="gf__nav" aria-label="フッターメニュー">' +
        '<a href="' + base + '#story">Story</a><a href="' + base + '#characters">Characters</a>' +
        '<a href="' + base + '#information">Information</a><a href="' + base + '#goods">Goods</a>' +
        (gal.showInMenu ? '<a href="gallery.html">Gallery</a>' : "") + '<a href="about.html">About</a></nav>' +
        '<div class="gf__sns">' + list.map(function (s) {
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label) + '">' + (ICON[s.type] || "") + "</a>";
        }).join("") + "</div>" +
        '<p class="gf__small">' + esc(SITE.copyright) +
        (SITE.event && SITE.event.officialUrl ? '　<a href="' + esc(SITE.event.officialUrl) + '" target="_blank" rel="noopener">' + esc(SITE.event.name) + " 公式サイト</a>" : "") + "</p>";
    }
  }

  /* ------------------------------------------------------------ lightbox */
  var lb = $("[data-lightbox]");
  function openLightbox(src, alt) {
    if (!lb || !src) return;
    var img = $("img", lb);
    img.src = src; img.alt = alt || "";
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  }
  if (lb) {
    $("[data-lightbox-close]", lb).addEventListener("click", function () { lb.close(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
  }

  /* ------------------------------------------------------------ reveal */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 }) : null;
  function reveal(el, i) {
    el.classList.add("rv");
    if (i != null) el.style.setProperty("--i", i);
    if (io && !reduceMotion) io.observe(el); else el.classList.add("is-in");
  }

  /* ------------------------------------------------------------ prism particles (canvas) */
  function particles(cv, mode) {
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, parts = [], running = false, raf = 0;
    var night = mode === "night";
    var PRISM = ["189,242,220", "200,180,242", "246,196,221", "255,244,199", "126,180,245"];
    function size() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function make(kind) {
      return {
        kind: kind, x: Math.random() * W, y: Math.random() * H,
        r: kind === "glow" ? 1.2 + Math.random() * 2.2 : 3 + Math.random() * 5,
        vy: kind === "glow" ? -(0.1 + Math.random() * 0.25) : 0.25 + Math.random() * 0.5,
        vx: kind === "glow" ? 0 : (Math.random() - 0.5) * 0.3,
        ph: Math.random() * Math.PI * 2, rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.04,
        col: PRISM[(Math.random() * PRISM.length) | 0],
      };
    }
    function init() {
      size();
      var n = Math.round(Math.min(64, W / 20));
      parts = [];
      for (var i = 0; i < (night ? n : n * 0.3); i++) parts.push(make("glow"));
      for (var j = 0; j < (night ? n * 0.4 : n * 0.5); j++) parts.push(make("shard"));
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.ph += 0.014; p.y += p.vy; p.x += p.vx + Math.sin(p.ph) * 0.3; p.rot += p.spin;
        if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        if (p.x > W + 20) p.x = -20; if (p.x < -20) p.x = W + 20;
        if (p.kind === "glow") {
          var a = (night ? 0.45 : 0.6) + 0.4 * Math.sin(p.ph * 2.3);
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
          g.addColorStop(0, "rgba(255,251,230," + a + ")");
          g.addColorStop(0.3, "rgba(" + p.col + "," + a * 0.5 + ")");
          g.addColorStop(1, "rgba(" + p.col + ",0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
        } else {
          // ひらひら舞うプリズムのかけら（ひし形）
          var flip = Math.abs(Math.sin(p.ph * 1.6));
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(0.35 + flip * 0.65, 1);
          ctx.fillStyle = "rgba(" + p.col + "," + (night ? 0.85 : 0.75) + ")";
          ctx.beginPath(); ctx.moveTo(0, -p.r * 1.3); ctx.lineTo(p.r * 0.7, 0); ctx.lineTo(0, p.r * 1.3); ctx.lineTo(-p.r * 0.7, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255," + (0.3 + flip * 0.5) + ")";
          ctx.beginPath(); ctx.moveTo(0, -p.r * 1.3); ctx.lineTo(p.r * 0.7, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
      }
      if (running) raf = requestAnimationFrame(draw);
    }
    init();
    window.addEventListener("resize", function () { init(); if (!running) draw(); });
    if (reduceMotion) { draw(); return; }
    var host = cv.parentElement;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        var vis = en[0].isIntersecting;
        if (vis && !running) { running = true; raf = requestAnimationFrame(draw); }
        if (!vis && running) { running = false; cancelAnimationFrame(raf); }
      }).observe(host);
    } else { running = true; draw(); }
  }

  /* =================================================================
     HOME
     ================================================================= */
  function hero() {
    var hc = SITE.hero || {};
    $$("[data-zoom]").forEach(function (z) {
      z.addEventListener("click", function () { openLightbox(hc.posterFull || hc.poster, hc.posterAlt); });
    });

    // ポスターを画面いっぱいの背景として表示
    var sec = $("[data-hero]");
    var bg = $("[data-poster-bg]");
    if (sec && bg) {
      // 画面が小さい（スマホなど）ときは軽い版を読み込んで、スクロール時の描き直しを軽くする
      bg.decoding = "async";
      bg.src = (hc.posterSmall && Math.min(screen.width, window.innerWidth) <= 820) ? hc.posterSmall : hc.poster;
      if (hc.pcFrom != null) sec.style.setProperty("--from", (hc.pcFrom / 100).toFixed(3));
      if (hc.pcTo != null) sec.style.setProperty("--to", (hc.pcTo / 100).toFixed(3));
      bg.style.objectPosition = hc.focus || "50% 50%";
      // スクロールに合わせてポスターの上（姫）→下（タイトル）へゆっくり流し、少し遅れて動かす（パララックス）
      if (bg && !reduceMotion) {
        var parse = function (v, d) { var m = String(v || "").match(/([\d.]+)%\s+([\d.]+)%/); return m ? [+m[1], +m[2]] : d; };
        var wide = window.matchMedia("(min-aspect-ratio: 1/1)"); // 横長の画面（PC）
        var p0, p1;
        var pick = function () {
          p0 = parse(hc.focus, [50, 50]);
          p1 = parse(hc.focusEnd || hc.focus, p0);
        };
        pick();
        var ticking = false;
        var update = function () {
          sec.classList.toggle("is-scrolled", window.scrollY > 60); // 「Scroll」の合図を消す
          if (wide.matches) { bg.style.transform = ""; ticking = false; return; } // PCは自然にスクロール
          var vh = window.innerHeight, t = Math.max(0, Math.min(1, window.scrollY / vh));
          var e = t * t * (3 - 2 * t);
          bg.style.transform = "translate3d(0," + (window.scrollY * 0.45).toFixed(1) + "px,0) scale(" + (1 + t * 0.04).toFixed(4) + ")";
          ticking = false;
        };
        window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
        window.addEventListener("resize", function () { pick(); update(); });
        update();
      }
    }
    var tg = $("[data-tagline]");
    if (tg) tg.textContent = hc.tagline || "";

    var dates = $("[data-hero-dates]");
    if (dates) {
      dates.innerHTML = (SITE.performances || []).map(function (p) {
        var x = md(p.date);
        return "<li><b>" + x.m + "." + x.d + "</b><small>（" + x.w + "）</small><span>" + esc((p.times || []).join(" / ")) + "</span></li>";
      }).join("");
    }
  }

  /* ------------------------------------------------------------ intro (self-hosted theme movie) */
  var started = false;
  function ready() {
    if (started) return;
    started = true;
    requestAnimationFrame(function () { root.classList.add("is-ready"); });
  }

  function intro(force) {
    var cfg = SITE.intro || {};
    var replay = $("[data-replay]");
    if (replay && cfg.enabled && cfg.video && !replay._bound) {
      replay._bound = true; replay.hidden = false;
      replay.addEventListener("click", function () { intro(true); });
    }
    if (!cfg.enabled || !cfg.video) return ready();
    if (!force) {
      if (location.hash && location.hash.length > 1) return ready(); // ページ内リンクで来た人には流さない
      if (cfg.oncePerVisit && sget("lmpc-intro-seen")) return ready();
    }

    var el = h(
      '<div class="intro" role="dialog" aria-modal="true" aria-label="テーマ映像">' +
      '<video playsinline muted autoplay preload="auto"' + (cfg.poster ? ' poster="' + esc(cfg.poster) + '"' : "") + ' src="' + esc(cfg.video) + '"></video>' +
      '<div class="intro__wait"><img src="assets/svg/emblem-prism.svg" alt=""></div>' +
      '<button class="intro__start" type="button" data-start hidden><span>' + ICON.play + "</span><span>テーマ映像を再生する</span></button>" +
      '<div class="intro__bar">' +
      '<button class="intro__btn intro__btn--icon" type="button" data-sound aria-pressed="false" aria-label="音を出す" title="音を出す">' + ICON.soundOff + "</button>" +
      '<progress max="1" value="0" aria-hidden="true"></progress>' +
      '<button class="intro__btn intro__btn--skip" type="button" data-skip>Skip</button>' +
      "</div></div>"
    );
    document.body.appendChild(el);
    lock(true);
    var v = $("video", el), sb = $("[data-sound]", el), startBtn = $("[data-start]", el), bar = $("progress", el);
    var closed = false;

    function paintSound() {
      sb.setAttribute("aria-pressed", String(!v.muted));
      sb.innerHTML = v.muted ? ICON.soundOff : ICON.soundOn;
      sb.setAttribute("aria-label", v.muted ? "音を出す" : "音を消す");
      sb.title = sb.getAttribute("aria-label");
    }
    function close() {
      if (closed) return;
      closed = true;
      v.pause();
      document.removeEventListener("keydown", onKey);
      el.classList.add("is-leaving");
      lock(false);
      sset("lmpc-intro-seen", "1");
      setTimeout(function () { el.remove(); }, 1200);
      ready();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    function tryPlay() {
      var p = v.play();
      if (p && p.catch) p.catch(function () { startBtn.hidden = false; }); // 自動再生できない環境ではボタンを出す
    }

    v.addEventListener("playing", function () { el.classList.add("is-playing"); startBtn.hidden = true; });
    v.addEventListener("ended", close);
    v.addEventListener("error", close);
    v.addEventListener("timeupdate", function () { if (v.duration) bar.value = v.currentTime / v.duration; });
    startBtn.addEventListener("click", function () { v.muted = false; paintSound(); tryPlay(); });
    sb.addEventListener("click", function () { v.muted = !v.muted; if (v.paused) tryPlay(); paintSound(); });
    $("[data-skip]", el).addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    if (force) { v.muted = false; paintSound(); } // 「もう一度見る」はクリック操作なので音ありで再生
    tryPlay();
    setTimeout(function () { if (!closed && v.readyState < 2) startBtn.hidden = false; }, 6000);
    $("[data-skip]", el).focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------ story */
  function story() {
    var el = $("[data-story]");
    if (!el) return;
    el.innerHTML = (SITE.story || []).map(function (sc) {
      return '<p class="scene' + (sc.style ? " scene--" + sc.style : "") + '">' + (sc.lines || []).map(function (l) {
        return '<span class="ln">' + decorate(l) + "</span>";
      }).join("") + "</p>";
    }).join("");
    $$(".scene", el).forEach(function (sc) { $$(".ln", sc).forEach(function (ln, i) { reveal(ln, i); }); });
  }

  /* ------------------------------------------------------------ characters (autoplay video carousel) */
  function characters() {
    var box = $("[data-carousel]");
    var list = (SITE.characters || []).filter(function (c) { return c && c.video; });
    if (!box) return;
    if (!list.length) { box.closest("section").hidden = true; return; }

    box.innerHTML =
      '<div class="stage-row">' +
      '<button class="navbtn" type="button" data-prev aria-label="前のキャラクター">' + ICON.prev + "</button>" +
      '<div class="stage">' +
      '<img class="stage__corner stage__corner--tl" src="assets/svg/corner.svg" alt="">' +
      '<img class="stage__corner stage__corner--tr" src="assets/svg/corner.svg" alt="">' +
      '<img class="stage__corner stage__corner--bl" src="assets/svg/corner.svg" alt="">' +
      '<img class="stage__corner stage__corner--br" src="assets/svg/corner.svg" alt="">' +
      '<div class="stage__frame"><div class="stage__screen">' +
      list.map(function (c, i) {
        return '<video id="chara-' + i + '" playsinline muted preload="' + (i ? "none" : "metadata") + '"' +
          (c.poster ? ' poster="' + esc(c.poster) + '"' : "") + ' data-src="' + esc(c.video) + '"' + (i ? " hidden" : "") +
          ' aria-label="' + esc(c.label || "") + ' の紹介動画"></video>';
      }).join("") +
      '<div class="stage__ctl">' +
      '<button type="button" data-v="sound" aria-pressed="false" aria-label="音を出す" title="音を出す">' + ICON.soundOff + "</button>" +
      '<button type="button" data-v="toggle" aria-label="一時停止" title="一時停止">' + ICON.pause + "</button>" +
      "</div>" +
      '<div class="stage__bar" aria-hidden="true"><i></i></div>' +
      "</div></div></div>" +
      '<button class="navbtn" type="button" data-next aria-label="次のキャラクター">' + ICON.next + "</button>" +
      "</div>" +
      '<div class="plate-names" aria-live="polite"></div>' +
      '<div class="chars__nav">' +
      '<button class="navbtn" type="button" data-prev aria-label="前のキャラクター">' + ICON.prev + "</button>" +
      '<span class="chars__count"></span>' +
      '<button class="navbtn" type="button" data-next aria-label="次のキャラクター">' + ICON.next + "</button>" +
      "</div>" +
      '<div class="seg" aria-label="キャラクター紹介の位置">' + list.map(function (c, i) {
        return '<button type="button" data-go="' + i + '" aria-label="' + (i + 1) + '本目：' + esc(c.label || "") + '"></button>';
      }).join("") + "</div>";

    var vids = $$("video", box), chips = $$(".seg button", box), cur = 0, inView = false;
    var names = $(".plate-names", box), count = $(".chars__count", box), barI = $(".stage__bar i", box);
    var bSound = $('[data-v="sound"]', box), bToggle = $('[data-v="toggle"]', box);
    var muted = true, userPaused = false;

    function load(v) { if (!v.src && v.dataset.src) { v.src = v.dataset.src; } }
    function paint() {
      var v = vids[cur];
      bSound.setAttribute("aria-pressed", String(!muted));
      bSound.innerHTML = muted ? ICON.soundOff : ICON.soundOn;
      bSound.setAttribute("aria-label", muted ? "音を出す" : "音を消す"); bSound.title = bSound.getAttribute("aria-label");
      bToggle.innerHTML = v.paused ? ICON.play : ICON.pause;
      bToggle.setAttribute("aria-label", v.paused ? "再生" : "一時停止"); bToggle.title = bToggle.getAttribute("aria-label");
    }
    function play() {
      var v = vids[cur];
      load(v); v.muted = muted;
      var p = v.play();
      if (p && p.catch) p.catch(function () {
        if (!v.muted) { muted = true; v.muted = true; v.play().catch(function () {}); }
        paint();
      });
    }
    function setNames(i) {
      var c = list[i];
      names.innerHTML = (c.names || []).map(function (n, k) {
        return (k ? '<img class="pn-sep" src="assets/svg/sparkle.svg" alt="">' : "") +
          '<span class="pn"><small>' + esc(n.role || "") + "</small><b>" + esc(n.name || "") + "</b></span>";
      }).join("");
      count.textContent = (i + 1) + " / " + list.length;
    }
    function activate(i, byUser) {
      vids.forEach(function (v, k) { if (k !== i) { v.pause(); v.hidden = true; } });
      var v = vids[i];
      v.hidden = false;
      if (byUser && !reduceMotion) { v.classList.remove("is-switching"); void v.offsetWidth; v.classList.add("is-switching"); }
      chips.forEach(function (c, k) { c.setAttribute("aria-current", String(k === i)); });
      cur = i;
      setNames(i);
      try { v.currentTime = 0; } catch (e) { /* noop */ }
      barI.style.width = "0%";
      if (byUser) userPaused = false;
      if ((inView || byUser) && !userPaused && !reduceMotion) play();
      // 次の動画を先読み
      var nx = vids[(i + 1) % vids.length];
      if (inView && nx !== v) { load(nx); nx.preload = "auto"; }
      paint();
    }
    function go(d, byUser) { activate((cur + d + list.length) % list.length, byUser); }

    vids.forEach(function (v) {
      v.addEventListener("ended", function () { go(1, false); });
      v.addEventListener("play", paint);
      v.addEventListener("pause", paint);
      v.addEventListener("timeupdate", function () { if (v.duration) barI.style.width = (v.currentTime / v.duration * 100) + "%"; });
      v.addEventListener("click", function () { if (v.paused) { userPaused = false; play(); } else { userPaused = true; v.pause(); } });
    });
    bSound.addEventListener("click", function () {
      muted = !muted; vids[cur].muted = muted;
      if (vids[cur].paused) { userPaused = false; play(); }
      paint();
    });
    bToggle.addEventListener("click", function () {
      var v = vids[cur];
      if (v.paused) { userPaused = false; play(); } else { userPaused = true; v.pause(); }
    });
    $$("[data-prev]", box).forEach(function (b) { b.addEventListener("click", function () { go(-1, true); }); });
    $$("[data-next]", box).forEach(function (b) { b.addEventListener("click", function () { go(1, true); }); });
    chips.forEach(function (c) { c.addEventListener("click", function () { activate(+c.getAttribute("data-go"), true); }); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { go(1, true); e.preventDefault(); }
      if (e.key === "ArrowLeft") { go(-1, true); e.preventDefault(); }
    });
    var sx = null, scr = $(".stage__screen", box);
    scr.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    scr.addEventListener("touchend", function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1, true);
      sx = null;
    });

    load(vids[0]);
    activate(0, false);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        inView = en[0].isIntersecting;
        if (inView) { if (!userPaused && !reduceMotion) play(); }
        else vids[cur].pause();
      }, { threshold: 0.35 }).observe($(".stage", box));
    }
  }

  /* ------------------------------------------------------------ information */
  function information() {
    var ev = SITE.event || {};
    var sch = $("[data-schedule]");
    if (sch) {
      var days = (SITE.performances || []).map(function (p) {
        var x = md(p.date);
        var times = (p.times || []).map(function (t) {
          return /^\d/.test(t) ? "<span>" + esc(t) + "</span>" : '<span class="tbd">' + esc(t) + "</span>";
        }).join("");
        return '<li class="day"><span class="day__date"><b>' + x.m + "." + String(x.d).padStart(2, "0") + "</b><small>" +
          esc(p.label || "") + "（" + x.w + '）</small></span><span class="day__times">' + times + "</span></li>";
      }).join("");
      sch.innerHTML =
        '<p class="plate__event">' + esc(ev.name || "") + "</p>" +
        '<h3 class="plate__title">公演スケジュール</h3>' +
        '<ul class="days">' + days + "</ul>" +
        '<dl class="facts">' +
        "<dt>公演場所</dt><dd>" + esc(SITE.venue || "後日発表") + (SITE.venueNote ? "<small>" + esc(SITE.venueNote) + "</small>" : "") + "</dd>" +
        "<dt>会場</dt><dd>" + esc(ev.campus || "") + "</dd>" +
        "<dt>芸術祭</dt><dd>" + esc(ev.hours || "") + "<small>入場無料・事前予約不要</small></dd>" +
        "</dl>" +
        '<div class="plate__links">' +
        (ev.accessUrl ? '<a class="btn" href="' + esc(ev.accessUrl) + '" target="_blank" rel="noopener">アクセス' + ICON.out + "</a>" : "") +
        (ev.officialUrl ? '<a class="btn btn--ghost" href="' + esc(ev.officialUrl) + '" target="_blank" rel="noopener">芸術祭公式サイト' + ICON.out + "</a>" : "") +
        "</div>";
      reveal(sch);
    }
    var notes = $("[data-notes]");
    if (notes) {
      var n = SITE.notes || [];
      if (!n.length) notes.hidden = true;
      notes.innerHTML = "<h3>ご観覧にあたってのお願い</h3><ul>" + n.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
      reveal(notes, 1);
    }
    var news = $("[data-news]");
    if (news) {
      var items = SITE.news || [];
      if (!items.length) { news.hidden = true; return; }
      news.innerHTML = "<h3>News</h3><ul>" + items.map(function (it) {
        var t = it.url ? '<a href="' + esc(it.url) + '"' + (/^https?:/.test(it.url) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(it.text) + "</a>" : esc(it.text);
        return '<li><time datetime="' + esc(it.date) + '">' + dotDate(it.date) + "</time><span>" + t + "</span></li>";
      }).join("") + "</ul>";
    }
  }

  /* ------------------------------------------------------------ goods / exhibition */
  function goods() {
    var el = $("[data-goods]");
    if (!el) return;
    var g = SITE.goods || {};
    var html = g.intro ? '<p class="goods__intro">' + esc(g.intro) + "</p>" : "";
    if (g.image) {
      html += '<button class="goods__img" type="button" aria-label="グッズの画像を拡大する"><img src="' + esc(g.image) + '" alt="' + esc(g.imageAlt || "グッズ一覧") + '" loading="lazy"></button>';
    } else {
      html += '<div class="goods__img goods__img--soon" aria-hidden="true"><span><img src="assets/svg/emblem-ink.svg" alt="">Coming soon…</span></div>';
    }
    if (g.saleInfo) html += '<p class="goods__sale">' + esc(g.saleInfo) + "</p>";
    el.innerHTML = html;
    var b = $("button.goods__img", el);
    if (b) b.addEventListener("click", function () { openLightbox(g.image, g.imageAlt); });
    reveal($(".goods__img", el));
  }

  function exhibition() {
    var sec = $("[data-exhibition-section]"), el = $("[data-exhibition]"), ex = SITE.exhibition || {};
    if (!sec || !el || !ex.enabled) return;
    sec.hidden = false;
    el.innerHTML = '<div class="exbox"><div><h3 class="plate__title">' + esc(ex.title) + "</h3>" +
      (ex.place ? '<p class="plate__event">' + esc(ex.place) + "</p>" : "") + "<p>" + esc(ex.text) + "</p></div>" +
      (ex.image ? '<img src="' + esc(ex.image) + '" alt="' + esc(ex.title) + '" loading="lazy">' : "") + "</div>";
  }

  /* =================================================================
     ABOUT
     ================================================================= */
  function about() {
    var a = SITE.about || {};
    var lead = $("[data-about-lead]");
    if (lead) { lead.innerHTML = "<p>" + esc(a.lead) + "</p>" + (a.body || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); reveal(lead); }
    var teams = $("[data-teams]");
    if (teams) {
      teams.innerHTML = (a.teams || []).map(function (t) {
        var tag = t.url ? "a" : "div";
        return "<" + tag + ' class="team"' + (t.url ? ' href="' + esc(t.url) + '" target="_blank" rel="noopener"' : "") + ">" +
          '<h3><img src="assets/svg/emblem-ink.svg" alt="">' + esc(t.name) + "</h3><p>" + esc(t.desc || "") + "</p>" +
          (t.url ? "<span>紹介ポストを見る</span>" : "") + "</" + tag + ">";
      }).join("");
      $$(".team", teams).forEach(function (t, k) { reveal(t, k % 4); });
    }
    var arc = $("[data-archive]");
    if (arc) {
      arc.innerHTML = (SITE.archive || []).map(function (w) {
        return "<li><b>" + esc(w.year) + "</b><em>" + esc(w.title) + "</em>" +
          (w.current ? '<span class="now">今年の公演</span>' : (w.url ? '<a href="' + esc(w.url) + '" target="_blank" rel="noopener">特設サイト</a>' : "<span></span>")) + "</li>";
      }).join("");
    }
  }

  /* ------------------------------------------------------------ boot */
  common();
  $$("canvas[data-fx]").forEach(function (cv) { particles(cv, cv.getAttribute("data-fx")); });
  if (page === "home") {
    hero();
    story();
    characters();
    information();
    goods();
    exhibition();
    intro(false);
  } else {
    about();   // About 以外のページ（gallery など）では何もしない
    ready();
  }
})();
