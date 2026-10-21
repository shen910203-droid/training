// 模擬 Google Apps Script 環境，直接執行真正的 Code.gs
const fs = require('fs'), http = require('http'), vm = require('vm');
const STATE = { sheets: {}, props: {}, files: {}, folders: {}, lockHeld: false, calls: [], bytesIn: 0, bytesOut: 0, delay: 0 };
function mkSheet(name) {
  const rows = []; // 2D, 1-based for API
  const sh = {
    name, rows,
    getLastRow: () => rows.length,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => { const o = []; for (let i = 0; i < nr; i++) { const row = rows[r - 1 + i] || []; const x = []; for (let j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); o.push(x); } return o; },
      setValues: v => { if (v.length !== nr || v[0].length !== nc) throw new Error('size mismatch'); for (let i = 0; i < nr; i++) { rows[r - 1 + i] = rows[r - 1 + i] || []; for (let j = 0; j < nc; j++) { let val = v[i][j]; if (typeof val === 'string' && val.length > 50000) throw new Error('cell too long'); rows[r - 1 + i][c - 1 + j] = val instanceof Date ? val.toISOString() : val; } } }
    }),
    clearContents: () => { rows.length = 0; }
  };
  return sh;
}
const ctx = {
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({ getSheetByName: n => STATE.sheets[n] || null, insertSheet: n => (STATE.sheets[n] = mkSheet(n)) }),
    getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() { } }) })
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => { if (STATE.lockHeld) throw new Error('lock busy'); STATE.lockHeld = true; }, releaseLock: () => { STATE.lockHeld = false; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in STATE.props ? STATE.props[k] : null), setProperty: (k, v) => { STATE.props[k] = String(v); } }) },
  Utilities: {
    base64Decode: s => Array.from(Buffer.from(s, 'base64')), base64Encode: b => Buffer.from(b).toString('base64'),
    newBlob: (bytes, type, name) => ({ bytes, type, name })
  },
  DriveApp: {
    createFolder: n => { const id = 'fold' + Object.keys(STATE.folders).length; STATE.folders[id] = n; return { getId: () => id, createFile: b => { const fid = 'file' + Object.keys(STATE.files).length; STATE.files[fid] = { bytes: b.bytes, name: b.name, trashed: false }; return { getId: () => fid }; } }; },
    getFolderById: id => { if (!STATE.folders[id]) throw new Error('no folder'); return { getId: () => id, createFile: b => { const fid = 'file' + Object.keys(STATE.files).length; STATE.files[fid] = { bytes: b.bytes, name: b.name, trashed: false }; return { getId: () => fid }; } }; },
    getFileById: id => { const f = STATE.files[id]; if (!f) throw new Error('no file'); return { getBlob: () => ({ getBytes: () => f.bytes }), setTrashed: t => { f.trashed = t; } }; }
  }
};
vm.createContext(ctx);
const code = fs.readFileSync(process.argv[2], 'utf8').replace('__KEY__', 'testkey');
vm.runInContext(code, ctx);
const port = +process.argv[3] || 8790;
let queue = Promise.resolve();
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (req.url.startsWith('/__state')) { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); const d = STATE.sheets._data ? STATE.sheets._data.rows : []; return res.end(JSON.stringify({ rows: d, props: STATE.props, files: Object.fromEntries(Object.entries(STATE.files).map(([k, v]) => [k, { n: v.bytes.length, trashed: v.trashed }])), calls: STATE.calls, bytesIn: STATE.bytesIn, bytesOut: STATE.bytesOut })); }
  if (req.url.startsWith('/__reset')) { STATE.calls = []; STATE.bytesIn = 0; STATE.bytesOut = 0; res.writeHead(200, cors); return res.end('ok'); }
  if (req.url.startsWith('/__wipe')) { STATE.sheets = {}; STATE.props = {}; STATE.files = {}; STATE.folders = {}; STATE.calls = []; res.writeHead(200, cors); return res.end('ok'); }
  if (req.method === 'OPTIONS') { res.writeHead(400); return res.end(); } // 真正的 Apps Script 不支援預檢，App 必須避免觸發
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    queue = queue.then(async () => {
      if (STATE.delay) await new Promise(r => setTimeout(r, STATE.delay));
      STATE.bytesIn += Buffer.byteLength(body);
      let o;
      if (req.method === 'GET') o = vm.runInContext('doGet()', ctx);
      else { ctx.__e = { postData: { contents: body } }; o = vm.runInContext('doPost(__e)', ctx); }
      try { STATE.calls.push(JSON.parse(body).op); } catch (e) { }
      STATE.bytesOut += Buffer.byteLength(o.s);
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end(o.s);
    });
  });
}).listen(port, () => console.log('gas mock on', port));
