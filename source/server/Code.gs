/**
 * Training 雲端程式（Google Apps Script）
 * 只需要改下面這一行的密碼，跟 App「設定 → 雲端同步」填的要一樣。
 */
const KEY = '__KEY__';

const DATA_SHEET = '_data';
const HEAD = ['key', 'type', 'id', 'rev', 'device', 'deleted', 'json', 'updated'];
const PAGE = 1500;

function doGet() {
  return out({ ok: true, app: 'training', msg: 'Training 雲端已啟用' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad_json' }); }
  if (!req || req.key !== KEY) return out({ ok: false, error: 'key' });
  try {
    if (req.op === 'ping') return out({ ok: true, rev: curRev() });
    if (req.op === 'pull') return out(pull(req));
    if (req.op === 'push') return withLock(() => push(req));
    if (req.op === 'photo') return withLock(() => putPhoto(req));
    if (req.op === 'getphoto') return out(getPhoto(req));
    return out({ ok: false, error: 'op' });
  } catch (err) {
    return out({ ok: false, error: 'server', msg: String(err && err.message || err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return out(fn()); } finally { lock.releaseLock(); }
}
function props() { return PropertiesService.getScriptProperties(); }
function curRev() { return Number(props().getProperty('REV') || 0); }

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
  }
  return sh;
}

/** 讀取比 since 新、而且不是這台裝置寫的紀錄 */
function pull(req) {
  const since = Number(req.since || 0);
  const rev = curRev();
  if (since >= rev) return { ok: true, recs: [], cursor: rev, more: false };
  const sh = sheet();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return { ok: true, recs: [], cursor: rev, more: false };
  const rows = sh.getRange(2, 1, n, HEAD.length).getValues();
  const hit = [];
  for (const r of rows) if (Number(r[3]) > since) hit.push(r);
  hit.sort((a, b) => Number(a[3]) - Number(b[3]));
  const page = hit.slice(0, PAGE);
  const more = hit.length > PAGE;
  const cursor = more ? Number(page[page.length - 1][3]) : rev;
  const recs = [];
  for (const r of page) {
    if (req.dev && String(r[4]) === String(req.dev)) continue;
    recs.push({ c: String(r[1]), id: String(r[2]), rev: Number(r[3]), d: r[5] ? 1 : 0, j: r[5] ? null : String(r[6]) });
  }
  return { ok: true, recs, cursor, more };
}

/**
 * 寫入：逐筆比對。base 是這台裝置最後知道的版本號。
 * 雲端版本比 base 新，表示別台裝置改過 → 不覆蓋，回傳雲端版本（衝突）。
 */
function push(req) {
  const uniq = {};
  for (const r of (req.recs || [])) uniq[r.c + ':' + r.id] = r;
  const recs = Object.keys(uniq).map(k => uniq[k]);
  const sh = sheet();
  const n = sh.getLastRow() - 1;
  const index = {};
  let keys = [], revs = [];
  if (n > 0) {
    const vals = sh.getRange(2, 1, n, 7).getValues();
    for (let i = 0; i < vals.length; i++) { index[vals[i][0]] = i; keys.push(vals[i]); }
  }
  let rev = curRev();
  const done = [], conflicts = [], appends = [], updates = [];
  const now = new Date();
  for (const r of recs) {
    const k = r.c + ':' + r.id;
    const at = index[k];
    if (at !== undefined) {
      const row = keys[at];
      const srvRev = Number(row[3]);
      if (srvRev > Number(r.base || 0) && String(row[4]) !== String(req.dev)) {
        conflicts.push({ c: r.c, id: r.id, rev: srvRev, d: row[5] ? 1 : 0, j: row[5] ? null : String(row[6]) });
        continue;
      }
      rev++;
      updates.push({ at, row: [k, r.c, r.id, rev, req.dev || '', r.d ? 1 : '', r.d ? '' : r.j, now] });
      done.push({ k, rev });
    } else {
      if (r.d) { done.push({ k, rev: 0 }); continue; }
      rev++;
      index[k] = keys.length + appends.length;
      appends.push([k, r.c, r.id, rev, req.dev || '', '', r.j, now]);
      done.push({ k, rev });
    }
    if (r.c === 'blobs' && r.d && r.oldDrive) trashFile(r.oldDrive);
  }
  for (const u of updates) sh.getRange(u.at + 2, 1, 1, HEAD.length).setValues([u.row]);
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, HEAD.length).setValues(appends);
  props().setProperty('REV', String(rev));
  return { ok: true, done, conflicts, rev };
}

function folder() {
  const id = props().getProperty('FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder('Training 照片');
  props().setProperty('FOLDER', f.getId());
  return f;
}
function putPhoto(req) {
  const blob = Utilities.newBlob(Utilities.base64Decode(req.b64), 'image/jpeg', (req.name || req.id) + '.jpg');
  const file = folder().createFile(blob);
  return { ok: true, drive: file.getId() };
}
function getPhoto(req) {
  const f = DriveApp.getFileById(req.drive);
  return { ok: true, b64: Utilities.base64Encode(f.getBlob().getBytes()) };
}
function trashFile(id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { } }

/* ===== 在試算表裡看紀錄 ===== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Training').addItem('更新可讀報表', 'buildReadable').addToUi();
}
function buildReadable() {
  const sh = sheet(); const n = sh.getLastRow() - 1; if (n <= 0) return;
  const rows = sh.getRange(2, 1, n, HEAD.length).getValues().filter(r => !r[5]);
  const by = {}; for (const r of rows) { (by[r[1]] = by[r[1]] || {})[r[2]] = JSON.parse(r[6]); }
  const sessions = by.sessions || {}, ex = by.customEx || {};
  const write = (name, head, data) => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const s = ss.getSheetByName(name) || ss.insertSheet(name);
    s.clearContents();
    s.getRange(1, 1, 1, head.length).setValues([head]);
    if (data.length) s.getRange(2, 1, data.length, head.length).setValues(data);
  };
  const sets = Object.values(by.sets || {}).map(x => { const s = sessions[x.sid] || {}; return [s.date || '', s.day || '', x.ex, x.n, x.warm ? '熱身' : '', x.tw, x.reps, x.rir || '', x.pr || '']; })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  write('訓練紀錄', ['日期', '訓練日', '動作代號', '組', '熱身', '總重 kg', '次數', '還能做幾下', 'PR'], sets);
  const ws = Object.values(by.weights || {}).map(w => [w.date, w.kg]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  write('體重', ['日期', '體重 kg'], ws);
  const fl = Object.values(by.foodlog || {}).map(f => [f.date, f.meal, f.name, f.qty, f.unit, f.kcal, f.p, f.c, f.f]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  write('飲食', ['日期', '餐別', '食物', '份量', '單位', '熱量', '蛋白質', '碳水', '脂肪'], fl);
}
