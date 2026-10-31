/* ===== 工具 ===== */
const pad2 = n => String(n).padStart(2, '0');
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function todayStr() { return ymd(new Date()); }
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
function diffDays(a, b) { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const r1 = x => Math.round(x * 10) / 10;
const r05 = x => Math.round(x * 2) / 2;
function fmtNum(x) { if (x == null || isNaN(x)) return '–'; return (Math.round(x * 10) / 10).toString(); }
function tzName() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } }
const WD = ['日', '一', '二', '三', '四', '五', '六'];
function mdLabel(s) { const [y, m, d] = s.split('-').map(Number); return m + '/' + d + '（' + WD[new Date(y, m - 1, d).getDay()] + '）'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ===== 常數 ===== */
const DAY_NAME = { push: '推日', pull: '拉日', legs: '腿日', rest: '休息日' };
const DAY_DESC = { push: '胸・肩・三頭', pull: '背・後三角・二頭', legs: '腿・臀・小腿・核心', rest: '恢復' };
const ORDER = ['push', 'pull', 'legs', 'rest'];
const LOAD_LABEL = {
  stack: '機台數字', barbell: '單邊槓片', plates: '槓片合計', db: '單顆啞鈴',
  single: '單邊重量', bw: '額外負重', assist: '輔助重量', time: ''
};
const LOAD_HELP = {
  stack: '照機台上的數字記，小片另外加',
  barbell: '輸入一邊的槓片，自動加上 20kg 槓',
  plates: '兩邊槓片加起來，不算槓或機台本身',
  db: '記一顆啞鈴的重量',
  single: '單邊重量，次數也記單邊',
  bw: '自體重動作，額外負重沒有就填 0',
  assist: '輔助重量，數字越小代表越強',
  time: '次數欄填秒數'
};
const SINGLE_SIDE = new Set(['db_row', 'bulgarian', 'lunge', 'cable_lateral']);
const MUSCLE_NAME = {
  chest: '胸', 'upper-back': '上背（背闊肌）', 'lower-back': '下背', deltoids: '三角肌（肩）', trapezius: '斜方肌',
  biceps: '二頭', triceps: '三頭', forearm: '前臂', abs: '腹肌', obliques: '腹斜肌', quadriceps: '股四頭（大腿前）',
  hamstring: '腿後肌', gluteal: '臀部', adductors: '內收肌', calves: '小腿', tibialis: '脛前肌'
};
const PHASES = {
  1: { name: '適應期', rir: '適應期：次數比平常多 2 下、每組多留 1 下，先把姿勢練穩', short: '次數 +2、多留 1 下、不力竭' },
  2: { name: '增肌期', rir: '增肌期：照每個動作的建議次數和留幾下', short: '照每個動作的建議' },
  3: { name: '力量期', rir: '力量期：主要動作次數少 2 下、重量加重', short: '複合動作次數 −2、加重' },
  4: { name: '減量週', rir: '減量週：組數減半、重量打 9 折、不做到力竭', short: '組數減半、重量 ×0.9' }
};
const FAIL_TEXT = { no: '不要做到力竭', last: '最後一組可以做到力竭', must: '最後一組要做到力竭' };
// 還能做幾下（RIR）。'0' = 力竭。舊資料的 '0-1'、'2-3' 仍可讀
const RIR_OPTS = [['0', '力竭'], ['1', '1'], ['2', '2'], ['3', '3'], ['4-5', '4–5'], ['6+', '6+']];
const CAL_FACTOR = { '6+': 1.2, '4-5': 1.1, '3': 1, '2': 1, '1': 0.95, '0': 0.95, '2-3': 1, '0-1': 0.95 };
const RIR_NUM = { '0': 0, '1': 1, '2': 2, '3': 3, '4-5': 4.5, '6+': 6, '0-1': 0.5, '2-3': 2.5 };
function rirOf(st) { if (!st) return null; if (st.rir && RIR_NUM[st.rir] != null) return RIR_NUM[st.rir]; if (st.fail) return 0; return null; }
function rirLabel(st) {
  if (!st) return ''; const r = st.rir || (st.fail ? '0' : '');
  if (!r) return ''; if (r === '0') return '力竭';
  return '留' + r.replace('-', '–');
}
function fmtSetR(e, st) { const l = rirLabel(st); return fmtSet(e, st) + (l ? '（' + l + '）' : ''); }

function phaseOf(round) {
  const r = ((Math.max(1, round) - 1) % 21) + 1;
  const n = r <= 7 ? 1 : r <= 14 ? 2 : r <= 19 ? 3 : 4;
  return Object.assign({ n, r, cycle: Math.floor((Math.max(1, round) - 1) / 21) + 1 }, PHASES[n]);
}

/* ===== 預設狀態 ===== */
function blankState() {
  return {
    schema: 1,
    profile: null,
    settings: {
      onboarded: false, preferMachines: true, restSec: 90, outdoorWork: true, barKg: 20,
      cycle: { idx: 0, round: 1, restOn: null }, activeGym: null, templates: null,
      favFoods: [], lastBackup: null, waterGoalManual: null
    },
    gyms: [], sessions: [], sets: [], weights: [], foods: [], foodlog: [], water: {}, creatine: {}, daydone: {},
    supp: { has: false, name: '高蛋白', scoopG: 30, kcal: 120, p: 24, c: 3, f: 1.5, milkMl: 300, milkType: 'full', milkKcal: 64, milkP: 3.2, milkC: 4.8, milkF: 3.6, items: [] },
    suppck: {}, combos: [],
    targets: [], measures: [], photos: [], exu: {}, customEx: [], cardio: [], blobs: {}, rxu: {}
  };
}

/* ===== 動作資料 ===== */
let EXMAP = {};
function buildExMap(S) {
  EXMAP = {};
  for (const e of DATA.ex) EXMAP[e.id] = e;
  for (const e of (S.customEx || [])) EXMAP[e.id] = e;
}
function exImgs(e) {
  const u = S.exu[e.id];
  const own = u && u.photo ? [{ own: true, key: u.photo }] : [];
  const lib = e.img && DATA.imgmap[e.img] ? DATA.imgmap[e.img].map(src => ({ src, line: e.img.startsWith('ek:') })) : [];
  return { own, lib };
}
function exAvailable(e, gym) {
  if (!gym) return true;
  return e.eq.every(q => gym.equip.includes(q));
}
function activeGym(S) { return S.gyms.find(g => g.id === S.settings.activeGym) || S.gyms[0] || null; }
/* 處方：基本值（動作預設＋你的修改）→ 依階段調整 */
function baseRx(S, e) {
  const d = (DATA.rx && DATA.rx[e.id]) || (e.t === 'c' ? [3, 8, 12, '1–2', 'last', 120] : [3, 10, 15, '0–1', 'must', 75]);
  const b = { sets: d[0], lo: d[1], hi: d[2], rir: d[3], fail: d[4], rest: d[5] };
  const u = (S.rxu || {})[e.id];
  if (u) { for (const k of ['lo', 'hi', 'rest']) if (u[k] > 0) b[k] = u[k]; }
  return b;
}
function rxFor(S, e, ph, slotSets) {
  const b = baseRx(S, e); const r = Object.assign({}, b);
  if (slotSets > 0) r.sets = slotSets;
  const isTime = e.load === 'time';
  if (ph.n === 1) {
    if (!isTime) { r.lo += 2; r.hi += 2; }
    r.rir = addRir(b.rir, 1); r.fail = b.fail === 'must' ? 'last' : 'no';
  } else if (ph.n === 3) {
    if (e.t === 'c' && !isTime) { r.lo = Math.max(4, r.lo - 2); r.hi = Math.max(r.lo + 1, r.hi - 2); r.rest = Math.max(r.rest, 150); }
  } else if (ph.n === 4) {
    r.sets = Math.max(1, Math.ceil(r.sets / 2)); r.fail = 'no'; r.rir = '3';
  }
  return r;
}
function addRir(t, n) { const m = String(t).match(/(\d+)(?:–(\d+))?/); if (!m) return t; const a = +m[1] + n, b = m[2] ? +m[2] + n : null; return b ? a + '–' + b : String(a); }
function repRange(e, ph, S0, slotSets) { const r = rxFor(S0 || S, e, ph, slotSets); return [r.lo, r.hi]; }
function sessionRx(S, s, e) { return rxFor(S, e, phaseOf(s.round), (s.psets || {})[e.id]); }
function slotIds(slot) { return Array.isArray(slot) ? slot : (slot.ids || []); }

function defaultTemplates() { return JSON.parse(JSON.stringify(DATA.templates)); }
function dayPlan(S, day) {
  const gym = activeGym(S);
  const tpl = (S.settings.templates || DATA.templates)[day] || [];
  const out = [];
  for (const slot of tpl) {
    const cands = slotIds(slot).map(id => EXMAP[id]).filter(Boolean);
    let pick = cands.find(e => exAvailable(e, gym) && !(S.exu[e.id] && S.exu[e.id].pain));
    if (!pick) pick = cands.find(e => exAvailable(e, gym));
    if (pick && !out.includes(pick.id)) out.push(pick.id);
  }
  return out;
}
function dayPlanSets(S, day) {
  const gym = activeGym(S); const tpl = (S.settings.templates || DATA.templates)[day] || []; const out = {};
  for (const slot of tpl) {
    const cands = slotIds(slot).map(id => EXMAP[id]).filter(Boolean);
    let pick = cands.find(e => exAvailable(e, gym) && !(S.exu[e.id] && S.exu[e.id].pain)) || cands.find(e => exAvailable(e, gym));
    if (pick && !(pick.id in out)) out[pick.id] = slot.sets || 0;
  }
  return out;
}
function alternatives(S, exId) {
  const e = EXMAP[exId]; const gym = activeGym(S);
  const prim = e.pri[0];
  return Object.values(EXMAP).filter(x => x.id !== exId && x.pri[0] === prim && exAvailable(x, gym));
}

/* ===== 循環 ===== */
function syncCycle(S, today) {
  const c = S.settings.cycle;
  if (ORDER[c.idx] === 'rest' && c.restOn && today > c.restOn) { c.idx = 0; c.round++; c.restOn = null; return true; }
  if (ORDER[c.idx] === 'rest' && !c.restOn) { c.restOn = today; return true; }
  return false;
}
// 依「實際練的那一天」往下一天走，不是從原本排程 +1（改練別天時才不會錯位）
function advanceCycle(S, date, day) {
  const c = S.settings.cycle;
  const i = ORDER.indexOf(day);
  c.idx = i >= 0 && i < 3 ? (i + 1) % 4 : (c.idx + 1) % 4;
  c.restOn = ORDER[c.idx] === 'rest' ? addDays(date, 1) : null;
}
// 沒練完、下次再練同一天
function repeatCycleDay(S, day) {
  const c = S.settings.cycle; const i = ORDER.indexOf(day);
  if (i >= 0 && i < 3) { c.idx = i; c.restOn = null; }
}
function skipRest(S) {
  const c = S.settings.cycle;
  if (ORDER[c.idx] === 'rest') { c.idx = 0; c.round++; c.restOn = null; }
}
function nextTrainDay(S) { const c = S.settings.cycle; return ORDER[c.idx] === 'rest' ? 'push' : ORDER[c.idx]; }
function daysSinceLastSession(S, today) {
  const done = S.sessions.filter(s => s.end).map(s => s.date).sort();
  if (!done.length) return null;
  return diffDays(done[done.length - 1], today);
}

/* ===== 重量計算 ===== */
function totalWeight(e, w, add, S) {
  w = +w || 0; add = +add || 0;
  if (e.load === 'barbell') return r1((S.settings.barKg || 20) + 2 * (w + add));
  return r1(w + add);
}
function bodyKg(S) { const w = latestWeight(S); return w ? w.kg : (S.profile ? S.profile.startKg : 60); }
function setVolume(e, st, S) {
  if (st.warm) return 0;
  if (e.load === 'time') return 0;
  if (e.load === 'bw') return (bodyKg(S) + st.tw) * st.reps;
  if (e.load === 'assist') return Math.max(0, bodyKg(S) - st.tw) * st.reps;
  const f = e.load === 'db' && !SINGLE_SIDE.has(e.id) ? 2 : 1;
  return st.tw * st.reps * f;
}
function e1rm(w, r) { if (!r || r > 12 || !w) return null; return r1(w * (1 + r / 30)); }
function fmtSet(e, st) {
  if (e.load === 'time') return st.reps + ' 秒';
  return fmtNum(st.tw) + '×' + st.reps;
}
function sessionById(S, id) { return S.sessions.find(s => s.id === id); }

/* 依場次分組的歷史（新到舊），只含工作組 */
function exHistory(S, exId, opts) {
  opts = opts || {};
  const by = {};
  for (const st of S.sets) {
    if (st.ex !== exId) continue;
    if (opts.excludeSid && st.sid === opts.excludeSid) continue;
    (by[st.sid] = by[st.sid] || []).push(st);
  }
  const out = [];
  for (const sid in by) {
    const ss = sessionById(S, sid); if (!ss) continue;
    if (opts.gymId && ss.gymId !== opts.gymId) continue;
    const sets = by[sid].sort((a, b) => a.n - b.n);
    out.push({ sid, date: ss.date, start: ss.start, gymId: ss.gymId, sets, work: sets.filter(x => !x.warm) });
  }
  out.sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  return out.filter(h => h.work.length);
}
function topSet(e, sets) {
  const w = sets.filter(x => !x.warm);
  if (!w.length) return null;
  if (e.load === 'assist') return w.slice().sort((a, b) => a.tw - b.tw || b.reps - a.reps)[0];
  if (e.load === 'time') return w.slice().sort((a, b) => b.reps - a.reps)[0];
  return w.slice().sort((a, b) => b.tw - a.tw || b.reps - a.reps)[0];
}
function bestE1rm(e, sets) {
  if (e.load === 'assist' || e.load === 'time' || e.load === 'bw') return null;
  let b = null; for (const st of sets) { if (st.warm) continue; const v = e1rm(st.tw, st.reps); if (v && (!b || v > b)) b = v; } return b;
}

/* 今日建議 */
function suggestion(S, e, ph, sid) {
  const gym = activeGym(S);
  const hist = exHistory(S, e.id, { excludeSid: sid, gymId: gym ? gym.id : null });
  const ss = sid ? sessionById(S, sid) : null;
  const rr = rxFor(S, e, ph, ss && ss.psets ? ss.psets[e.id] : 0); const lo = rr.lo, hi = rr.hi;
  if (!hist.length) {
    const any = exHistory(S, e.id, { excludeSid: sid });
    if (any.length) return { type: 'gym', text: '這間健身房第一次做這個動作。機台不同，重量不能直接比，先用試重找新的基準。', cal: true };
    return { type: 'cal', text: '第一次做：先選確定輕鬆的重量做 10 下，做完回答「還能做幾下」，app 會建議下一組重量。', cal: true };
  }
  const last = hist[0];
  const top = topSet(e, last.work);
  const ago = diffDays(last.date, todayStr());
  const when = ago === 0 ? '今天稍早' : ago + ' 天前';
  let text, type;
  let target = null;
  if (e.load === 'time') { type = 'reps'; target = top.reps + 5; text = '上次最長 ' + top.reps + ' 秒 → 今天試 ' + (top.reps + 5) + ' 秒'; }
  else if (e.load === 'assist') {
    if (top.reps >= hi) { type = 'up'; target = lo; text = '上次輔助 ' + fmtNum(top.tw) + ' 做到 ' + top.reps + ' 下 → 今天減少一格輔助'; }
    else { type = 'reps'; target = Math.min(top.reps + 1, hi); text = '上次輔助 ' + fmtNum(top.tw) + '×' + top.reps + ' → 今天同輔助目標 ' + target + ' 下'; }
  } else {
    const rn = rirOf(top); const lab = fmtSetR(e, top);
    if (top.reps >= hi) {
      type = 'up'; target = lo;
      text = rn != null && rn >= 3
        ? '上次 ' + lab + ' 做到 ' + hi + ' 下還很輕鬆 → 今天加重，可以加兩格，目標 ' + lo + ' 下以上'
        : '上次 ' + lab + ' 已達 ' + hi + ' 下 → 今天加重（下一格或加小片），目標 ' + lo + ' 下以上';
    } else if (rn === 0 && top.reps < lo) {
      type = 'down'; target = lo;
      text = '上次 ' + lab + ' 力竭也只做到 ' + top.reps + ' 下，低於 ' + lo + ' 下 → 今天減一格重量，先做到 ' + lo + ' 下以上';
    } else {
      type = 'reps';
      const add = rn != null && rn >= 3 ? 2 : 1; target = Math.min(Math.max(top.reps + add, lo), hi);
      text = '上次 ' + lab + ' → 今天同重量，目標 ' + Math.min(Math.max(top.reps + add, lo), hi) + ' 下' + (rn != null && rn >= 3 ? '（上次還很有餘力）' : '');
    }
  }
  if (ph.n === 4) text = '減量週：重量約 ' + fmtNum(r05(top.tw * 0.9)) + '，組數減半，做輕鬆就好';
  // 停滯
  let stall = false;
  if (hist.length >= 4 && e.load !== 'time' && e.load !== 'assist') {
    const v = h => { const t = topSet(e, h.work); return e1rm(t.tw, t.reps) || t.tw * 1 + t.reps * 0.01; };
    const recent = Math.max(v(hist[0]), v(hist[1]), v(hist[2]));
    if (recent <= v(hist[3])) stall = true;
  }
  return { type, text, when, last, top, stall, target };
}
function calNext(w, rir) {
  const f = CAL_FACTOR[rir]; if (!f || !w) return null;
  return r05(w * f);
}
function calText(w, rir) {
  if (rir === '0' || rir === '1') rir = '0-1'; else if (rir === '2' || rir === '3') rir = '2-3';
  if (rir === '6+') return '太輕了。下一組加重到約 ' + fmtNum(calNext(w, rir)) + '（調到最接近的那格）';
  if (rir === '4-5') return '還有空間。下一組加到約 ' + fmtNum(calNext(w, rir));
  if (rir === '2-3') return '這就是你的工作重量，下一組維持';
  if (rir === '0-1') return '接近極限，下一組同重量或減一點';
  return '';
}
/* 預填 */
function prefill(S, e, sid, n) {
  const cur = S.sets.filter(x => x.sid === sid && x.ex === e.id).sort((a, b) => a.n - b.n);
  const gym = activeGym(S);
  const hist = exHistory(S, e.id, { excludeSid: sid, gymId: gym ? gym.id : null });
  if (hist.length) {
    const lastSets = hist[0].sets;
    const m = lastSets.find(x => x.n === n) || lastSets[lastSets.length - 1];
    if (m) return { w: m.w, add: m.add || 0, reps: m.reps, warm: m.warm };
  }
  if (cur.length) { const p = cur[cur.length - 1]; return { w: p.w, add: p.add || 0, reps: p.reps, warm: false }; }
  return { w: '', add: 0, reps: e.load === 'time' ? 30 : 10, warm: false };
}
/* PR 判定：同樣或更多次數下，重量比以前都重 */
function prFlags(S, e, st) {
  const out = { pr: null, rp: null };
  if (st.warm) return out;
  const t0 = st.t || 0;
  const prev = S.sets.filter(x => x.ex === e.id && x.id !== st.id && !x.warm && (x.t || 0) < t0);
  if (!prev.some(x => x.sid !== st.sid)) return out; // 第一次做這個動作不算紀錄
  if (e.load === 'time') { if (st.reps > Math.max(...prev.map(x => x.reps))) out.pr = '最久紀錄 ' + st.reps + ' 秒'; return out; }
  if (e.load === 'bw' && st.tw === 0) { const bz = prev.filter(x => x.tw === 0); if (bz.length && st.reps > Math.max(...bz.map(x => x.reps))) out.pr = '次數紀錄 ' + st.reps + ' 下'; return out; }
  if (e.load === 'assist') {
    const mn = Math.min(...prev.map(x => x.tw));
    if (st.tw < mn) out.pr = '輔助最少 ' + fmtNum(st.tw) + 'kg（之前 ' + fmtNum(mn) + '）';
    else { const same = prev.filter(x => x.tw <= st.tw + 1e-9); if (same.length && st.reps > Math.max(...same.map(x => x.reps))) out.rp = fmtNum(st.tw) + 'kg 輔助次數新高'; }
    return out;
  }
  const mx = Math.max(...prev.map(x => x.tw));
  if (st.tw > mx + 1e-9) { out.pr = '重量新高 ' + fmtNum(st.tw) + 'kg（之前最重 ' + fmtNum(mx) + 'kg）'; return out; }
  const heavier = prev.filter(x => x.tw >= st.tw - 1e-9);
  if (heavier.length && st.reps > Math.max(...heavier.map(x => x.reps))) out.rp = fmtNum(st.tw) + 'kg 次數新高（' + st.reps + ' 下）';
  return out;
}
function checkPR(S, e, st) { return prFlags(S, e, st).pr; }
// 依時間重算所有（或某動作）的紀錄標記
function recomputePRs(S, exId) {
  const L = S.sets.filter(x => !exId || x.ex === exId).slice().sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const st of L) {
    const e = EXMAP[st.ex]; if (!e) continue;
    const f = prFlags(S, e, st);
    if (f.pr) st.pr = f.pr; else delete st.pr;
    if (f.rp) st.rp = f.rp; else delete st.rp;
  }
}
function maxEverTw(S, exId, exceptId) {
  const p = S.sets.filter(x => x.ex === exId && x.id !== exceptId && !x.warm);
  return p.length ? Math.max(...p.map(x => x.tw)) : null;
}
function prBoard(S, e) {
  const sets = S.sets.filter(x => x.ex === e.id && !x.warm);
  const by = {};
  for (const st of sets) { if (!by[st.reps] || st.tw > by[st.reps].tw) by[st.reps] = st; }
  return Object.keys(by).map(Number).sort((a, b) => a - b).map(r => ({ reps: r, tw: by[r].tw, date: (sessionById(S, by[r].sid) || {}).date }));
}

/* ===== 體重、目標 ===== */
function latestWeight(S) { if (!S.weights.length) return null; return S.weights.slice().sort((a, b) => a.date.localeCompare(b.date))[S.weights.length - 1]; }
function age(p) { return new Date().getFullYear() - p.birthYear; }
function bmrOf(p, kg) { return 10 * kg + 6.25 * p.height - 5 * age(p) + (p.sex === 'f' ? -161 : 5); }
const GOAL_OFF = { bulk: 400, maintain: 0, cut: -500 };
const GOAL_NAME = { bulk: '增肌', maintain: '維持', cut: '減脂' };
function calcTargets(p, kg, tdeeOverride) {
  const tdee = tdeeOverride || bmrOf(p, kg) * p.act;
  let kcal = Math.max(p.sex === 'f' ? 1200 : 1500, tdee + GOAL_OFF[p.goal]);
  kcal = Math.round(kcal / 10) * 10;
  const pg = p.goal === 'maintain' ? 1.8 : 2.0;
  const prot = Math.round(kg * pg);
  const fat = Math.max(Math.round(kcal * 0.27 / 9), Math.round(kg * 0.6));
  const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { tdee: Math.round(tdee), kcal, p: prot, f: fat, c: carb };
}
function currentTarget(S) { return S.targets.length ? S.targets[S.targets.length - 1] : null; }
function gainRange(kg, b) { const lo = b < 18.5 ? 0.005 : 0.0025, hi = b < 18.5 ? 0.01 : 0.005; return [kg * lo, kg * hi]; }
function gainText(kg, b) { const [a, c] = gainRange(kg, b); return a.toFixed(2) + '～' + c.toFixed(2); }
function bmi(p, kg) { return r1(kg / Math.pow(p.height / 100, 2)); }
function waterGoal(S, trainingDay) {
  if (S.settings.waterGoalManual) return S.settings.waterGoalManual;
  let ml = bodyKg(S) * 35 + (trainingDay ? 500 : 0) + (S.settings.outdoorWork ? 500 : 0);
  return Math.round(ml / 50) * 50;
}
function linreg(pts) {
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const d = n * sxx - sx * sx; if (!d) return null;
  const slope = (n * sxy - sx * sy) / d;
  return { slope, icpt: (sy - slope * sx) / n };
}
function adaptive(S, today) {
  const p = S.profile; if (!p) return { ok: false };
  const cur = currentTarget(S);
  if (p.creatineStart) {
    const d = diffDays(p.creatineStart, today);
    if (d >= 0 && d < 21) return { ok: false, msg: '開始吃肌酸後的 3 週內，體重會因水分增加，暫停自動校正（還有 ' + (21 - d) + ' 天）' };
  }
  const start = addDays(today, -27);
  const ws = S.weights.filter(w => w.date >= start && w.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const logged = validFoodDays(S, start, addDays(today, -1), today).map(d => d.date);
  const need = [];
  if (ws.length < 5) need.push('體重紀錄還差 ' + (5 - ws.length) + ' 筆');
  if (logged.length < 14) need.push('飲食紀錄天數還差 ' + (14 - logged.length) + ' 天');
  if (cur && diffDays(cur.date, today) < 14) need.push('距離上次調整未滿 14 天');
  if (need.length) return { ok: false, msg: '自動校正條件：' + need.join('、') };
  const reg = linreg(ws.map(w => [diffDays(start, w.date), w.kg]));
  if (!reg) return { ok: false, msg: '體重資料不足' };
  let kc = 0; for (const d of logged) kc += dayTotals(S, d).kcal;
  const avgIn = kc / logged.length;
  const tdeeEst = Math.round(avgIn - reg.slope * 7700);
  const avgW = ws.reduce((a, w) => a + w.kg, 0) / ws.length;
  const weekKg = reg.slope * 7;
  const pct = weekKg / avgW * 100;
  const t = calcTargets(p, avgW, tdeeEst);
  let newK = t.kcal;
  if (cur) newK = Math.max(cur.kcal - 150, Math.min(cur.kcal + 150, newK));
  return { ok: true, tdeeEst, weekKg: +weekKg.toFixed(2), pct: +pct.toFixed(2), avgIn: Math.round(avgIn), newKcal: Math.round(newK / 10) * 10, cur: cur ? cur.kcal : null, kg: avgW };
}

/* ===== 飲食 ===== */
function dayTotals(S, date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const x of S.foodlog) if (x.date === date) { t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.f += x.f; }
  return t;
}
function allFoods(S) {
  const b = DATA.foods.map((f, i) => ({ id: 'b' + i, name: f[0], unit: f[1], kcal: f[2], p: f[3], c: f[4], f: f[5], src: 'b' }));
  return S.foods.concat(b);
}

/* ===== 飲食完整度與長期統計 ===== */
function targetOn(S, date) {
  let t = null; for (const x of S.targets) { if (!x.date || x.date <= date) t = x; }
  return t || (S.targets[0] || null);
}
// 一天的狀態：done=按了記錄完成（鎖定）；skip=手動標記沒記完；suspect=熱量不到目標一半、可能沒記完
function dayStatus(S, date, today) {
  const tot = dayTotals(S, date); const t = targetOn(S, date);
  const logged = S.foodlog.some(f => f.date === date);
  const m = (S.daydone || {})[date]; const st = m ? m.s : null;
  const done = st === 'done', skip = st === 'skip';
  const suspect = logged && !done && !skip && !!t && tot.kcal < t.kcal * 0.5;
  const pending = !done && date === (today || todayStr());
  const valid = !skip && logged && (done || (!suspect && !pending));
  const kHit = t ? (S.profile && S.profile.goal === 'cut' ? tot.kcal <= t.kcal * 1.1 && tot.kcal >= t.kcal * 0.8 : tot.kcal >= t.kcal * 0.9) : null;
  const pHit = t ? tot.p >= t.p * 0.9 : null;
  return { date, tot, t, logged, done, skip, suspect, pending, valid, kHit, pHit };
}
function dayLocked(S, date) { const m = (S.daydone || {})[date]; return !!(m && m.s === 'done'); }
function foodHistory(S, today, n) {
  const out = []; for (let i = 0; i < (n || 14); i++) out.push(dayStatus(S, addDays(today, -i), today));
  const v = out.filter(d => d.valid);
  return { days: out, valid: v.length, kHits: v.filter(d => d.kHit).length, pHits: v.filter(d => d.pHit).length,
    suspect: out.filter(d => d.suspect).length };
}
function validFoodDays(S, from, to, today) {
  const r = []; for (let d = from; d <= to; d = addDays(d, 1)) { const x = dayStatus(S, d, today); if (x.valid) r.push(x); } return r;
}
// 長期提示：只挑會影響結果的
function foodTips(S, today) {
  const tips = []; const h = foodHistory(S, today, 14); const v = h.days.filter(d => d.valid && d.t);
  // 連續蛋白質不足（從最近往回數）
  let streak = 0, short = 0; for (const d of v) { if (d.pHit) break; streak++; short += d.t.p - d.tot.p; }
  if (streak >= 3) tips.push({ lvl: 'warn', k: 'pstreak', text: '蛋白質已經連續 ' + streak + ' 天沒達標，平均每天少 ' + Math.round(short / streak) + 'g。' + (S.supp && S.supp.has ? '每天多一匙高蛋白大約補 ' + Math.round(S.supp.p) + 'g。' : '加雞蛋、雞胸肉、牛奶最快補上。') });
  else if (v.length >= 5 && h.pHits / v.length < 0.6) tips.push({ lvl: 'warn', k: 'prate', text: '近 14 天蛋白質只有 ' + h.pHits + '/' + v.length + ' 天達標。肌肉是每天累積的，蛋白質比碳水重要。' });
  // 熱量達標率（增肌）
  if (S.profile && S.profile.goal === 'bulk' && v.length >= 5 && h.kHits / v.length < 0.5) {
    const avg = Math.round(v.reduce((a, d) => a + d.tot.kcal, 0) / v.length);
    tips.push({ lvl: 'warn', k: 'krate', text: '近 14 天熱量只有 ' + h.kHits + '/' + v.length + ' 天達標，平均 ' + avg + ' 大卡。增肌吃不夠是最常見的卡關原因。' });
  }
  // 週末 vs 平日
  const wk = v.filter(d => [0, 6].includes(new Date(d.date + 'T12:00:00').getDay())), wd = v.filter(d => ![0, 6].includes(new Date(d.date + 'T12:00:00').getDay()));
  if (wk.length >= 2 && wd.length >= 3) {
    const a = wk.reduce((x, d) => x + d.tot.kcal, 0) / wk.length, b = wd.reduce((x, d) => x + d.tot.kcal, 0) / wd.length;
    if (Math.abs(a - b) >= 500) tips.push({ lvl: 'brass', k: 'weekend', text: '週末平均比平日' + (a < b ? '少' : '多') + ' ' + Math.round(Math.abs(a - b)) + ' 大卡（' + Math.round(a) + ' vs ' + Math.round(b) + '）。' + (a < b ? '週末作息不同容易少吃一餐。' : '') });
  }
  // 練前一天碳水太低
  const from = addDays(today, -13);
  let lowC = 0, cnt = 0;
  for (const se of S.sessions.filter(x => x.end && x.date >= from && x.date <= today)) {
    const pd = dayStatus(S, addDays(se.date, -1), today); if (!pd.valid || !pd.t) continue; cnt++;
    if (pd.tot.c < pd.t.c * 0.6) lowC++;
  }
  if (lowC >= 2) tips.push({ lvl: 'brass', k: 'carb', text: '最近有 ' + lowC + ' 次訓練的前一天碳水不到目標的 6 成。碳水是訓練的燃料，練前一天和當天多吃點飯或麵，重量會比較好推。' });
  // 漏記
  const s7 = h.days.slice(0, 7).filter(d => d.suspect).length;
  if (s7 >= 2) tips.push({ lvl: '', k: 'suspect', text: '最近 7 天有 ' + s7 + ' 天熱量不到目標一半，可能沒記完，這些天不算進平均。記完一天記得按「記錄完成」。' });
  return tips;
}

/* ===== 統計 ===== */
function muscleWeek(S, today) {
  const from = addDays(today, -6);
  const sids = new Set(S.sessions.filter(s => s.date >= from && s.date <= today).map(s => s.id));
  const m = {};
  for (const st of S.sets) {
    if (!sids.has(st.sid) || st.warm) continue;
    const e = EXMAP[st.ex]; if (!e) continue;
    for (const x of e.pri) m[x] = (m[x] || 0) + 1;
    for (const x of e.sec) m[x] = (m[x] || 0) + 0.5;
  }
  return m;
}
function weekReview(S, today) {
  const from = addDays(today, -6);
  const t = currentTarget(S);
  const days = []; for (let i = 0; i < 7; i++) days.push(addDays(from, i));
  const logged = days.filter(d => dayStatus(S, d, today).valid);
  let kc = 0, pr = 0; for (const d of logged) { const x = dayTotals(S, d); kc += x.kcal; pr += x.p; }
  const sess = S.sessions.filter(s => s.end && s.date >= from && s.date <= today);
  const sids = new Set(sess.map(s => s.id));
  let vol = 0, prs = 0;
  for (const st of S.sets) if (sids.has(st.sid)) { const e = EXMAP[st.ex]; if (e) vol += setVolume(e, st, S); if (st.pr) prs++; }
  const ws = S.weights.filter(w => w.date >= addDays(today, -13)).sort((a, b) => a.date.localeCompare(b.date));
  const wChange = ws.length >= 2 ? r1(ws[ws.length - 1].kg - ws[0].kg) : null;
  const water = days.map(d => S.water[d] || 0).filter(x => x > 0);
  return {
    from, to: today, loggedDays: logged.length,
    avgKcal: logged.length ? Math.round(kc / logged.length) : null, avgP: logged.length ? Math.round(pr / logged.length) : null,
    tKcal: t ? t.kcal : null, tP: t ? t.p : null,
    sessions: sess.length, vol: Math.round(vol), prs, wChange, wFrom: ws.length ? ws[0].date : null,
    avgWater: water.length ? Math.round(water.reduce((a, b) => a + b, 0) / water.length) : null,
    creatineDays: days.filter(d => S.creatine[d]).length
  };
}
function aiSummary(S) {
  const today = todayStr(); const p = S.profile; const t = currentTarget(S); const w = latestWeight(S);
  const ph = phaseOf(S.settings.cycle.round);
  const L = [];
  L.push('我是 ' + age(p) + ' 歲' + (p.sex === 'f' ? '女性' : '男性') + '，身高 ' + p.height + 'cm，目前體重 ' + (w ? w.kg : p.startKg) + 'kg，目標：' + GOAL_NAME[p.goal] + '。');
  L.push('訓練：推拉腿，練 3 休 1，目前第 ' + S.settings.cycle.round + ' 輪（' + ph.name + '）。以器械為主。');
  if (t) L.push('每日目標：' + t.kcal + ' 大卡，蛋白質 ' + t.p + 'g，脂肪 ' + t.f + 'g，碳水 ' + t.c + 'g。');
  const r = weekReview(S, today);
  L.push('最近 7 天：訓練 ' + r.sessions + ' 次，總容量 ' + r.vol + 'kg；飲食記錄 ' + r.loggedDays + ' 天' + (r.avgKcal ? '，平均 ' + r.avgKcal + ' 大卡、蛋白質 ' + r.avgP + 'g' : '') + '。');
  const ws = S.weights.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
  if (ws.length) L.push('體重紀錄：' + ws.map(x => x.date.slice(5) + ' ' + x.kg + 'kg').join('、') + '。');
  const from = addDays(today, -14);
  const exs = {};
  for (const s of S.sessions.filter(s => s.date >= from)) for (const st of S.sets.filter(x => x.sid === s.id && !x.warm)) (exs[st.ex] = exs[st.ex] || []).push(s.date.slice(5) + ' ' + fmtSet(EXMAP[st.ex] || { load: '' }, st));
  const ks = Object.keys(exs);
  if (ks.length) { L.push('最近 2 週各動作工作組：'); for (const k of ks) L.push('・' + ((EXMAP[k] || {}).name || k) + '：' + exs[k].slice(-8).join('，')); }
  const pain = Object.keys(S.exu).filter(k => S.exu[k].pain);
  if (pain.length) L.push('標記會痛的動作：' + pain.map(k => (EXMAP[k] || {}).name + '（' + (S.exu[k].pain.note || '未註明') + '）').join('、'));
  L.push('');
  L.push('我的問題：');
  return L.join('\n');
}
if (typeof module !== 'undefined') module.exports = { prFlags, recomputePRs, rirLabel, rirOf, fmtSetR, dayStatus, foodHistory, foodTips, targetOn, dayLocked, rxFor, baseRx, addRir, ymd, addDays, diffDays, phaseOf, calcTargets, linreg, adaptive, blankState, totalWeight, e1rm, suggestion, checkPR, syncCycle, advanceCycle, skipRest, dayPlan, buildExMap, weekReview, muscleWeek, dayTotals, calNext, prefill, waterGoal, setVolume, exHistory, topSet, aiSummary };
