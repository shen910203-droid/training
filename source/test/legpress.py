import subprocess, time
from playwright.sync_api import sync_playwright
web = subprocess.Popen(['python3', '-m', 'http.server', '8778', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8778/index.html'); pg.wait_for_timeout(600)
    for i in range(7): pg.locator('[data-a="obNext"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-a="obFinish"]').click(); pg.wait_for_timeout(200)
    # 模擬 Aiden 的自訂課表（腿推機沒有備選、沒有腹肌）
    pg.evaluate("""()=>{ const st=JSON.parse(JSON.stringify(S)); st.settings.templates.legs=[{ids:['smith_squat','hack_squat','squat'],sets:3},{ids:['leg_press'],sets:3},{ids:['seated_curl','lying_curl'],sets:3},{ids:['leg_ext'],sets:3},{ids:['leg_press_calf','standing_calf'],sets:2}];
      window.__m = migrate(st); }""")
    L = pg.evaluate("__m.settings.templates.legs")
    ok(L[1]['ids'] == ['leg_press', 'seated_leg_press'] and L[1]['sets'] == 3, 'leg press alt added ' + str(L[1]))
    ok(L[4]['ids'] == ['leg_press_calf', 'seated_leg_press_calf', 'standing_calf', 'seated_calf'], 'calf alts ' + str(L[4]))
    ok(L[0]['ids'] == ['smith_squat', 'hack_squat', 'squat'] and L[3]['sets'] == 3 and len(L) == 5, 'other slots untouched')
    L2 = pg.evaluate("migrate(__m).settings.templates.legs"); ok(L2 == L, 'idempotent')
    # 健身房只有坐姿蹬腿機
    pg.evaluate("""()=>{ S.settings.templates = __m.settings.templates; const g=S.gyms[0]; g.equip=g.equip.filter(x=>x!=='leg_press'&&x!=='calf_machine'); if(!g.equip.includes('seated_leg_press')) g.equip.push('seated_leg_press'); save(); }""")
    plan = pg.evaluate("dayPlan(S,'legs')")
    ok('seated_leg_press' in plan and 'leg_press' not in plan and 'seated_leg_press_calf' in plan, 'plan uses seated ' + str(plan))
    ok(pg.evaluate("dayPlanSets(S,'legs').seated_leg_press") == 3, 'sets kept 3')
    ok(pg.evaluate("rxFor(S, EXMAP.seated_leg_press, phaseOf(1), 3).rest") == 150, 'rx rest')
    ok(len(pg.evaluate("EXMAP.seated_leg_press.warn")) == 3, 'warn')
    imgs = pg.evaluate("""async()=>{const out=[]; for (const k of ['rp:horizontal-leg-press','rp:seated-calf-raise','fe:Calf_Press']) for (const f of DATA.imgmap[k]) { const r=await fetch(f); out.push(r.ok); } return out;}""")
    ok(all(imgs) and len(imgs) == 6, 'imgs ' + str(imgs))
    ok(pg.evaluate("DATA.equip.some(q=>q.id==='seated_leg_press')") and pg.evaluate("DATA.equip.some(q=>q.id==='seated_calf_machine')"), 'equip present')
    pg.evaluate("A.exDetail('seated_leg_press')"); pg.wait_for_timeout(400); pg.screenshot(path='/home/claude/lgb/test/legpress_detail.png')
    pg.evaluate("UI.sheets=[];drawSheets();A.settings();A.about&&A.about()"); pg.wait_for_timeout(200)
    b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
