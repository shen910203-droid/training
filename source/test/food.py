import subprocess, time, os
from playwright.sync_api import sync_playwright
OUT = '/home/claude/lgb/test/foodshots'; os.makedirs(OUT, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8776', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
CHECK = """() => { const W=document.documentElement.clientWidth, out=[]; if (document.scrollingElement.scrollWidth>W+1) out.push('hscroll');
 for (const el of document.querySelectorAll('#app *,#layer *')) { const cs=getComputedStyle(el); if(cs.display==='none'||el.closest('svg')||el.closest('.chips.scroll')||el.classList.contains('hidden-file')) continue; const r=el.getBoundingClientRect(); if(!r.width) continue;
  if (r.right>W+1) out.push('off:'+el.className+':'+(el.textContent||'').trim().slice(0,20));
  if (el.children.length===0 && el.textContent.trim() && el.scrollWidth>el.clientWidth+2 && !el.classList.contains('ell') && cs.overflow!=='visible') out.push('clip:'+el.className+':'+el.textContent.trim().slice(0,20)); }
 return [...new Set(out)].slice(0,10); }"""
def top(pg): return pg.locator('.sheet-wrap').last
def click(pg, sel, scope=None): (scope or pg).locator(sel).first.click(); pg.wait_for_timeout(180)
def shot(pg, n, full=False):
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/{n}.png', full_page=full); r = pg.evaluate(CHECK)
    if r: fails.append(n + ' layout ' + str(r))
SEED = """() => {
  const T = currentTarget(S); const today = todayStr();
  // 14 天：各種情況
  const plan = [
    // [daysAgo, kcalFrac, pFrac, cFrac, mark]
    [1, 1.0, 0.7, 1.0, 'done'], [2, 0.95, 0.7, 0.5, 'done'], [3, 0.92, 0.75, 1.0, null], [4, 0.9, 0.8, 0.5, null],
    [5, 0.3, 0.3, 0.3, null], [6, 0.35, 0.2, 0.3, null], [7, 1.1, 1.0, 1.0, 'done'], [8, 0.6, 0.9, 0.9, 'skip'],
    [9, 0.7, 1.0, 1.0, null], [10, 1.0, 1.0, 1.0, null], [12, 1.0, 1.0, 1.0, null], [13, 0.5, 0.95, 0.9, null] ];
  S.targets[0].date = addDays(today, -30);
  for (const [n, k, p, c, mk] of plan) { const d = addDays(today, -n);
    S.foodlog.push({ id: uid(), date: d, meal: 'l', name: '測試餐', unit: '份', qty: 1, kcal: Math.round(T.kcal * k), p: Math.round(T.p * p), c: Math.round(T.c * c), f: 10, t: Date.now() });
    if (mk) S.daydone[d] = { s: mk, t: Date.now() }; }
  S.foodlog.push({ id: uid(), date: today, meal: 'b', name: '早餐', unit: '份', qty: 1, kcal: 400, p: 20, c: 50, f: 10, t: Date.now() });
  // 訓練：在碳水低的前一天之後
  S.sessions.push({ id: 'x1', date: addDays(today, -1), start: 1, end: 2, day: 'push', plan: [] });
  S.sessions.push({ id: 'x2', date: addDays(today, -3), start: 1, end: 2, day: 'pull', plan: [] });
  save(); render(); }"""
with sync_playwright() as p:
  for vw, vh, lab in [(375, 667, 'se'), (390, 844, 'm'), (1280, 860, 'd')]:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, is_mobile=vw < 700, has_touch=vw < 700, timezone_id='Australia/Brisbane', service_workers='block')
    pg = ctx.new_page(); pg.set_default_timeout(8000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(lab + ' ' + str(e)))
    pg.goto('http://localhost:8776/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
    for i in range(7): click(pg, '[data-a="obNext"]')
    click(pg, '[data-a="obFinish"]')
    pg.evaluate(SEED)
    T = pg.evaluate("currentTarget(S)")
    # 統計邏輯
    H = pg.evaluate("foodHistory(S, todayStr(), 14)")
    st = {d['date']: d for d in H['days']}
    days = [pg.evaluate(f"addDays(todayStr(), -{n})") for n in range(14)]
    ok(st[days[0]]['pending'] and not st[days[0]]['valid'], lab + ' today pending not counted')
    ok(st[days[5]]['suspect'] and not st[days[5]]['valid'], lab + ' low day suspect')
    ok(st[days[8]]['skip'] and not st[days[8]]['valid'], lab + ' skip excluded')
    ok(st[days[2]]['done'] and st[days[2]]['valid'], lab + ' done valid')
    ok(st[days[13]]['valid'], lab + ' 50% day valid (not suspect)')
    ok(H['valid'] == 9, lab + ' valid count ' + str(H['valid']))
    ok(H['pHits'] == 5, lab + ' p hits ' + str(H['pHits']))
    wr = pg.evaluate("weekReview(S, todayStr())")
    ok(wr['loggedDays'] == 4, lab + ' week valid days ' + str(wr['loggedDays']))
    tips = pg.evaluate("foodTips(S, todayStr()).map(x=>x.k)")
    ok('pstreak' in tips, lab + ' protein streak tip ' + str(tips))
    ok('suspect' in tips, lab + ' suspect tip')
    ok('carb' in tips, lab + ' carb tip ' + str(tips))
    # 畫面
    pg.evaluate("A.tab('food')"); shot(pg, lab + '_food_day')
    click(pg, '.fhist summary'); shot(pg, lab + '_food_hist')
    ok(pg.locator('.fh-row').count() == 14, lab + ' 14 rows')
    # 點過去某天
    click(pg, f'.fh-row[data-v="{days[5]}"]')
    ok(pg.evaluate("UI.foodDate") == days[5], lab + ' foodGo')
    ok(pg.locator('.fhist[open]').count() == 1, lab + ' hist stays open')
    ok('可能沒記完' in pg.locator('#app').inner_text(), lab + ' suspect note shown')
    pg.evaluate("window.scrollTo(0,0)"); shot(pg, lab + '_food_suspect')
    # 標記完成 → 鎖定
    click(pg, f'[data-a="dayDone"][data-v="{days[5]}"]')
    ok(pg.evaluate(f"S.daydone['{days[5]}'].s") == 'done', lab + ' done saved')
    ok(pg.locator('[data-a="addFood"]').count() == 0, lab + ' add buttons hidden when locked')
    ok(pg.locator('#app [data-a="editLog"]').count() == 0, lab + ' items not editable when locked')
    n0 = pg.evaluate("S.foodlog.length")
    pg.evaluate("document.body.insertAdjacentHTML('beforeend','<button id=fake data-a=\"addFood\" data-v=\"d\">x</button>')"); pg.evaluate("document.getElementById('fake').click()"); pg.wait_for_timeout(200)
    ok(pg.locator('.sheet-wrap').count() == 0, lab + ' guard blocks addFood')
    pg.evaluate("document.getElementById('fake').remove()")
    shot(pg, lab + '_food_locked')
    # 解鎖
    click(pg, f'[data-a="dayUnlock"][data-v="{days[5]}"]'); click(pg, '.dialog [data-r="1"]')
    ok(not pg.evaluate(f"!!S.daydone['{days[5]}']"), lab + ' unlocked')
    ok(pg.locator('[data-a="addFood"]').count() == 4, lab + ' add back after unlock')
    # 沒記完
    click(pg, f'[data-a="daySkip"][data-v="{days[5]}"]'); ok(pg.evaluate(f"S.daydone['{days[5]}'].s") == 'skip', lab + ' skip saved')
    click(pg, f'[data-a="daySkipOff"][data-v="{days[5]}"]'); ok(not pg.evaluate(f"!!S.daydone['{days[5]}']"), lab + ' skip off')
    # 今天：完成 → 首頁加高蛋白被擋
    click(pg, '[data-a="foodToday"]')
    click(pg, '[data-a="dayDone"]'); ok(pg.evaluate("dayLocked(S, todayStr())"), lab + ' today locked')
    pg.evaluate("S.supp.has=true; save(); A.tab('today')")
    n1 = pg.evaluate("S.foodlog.length")
    if pg.locator('[data-a="addShake"]').count():
        click(pg, '[data-a="addShake"]'); ok(pg.evaluate("S.foodlog.length") == n1, lab + ' addShake blocked when locked')
        ok('解鎖' in pg.locator('#toast').inner_text(), lab + ' toast explains')
    else: fails.append(lab + ' no addShake button')
    pg.evaluate("window.scrollTo(0,0)"); shot(pg, lab + '_home', full=False)
    # 今天解鎖後可以加
    pg.evaluate("A.tab('food')"); click(pg, '[data-a="dayUnlock"]'); click(pg, '.dialog [data-r="1"]')
    click(pg, '[data-a="addFood"][data-v="d"]'); click(pg, '[data-a="foodTab"][data-v="all"]', top(pg)); click(pg, '[data-a="pickFood"]', top(pg)); click(pg, '[data-a="confirmFood"]', top(pg))
    ok(pg.evaluate("S.foodlog.length") == n1 + 1, lab + ' add after unlock')
    # 進度頁週回顧
    pg.evaluate("A.tab('progress')"); shot(pg, lab + '_progress')
    # 同步紀錄包含 daydone
    ok(any(k.startswith('daydone:') for k in pg.evaluate("[...syncRecords().keys()]")), lab + ' daydone synced')
    b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
