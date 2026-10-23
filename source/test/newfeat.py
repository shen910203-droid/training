import subprocess, time, json, os
from playwright.sync_api import sync_playwright
OUT = '/home/claude/lgb/test/newfeat'; os.makedirs(OUT, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8772', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
CHECK = """() => { const W=document.documentElement.clientWidth, out=[]; if (document.scrollingElement.scrollWidth>W+1) out.push('hscroll');
 for (const el of document.querySelectorAll('#app *,#layer *')) { const cs=getComputedStyle(el); if(cs.display==='none'||el.closest('svg')||el.closest('.chips.scroll')||el.classList.contains('hidden-file')) continue; const r=el.getBoundingClientRect(); if(!r.width) continue;
  if (r.right>W+1) out.push('off:'+el.className+':'+(el.textContent||'').trim().slice(0,20));
  if (el.children.length===0 && el.textContent.trim() && el.scrollWidth>el.clientWidth+2 && !el.classList.contains('ell') && !el.classList.contains('prev') && !el.closest('.rxbar') && cs.overflow!=='visible') out.push('clip:'+el.className+':'+el.textContent.trim().slice(0,20)); }
 return [...new Set(out)].slice(0,10); }"""
def top(pg): return pg.locator('.sheet-wrap').last
def click(pg, sel, scope=None): (scope or pg).locator(sel).first.click(); pg.wait_for_timeout(160)
def shot(pg, n):
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/{n}.png'); r = pg.evaluate(CHECK)
    if r: fails.append(n + ' layout ' + str(r))

with sync_playwright() as p:
  for vw, vh, lab in [(375, 667, 'se'), (390, 844, 'm'), (1280, 860, 'd')]:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, is_mobile=vw < 700, has_touch=vw < 700, timezone_id='Australia/Brisbane', service_workers='block')
    pg = ctx.new_page(); pg.set_default_timeout(8000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(lab + ' ' + str(e)))
    pg.goto('http://localhost:8772/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
    for i in range(7): click(pg, '[data-a="obNext"]')
    click(pg, '[data-a="obFinish"]')
    # 新預設菜單
    push = pg.evaluate("dayPlan(S,'push')"); pull = pg.evaluate("dayPlan(S,'pull')"); legs = pg.evaluate("dayPlan(S,'legs')")
    ok(push == ['chest_press', 'incline_chest_press', 'cable_lateral', 'machine_shoulder_press', 'face_pull', 'rope_pushdown'], lab + ' push ' + str(push))
    ok(pull == ['lat_pulldown', 'seated_cable_row', 'machine_row', 'reverse_pec_deck', 'cable_lateral', 'curl_machine', 'rope_hammer'], lab + ' pull ' + str(pull))
    ok(legs == ['smith_squat', 'leg_press', 'seated_curl', 'leg_ext', 'leg_press_calf', 'cable_crunch'], lab + ' legs ' + str(legs))
    # 健身房沒有某器材 → 自動換備選
    pg.evaluate("S.gyms[0].equip=S.gyms[0].equip.filter(x=>x!=='row_machine');save()")
    pull2 = pg.evaluate("dayPlan(S,'pull')"); ok('machine_row' not in pull2 and 'tbar_row' in pull2, lab + ' fallback ' + str(pull2))
    pg.evaluate("S.gyms[0].equip.push('row_machine');save()")
    # 課表畫面
    pg.evaluate("A.tab('train')"); shot(pg, lab + '_train')
    click(pg, '[data-a="openTpl"]'); shot(pg, lab + '_tpl')
    # 調整：推日第 3 格（側平舉）改 5 組、12-18 下、休息 90
    click(pg, '[data-a="tplRx"][data-v="push:2"]', top(pg)); shot(pg, lab + '_rxedit')
    click(pg, '[data-a="rxStep"][data-v="sets:1"]', top(pg))
    pg.fill('#rx-lo', '12'); pg.fill('#rx-hi', '18'); click(pg, '[data-a="rxRest"][data-v="90"]', top(pg)); click(pg, '[data-a="rxSave"]', top(pg))
    ok(pg.evaluate("S.settings.templates.push[2].sets") == 5 and pg.evaluate("JSON.stringify(S.rxu.cable_lateral)") == '{"hi":18,"rest":90}', lab + ' rx saved ' + pg.evaluate("JSON.stringify([S.settings.templates.push[2],S.rxu])"))
    # 錯誤輸入
    click(pg, '[data-a="tplRx"][data-v="push:0"]', top(pg)); pg.fill('#rx-lo', '12'); pg.fill('#rx-hi', '8'); click(pg, '[data-a="rxSave"]', top(pg))
    ok('最多次數' in pg.locator('#rx-warn').text_content(), lab + ' rx validation')
    click(pg, '[data-a="rxDefault"]', top(pg))
    # 新增、移動、換、刪
    n0 = pg.evaluate("S.settings.templates.legs.length")
    click(pg, '[data-a="tplAdd"][data-v="legs"]', top(pg)); pg.fill('#pickq', '髖外展'); pg.wait_for_timeout(200); click(pg, '[data-a="pickEx"]', top(pg))
    ok(pg.evaluate("S.settings.templates.legs.length") == n0 + 1 and pg.evaluate("S.settings.templates.legs.at(-1).ids[0]") == 'abductor', lab + ' tplAdd')
    last = n0
    click(pg, f'[data-a="tplMove"][data-v="legs:{last}"]', top(pg))
    ok(pg.evaluate(f"S.settings.templates.legs[{last-1}].ids[0]") == 'abductor', lab + ' tplMove')
    click(pg, f'[data-a="tplSwap"][data-v="legs:{last-1}"]', top(pg)); pg.fill('#pickq', '髖內收'); pg.wait_for_timeout(200); click(pg, '[data-a="pickEx"]', top(pg))
    ok(pg.evaluate(f"S.settings.templates.legs[{last-1}].ids[0]") == 'adductor', lab + ' tplSwap')
    click(pg, f'[data-a="tplDel"][data-v="legs:{last-1}"]', top(pg)); click(pg, '.dialog [data-r="1"]')
    ok(pg.evaluate("S.settings.templates.legs.length") == n0, lab + ' tplDel')
    shot(pg, lab + '_tpl_after')
    # 自訂動作加入課表
    pg.evaluate("UI.sheets=[];drawSheets();A.tab('library')"); click(pg, '[data-a="customEx"]'); pg.fill('#cx-name', '坐姿小腿機'); pg.select_option('#cx-day', 'legs'); pg.select_option('#cx-pri', 'calves'); click(pg, '[data-a="saveCustomEx"]', top(pg))
    cid = pg.evaluate("S.customEx[0].id"); shot(pg, lab + '_custom_detail')
    pg.evaluate("UI.sheets=[];drawSheets();A.openTpl()")
    click(pg, '[data-a="tplAdd"][data-v="legs"]', top(pg)); pg.fill('#pickq', '坐姿小腿'); pg.wait_for_timeout(200); click(pg, '[data-a="pickEx"]', top(pg))
    ok(cid in pg.evaluate("dayPlan(S,'legs')"), lab + ' custom in plan')
    pg.evaluate("UI.sheets=[];drawSheets()")
    # 推日訓練：組數依課表、休息依動作
    pg.evaluate("A.tab('train')"); click(pg, '[data-a="startSession"][data-v="push"]')
    shot(pg, lab + '_session')
    ok(pg.locator('#ex-chest_press .tag').first.text_content().strip() == '0/3', lab + ' chest 3 sets')
    ok(pg.evaluate("sessionRx(S,liveSession(),EXMAP.cable_lateral).sets") == 5, lab + ' lateral 5 sets from slot')
    pg.fill('#rw-chest_press', '20'); pg.fill('#rr-chest_press', '12'); click(pg, '[data-a="saveRow"][data-v="chest_press"]')
    t = pg.locator('#timer .t').text_content(); ok(t in ('2:30', '2:29'), lab + ' rest timer chest ' + t)
    shot(pg, lab + '_session_set')
    # 注意事項展開
    click(pg, '#ex-chest_press .warnbox summary'); shot(pg, lab + '_warn_open')
    click(pg, '[data-a="doneEx"][data-v="chest_press"]')
    eid = pg.evaluate("UI.openEx"); pg.fill(f'#rw-{eid}', '15'); click(pg, f'[data-a="saveRow"][data-v="{eid}"]')
    # 結束 → 三選一 → 保留但下次再練
    click(pg, '[data-a="finishSession"]'); shot(pg, lab + '_finish_choice')
    ok(pg.locator('.dialog [data-r]').count() == 3, lab + ' 3 choices')
    idx_before = pg.evaluate("S.settings.cycle.idx")
    click(pg, '.dialog [data-r="2"]')
    ok(pg.evaluate("S.settings.cycle.idx") == idx_before and pg.evaluate("S.sessions[0].partial") is True, lab + ' partial keeps cycle')
    ok(pg.evaluate("S.sets.length") == 2, lab + ' partial keeps sets')
    pg.locator('.sheet-wrap').last.locator('[data-a="closeSheet"]').click(); pg.wait_for_timeout(150)
    pg.evaluate("A.tab('today')"); shot(pg, lab + '_today_partial')
    ok('今天練了一部分' in pg.locator('#app').text_content(), lab + ' today partial label')
    # 再練一次推日 → 上次重量帶入 → 結束算完成
    pg.evaluate("S.sessions[0].date=addDays(todayStr(),-1);save();A.tab('train')")
    ok(pg.evaluate("nextTrainDay(S)") == 'push', lab + ' still push')
    click(pg, '[data-a="startSession"][data-v="push"]')
    ok(pg.locator('#rw-chest_press').input_value() == '20', lab + ' prefill after partial')
    click(pg, '[data-a="saveRow"][data-v="chest_press"]')
    click(pg, '[data-a="finishSession"]'); click(pg, '.dialog [data-r="1"]')
    ok(pg.evaluate("ORDER[S.settings.cycle.idx]") == 'pull', lab + ' done advances')
    pg.locator('.sheet-wrap').last.locator('[data-a="closeSheet"]').click(); pg.wait_for_timeout(150)
    # 一碗半
    pg.evaluate("A.tab('food')"); click(pg, '[data-a="addFood"][data-v="l"]'); click(pg, '[data-a="foodTab"][data-v="all"]', top(pg)); click(pg, '[data-a="pickFood"]', top(pg))
    click(pg, '[data-a="qtySet"][data-v="1.5"]', top(pg)); shot(pg, lab + '_rice15'); click(pg, '[data-a="confirmFood"]', top(pg))
    ok(pg.evaluate("S.foodlog.at(-1).qty") == 1.5 and pg.evaluate("S.foodlog.at(-1).kcal") == 420, lab + ' 1.5 bowls ' + str(pg.evaluate("S.foodlog.at(-1)")))
    # 動作說明：建議做法、注意
    pg.evaluate("A.exDetail('smith_squat')"); shot(pg, lab + '_detail_rx')
    pg.locator('.sheet-b').last.evaluate('e=>e.scrollTop=600'); shot(pg, lab + '_detail_rx2')
    pg.evaluate("UI.sheets=[];drawSheets();A.settings();A.setCycle()"); shot(pg, lab + '_cycle')
    pg.evaluate("UI.sheets=[];drawSheets();A.settings();A.setTraining()"); shot(pg, lab + '_trainset')
    b.close()

  # ===== 舊版資料升級 =====
  b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); pg = ctx.new_page(); pg.route('**/fonts.g*/**', lambda r: r.abort())
  pg.on('pageerror', lambda e: errs.append('mig ' + str(e)))
  pg.goto('http://localhost:8772/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(500)
  # 舊預設課表 → 自動換新菜單
  pg.evaluate("""async()=>{ const st=blankState(); st.profile={sex:'m',birthYear:2002,height:174,startKg:49,goal:'bulk',act:1.55,createdAt:todayStr()}; st.gyms=[{id:'g',name:'x',equip:DATA.equip.map(q=>q.id)}]; st.settings.activeGym='g'; st.settings.templates=JSON.parse(JSON.stringify(DATA.oldTemplates)); await Store.set('state',st); }""")
  pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(600)
  ok(pg.evaluate("S.settings.templates.push[0].sets") == 3 and pg.evaluate("S.settings.tplUpgraded") is True, 'old default upgraded')
  # 自己改過的舊課表 → 保留內容只轉格式
  pg.evaluate("""async()=>{ const st=JSON.parse(JSON.stringify(S)); st.settings.tplVer=undefined; st.settings.templates=JSON.parse(JSON.stringify(DATA.oldTemplates)); st.settings.templates.push.splice(2,1); await Store.set('state',st); }""")
  pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(600)
  ok(pg.evaluate("S.settings.templates.push.length") == 5 and pg.evaluate("S.settings.templates.push[0].ids[0]") == 'chest_press' and pg.evaluate("S.settings.tplUpgraded") is False, 'custom old kept ' + pg.evaluate("JSON.stringify(S.settings.templates.push[0])"))
  ok(pg.evaluate("dayPlan(S,'push').length") == 5, 'converted plan works')
  b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
