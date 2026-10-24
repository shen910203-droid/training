/* ===== 雲端同步 =====
 * 原則：手機是主資料，雲端是逐筆備份。
 * 每筆紀錄有 key（類型:編號），只上傳 hash 有變的紀錄；刪除送墓碑。
 * 版本以雲端流水號 rev 為準，不用手機時間。
 */
const SYNC = { cfg: null, meta: null, busy: false, pending: 0, status: 'off', msg: '', timer: null, photoQ: {} };
const ARR_COLS = ['sessions', 'sets', 'foodlog', 'foods', 'measures', 'photos', 'cardio', 'customEx', 'gyms', 'targets', 'combos'];
const MAP_COLS = ['water', 'creatine', 'exu', 'blobs', 'rxu', 'daydone', 'suppck'];
const SINGLES = ['profile', 'supp', 'settings'];
const LOCAL_SETTINGS = ['lastBackup'];
const IS_PAGES = typeof window !== 'undefined' && window.APP_MODE === 'pages';

function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + str.length.toString(36); }
function blankMeta() { return { cursor: 0, h: {}, r: {}, bd: {}, dev: 'd' + uid(), connected: false, last: null, err: null }; }

function syncRecords() {
  const m = new Map();
  for (const c of ARR_COLS) for (const it of (S[c] || [])) { if (!it.id) it.id = uid(); m.set(c + ':' + it.id, JSON.stringify(it)); }
  for (const w of S.weights || []) m.set('weights:' + w.date, JSON.stringify(w));
  for (const c of MAP_COLS) for (const k of Object.keys(S[c] || {})) m.set(c + ':' + k, JSON.stringify(S[c][k]));
  if (S.profile) m.set('single:profile', JSON.stringify(S.profile));
  m.set('single:supp', JSON.stringify(S.supp));
  const st = Object.assign({}, S.settings); for (const k of LOCAL_SETTINGS) delete st[k];
  m.set('single:settings', JSON.stringify(st));
  return m;
}
function splitKey(k) { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)]; }
function applyRec(c, id, j) {
  const v = j == null ? null : JSON.parse(j);
  if (ARR_COLS.includes(c)) {
    S[c] = S[c] || []; const i = S[c].findIndex(x => x.id === id);
    if (v == null) { if (i >= 0) S[c].splice(i, 1); } else if (i >= 0) S[c][i] = v; else S[c].push(v);
  } else if (c === 'weights') {
    const i = S.weights.findIndex(x => x.date === id);
    if (v == null) { if (i >= 0) S.weights.splice(i, 1); } else if (i >= 0) S.weights[i] = v; else S.weights.push(v);
  } else if (MAP_COLS.includes(c)) {
    S[c] = S[c] || {}; if (v == null) delete S[c][id]; else S[c][id] = v;
  } else if (c === 'single') {
    if (id === 'profile') S.profile = v;
    if (id === 'supp' && v) S.supp = Object.assign(blankState().supp, v);
    if (id === 'settings' && v) { const keep = {}; for (const k of LOCAL_SETTINGS) keep[k] = S.settings[k]; S.settings = Object.assign(blankState().settings, v, keep); }
  }
}
function syncDiff() {
  const meta = SYNC.meta; const cur = syncRecords(); const out = [];
  for (const [k, j] of cur) { const h = fnv(j); if (meta.h[k] !== h) { const [c, id] = splitKey(k); out.push({ k, c, id, j, h, base: meta.r[k] || 0 }); } }
  for (const k of Object.keys(meta.h)) if (!cur.has(k)) { const [c, id] = splitKey(k); const r = { k, c, id, d: 1, base: meta.r[k] || 0 }; if (c === 'blobs' && meta.bd[id]) r.oldDrive = meta.bd[id]; out.push(r); }
  return out;
}
async function syncApi(op, body, timeoutMs) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), timeoutMs || 45000);
  try {
    const res = await fetch(SYNC.cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ op, key: SYNC.cfg.key, dev: SYNC.meta.dev }, body || {})), signal: ctl ? ctl.signal : undefined, redirect: 'follow' });
    const txt = await res.text();
    let d; try { d = JSON.parse(txt); } catch (e) { throw new Error(/<html/i.test(txt) ? '雲端網址不對，或部署時「誰可以存取」沒有選「所有人」' : '雲端回應看不懂'); }
    if (!d.ok) throw new Error(d.error === 'key' ? '密碼不對，請確認跟 Apps Script 裡的 KEY 一樣' : '雲端錯誤：' + (d.msg || d.error));
    return d;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('連線逾時，稍後會自動再試');
    if (e instanceof TypeError) throw new Error('連不到雲端（沒有網路或網址錯誤）');
    throw e;
  } finally { clearTimeout(t); }
}
async function loadSync() {
  SYNC.cfg = (await Store.get('cloud')) || null;
  SYNC.meta = (await Store.get('syncmeta')) || blankMeta();
  SYNC.status = SYNC.cfg ? 'idle' : 'off';
}
function saveMeta() { return Store.set('syncmeta', SYNC.meta); }
function refPhotoKeys() {
  const s = new Set();
  for (const p of S.photos || []) if (p.key) s.add(p.key);
  for (const k of Object.keys(S.exu || {})) if (S.exu[k] && S.exu[k].photo) s.add(S.exu[k].photo);
  return s;
}
async function syncNow(opts) {
  opts = opts || {};
  if (!SYNC.cfg) return { skipped: true };
  if (SYNC.busy) { SYNC.again = true; return SYNC.running; }
  SYNC.running = syncOnce(opts);
  const r = await SYNC.running;
  if (SYNC.again) { SYNC.again = false; return syncNow(opts); }
  return r;
}
async function syncOnce(opts) {
  SYNC.busy = true; SYNC.status = 'syncing'; drawSyncBadge();
  const meta = SYNC.meta; let pulled = 0, pushed = 0, conflicts = 0, photos = 0;
  try {
    // 1. 下載別台裝置的變動
    let more = true, applied = false;
    while (more) {
      const res = await syncApi('pull', { since: meta.cursor });
      for (const r of res.recs) {
        const k = r.c + ':' + r.id;
        applyRec(r.c, r.id, r.d ? null : r.j); applied = true; pulled++;
        if (r.d) { delete meta.h[k]; delete meta.r[k]; } else { meta.h[k] = fnv(r.j); meta.r[k] = r.rev; }
        if (r.c === 'blobs') { if (r.d) delete meta.bd[r.id]; else meta.bd[r.id] = JSON.parse(r.j); }
      }
      meta.cursor = res.cursor; more = res.more;
    }
    if (applied) { buildExMap(S); }
    // 2. 清掉沒用到的照片對照，照片上傳（每張只傳一次）
    const refs = refPhotoKeys();
    for (const k of Object.keys(S.blobs || {})) if (!refs.has(k)) delete S.blobs[k];
    for (const k of refs) {
      if (S.blobs[k]) continue;
      const url = await Store.get('img:' + k); if (!url) continue;
      const res = await syncApi('photo', { id: k, name: k, b64: url.split(',')[1] }, 90000);
      S.blobs[k] = res.drive; photos++;
    }
    // 3. 上傳有變動的紀錄（分批）
    const diff = syncDiff();
    for (let i = 0; i < diff.length; i += 400) {
      const batch = diff.slice(i, i + 400);
      const res = await syncApi('push', { recs: batch.map(r => ({ c: r.c, id: r.id, j: r.j, d: r.d || 0, base: r.base, oldDrive: r.oldDrive })) });
      const byK = {}; for (const r of batch) byK[r.k] = r;
      for (const d of res.done) {
        const r = byK[d.k]; if (!r) continue;
        if (r.d) { delete meta.h[d.k]; delete meta.r[d.k]; if (r.c === 'blobs') delete meta.bd[r.id]; }
        else { meta.h[d.k] = r.h; meta.r[d.k] = d.rev; if (r.c === 'blobs') meta.bd[r.id] = JSON.parse(r.j); }
        pushed++;
      }
      for (const cf of res.conflicts) {
        const k = cf.c + ':' + cf.id; conflicts++;
        applyRec(cf.c, cf.id, cf.d ? null : cf.j);
        if (cf.d) { delete meta.h[k]; delete meta.r[k]; } else { meta.h[k] = fnv(cf.j); meta.r[k] = cf.rev; }
      }
      if (res.conflicts.length) buildExMap(S);
    }
    meta.connected = true; meta.last = new Date().toISOString(); meta.err = null;
    SYNC.status = 'idle';
    if (conflicts) toast(conflicts + ' 筆資料在另一台裝置改過，已採用雲端較新的版本');
  } catch (e) {
    meta.err = e.message || String(e); SYNC.status = 'error';
  } finally {
    await saveMeta(); await saveNow();
    SYNC.busy = false;
    SYNC.pending = SYNC.cfg ? syncDiff().length : 0;
    drawSyncBadge();
    if (pulled || conflicts) rerender();
    else if (UI.sheets.some(s => s.id === 'cloud')) refreshSheet('cloud');
  }
  return { pulled, pushed, conflicts, photos, err: meta.err };
}
function scheduleSync(ms) {
  if (!SYNC.cfg) return;
  clearTimeout(SYNC.timer);
  SYNC.timer = setTimeout(() => syncNow(), ms == null ? 45000 : ms);
}
function updatePending() {
  if (!SYNC.cfg || !SYNC.meta) return;
  clearTimeout(updatePending.t);
  updatePending.t = setTimeout(() => { SYNC.pending = syncDiff().length; drawSyncBadge(); }, 600);
}
function drawSyncBadge() {
  const el = document.getElementById('syncBadge'); if (!el) return;
  el.innerHTML = syncBadgeHtml();
}
function syncBadgeHtml() {
  if (!SYNC.cfg) return '';
  if (SYNC.status === 'syncing') return '<span class="sb sb-run">' + ic('cloud') + '同步中</span>';
  if (SYNC.status === 'error') return '<span class="sb sb-err">' + ic('cloud') + '未同步' + (SYNC.pending ? ' ' + SYNC.pending : '') + '</span>';
  if (SYNC.pending) return '<span class="sb">' + ic('cloud') + '待同步 ' + SYNC.pending + '</span>';
  return '<span class="sb sb-ok">' + ic('cloud') + '已同步</span>';
}
async function fetchCloudImg(key) {
  if (!SYNC.cfg || !S.blobs || !S.blobs[key]) return null;
  if (SYNC.photoQ[key]) return SYNC.photoQ[key];
  SYNC.photoQ[key] = (async () => {
    try {
      const res = await syncApi('getphoto', { drive: S.blobs[key] }, 60000);
      const url = 'data:image/jpeg;base64,' + res.b64;
      imgCache[key] = url; await Store.set('img:' + key, url);
      return url;
    } catch (e) { return null; } finally { setTimeout(() => delete SYNC.photoQ[key], 5000); }
  })();
  return SYNC.photoQ[key];
}
