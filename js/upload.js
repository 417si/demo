/* =====================================================================
   upload.js — 部員用の写真投稿ページ（upload.html）
   合言葉 → 確認 → 写真を選ぶ → キャラをタグ付け → クレジット → 自動で圧縮して投稿
   「投稿済みの写真」では、自分の写真はタグ・クレジットの変更と削除、
   他の人の写真は（確認のうえ）削除だけができます。
   ===================================================================== */
(function () {
  "use strict";

  var G = window.MKPGallery;
  var api = G.api, esc = G.esc, S = G.store;
  var SITE = window.SITE || {};
  var TERMS = (G.cfg.terms && G.cfg.terms.length) ? G.cfg.terms : ["投稿した写真はサイトで公開されます。"];
  var TERMS_VER = "v1-" + TERMS.join("|").length;
  var MAX_BATCH = 40;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var pw = S.get("mkp26-pw") || S.sget("mkp26-pw") || "";
  var items = [];      // 投稿待ちの写真
  var uploading = false;
  var managed = null;  // 投稿済みの一覧（キャッシュ）
  var who = "all";

  /* ------------------------------------------------------------ screens */
  function show(name) {
    $$("[data-screen]").forEach(function (s) { s.hidden = s.getAttribute("data-screen") !== name; });
    window.scrollTo(0, 0);
  }

  var toastT = 0;
  function toast(msg) {
    var t = $("[data-toast]");
    t.textContent = msg; t.hidden = false;
    t.classList.remove("is-in"); void t.offsetWidth; t.classList.add("is-in");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("is-in"); setTimeout(function () { t.hidden = true; }, 300); }, 3200);
  }

  /* ------------------------------------------------------------ 1. login */
  function initLogin() {
    if (G.demo) { $("[data-demo-note]").hidden = false; $("[data-demo-badge]").hidden = false; }
    var form = $("[data-login]"), input = $("[data-pw]"), err = $("[data-login-error]"), btn = $("[data-login-btn]");
    $("[data-eye]").addEventListener("click", function (e) {
      var on = input.type === "password";
      input.type = on ? "text" : "password";
      e.currentTarget.textContent = on ? "隠す" : "表示";
      e.currentTarget.setAttribute("aria-label", on ? "合言葉を隠す" : "合言葉を表示");
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      err.hidden = true; btn.disabled = true; btn.textContent = "確認中…";
      api.auth(v).then(function () {
        pw = v;
        if ($("[data-remember]").checked) S.set("mkp26-pw", v); else { S.del("mkp26-pw"); S.sset("mkp26-pw", v); }
        afterLogin();
      }).catch(function (x) {
        err.textContent = G.errText(x); err.hidden = false;
        input.select();
      }).then(function () { btn.disabled = false; btn.textContent = "入る"; });
    });
  }

  function afterLogin() {
    if (S.sget("mkp26-agreed") === TERMS_VER) { show("app"); return; }
    show("terms");
  }

  function logout() {
    if (uploading) { toast("投稿中はログアウトできません"); return; }
    pw = ""; S.del("mkp26-pw"); S.sdel("mkp26-pw"); S.sdel("mkp26-agreed");
    managed = null;
    $("[data-pw]").value = "";
    show("login");
  }

  /* ------------------------------------------------------------ 2. terms */
  function initTerms() {
    $("[data-terms]").innerHTML = TERMS.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
    var cb = $("[data-agree]"), btn = $("[data-agree-btn]");
    cb.addEventListener("change", function () { btn.disabled = !cb.checked; });
    btn.addEventListener("click", function () {
      S.sset("mkp26-agreed", TERMS_VER);
      show("app");
    });
  }

  /* ------------------------------------------------------------ chips */
  function chipsHTML(selected, attr) {
    return G.tags().map(function (t) {
      var on = selected.indexOf(t) >= 0, col = G.tagColor(t);
      return '<button type="button" class="chip" ' + attr + '="' + esc(t) + '" aria-pressed="' + on + '"' +
        (col ? ' style="--c:' + esc(col) + '"' : "") + "><i></i>" + esc(t) + "</button>";
    }).join("");
  }
  function readChips(box, attr) {
    return $$("[" + attr + "]", box).filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })
      .map(function (b) { return b.getAttribute(attr); });
  }

  /* ------------------------------------------------------------ 3. post: pick & compress */
  var listEl, queue = [], compressing = false, seq = 0, heicToasted = false, heicTimer = 0;

  function addFiles(files) {
    var arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name); });
    $("[data-done]").hidden = true;
    var room = MAX_BATCH - items.length;
    if (arr.length > room) { toast("一度に投稿できるのは " + MAX_BATCH + " 枚までです"); arr = arr.slice(0, Math.max(0, room)); }
    arr.forEach(function (f) {
      var it = { key: "i" + (++seq), file: f, status: "wait", tags: [] };
      items.push(it);
      renderItem(it);
      queue.push(it);
    });
    paintPostUI();
    pump();
  }

  function pump() {
    if (compressing) return;
    var it = queue.shift();
    if (!it) { paintPostUI(); return; }
    if (items.indexOf(it) < 0) { pump(); return; }
    compressing = true;
    it.status = "compressing"; paintItem(it);
    if (!heicToasted && G.isHeicName(it.file) && !G.heicReady()) {
      heicToasted = true;
      // Safari 以外では HEIC を変換するので、最初の1枚だけ少し時間がかかる
      heicTimer = setTimeout(function () { toast("HEIC形式の写真を変換しています（最初は少し時間がかかります）"); }, 1200);
    }
    G.compress(it.file).then(function (c) {
      it.blob = c.blob; it.width = c.width; it.height = c.height;
      it.url = URL.createObjectURL(c.blob);
      it.file = null; // 元の大きいファイルは手放す
      it.status = "ready";
    }).catch(function () {
      it.status = "bad";
    }).then(function () {
      clearTimeout(heicTimer);
      compressing = false;
      paintItem(it);
      paintPostUI();
      pump();
    });
  }

  function renderItem(it) {
    var el = document.createElement("article");
    el.className = "up-item";
    el.setAttribute("data-key", it.key);
    el.innerHTML =
      '<div class="up-item__thumb"><img alt="" hidden><span class="up-item__state"></span></div>' +
      '<div class="up-item__body">' +
      '<div class="up-item__head"><b class="up-item__no"></b>' +
      '<button type="button" class="up-item__copy" data-copy>1つ前と同じタグ</button>' +
      '<button type="button" class="up-item__rm" data-rm aria-label="この写真を外す">×</button></div>' +
      '<p class="up-item__q">写っているキャラクター</p>' +
      '<div class="chips" data-chips>' + chipsHTML(it.tags, "data-tag") + "</div>" +
      '<p class="up-item__msg" data-msg hidden></p>' +
      "</div>";
    it.el = el;
    listEl.appendChild(el);
  }

  function paintItem(it) {
    var el = it.el; if (!el) return;
    var img = $("img", el), st = $(".up-item__state", el), msg = $("[data-msg]", el);
    if (it.url && img.hidden) { img.src = it.url; img.hidden = false; }
    el.className = "up-item is-" + it.status;
    var label = { wait: "待機中", compressing: "準備中…", ready: "", bad: "読み込めません", uploading: "送信中…", done: "完了", failed: "失敗" }[it.status] || "";
    st.textContent = label;
    msg.hidden = !(it.status === "bad" || it.status === "failed");
    if (it.status === "bad") msg.textContent = "この写真は読み込めませんでした（画像が壊れているか、未対応の形式です）。× で外してください。";
    if (it.status === "failed") msg.textContent = it.err || "送信できませんでした。";
    var lock = it.status === "uploading" || it.status === "done";
    $$("button", el).forEach(function (b) { b.disabled = lock; });
  }

  function renumber() {
    items.forEach(function (it, i) {
      if (!it.el) return;
      $(".up-item__no", it.el).textContent = (i + 1) + "枚目";
      $("[data-copy]", it.el).hidden = i === 0;
    });
  }

  function removeItem(it) {
    var i = items.indexOf(it);
    if (i < 0) return;
    items.splice(i, 1);
    if (it.url) URL.revokeObjectURL(it.url);
    if (it.el) it.el.remove();
    paintPostUI();
  }

  function paintPostUI() {
    renumber();
    var n = items.length;
    var ready = items.filter(function (it) { return it.status === "ready" || it.status === "failed"; }).length;
    var busy = items.some(function (it) { return it.status === "wait" || it.status === "compressing"; });
    $("[data-credit]").hidden = n === 0;
    $("[data-send]").hidden = n === 0;
    $("[data-pick]").classList.toggle("is-compact", n > 0);
    $("[data-pick-label]").textContent = n ? "写真を追加する" : "写真を選ぶ";
    var btn = $("[data-send-btn]");
    if (!uploading) {
      armedUntagged = false;
      btn.disabled = busy || ready === 0;
      btn.classList.remove("up-btn--warn");
      btn.textContent = busy ? "準備中…" : (items.some(function (it) { return it.status === "failed"; }) ? "もう一度送る（" + ready + "枚）" : ready + "枚を投稿する");
      var msg = $("[data-send-msg]");
      var bad = items.filter(function (it) { return it.status === "bad"; }).length;
      msg.textContent = bad ? "読み込めない写真が " + bad + " 枚あります（投稿されません）" : "";
      msg.className = "up-send__msg" + (bad ? " is-warn" : "");
    }
  }

  /* ------------------------------------------------------------ credit */
  function initCredit() {
    var saved = {};
    try { saved = JSON.parse(S.get("mkp26-credit") || "{}") || {}; } catch (e) { saved = {}; }
    var name = $("[data-credit-name]"), x = $("[data-credit-x]");
    name.value = saved.name || ""; x.value = saved.x || "";
    function update() {
      S.set("mkp26-credit", JSON.stringify({ name: name.value.trim(), x: x.value.trim() }));
      var px = G.parseX(x.value), note = $("[data-x-note]");
      x.classList.toggle("is-bad", px === null);
      note.classList.toggle("is-bad", px === null);
      note.textContent = px === null ? "X の @ID か、x.com のURLを入力してください" :
        (px.post ? "このポストにリンクします" : (px.url ? px.handle + " のプロフィールにリンクします" : "@ID ならプロフィールに、ポストのURLならそのポストにリンクします"));
      $("[data-credit-preview]").innerHTML = creditPreview(name.value.trim(), px);
    }
    name.addEventListener("input", update);
    x.addEventListener("input", update);
    update();
  }
  function creditPreview(name, px) {
    var label = name || (px && px.handle) || "";
    if (!label) return '<span class="up-credit__none">クレジットなしで掲載されます</span>';
    return '<span class="up-credit__ex">ギャラリーでの表示</span><span class="credit">' + CAMERA + (px && px.url ? '<u>' + esc(label) + "</u>" + XICON : esc(label)) + "</span>";
  }
  var CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h3l2-2h6l2 2h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>';
  var XICON = '<svg class="x" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"/></svg>';

  /* ------------------------------------------------------------ send */
  var armedUntagged = false;
  function send() {
    if (uploading) return;
    var name = $("[data-credit-name]").value.trim(), xv = $("[data-credit-x]").value.trim();
    if (G.parseX(xv) === null) { toast("X のリンクを確認してください"); $("[data-credit-x]").focus(); return; }
    var targets = items.filter(function (it) { return it.status === "ready" || it.status === "failed"; });
    if (!targets.length) return;
    var untagged = targets.filter(function (it) { return !it.tags.length; }).length;
    var btn = $("[data-send-btn]");
    if (untagged && !armedUntagged) {
      armedUntagged = true;
      $("[data-send-msg]").textContent = "キャラクターのタグが付いていない写真が " + untagged + " 枚あります。タグがないとキャラクターで絞り込んだときに表示されません。";
      $("[data-send-msg]").className = "up-send__msg is-warn";
      btn.textContent = "タグなしのまま投稿する";
      btn.classList.add("up-btn--warn");
      return;
    }
    armedUntagged = false;
    btn.classList.remove("up-btn--warn");
    uploading = true;
    $("[data-pick]").classList.add("is-disabled");
    $("[data-file]").disabled = true;
    btn.disabled = true;
    var total = targets.length, done = 0, failed = 0, idx = 0, stop = false;
    var bar = $("[data-send-bar]"), msg = $("[data-send-msg]");
    msg.className = "up-send__msg";
    function progress() {
      bar.style.width = Math.round((done + failed) / total * 100) + "%";
      msg.textContent = "送信中… " + (done + failed) + " / " + total + " 枚（このページを閉じないでください）";
      btn.textContent = "送信中…";
    }
    progress();
    $("[data-send]").classList.add("is-sending");

    function one(it, tries) {
      it.status = "uploading"; paintItem(it);
      return api.upload(pw, { blob: it.blob, width: it.width, height: it.height, tags: it.tags.slice(), credit: name, x: xv })
        .then(function () {
          it.status = "done"; done++; paintItem(it); progress();
          setTimeout(function () { removeItem(it); }, 500);
        })
        .catch(function (e) {
          var code = e && (e.code || e.message);
          if (code === "password") { stop = true; it.status = "failed"; it.err = G.errText(e); failed++; paintItem(it); return; }
          if (tries < 2 && !e.code) return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return one(it, tries + 1); });
          it.status = "failed"; it.err = G.errText(e); failed++; paintItem(it); progress();
        });
    }
    function worker() {
      if (stop || idx >= targets.length) return Promise.resolve();
      var it = targets[idx++];
      return one(it, 0).then(worker);
    }
    Promise.all([worker(), worker()]).then(function () {
      uploading = false;
      managed = null;
      $("[data-send]").classList.remove("is-sending");
      bar.style.width = "0%";
      $("[data-pick]").classList.remove("is-disabled");
      $("[data-file]").disabled = false;
      if (stop) { toast("合言葉が変わったようです。もう一度入ってください"); setTimeout(logout, 600); return; }
      setTimeout(function () {
        paintPostUI();
        if (!failed) {
          $("[data-done-text]").textContent = done + "枚の写真を投稿しました！";
          $("[data-done]").hidden = false;
          $("[data-done]").scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          $("[data-send-msg]").textContent = done + "枚投稿しました。" + failed + "枚は送れませんでした。もう一度送ってください。";
          $("[data-send-msg]").className = "up-send__msg is-warn";
        }
      }, 560);
    });
  }

  function initPost() {
    listEl = $("[data-list]");
    $("[data-file]").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
    listEl.addEventListener("click", function (e) {
      var card = e.target.closest(".up-item"); if (!card) return;
      var it = items.filter(function (x) { return x.key === card.getAttribute("data-key"); })[0]; if (!it) return;
      var chip = e.target.closest("[data-tag]");
      if (chip) {
        var on = chip.getAttribute("aria-pressed") !== "true";
        chip.setAttribute("aria-pressed", String(on));
        it.tags = readChips(card, "data-tag");
        if (armedUntagged) paintPostUI();
        return;
      }
      if (e.target.closest("[data-rm]")) { removeItem(it); return; }
      if (e.target.closest("[data-copy]")) {
        var prev = items[items.indexOf(it) - 1]; if (!prev) return;
        it.tags = prev.tags.slice();
        $("[data-chips]", card).innerHTML = chipsHTML(it.tags, "data-tag");
        if (armedUntagged) paintPostUI();
      }
    });
    $("[data-send-btn]").addEventListener("click", send);
    $("[data-again]").addEventListener("click", function () {
      $("[data-done]").hidden = true;
      $("[data-file]").click();
    });
    window.addEventListener("beforeunload", function (e) {
      if (uploading || items.some(function (it) { return it.status === "ready"; })) { e.preventDefault(); e.returnValue = ""; }
    });
    // ドラッグ＆ドロップ（PC）
    var pick = $("[data-pick]");
    ["dragenter", "dragover"].forEach(function (t) { pick.addEventListener(t, function (e) { e.preventDefault(); pick.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (t) { pick.addEventListener(t, function (e) { e.preventDefault(); pick.classList.remove("is-over"); }); });
    pick.addEventListener("drop", function (e) { if (!uploading && e.dataTransfer) addFiles(e.dataTransfer.files); });
  }

  /* ------------------------------------------------------------ tabs */
  function initTabs() {
    $$("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { tab(b.getAttribute("data-tab")); });
    });
    $("[data-logout]").addEventListener("click", logout);
  }
  function tab(name) {
    $$("[data-tab]").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-tab") === name)); });
    $$("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    if (name === "manage") loadManaged(false);
  }

  /* ------------------------------------------------------------ manage */
  function loadManaged(force) {
    var state = $("[data-manage-state]");
    if (managed && !force) { paintGrid(); return; }
    state.textContent = "読み込み中…";
    $("[data-grid]").innerHTML = "";
    api.manage(pw).then(function (list) {
      managed = G.sortPhotos(list);
      paintGrid();
    }).catch(function (e) {
      if (e && e.code === "password") { toast(G.errText(e)); logout(); return; }
      state.innerHTML = esc(G.errText(e)) + ' <button type="button" class="up-link" data-retry>再読み込み</button>';
      $("[data-retry]", state).addEventListener("click", function () { loadManaged(true); });
    });
  }
  function paintGrid() {
    var list = (managed || []).filter(function (p) { return who === "all" || p.mine; });
    var state = $("[data-manage-state]");
    state.textContent = list.length ? list.length + "枚" : (who === "mine" ? "この端末から投稿した写真はまだありません。" : "まだ写真がありません。");
    var grid = $("[data-grid]");
    grid.innerHTML = list.map(function (p) {
      return '<button type="button" class="up-tile" data-id="' + esc(p.id) + '">' +
        '<img alt="" loading="lazy" decoding="async">' +
        (p.mine ? '<span class="up-tile__mine">自分</span>' : "") +
        (p.tags.length ? '<span class="up-tile__tags">' + esc(p.tags.join("・")) + "</span>" : "") + "</button>";
    }).join("");
    $$(".up-tile", grid).forEach(function (b, i) {
      var p = list[i], img = $("img", b);
      G.bindFallback(img, p, 400);
      img.src = G.imgUrl(p, 400);
    });
  }
  function initManage() {
    $$("[data-who]").forEach(function (b) {
      b.addEventListener("click", function () {
        who = b.getAttribute("data-who");
        $$("[data-who]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        paintGrid();
      });
    });
    $("[data-grid]").addEventListener("click", function (e) {
      var t = e.target.closest("[data-id]"); if (!t) return;
      var p = (managed || []).filter(function (q) { return q.id === t.getAttribute("data-id"); })[0];
      if (p) openSheet(p);
    });
  }

  /* ------------------------------------------------------------ sheet (詳細・編集) */
  var sheet, cur = null;
  function dlgOpen(d) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); document.documentElement.classList.add("is-locked"); }
  function dlgClose(d) { if (d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); } if (!sheet.open && !$("[data-confirm]").open) document.documentElement.classList.remove("is-locked"); }

  function fmtDate(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function openSheet(p) {
    cur = p;
    var img = $("[data-sheet-img]");
    img.src = G.imgUrl(p, 1000);
    var body = $("[data-sheet-body]");
    var label = G.creditLabel(p);
    if (p.mine) {
      var x0 = p.x ? (G.parseX(p.x) || {}) : {};
      body.innerHTML =
        '<p class="up-sheet__meta"><span class="up-badge">自分の投稿</span>' + esc(fmtDate(p.at)) + " 投稿</p>" +
        '<p class="up-item__q">写っているキャラクター</p>' +
        '<div class="chips" data-chips>' + chipsHTML(p.tags, "data-etag") + "</div>" +
        '<label class="up-field"><span class="up-field__label">表示する名前</span><input type="text" maxlength="40" data-e-name value="' + esc(p.credit) + '"></label>' +
        '<label class="up-field"><span class="up-field__label">X のリンク</span><input type="text" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="@ID またはポストのURL" data-e-x value="' + esc(p.x && x0.post ? p.x : (x0.handle || "")) + '"></label>' +
        '<div class="up-sheet__btns"><button type="button" class="up-btn up-btn--danger-ghost" data-e-del>削除</button>' +
        '<button type="button" class="up-btn up-btn--primary" data-e-save>変更を保存</button></div>';
      $("[data-chips]", body).addEventListener("click", function (e) {
        var c = e.target.closest("[data-etag]"); if (!c) return;
        c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true"));
      });
      $("[data-e-save]", body).addEventListener("click", saveEdit);
    } else {
      body.innerHTML =
        '<p class="up-sheet__meta">' + esc(fmtDate(p.at)) + " 投稿</p>" +
        '<dl class="up-sheet__dl"><dt>キャラクター</dt><dd>' + (p.tags.length ? esc(p.tags.join("・")) : '<span class="up-dim">なし</span>') + "</dd>" +
        "<dt>クレジット</dt><dd>" + (label ? esc(label) : '<span class="up-dim">なし</span>') + "</dd></dl>" +
        '<p class="up-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>他の人が投稿した写真なので、タグとクレジットは変更できません。</p>' +
        '<div class="up-sheet__btns"><button type="button" class="up-btn up-btn--danger-ghost" data-e-del>この写真を削除</button></div>';
    }
    $("[data-e-del]", body).addEventListener("click", function () { askDelete(p); });
    dlgOpen(sheet);
  }

  function saveEdit(e) {
    var p = cur, body = $("[data-sheet-body]"), btn = e.currentTarget;
    var xv = $("[data-e-x]", body).value.trim();
    if (G.parseX(xv) === null) { toast("X のリンクを確認してください"); return; }
    var meta = { tags: readChips(body, "data-etag"), credit: $("[data-e-name]", body).value.trim(), x: xv };
    btn.disabled = true; btn.textContent = "保存中…";
    api.update(pw, p.id, meta).then(function (np) {
      Object.assign(p, np, { mine: true });
      toast("保存しました");
      dlgClose(sheet);
      paintGrid();
    }).catch(function (x) { toast(G.errText(x)); })
      .then(function () { btn.disabled = false; btn.textContent = "変更を保存"; });
  }

  /* ------------------------------------------------------------ delete confirm */
  function askDelete(p) {
    var d = $("[data-confirm]");
    $("[data-confirm-img]").src = G.imgUrl(p, 400);
    var label = G.creditLabel(p);
    var wrap = $("[data-confirm-check-wrap]"), cb = $("[data-confirm-check]"), yes = $("[data-confirm-yes]");
    if (p.mine) {
      $("[data-confirm-h]").textContent = "この写真を削除しますか？";
      $("[data-confirm-p]").textContent = "ギャラリーからも消えます。";
      wrap.hidden = true; cb.checked = true;
    } else {
      $("[data-confirm-h]").textContent = "他の人が投稿した写真です";
      $("[data-confirm-p]").textContent = (label ? "投稿者：" + label + "\n" : "") + "削除するとギャラリーから消えます。できるだけ投稿した人に確認してから削除してください。";
      $("[data-confirm-check-text]").textContent = "削除して問題ないことを確認しました";
      wrap.hidden = false; cb.checked = false;
    }
    yes.disabled = !cb.checked;
    yes.textContent = "削除する";
    yes.onclick = function () {
      yes.disabled = true; yes.textContent = "削除中…";
      api.remove(pw, p.id).then(function () {
        managed = (managed || []).filter(function (q) { return q.id !== p.id; });
        dlgClose(d); dlgClose(sheet);
        paintGrid();
        toast("削除しました");
      }).catch(function (x) {
        toast(G.errText(x));
        yes.disabled = false; yes.textContent = "削除する";
      });
    };
    dlgOpen(d);
  }
  function initDialogs() {
    sheet = $("[data-sheet]");
    var conf = $("[data-confirm]");
    $("[data-sheet-close]").addEventListener("click", function () { dlgClose(sheet); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) dlgClose(sheet); });
    sheet.addEventListener("close", function () { dlgClose(sheet); });
    $("[data-confirm-no]").addEventListener("click", function () { dlgClose(conf); });
    conf.addEventListener("close", function () { dlgClose(conf); });
    $("[data-confirm-check]").addEventListener("change", function (e) { $("[data-confirm-yes]").disabled = !e.target.checked; });
  }

  /* ------------------------------------------------------------ boot */
  initLogin(); initTerms(); initCredit(); initPost(); initTabs(); initManage(); initDialogs();
  if (pw) {
    show("login");
    var btn = $("[data-login-btn]");
    btn.disabled = true; btn.textContent = "確認中…";
    api.auth(pw).then(afterLogin).catch(function (e) {
      if (e && e.code === "password") { S.del("mkp26-pw"); S.sdel("mkp26-pw"); pw = ""; }
      else { var err = $("[data-login-error]"); err.textContent = G.errText(e); err.hidden = false; }
    }).then(function () { btn.disabled = false; btn.textContent = "入る"; });
  } else {
    show("login");
  }
})();
