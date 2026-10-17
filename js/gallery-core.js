/* =====================================================================
   gallery-core.js — フォトギャラリーと投稿ページで共通の処理
   ・データベース（Google Apps Script）とのやりとり
   ・画像の圧縮
   ・X のリンクの整形
   content.js の gallery.apiUrl が空のときは「デモモード」（この端末の中だけで動く）になります
   ===================================================================== */
(function () {
  "use strict";

  var SITE = window.SITE || {};
  var CFG = SITE.gallery || {};
  var API = String(CFG.apiUrl || "").trim();
  var DEMO = !API;

  /* ------------------------------------------------------------ small utils */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* noop */ } }
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* noop */ } }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (e) { /* noop */ } }

  /* ------------------------------------------------------------ tags (characters) */
  function tagList() {
    var t = Array.isArray(CFG.tags) && CFG.tags.length ? CFG.tags.slice() : [];
    if (!t.length) {
      (SITE.characters || []).forEach(function (c) { (c.names || []).forEach(function (n) { if (n.name && t.indexOf(n.name) < 0) t.push(n.name); }); });
    }
    return t;
  }
  function tagColor(name) {
    var col = "";
    (SITE.characters || []).forEach(function (c) {
      (c.names || []).forEach(function (n) { if (n.name === name && c.color) col = c.color; });
    });
    return col;
  }

  /* ------------------------------------------------------------ X link */
  // "@id" / "id" / "https://x.com/id" / "https://x.com/id/status/123" → { url, handle }
  function parseX(v) {
    v = String(v || "").trim();
    if (!v) return { url: "", handle: "" };
    var m = v.match(/^@?([A-Za-z0-9_]{1,15})$/);
    if (m) return { url: "https://x.com/" + m[1], handle: "@" + m[1] };
    m = v.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(\/status\/\d{1,25})?\/?(?:[?#].*)?$/i);
    if (m) return { url: "https://x.com/" + m[1] + (m[2] || ""), handle: "@" + m[1], post: !!m[2] };
    return null; // 不正
  }
  function creditLabel(p) {
    if (p.credit) return p.credit;
    var x = parseX(p.x);
    return x && x.handle ? x.handle : "";
  }

  /* ------------------------------------------------------------ image URL */
  // Google ドライブの画像を「幅 w px」で取り出す
  function imgUrl(p, w) {
    if (p.src) return p.src; // デモ
    return "https://lh3.googleusercontent.com/d/" + encodeURIComponent(p.f) + "=w" + (w || 1200);
  }
  function imgFallback(p, w) {
    if (p.src) return p.src;
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(p.f) + "&sz=w" + (w || 1200);
  }
  // <img> の読み込みに失敗したら別のURLで1回だけ再挑戦
  function bindFallback(img, p, w) {
    img.addEventListener("error", function onErr() {
      img.removeEventListener("error", onErr);
      var fb = imgFallback(p, w);
      if (fb && img.src !== fb) { img.removeAttribute("srcset"); img.src = fb; }
    });
  }

  /* ------------------------------------------------------------ owner key (この端末で投稿した写真の目印) */
  function ownerKey() {
    var k = lsGet("mkp26-owner");
    if (k && /^[a-f0-9]{32}$/.test(k)) return k;
    var a = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(a);
    k = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    lsSet("mkp26-owner", k);
    return k;
  }

  /* ------------------------------------------------------------ image compression */
  var MAX_EDGE = 1800, QUALITY = 0.82, TARGET = 650 * 1024;

  function decodeNative(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return decodeImg(file); });
    }
    return decodeImg(file);
  }
  // ブラウザが読めない画像（Chrome / Android / Windows での HEIC など）は HEIC 変換ライブラリで読む
  function decode(file) {
    return decodeNative(file).catch(function (err) {
      return isHeic(file).then(function (yes) {
        if (!yes) throw err;
        return loadHeic().then(function (HeicTo) {
          return HeicTo({ blob: file, type: "bitmap" });
        }).catch(function () { throw new Error("heic"); });
      });
    });
  }

  /* ------------------------------------------------------------ HEIC (iPhone の写真形式) */
  var HEIC_LIB = "js/vendor/heic-to.js", heicPromise = null;
  function isHeicName(file) {
    return /^image\/hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "");
  }
  // 拡張子が無い / 違う場合もあるので、ファイルの先頭（ftyp ボックス）も見る
  function isHeic(file) {
    if (isHeicName(file)) return Promise.resolve(true);
    if (!file.slice || !window.FileReader) return Promise.resolve(false);
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () {
        var u = new Uint8Array(r.result), s = "";
        for (var i = 4; i < 12 && i < u.length; i++) s += String.fromCharCode(u[i]);
        res(/^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)/.test(s));
      };
      r.onerror = function () { res(false); };
      r.readAsArrayBuffer(file.slice(0, 16));
    });
  }
  function heicReady() { return !!window.HeicTo; }
  function loadHeic() {
    if (window.HeicTo) return Promise.resolve(window.HeicTo);
    if (!heicPromise) {
      heicPromise = new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = HEIC_LIB;
        s.async = true;
        s.onload = function () { window.HeicTo ? res(window.HeicTo) : rej(new Error("heic_lib")); };
        s.onerror = function () { heicPromise = null; rej(new Error("heic_lib")); };
        document.head.appendChild(s);
      });
    }
    return heicPromise;
  }
  function decodeImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () { res(im); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("decode")); };
      im.src = url;
    });
  }
  function toBlob(cv, q) {
    return new Promise(function (res) {
      if (cv.toBlob) cv.toBlob(function (b) { res(b); }, "image/jpeg", q);
      else {
        var d = cv.toDataURL("image/jpeg", q), bin = atob(d.split(",")[1]), u = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        res(new Blob([u], { type: "image/jpeg" }));
      }
    });
  }
  // 長い辺を maxEdge px 以下・JPEG に。位置情報などのメタデータはこの時点で消える
  function compress(file, maxEdge, quality) {
    maxEdge = maxEdge || MAX_EDGE; quality = quality || QUALITY;
    return decode(file).then(function (src) {
      var sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
      if (!sw || !sh) throw new Error("decode");
      var s = Math.min(1, maxEdge / Math.max(sw, sh));
      var w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
      var cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      var ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // 透過PNGの背景を白に
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, w, h);
      if (src.close) src.close();
      return toBlob(cv, quality).then(function (b) {
        if (b && b.size > TARGET) return toBlob(cv, 0.72);
        return b;
      }).then(function (b) {
        cv.width = cv.height = 0;
        if (!b) throw new Error("encode");
        return { blob: b, width: w, height: h };
      });
    });
  }
  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }

  /* ------------------------------------------------------------ live API (Google Apps Script) */
  function getJSON(url) {
    return fetch(url, { method: "GET", redirect: "follow", cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http_" + r.status);
      return r.json();
    });
  }
  function post(body) {
    // text/plain にすると GAS でも事前確認（CORS preflight）なしで送れる
    return fetch(API, {
      method: "POST", redirect: "follow", cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok) throw new Error("http_" + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || !j.ok) { var e = new Error((j && j.error) || "unknown"); e.code = (j && j.error) || "unknown"; throw e; }
      return j;
    });
  }
  var live = {
    list: function () {
      return getJSON(API + (API.indexOf("?") < 0 ? "?" : "&") + "action=list&t=" + Date.now()).then(function (j) {
        if (!j.ok) throw new Error(j.error || "list");
        return j.photos || [];
      });
    },
    auth: function (pw) { return post({ action: "auth", password: pw }); },
    manage: function (pw) { return post({ action: "manage", password: pw, ownerKey: ownerKey() }).then(function (j) { return j.photos || []; }); },
    upload: function (pw, item) {
      return blobToBase64(item.blob).then(function (b64) {
        return post({ action: "upload", password: pw, ownerKey: ownerKey(), image: b64, width: item.width, height: item.height, tags: item.tags, credit: item.credit, x: item.x });
      }).then(function (j) { return j.photo; });
    },
    update: function (pw, id, meta) {
      return post({ action: "update", password: pw, ownerKey: ownerKey(), id: id, tags: meta.tags, credit: meta.credit, x: meta.x }).then(function (j) { return j.photo; });
    },
    remove: function (pw, id) { return post({ action: "delete", password: pw, ownerKey: ownerKey(), id: id }); },
  };

  /* ------------------------------------------------------------ demo API (この端末の中だけ) */
  var DEMO_KEY = "mkp26-demo-photos";
  var DEMO_SEED = [
    { id: "s1", src: "assets/videos/chara1.jpg", w: 1280, h: 720, tags: ["イーリス", "妖精たち"], credit: "見本の写真", x: "" },
    { id: "s2", src: "assets/videos/chara2.jpg", w: 1280, h: 720, tags: ["ポポ", "メルト"], credit: "", x: "@mkp_mau" },
    { id: "s3", src: "assets/img/poster-2400.webp", w: 2400, h: 3394, tags: [], credit: "MKP広報班", x: "" },
    { id: "s4", src: "assets/videos/chara3.jpg", w: 1280, h: 720, tags: ["ツムグ", "ルディ"], credit: "", x: "" },
    { id: "s5", src: "assets/videos/chara4.jpg", w: 1280, h: 720, tags: ["ピノ", "ウィム"], credit: "見本の写真", x: "" },
    { id: "s6", src: "assets/videos/theme.jpg", w: 1280, h: 720, tags: ["イーリス"], credit: "", x: "" },
  ];
  function demoAll() {
    var raw = lsGet(DEMO_KEY), list = null;
    try { list = raw ? JSON.parse(raw) : null; } catch (e) { list = null; }
    if (!Array.isArray(list)) {
      list = DEMO_SEED.map(function (p, i) { var o = JSON.parse(JSON.stringify(p)); o.at = new Date(Date.now() - (DEMO_SEED.length - i) * 3600e3).toISOString(); o.owner = "seed"; return o; });
    }
    return list;
  }
  function demoSave(list) {
    if (!lsSet(DEMO_KEY, JSON.stringify(list))) {
      var e = new Error("demo_full"); e.code = "demo_full"; throw e;
    }
  }
  function wait(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 350); }); }
  function demoOut(p, withMine) {
    var o = { id: p.id, src: p.src, w: p.w, h: p.h, tags: p.tags || [], credit: p.credit || "", x: p.x || "", at: p.at };
    if (withMine) o.mine = p.owner === ownerKey();
    return o;
  }
  function demoCheck(pw) {
    if (pw !== "demo") { var e = new Error("password"); e.code = "password"; return Promise.reject(e); }
    return null;
  }
  function cleanX(v) { var x = parseX(v); return x ? x.url : ""; }
  var demo = {
    list: function () { return wait(demoAll().map(function (p) { return demoOut(p, false); })); },
    auth: function (pw) { return demoCheck(pw) || wait({ ok: true }); },
    manage: function (pw) { return demoCheck(pw) || wait(demoAll().map(function (p) { return demoOut(p, true); })); },
    upload: function (pw, item) {
      return demoCheck(pw) || compress(item.blob, 900, 0.7).then(function (c) {
        return new Promise(function (res, rej) {
          var r = new FileReader();
          r.onload = function () { res(r.result); };
          r.onerror = function () { rej(r.error); };
          r.readAsDataURL(c.blob);
        });
      }).then(function (src) {
        var list = demoAll();
        var p = { id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), src: src, w: item.width, h: item.height,
          tags: item.tags || [], credit: (item.credit || "").slice(0, 40), x: cleanX(item.x), at: new Date().toISOString(), owner: ownerKey() };
        list.push(p);
        demoSave(list);
        return wait(demoOut(p, true));
      });
    },
    update: function (pw, id, meta) {
      var bad = demoCheck(pw); if (bad) return bad;
      var list = demoAll(), p = list.filter(function (q) { return q.id === id; })[0];
      if (!p) return Promise.reject(Object.assign(new Error("not_found"), { code: "not_found" }));
      if (p.owner !== ownerKey()) return Promise.reject(Object.assign(new Error("not_owner"), { code: "not_owner" }));
      p.tags = meta.tags || []; p.credit = (meta.credit || "").slice(0, 40); p.x = cleanX(meta.x);
      demoSave(list);
      return wait(demoOut(p, true));
    },
    remove: function (pw, id) {
      var bad = demoCheck(pw); if (bad) return bad;
      var list = demoAll().filter(function (q) { return q.id !== id; });
      demoSave(list);
      return wait({ ok: true });
    },
  };

  function sortPhotos(list) {
    var dir = CFG.order === "old" ? 1 : -1;
    return list.slice().sort(function (a, b) { return (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) * dir; });
  }

  var ERR = {
    password: "合言葉がちがいます。",
    not_owner: "他の人が投稿した写真のクレジットやタグは変更できません。",
    not_found: "この写真はすでに削除されています。",
    too_large: "写真のサイズが大きすぎます。",
    not_jpeg: "この画像は投稿できませんでした。",
    owner_key: "この端末の情報が読み取れませんでした。ページを再読み込みしてください。",
    demo_full: "デモモードでは端末の保存容量がいっぱいになりました。いくつか削除してください。",
  };
  function errText(e) {
    var c = (e && (e.code || e.message)) || "";
    if (ERR[c]) return ERR[c];
    if (/Failed to fetch|NetworkError|Load failed|http_/.test(c)) return "通信できませんでした。電波の良いところでもう一度お試しください。";
    return "うまくいきませんでした（" + c + "）。時間をおいてもう一度お試しください。";
  }

  window.MKPGallery = {
    demo: DEMO,
    api: DEMO ? demo : live,
    cfg: CFG,
    tags: tagList,
    tagColor: tagColor,
    parseX: parseX,
    creditLabel: creditLabel,
    imgUrl: imgUrl,
    bindFallback: bindFallback,
    compress: compress,
    isHeicName: isHeicName,
    heicReady: heicReady,
    sortPhotos: sortPhotos,
    errText: errText,
    esc: esc,
    store: { get: lsGet, set: lsSet, del: lsDel, sget: ssGet, sset: ssSet, sdel: ssDel },
  };
})();
