/* =====================================================================
   MKP26 フォトギャラリー — データベース（Google Apps Script）
   ---------------------------------------------------------------------
   このファイルの中身を、Googleスプレッドシートの「拡張機能 → Apps Script」に
   まるごと貼り付けて使います。手順は README.md の「フォトギャラリー」を見てください。

   ・写真そのもの … Google ドライブのフォルダ（自動で作られます）
   ・写真の情報   … このスプレッドシートの「photos」シート（1行 = 1枚）
   ・部員用ページ（upload.html）からの投稿・削除は、下の合言葉を知っている人だけができます
   ・削除した写真はドライブのゴミ箱に入り、シートの status が deleted になります（30日以内なら復元可）

   ★ コードを書き換えたら「デプロイ → デプロイを管理 → ✏️ → バージョン：新バージョン → デプロイ」
     をしないと反映されません（URLは変わりません）
   ===================================================================== */

var CONFIG = {
  // ★ 部員用ページに入るための合言葉（部員にだけ伝えてください）
  PASSWORD: "ここに合言葉を書く",

  // スプレッドシートの「拡張機能 → Apps Script」から作った場合は空のままでOK。
  // script.google.com で単独のプロジェクトとして作った場合は、スプレッドシートのURLの /d/ と /edit の間のIDを書く
  SPREADSHEET_ID: "",

  FOLDER_NAME: "MKP26 Gallery Photos",   // 写真を保存するドライブのフォルダ名
  SHEET_NAME: "photos",                  // 写真の情報を書くシート名
  MAX_IMAGE_BYTES: 4 * 1024 * 1024,      // 1枚あたりの上限（ふつうは圧縮済みで 0.2〜0.6MB）
  MAX_TAGS: 20,
};

var HEAD = ["id", "createdAt", "fileId", "width", "height", "tags", "credit", "xUrl", "ownerHash", "status", "deletedAt"];
var COL = {}; HEAD.forEach(function (h, i) { COL[h] = i; });
var CACHE_KEY = "public-list-v1";

/* ------------------------------------------------------------------
   最初に1回だけ実行する（上のメニューで setup を選んで ▶ 実行）
   ------------------------------------------------------------------ */
function setup() {
  var sh = sheet_();
  var folder = folder_();
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("⚠ フォルダを「リンクを知っている全員」に共有できませんでした。大学などの組織アカウントでは制限されることがあります。個人のGoogleアカウントで作り直してください。 " + e);
  }
  Logger.log("準備OK： シート「" + sh.getName() + "」 / フォルダ「" + folder.getName() + "」 " + folder.getUrl());
  if (CONFIG.PASSWORD === "ここに合言葉を書く") Logger.log("⚠ CONFIG.PASSWORD をまだ変更していません！");
}

/* ------------------------------------------------------------------
   公開用：ギャラリーの一覧（誰でも見られる）
   GET  ?action=list
   ------------------------------------------------------------------ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var action = p.action || "list";
    if (action === "list") return out_({ ok: true, photos: publicList_() });
    if (action === "ping") return out_({ ok: true });
    return out_({ ok: false, error: "unknown_action" });
  } catch (err) {
    return out_({ ok: false, error: msg_(err) });
  }
}

/* ------------------------------------------------------------------
   部員用：合言葉が必要な操作
   POST { action: "auth" | "manage" | "upload" | "update" | "delete", password, ownerKey, ... }
   ------------------------------------------------------------------ */
function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: "bad_request" }); }
  try {
    if (!checkPassword_(b.password)) return out_({ ok: false, error: "password" });
    switch (b.action) {
      case "auth":   return out_({ ok: true });
      case "manage": return out_({ ok: true, photos: manageList_(b.ownerKey) });
      case "upload": return out_(upload_(b));
      case "update": return out_(update_(b));
      case "delete": return out_(remove_(b));
    }
    return out_({ ok: false, error: "unknown_action" });
  } catch (err) {
    return out_({ ok: false, error: msg_(err) });
  }
}

/* ================================================================== */

function upload_(b) {
  var ownerHash = ownerHash_(b.ownerKey);
  if (!ownerHash) return { ok: false, error: "owner_key" };
  if (!b.image || typeof b.image !== "string") return { ok: false, error: "no_image" };

  var bytes = Utilities.base64Decode(b.image);
  if (bytes.length > CONFIG.MAX_IMAGE_BYTES) return { ok: false, error: "too_large" };
  // JPEG（FF D8）だけ受け付ける（ブラウザ側で必ずJPEGに圧縮してから送っています）
  if (!(bytes.length > 3 && (bytes[0] & 255) === 0xFF && (bytes[1] & 255) === 0xD8)) return { ok: false, error: "not_jpeg" };

  var id = newId_();
  var now = new Date();
  var name = "mkp26_" + Utilities.formatDate(now, "Asia/Tokyo", "yyyyMMdd_HHmmss") + "_" + id + ".jpg";
  var file = folder_().createFile(Utilities.newBlob(bytes, "image/jpeg", name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) { /* フォルダ側の共有で足りる */ }

  var meta = cleanMeta_(b);
  var row = [];
  row[COL.id] = id;
  row[COL.createdAt] = now;
  row[COL.fileId] = file.getId();
  row[COL.width] = clampInt_(b.width, 1, 20000);
  row[COL.height] = clampInt_(b.height, 1, 20000);
  row[COL.tags] = cell_(meta.tags.join(", "));
  row[COL.credit] = cell_(meta.credit);
  row[COL.xUrl] = cell_(meta.xUrl);
  row[COL.ownerHash] = ownerHash;
  row[COL.status] = "public";
  row[COL.deletedAt] = "";

  withLock_(function () { sheet_().appendRow(row); });
  clearCache_();
  var obj = rowObj_(row);
  obj.tags = meta.tags; obj.credit = meta.credit; obj.xUrl = meta.xUrl;
  return { ok: true, photo: toPhoto_(obj, ownerHash) };
}

function update_(b) {
  var ownerHash = ownerHash_(b.ownerKey);
  if (!ownerHash) return { ok: false, error: "owner_key" };
  var res = withLock_(function () {
    var f = findRow_(b.id);
    if (!f || f.obj.status === "deleted") return { ok: false, error: "not_found" };
    // 他の人の写真のクレジット・タグは変更できない
    if (f.obj.ownerHash !== ownerHash) return { ok: false, error: "not_owner" };
    var meta = cleanMeta_(b);
    var sh = sheet_();
    sh.getRange(f.row, COL.tags + 1).setValue(cell_(meta.tags.join(", ")));
    sh.getRange(f.row, COL.credit + 1).setValue(cell_(meta.credit));
    sh.getRange(f.row, COL.xUrl + 1).setValue(cell_(meta.xUrl));
    f.obj.tags = meta.tags; f.obj.credit = meta.credit; f.obj.xUrl = meta.xUrl;
    return { ok: true, photo: toPhoto_(f.obj, ownerHash) };
  });
  clearCache_();
  return res;
}

function remove_(b) {
  // 削除は部員なら誰でもできる（確認はページ側で行う）。ファイルはドライブのゴミ箱へ。
  var res = withLock_(function () {
    var f = findRow_(b.id);
    if (!f) return { ok: false, error: "not_found" };
    if (f.obj.status === "deleted") return { ok: true };
    var sh = sheet_();
    sh.getRange(f.row, COL.status + 1).setValue("deleted");
    sh.getRange(f.row, COL.deletedAt + 1).setValue(new Date());
    try { DriveApp.getFileById(f.obj.fileId).setTrashed(true); } catch (x) { /* もう無い */ }
    return { ok: true };
  });
  clearCache_();
  return res;
}

function publicList_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CACHE_KEY);
  if (hit) return JSON.parse(hit);
  var list = readAll_().filter(isPublic_).map(function (o) { return toPhoto_(o, null); });
  var json = JSON.stringify(list);
  if (json.length < 95000) { try { cache.put(CACHE_KEY, json, 120); } catch (x) { /* 大きすぎるときはキャッシュしない */ } }
  return list;
}

function manageList_(ownerKey) {
  var h = ownerHash_(ownerKey);
  return readAll_().filter(isPublic_).map(function (o) { return toPhoto_(o, h); });
}

/* ------------------------------------------------------------------ helpers */
function isPublic_(o) { return o.id && o.fileId && o.status !== "deleted" && o.status !== "hidden"; }

function toPhoto_(o, ownerHash) {
  var p = {
    id: String(o.id),
    f: String(o.fileId),
    w: Number(o.width) || 0,
    h: Number(o.height) || 0,
    tags: Array.isArray(o.tags) ? o.tags : splitTags_(o.tags),
    credit: String(o.credit || ""),
    x: String(o.xUrl || ""),
    at: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt || ""),
  };
  if (ownerHash) p.mine = o.ownerHash === ownerHash;
  return p;
}

function splitTags_(s) {
  return String(s || "").split(/[,、，]/).map(function (t) { return t.trim(); }).filter(Boolean);
}

function cleanMeta_(b) {
  var tags = (Array.isArray(b.tags) ? b.tags : []).map(function (t) { return clip_(String(t).replace(/[,、，]/g, " ").trim(), 30); })
    .filter(Boolean);
  tags = tags.filter(function (t, i) { return tags.indexOf(t) === i; }).slice(0, CONFIG.MAX_TAGS);
  return { tags: tags, credit: clip_(String(b.credit || "").replace(/\s+/g, " ").trim(), 40), xUrl: normalizeX_(b.x) };
}

// X のリンクは @ID か x.com / twitter.com のURLだけを受け付ける（それ以外は保存しない）
function normalizeX_(v) {
  v = String(v || "").trim();
  if (!v) return "";
  var m = v.match(/^@?([A-Za-z0-9_]{1,15})$/);
  if (m) return "https://x.com/" + m[1];
  m = v.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(\/status\/\d{1,25})?\/?(?:[?#].*)?$/i);
  if (m) return "https://x.com/" + m[1] + (m[2] || "");
  return "";
}

function checkPassword_(pw) {
  if (typeof pw === "string" && pw.length > 0 && pw === CONFIG.PASSWORD && CONFIG.PASSWORD !== "ここに合言葉を書く") return true;
  Utilities.sleep(1200); // 総当たり対策で少し待たせる
  return false;
}

function ownerHash_(key) {
  key = String(key || "");
  if (!/^[a-f0-9]{32,64}$/.test(key)) return "";
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "mkp26:" + key, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
}

function newId_() { return Utilities.getUuid().replace(/-/g, "").slice(0, 12); }
function clip_(s, n) { return s.length > n ? s.slice(0, n) : s; }
function clampInt_(v, lo, hi) { v = Math.round(Number(v) || 0); return Math.max(lo, Math.min(hi, v)); }
// スプレッドシートが = + - @ で始まる文字を数式として扱わないように
function cell_(s) { s = String(s || ""); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function msg_(err) { return String((err && err.message) || err); }

function sheet_() {
  var ss = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function folder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("FOLDER_ID");
  if (id) {
    try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (x) { /* 作り直す */ }
  }
  var nf = DriveApp.createFolder(CONFIG.FOLDER_NAME);
  props.setProperty("FOLDER_ID", nf.getId());
  return nf;
}

function readAll_() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEAD.length).getValues().map(rowObj_);
}

function rowObj_(r) {
  var o = {};
  HEAD.forEach(function (h, i) { o[h] = r[i]; });
  o.id = String(o.id || "");
  o.status = String(o.status || "public").trim().toLowerCase();
  return o;
}

function findRow_(id) {
  id = String(id || "");
  if (!id) return null;
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return null;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      var r = sh.getRange(i + 2, 1, 1, HEAD.length).getValues()[0];
      return { row: i + 2, obj: rowObj_(r) };
    }
  }
  return null;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function clearCache_() { try { CacheService.getScriptCache().remove(CACHE_KEY); } catch (x) { /* noop */ } }

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
