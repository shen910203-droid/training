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
  1: { name: '適應期', sets: 3, c: [10, 12], i: [12, 15], rir: '每組留 2–3 下' },
  2: { name: '增肌期', sets: 4, c: [8, 10], i: [10, 12], rir: '每組留 1–2 下' },
  3: { name: '力量期', sets: 4, c: [6, 8], i: [10, 12], rir: '最後一組可做到力竭' },
  4: { name: '減量週', sets: 2, c: [8, 10], i: [10, 12], rir: '輕鬆做，重量打 9 折' }
};
const RIR_OPTS = [['0-1', '0–1'], ['2-3', '2–3'], ['4-5', '4–5'], ['6+', '6+']];
const CAL_FACTOR = { '6+': 1.2, '4-5': 1.1, '2-3': 1, '0-1': 0.95 };

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
    gyms: [], sessions: [], sets: [], weights: [], foods: [], foodlog: [], water: {}, creatine: {},
    supp: { has: false, name: '高蛋白', scoopG: 30, kcal: 120, p: 24, c: 3, f: 1.5, milkMl: 300, milkKcal: 64, milkP: 3.2, milkC: 4.8, milkF: 3.6 },
    targets: [], measures: [], photos: [], exu: {}, customEx: [], cardio: [], blobs: {}
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
function repRange(e, ph) { return e.t === 'i' ? ph.i : ph.c; }
function setsFor(e, ph) { return e.t === 'i' ? Math.min(ph.sets, 3) : ph.sets; }

function defaultTemplates() { return JSON.parse(JSON.stringify(DATA.templates)); }
function dayPlan(S, day) {
  const gym = activeGym(S);
  const tpl = (S.settings.templates || DATA.templates)[day] || [];
  const out = [];
  for (const slot of tpl) {
    const cands = slot.map(id => EXMAP[id]).filter(Boolean);
    let pick = cands.find(e => exAvailable(e, gym) && !(S.exu[e.id] && S.exu[e.id].pain));
    if (!pick) pick = cands.find(e => exAvailable(e, gym));
    if (pick && !out.includes(pick.id)) out.push(pick.id);
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
function advanceCycle(S, date) {
  const c = S.settings.cycle;
  c.idx = (c.idx + 1) % 4;
  if (ORDER[c.idx] === 'rest') c.restOn = addDays(date, 1);
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
  const [lo, hi] = repRange(e, ph);
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
  if (e.load === 'time') { type = 'reps'; text = '上次最長 ' + top.reps + ' 秒 → 今天試 ' + (top.reps + 5) + ' 秒'; }
  else if (e.load === 'assist') {
    if (top.reps >= hi) { type = 'up'; text = '上次輔助 ' + fmtNum(top.tw) + ' 做到 ' + top.reps + ' 下 → 今天減少一格輔助'; }
    else { type = 'reps'; text = '上次輔助 ' + fmtNum(top.tw) + '×' + top.reps + ' → 今天同輔助目標 ' + Math.min(top.reps + 1, hi) + ' 下'; }
  } else if (top.reps >= hi) {
    type = 'up';
    text = '上次 ' + fmtSet(e, top) + ' 已達 ' + hi + ' 下 → 今天加重（下一格或加小片），目標 ' + lo + ' 下以上';
  } else {
    type = 'reps';
    text = '上次 ' + fmtSet(e, top) + ' → 今天同重量，目標 ' + Math.min(Math.max(top.reps + 1, lo), hi) + ' 下';
  }
  if (ph.n === 4) text = '減量週：重量約 ' + fmtNum(r05(top.tw * 0.9)) + '，組數減半，做輕鬆就好';
  // 停滯
  let stall = false;
  if (hist.length >= 4 && e.load !== 'time' && e.load !== 'assist') {
    const v = h => { const t = topSet(e, h.work); return e1rm(t.tw, t.reps) || t.tw * 1 + t.reps * 0.01; };
    const recent = Math.max(v(hist[0]), v(hist[1]), v(hist[2]));
    if (recent <= v(hist[3])) stall = true;
  }
  return { type, text, when, last, top, stall };
}
function calNext(w, rir) {
  const f = CAL_FACTOR[rir]; if (!f || !w) return null;
  return r05(w * f);
}
function calText(w, rir) {
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
function checkPR(S, e, st) {
  if (st.warm || e.load === 'assist') return null;
  const prev = S.sets.filter(x => x.ex === e.id && x.id !== st.id && x.sid !== st.sid && !x.warm);
  if (!prev.length) return null;
  if (e.load === 'time') { const b = Math.max(...prev.map(x => x.reps)); return st.reps > b ? '最久紀錄' : null; }
  if (e.load === 'bw' && st.tw === 0) {
    const b = Math.max(0, ...prev.filter(x => x.tw === 0).map(x => x.reps)); return st.reps > b ? '次數紀錄' : null;
  }
  const better = prev.filter(x => x.reps >= st.reps);
  const maxW = better.length ? Math.max(...better.map(x => x.tw)) : -1;
  if (st.tw > maxW) return st.reps + ' 下最重紀錄';
  const be = bestE1rm(e, prev), ce = e1rm(st.tw, st.reps);
  if (ce && be && ce > be) return '估計 1RM 新高';
  return null;
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
  const logged = [...new Set(S.foodlog.filter(f => f.date >= start && f.date < today).map(f => f.date))];
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
  const logged = days.filter(d => S.foodlog.some(f => f.date === d));
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
if (typeof module !== 'undefined') module.exports = { ymd, addDays, diffDays, phaseOf, calcTargets, linreg, adaptive, blankState, totalWeight, e1rm, suggestion, checkPR, syncCycle, advanceCycle, skipRest, dayPlan, buildExMap, weekReview, muscleWeek, dayTotals, calNext, prefill, waterGoal, setVolume, exHistory, topSet, aiSummary };
