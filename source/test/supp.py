import subprocess, time, os
from playwright.sync_api import sync_playwright
OUT = '/home/claude/lgb/test/suppshots'; os.makedirs(OUT, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8777', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
CHECK = """() => { const W=document.documentElement.clientWidth, out=[]; if (document.scrollingElement.scrollWidth>W+1) out.push('hscroll');
 for (const el of document.querySelectorAll('#app *,#layer *')) { const cs=getComputedStyle(el); if(cs.display==='none'||el.closest('svg')||el.closest('.chips.scroll')||el.classList.contains('hidden-file')) continue; const r=el.getBoundingClientRect(); if(!r.width) continue;
  if (r.right>W+1) out.push('off:'+el.className+':'+(el.textContent||'').trim().slice(0,20));
  if (el.children.length===0 && el.textContent.trim() && el.scrollWidth>el.clientWidth+2 && !el.classList.contains('ell') && !el.closest('.supp-it') && cs.overflow!=='visible') out.push('clip:'+el.className+':'+el.textContent.trim().slice(0,20)); }
 return [...new Set(out)].slice(0,10); }"""
def top(pg): return pg.locator('.sheet-wrap').last
def click(pg, sel, scope=None): (scope or pg).locator(sel).first.click(); pg.wait_for_timeout(180)
def shot(pg, n):
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/{n}.png'); r = pg.evaluate(CHECK)
    if r: fails.append(n + ' layout ' + str(r))
with sync_playwright() as p:
  for vw, vh, lab in [(375, 667, 'se'), (390, 844, 'm'), (1280, 860, 'd')]:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, is_mobile=vw < 700, has_touch=vw < 700, timezone_id='Australia/Brisbane', service_workers='block')
    pg = ctx.new_page(); pg.set_default_timeout(8000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(lab + ' ' + str(e)))
    pg.goto('http://localhost:8777/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
    for i in range(7): click(pg, '[data-a="obNext"]')
    click(pg, '[data-a="obFinish"]')
    # 補充品設定
    pg.evaluate("A.setSupp()"); pg.wait_for_timeout(200)
    if not pg.evaluate("S.supp.has"): click(pg, '[data-a="togHas"]', top(pg))
    click(pg, '[data-a="suppQuick"][data-v="魚油"]', top(pg)); click(pg, '[data-a="suppQuick"][data-v="鋅 Zinc+"]', top(pg))
    pg.fill('#si-name', '麩醯胺酸 5g'); pg.fill('#si-note', '早上空腹'); click(pg, '[data-a="suppAdd"]', top(pg))
    ok(len(pg.evaluate("S.supp.items")) == 3, lab + ' 3 supp items')
    pg.select_option('#s-mt', 'lf_full')
    pg.locator('#s-milk').fill('250')
    pg.evaluate("document.querySelector('.sheet-wrap:last-child .sheet-b').scrollTop=99999"); shot(pg, lab + '_supp_settings')
    click(pg, '[data-a="saveSupp"]', top(pg))
    ok(pg.evaluate("S.supp.milkType") == 'lf_full' and pg.evaluate("S.supp.milkP") == 3.3, lab + ' milk type saved')
    sk = pg.evaluate("shakeFood()"); ok(abs(sk['kcal'] - (120 + 160)) < 1 and abs(sk['p'] - (24 + 8.25)) < 0.1, lab + ' shake ' + str(sk))
    pg.evaluate("UI.sheets=[];drawSheets();A.tab('today')")
    # 打勾
    click(pg, '.supp-it'); ok(len(pg.evaluate("Object.keys(S.suppck[todayStr()]||{})")) == 1, lab + ' tick one')
    click(pg, '.supp-it >> nth=2'); ok(len(pg.evaluate("Object.keys(S.suppck[todayStr()])")) == 2, lab + ' tick two')
    click(pg, '.supp-it'); ok(len(pg.evaluate("Object.keys(S.suppck[todayStr()])")) == 1, lab + ' untick')
    ok(pg.evaluate("[...syncRecords().keys()].some(k=>k.startsWith('suppck:'))"), lab + ' suppck synced')
    pg.locator('.supp-list').scroll_into_view_if_needed(); shot(pg, lab + '_home_supp')
    # 兩份高蛋白
    pg.evaluate("window.scrollTo(0,0)"); click(pg, '[data-a="addShake"]'); click(pg, '[data-a="addShake"]')
    ok('第 2 份' in pg.locator('#toast').inner_text(), lab + ' second shake toast')
    pg.evaluate("S.foodlog=[];save();render()")
    # 早餐：高蛋白 + 燕麥 → 存成組合
    pg.evaluate("A.tab('food')")
    click(pg, '[data-a="addFood"][data-v="b"]'); click(pg, '[data-a="addShakeTo"]', top(pg))
    click(pg, '[data-a="addFood"][data-v="b"]'); click(pg, '[data-a="foodTab"][data-v="all"]', top(pg)); pg.fill('#foodq', '燕麥'); pg.wait_for_timeout(200)
    click(pg, '[data-a="pickFood"]', top(pg)); click(pg, '[data-a="confirmFood"]', top(pg))
    ok(pg.locator('[data-a="comboNew"]').count() == 1, lab + ' save combo button')
    shot(pg, lab + '_food_meal')
    click(pg, '[data-a="comboNew"]'); pg.fill('#cb-name', '早餐燕麥奶昔'); shot(pg, lab + '_combo_sheet'); click(pg, '[data-a="comboSave"]', top(pg))
    ok(pg.evaluate("S.combos.length") == 1 and len(pg.evaluate("S.combos[0].items")) == 2, lab + ' combo saved')
    # 練後：高蛋白（肌酸）
    click(pg, '[data-a="addFood"][data-v="d"]'); click(pg, '[data-a="addShakeTo"]', top(pg))
    click(pg, '[data-a="addFood"][data-v="d"]'); click(pg, '[data-a="foodTab"][data-v="all"]', top(pg)); pg.fill('#foodq', '香蕉'); pg.wait_for_timeout(200)
    click(pg, '[data-a="pickFood"]', top(pg)); click(pg, '[data-a="confirmFood"]', top(pg))
    click(pg, '[data-a="comboNew"][data-v$=":d"]'); pg.fill('#cb-name', '練後奶昔'); click(pg, '[data-a="cbCreatine"]', top(pg))
    ok(pg.input_value('#cb-name') == '練後奶昔', lab + ' name kept after toggle'); click(pg, '[data-a="comboSave"]', top(pg))
    ok(pg.evaluate("S.combos[1].creatine") is True, lab + ' creatine combo')
    # 首頁一鍵
    pg.evaluate("S.foodlog=[]; S.creatine={}; save(); A.tab('today')")
    ok(pg.locator('[data-a="addComboHome"]').count() == 2, lab + ' home combo chips')
    shot(pg, lab + '_home_combos')
    click(pg, '[data-a="addComboHome"] >> nth=1')
    ok(pg.evaluate("S.foodlog.length") == 2 and pg.evaluate("S.foodlog.every(x=>x.meal==='d')"), lab + ' combo added to dinner')
    ok(pg.evaluate("!!S.creatine[todayStr()]"), lab + ' creatine ticked by combo')
    # 新增畫面裡的組合
    pg.evaluate("A.tab('food')"); click(pg, '[data-a="addFood"][data-v="b"]')
    ok(pg.locator('[data-a="addCombo"]').count() == 2, lab + ' combos in add sheet'); shot(pg, lab + '_add_combos')
    click(pg, '[data-a="addCombo"]', top(pg)); ok(pg.evaluate("S.foodlog.filter(x=>x.meal==='b').length") == 2, lab + ' addCombo to breakfast')
    # 鎖定後擋住
    click(pg, '[data-a="dayDone"]'); pg.evaluate("A.tab('today')"); n = pg.evaluate("S.foodlog.length")
    click(pg, '[data-a="addComboHome"]'); ok(pg.evaluate("S.foodlog.length") == n, lab + ' combo blocked when locked')
    # 刪除組合
    pg.evaluate("A.tab('food')"); click(pg, '[data-a="dayUnlock"]'); click(pg, '.dialog [data-r="1"]')
    click(pg, '[data-a="addFood"][data-v="b"]'); click(pg, '[data-a="delCombo"]', top(pg)); click(pg, '.dialog [data-r="1"]')
    ok(pg.evaluate("S.combos.length") == 1, lab + ' combo deleted')
    ok(pg.evaluate("[...syncRecords().keys()].some(k=>k.startsWith('combos:'))"), lab + ' combos synced')
    b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
