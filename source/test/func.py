import subprocess, time, json
from playwright.sync_api import sync_playwright
ROOT='/home/claude/lgb/pages'
srv=subprocess.Popen(['python3','-m','http.server','8766','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
fails=[]; errs=[]
def ok(c,m):
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},timezone_id='Australia/Brisbane'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.set_default_timeout(6000); pg.route('**/fonts.g*/**', lambda r: r.abort()); pg.goto('http://localhost:8766/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(800)
    # 快速完成引導
    for i in range(7): pg.locator('[data-a="obNext"]').click(); pg.wait_for_timeout(120)
    pg.locator('[data-a="obFinish"]').click(); pg.wait_for_timeout(300)
    ok(pg.evaluate('S.profile.startKg')==49,'profile kg')
    ok(pg.evaluate('currentTarget(S).kcal')==2670,'target kcal')
    # 循環：模擬完成腿日 -> 明天休息
    r=pg.evaluate("""()=>{ const t=todayStr(); S.settings.cycle={idx:2,round:1,restOn:null}; advanceCycle(S,addDays(t,-1)); render(); return [S.settings.cycle, document.querySelector('.hero-day .d').textContent]; }""")
    ok(r[1]=='休息日', 'rest day shown: '+str(r))
    pg.locator('[data-a="skipRest"]').click(); pg.wait_for_timeout(200)
    r=pg.evaluate("[S.settings.cycle.idx,S.settings.cycle.round,document.querySelector('.hero-day .d').textContent]")
    ok(r==[0,2,'推日'],'skip rest '+str(r))
    # 延後：昨天沒練，今天仍是推日
    r=pg.evaluate("()=>{const t=todayStr(); S.settings.cycle={idx:1,round:3,restOn:null}; render(); return document.querySelector('.hero-day .d').textContent}")
    ok(r=='拉日','postpone '+r)
    # 肌酸：打勾設定開始日，自動校正暫停
    pg.locator('[data-a="creatine"]').first.click(); pg.wait_for_timeout(150)
    ok(pg.evaluate('S.profile.creatineStart')==pg.evaluate('todayStr()'),'creatine start')
    ok('肌酸' in pg.evaluate('adaptive(S,todayStr()).msg||""'),'adaptive paused for creatine')
    # 喝水
    pg.locator('[data-a="water"][data-v="500"]').first.click(); pg.wait_for_timeout(100)
    ok(pg.evaluate('S.water[todayStr()]')==500,'water')
    # 槓鈴重量計算
    ok(pg.evaluate("totalWeight(EXMAP.bench_press,10,1.1,S)")==42.2,'barbell total')
    ok(pg.evaluate("totalWeight(EXMAP.chest_press,36,2.2,S)")==38.2,'stack total')
    # 訓練：完成 3 組 -> PR 只對過去場次
    pg.evaluate("()=>{S.settings.cycle={idx:0,round:1,restOn:null}; render();}")
    pg.locator('[data-a="startSession"]').first.click(); pg.wait_for_timeout(200)
    eid=pg.evaluate('UI.openEx')
    for w in [20,25,30]:
        pg.fill('#rw-'+eid,str(w)); pg.fill('#rr-'+eid,'10'); pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(120)
    ok(pg.evaluate("S.sets.filter(x=>x.pr).length")==0,'no PR first session')
    pg.evaluate("()=>{const s=S.sessions.find(x=>!x.end); s.end='19:00'; advanceCycle(S,s.date); save(); render();}")
    # 第二次（下一輪推日）：重量更高 -> PR
    pg.evaluate("()=>{S.settings.cycle={idx:0,round:2,restOn:null}; render();}")
    pg.locator('[data-a="startSession"]').first.click(); pg.wait_for_timeout(200)
    ok(pg.locator('#rw-'+eid).input_value()=='30','prefill from last top set '+pg.locator('#rw-'+eid).input_value())
    sug=pg.locator('.exc.open .note.brass').first.text_content()
    ok('上次 30×10' in sug,'suggestion '+sug)
    pg.fill('#rw-'+eid,'32'); pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(150)
    ok(pg.evaluate("S.sets.filter(x=>x.pr).length")==1,'PR detected')
    # 機台設定
    pg.locator('[data-a="editMachineNote"]').first.click(); pg.wait_for_timeout(150); pg.fill('#mnote2','座椅 4、椅背 3'); pg.locator('[data-a="saveMnote2"]').click(); pg.wait_for_timeout(150)
    ok('座椅 4' in pg.locator('.exc.open').text_content(),'machine note shown')
    # 換健身房 -> 建議回到試重
    pg.evaluate("()=>{const g={id:'g2',name:'台灣健身房',equip:DATA.equip.map(q=>q.id)}; S.gyms.push(g); S.settings.activeGym='g2'; render();}")
    ok('第一次做這個動作' in pg.locator('.exc.open .note.brass').first.text_content(),'new gym calibration')
    pg.evaluate("()=>{S.settings.activeGym=S.gyms[0].id; render();}")
    # 結束
    pg.evaluate("()=>{const s=S.sessions.find(x=>!x.end); s.end='19:00'; s.endTs=Date.now(); render();}")
    # 備份 / 還原
    txt=pg.evaluate("buildExport()")
    ok(json.loads(txt)['app']=='lianggongbu','export')
    pg.evaluate("()=>{S.sets=[]; save(); render();}")
    pg.evaluate("t=>{ doImport(t); }", txt); pg.wait_for_timeout(200)
    pg.locator('.dialog [data-r="1"]').click(); pg.wait_for_timeout(500)
    ok(pg.evaluate("S.sets.length")==4,'import restored sets '+str(pg.evaluate("S.sets.length")))
    # 課表編輯
    pg.evaluate("A.settings(); A.setTemplates();"); pg.wait_for_timeout(200)
    before=pg.evaluate("S.settings.templates.push.length")
    pg.locator('.sheet-wrap').last.locator('[data-a="tplDel"]').first.click(); pg.wait_for_timeout(150); pg.locator('.dialog [data-r="1"]').click(); pg.wait_for_timeout(150)
    ok(pg.evaluate("S.settings.templates.push.length")==before-1,'tpl delete')
    # 刷新後仍在
    pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(800)
    ok(pg.evaluate("S.sets.length")==4 and pg.evaluate("S.settings.templates.push.length")==before-1,'persist after reload')
    # 自訂動作
    pg.evaluate("A.tab('library')"); pg.locator('[data-a="customEx"]').click(); pg.wait_for_timeout(150); pg.fill('#cx-name','側平舉機（自訂）'); pg.locator('[data-a="saveCustomEx"]').click(); pg.wait_for_timeout(200)
    ok(pg.evaluate("S.customEx.length")==1,'custom ex')
    b.close()
srv.terminate()
print('FAILS',fails); print('ERRS',errs)
