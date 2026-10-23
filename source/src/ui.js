/* ===== 儲存 ===== */
const Store = {
  mode: 'mem', db: null, mem: {},
  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('lgb', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        setTimeout(() => rej(new Error('timeout')), 4000);
      });
      this.mode = 'idb';
    } catch (e) {
      try { localStorage.setItem('lgb_t', '1'); localStorage.removeItem('lgb_t'); this.mode = 'ls'; } catch (e2) { this.mode = 'mem'; }
    }
  },
  async get(k) {
    try {
      if (this.mode === 'idb') return await new Promise((res, rej) => { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      if (this.mode === 'ls') { const v = localStorage.getItem('lgb_' + k); return v ? JSON.parse(v) : undefined; }
    } catch (e) { }
    return this.mem[k];
  },
  async set(k, v) {
    try {
      if (this.mode === 'idb') return await new Promise((res, rej) => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
      if (this.mode === 'ls') { localStorage.setItem('lgb_' + k, JSON.stringify(v)); return; }
    } catch (e) { console.warn('save fail', e); saveFailed = true; }
    this.mem[k] = v;
  },
  async del(k) {
    try {
      if (this.mode === 'idb') return await new Promise(res => { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; });
      if (this.mode === 'ls') { localStorage.removeItem('lgb_' + k); return; }
    } catch (e) { }
    delete this.mem[k];
  },
  async keys() {
    try {
      if (this.mode === 'idb') return await new Promise(res => { const r = this.db.transaction('kv').objectStore('kv').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); });
      if (this.mode === 'ls') return Object.keys(localStorage).filter(k => k.startsWith('lgb_')).map(k => k.slice(4));
    } catch (e) { }
    return Object.keys(this.mem);
  }
};
let S = blankState();
let saveFailed = false;
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => Store.set('state', S), 40); if (typeof updatePending === 'function') { updatePending(); scheduleSync(); } }
function saveNow() { clearTimeout(saveT); return Store.set('state', S); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
window.addEventListener('pagehide', () => saveNow());
const imgCache = {};
async function getImg(key) { if (!key) return null; if (imgCache[key]) return imgCache[key]; const v = await Store.get('img:' + key); if (v) imgCache[key] = v; return v; }
async function putImg(dataUrl) { const key = uid(); imgCache[key] = dataUrl; await Store.set('img:' + key, dataUrl); return key; }
function fileToDataUrl(file, max, q) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q || 0.8));
      };
      im.onerror = () => rej(new Error('無法讀取這張圖片'));
      im.src = fr.result;
    };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}
function migrate(st) {
  const b = blankState();
  const out = Object.assign(b, st || {});
  out.settings = Object.assign(blankState().settings, (st || {}).settings || {});
  out.settings.cycle = Object.assign({ idx: 0, round: 1, restOn: null }, out.settings.cycle || {});
  out.supp = Object.assign(blankState().supp, (st || {}).supp || {});
  out.rxu = out.rxu || {};
  const T = out.settings.templates;
  if (T && !out.settings.tplVer) {
    const same = JSON.stringify(T) === JSON.stringify(DATA.oldTemplates);
    if (same) out.settings.templates = JSON.parse(JSON.stringify(DATA.templates));
    else for (const d of Object.keys(T)) T[d] = T[d].map(sl => Array.isArray(sl) ? { ids: sl, sets: 0 } : sl);
    out.settings.tplVer = 2; out.settings.tplUpgraded = same;
  }
  if (!T) out.settings.tplVer = 2;
  out.schema = 1;
  return out;
}

/* ===== 圖示 ===== */
const IC = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  dumbbell: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M7 15l4-4 3 3 5-6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5L20 7"/>',
  chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', play: '<path d="M7 5l12 7-12 7z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>', flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 2 3 4"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9a4 4 0 0 1 6 0l-2 2"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18z"/>',
  barcode: '<path d="M4 6v12M7 6v12M11 6v12M14 6v12M17 6v12M20 6v12"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
};
const ic = (n, cls) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>';

/* ===== 介面狀態 ===== */
const UI = { rows: {}, tab: 'today', foodDate: null, openEx: null, progSeg: 'overview', libDay: 'all', libMine: true, libQ: '', sheets: [], ob: null, entry: {} };
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function toast(msg, pr) {
  const t = $('#toast'); t.innerHTML = '<div class="in' + (pr ? ' pr' : '') + '">' + msg + '</div>';
  clearTimeout(toast.t); toast.t = setTimeout(() => t.innerHTML = '', pr ? 3200 : 2200);
}
function choiceBox(msg, opts) {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'dialog-wrap';
    w.innerHTML = '<div class="dialog" role="dialog" aria-modal="true"><p>' + msg + '</p><div class="stack" style="gap:8px">' + opts.map((o, i) => '<button class="btn block choice ' + (o.cls || '') + '" data-r="' + i + '">' + o.label + (o.sub ? '<span class="xs">' + o.sub + '</span>' : '') + '</button>').join('') + '</div></div>';
    w.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b || e.target === w) { w.remove(); res(b ? opts[+b.dataset.r].v : null); } });
    $('#layer').appendChild(w);
  });
}
function confirmBox(msg, okText, danger) {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'dialog-wrap';
    w.innerHTML = '<div class="dialog" role="dialog" aria-modal="true"><p>' + msg + '</p><div class="row"><button class="btn grow" data-r="0">取消</button><button class="btn grow ' + (danger ? 'danger' : 'pri') + '" data-r="1">' + (okText || '確定') + '</button></div></div>';
    w.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b || e.target === w) { w.remove(); res(!!(b && b.dataset.r === '1')); } });
    $('#layer').appendChild(w);
  });
}

/* ===== 面板 ===== */
function openSheet(id, render, opts) {
  UI.sheets = UI.sheets.filter(s => s.id !== id);
  UI.sheets.push({ id, render, opts: opts || {} });
  drawSheets();
}
function closeSheet(id) { if (!id || id === 'scan') { const top = UI.sheets[UI.sheets.length - 1]; if (id === 'scan' || (top && top.id === 'scan')) stopScan(); } UI.sheets = id ? UI.sheets.filter(s => s.id !== id) : UI.sheets.slice(0, -1); drawSheets(); }
function drawSheets() {
  const layer = $('#layer');
  $$('.sheet-wrap', layer).forEach(n => n.remove());
  UI.sheets.forEach((s, i) => {
    const r = s.render();
    const w = document.createElement('div'); w.className = 'sheet-wrap'; w.dataset.sheet = s.id;
    if (i < UI.sheets.length - 1) w.style.visibility = 'hidden';
    w.innerHTML = '<div class="sheet' + (s.opts.full ? ' full' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(r.title || '') + '">' +
      '<div class="sheet-h">' + (s.opts.noClose ? '' : '<button class="icon-btn" data-a="closeSheet" aria-label="關閉">' + ic('x') + '</button>') + '<h3>' + (r.title || '') + '</h3>' + (r.right || '') + '</div>' +
      '<div class="sheet-b">' + r.body + '</div>' + (r.foot ? '<div class="sheet-f">' + r.foot + '</div>' : '') + '</div>';
    w.addEventListener('click', e => { if (e.target === w && !s.opts.noClose) closeSheet(s.id); });
    layer.appendChild(w);
    if (r.after) r.after(w);
  });
  document.body.style.overflow = UI.sheets.length ? 'hidden' : '';
  hydrateImgs();
}
function refreshSheet(id) {
  const s = UI.sheets.find(x => x.id === id); if (!s) return;
  const w = $('.sheet-wrap[data-sheet="' + id + '"]'); if (!w) return drawSheets();
  const b = $('.sheet-b', w); const top = b.scrollTop;
  const r = s.render();
  $('.sheet-h h3', w).innerHTML = r.title || '';
  b.innerHTML = r.body;
  const f = $('.sheet-f', w); if (f && r.foot) f.innerHTML = r.foot;
  b.scrollTop = top;
  if (r.after) r.after(w);
  hydrateImgs();
}
function rerender() {
  render();
  UI.sheets.forEach(s => refreshSheet(s.id));
}

/* ===== 圖片元件 ===== */
function exThumb(e) {
  const im = exImgs(e);
  if (im.own.length) return '<div class="thumb photo"><img data-imgkey="' + im.own[0].key + '" alt=""></div>';
  if (im.lib.length) return '<div class="thumb' + (im.lib[0].line ? '' : ' photo') + '"><img src="' + im.lib[0].src + '" alt="" loading="lazy"></div>';
  return '<div class="thumb none">沒有圖</div>';
}
function exFigs(e) {
  const im = exImgs(e); let h = '';
  if (im.lib.length) h += '<div class="figs">' + im.lib.map(x => '<div class="fig' + (x.line ? '' : ' photo') + '"><img src="' + x.src + '" alt="' + esc(e.name) + '示範" loading="lazy"></div>').join('') + '</div>';
  if (im.own.length) h += '<div class="figs" style="margin-top:8px"><div class="fig wide photo"><img data-imgkey="' + im.own[0].key + '" alt="我拍的照片"></div></div>';
  if (!h) h = '<div class="note">這個動作圖庫裡沒有圖。可以在下方「我拍的照片」放一張你健身房那台機器的照片。</div>';
  return h;
}
async function hydrateImgs() {
  for (const im of $$('img[data-imgkey]')) {
    if (im.src) continue;
    let v = await getImg(im.dataset.imgkey);
    if (!v && typeof fetchCloudImg === 'function') { im.alt = '下載中…'; v = await fetchCloudImg(im.dataset.imgkey); }
    if (v) im.src = v;
  }
}
function bodyMap(pri, sec, heat) {
  const side = (which, vb) => {
    let s = '<svg viewBox="' + vb + '" role="img" aria-label="' + (which === 'front' ? '正面' : '背面') + '肌肉圖">';
    for (const part of BODY[which]) {
      let col = '#3a3f43';
      if (part.s === 'head' || part.s === 'hair') col = '#4b5054';
      else if (heat) { const v = heat[part.s] || 0; col = v <= 0 ? '#3a3f43' : v < 5 ? '#6b3b33' : v < 10 ? '#a8473a' : v <= 20 ? '#e5533d' : '#ff8a5c'; }
      else if (pri.includes(part.s)) col = '#e5533d';
      else if (sec.includes(part.s)) col = '#f0a090';
      for (const d of part.p) s += '<path d="' + d + '" fill="' + col + '" stroke="#0c0e0f" stroke-width="2"/>';
    }
    return s + '</svg>';
  };
  return '<div class="bodymap">' + side('front', '0 0 724 1448') + side('back', '724 0 724 1448') + '</div>';
}

/* ===== 圖表 ===== */
function lineChart(pts, opt) {
  opt = opt || {};
  const W = 340, H = opt.h || 150, L = 34, R = 10, T = 10, B = 22;
  if (!pts.length) return '<div class="empty">還沒有資料</div>';
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y).concat(opt.ref != null ? [opt.ref] : []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = Math.max((y1 - y0) * 0.15, opt.minPad || 0.5); y0 -= pad; y1 += pad;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.label || '趨勢圖') + '">';
  for (let i = 0; i <= 3; i++) { const v = y0 + (y1 - y0) * i / 3; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#24292c"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + fmtNum(v) + '</text>'; }
  if (opt.ref != null) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(opt.ref) + '" y2="' + Y(opt.ref) + '" stroke="#d4a24c" stroke-dasharray="4 4" stroke-width="1"/>';
  if (pts.length > 1) s += '<path d="' + pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('') + '" fill="none" stroke="' + (opt.color || '#d4a24c') + '" stroke-width="2"/>';
  if (opt.pts2 && opt.pts2.length > 1) s += '<path d="' + opt.pts2.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('') + '" fill="none" stroke="#7fa8d6" stroke-width="1.6" stroke-dasharray="3 3"/>';
  pts.forEach((p, i) => { s += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (i === pts.length - 1 ? 4 : 2.6) + '" fill="' + (opt.color || '#d4a24c') + '"/>'; });
  const lab = opt.xlabel || (x => x);
  s += '<text x="' + L + '" y="' + (H - 4) + '">' + esc(lab(pts[0].x)) + '</text>';
  if (pts.length > 1) s += '<text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">' + esc(lab(pts[pts.length - 1].x)) + '</text>';
  return s + '</svg>';
}
function barChart(items, ref, opt) {
  opt = opt || {};
  const W = 340, H = 150, L = 34, R = 6, T = 10, B = 22;
  const max = Math.max(ref || 0, ...items.map(i => i.v), 1) * 1.1;
  const bw = (W - L - R) / items.length;
  const Y = v => T + (1 - v / max) * (H - T - B);
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.label || '長條圖') + '">';
  for (let i = 0; i <= 2; i++) { const v = max * i / 2; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#24292c"/><text x="' + (L - 6) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + Math.round(v) + '</text>'; }
  items.forEach((it, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64;
    if (it.v > 0) s += '<rect x="' + x.toFixed(1) + '" y="' + Y(it.v).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (H - B - Y(it.v)).toFixed(1) + '" rx="2" fill="' + (ref && it.v >= ref * 0.9 ? '#62c08f' : '#d4a24c') + '"/>';
    const stp = Math.ceil(items.length / 7); if ((items.length - 1 - i) % stp === 0) s += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(it.l) + '</text>';
  });
  if (ref) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(ref) + '" y2="' + Y(ref) + '" stroke="#eceeef" stroke-opacity=".5" stroke-dasharray="4 4"/>';
  return s + '</svg>';
}
function ring(val, goal, inner) {
  const p = goal ? Math.min(1, val / goal) : 0, R = 50, C = 2 * Math.PI * R;
  return '<div class="ring"><svg viewBox="0 0 116 116"><circle cx="58" cy="58" r="' + R + '" fill="none" stroke="#262b2f" stroke-width="10"/>' +
    '<circle cx="58" cy="58" r="' + R + '" fill="none" stroke="' + (p >= 0.9 ? '#62c08f' : '#d4a24c') + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * p).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><div class="c">' + inner + '</div></div>';
}
function bar(v, goal, cls) { const p = goal ? Math.min(100, v / goal * 100) : 0; return '<div class="bar ' + (cls || (p >= 90 ? 'ok' : '')) + '"><i style="width:' + p.toFixed(0) + '%"></i></div>'; }

/* ===== 渲染主頁 ===== */
function render() {
  const today = todayStr();
  if (S.profile && syncCycle(S, today)) save();
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === UI.tab));
  const live = S.sessions.find(s => !s.end);
  const tb = $('#nav button[data-tab="train"] span.ico'); if (tb) tb.classList.toggle('dot', !!live);
  const v = { today: vToday, train: vTrain, food: vFood, progress: vProgress, library: vLibrary }[UI.tab];
  $('#app').innerHTML = S.profile ? v() : '';
  hydrateImgs();
  drawTimer();
}

/* ---------- 今日 ---------- */
function vToday() {
  const today = todayStr(); const p = S.profile; const t = currentTarget(S);
  const c = S.settings.cycle; const ph = phaseOf(c.round);
  const live = S.sessions.find(s => !s.end);
  const doneToday = S.sessions.filter(s => s.end && s.date === today);
  const isRest = ORDER[c.idx] === 'rest' && c.restOn === today && !doneToday.length;
  const tot = dayTotals(S, today);
  const lw = latestWeight(S);
  let h = '<div class="top"><div><div class="sub">' + mdLabel(today) + '</div><h1>Training</h1></div><div class="row" style="gap:8px"><button id="syncBadge" class="sbtn" data-a="cloud" aria-label="雲端同步">' + syncBadgeHtml() + '</button><button class="icon-btn" data-a="settings" aria-label="設定">' + ic('gear') + '</button></div></div><div class="stack">';
  // 訓練卡
  h += '<div class="card">';
  if (live) {
    h += '<h2>訓練進行中</h2><div class="hero-day"><div><div class="d">' + DAY_NAME[live.day] + '</div><div class="muted small">' + S.sets.filter(x => x.sid === live.id && !x.warm).length + ' 組已完成</div></div></div><div style="margin-top:14px"><button class="btn pri block" data-a="tab" data-v="train">' + ic('play') + '繼續訓練</button></div>';
  } else if (doneToday.length) {
    const s = doneToday[doneToday.length - 1];
    const sets = S.sets.filter(x => x.sid === s.id && !x.warm);
    let vol = 0; for (const st of sets) { const e = EXMAP[st.ex]; if (e) vol += setVolume(e, st, S); }
    h += '<h2>' + (s.partial ? '今天練了一部分' : '今天已完成') + '</h2><div class="hero-day"><div><div class="d">' + DAY_NAME[s.day] + '</div><div class="muted small">' + sets.length + ' 組・容量 ' + Math.round(vol).toLocaleString() + ' kg</div></div>' + (s.partial ? '<span class="tag warn">未練完</span>' : '<span class="tag ok">' + ic('check') + ' 完成</span>') + '</div>';
    h += '<div class="hr"></div><div class="small muted">下一次：<b style="color:var(--tx)">' + DAY_NAME[nextTrainDay(S)] + '</b>' + (ORDER[c.idx] === 'rest' ? '（明天休息）' : '') + '</div>';
  } else if (isRest) {
    h += '<h2>今天</h2><div class="hero-day"><div><div class="d">休息日</div><div class="muted small">肌肉在休息時長大。下一次是推日。</div></div></div>';
    h += '<div class="note brass" style="margin-top:12px">休息日早上量體重最準：起床、上完廁所、吃東西前。</div>';
    h += '<div class="row" style="margin-top:12px"><button class="btn grow" data-a="addWeight">' + ic('scale') + '記錄體重</button><button class="btn grow" data-a="skipRest">今天還是要練</button></div>';
  } else {
    const day = ORDER[c.idx];
    const plan = dayPlan(S, day);
    const gap = daysSinceLastSession(S, today);
    h += '<h2>今天練</h2><div class="hero-day"><div><div class="d">' + DAY_NAME[day] + '</div><div class="muted small">' + DAY_DESC[day] + '</div></div><span class="tag brass">第 ' + c.round + ' 輪・' + ph.name + '</span></div>';
    if (gap != null && gap >= 7) h += '<div class="note warn" style="margin-top:12px">已經 ' + gap + ' 天沒練。今天重量先打 9 折，避免受傷。</div>';
    h += '<div class="ex-mini" style="margin-top:12px">' + plan.map(id => '<span class="chip">' + esc(EXMAP[id].name) + '</span>').join('') + '</div>';
    h += '<div class="small muted" style="margin-top:10px">' + ph.rir + '。今天沒練的話，明天還是' + DAY_NAME[day] + '。</div>';
    h += '<div style="margin-top:14px"><button class="btn pri block" data-a="startSession" data-v="' + day + '">' + ic('play') + '開始' + DAY_NAME[day] + '</button></div>';
  }
  h += '</div>';
  // 熱量卡
  if (t) {
    const left = t.kcal - Math.round(tot.kcal);
    h += '<div class="card"><h2>今日飲食</h2><div class="row" style="gap:16px;align-items:center">' +
      ring(tot.kcal, t.kcal, '<div class="num" style="font-size:26px;font-weight:600;line-height:1">' + Math.round(tot.kcal) + '</div><div class="xs muted">/ ' + t.kcal + ' 大卡</div>') +
      '<div class="grow stack" style="gap:8px"><div><span class="small muted">' + (left > 0 ? '還差' : '已超過') + '</span> <span class="mid">' + Math.abs(left) + '</span> <span class="small muted">大卡</span></div>' +
      macroLine('蛋白', tot.p, t.p) + macroLine('碳水', tot.c, t.c) + macroLine('脂肪', tot.f, t.f) + '</div></div>';
    h += '<div class="row" style="margin-top:14px"><button class="btn grow" data-a="tab" data-v="food">' + ic('plus') + '記一餐</button>' + (S.supp.has ? '<button class="btn grow" data-a="addShake">' + ic('plus') + '高蛋白</button>' : '') + '</div></div>';
  }
  // 補充品與水
  h += suppCard(today);
  // 教練提醒
  const tips = coachTips(today);
  if (tips.length) h += '<div class="card"><h2>教練提醒</h2><div class="stack" style="gap:8px">' + tips.join('') + '</div></div>';
  // 體重
  h += '<div class="card"><div class="row between"><div><h2 style="margin:0 0 4px">體重</h2>' + (lw ? '<span class="mid">' + fmtNum(lw.kg) + '</span> <span class="muted small">kg・' + mdLabel(lw.date) + '</span>' : '<span class="muted small">還沒有紀錄</span>') + '</div><button class="btn sm" data-a="addWeight">' + ic('plus') + '記錄</button></div></div>';
  h += '</div>';
  return h;
}
function macroLine(n, v, g) { return '<div class="macro"><span class="muted">' + n + '</span>' + bar(v, g) + '<span class="num" style="font-size:15px">' + Math.round(v) + '<span class="dim">/' + g + 'g</span></span></div>'; }
function suppCard(date) {
  const trainDay = S.sessions.some(s => s.date === date) || (ORDER[S.settings.cycle.idx] !== 'rest');
  const goal = waterGoal(S, trainDay); const w = S.water[date] || 0;
  const on = !!S.creatine[date];
  let streak = 0; let d = date; if (!on) d = addDays(date, -1); while (S.creatine[d]) { streak++; d = addDays(d, -1); }
  return '<div class="card"><h2>喝水與肌酸</h2>' +
    '<div class="row between"><div><span class="mid">' + (w / 1000).toFixed(1) + '</span> <span class="muted small">/ ' + (goal / 1000).toFixed(1) + ' 公升</span></div><div class="row" style="gap:6px"><button class="btn sm" data-a="water" data-v="250">+250</button><button class="btn sm" data-a="water" data-v="500">+500</button><button class="btn sm ghost" data-a="water" data-v="-250" aria-label="減 250">−</button></div></div>' +
    '<div style="margin-top:8px">' + bar(w, goal, w >= goal ? 'ok' : '') + '</div>' +
    '<div class="hr"></div><div class="row between"><div><div style="font-weight:600">肌酸 ' + (S.profile.creatineStart ? '' : '<span class="tag">還沒開始</span>') + '</div><div class="small muted">' + (streak ? '連續 ' + streak + ' 天' : '每天 3–5g，休息日也要吃') + '</div></div><button class="btn sm ' + (on ? 'pri' : '') + '" data-a="creatine" data-v="' + date + '">' + (on ? ic('check') + '今天已吃' : '今天吃了') + '</button></div></div>';
}
function coachTips(today) {
  const tips = []; const t = currentTarget(S);
  const N = (cls, txt, act) => '<div class="note ' + cls + '">' + txt + (act || '') + '</div>';
  const ad = adaptive(S, today);
  if (ad.ok && ad.cur && Math.abs(ad.newKcal - ad.cur) >= 50) {
    tips.push(N('brass', '過去 4 週平均吃 ' + ad.avgIn + ' 大卡，體重每週 ' + (ad.weekKg >= 0 ? '+' : '') + ad.weekKg + 'kg。估計你實際每天消耗約 ' + ad.tdeeEst + ' 大卡，建議目標從 ' + ad.cur + ' 改成 <b>' + ad.newKcal + '</b> 大卡。', '<div style="margin-top:8px"><button class="btn sm pri" data-a="applyAdaptive">套用新目標</button></div>'));
  }
  const r = weekReview(S, today);
  if (t && r.loggedDays >= 3 && r.avgP != null && r.avgP < t.p * 0.8) tips.push(N('warn', '最近 7 天平均蛋白質 ' + r.avgP + 'g，只有目標的 ' + Math.round(r.avgP / t.p * 100) + '%。' + (S.supp.has ? '每天多喝一份高蛋白最快補上。' : '可以加雞蛋、雞胸肉、牛奶或高蛋白。')));
  if (t && r.loggedDays >= 3 && r.avgKcal != null && S.profile.goal === 'bulk' && r.avgKcal < t.kcal * 0.85) tips.push(N('warn', '最近平均 ' + r.avgKcal + ' 大卡，比目標少 ' + (t.kcal - r.avgKcal) + '。增肌吃不夠是最常見的卡關原因，牛奶、燕麥、花生醬最容易補熱量。'));
  const lw = latestWeight(S);
  if (!lw || diffDays(lw.date, today) >= 10) tips.push(N('', (lw ? '已經 ' + diffDays(lw.date, today) + ' 天沒量體重。' : '還沒有體重紀錄。') + '下一個休息日早上量一下。'));
  const pain = Object.keys(S.exu).filter(k => S.exu[k].pain && EXMAP[k]);
  if (pain.length) tips.push(N('warn', '標記會痛的動作：' + pain.map(k => esc(EXMAP[k].name)).join('、') + '。課表已自動避開，持續痛超過 1–2 週請找物理治療師。'));
  const ph = phaseOf(S.settings.cycle.round);
  if (ph.n === 4) tips.push(N('brass', '這輪是減量週：組數減半、重量打 9 折，讓身體恢復，下一輪會更強。'));
  if (!S.settings.lastBackup || diffDays(S.settings.lastBackup.slice(0, 10), today) >= 7) tips.push(N('', (S.settings.lastBackup ? '上次備份是 ' + diffDays(S.settings.lastBackup.slice(0, 10), today) + ' 天前。' : '還沒備份過。') + '資料只存在這支手機，建議每週備份一次。', '<div style="margin-top:8px"><button class="btn sm" data-a="backup">去備份</button></div>'));
  return tips.slice(0, 4);
}

/* ---------- 訓練 ---------- */
function vTrain() {
  const live = S.sessions.find(s => !s.end);
  if (live) return vSession(live);
  const today = todayStr(); const c = S.settings.cycle; const day = nextTrainDay(S); const ph = phaseOf(c.round);
  const gym = activeGym(S);
  let h = '<div class="top"><div><div class="sub">' + esc(gym ? gym.name : '') + '</div><h1>訓練</h1></div></div><div class="stack">';
  h += '<div class="card"><h2>下一次</h2><div class="hero-day"><div><div class="d">' + DAY_NAME[day] + '</div><div class="muted small">' + DAY_DESC[day] + '</div></div><span class="tag brass">第 ' + c.round + ' 輪・' + ph.name + '</span></div>';
  const psets = dayPlanSets(S, day);
  h += '<div class="list" style="margin-top:8px">' + dayPlan(S, day).map(id => {
    const e = EXMAP[id]; const sg = suggestion(S, e, ph, null); const rr = rxFor(S, e, ph, psets[id]);
    return '<button class="li" style="border-left:0;border-right:0;border-bottom:0;background:transparent;width:100%;text-align:left" data-a="exDetail" data-v="' + id + '">' + exThumb(e) + '<div class="grow"><div class="t">' + esc(e.name) + '</div><div class="small muted">' + rxLine(rr, e) + '</div><div class="xs dim">' + (sg.cal ? '第一次做，先試重' : '上次 ' + fmtSet(e, sg.top) + '・' + sg.when) + '</div></div>' + ic('chev', 'dim') + '</button>';
  }).join('') + '</div>';
  h += '<div style="margin-top:12px"><button class="btn pri block" data-a="startSession" data-v="' + day + '">' + ic('play') + '開始' + DAY_NAME[day] + '</button></div>';
  h += '<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-a="openTpl">' + ic('edit') + '修改課表</button></div>';
  h += '<div class="row" style="margin-top:10px;gap:8px"><span class="small muted">改練</span>' + ['push', 'pull', 'legs'].filter(d => d !== day).map(d => '<button class="chip" data-a="startSession" data-v="' + d + '">' + DAY_NAME[d] + '</button>').join('') + '</div></div>';
  // 最近訓練
  const done = S.sessions.filter(s => s.end).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)).slice(0, 12);
  h += '<div class="card"><h2>最近訓練</h2>' + (done.length ? '<div class="list">' + done.map(s => {
    const sets = S.sets.filter(x => x.sid === s.id && !x.warm); const prs = sets.filter(x => x.pr).length;
    return '<button class="li" style="border-left:0;border-right:0;border-bottom:0;background:transparent;width:100%;text-align:left" data-a="sessionDetail" data-v="' + s.id + '"><div class="grow"><div class="t">' + DAY_NAME[s.day] + ' <span class="muted small" style="font-weight:400">' + mdLabel(s.date) + '</span></div><div class="small muted">' + sets.length + ' 組' + (prs ? '・' + prs + ' 個 PR' : '') + (s.partial ? '・未練完' : '') + '</div></div>' + ic('chev', 'dim') + '</button>';
  }).join('') + '</div>' : '<div class="empty">完成第一次訓練後會出現在這裡</div>') + '</div>';
  h += '<div class="card"><div class="row between"><div><h2 style="margin:0">有氧</h2><div class="small muted">先保留，有做再記</div></div><button class="btn sm" data-a="addCardio">' + ic('plus') + '記錄</button></div>' +
    (S.cardio.length ? '<div class="list" style="margin-top:6px">' + S.cardio.slice(-5).reverse().map(x => '<div class="li"><div class="grow"><div class="t">' + esc(x.type) + '</div><div class="small muted">' + mdLabel(x.date) + '・' + x.min + ' 分鐘' + (x.speed ? '・速度 ' + x.speed : '') + (x.incline ? '・坡度 ' + x.incline : '') + '</div></div><button class="icon-btn" data-a="delCardio" data-v="' + x.id + '" aria-label="刪除">' + ic('trash') + '</button></div>').join('') + '</div>' : '') + '</div>';
  return h + '</div>';
}
function vSession(s) {
  const ph = phaseOf(s.round); const gym = S.gyms.find(g => g.id === s.gymId);
  const mins = Math.max(0, Math.round((Date.now() - s.startTs) / 60000));
  s.done = s.done || {};
  const nDone = s.plan.filter(id => s.done[id]).length;
  let h = '<div class="top"><div><div class="sub">' + esc(gym ? gym.name : '') + '・' + ph.name + '・' + mins + ' 分鐘</div><h1>' + DAY_NAME[s.day] + '</h1></div><button class="btn sm" data-a="finishSession">結束</button></div>';
  h += '<div class="row" style="gap:10px;margin-bottom:12px"><div class="grow">' + bar(nDone, s.plan.length) + '</div><span class="small muted num" style="font-size:15px">' + nDone + '/' + s.plan.length + ' 個動作</span></div>';
  h += '<div class="small muted" style="margin-bottom:12px">' + ph.rir + '。每組做完按 ✓，整個動作做完按「完成動作」。</div>';
  h += '<div class="stack" style="gap:10px">';
  for (const id of s.plan) h += exCard(s, EXMAP[id], ph);
  h += '<button class="btn block" data-a="addExToSession">' + ic('plus') + '加入其他動作</button>';
  h += '<button class="btn pri block" data-a="finishSession">' + ic('check') + '完成今天的訓練</button>';
  h += '<button class="btn ghost block danger" data-a="cancelSession">放棄這次紀錄</button>';
  return h + '</div>';
}
function rowPrefill(s, e, n, sets) {
  const key = s.id + ':' + e.id + ':' + n;
  if (UI.rows[key]) return UI.rows[key];
  const gym = activeGym(S);
  const hist = exHistory(S, e.id, { excludeSid: s.id, gymId: gym ? gym.id : null });
  const prev = sets[sets.length - 1];
  if (prev && prev.cal && prev.rir && !prev.warm) return { w: calNext(prev.w, prev.rir), reps: prev.reps };
  if (hist.length) { const ls = hist[0].sets; const m = ls.find(x => x.n === n) || ls[ls.length - 1]; if (m) return { w: m.w, reps: m.reps }; }
  if (prev) return { w: prev.w, reps: prev.reps };
  return { w: '', reps: e.load === 'time' ? 30 : 10 };
}
function prevCell(s, e, n) {
  const gym = activeGym(S);
  const hist = exHistory(S, e.id, { excludeSid: s.id, gymId: gym ? gym.id : null });
  if (!hist.length) return '–';
  const m = hist[0].sets.find(x => x.n === n);
  return m ? fmtSet(e, m) : '–';
}
function exCard(s, e, ph) {
  if (!e) return '';
  s.done = s.done || {};
  const sets = S.sets.filter(x => x.sid === s.id && x.ex === e.id).sort((a, b) => a.n - b.n);
  const work = sets.filter(x => !x.warm);
  const rx = sessionRx(S, s, e);
  const target = rx.sets + ((s.extra || {})[e.id] || 0); const open = UI.openEx === e.id; const done = !!s.done[e.id];
  const sg = suggestion(S, e, ph, s.id);
  const sub = done ? work.map(x => fmtSet(e, x)).join('、') || '略過' : (sg.cal ? '試重模式' : '上次 ' + fmtSet(e, sg.top)) + '・' + rx.lo + '–' + rx.hi + (e.load === 'time' ? ' 秒' : ' 下');
  let h = '<div class="exc' + (open ? ' open' : '') + (done ? ' done' : '') + '" id="ex-' + e.id + '"><button class="exc-h" data-a="toggleEx" data-v="' + e.id + '" aria-expanded="' + open + '">' + exThumb(e) +
    '<div class="grow"><div class="t" style="font-weight:600">' + esc(e.name) + '</div><div class="small muted ell">' + esc(sub) + '</div></div>' +
    (done ? '<span class="tag ok">' + ic('check') + '完成</span>' : '<span class="tag ' + (work.length >= target ? 'ok' : work.length ? 'brass' : '') + '">' + work.length + '/' + target + '</span>') + '</button>';
  if (!open) return h + '</div>';
  const u = S.exu[e.id] || {}; const note = u.notes && u.notes[s.gymId];
  h += '<div class="exc-b">';
  if (u.pain) h += '<div class="note warn small">' + ic('alert') + ' 你標記過這個動作會痛' + (u.pain.note ? '：' + esc(u.pain.note) : '') + '</div>';
  h += '<div class="rxbar"><span><b>' + target + '</b> 組</span><span><b>' + rx.lo + '–' + rx.hi + '</b> ' + (e.load === 'time' ? '秒' : '下') + '</span><span>留 <b>' + esc(rx.rir) + '</b> 下</span><span>休息 <b>' + fmtRest(rx.rest) + '</b></span></div>';
  h += '<div class="xs" style="color:' + (rx.fail === 'no' ? 'var(--mu)' : 'var(--red-soft)') + '">' + (rx.fail === 'no' ? '' : ic('flame') + ' ') + FAIL_TEXT[rx.fail] + '</div>';
  if (e.warn && e.warn.length) h += '<details class="warnbox"' + (UI.warnOpen ? ' open' : '') + '><summary>' + ic('alert') + '<span class="ell">' + esc(e.warn[0]) + '</span></summary><ul>' + e.warn.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></details>';
  h += '<div class="note brass small">' + sg.text + (sg.stall ? '<div style="margin-top:4px;color:var(--warn)">連續 3 次沒進步：換次數範圍、換動作或安排減量。</div>' : '') + '</div>';
  h += '<button class="mline" data-a="editMachineNote" data-v="' + e.id + '">' + ic('edit') + '<span class="ell ' + (note ? '' : 'muted') + '">' + (note ? esc(note) : '記機台設定（座椅、椅背、握把）') + '</span></button>';
  const isTime = e.load === 'time';
  h += '<div class="sets" role="table"><div class="sh">組</div><div class="sh">上次</div><div class="sh">' + (isTime ? '' : (e.load === 'stack' ? 'kg' : LOAD_LABEL[e.load])) + '</div><div class="sh">' + (isTime ? '秒' : '次') + '</div><div class="sh"></div>';
  for (const st of sets) {
    h += '<button class="srow done" data-a="editSet" data-v="' + st.id + '" aria-label="修改這組"><span class="c n">' + (st.warm ? '熱' : st.n) + '</span><span class="c prev">' + prevCell(s, e, st.n) + '</span><span class="c v">' + (isTime ? '' : fmtNum(e.load === 'barbell' ? st.w : st.tw)) + '</span><span class="c v">' + st.reps + '</span><span class="c ck on">' + (st.pr ? '<b class="pr">PR</b>' : ic('check')) + '</span></button>';
  }
  const last = sets[sets.length - 1];
  if (last && last.cal && !last.warm) {
    h += '<div class="rirbox"><div class="xs muted">第 ' + last.n + ' 組做完，還能再做幾下？（試重用）</div><div class="grid4" style="margin-top:6px">' + RIR_OPTS.map(([v, l]) => '<button class="chip' + (last.rir === v ? ' on' : '') + '" style="justify-content:center" data-a="rowRir" data-v="' + last.id + ':' + v + '">' + l + '</button>').join('') + '</div>' + (last.rir ? '<div class="small" style="margin-top:6px;color:var(--ok)">' + calText(last.w, last.rir) + '</div>' : '') + '</div>';
  }
  const nextN = sets.length ? Math.max(...sets.map(x => x.n)) + 1 : 1;
  const pending = done ? 0 : Math.max(target - work.length, 0);
  for (let i = 0; i < pending; i++) {
    const n = nextN + i; const pf = rowPrefill(s, e, n, sets); const active = i === 0;
    if (active) {
      h += '<div class="srow act"><span class="c n">' + n + '</span><span class="c prev">' + prevCell(s, e, n) + '</span>' +
        (isTime ? '<span></span>' : '<input class="cell" id="rw-' + e.id + '" data-rk="' + s.id + ':' + e.id + ':' + n + '" data-f="w" inputmode="decimal" value="' + esc(pf.w) + '" placeholder="kg" aria-label="重量">') +
        '<input class="cell" id="rr-' + e.id + '" data-rk="' + s.id + ':' + e.id + ':' + n + '" data-f="reps" inputmode="numeric" value="' + esc(pf.reps) + '" aria-label="' + (isTime ? '秒數' : '次數') + '">' +
        '<button class="c ck" data-a="saveRow" data-v="' + e.id + '" aria-label="完成第 ' + n + ' 組">' + ic('check') + '</button></div>';
    } else {
      h += '<div class="srow ghost"><span class="c n">' + n + '</span><span class="c prev">' + prevCell(s, e, n) + '</span><span class="c v">' + (isTime ? '' : esc(pf.w)) + '</span><span class="c v">' + esc(pf.reps) + '</span><span class="c ck"></span></div>';
    }
  }
  h += '</div>';
  if (!done && pending === 0) h += '<div class="note ok small">已完成 ' + target + ' 組。還要多做就按「加一組」，做完按「完成動作」。</div>';
  h += '<div id="warn-' + e.id + '"></div>';
  if (e.load === 'barbell') h += '<div class="xs muted">輸入單邊槓片，總重自動加 ' + S.settings.barKg + 'kg 槓。</div>';
  else if (e.load !== 'stack') h += '<div class="xs muted">' + esc(LOAD_HELP[e.load]) + '</div>';
  h += '<div class="row" style="gap:8px"><button class="btn sm" data-a="addRow" data-v="' + e.id + '">' + ic('plus') + '加一組</button><button class="btn sm grow ' + (done ? '' : 'pri') + '" data-a="doneEx" data-v="' + e.id + '">' + (done ? '收起' : ic('check') + '完成動作') + '</button><button class="icon-btn" data-a="exMenu" data-v="' + e.id + '" aria-label="更多">' + IC_MORE + '</button></div>';
  return h + '</div></div>';
}
const IC_MORE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>';

/* ---------- 飲食 ---------- */
const MEALS = [['b', '早餐'], ['l', '午餐'], ['d', '晚餐'], ['s', '點心']];
function vFood() {
  const date = UI.foodDate || todayStr(); const t = currentTarget(S); const tot = dayTotals(S, date);
  const isToday = date === todayStr();
  let h = '<div class="top"><div><div class="sub">飲食紀錄</div><h1>飲食</h1></div><div class="row" style="gap:6px"><button class="icon-btn" data-a="foodDay" data-v="-1" aria-label="前一天">' + ic('left') + '</button><button class="icon-btn" data-a="foodDay" data-v="1" aria-label="後一天"' + (isToday ? ' disabled style="opacity:.3"' : '') + '>' + ic('right') + '</button></div></div><div class="stack">';
  h += '<div class="card"><div class="row between"><h2 style="margin:0">' + (isToday ? '今天 ' : '') + mdLabel(date) + '</h2>' + (isToday ? '' : '<button class="chip" data-a="foodToday">回到今天</button>') + '</div>';
  if (t) h += '<div class="row" style="gap:16px;margin-top:10px">' + ring(tot.kcal, t.kcal, '<div class="num" style="font-size:26px;font-weight:600;line-height:1">' + Math.round(tot.kcal) + '</div><div class="xs muted">/ ' + t.kcal + '</div>') + '<div class="grow stack" style="gap:8px">' + macroLine('蛋白', tot.p, t.p) + macroLine('碳水', tot.c, t.c) + macroLine('脂肪', tot.f, t.f) + '</div></div>';
  h += '<div class="small muted" style="margin-top:10px">數字是約略值。沒有食物秤沒關係，前後估法一致，app 會用體重趨勢自動修正。</div></div>';
  for (const [m, name] of MEALS) {
    const items = S.foodlog.filter(x => x.date === date && x.meal === m);
    const mt = items.reduce((a, x) => a + x.kcal, 0), mp = items.reduce((a, x) => a + x.p, 0);
    h += '<div class="card"><div class="row between"><div><h3>' + name + '</h3><div class="small muted">' + Math.round(mt) + ' 大卡・蛋白 ' + Math.round(mp) + 'g</div></div><button class="btn sm" data-a="addFood" data-v="' + m + '">' + ic('plus') + '新增</button></div>';
    if (items.length) h += '<div class="list" style="margin-top:6px">' + items.map(x => '<button class="li" style="border-left:0;border-right:0;border-bottom:0;background:transparent;width:100%;text-align:left" data-a="editLog" data-v="' + x.id + '"><div class="grow"><div class="t">' + esc(x.name) + '</div><div class="small muted">' + fmtNum(x.qty) + ' × ' + esc(x.unit) + '</div></div><div style="text-align:right"><div class="num" style="font-size:17px">' + Math.round(x.kcal) + '</div><div class="xs muted">蛋白 ' + fmtNum(x.p) + 'g</div></div></button>').join('') + '</div>';
    h += '</div>';
  }
  h += suppCard(date);
  return h + '</div>';
}
function logFood(date, meal, f, qty) {
  qty = +qty || 1;
  S.foodlog.push({ id: uid(), date, meal, name: f.name, unit: f.unit, qty, kcal: r1(f.kcal * qty), p: r1(f.p * qty), c: r1(f.c * qty), f: r1(f.f * qty), foodId: f.id || null, t: Date.now() });
  save();
}
function shakeFood() {
  const s = S.supp; const milk = +s.milkMl || 0;
  return { id: 'shake', name: s.name + ' 1 匙' + (milk ? '＋牛奶 ' + milk + 'ml' : ''), unit: '份', kcal: s.kcal + milk / 100 * s.milkKcal, p: s.p + milk / 100 * s.milkP, c: s.c + milk / 100 * s.milkC, f: s.f + milk / 100 * s.milkF };
}
function guessMeal() { const h = new Date().getHours(); return h < 10 ? 'b' : h < 15 ? 'l' : h < 21 ? 'd' : 's'; }

/* ---------- 進度 ---------- */
function vProgress() {
  const segs = [['overview', '總覽'], ['body', '體重與身體'], ['lifts', '動作'], ['photos', '照片']];
  let h = '<div class="top"><div><div class="sub">追蹤進步</div><h1>進度</h1></div></div>';
  h += '<div class="seg" style="margin-bottom:12px" role="tablist">' + segs.map(([k, l]) => '<button role="tab" class="' + (UI.progSeg === k ? 'on' : '') + '" data-a="progSeg" data-v="' + k + '">' + l + '</button>').join('') + '</div><div class="stack">';
  const today = todayStr();
  if (UI.progSeg === 'overview') {
    const r = weekReview(S, today);
    h += '<div class="card"><h2>近 7 天回顧</h2><div class="kpi">' +
      kpi('訓練', r.sessions + ' 次', '容量 ' + r.vol.toLocaleString() + ' kg') +
      kpi('破紀錄', r.prs + ' 個', 'PR') +
      kpi('平均熱量', r.avgKcal != null ? r.avgKcal : '–', r.tKcal ? '目標 ' + r.tKcal + '・記錄 ' + r.loggedDays + ' 天' : '') +
      kpi('平均蛋白', r.avgP != null ? r.avgP + 'g' : '–', r.tP ? '目標 ' + r.tP + 'g' : '') +
      kpi('體重變化', r.wChange != null ? (r.wChange > 0 ? '+' : '') + r.wChange + ' kg' : '–', r.wFrom ? '從 ' + mdLabel(r.wFrom) : '需要 2 筆以上') +
      kpi('喝水 / 肌酸', r.avgWater != null ? (r.avgWater / 1000).toFixed(1) + ' L' : '–', '肌酸 ' + r.creatineDays + '/7 天') + '</div></div>';
    const heat = muscleWeek(S, today);
    const hk = Object.keys(MUSCLE_NAME).filter(k => heat[k]).sort((a, b) => heat[b] - heat[a]);
    h += '<div class="card"><h2>本週練到哪裡（近 7 天組數）</h2>' + bodyMap([], [], heat) +
      '<div class="legend" style="margin-top:10px"><span><i style="background:#3a3f43"></i>0</span><span><i style="background:#6b3b33"></i>1–4</span><span><i style="background:#a8473a"></i>5–9</span><span><i style="background:#e5533d"></i>10–20</span><span><i style="background:#ff8a5c"></i>20+</span></div>' +
      (hk.length ? '<div class="chips" style="margin-top:12px">' + hk.map(k => '<span class="chip">' + MUSCLE_NAME[k] + ' ' + fmtNum(heat[k]) + '</span>').join('') + '</div>' : '<div class="empty">這週還沒有訓練紀錄</div>') +
      '<div class="small muted" style="margin-top:8px">主要肌群算 1 組、輔助算 0.5 組。增肌建議每個部位每週 10–20 組。</div></div>';
    const days = []; for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
    const t = currentTarget(S);
    h += '<div class="card"><h2>近 14 天熱量</h2>' + barChart(days.map(d => ({ l: d.slice(5).replace('-', '/'), v: Math.round(dayTotals(S, d).kcal) })), t ? t.kcal : null, { label: '每日熱量' }) + '<div class="small muted">虛線是目標，綠色代表達到 90% 以上。</div></div>';
    const ad = adaptive(S, today);
    h += '<div class="card"><h2>消耗估算（TDEE）</h2>';
    if (t) h += '<div class="kpi">' + kpi('目前目標', t.kcal + ' 大卡', GOAL_NAME[S.profile.goal]) + kpi('估計消耗', (ad.ok ? ad.tdeeEst : t.tdee) + ' 大卡', ad.ok ? '依實際體重變化' : '依公式') + '</div>';
    h += '<div class="small muted" style="margin-top:10px">' + (ad.ok ? '過去 4 週平均吃 ' + ad.avgIn + ' 大卡，體重每週 ' + (ad.weekKg >= 0 ? '+' : '') + ad.weekKg + ' kg（' + ad.pct + '%）。' + (Math.abs(ad.newKcal - ad.cur) >= 50 ? '建議目標改為 ' + ad.newKcal + ' 大卡。' : '目前目標剛好，不用調整。') : esc(ad.msg || '')) + '</div>';
    if (ad.ok && Math.abs(ad.newKcal - ad.cur) >= 50) h += '<button class="btn pri block" style="margin-top:10px" data-a="applyAdaptive">套用 ' + ad.newKcal + ' 大卡</button>';
    if (S.targets.length > 1) h += '<div class="hr"></div><div class="small muted">目標變更紀錄</div><div class="list">' + S.targets.slice().reverse().slice(0, 6).map(x => '<div class="li"><div class="grow small">' + mdLabel(x.date) + '・' + esc(x.reason) + '</div><span class="num">' + x.kcal + '</span></div>').join('') + '</div>';
    h += '</div>';
    h += '<div class="card"><h2>問 AI 教練</h2><div class="small muted" style="margin-bottom:10px">把你最近 2 週的紀錄整理成一段文字，貼到 Claude 或其他 AI，最後打上你的問題就能得到有根據的建議。</div><button class="btn block" data-a="aiCopy">' + ic('copy') + '產生並複製摘要</button></div>';
  } else if (UI.progSeg === 'body') {
    const ws = S.weights.slice().sort((a, b) => a.date.localeCompare(b.date));
    const base = ws.length ? ws[0].date : todayStr();
    h += '<div class="card"><div class="row between"><h2 style="margin:0">體重</h2><button class="btn sm" data-a="addWeight">' + ic('plus') + '記錄</button></div><div style="margin-top:10px">' +
      lineChart(ws.map(w => ({ x: diffDays(base, w.date), y: w.kg })), { label: '體重趨勢', xlabel: x => addDays(base, x).slice(5).replace('-', '/') }) + '</div>' +
      '<div class="small muted">建議休息日早上量。' + (S.profile.goal === 'bulk' ? '增肌目標：每週 +' + gainText(bodyKg(S), bmi(S.profile, bodyKg(S))) + ' kg。' : '') + '</div>' +
      (ws.length ? '<div class="list" style="margin-top:8px">' + ws.slice().reverse().slice(0, 12).map(w => '<div class="li"><div class="grow">' + mdLabel(w.date) + '</div><span class="num" style="font-size:18px">' + fmtNum(w.kg) + ' kg</span><button class="icon-btn" data-a="delWeight" data-v="' + w.date + '" aria-label="刪除">' + ic('trash') + '</button></div>').join('') + '</div>' : '') + '</div>';
    const ms = S.measures.slice().sort((a, b) => b.date.localeCompare(a.date));
    h += '<div class="card"><div class="row between"><h2 style="margin:0">身體圍度</h2><button class="btn sm" data-a="addMeasure">' + ic('plus') + '記錄</button></div>' +
      '<div class="small muted" style="margin-top:8px">有軟尺再量就好，每 2–4 週一次。手臂、胸圍增加而腰圍穩定，代表長的是肌肉。</div>' +
      (ms.length ? '<div class="list" style="margin-top:6px">' + ms.map(m => '<div class="li"><div class="grow"><div class="t">' + mdLabel(m.date) + '</div><div class="small muted">' + [['waist', '腰'], ['arm', '手臂'], ['chest', '胸'], ['thigh', '大腿']].filter(([k]) => m[k]).map(([k, l]) => l + ' ' + m[k] + 'cm').join('・') + '</div></div><button class="icon-btn" data-a="delMeasure" data-v="' + m.id + '" aria-label="刪除">' + ic('trash') + '</button></div>').join('') + '</div>' : '') + '</div>';
  } else if (UI.progSeg === 'lifts') {
    const ids = [...new Set(S.sets.filter(x => !x.warm).map(x => x.ex))].filter(id => EXMAP[id]);
    if (!ids.length) h += '<div class="card"><div class="empty">完成訓練後，每個動作的進步曲線會出現在這裡</div></div>';
    else h += '<div class="stack" style="gap:8px">' + ids.map(id => {
      const e = EXMAP[id]; const hs = exHistory(S, id);
      const top = topSet(e, hs[0].work); const be = bestE1rm(e, S.sets.filter(x => x.ex === id));
      return '<button class="lib-item" data-a="exDetail" data-v="' + id + '">' + exThumb(e) + '<div class="grow"><div style="font-weight:600">' + esc(e.name) + '</div><div class="small muted">最近 ' + fmtSet(e, top) + '・' + hs.length + ' 次' + (be ? '・估計 1RM ' + be + 'kg' : '') + '</div></div>' + ic('chev', 'dim') + '</button>';
    }).join('') + '</div>';
  } else {
    h += '<div class="card"><h2>怎麼拍</h2><ol class="cues small"><li>每 4 週拍一次，固定早上起床、吃東西前</li><li>同一個地點、同樣燈光，手機放在胸口高度，距離約 2 公尺（請人拍或用計時）</li><li>只穿短褲，放鬆站好，不要刻意用力</li><li>每次拍 3 張：<b>正面</b>、<b>側面</b>（右側對鏡頭）、<b>背面</b></li><li>想看更明顯的變化，可加拍正面雙手二頭、背面雙手二頭</li></ol>' +
      '<div class="grid3" style="margin-top:12px">' + ['正面', '側面', '背面'].map(p => '<label class="btn sm" style="position:relative">' + ic('camera') + p + '<input type="file" accept="image/*" class="hidden-file" data-in="photo" data-pose="' + p + '"></label>').join('') + '</div>' +
      '<div class="row wrap" style="margin-top:8px;gap:8px">' + ['正面二頭', '背面二頭'].map(p => '<label class="btn sm ghost" style="position:relative">' + ic('camera') + p + '<input type="file" accept="image/*" class="hidden-file" data-in="photo" data-pose="' + p + '"></label>').join('') + '</div></div>';
    const by = {}; for (const p of S.photos) (by[p.date] = by[p.date] || []).push(p);
    const ds = Object.keys(by).sort().reverse();
    h += ds.length ? ds.map(d => '<div class="card"><h2>' + mdLabel(d) + '</h2><div class="photo-grid">' + by[d].map(p => '<button data-a="viewPhoto" data-v="' + p.id + '" aria-label="' + p.pose + '"><img data-imgkey="' + p.key + '" alt="' + p.pose + '"></button>').join('') + '</div></div>').join('') + (ds.length >= 2 ? '<button class="btn block" data-a="comparePhotos">比較兩個日期</button>' : '') : '<div class="card"><div class="empty">還沒有照片。照片只存在這支手機，不會上傳。</div></div>';
  }
  return h + '</div>';
}
function kpi(k, v, sub) { return '<div><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="xs dim">' + sub + '</div>' : '') + '</div>'; }

/* ---------- 動作庫 ---------- */
function vLibrary() {
  const gym = activeGym(S);
  const q = UI.libQ.trim().toLowerCase();
  const list = Object.values(EXMAP).filter(e => (UI.libDay === 'all' || e.day === UI.libDay) && (!UI.libMine || exAvailable(e, gym)) && (!q || (e.name + e.mach).toLowerCase().includes(q)));
  let h = '<div class="top"><div><div class="sub">' + Object.keys(EXMAP).length + ' 個動作</div><h1>動作庫</h1></div><button class="btn sm" data-a="customEx">' + ic('plus') + '自訂</button></div>';
  h += '<div class="stack"><input class="inp" id="libq" placeholder="搜尋動作或機台" value="' + esc(UI.libQ) + '" aria-label="搜尋">';
  h += '<div class="chips scroll">' + [['all', '全部'], ['push', '推'], ['pull', '拉'], ['legs', '腿']].map(([k, l]) => '<button class="chip' + (UI.libDay === k ? ' on' : '') + '" data-a="libDay" data-v="' + k + '">' + l + '</button>').join('') +
    '<button class="chip' + (UI.libMine ? ' on' : '') + '" data-a="libMine">' + (UI.libMine ? ic('check') : '') + '只看我健身房有的</button></div>';
  h += list.length ? '<div class="stack" style="gap:8px">' + list.map(e => '<button class="lib-item" data-a="exDetail" data-v="' + e.id + '">' + exThumb(e) + '<div class="grow"><div style="font-weight:600">' + esc(e.name) + (S.exu[e.id] && S.exu[e.id].pain ? ' <span class="tag warn">會痛</span>' : '') + '</div><div class="small muted">' + esc(e.mach) + '・' + e.pri.map(m => MUSCLE_NAME[m] || m).join('、') + '</div></div>' + ic('chev', 'dim') + '</button>').join('') + '</div>' : '<div class="empty">沒有符合的動作' + (UI.libMine ? '。關掉「只看我健身房有的」看全部。' : '') + '</div>';
  return h + '</div>';
}

/* ===== 面板內容 ===== */
function sheetExDetail(id) {
  return () => {
    const e = EXMAP[id]; if (!e) return { title: '', body: '' };
    const u = S.exu[id] || {}; const gym = activeGym(S);
    const hist = exHistory(S, id);
    let b = '<div class="stack">';
    b += '<div class="row wrap" style="gap:6px"><span class="tag brass">' + DAY_NAME[e.day] + '</span><span class="tag">' + esc(e.mach) + '</span><span class="tag">' + (e.t === 'c' ? '複合動作' : '孤立動作') + '</span>' + (gym && !exAvailable(e, gym) ? '<span class="tag warn">目前健身房沒有</span>' : '') + '</div>';
    b += exFigs(e);
    { const r = rxFor(S, e, phaseOf(S.settings.cycle.round), 0); const P = phaseOf(S.settings.cycle.round);
      b += '<div class="card"><div class="row between"><h2 style="margin:0">建議做法</h2><button class="btn sm" data-a="exRx" data-v="' + id + '">調整</button></div><div class="rxbar" style="margin-top:10px"><span><b>' + r.sets + '</b> 組</span><span><b>' + r.lo + '–' + r.hi + '</b> ' + (e.load === 'time' ? '秒' : '下') + '</span><span>留 <b>' + esc(r.rir) + '</b> 下</span><span>休息 <b>' + fmtRest(r.rest) + '</b></span></div><div class="small" style="margin-top:8px;color:' + (r.fail === 'no' ? 'var(--mu)' : 'var(--red-soft)') + '">' + FAIL_TEXT[r.fail] + '</div><div class="xs dim" style="margin-top:4px">目前' + P.name + '（' + P.short + '），組數以課表為準</div></div>';
      if (e.warn && e.warn.length) b += '<div class="card warncard"><h2>' + ic('alert') + ' 注意（保護關節）</h2><ul class="warnlist">' + e.warn.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>'; }
    b += '<div class="card"><h2>發力位置</h2>' + bodyMap(e.pri, e.sec) + '<div class="legend" style="margin-top:10px"><span><i style="background:#e5533d"></i>主要：' + e.pri.map(m => MUSCLE_NAME[m] || m).join('、') + '</span>' + (e.sec.length ? '<span><i style="background:#f0a090"></i>輔助：' + e.sec.map(m => MUSCLE_NAME[m] || m).join('、') + '</span>' : '') + '</div></div>';
    b += '<div class="card"><h2>動作要領</h2><ol class="cues">' + e.cues.map(c => '<li>' + esc(c) + '</li>').join('') + '</ol><div class="note small" style="margin-top:12px"><b>重量怎麼記：</b>' + esc(LOAD_HELP[e.load]) + '</div></div>';
    const note = gym && u.notes ? u.notes[gym.id] : '';
    b += '<div class="card"><h2>機台設定' + (gym ? '（' + esc(gym.name) + '）' : '') + '</h2><textarea class="inp" id="mnote" placeholder="例如：座椅第 4 格、椅背第 3 格（約 30 度）、握把最外側">' + esc(note || '') + '</textarea><button class="btn sm" style="margin-top:8px" data-a="saveMachineNote" data-v="' + id + '">儲存設定</button></div>';
    const vids = u.videos || [];
    b += '<div class="card"><h2>我的教學影片</h2>' + (vids.length ? '<div class="list">' + vids.map((v, i) => '<div class="li"><a class="btn sm" href="' + esc(v.url) + '" target="_blank" rel="noopener">' + ic('play') + '播放</a><div class="grow small" style="word-break:break-all">' + (v.note ? '<b>' + esc(v.note) + '</b><br>' : '') + '<span class="dim">' + esc(v.url.replace(/^https?:\/\//, '').slice(0, 48)) + '</span></div><button class="icon-btn" data-a="delVideo" data-v="' + id + ':' + i + '" aria-label="刪除影片">' + ic('trash') + '</button></div>').join('') + '</div>' : '<div class="small muted">在抖音、TikTok、YouTube 或 IG 按「分享 → 複製連結」，貼到這裡。</div>') +
      '<div class="stack" style="gap:8px;margin-top:10px"><input class="inp" id="vurl" placeholder="貼上影片連結" inputmode="url"><input class="inp" id="vnote" placeholder="備註（選填），例如：看 0:45 握法"><button class="btn sm" data-a="addVideo" data-v="' + id + '">' + ic('link') + '加入影片</button></div></div>';
    b += '<div class="card"><h2>我拍的照片</h2><div class="small muted" style="margin-bottom:8px">拍你健身房這台機器，照片只存在這支手機。</div><div class="row wrap"><label class="btn sm" style="position:relative">' + ic('camera') + (u.photo ? '換一張' : '加入照片') + '<input type="file" accept="image/*" class="hidden-file" data-in="exPhoto" data-ex="' + id + '"></label>' + (u.photo ? '<button class="btn sm danger" data-a="delExPhoto" data-v="' + id + '">移除照片</button>' : '') + '</div></div>';
    if (hist.length) {
      const showChart = hist.length >= 2;
      const ptsTop = hist.slice().reverse().map((h, i) => ({ x: i, y: topSet(e, h.work).tw, d: h.date }));
      const pts1 = e.load === 'stack' || e.load === 'plates' || e.load === 'barbell' || e.load === 'db' || e.load === 'single' ? hist.slice().reverse().map((h, i) => ({ x: i, y: bestE1rm(e, h.work) })).filter(p => p.y) : [];
      b += '<div class="card"><h2>我的紀錄</h2>' + (e.load !== 'time' && showChart ? lineChart(ptsTop, { label: '最重組趨勢', pts2: pts1, xlabel: x => (ptsTop[x] || {}).d ? ptsTop[x].d.slice(5).replace('-', '/') : '' }) + '<div class="legend" style="justify-content:flex-start;margin:6px 0 10px"><span><i style="background:#d4a24c"></i>最重組</span>' + (pts1.length ? '<span><i style="background:#7fa8d6"></i>估計 1RM</span>' : '') + '</div>' : '');
      const pb = prBoard(S, e).filter(x => x.reps <= 15);
      if (pb.length && e.load !== 'assist') b += '<div class="small muted" style="margin-bottom:6px">各次數最重紀錄</div><div class="chips">' + pb.map(x => '<span class="chip">' + x.reps + ' 下 <b style="color:var(--tx)">' + fmtNum(x.tw) + '</b></span>').join('') + '</div>';
      b += '<div class="list" style="margin-top:10px">' + hist.slice(0, 8).map(h => '<div class="li"><div style="width:72px" class="small muted">' + h.date.slice(5).replace('-', '/') + '</div><div class="grow small">' + h.work.map(st => fmtSet(e, st)).join('、') + '</div></div>').join('') + '</div></div>';
    }
    b += '<div class="card"><h2>會痛嗎？</h2>' + (u.pain ? '<div class="note warn" style="margin-bottom:10px">已標記：' + esc(u.pain.note || '會痛') + '（' + mdLabel(u.pain.date) + '）。課表會自動換成替代動作。</div><button class="btn sm" data-a="clearPain" data-v="' + id + '">已經不痛了</button>' :
      '<div class="small muted" style="margin-bottom:8px">關節刺痛、做完隔天特定位置痛，通常是姿勢或重量的問題。肌肉痠和燒灼感是正常的。</div><input class="inp" id="painnote" placeholder="哪裡痛？例如：右肩前側"><button class="btn sm" style="margin-top:8px" data-a="setPain" data-v="' + id + '">' + ic('alert') + '標記會痛</button>') +
      '<div class="small muted" style="margin-top:10px"><b style="color:var(--tx)">可以問誰：</b>先錄下自己做的動作跟教學影片比對；健身房櫃台或教練（澳洲很多健身房有免費入門指導）；持續痛超過 1–2 週，或關節刺痛、麻木，請找物理治療師（Physiotherapist）。</div></div>';
    const alts = alternatives(S, id);
    if (alts.length) b += '<div class="card"><h2>替代動作</h2><div class="stack" style="gap:8px">' + alts.slice(0, 6).map(a => '<button class="lib-item" data-a="exDetail" data-v="' + a.id + '">' + exThumb(a) + '<div class="grow"><div style="font-weight:600">' + esc(a.name) + '</div><div class="small muted">' + esc(a.mach) + '</div></div></button>').join('') + '</div></div>';
    if (e.custom) b += '<button class="btn danger block" data-a="delCustomEx" data-v="' + id + '">刪除這個自訂動作</button>';
    b += '</div>';
    return { title: esc(e.name), body: b };
  };
}

/* ---------- 新手引導 ---------- */
function obDefaults() { return { step: 0, sex: 'm', birthYear: 2002, height: 174, kg: 49, goal: 'bulk', act: 1.55, gymName: '我的健身房', equip: DATA.equip.map(q => q.id).filter(id => !['lateral_raise_machine', 'assisted_pullup', 'hip_thrust_machine', 'dip_machine'].includes(id)), startDay: 'push', has: false, creatineStarted: false, outdoor: true }; }
const OB_STEPS = 8;
function sheetOnboard() {
  const o = UI.ob; const st = o.step;
  const dots = '<div class="ob-step" style="margin-bottom:18px">' + Array.from({ length: OB_STEPS }, (_, i) => '<i class="' + (i <= st ? 'on' : '') + '"></i>').join('') + '</div>';
  let title = '', b = '', foot = '';
  const nav = (next, label) => (st > 0 ? '<button class="btn" data-a="obPrev">上一步</button>' : '') + '<button class="btn pri" data-a="obNext"' + (next === false ? ' disabled' : '') + '>' + (label || '下一步') + '</button>';
  if (st === 0) {
    title = '歡迎使用 Training';
    b = '<div class="stack"><div class="mid" style="font-size:30px">記住每一組，<br>每次都比上次強一點。</div><div class="muted">先花 3 分鐘設定，之後每次訓練、每一餐都只要幾秒鐘。</div>' +
      '<div class="note"><b>資料存在哪裡？</b><br>紀錄存在這支手機。設定好之後可以在「設定 → 雲端同步」連接你的 Google 試算表自動備份。</div>' +
      (IS_PAGES ? '<button class="btn block" data-a="obCloud">' + ic('cloud') + '已經有雲端資料？從雲端還原</button>' : '') +
      '<div class="note small muted">儲存方式：' + (Store.mode === 'idb' ? '手機資料庫（正常）' : Store.mode === 'ls' ? '瀏覽器儲存（正常）' : '<span style="color:var(--warn)">無法存檔，關掉頁面資料會消失</span>') + '</div></div>';
    foot = nav(true, '開始設定');
  } else if (st === 1) {
    title = '個人資料';
    b = '<div class="stack"><div class="seg">' + [['m', '男'], ['f', '女']].map(([k, l]) => '<button class="' + (o.sex === k ? 'on' : '') + '" data-a="obSet" data-k="sex" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
      '<div class="grid3"><label class="f">出生年<input class="inp" data-in="ob" data-k="birthYear" inputmode="numeric" value="' + o.birthYear + '"></label><label class="f">身高 cm<input class="inp" data-in="ob" data-k="height" inputmode="decimal" value="' + o.height + '"></label><label class="f">體重 kg<input class="inp" data-in="ob" data-k="kg" inputmode="decimal" value="' + o.kg + '"></label></div>' +
      '<div id="ob-bmi"></div></div>';
    foot = nav();
  } else if (st === 2) {
    title = '目標與活動量';
    const bm = bmi({ height: o.height }, o.kg);
    b = '<div class="stack"><div class="small muted">BMI ' + bm + (bm < 18.5 ? '，屬於體重過輕，建議增肌。' : bm >= 25 ? '，建議先減脂或維持。' : '，在正常範圍。') + '</div><div class="stack" style="gap:8px">' +
      [['bulk', '增肌', '熱量多吃 400 大卡，每週增重約 ' + gainText(o.kg, bm) + ' kg'], ['maintain', '維持', '熱量平衡，體重不變'], ['cut', '減脂', '熱量少吃 500 大卡，每週約減 0.5 kg']].map(([k, l, d]) => '<button class="opt' + (o.goal === k ? ' on' : '') + '" data-a="obSet" data-k="goal" data-v="' + k + '"><b>' + l + '</b><span>' + d + '</span></button>').join('') +
      '</div><div class="sec-title" style="margin-top:8px">平常活動量（不含健身）</div><div class="stack" style="gap:8px">' +
      [[1.375, '大多坐著', '辦公室工作，走動少'], [1.55, '站著工作、走動不多', '例如採藍莓、櫃台、餐廳'], [1.725, '體力工作', '搬貨、工地、大量走動']].map(([k, l, d]) => '<button class="opt' + (o.act === k ? ' on' : '') + '" data-a="obSet" data-k="act" data-v="' + k + '"><b>' + l + '</b><span>' + d + '</span></button>').join('') + '</div></div>';
    foot = nav();
  } else if (st === 3) {
    title = '你的每日目標';
    const p = { sex: o.sex, birthYear: o.birthYear, height: o.height, goal: o.goal, act: o.act };
    const t = calcTargets(p, o.kg);
    b = '<div class="stack"><div class="kpi">' + kpi('每日消耗估計', t.tdee + ' 大卡', 'BMR × ' + o.act) + kpi('目標熱量', t.kcal + ' 大卡', GOAL_NAME[o.goal]) + kpi('蛋白質', t.p + ' g', '體重 × ' + (o.goal === 'maintain' ? 1.8 : 2.0)) + kpi('脂肪 / 碳水', t.f + ' / ' + t.c + ' g', '脂肪約 27%') + '</div>' +
      '<div class="note">這是公式估算，誤差約 ±10%。累積 3–4 週的體重和飲食紀錄後，app 會用你的實際體重變化自動建議調整。</div>' +
      (o.goal === 'bulk' ? '<div class="note brass">每週增重目標：' + gainText(o.kg, bmi({ height: o.height }, o.kg)) + ' kg。瘦的人增肌最常卡在吃不夠。</div>' : '') + '</div>';
    foot = nav();
  } else if (st === 4) {
    title = '你的健身房有哪些器材？';
    b = '<div class="stack"><label class="f">健身房名稱<input class="inp" data-in="ob" data-k="gymName" value="' + esc(o.gymName) + '"></label><div class="small muted">看圖勾選你健身房有的。不確定的先不勾，之後在設定隨時改。課表只會排你有的器材。</div>' + equipPicker(o.equip, 'ob') + '</div>';
    foot = nav(o.equip.length > 0);
  } else if (st === 5) {
    title = '訓練設定';
    b = '<div class="stack"><div class="sec-title">循環：推 → 拉 → 腿 → 休息</div><div class="small muted">沒練的日子會自動延後，不會跳過。今天要從哪一天開始？</div><div class="grid3">' + ['push', 'pull', 'legs'].map(d => '<button class="opt' + (o.startDay === d ? ' on' : '') + '" style="align-items:center" data-a="obSet" data-k="startDay" data-v="' + d + '"><b>' + DAY_NAME[d] + '</b></button>').join('') + '</div>' +
      '<div class="note small">預設課表以器械為主，之後在設定 → 課表可以換動作。</div></div>';
    foot = nav();
  } else if (st === 6) {
    title = '補充品與喝水';
    b = '<div class="stack"><button class="opt' + (o.has ? ' on' : '') + '" data-a="obTog" data-k="has"><b>' + (o.has ? '✓ ' : '') + '我有在喝高蛋白</b><span>之後在設定填你那罐的營養標示</span></button>' +
      '<button class="opt' + (o.creatineStarted ? ' on' : '') + '" data-a="obTog" data-k="creatineStarted"><b>' + (o.creatineStarted ? '✓ ' : '') + '我今天開始吃肌酸</b><span>沒開始就不用選，開始那天在設定填日期</span></button>' +
      '<button class="opt' + (o.outdoor ? ' on' : '') + '" data-a="obTog" data-k="outdoor"><b>' + (o.outdoor ? '✓ ' : '') + '戶外或流汗的工作</b><span>喝水目標每天多加 500ml</span></button>' +
      '<div class="note small">喝水目標 = 體重 × 35ml，訓練日 +500ml，戶外工作 +500ml。你目前約 ' + ((o.kg * 35 + 500 + (o.outdoor ? 500 : 0)) / 1000).toFixed(1) + ' 公升（訓練日），平常喝 2 公升在流汗的日子是不夠的。</div></div>';
    foot = nav();
  } else {
    title = '完成';
    b = '<div class="stack"><div class="mid" style="font-size:28px">設定好了。</div><div class="note"><b>加到主畫面</b>，用起來就像 app：<br>iPhone Safari → 下方分享鍵 → 「加入主畫面」。</div><div class="note warn"><b>注意</b>：刪掉主畫面圖示或清除 Safari 資料，紀錄可能一起被刪。每週到設定 → 備份一次。</div><div class="note brass">第一次做每個動作會進入<b>試重模式</b>：先用輕重量，做完回答「還能做幾下」，app 會幫你找到工作重量。</div></div>';
    foot = '<button class="btn" data-a="obPrev">上一步</button><button class="btn pri" data-a="obFinish">開始使用</button>';
  }
  return { title, body: dots + b, foot, after: w => { if (st === 1) obBmi(); } };
}
function obBmi() { const o = UI.ob; const el = $('#ob-bmi'); if (!el) return; const v = bmi({ height: +o.height || 1 }, +o.kg || 0); el.innerHTML = '<div class="note small">BMI ' + (isFinite(v) ? v : '–') + '</div>'; }
function equipPicker(sel, ctx) {
  const cats = [...new Set(DATA.equip.map(q => q.cat))];
  return cats.map(cat => {
    const items = DATA.equip.filter(q => q.cat === cat);
    const all = items.every(q => sel.includes(q.id));
    return '<div><div class="row between" style="margin:8px 0"><div class="sec-title" style="margin:0">' + cat + '</div><button class="chip" data-a="eqAll" data-ctx="' + ctx + '" data-v="' + cat + '">' + (all ? '全部取消' : '全選') + '</button></div><div class="eq-grid">' +
      items.map(q => {
        const on = sel.includes(q.id); const im = q.img && DATA.imgmap[q.img] ? DATA.imgmap[q.img][0] : null;
        return '<button class="eq' + (on ? ' on' : '') + '" data-a="eqTog" data-ctx="' + ctx + '" data-v="' + q.id + '" aria-pressed="' + on + '"><div class="fig' + (q.img && q.img.startsWith('fe:') ? ' photo' : '') + '">' + (im ? '<img src="' + im + '" alt="" loading="lazy">' : '<span class="xs" style="color:#555">沒有圖</span>') + '</div><span class="ck">' + (on ? ic('check') : '') + '</span><span class="nm">' + esc(q.name) + '</span><span class="ds">' + esc(q.desc) + '</span></button>';
      }).join('') + '</div></div>';
  }).join('');
}
function finishOnboard() {
  const o = UI.ob; const today = todayStr();
  S.profile = { sex: o.sex, birthYear: +o.birthYear, height: +o.height, startKg: +o.kg, goal: o.goal, act: +o.act, createdAt: today, creatineStart: o.creatineStarted ? today : null };
  const g = { id: uid(), name: o.gymName || '我的健身房', equip: o.equip.slice() };
  S.gyms = [g]; S.settings.activeGym = g.id;
  S.settings.templates = defaultTemplates();
  S.settings.cycle = { idx: ORDER.indexOf(o.startDay), round: 1, restOn: null };
  S.settings.outdoorWork = o.outdoor; S.supp.has = o.has;
  S.weights = [{ date: today, kg: +o.kg, t: Date.now() }];
  const t = calcTargets(S.profile, +o.kg);
  S.targets = [Object.assign({ date: today, reason: '首次設定（公式）' }, t)];
  S.settings.onboarded = true;
  saveNow(); UI.ob = null; UI.sheets = []; drawSheets(); UI.tab = 'today'; render();
}

/* ---------- 設定 ---------- */
function sheetSettings() {
  const p = S.profile; const t = currentTarget(S); const gym = activeGym(S);
  const it = (a, title, sub) => '<button class="li" style="border-left:0;border-right:0;border-bottom:0;background:transparent;width:100%;text-align:left" data-a="' + a + '"><div class="grow"><div class="t">' + title + '</div><div class="small muted">' + sub + '</div></div>' + ic('chev', 'dim') + '</button>';
  let b = '<div class="card list" style="padding:4px 16px">' +
    it('setProfile', '個人資料與目標', age(p) + ' 歲・' + p.height + 'cm・' + GOAL_NAME[p.goal] + (t ? '・' + t.kcal + ' 大卡' : '')) +
    it('setGyms', '健身房與器材', (gym ? gym.name + '・' + gym.equip.length + ' 種器材' : '尚未設定')) +
    it('setTemplates', '課表', '推、拉、腿各日的動作') +
    it('setCycle', '循環進度', '下一次 ' + DAY_NAME[ORDER[S.settings.cycle.idx]] + '・第 ' + S.settings.cycle.round + ' 輪') +
    it('setTraining', '訓練設定', '槓重 ' + S.settings.barKg + 'kg・休息時間依動作') +
    it('setSupp', '補充品與喝水', (S.supp.has ? '高蛋白 ' + S.supp.p + 'g/匙' : '沒有高蛋白') + (p.creatineStart ? '・肌酸從 ' + mdLabel(p.creatineStart) : '')) +
    it('backup', '備份與還原', S.settings.lastBackup ? '上次 ' + mdLabel(S.settings.lastBackup.slice(0, 10)) : '還沒備份過') +
    it('cloud', '雲端同步', SYNC.cfg ? (SYNC.status === 'error' ? '未同步：' + (SYNC.meta.err || '') : SYNC.meta.last ? '上次 ' + mdLabel(SYNC.meta.last.slice(0, 10)) + ' ' + new Date(SYNC.meta.last).toTimeString().slice(0, 5) : '已連線') : '還沒連線（資料只在這支手機）') +
    it('about', '關於與圖片來源', '版本 1.1') + '</div>';
  b += '<div class="small muted" style="margin-top:12px">儲存方式：' + (Store.mode === 'idb' ? '手機資料庫' : Store.mode === 'ls' ? '瀏覽器儲存' : '暫存（關掉會消失）') + (saveFailed ? '・<span style="color:var(--red)">最近一次存檔失敗，請立刻備份</span>' : '') + '</div>';
  return { title: '設定', body: b };
}
function sheetProfile() {
  const p = S.profile; const t = currentTarget(S);
  let b = '<div class="stack"><div class="seg">' + [['m', '男'], ['f', '女']].map(([k, l]) => '<button class="' + (p.sex === k ? 'on' : '') + '" data-a="pSet" data-k="sex" data-v="' + k + '">' + l + '</button>').join('') + '</div>' +
    '<div class="grid2"><label class="f">出生年<input class="inp" id="p-by" inputmode="numeric" value="' + p.birthYear + '"></label><label class="f">身高 cm<input class="inp" id="p-h" inputmode="decimal" value="' + p.height + '"></label></div>' +
    '<label class="f">目標<select class="inp" id="p-goal">' + Object.keys(GOAL_NAME).map(k => '<option value="' + k + '"' + (p.goal === k ? ' selected' : '') + '>' + GOAL_NAME[k] + '</option>').join('') + '</select></label>' +
    '<label class="f">活動量<select class="inp" id="p-act">' + [[1.375, '大多坐著'], [1.55, '站著工作、走動不多'], [1.725, '體力工作']].map(([k, l]) => '<option value="' + k + '"' + (p.act === k ? ' selected' : '') + '>' + l + '（×' + k + '）</option>').join('') + '</select></label>' +
    '<button class="btn pri" data-a="saveProfile">儲存並重新計算目標</button>' +
    '<div class="hr"></div><div class="sec-title">手動調整目標</div><div class="grid2"><label class="f">熱量<input class="inp" id="t-k" inputmode="numeric" value="' + (t ? t.kcal : '') + '"></label><label class="f">蛋白質 g<input class="inp" id="t-p" inputmode="numeric" value="' + (t ? t.p : '') + '"></label></div>' +
    '<button class="btn" data-a="saveManualTarget">儲存手動目標</button><div class="small muted">脂肪固定約 27%，碳水自動補足剩下的熱量。</div></div>';
  return { title: '個人資料與目標', body: b };
}
function sheetGyms() {
  let b = '<div class="stack">' + S.gyms.map(g => '<div class="card"><div class="row between"><div class="grow"><div style="font-weight:600">' + esc(g.name) + (g.id === S.settings.activeGym ? ' <span class="tag ok">目前所在</span>' : '') + '</div><div class="small muted">' + g.equip.length + ' 種器材</div></div></div><div class="row wrap" style="margin-top:10px;gap:8px">' +
    (g.id !== S.settings.activeGym ? '<button class="btn sm pri" data-a="gymActive" data-v="' + g.id + '">切換到這間</button>' : '') + '<button class="btn sm" data-a="gymEquip" data-v="' + g.id + '">勾選器材</button><button class="btn sm" data-a="gymRename" data-v="' + g.id + '">改名</button>' + (S.gyms.length > 1 ? '<button class="btn sm danger" data-a="gymDel" data-v="' + g.id + '">刪除</button>' : '') + '</div></div>').join('') +
    '<button class="btn block" data-a="gymAdd">' + ic('plus') + '新增健身房</button><div class="small muted">每筆訓練都會記是哪間健身房。換館後，不同館的機台重量不會互相比較，建議重量會重新從試重開始。</div></div>';
  return { title: '健身房與器材', body: b };
}
function sheetEquip(gid) {
  return () => {
    const g = S.gyms.find(x => x.id === gid);
    return { title: esc(g.name) + '・器材', body: '<div class="small muted" style="margin-bottom:6px">勾選這間有的器材。看圖認機器：重點是人怎麼使用它，品牌外觀會不同。</div>' + equipPicker(g.equip, 'gym:' + gid), foot: '<button class="btn pri" data-a="closeSheet">完成（' + g.equip.length + ' 種）</button>' };
  };
}
function rxLine(r, e) {
  const reps = e && e.load === 'time' ? r.lo + '–' + r.hi + ' 秒' : r.lo + '–' + r.hi + ' 下';
  return r.sets + ' 組 × ' + reps + '・休息 ' + fmtRest(r.rest);
}
function fmtRest(sec) { const m = Math.floor(sec / 60), x = sec % 60; return m ? m + (x ? ':' + pad2(x) : ' 分鐘') : x + ' 秒'; }
function sheetTemplates() {
  const tpl = S.settings.templates; const gym = activeGym(S);
  let b = '<div class="stack"><div class="small muted">每一格是一個動作位置，按「調整」可以改組數、次數和休息時間。第一個是主選，健身房沒有或標記會痛時，自動用下一個備選。</div>';
  if (S.settings.tplUpgraded) b += '<div class="note brass small">已換成新的預設菜單（減少夾胸、增加面拉和側平舉）。想用舊的，可以自己用「＋加入動作」加回來。</div>';
  for (const d of ['push', 'pull', 'legs']) {
    b += '<div class="card"><h2>' + DAY_NAME[d] + '</h2><div class="stack" style="gap:10px">' + tpl[d].map((slot, i) => {
      const ids = slotIds(slot); const e = EXMAP[ids[0]]; const avail = e && exAvailable(e, gym);
      const r = e ? rxFor(S, e, { n: 2 }, slot.sets) : null;
      return '<div class="tslot"><div class="row" style="gap:8px;align-items:flex-start"><span class="num dim" style="width:18px;padding-top:2px">' + (i + 1) + '</span><div class="grow"><div style="font-weight:600">' + esc(e ? e.name : '?') + '</div>' +
        (r ? '<div class="xs" style="color:var(--brass-hi)">' + rxLine(r, e) + '</div>' : '') +
        (ids.length > 1 ? '<div class="xs muted">備選：' + ids.slice(1).map(x => EXMAP[x] ? EXMAP[x].name : '').join('、') + '</div>' : '') + (!avail ? '<div class="xs" style="color:var(--warn)">目前健身房沒有，會用備選</div>' : '') + '</div></div>' +
        '<div class="row" style="gap:6px;margin-top:8px;justify-content:flex-end"><button class="btn sm" data-a="tplRx" data-v="' + d + ':' + i + '">調整</button><button class="icon-btn" data-a="tplMove" data-v="' + d + ':' + i + '" aria-label="上移"' + (i === 0 ? ' disabled style="opacity:.3"' : '') + '>' + ic('up') + '</button><button class="icon-btn" data-a="tplSwap" data-v="' + d + ':' + i + '" aria-label="更換動作">' + ic('swap') + '</button><button class="icon-btn" data-a="tplDel" data-v="' + d + ':' + i + '" aria-label="刪除">' + ic('trash') + '</button></div></div>';
    }).join('') + '</div><button class="btn sm" style="margin-top:10px" data-a="tplAdd" data-v="' + d + '">' + ic('plus') + '加入動作</button></div>';
  }
  b += '<button class="btn danger block" data-a="tplReset">恢復預設課表</button></div>';
  return { title: '課表', body: b };
}
function sheetRxEdit(exId, slotRef) {
  return () => {
    const e = EXMAP[exId]; const base = baseRx(S, e);
    const slot = slotRef ? S.settings.templates[slotRef.d][slotRef.i] : null;
    const sets = slot && slot.sets ? slot.sets : base.sets;
    const isTime = e.load === 'time';
    const d0 = (DATA.rx && DATA.rx[e.id]) || null;
    return {
      title: '調整・' + esc(e.name),
      body: '<div class="stack">' +
        (slot ? '<label class="f">組數（' + DAY_NAME[slotRef.d] + '這一格）<div class="stepper" style="grid-template-columns:52px 1fr 52px"><button data-a="rxStep" data-v="sets:-1" aria-label="減少">−</button><input class="inp" id="rx-sets" inputmode="numeric" value="' + sets + '"><button data-a="rxStep" data-v="sets:1" aria-label="增加">+</button></div></label>' : '') +
        '<div class="grid2"><label class="f">' + (isTime ? '最少秒數' : '最少次數') + '<input class="inp" id="rx-lo" inputmode="numeric" value="' + base.lo + '"></label><label class="f">' + (isTime ? '最多秒數' : '最多次數') + '<input class="inp" id="rx-hi" inputmode="numeric" value="' + base.hi + '"></label></div>' +
        '<label class="f">組間休息（秒）<input class="inp" id="rx-rest" inputmode="numeric" value="' + base.rest + '"></label>' +
        '<div class="chips">' + [60, 75, 90, 120, 150, 180].map(x => '<button class="chip' + (base.rest === x ? ' on' : '') + '" data-a="rxRest" data-v="' + x + '">' + fmtRest(x) + '</button>').join('') + '</div>' +
        '<div class="note small"><b>建議留幾下：</b>' + esc(base.rir) + '・' + FAIL_TEXT[base.fail] + '<br><span class="muted">次數做到上限就加重。適應期次數會自動 +2，力量期複合動作 −2，減量週組數減半。</span></div>' +
        (d0 ? '<div class="xs muted">預設：' + d0[0] + ' 組 × ' + d0[1] + '–' + d0[2] + (isTime ? ' 秒' : ' 下') + '・休息 ' + fmtRest(d0[5]) + '</div>' : '') +
        '<div id="rx-warn"></div></div>',
      foot: '<button class="btn" data-a="rxDefault" data-v="' + exId + (slotRef ? ':' + slotRef.d + ':' + slotRef.i : '') + '">恢復預設</button><button class="btn pri" data-a="rxSave" data-v="' + exId + (slotRef ? ':' + slotRef.d + ':' + slotRef.i : '') + '">儲存</button>'
    };
  };
}
function sheetPickEx(title, filterFn, onPick) {
  return () => {
    const q = (UI.pickQ || '').toLowerCase(); const gym = activeGym(S);
    const list = Object.values(EXMAP).filter(filterFn).filter(e => !q || (e.name + e.mach).toLowerCase().includes(q))
      .sort((a, b) => (exAvailable(b, gym) - exAvailable(a, gym)));
    UI.pickFn = onPick;
    return {
      title, body: '<input class="inp" id="pickq" placeholder="搜尋" value="' + esc(UI.pickQ || '') + '" style="margin-bottom:10px"><div class="stack" style="gap:8px">' + list.map(e => '<button class="lib-item" data-a="pickEx" data-v="' + e.id + '">' + exThumb(e) + '<div class="grow"><div style="font-weight:600">' + esc(e.name) + '</div><div class="small muted">' + esc(e.mach) + (exAvailable(e, gym) ? '' : '・<span style="color:var(--warn)">這間沒有</span>') + '</div></div></button>').join('') + '</div>'
    };
  };
}
function sheetCycle() {
  const c = S.settings.cycle;
  let b = '<div class="stack"><div class="small muted">循環是 推 → 拉 → 腿 → 休息。如果紀錄跟實際不同，在這裡校正。</div><div class="sec-title">下一次要練</div><div class="grid3">' + ['push', 'pull', 'legs'].map(d => '<button class="opt' + (ORDER[c.idx] === d ? ' on' : '') + '" data-a="cycSet" data-v="' + d + '"><b>' + DAY_NAME[d] + '</b></button>').join('') + '</div>' +
    '<label class="f">目前第幾輪（1 輪 = 推拉腿各一次）<input class="inp" id="cyc-r" inputmode="numeric" value="' + c.round + '"></label><button class="btn" data-a="cycRound">儲存輪數</button>' +
    '<div class="card"><h2>階段（每 21 輪一個循環）</h2><div class="small muted" style="margin-bottom:6px">每個動作的組數、次數、休息時間在「課表 → 調整」設定，階段會在這個基礎上自動加減。</div>' + [1, 2, 3, 4].map(n => { const P = PHASES[n]; const range = { 1: '1–7', 2: '8–14', 3: '15–19', 4: '20–21' }[n]; return '<div class="li"><div class="grow"><div class="t">' + P.name + ' <span class="muted small">第 ' + range + ' 輪</span></div><div class="small muted">' + P.short + '</div></div>' + (phaseOf(c.round).n === n ? '<span class="tag brass">現在</span>' : '') + '</div>'; }).join('') + '</div></div>';
  return { title: '循環進度', body: b };
}
function sheetTraining() {
  const s = S.settings;
  return {
    title: '訓練設定', body: '<div class="stack"><div class="note small">組間休息時間已經依每個動作分開設定（例如深蹲 3 分鐘、側平舉 60 秒），在「課表 → 調整」修改。</div><label class="f">槓鈴重量（kg，標準奧林匹克槓是 20）<input class="inp" id="ts-bar" inputmode="decimal" value="' + s.barKg + '"></label>' +
      '<button class="opt' + (s.preferMachines ? ' on' : '') + '" data-a="togPrefer"><b>' + (s.preferMachines ? '✓ ' : '') + '偏好器械</b><span>預設課表以器械為主，比較穩定、好控制</span></button><button class="btn pri" data-a="saveTraining">儲存</button></div>'
  };
}
function sheetSupp() {
  const s = S.supp; const p = S.profile;
  return {
    title: '補充品與喝水', body: '<div class="stack"><button class="opt' + (s.has ? ' on' : '') + '" data-a="togHas"><b>' + (s.has ? '✓ ' : '') + '我有在喝高蛋白</b><span>首頁會出現一鍵加入按鈕</span></button>' +
      '<div class="card"><h2>高蛋白營養標示（每匙）</h2><div class="grid2"><label class="f">名稱<input class="inp" id="s-name" value="' + esc(s.name) + '"></label><label class="f">一匙幾克<input class="inp" id="s-g" inputmode="decimal" value="' + s.scoopG + '"></label><label class="f">熱量<input class="inp" id="s-k" inputmode="decimal" value="' + s.kcal + '"></label><label class="f">蛋白質 g<input class="inp" id="s-p" inputmode="decimal" value="' + s.p + '"></label><label class="f">碳水 g<input class="inp" id="s-c" inputmode="decimal" value="' + s.c + '"></label><label class="f">脂肪 g<input class="inp" id="s-f" inputmode="decimal" value="' + s.f + '"></label></div>' +
      '<label class="f" style="margin-top:10px">每次加多少牛奶（ml，用水就填 0）<input class="inp" id="s-milk" inputmode="numeric" value="' + s.milkMl + '"></label><div class="small muted" style="margin-top:6px">牛奶以全脂計算：每 100ml 約 64 大卡、蛋白 3.2g。</div></div>' +
      '<div class="card"><h2>怎麼喝</h2><ol class="cues small"><li>高蛋白是用來補足一天約 ' + (currentTarget(S) || { p: 100 }).p + 'g 蛋白質的缺口，一天 1–2 匙就好</li><li>訓練日：練完 2 小時內喝一份；休息日：早餐或下午點心喝</li><li>用牛奶泡比用水多約 190 大卡，對增肌有幫助</li><li>喝牛奶脹氣就改買分離乳清（Isolate）用水泡</li></ol></div>' +
      '<div class="card"><h2>肌酸</h2><label class="f">開始日期（還沒開始就留空）<input class="inp" id="s-cs" type="date" value="' + (p.creatineStart || '') + '"></label><ol class="cues small" style="margin-top:10px"><li>一水肌酸（Creatine Monohydrate），每天 3–5g</li><li>每天都吃，休息日也吃；時間不重要，可以加進高蛋白</li><li>前 1–3 週體重會多 1–2kg 水分，這段期間 app 暫停自動調整熱量</li><li>腎臟有已知問題的人先問醫生</li></ol></div>' +
      '<div class="card"><h2>喝水</h2><button class="opt' + (S.settings.outdoorWork ? ' on' : '') + '" data-a="togOutdoor"><b>' + (S.settings.outdoorWork ? '✓ ' : '') + '戶外或流汗的工作</b><span>每天目標多加 500ml</span></button><label class="f" style="margin-top:10px">自訂每日目標 ml（留空用自動計算）<input class="inp" id="s-wg" inputmode="numeric" value="' + (S.settings.waterGoalManual || '') + '"></label><div class="small muted" style="margin-top:6px">自動：體重 × 35ml，訓練日 +500ml。尿液淡黃色代表喝夠。</div></div>' +
      '<button class="btn pri" data-a="saveSupp">儲存</button></div>'
  };
}
function sheetBackup() {
  return {
    title: '備份與還原', body: '<div class="stack"><div class="note">所有資料只存在這支手機。換手機、清除瀏覽器資料、刪掉主畫面圖示之前，一定要先備份。</div>' +
      '<div class="card"><h2>備份</h2><div class="small muted" style="margin-bottom:10px">下載一個備份檔，存到檔案 App 或雲端硬碟。如果下載沒反應，用「複製備份文字」，貼到備忘錄或寄給自己。</div><div class="stack" style="gap:8px"><button class="btn pri" data-a="exportFile">' + ic('down') + '下載備份檔</button><button class="btn" data-a="exportCopy">' + ic('copy') + '複製備份文字</button></div><div class="small muted" style="margin-top:8px">照片會一起備份，檔案可能比較大。</div><textarea class="inp" id="bk-out" style="display:none;margin-top:10px" readonly></textarea></div>' +
      '<div class="card"><h2>還原</h2><div class="small muted" style="margin-bottom:10px">還原會<b style="color:var(--warn)">取代</b>目前這支手機上的所有紀錄。</div><div class="stack" style="gap:8px"><label class="btn" style="position:relative">' + ic('up') + '選擇備份檔<input type="file" accept=".json,application/json,text/plain" class="hidden-file" data-in="importFile"></label><textarea class="inp" id="bk-in" placeholder="或把備份文字貼在這裡"></textarea><button class="btn" data-a="importText">從文字還原</button></div></div></div>'
  };
}
function sheetAbout() {
  return {
    title: '關於與圖片來源', body: '<div class="stack small"><div class="card"><h2>Training 1.0</h2><div class="muted">個人自用的訓練與飲食紀錄。熱量與營養數字為估算值，不是醫療建議。</div></div>' +
      '<div class="card"><h2>圖片與資料來源</h2><ol class="cues"><li>動作插畫：Everkinetic（everkinetic.com，Greg Priday），CC BY-SA 4.0 授權，已縮小並轉為灰階</li><li>部分動作照片：free-exercise-db（yuhonas），Unlicense</li><li>肌肉圖：react-native-body-highlighter（ELABBASSI Hicham），MIT 授權，已改色</li><li>食物熱量為常見份量的約略值</li></ol></div></div>'
  };
}
function sheetAddFood(meal) {
  return () => {
    const date = UI.foodDate || todayStr();
    const tab = UI.foodTab || 'fav';
    const q = (UI.foodQ || '').toLowerCase();
    const foods = allFoods(S);
    let list;
    if (tab === 'fav') {
      const fav = new Set(S.settings.favFoods);
      const recentNames = []; for (const x of S.foodlog.slice().reverse()) { if (!recentNames.includes(x.name)) recentNames.push(x.name); if (recentNames.length > 15) break; }
      const recent = recentNames.map(n => S.foodlog.slice().reverse().find(x => x.name === n)).map(x => ({ id: x.foodId || ('log:' + x.id), name: x.name, unit: x.unit, kcal: x.kcal / x.qty, p: x.p / x.qty, c: x.c / x.qty, f: x.f / x.qty, recent: true }));
      list = foods.filter(f => fav.has(f.id)).concat(recent.filter(r => !fav.has(r.id)));
    } else list = foods;
    if (q) list = list.filter(f => f.name.toLowerCase().includes(q));
    const mealName = MEALS.find(m => m[0] === meal)[1];
    // 複製上次這一餐
    const prevDates = [...new Set(S.foodlog.filter(x => x.meal === meal && x.date < date).map(x => x.date))].sort();
    const prev = prevDates[prevDates.length - 1];
    let b = '<div class="stack">';
    if (prev) b += '<button class="btn" data-a="copyMeal" data-v="' + meal + ':' + prev + '">' + ic('copy') + '複製 ' + mdLabel(prev) + ' 的' + mealName + '（' + S.foodlog.filter(x => x.meal === meal && x.date === prev).length + ' 項）</button>';
    if (S.supp.has) b += '<button class="btn" data-a="addShakeTo" data-v="' + meal + '">' + ic('plus') + esc(shakeFood().name) + '</button>';
    b += '<button class="btn" data-a="scanFood" data-v="' + meal + '">' + ic('barcode') + '掃條碼</button>';
    b += '<div class="seg">' + [['fav', '常用'], ['all', '全部'], ['quick', '快速輸入'], ['new', '照標示新增']].map(([k, l]) => '<button class="' + (tab === k ? 'on' : '') + '" data-a="foodTab" data-v="' + k + '">' + l + '</button>').join('') + '</div>';
    if (tab === 'quick') {
      b += '<div class="small muted">只知道大概熱量和蛋白質也可以，例如外食。</div><label class="f">名稱（選填）<input class="inp" id="q-name" placeholder="例如：公司便當"></label><div class="grid2"><label class="f">熱量<input class="inp" id="q-k" inputmode="decimal"></label><label class="f">蛋白質 g<input class="inp" id="q-p" inputmode="decimal"></label><label class="f">碳水 g（選填）<input class="inp" id="q-c" inputmode="decimal"></label><label class="f">脂肪 g（選填）<input class="inp" id="q-f" inputmode="decimal"></label></div><button class="btn pri" data-a="quickAdd" data-v="' + meal + '">加入' + mealName + '</button>';
    } else if (tab === 'new') {
      b += '<div class="small muted">照包裝上的營養標示輸入一次，之後在「常用」一鍵加入。</div><label class="f">名稱<input class="inp" id="n-name" placeholder="例如：Coles 雞胸肉"></label><label class="f">單位<input class="inp" id="n-unit" placeholder="例如：1 包、100g、1 份"></label><div class="grid2"><label class="f">熱量<input class="inp" id="n-k" inputmode="decimal"></label><label class="f">蛋白質 g<input class="inp" id="n-p" inputmode="decimal"></label><label class="f">碳水 g<input class="inp" id="n-c" inputmode="decimal"></label><label class="f">脂肪 g<input class="inp" id="n-f" inputmode="decimal"></label></div><div class="note small">澳洲包裝的 Energy 是 kJ：除以 4.184 就是大卡。</div><button class="btn pri" data-a="newFood" data-v="' + meal + '">儲存並加入' + mealName + '</button>';
    } else {
      b += '<input class="inp" id="foodq" placeholder="搜尋食物" value="' + esc(UI.foodQ || '') + '">';
      b += list.length ? '<div class="list">' + list.map(f => '<div class="li"><button style="flex:1;min-width:0;text-align:left;background:transparent;border:0;padding:0" data-a="pickFood" data-v="' + esc(f.id) + '" data-meal="' + meal + '"><div class="t">' + esc(f.name) + (f.recent ? ' <span class="tag">最近</span>' : '') + '</div><div class="small muted">' + esc(f.unit) + '・' + Math.round(f.kcal) + ' 大卡・蛋白 ' + fmtNum(f.p) + 'g</div></button>' + (f.recent && String(f.id).startsWith('log:') ? '' : '<button class="icon-btn" data-a="favFood" data-v="' + esc(f.id) + '" aria-label="加入常用" style="' + (S.settings.favFoods.includes(f.id) ? 'color:var(--brass)' : '') + '">' + ic('star') + '</button>') + '</div>').join('') + '</div>' : '<div class="empty">' + (tab === 'fav' ? '還沒有常用食物。到「全部」按星號加入常用，或記錄過的食物會自動出現在這裡。' : '找不到。用「照標示新增」或「快速輸入」。') + '</div>';
    }
    b += '</div>';
    return { title: '新增到' + mealName + '・' + mdLabel(date), body: b };
  };
}
function sheetQty(food, meal, logId) {
  return () => {
    const qty = UI.qty;
    const k = food.kcal * qty, p = food.p * qty;
    return {
      title: esc(food.name), body: '<div class="stack"><div class="muted small">' + esc(food.unit) + '・每份 ' + Math.round(food.kcal) + ' 大卡</div><div class="stepper" style="grid-template-columns:56px 1fr 56px"><button data-a="qty" data-v="-0.5" aria-label="減少">−</button><input class="inp" id="qty" inputmode="decimal" value="' + qty + '" aria-label="份量"><button data-a="qty" data-v="0.5" aria-label="增加">+</button></div><div class="chips" style="justify-content:center">' + [0.5, 1, 1.5, 2, 3].map(v => '<button class="chip' + (qty === v ? ' on' : '') + '" data-a="qtySet" data-v="' + v + '">' + v + ' 份</button>').join('') + '</div>' +
        '<div class="kpi">' + kpi('熱量', Math.round(k) + ' 大卡') + kpi('蛋白質', fmtNum(p) + ' g') + '</div>' +
        (logId ? '<label class="f">換到<select class="inp" id="mealSel">' + MEALS.map(([m, n]) => '<option value="' + m + '"' + (m === meal ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' : '') + '</div>',
      foot: logId ? '<button class="btn danger" data-a="delLog" data-v="' + logId + '">刪除</button><button class="btn pri" data-a="saveLog" data-v="' + logId + '">儲存</button>' : '<button class="btn pri" data-a="confirmFood">加入</button>'
    };
  };
}

/* ===== 事件 ===== */
const A = {};
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  ensureAudio();
  try { await fn(el.dataset.v, el, e); } catch (err) { console.error(err); toast('發生錯誤：' + (err.message || err)); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'libq') { UI.libQ = t.value; const pos = t.selectionStart; render(); const n = $('#libq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  if (t.id === 'foodq') { UI.foodQ = t.value; refreshKeepFocus('foodq'); }
  if (t.id === 'pickq') { UI.pickQ = t.value; refreshKeepFocus('pickq'); }
  if (t.dataset.in === 'ob') { UI.ob[t.dataset.k] = t.value; if (UI.ob.step === 1) obBmi(); }
  if (t.dataset.rk) { const k = t.dataset.rk; const s0 = liveSession(); const e0 = EXMAP[k.split(':')[1]]; const cur = UI.rows[k] || {}; UI.rows[k] = { w: t.dataset.f === 'w' ? t.value : (cur.w != null ? cur.w : (document.getElementById('rw-' + e0.id) || {}).value || ''), reps: t.dataset.f === 'reps' ? t.value : (cur.reps != null ? cur.reps : (document.getElementById('rr-' + e0.id) || {}).value || '') }; }
  if (t.id === 'qty') { const v = parseFloat(t.value); if (v > 0) { UI.qty = v; } }
});
function refreshKeepFocus(id) { const top = UI.sheets[UI.sheets.length - 1]; if (!top) return; const n0 = document.getElementById(id); const pos = n0 ? n0.selectionStart : 0; refreshSheet(top.id); const n = document.getElementById(id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
document.addEventListener('change', async e => {
  const t = e.target;
  try {
    if (t.dataset.in === 'photo' && t.files[0]) {
      const url = await fileToDataUrl(t.files[0], 1100, 0.8); const key = await putImg(url);
      S.photos.push({ id: uid(), date: todayStr(), pose: t.dataset.pose, key }); save(); toast('已存' + t.dataset.pose + '照片'); render();
    }
    if (t.dataset.in === 'exPhoto' && t.files[0]) {
      const url = await fileToDataUrl(t.files[0], 900, 0.8); const key = await putImg(url);
      const u = exu(t.dataset.ex); if (u.photo) Store.del('img:' + u.photo); u.photo = key; save(); toast('照片已存'); rerender();
    }
    if (t.dataset.in === 'scanPhoto' && t.files[0]) { await decodePhoto(t.files[0]); }
    if (t.dataset.in === 'importFile' && t.files[0]) { const txt = await t.files[0].text(); await doImport(txt); }
  } catch (err) { toast(err.message || '處理失敗'); }
});
function exu(id) { return S.exu[id] = S.exu[id] || { videos: [], notes: {}, pain: null, photo: null }; }

A.tab = v => { UI.tab = v; UI.sheets = []; drawSheets(); render(); window.scrollTo(0, 0); };
A.closeSheet = () => closeSheet();
A.settings = () => openSheet('settings', sheetSettings);
A.setProfile = () => openSheet('profile', sheetProfile);
A.setGyms = () => openSheet('gyms', sheetGyms);
A.setTemplates = () => openSheet('tpl', sheetTemplates);
A.openTpl = () => openSheet('tpl', sheetTemplates);
A.setCycle = () => openSheet('cycle', sheetCycle);
A.setTraining = () => openSheet('training', sheetTraining);
A.setSupp = () => openSheet('supp', sheetSupp);
A.backup = () => openSheet('backup', sheetBackup);
A.about = () => openSheet('about', sheetAbout);
A.cloud = () => openSheet('cloud', sheetCloud);

/* 引導 */
A.obNext = () => {
  const o = UI.ob;
  if (o.step === 1) {
    const by = +o.birthYear, h = +o.height, kg = +o.kg;
    if (!(by > 1930 && by < 2015) || !(h > 120 && h < 230) || !(kg > 30 && kg < 250)) { toast('請確認出生年、身高、體重'); return; }
    o.birthYear = by; o.height = h; o.kg = kg;
  }
  o.step = Math.min(OB_STEPS - 1, o.step + 1); refreshSheet('ob'); $('.sheet-b').scrollTop = 0;
};
A.obPrev = () => { UI.ob.step = Math.max(0, UI.ob.step - 1); refreshSheet('ob'); };
A.obSet = (v, el) => { const k = el.dataset.k; UI.ob[k] = k === 'act' ? +v : v; refreshSheet('ob'); };
A.obTog = (v, el) => { const k = el.dataset.k; UI.ob[k] = !UI.ob[k]; refreshSheet('ob'); };
A.obFinish = () => finishOnboard();
function eqList(ctx) { if (ctx === 'ob') return UI.ob.equip; const g = S.gyms.find(x => 'gym:' + x.id === ctx); return g.equip; }
A.eqTog = (v, el) => {
  const L = eqList(el.dataset.ctx); const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else L.push(v);
  if (el.dataset.ctx !== 'ob') save();
  el.classList.toggle('on', i < 0); el.setAttribute('aria-pressed', i < 0); $('.ck', el).innerHTML = i < 0 ? ic('check') : '';
  const top = UI.sheets[UI.sheets.length - 1];
  if (top) { const f = $('.sheet-wrap[data-sheet="' + top.id + '"] .sheet-f'); const r = top.render(); if (f && r.foot) f.innerHTML = r.foot; }
};
A.eqAll = (cat, el) => {
  const L = eqList(el.dataset.ctx); const ids = DATA.equip.filter(q => q.cat === cat).map(q => q.id);
  const all = ids.every(id => L.includes(id));
  for (const id of ids) { const i = L.indexOf(id); if (all && i >= 0) L.splice(i, 1); if (!all && i < 0) L.push(id); }
  if (el.dataset.ctx !== 'ob') save();
  const top = UI.sheets[UI.sheets.length - 1]; if (top) refreshSheet(top.id);
};

/* 今日 */
A.skipRest = () => { skipRest(S); save(); render(); toast('改成今天練推日'); };
A.water = v => { const d = UI.tab === 'food' ? (UI.foodDate || todayStr()) : todayStr(); S.water[d] = Math.max(0, (S.water[d] || 0) + (+v)); save(); render(); };
A.creatine = v => { if (S.creatine[v]) delete S.creatine[v]; else { S.creatine[v] = true; if (!S.profile.creatineStart) { S.profile.creatineStart = v; toast('已記錄肌酸開始日期'); } } save(); render(); };
A.addShake = () => { logFood(todayStr(), guessMeal(), shakeFood(), 1); toast('已加入高蛋白'); render(); };
A.addWeight = () => openSheet('weight', () => ({
  title: '記錄體重', body: '<div class="stack"><div class="small muted">建議休息日早上量：起床、上完廁所、吃東西前。同一天量兩次會以最後一次為準。</div><div class="grid2"><label class="f">日期<input class="inp" id="w-date" type="date" value="' + todayStr() + '" max="' + todayStr() + '"></label><label class="f">體重 kg<input class="inp" id="w-kg" inputmode="decimal" value="' + (latestWeight(S) ? latestWeight(S).kg : '') + '"></label></div></div>',
  foot: '<button class="btn pri" data-a="saveWeight">儲存</button>', after: w => { const i = $('#w-kg', w); if (i) i.select(); }
}));
A.saveWeight = () => {
  const d = $('#w-date').value || todayStr(); const kg = parseFloat($('#w-kg').value);
  if (!(kg > 25 && kg < 300)) { toast('請輸入正確的體重'); return; }
  S.weights = S.weights.filter(w => w.date !== d); S.weights.push({ date: d, kg: r1(kg), t: Date.now() }); save();
  closeSheet('weight'); toast('已記錄 ' + r1(kg) + ' kg'); rerender();
};
A.delWeight = async v => { if (!(await confirmBox('刪除 ' + mdLabel(v) + ' 的體重紀錄？', '刪除', true))) return; S.weights = S.weights.filter(w => w.date !== v); save(); render(); };
A.applyAdaptive = async () => {
  const ad = adaptive(S, todayStr()); if (!ad.ok) return;
  const t = calcTargets(S.profile, ad.kg, null);
  const k = ad.newKcal; const p = t.p; const f = Math.max(Math.round(k * 0.27 / 9), Math.round(ad.kg * 0.6)); const c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
  S.targets.push({ date: todayStr(), reason: '依體重趨勢自動調整', tdee: ad.tdeeEst, kcal: k, p, f, c }); save(); toast('目標已更新為 ' + k + ' 大卡'); rerender();
};

/* 訓練 */
A.startSession = async v => {
  const live = S.sessions.find(s => !s.end); if (live) { UI.tab = 'train'; render(); return; }
  const today = todayStr(); const c = S.settings.cycle;
  if (ORDER[c.idx] === 'rest') skipRest(S);
  const gym = activeGym(S);
  const s = { id: uid(), date: today, tz: tzName(), gymId: gym ? gym.id : null, day: v, round: c.round, start: new Date().toTimeString().slice(0, 5), startTs: Date.now(), end: null, plan: dayPlan(S, v), psets: dayPlanSets(S, v) };
  S.sessions.push(s); UI.openEx = s.plan[0] || null; save(); UI.tab = 'train'; render(); window.scrollTo(0, 0);
};
function scrollToEx(id) {
  setTimeout(() => { const el = document.getElementById('ex-' + id); if (!el) return; const y = el.getBoundingClientRect().top + window.scrollY - 10 - (parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0); window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }, 30);
}
A.toggleEx = v => { UI.openEx = UI.openEx === v ? null : v; render(); if (UI.openEx) scrollToEx(v); };
function liveSession() { return S.sessions.find(s => !s.end); }
function keepRowVisible(eid) {
  setTimeout(() => {
    const row = document.getElementById('rr-' + eid) || document.querySelector('#ex-' + eid + ' [data-a="doneEx"]'); if (!row) return;
    const r = row.getBoundingClientRect();
    const tm = document.getElementById('timer'); const nav = document.getElementById('nav');
    const bottomLimit = window.innerHeight - (nav ? nav.offsetHeight : 64) - (tm && !tm.hidden ? tm.offsetHeight : 0) - 12;
    if (r.bottom > bottomLimit) window.scrollBy({ top: r.bottom - bottomLimit + 8, behavior: 'smooth' });
  }, 40);
}
A.saveRow = async eid => {
  const s = liveSession(); if (!s) return; const e = EXMAP[eid]; const isTime = e.load === 'time';
  const wEl = document.getElementById('rw-' + eid), rEl = document.getElementById('rr-' + eid);
  const w = isTime ? 0 : (wEl.value.trim() === '' ? NaN : parseFloat(wEl.value)); const reps = parseInt(rEl.value, 10);
  const warnEl = document.getElementById('warn-' + eid); warnEl.innerHTML = '';
  if (!isTime && (isNaN(w) || w < 0)) { warnEl.innerHTML = '<div class="note warn small">請輸入重量（自體重沒有負重就填 0）</div>'; wEl.focus(); return; }
  if (!(reps > 0)) { warnEl.innerHTML = '<div class="note warn small">請輸入' + (isTime ? '秒數' : '次數') + '</div>'; rEl.focus(); return; }
  const tw = isTime ? 0 : totalWeight(e, w, 0, S);
  const mx = maxEverTw(S, eid);
  if (!isTime && mx && tw > mx * 1.3 && tw - mx > 5 && e.load !== 'assist') {
    if (!(await confirmBox(fmtNum(tw) + 'kg 比你最高紀錄 ' + fmtNum(mx) + 'kg 多了 ' + Math.round((tw / mx - 1) * 100) + '%，確定沒打錯嗎？', '確定儲存'))) return;
  }
  const sg = suggestion(S, e, phaseOf(s.round), s.id);
  const existing = S.sets.filter(x => x.sid === s.id && x.ex === eid);
  const n = existing.length ? Math.max(...existing.map(x => x.n)) + 1 : 1;
  const st = { id: uid(), sid: s.id, ex: eid, n, w, add: 0, tw, reps, rir: '', fail: false, warm: false, cal: !!sg.cal, t: Date.now() };
  const pr = checkPR(S, e, st); if (pr) st.pr = pr;
  S.sets.push(st); delete UI.rows[s.id + ':' + eid + ':' + n]; save();
  if (pr) toast(ic('star') + ' 新紀錄！' + esc(e.name) + ' ' + pr, true);
  startTimer(sessionRx(S, s, e).rest);
  render(); keepRowVisible(eid);
};
A.rowRir = v => {
  const [id, r] = v.split(':'); const st = S.sets.find(x => x.id === id); if (!st) return;
  st.rir = st.rir === r ? '' : r;
  const s = liveSession(); if (s) delete UI.rows[s.id + ':' + st.ex + ':' + (st.n + 1)];
  save(); render(); keepRowVisible(st.ex);
};
A.addRow = eid => {
  const s = liveSession(); s.done = s.done || {};
  if (s.done[eid]) { delete s.done[eid]; save(); render(); return; }
  const e = EXMAP[eid]; const ph = phaseOf(s.round);
  // 額外多一組：直接把目標暫時拉高
  s.extra = s.extra || {}; s.extra[eid] = (s.extra[eid] || 0) + 1; save(); render(); keepRowVisible(eid);
};
A.doneEx = eid => {
  const s = liveSession(); s.done = s.done || {};
  if (s.done[eid]) { UI.openEx = null; render(); return; }
  s.done[eid] = true; save();
  const idx = s.plan.indexOf(eid);
  const order = s.plan.slice(idx + 1).concat(s.plan.slice(0, idx));
  const next = order.find(id => !s.done[id]);
  UI.openEx = next || null; render();
  if (next) { toast('下一個：' + esc(EXMAP[next].name)); scrollToEx(next); }
  else toast('全部動作完成，按「完成今天的訓練」');
};
A.exMenu = v => {
  const e = EXMAP[v];
  openSheet('exmenu', () => ({ title: esc(e.name), body: '<div class="stack" style="gap:8px">' +
    '<button class="btn block" data-a="exMenuGo" data-v="exDetail:' + v + '">' + ic('info') + '動作說明、圖片與影片</button>' +
    '<button class="btn block" data-a="exMenuGo" data-v="editMachineNote:' + v + '">' + ic('edit') + '機台設定</button>' +
    '<button class="btn block" data-a="exMenuGo" data-v="swapEx:' + v + '">' + ic('swap') + '換動作</button>' +
    '<button class="btn block danger" data-a="exMenuGo" data-v="removeExFromSession:' + v + '">' + ic('trash') + '從今天移除</button>' +
    '<div class="small muted">點已完成的組可以修改重量、次數，或標記熱身組、力竭。</div></div>' }));
};
A.exMenuGo = v => { const [a, id] = v.split(':'); closeSheet('exmenu'); A[a](id); };

A.editSet = v => {
  const st = S.sets.find(x => x.id === v); const e = EXMAP[st.ex];
  openSheet('editset', () => ({
    title: '修改第 ' + (st.warm ? '熱身' : st.n) + ' 組・' + esc(e.name), body: '<div class="stack">' + (e.load !== 'time' ? '<div class="grid2"><label class="f">' + LOAD_LABEL[e.load] + '（kg）<input class="inp" id="es-w" inputmode="decimal" value="' + st.w + '"></label><label class="f">小片<input class="inp" id="es-a" inputmode="decimal" value="' + (st.add || 0) + '"></label></div>' : '') +
      '<label class="f">' + (e.load === 'time' ? '秒數' : '次數') + '<input class="inp" id="es-r" inputmode="numeric" value="' + st.reps + '"></label><label class="f">還能做幾下<select class="inp" id="es-rir"><option value="">未填</option>' + RIR_OPTS.map(([v2, l]) => '<option value="' + v2 + '"' + (st.rir === v2 ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<div class="row wrap"><button class="chip' + (st.warm ? ' on' : '') + '" data-a="esWarm">熱身組</button><button class="chip' + (st.fail ? ' on' : '') + '" data-a="esFail">做到力竭</button></div></div>',
    foot: '<button class="btn danger" data-a="delSet" data-v="' + v + '">刪除</button><button class="btn pri" data-a="saveEditSet" data-v="' + v + '">儲存</button>'
  }));
};
A.esWarm = (v, el) => el.classList.toggle('on');
A.esFail = (v, el) => el.classList.toggle('on');
A.saveEditSet = v => {
  const st = S.sets.find(x => x.id === v); const e = EXMAP[st.ex];
  if (e.load !== 'time') { st.w = parseFloat($('#es-w').value) || 0; st.add = parseFloat($('#es-a').value) || 0; st.tw = totalWeight(e, st.w, st.add, S); }
  st.reps = parseInt($('#es-r').value, 10) || st.reps; st.rir = $('#es-rir').value;
  const chips = $$('.sheet-wrap[data-sheet="editset"] .chip'); st.warm = chips[0].classList.contains('on'); st.fail = chips[1].classList.contains('on');
  delete st.pr; const pr = checkPR(S, e, st); if (pr) st.pr = pr;
  save(); closeSheet('editset'); rerender();
};
A.delSet = async v => { if (!(await confirmBox('刪除這一組？', '刪除', true))) return; S.sets = S.sets.filter(x => x.id !== v); save(); closeSheet('editset'); rerender(); };
A.editMachineNote = v => {
  const s = liveSession(); const u = exu(v);
  openSheet('mnote', () => ({ title: '機台設定・' + esc(EXMAP[v].name), body: '<div class="stack"><div class="small muted">座椅格數、椅背角度、握把位置、腿墊高度。只記在這間健身房。</div><textarea class="inp" id="mnote2" placeholder="例如：座椅第 4 格、椅背第 3 格（約 30 度）">' + esc((u.notes || {})[s.gymId] || '') + '</textarea></div>', foot: '<button class="btn pri" data-a="saveMnote2" data-v="' + v + '">儲存</button>', after: w => $('#mnote2', w).focus() }));
};
A.saveMnote2 = v => { const s = liveSession(); const u = exu(v); u.notes = u.notes || {}; u.notes[s.gymId] = $('#mnote2').value.trim(); save(); closeSheet('mnote'); render(); toast('已記住機台設定'); };
A.saveMachineNote = v => { const g = activeGym(S); if (!g) return; const u = exu(v); u.notes = u.notes || {}; u.notes[g.id] = $('#mnote').value.trim(); save(); toast('已儲存'); };
A.swapEx = v => {
  const s = liveSession(); const e = EXMAP[v];
  UI.pickQ = '';
  openSheet('pick', sheetPickEx('換掉「' + e.name + '」', x => x.id !== v && x.pri[0] === e.pri[0] && !s.plan.includes(x.id), async nid => {
    s.plan[s.plan.indexOf(v)] = nid; s.psets = s.psets || {}; s.psets[nid] = s.psets[v] || 0; UI.openEx = nid; save(); closeSheet('pick');
    const keep = await confirmBox('以後的' + DAY_NAME[s.day] + '也用「' + EXMAP[nid].name + '」取代「' + e.name + '」嗎？', '設為預設');
    if (keep) { const tpl = S.settings.templates[s.day]; for (const slot of tpl) { const L = slotIds(slot); const i = L.indexOf(v); if (i >= 0) { L.splice(i, 1); const j = L.indexOf(nid); if (j >= 0) L.splice(j, 1); L.unshift(nid); slot.ids = L; break; } } save(); toast('已更新課表'); }
    render();
  }));
};
A.pickEx = v => { const fn = UI.pickFn; if (fn) fn(v); };
A.addExToSession = () => {
  const s = liveSession(); UI.pickQ = '';
  openSheet('pick', sheetPickEx('加入動作', x => !s.plan.includes(x.id), nid => { s.plan.push(nid); UI.openEx = nid; save(); closeSheet('pick'); render(); setTimeout(() => { const el = document.getElementById('ex-' + nid); if (el) el.scrollIntoView({ block: 'start' }); }, 50); }));
};
A.removeExFromSession = async v => {
  const s = liveSession(); const has = S.sets.some(x => x.sid === s.id && x.ex === v);
  if (has && !(await confirmBox('這個動作已經有紀錄，移除會一起刪掉這次的組數。確定？', '移除', true))) return;
  s.plan = s.plan.filter(x => x !== v); S.sets = S.sets.filter(x => !(x.sid === s.id && x.ex === v)); save(); render();
};
A.finishSession = async () => {
  const s = liveSession(); const sets = S.sets.filter(x => x.sid === s.id && !x.warm);
  if (!sets.length) { if (await confirmBox('這次還沒有記錄任何工作組，要放棄這次訓練嗎？', '放棄', true)) { S.sessions = S.sessions.filter(x => x !== s); save(); render(); } return; }
  const left = s.plan.filter(id => !(s.done || {})[id] && S.sets.filter(x => x.sid === s.id && x.ex === id && !x.warm).length < sessionRx(S, s, EXMAP[id]).sets);
  let mode = 'done';
  if (left.length) {
    mode = await choiceBox('還有 ' + left.length + ' 個動作沒做完：' + left.map(id => esc(EXMAP[id].name)).join('、') + '。', [
      { label: '繼續訓練', v: null },
      { label: '結束，算' + DAY_NAME[s.day] + '練完了', sub: '保存紀錄，下一次換下一天', v: 'done', cls: 'pri' },
      { label: '結束，下次再練一次' + DAY_NAME[s.day], sub: '保存已做的組數，但循環不往前（身體不舒服、時間不夠時用）', v: 'partial' }
    ]);
    if (!mode) return;
  }
  s.end = new Date().toTimeString().slice(0, 5); s.endTs = Date.now();
  if (mode === 'partial') { s.partial = true; toast('已保存，下次還是' + DAY_NAME[s.day]); } else advanceCycle(S, s.date);
  stopTimer(); save(); scheduleSync(800);
  openSheet('summary', sheetSummary(s.id)); render();
};
A.cancelSession = async () => { if (!(await confirmBox('放棄這次紀錄？已記錄的組數會全部刪除。', '放棄', true))) return; const s = liveSession(); S.sets = S.sets.filter(x => x.sid !== s.id); S.sessions = S.sessions.filter(x => x !== s); stopTimer(); save(); render(); };
function sheetSummary(sid) {
  return () => {
    const s = sessionById(S, sid); const sets = S.sets.filter(x => x.sid === sid && !x.warm);
    let vol = 0; for (const st of sets) { const e = EXMAP[st.ex]; if (e) vol += setVolume(e, st, S); }
    const mins = s.endTs && s.startTs ? Math.round((s.endTs - s.startTs) / 60000) : null;
    const prs = sets.filter(x => x.pr);
    const byEx = {}; for (const st of S.sets.filter(x => x.sid === sid)) (byEx[st.ex] = byEx[st.ex] || []).push(st);
    let b = '<div class="stack"><div class="kpi">' + kpi('組數', sets.length) + kpi('容量', Math.round(vol).toLocaleString() + ' kg') + kpi('時間', mins != null ? mins + ' 分鐘' : s.start + '–' + (s.end || '')) + kpi('破紀錄', prs.length + ' 個') + '</div>';
    if (prs.length) b += '<div class="note" style="border-color:var(--red)">' + prs.map(x => '<div>' + ic('star') + ' ' + esc(EXMAP[x.ex].name) + '：' + fmtSet(EXMAP[x.ex], x) + '（' + esc(x.pr) + '）</div>').join('') + '</div>';
    b += '<div class="card"><div class="list">' + Object.keys(byEx).map(id => '<div class="li"><div class="grow"><div class="t">' + esc(EXMAP[id] ? EXMAP[id].name : id) + '</div><div class="small muted">' + byEx[id].sort((a, b2) => a.n - b2.n).map(st => (st.warm ? '熱 ' : '') + fmtSet(EXMAP[id], st)).join('、') + '</div></div></div>').join('') + '</div></div>';
    if (s.end && UI.sheets.some(x => x.id === 'summary')) b += '<div class="note brass">下一次：' + DAY_NAME[ORDER[S.settings.cycle.idx]] + (ORDER[S.settings.cycle.idx] === 'rest' ? '，之後是推日' : '') + '。記得練完 2 小時內補蛋白質。</div>';
    b += '<button class="btn danger block" data-a="delSession" data-v="' + sid + '">刪除這次訓練</button></div>';
    return { title: DAY_NAME[s.day] + '・' + mdLabel(s.date), body: b };
  };
}
A.sessionDetail = v => openSheet('summary2', sheetSummary(v));
A.delSession = async v => { if (!(await confirmBox('刪除這次訓練的所有紀錄？（循環進度不會倒退，需要的話到設定 → 循環進度校正）', '刪除', true))) return; S.sets = S.sets.filter(x => x.sid !== v); S.sessions = S.sessions.filter(x => x.id !== v); save(); UI.sheets = UI.sheets.filter(x => !x.id.startsWith('summary')); drawSheets(); render(); };
A.addCardio = () => openSheet('cardio', () => ({ title: '記錄有氧', body: '<div class="stack"><label class="f">種類<select class="inp" id="c-type">' + ['跑步機快走', '跑步機慢跑', '飛輪', '划船機', '橢圓機', '戶外走路', '其他'].map(x => '<option>' + x + '</option>').join('') + '</select></label><div class="grid3"><label class="f">分鐘<input class="inp" id="c-min" inputmode="numeric"></label><label class="f">速度<input class="inp" id="c-sp" inputmode="decimal" placeholder="km/h"></label><label class="f">坡度<input class="inp" id="c-in" inputmode="decimal" placeholder="%"></label></div><div class="small muted">有氧消耗不會加回可吃的熱量，體重趨勢會自動反映。</div></div>', foot: '<button class="btn pri" data-a="saveCardio">儲存</button>' }));
A.saveCardio = () => { const m = parseInt($('#c-min').value, 10); if (!m) { toast('請輸入分鐘'); return; } S.cardio.push({ id: uid(), date: todayStr(), type: $('#c-type').value, min: m, speed: $('#c-sp').value, incline: $('#c-in').value }); save(); closeSheet('cardio'); render(); };
A.delCardio = async v => { if (!(await confirmBox('刪除這筆有氧紀錄？', '刪除', true))) return; S.cardio = S.cardio.filter(x => x.id !== v); save(); render(); };

/* 動作詳情 */
A.exDetail = v => openSheet('ex:' + v, sheetExDetail(v));
A.addVideo = v => {
  let url = $('#vurl').value.trim(); const note = $('#vnote').value.trim();
  const m = url.match(/https?:\/\/\S+/); if (m) url = m[0];
  if (!/^https?:\/\//.test(url)) { toast('請貼上以 http 開頭的連結'); return; }
  const u = exu(v); u.videos = u.videos || []; u.videos.push({ url, note, added: todayStr() }); save(); toast('已加入影片'); refreshSheet('ex:' + v);
};
A.delVideo = async v => { const [id, i] = v.split(':'); if (!(await confirmBox('刪除這支影片連結？', '刪除', true))) return; exu(id).videos.splice(+i, 1); save(); refreshSheet('ex:' + id); };
A.delExPhoto = async v => { const u = exu(v); if (u.photo) await Store.del('img:' + u.photo); u.photo = null; save(); rerender(); };
A.setPain = v => { const u = exu(v); u.pain = { date: todayStr(), note: ($('#painnote') || {}).value || '' }; save(); toast('已標記，課表會優先換成替代動作'); rerender(); };
A.clearPain = v => { exu(v).pain = null; save(); rerender(); };
A.customEx = () => {
  UI.cx = { name: '', mach: '', day: 'push', load: 'stack', pri: 'chest', t: 'i' };
  openSheet('customex', () => {
    const c = UI.cx;
    return {
      title: '自訂動作', body: '<div class="stack"><label class="f">動作名稱<input class="inp" id="cx-name" value="' + esc(c.name) + '" placeholder="例如：側平舉機"></label><label class="f">機台／器材<input class="inp" id="cx-mach" value="' + esc(c.mach) + '" placeholder="例如：側平舉機"></label>' +
        '<label class="f">哪一天<select class="inp" id="cx-day">' + ['push', 'pull', 'legs'].map(d => '<option value="' + d + '"' + (c.day === d ? ' selected' : '') + '>' + DAY_NAME[d] + '</option>').join('') + '</select></label>' +
        '<label class="f">主要肌群<select class="inp" id="cx-pri">' + Object.keys(MUSCLE_NAME).map(m => '<option value="' + m + '"' + (c.pri === m ? ' selected' : '') + '>' + MUSCLE_NAME[m] + '</option>').join('') + '</select></label>' +
        '<label class="f">重量怎麼記<select class="inp" id="cx-load">' + Object.keys(LOAD_HELP).map(k => '<option value="' + k + '"' + (c.load === k ? ' selected' : '') + '>' + LOAD_HELP[k] + '</option>').join('') + '</select></label>' +
        '<label class="f">類型<select class="inp" id="cx-t"><option value="c">複合動作（多關節，例如推、拉、蹲）</option><option value="i" selected>孤立動作（單關節，例如彎舉、側平舉）</option></select></label><div class="small muted">建立後可以在動作頁加入照片和教學影片。</div></div>',
      foot: '<button class="btn pri" data-a="saveCustomEx">建立</button>'
    };
  });
};
A.saveCustomEx = () => {
  const name = $('#cx-name').value.trim(); if (!name) { toast('請輸入名稱'); return; }
  const e = { id: 'cx_' + uid(), name, mach: $('#cx-mach').value.trim() || '自訂', day: $('#cx-day').value, eq: [], load: $('#cx-load').value, pri: [$('#cx-pri').value], sec: [], t: $('#cx-t').value, img: '', cues: ['自訂動作：可以在下方加入你的教學影片和照片'], custom: true };
  S.customEx.push(e); buildExMap(S); save(); closeSheet('customex'); render(); A.exDetail(e.id);
};
A.delCustomEx = async v => {
  if (S.sets.some(x => x.ex === v) && !(await confirmBox('這個動作有訓練紀錄，刪除後紀錄會一起刪掉。確定？', '刪除', true))) return;
  S.customEx = S.customEx.filter(x => x.id !== v); S.sets = S.sets.filter(x => x.ex !== v);
  for (const d of ['push', 'pull', 'legs']) S.settings.templates[d] = S.settings.templates[d].map(sl => ({ ids: slotIds(sl).filter(x => x !== v), sets: sl.sets || 0 })).filter(sl => sl.ids.length);
  delete (S.rxu || {})[v];
  buildExMap(S); save(); closeSheet('ex:' + v); render();
};
A.libDay = v => { UI.libDay = v; render(); };
A.libMine = () => { UI.libMine = !UI.libMine; render(); };

/* 飲食 */
A.foodDay = v => { const d = UI.foodDate || todayStr(); const n = addDays(d, +v); if (n > todayStr()) return; UI.foodDate = n; render(); };
A.foodToday = () => { UI.foodDate = null; render(); };
A.addFood = v => { UI.foodTab = 'fav'; UI.foodQ = ''; openSheet('addfood', sheetAddFood(v)); };
A.foodTab = v => { UI.foodTab = v; refreshSheet('addfood'); };
A.pickFood = (v, el) => {
  let f = allFoods(S).find(x => x.id === v);
  if (!f && v.startsWith('log:')) { const x = S.foodlog.find(l => 'log:' + l.id === v); if (x) f = { id: null, name: x.name, unit: x.unit, kcal: x.kcal / x.qty, p: x.p / x.qty, c: x.c / x.qty, f: x.f / x.qty }; }
  if (!f) return;
  UI.qty = 1; UI.qtyFood = f; UI.qtyMeal = el.dataset.meal;
  openSheet('qty', sheetQty(f, el.dataset.meal));
};
A.qty = v => { const i = $('#qty'); UI.qty = Math.max(0.5, r05((parseFloat(i.value) || 1) + (+v))); refreshSheet('qty'); };
A.qtySet = v => { UI.qty = +v; refreshSheet('qty'); };
A.confirmFood = () => { const q = parseFloat($('#qty').value) || UI.qty; logFood(UI.foodDate || todayStr(), UI.qtyMeal, UI.qtyFood, q); closeSheet('qty'); closeSheet('addfood'); toast('已加入'); render(); };
A.editLog = v => {
  const x = S.foodlog.find(l => l.id === v); UI.qty = x.qty;
  const f = { name: x.name, unit: x.unit, kcal: x.kcal / x.qty, p: x.p / x.qty, c: x.c / x.qty, f: x.f / x.qty };
  openSheet('qty', sheetQty(f, x.meal, v));
};
A.saveLog = v => {
  const x = S.foodlog.find(l => l.id === v); const q = parseFloat($('#qty').value) || x.qty; const k = q / x.qty;
  x.kcal = r1(x.kcal * k); x.p = r1(x.p * k); x.c = r1(x.c * k); x.f = r1(x.f * k); x.qty = q; x.meal = $('#mealSel').value; save(); closeSheet('qty'); render();
};
A.delLog = v => { S.foodlog = S.foodlog.filter(l => l.id !== v); save(); closeSheet('qty'); render(); toast('已刪除'); };
A.favFood = v => { const L = S.settings.favFoods; const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else L.push(v); save(); refreshSheet('addfood'); toast(i >= 0 ? '已從常用移除' : '已加入常用'); };
A.copyMeal = v => {
  const [m, d] = v.split(':'); const to = UI.foodDate || todayStr();
  for (const x of S.foodlog.filter(l => l.meal === m && l.date === d)) S.foodlog.push(Object.assign({}, x, { id: uid(), date: to, t: Date.now() }));
  save(); closeSheet('addfood'); render(); toast('已複製');
};
A.addShakeTo = v => { logFood(UI.foodDate || todayStr(), v, shakeFood(), 1); closeSheet('addfood'); render(); toast('已加入高蛋白'); };
A.quickAdd = m => {
  const k = parseFloat($('#q-k').value), p = parseFloat($('#q-p').value) || 0;
  if (!(k > 0)) { toast('請輸入熱量'); return; }
  logFood(UI.foodDate || todayStr(), m, { name: $('#q-name').value.trim() || '快速輸入', unit: '份', kcal: k, p, c: parseFloat($('#q-c').value) || 0, f: parseFloat($('#q-f').value) || 0 }, 1);
  closeSheet('addfood'); render(); toast('已加入');
};
A.newFood = m => {
  const name = $('#n-name').value.trim(); const k = parseFloat($('#n-k').value);
  if (!name || !(k >= 0)) { toast('請輸入名稱和熱量'); return; }
  const f = { id: 'u' + uid(), name, unit: $('#n-unit').value.trim() || '1 份', kcal: k, p: parseFloat($('#n-p').value) || 0, c: parseFloat($('#n-c').value) || 0, f: parseFloat($('#n-f').value) || 0, src: 'u' };
  S.foods.push(f); S.settings.favFoods.push(f.id); logFood(UI.foodDate || todayStr(), m, f, 1); closeSheet('addfood'); render(); toast('已儲存並加入');
};

/* 進度 */
A.progSeg = v => { UI.progSeg = v; render(); };
A.addMeasure = () => openSheet('measure', () => ({ title: '身體圍度（cm）', body: '<div class="stack"><div class="small muted">軟尺貼著皮膚、不要勒緊。腰圍量肚臍高度，手臂量放鬆時最粗處，胸圍量乳頭高度，大腿量最粗處。只量有空的也可以。</div><div class="grid2">' + [['waist', '腰圍'], ['arm', '手臂'], ['chest', '胸圍'], ['thigh', '大腿']].map(([k, l]) => '<label class="f">' + l + '<input class="inp" id="m-' + k + '" inputmode="decimal"></label>').join('') + '</div></div>', foot: '<button class="btn pri" data-a="saveMeasure">儲存</button>' }));
A.saveMeasure = () => { const m = { id: uid(), date: todayStr() }; let any = false; for (const k of ['waist', 'arm', 'chest', 'thigh']) { const v = parseFloat($('#m-' + k).value); if (v > 0) { m[k] = r1(v); any = true; } } if (!any) { toast('至少填一項'); return; } S.measures.push(m); save(); closeSheet('measure'); render(); };
A.delMeasure = async v => { if (!(await confirmBox('刪除這筆圍度紀錄？', '刪除', true))) return; S.measures = S.measures.filter(x => x.id !== v); save(); render(); };
A.viewPhoto = v => {
  const p = S.photos.find(x => x.id === v);
  openSheet('photo', () => ({ title: p.pose + '・' + mdLabel(p.date), body: '<img data-imgkey="' + p.key + '" alt="' + p.pose + '" style="width:100%;border-radius:12px">', foot: '<button class="btn danger" data-a="delPhoto" data-v="' + v + '">刪除</button><button class="btn" data-a="closeSheet">關閉</button>' }));
};
A.delPhoto = async v => { if (!(await confirmBox('刪除這張照片？', '刪除', true))) return; const p = S.photos.find(x => x.id === v); await Store.del('img:' + p.key); S.photos = S.photos.filter(x => x.id !== v); save(); closeSheet('photo'); render(); };
A.comparePhotos = () => {
  const ds = [...new Set(S.photos.map(p => p.date))].sort();
  UI.cmp = UI.cmp || { a: ds[0], b: ds[ds.length - 1], pose: '正面' };
  openSheet('cmp', () => {
    const c = UI.cmp; const pa = S.photos.find(p => p.date === c.a && p.pose === c.pose), pb = S.photos.find(p => p.date === c.b && p.pose === c.pose);
    const sel = id => '<select class="inp" id="' + id + '">' + ds.map(d => '<option value="' + d + '"' + (c[id === 'cmp-a' ? 'a' : 'b'] === d ? ' selected' : '') + '>' + mdLabel(d) + '</option>').join('') + '</select>';
    return { title: '照片比較', body: '<div class="stack"><div class="chips">' + ['正面', '側面', '背面', '正面二頭', '背面二頭'].map(p => '<button class="chip' + (c.pose === p ? ' on' : '') + '" data-a="cmpPose" data-v="' + p + '">' + p + '</button>').join('') + '</div><div class="grid2">' + sel('cmp-a') + sel('cmp-b') + '</div><div class="grid2">' + [pa, pb].map(p => p ? '<img data-imgkey="' + p.key + '" alt="" style="width:100%;border-radius:10px;aspect-ratio:3/4;object-fit:cover">' : '<div class="empty" style="aspect-ratio:3/4;background:var(--s2);border-radius:10px;display:grid;place-items:center">這天沒有' + c.pose + '</div>').join('') + '</div></div>', after: w => { $$('select', w).forEach(s => s.onchange = () => { UI.cmp[s.id === 'cmp-a' ? 'a' : 'b'] = s.value; refreshSheet('cmp'); }); } };
  });
};
A.cmpPose = v => { UI.cmp.pose = v; refreshSheet('cmp'); };
A.aiCopy = async () => {
  const txt = aiSummary(S);
  openSheet('ai', () => ({ title: '給 AI 的摘要', body: '<div class="stack"><div class="small muted">已嘗試複製。如果沒有複製成功，長按下面的文字全選複製。貼到 Claude 後，在最後打上你的問題。</div><textarea class="inp" id="ai-t" style="min-height:300px" readonly>' + esc(txt) + '</textarea></div>', foot: '<button class="btn pri" data-a="aiCopy2">' + ic('copy') + '再複製一次</button>' }));
  copyText(txt, '#ai-t');
};
A.aiCopy2 = () => copyText($('#ai-t').value, '#ai-t');
async function copyText(txt, sel) {
  try { await navigator.clipboard.writeText(txt); toast('已複製'); }
  catch (e) { const t = $(sel); if (t) { t.style.display = ''; t.focus(); t.select(); } toast('請長按文字手動複製'); }
}

/* 設定動作 */
A.pSet = (v, el) => { S.profile[el.dataset.k] = v; save(); refreshSheet('profile'); };
A.saveProfile = () => {
  const p = S.profile; p.birthYear = +$('#p-by').value || p.birthYear; p.height = +$('#p-h').value || p.height; p.goal = $('#p-goal').value; p.act = +$('#p-act').value;
  const t = calcTargets(p, bodyKg(S)); S.targets.push(Object.assign({ date: todayStr(), reason: '修改個人資料（公式）' }, t)); save(); toast('目標 ' + t.kcal + ' 大卡'); rerender();
};
A.saveManualTarget = () => {
  const k = +$('#t-k').value, p = +$('#t-p').value; if (!(k > 800) || !(p > 20)) { toast('請輸入合理的數字'); return; }
  const f = Math.max(Math.round(k * 0.27 / 9), Math.round(bodyKg(S) * 0.6)); const c = Math.max(0, Math.round((k - p * 4 - f * 9) / 4));
  const cur = currentTarget(S); S.targets.push({ date: todayStr(), reason: '手動調整', tdee: cur ? cur.tdee : null, kcal: Math.round(k), p: Math.round(p), f, c }); save(); toast('已儲存'); rerender();
};
A.gymActive = v => { S.settings.activeGym = v; save(); rerender(); toast('已切換健身房'); };
A.gymEquip = v => openSheet('equip', sheetEquip(v));
A.gymAdd = () => {
  const g = { id: uid(), name: '新的健身房', equip: [] }; S.gyms.push(g); save();
  openSheet('gymname', sheetGymName(g.id, true));
};
function sheetGymName(id, isNew) { return () => ({ title: isNew ? '新增健身房' : '改名', body: '<label class="f">名稱<input class="inp" id="gname" value="' + esc(S.gyms.find(x => x.id === id).name) + '"></label>', foot: '<button class="btn pri" data-a="saveGymName" data-v="' + id + ':' + (isNew ? 1 : 0) + '">' + (isNew ? '下一步：勾選器材' : '儲存') + '</button>', after: w => $('#gname', w).select() }); }
A.gymRename = v => openSheet('gymname', sheetGymName(v, false));
A.saveGymName = v => {
  const [id, isNew] = v.split(':'); const g = S.gyms.find(x => x.id === id); g.name = $('#gname').value.trim() || g.name; save(); closeSheet('gymname'); refreshSheet('gyms');
  if (isNew === '1') { S.settings.activeGym = id; save(); refreshSheet('gyms'); openSheet('equip', sheetEquip(id)); toast('已切換到 ' + g.name); }
};
A.gymDel = async v => { if (!(await confirmBox('刪除這間健身房？訓練紀錄會保留。', '刪除', true))) return; S.gyms = S.gyms.filter(g => g.id !== v); if (S.settings.activeGym === v) S.settings.activeGym = S.gyms[0].id; save(); refreshSheet('gyms'); };
A.tplMove = v => { const [d, i] = v.split(':'); const L = S.settings.templates[d]; const k = +i; if (k > 0) { [L[k - 1], L[k]] = [L[k], L[k - 1]]; save(); refreshSheet('tpl'); } };
A.tplDel = async v => { const [d, i] = v.split(':'); const e = EXMAP[slotIds(S.settings.templates[d][+i])[0]]; if (!(await confirmBox('從' + DAY_NAME[d] + '移除「' + (e ? e.name : '') + '」？', '移除', true))) return; S.settings.templates[d].splice(+i, 1); save(); refreshSheet('tpl'); };
A.tplRx = v => { const [d, i] = v.split(':'); const id = slotIds(S.settings.templates[d][+i])[0]; openSheet('rx', sheetRxEdit(id, { d, i: +i })); };
A.exRx = v => openSheet('rx', sheetRxEdit(v, null));
A.rxStep = v => { const [k, n] = v.split(':'); const el = $('#rx-' + k); el.value = Math.max(1, Math.min(8, (parseInt(el.value, 10) || 0) + (+n))); };
A.rxRest = (v, el) => { $('#rx-rest').value = v; $$('[data-a="rxRest"]').forEach(c => c.classList.toggle('on', c === el)); };
A.rxSave = v => {
  const [id, d, i] = v.split(':'); const lo = parseInt($('#rx-lo').value, 10), hi = parseInt($('#rx-hi').value, 10), rest = parseInt($('#rx-rest').value, 10);
  const warn = t => { $('#rx-warn').innerHTML = '<div class="note warn small">' + t + '</div>'; };
  if (!(lo > 0) || !(hi >= lo)) return warn('最多次數要大於或等於最少次數');
  if (!(rest >= 15 && rest <= 600)) return warn('休息時間請填 15–600 秒');
  S.rxu = S.rxu || {}; const d0 = DATA.rx[id] || []; const u = {};
  if (lo !== d0[1]) u.lo = lo; if (hi !== d0[2]) u.hi = hi; if (rest !== d0[5]) u.rest = rest;
  if (Object.keys(u).length) S.rxu[id] = u; else delete S.rxu[id];
  if (d) { const sets = parseInt($('#rx-sets').value, 10); if (sets > 0 && sets <= 8) S.settings.templates[d][+i].sets = sets; }
  save(); closeSheet('rx'); rerender(); toast('已儲存');
};
A.rxDefault = v => {
  const [id, d, i] = v.split(':'); delete (S.rxu || {})[id];
  if (d) { const def = (DATA.templates[d] || []).find(sl => sl.ids[0] === id); S.settings.templates[d][+i].sets = def ? def.sets : 0; }
  save(); closeSheet('rx'); rerender(); toast('已恢復預設');
};
A.tplSwap = v => {
  const [d, i] = v.split(':'); const slot = S.settings.templates[d][+i]; UI.pickQ = '';
  openSheet('pick', sheetPickEx('換成', x => x.id !== slotIds(slot)[0], nid => { S.settings.templates[d][+i] = { ids: [nid].concat(slotIds(slot).filter(x => x !== nid)), sets: 0 }; save(); closeSheet('pick'); refreshSheet('tpl'); }));
};
A.tplAdd = d => { UI.pickQ = ''; openSheet('pick', sheetPickEx('加入' + DAY_NAME[d], x => !S.settings.templates[d].some(sl => slotIds(sl)[0] === x.id), nid => { S.settings.templates[d].push({ ids: [nid], sets: 0 }); save(); closeSheet('pick'); refreshSheet('tpl'); toast('已加入，可以按「調整」改組數'); })); };
A.tplReset = async () => { if (!(await confirmBox('恢復預設課表？你自己的修改會被取代。', '恢復', true))) return; S.settings.templates = defaultTemplates(); S.settings.tplUpgraded = false; save(); refreshSheet('tpl'); };
A.cycSet = v => { const c = S.settings.cycle; c.idx = ORDER.indexOf(v); c.restOn = null; save(); rerender(); };
A.cycRound = () => { const r = parseInt($('#cyc-r').value, 10); if (r > 0) { S.settings.cycle.round = r; save(); rerender(); toast('已儲存'); } };
A.togPrefer = () => { S.settings.preferMachines = !S.settings.preferMachines; save(); refreshSheet('training'); };
A.saveTraining = () => { const b = parseFloat($('#ts-bar').value); if (b >= 0 && b <= 40) S.settings.barKg = b; save(); closeSheet('training'); refreshSheet('settings'); toast('已儲存'); };
A.togHas = () => { S.supp.has = !S.supp.has; save(); refreshSheet('supp'); };
A.togOutdoor = () => { S.settings.outdoorWork = !S.settings.outdoorWork; save(); refreshSheet('supp'); };
A.saveSupp = () => {
  const s = S.supp; const n = id => parseFloat($(id).value);
  s.name = $('#s-name').value.trim() || '高蛋白'; s.scoopG = n('#s-g') || s.scoopG; s.kcal = n('#s-k') || 0; s.p = n('#s-p') || 0; s.c = n('#s-c') || 0; s.f = n('#s-f') || 0; s.milkMl = Math.max(0, n('#s-milk') || 0);
  S.profile.creatineStart = $('#s-cs').value || null;
  const wg = parseInt($('#s-wg').value, 10); S.settings.waterGoalManual = wg > 500 ? wg : null;
  save(); closeSheet('supp'); refreshSheet('settings'); render(); toast('已儲存');
};

/* 備份 */
async function buildExport() {
  const images = {};
  const keys = await Store.keys();
  for (const k of keys) if (String(k).startsWith('img:')) images[k] = await Store.get(k);
  return JSON.stringify({ app: 'lianggongbu', version: 1, exported: new Date().toISOString(), state: S, images });
}
A.exportFile = async () => {
  const txt = await buildExport();
  const fname = 'training-backup-' + todayStr() + '.json';
  if (window.claude && window.claude.use) {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch (e) { }
    if (dl) {
      try { await dl.save({ filename: fname, data: new Blob([txt], { type: 'application/json' }) }); S.settings.lastBackup = new Date().toISOString(); save(); toast('備份檔已儲存'); }
      catch (e) { toast(e && e.code === 'declined' ? '已取消下載' : '下載沒有成功，請改用複製備份文字'); }
      return;
    }
  }
  try {
    const blob = new Blob([txt], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    S.settings.lastBackup = new Date().toISOString(); save(); toast('已產生備份檔。如果沒有下載，改用複製備份文字');
  } catch (e) { toast('下載失敗，請用複製備份文字'); }
};
A.exportCopy = async () => {
  const txt = await buildExport(); const t = $('#bk-out'); t.value = txt; t.style.display = '';
  S.settings.lastBackup = new Date().toISOString(); save();
  copyText(txt, '#bk-out');
};
A.importText = () => doImport($('#bk-in').value);
async function doImport(txt) {
  let d; try { d = JSON.parse(txt); } catch (e) { toast('看不懂這個備份，請確認是完整的備份文字'); return; }
  if (!d || d.app !== 'lianggongbu' || !d.state) { toast('這不是 Training 的備份'); return; }
  const n = (d.state.sets || []).length;
  if (!(await confirmBox('還原備份（' + (d.exported || '').slice(0, 10) + '，' + n + ' 組訓練紀錄）？目前手機上的資料會被取代。', '還原', true))) return;
  for (const k in (d.images || {})) await Store.set(k, d.images[k]);
  S = migrate(d.state); buildExMap(S); await saveNow();
  UI.sheets = []; drawSheets(); UI.tab = 'today'; render(); toast('還原完成');
}

/* ===== 休息計時 ===== */
let TM = null, audioCtx = null;
function ensureAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { } }
function beep() { try { ensureAudio(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.25, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6); o.start(); o.stop(audioCtx.currentTime + 0.6); } catch (e) { } try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { } }
function startTimer(sec) { TM = { end: Date.now() + sec * 1000, beeped: false }; drawTimer(); }
function stopTimer() { TM = null; drawTimer(); }
function drawTimer() {
  const el = $('#timer');
  if (!TM) { el.hidden = true; el.innerHTML = ''; return; }
  const left = Math.round((TM.end - Date.now()) / 1000);
  if (left <= 0 && !TM.beeped) { TM.beeped = true; beep(); }
  if (left < -60) { stopTimer(); return; }
  el.hidden = false; el.className = left <= 0 ? 'done' : '';
  const a = Math.abs(left); const t = (left < 0 ? '+' : '') + Math.floor(a / 60) + ':' + pad2(a % 60);
  el.innerHTML = '<div class="in">' + ic('clock') + '<span class="t">' + t + '</span><span class="small muted grow tl">' + (left > 0 ? '組間休息' : '可以做下一組了') + '</span><button class="btn sm" data-a="tmAdd" data-v="-15">−15</button><button class="btn sm" data-a="tmAdd" data-v="15">+15</button><button class="btn sm ghost" data-a="tmStop" aria-label="關閉計時">' + ic('x') + '</button></div>';
}
A.tmAdd = v => { if (TM) { TM.end += (+v) * 1000; TM.beeped = false; drawTimer(); } };
A.tmStop = () => stopTimer();
setInterval(() => { if (TM) drawTimer(); }, 1000);

/* ===== 雲端設定畫面 ===== */
function sheetCloud() {
  const c = SYNC.cfg || {}; const m = SYNC.meta || {};
  let b = '<div class="stack">';
  if (!IS_PAGES) b += '<div class="note warn">雲端同步只能在正式版（你的 GitHub 網址）使用。這個試用頁面的安全限制會擋住連線。</div>';
  if (SYNC.cfg) {
    b += '<div class="card"><div class="row between"><h2 style="margin:0">狀態</h2>' + syncBadgeHtml() + '</div>' +
      '<div class="kpi" style="margin-top:10px">' + kpi('上次同步', m.last ? (new Date(m.last).getMonth() + 1) + '/' + new Date(m.last).getDate() + ' ' + new Date(m.last).toTimeString().slice(0, 5) : '還沒有') + kpi('待上傳', SYNC.pending + ' 筆') + '</div>' +
      (m.err ? '<div class="note warn small" style="margin-top:10px">' + esc(m.err) + '</div>' : '') +
      '<button class="btn pri block" style="margin-top:12px" data-a="cloudSync"' + (SYNC.busy ? ' disabled' : '') + '>' + ic('cloud') + (SYNC.busy ? '同步中…' : '立即同步') + '</button></div>';
    b += '<div class="small muted">自動同步時機：打開 App、完成訓練、App 切到背景，以及有變動後約 45 秒。只會上傳有變動的紀錄。</div>';
  }
  b += '<div class="card"><h2>' + (SYNC.cfg ? '連線設定' : '連接 Google 雲端') + '</h2>' +
    '<label class="f">Apps Script 網址<input class="inp" id="cl-url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url || '') + '"' + (IS_PAGES ? '' : ' disabled') + '></label>' +
    '<label class="f" style="margin-top:10px">密碼（跟 Apps Script 裡的 KEY 一樣）<input class="inp" id="cl-key" value="' + esc(c.key || '') + '" autocomplete="off"' + (IS_PAGES ? '' : ' disabled') + '></label>' +
    '<div id="cl-msg"></div><button class="btn block" style="margin-top:12px" data-a="cloudConnect"' + (IS_PAGES ? '' : ' disabled') + '>' + (SYNC.cfg ? '儲存並測試' : '連線並同步') + '</button></div>';
  if (SYNC.cfg) b += '<div class="card"><h2>進階</h2><div class="stack" style="gap:8px"><button class="btn" data-a="cloudResync">重新比對全部資料</button><div class="xs muted">從頭比對雲端和手機，只會補上缺的、不會刪資料。換過雲端試算表或同步怪怪的時候用。</div><button class="btn danger" data-a="cloudOff">中斷雲端連線</button><div class="xs muted">只是停止同步，手機和雲端的資料都會保留。</div></div></div>';
  b += '<div class="card"><h2>資料怎麼存</h2><ol class="cues small"><li>手機是主資料，在健身房沒網路也能記</li><li>Google 試算表是逐筆備份，只傳有變動的紀錄</li><li>你拍的照片存在你 Google 雲端硬碟的「Training 照片」資料夾，每張只傳一次</li><li>換手機：新手機第一個畫面選「從雲端還原」</li></ol></div>';
  return { title: '雲端同步', body: b + '</div>' };
}
A.cloud = () => openSheet('cloud', sheetCloud);
A.cloudSync = async () => { const r = await syncNow(); if (r && !r.err && !r.skipped) toast('同步完成' + (r.pushed ? '，上傳 ' + r.pushed + ' 筆' : '') + (r.pulled ? '，下載 ' + r.pulled + ' 筆' : '')); else if (r && r.err) toast(r.err); };
A.cloudConnect = async () => {
  const url = $('#cl-url').value.trim(), key = $('#cl-key').value.trim(); const msg = $('#cl-msg');
  const say = (t, cls) => { msg.innerHTML = '<div class="note small ' + (cls || '') + '" style="margin-top:10px">' + t + '</div>'; };
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) && !/^http:\/\/localhost/.test(url)) return say('網址要是 https://script.google.com/macros/s/…/exec', 'warn');
  if (!key) return say('請輸入密碼', 'warn');
  const old = SYNC.cfg; SYNC.cfg = { url, key };
  if (!old || old.url !== url) SYNC.meta = Object.assign(blankMeta(), { dev: SYNC.meta.dev });
  say('連線中…');
  let rev;
  try { rev = (await syncApi('ping')).rev; } catch (e) { SYNC.cfg = old; return say(esc(e.message), 'warn'); }
  if (S.profile && rev > 0 && !SYNC.meta.connected) {
    if (!(await confirmBox('雲端已經有資料。手機和雲端的紀錄會合併，個人資料、課表、循環進度以雲端為準。繼續？', '合併'))) { SYNC.cfg = old; return say('已取消'); }
  }
  await Store.set('cloud', SYNC.cfg); await saveMeta();
  say('已連線，同步中…', 'ok');
  const r = await syncNow();
  if (r.err) return say(esc(r.err), 'warn');
  if (UI.ob && S.profile) { UI.ob = null; UI.sheets = []; drawSheets(); UI.tab = 'today'; render(); toast('已從雲端還原 ' + r.pulled + ' 筆資料'); return; }
  if (UI.ob && !S.profile) { say('雲端還沒有資料，請先完成設定。', 'warn'); return; }
  refreshSheet('cloud'); toast('已連線並同步');
};
A.cloudResync = async () => { SYNC.meta.cursor = 0; SYNC.meta.r = {}; SYNC.meta.h = {}; await saveMeta(); A.cloudSync(); };
A.cloudOff = async () => { if (!(await confirmBox('中斷雲端連線？手機和雲端的資料都會保留，之後可以重新連線。', '中斷', true))) return; SYNC.cfg = null; SYNC.status = 'off'; await Store.del('cloud'); refreshSheet('cloud'); drawSyncBadge(); };
A.obCloud = () => openSheet('cloud', sheetCloud);

/* ===== 掃條碼 ===== */
let ZX = null, ZXreader = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (ZX) return ZX;
  ZX = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = IS_PAGES ? 'lib/zxing.min.js' : 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    s.onload = () => window.ZXing ? res(window.ZXing) : rej(new Error('掃描元件載入失敗'));
    s.onerror = () => { ZX = null; rej(new Error('掃描元件載入失敗，請確認網路')); };
    document.head.appendChild(s);
  });
  return ZX;
}
function stopScan() { try { if (ZXreader) ZXreader.reset(); } catch (e) { } ZXreader = null; }
A.scanFood = meal => {
  UI.scanMeal = meal; UI.scanMsg = '';
  openSheet('scan', () => ({
    title: '掃條碼',
    body: '<div class="stack"><div class="scanbox"><video id="scanv" playsinline muted></video><div class="scanline"></div></div>' +
      '<div id="scanmsg" class="small muted">' + (UI.scanMsg || '把條碼對準框框中間') + '</div>' +
      '<label class="btn" style="position:relative">' + ic('camera') + '用拍照辨識<input type="file" accept="image/*" capture="environment" class="hidden-file" data-in="scanPhoto"></label>' +
      '<div class="row" style="gap:8px"><input class="inp grow" id="scancode" inputmode="numeric" placeholder="或輸入條碼數字"><button class="btn" data-a="scanManual">查詢</button></div>' +
      '<div class="xs muted">商品資料來自 Open Food Facts 免費資料庫。查不到的商品，照包裝輸入一次，下次掃就會直接帶出。</div></div>',
    after: () => startLiveScan()
  }));
};
async function startLiveScan() {
  const msg = t => { const el = $('#scanmsg'); if (el) el.textContent = t; };
  const v = $('#scanv'); if (!v || ZXreader) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('這裡不能開相機，請用「拍照辨識」或輸入數字'); return; }
  try {
    const Z = await loadZXing();
    ZXreader = new Z.BrowserMultiFormatReader();
    await ZXreader.decodeFromConstraints({ video: { facingMode: 'environment' } }, v, (r, err) => {
      if (r) { const code = r.getText(); stopScan(); lookupBarcode(code); }
    });
  } catch (e) { stopScan(); msg(e && e.name === 'NotAllowedError' ? '相機權限被拒絕，請用「拍照辨識」或輸入數字' : '相機無法使用，請用「拍照辨識」或輸入數字'); }
}
async function decodePhoto(file) {
  const msg = t => { const el = $('#scanmsg'); if (el) el.textContent = t; };
  msg('辨識中…');
  try {
    const Z = await loadZXing();
    const url = await fileToDataUrl(file, 1400, 0.92);
    const r = await new Z.BrowserMultiFormatReader().decodeFromImageUrl(url);
    stopScan(); lookupBarcode(r.getText());
  } catch (e) { msg('照片裡找不到條碼，請拍清楚一點，或輸入數字'); }
}
A.scanManual = () => { const c = ($('#scancode').value || '').replace(/\D/g, ''); if (c.length < 8) { toast('條碼通常是 8 或 13 位數字'); return; } stopScan(); lookupBarcode(c); };
async function lookupBarcode(code) {
  const meal = UI.scanMeal;
  const local = S.foods.find(f => f.barcode === code);
  if (local) { closeSheet('scan'); UI.qty = 1; UI.qtyFood = local; UI.qtyMeal = meal; openSheet('qty', sheetQty(local, meal)); return; }
  const el = $('#scanmsg'); if (el) el.textContent = '條碼 ' + code + '，查詢中…';
  let food = null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,product_name_zh,product_name_en,brands,nutriments,serving_size,serving_quantity', { signal: ctl.signal });
    clearTimeout(t);
    const d = await r.json();
    if (d && d.status === 1 && d.product) food = offToFood(d.product, code);
  } catch (e) { }
  closeSheet('scan');
  UI.bc = food ? Object.assign({ found: true }, food) : { found: false, barcode: code, name: '', unit: '', kcal: '', p: '', c: '', f: '' };
  openSheet('bcfood', sheetBarcodeFood(meal));
}
function offToFood(p, code) {
  const n = p.nutriments || {};
  const kcal100 = n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : (n.energy_100g != null ? +n.energy_100g / 4.184 : null);
  if (kcal100 == null || isNaN(kcal100)) return null;
  const name = [p.brands ? String(p.brands).split(',')[0].trim() : '', p.product_name_zh || p.product_name || p.product_name_en || '條碼 ' + code].filter(Boolean).join(' ');
  const sq = +p.serving_quantity;
  const per = sq > 0 ? sq / 100 : 1;
  return { barcode: code, name, unit: sq > 0 ? '1 份（' + (p.serving_size || sq + 'g') + '）' : '100g', kcal: r1(kcal100 * per), p: r1((+n.proteins_100g || 0) * per), c: r1((+n.carbohydrates_100g || 0) * per), f: r1((+n.fat_100g || 0) * per) };
}
function sheetBarcodeFood(meal) {
  return () => {
    const f = UI.bc; const mealName = MEALS.find(m => m[0] === meal)[1];
    return {
      title: f.found ? '找到商品' : '資料庫沒有這個商品',
      body: '<div class="stack">' + (f.found ? '<div class="note ok small">資料來自 Open Food Facts，請對照包裝確認數字，存下來之後這個條碼會直接帶出。</div>' : '<div class="note small">請照包裝的營養標示輸入一次（條碼 ' + esc(f.barcode) + '），下次掃就會直接帶出。澳洲包裝的 Energy 是 kJ，除以 4.184 就是大卡。</div>') +
        '<label class="f">名稱<input class="inp" id="bc-name" value="' + esc(f.name) + '"></label><label class="f">單位<input class="inp" id="bc-unit" value="' + esc(f.unit) + '" placeholder="例如：1 包、100g"></label>' +
        '<div class="grid2"><label class="f">熱量<input class="inp" id="bc-k" inputmode="decimal" value="' + esc(f.kcal) + '"></label><label class="f">蛋白質 g<input class="inp" id="bc-p" inputmode="decimal" value="' + esc(f.p) + '"></label><label class="f">碳水 g<input class="inp" id="bc-c" inputmode="decimal" value="' + esc(f.c) + '"></label><label class="f">脂肪 g<input class="inp" id="bc-f" inputmode="decimal" value="' + esc(f.f) + '"></label></div></div>',
      foot: '<button class="btn pri" data-a="saveBarcodeFood" data-v="' + meal + '">儲存並加入' + mealName + '</button>'
    };
  };
}
A.saveBarcodeFood = meal => {
  const name = $('#bc-name').value.trim(); const k = parseFloat($('#bc-k').value);
  if (!name || !(k >= 0)) { toast('請輸入名稱和熱量'); return; }
  const f = { id: 'u' + uid(), barcode: UI.bc.barcode, name, unit: $('#bc-unit').value.trim() || '1 份', kcal: k, p: parseFloat($('#bc-p').value) || 0, c: parseFloat($('#bc-c').value) || 0, f: parseFloat($('#bc-f').value) || 0, src: 'bc' };
  S.foods.push(f); if (!S.settings.favFoods.includes(f.id)) S.settings.favFoods.push(f.id);
  save(); closeSheet('bcfood'); closeSheet('addfood');
  UI.qty = 1; UI.qtyFood = f; UI.qtyMeal = meal; openSheet('qty', sheetQty(f, meal));
};

/* ===== 啟動 ===== */
async function boot() {
  $('#nav').innerHTML = '<div class="in">' + [['today', 'home', '今日'], ['train', 'dumbbell', '訓練'], ['food', 'bowl', '飲食'], ['progress', 'chart', '進度'], ['library', 'book', '動作']].map(([k, i, l]) => '<button data-a="tab" data-v="' + k + '" data-tab="' + k + '"><span class="ico">' + ic(i) + '</span>' + l + '</button>').join('') + '</div>';
  await Store.open();
  await loadSync();
  const st = await Store.get('state');
  S = migrate(st);
  buildExMap(S);
  if (!S.profile) { UI.ob = obDefaults(); openSheet('ob', sheetOnboard, { full: true, noClose: true }); }
  render();
  if (SYNC.cfg) { SYNC.pending = syncDiff().length; drawSyncBadge(); setTimeout(() => syncNow(), 1500); }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && SYNC.cfg && SYNC.pending) syncNow(); if (document.visibilityState === 'visible' && SYNC.cfg) scheduleSync(2000); });
  window.addEventListener('online', () => scheduleSync(1500));
  if (IS_PAGES && 'serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js'); } catch (e) { } }
  let lastDay = todayStr();
  setInterval(() => { const d = todayStr(); if (d !== lastDay) { lastDay = d; render(); } }, 60000);
}
boot();
