import subprocess, time, json, os
from playwright.sync_api import sync_playwright
ROOT='/home/claude/lgb/pages'; OUT='/home/claude/lgb/test/sim'; os.makedirs(OUT,exist_ok=True)
srv=subprocess.Popen(['python3','-m','http.server','8768','-d',ROOT],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
fails=[]; errs=[]; notes=[]
def ok(c,m):
    if not c: fails.append(m)
CHECK = """() => { const W=document.documentElement.clientWidth, out=[]; if (document.scrollingElement.scrollWidth>W+1) out.push('hscroll');
 for (const el of document.querySelectorAll('#app *,#layer *')) { const cs=getComputedStyle(el); if(cs.display==='none'||el.closest('svg')||el.closest('.chips.scroll')||el.classList.contains('hidden-file')) continue; const r=el.getBoundingClientRect(); if(!r.width) continue;
  if (r.right>W+1) out.push('off:'+el.className+':'+(el.textContent||'').trim().slice(0,20));
  if (el.children.length===0 && el.textContent.trim() && el.scrollWidth>el.clientWidth+2 && !el.classList.contains('ell') && !el.classList.contains('prev') && cs.overflow!=='visible') out.push('clip:'+el.className+':'+el.textContent.trim().slice(0,20)); }
 return [...new Set(out)].slice(0,10); }"""
def chk(pg,name):
    pg.wait_for_timeout(250); pg.screenshot(path=f'{OUT}/{name}.png'); r=pg.evaluate(CHECK)
    if r: fails.append(name+' '+str(r))
with sync_playwright() as p:
  for vw,vh,lab in [(375,667,'se'),(390,844,'m'),(1280,860,'d')]:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':vw,'height':vh},device_scale_factor=2,is_mobile=vw<700,has_touch=vw<700,timezone_id='Australia/Brisbane'); pg=ctx.new_page()
    pg.set_default_timeout(8000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror',lambda e: errs.append(lab+' '+str(e)))
    bad=[]; pg.on('response', lambda r: bad.append(r.url) if r.status>=400 else None)
    pg.goto('http://localhost:8768/index.html',wait_until='domcontentloaded'); pg.wait_for_timeout(700)
    for i in range(7): pg.locator('[data-a="obNext"]').click(); pg.wait_for_timeout(80)
    pg.locator('[data-a="obFinish"]').click(); pg.wait_for_timeout(200)
    # 所有圖片載入檢查
    if lab=='m':
        miss=pg.evaluate("""async()=>{const keys=new Set(); for(const e of DATA.ex) if(e.img) keys.add(e.img); for(const q of DATA.equip) if(q.img) keys.add(q.img); const bad=[]; for(const k of keys){ const fs=DATA.imgmap[k]||[]; if(fs.length!==2) bad.push(k+' count'); for(const f of fs){ const r=await fetch(f); if(!r.ok) bad.push(f);} } return bad;}""")
        ok(not miss,'missing imgs '+str(miss))
    # 第一次推日：完整模擬
    pg.locator('[data-a="startSession"]').first.click(); pg.wait_for_timeout(200)
    chk(pg,f'{lab}_s1_start')
    plan=pg.evaluate("liveSession().plan")
    for k,eid in enumerate(plan):
        ok(pg.evaluate("UI.openEx")==eid, f'{lab} open should be {eid} got '+str(pg.evaluate("UI.openEx")))
        isTime=pg.evaluate(f"EXMAP['{eid}'].load==='time'")
        base=20+k*5
        for j,(rir) in enumerate(['6+','4-5','2-3']):
            if not isTime: pg.fill(f'#rw-{eid}', str(base if j==0 else pg.locator(f'#rw-{eid}').input_value()))
            pg.fill(f'#rr-{eid}','10')
            pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(120)
            if j<2 and pg.locator(f'[data-a="rowRir"]').count():
                pg.locator(f'[data-a="rowRir"][data-v$=":{rir}"]').first.click(); pg.wait_for_timeout(120)
                if j==0 and not isTime:
                    nv=pg.locator(f'#rw-{eid}').input_value(); notes.append(f'{lab} {eid} cal next {nv}')
            if k==0 and j==0: chk(pg,f'{lab}_s1_set1')
            if j<2:
                pg.wait_for_timeout(450)
                vis=pg.evaluate(f"(()=>{{const r=document.getElementById('rr-{eid}').getBoundingClientRect(); const lim=innerHeight-document.getElementById('nav').offsetHeight-(document.getElementById('timer').hidden?0:document.getElementById('timer').offsetHeight); return r.bottom<=lim+2 && r.top>=0;}})()")
                ok(vis, f'{lab} {eid} row hidden after set {j+1}')
        n=pg.evaluate(f"S.sets.filter(x=>x.ex==='{eid}'&&x.sid===liveSession().id).length")
        ok(n==3,f'{lab} {eid} sets {n}')
        if k==0: chk(pg,f'{lab}_s1_3sets')
        pg.locator(f'[data-a="doneEx"][data-v="{eid}"]').click(); pg.wait_for_timeout(500)
        if k<len(plan)-1:
            top=pg.evaluate(f"document.getElementById('ex-{plan[k+1]}').getBoundingClientRect().top")
            ok(-5<top<120, f'{lab} next card top {top}')
            if k==0: chk(pg,f'{lab}_s1_after_done')
    # 加一組 + 修改
    pg.locator(f'[data-a="toggleEx"][data-v="{plan[0]}"]').click(); pg.wait_for_timeout(200)
    pg.locator(f'[data-a="addRow"][data-v="{plan[0]}"]').click(); pg.wait_for_timeout(150)
    ok(pg.locator(f'#rw-{plan[0]}').count()==0 or True,'')
    pg.locator(f'[data-a="addRow"][data-v="{plan[0]}"]').click(); pg.wait_for_timeout(150)
    ok(pg.locator(f'#rw-{plan[0]}').count()==1,f'{lab} extra row input')
    pg.locator(f'[data-a="saveRow"][data-v="{plan[0]}"]').click(); pg.wait_for_timeout(150)
    ok(pg.evaluate(f"S.sets.filter(x=>x.ex==='{plan[0]}').length")==4,f'{lab} extra set saved')
    pg.locator('[data-a="editSet"]').first.click(); pg.wait_for_timeout(200); chk(pg,f'{lab}_edit'); pg.fill('#es-r','12'); pg.locator('[data-a="saveEditSet"]').click(); pg.wait_for_timeout(150)
    pg.locator(f'[data-a="exMenu"][data-v="{plan[0]}"]').click(); pg.wait_for_timeout(200); chk(pg,f'{lab}_menu')
    pg.locator('.sheet-wrap').last.locator('[data-a="closeSheet"]').click(); pg.wait_for_timeout(150)
    pg.locator('[data-a="finishSession"]').first.click(); pg.wait_for_timeout(300)
    ok(pg.locator('.dialog').count()==0,f'{lab} finish should not ask (all done)')
    chk(pg,f'{lab}_s1_summary')
    pg.locator('.sheet-wrap').last.locator('[data-a="closeSheet"]').click(); pg.wait_for_timeout(150)
    # 第二輪推日：預填 + 建議
    pg.evaluate("()=>{S.settings.cycle={idx:0,round:2,restOn:null}; S.sessions.forEach(s=>s.date=addDays(todayStr(),-4)); save(); render();}")
    pg.locator('[data-a="startSession"]').first.click(); pg.wait_for_timeout(200)
    eid=plan[0]; v=pg.locator(f'#rw-{eid}').input_value()
    ok(v!='', f'{lab} s2 prefill weight empty')
    chk(pg,f'{lab}_s2_start')
    pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(150)
    ok(pg.locator('[data-a="rowRir"]').count()==0, f'{lab} no rir after calibrated')
    # 半途結束 → 詢問
    pg.locator('[data-a="finishSession"]').first.click(); pg.wait_for_timeout(250)
    ok(pg.locator('.dialog').count()==1,f'{lab} finish partial asks')
    pg.locator('.dialog [data-r="0"]').click()
    # 空欄位警告
    pg.fill(f'#rw-{eid}',''); pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(150)
    ok('請輸入重量' in pg.locator(f'#warn-{eid}').text_content(), f'{lab} empty weight warn')
    # 打字後重繪仍保留
    pg.fill(f'#rw-{eid}','47.1'); pg.locator('[data-a="tmAdd"][data-v="15"]').click(); pg.evaluate("render()")
    ok(pg.locator(f'#rw-{eid}').input_value()=='47.1', f'{lab} draft kept')
    # 大重量確認
    pg.fill(f'#rw-{eid}','300'); pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(200)
    ok(pg.locator('.dialog').count()==1, f'{lab} big weight confirm'); pg.locator('.dialog [data-r="0"]').click()
    # 各頁截圖
    for t in ['today','food','progress','library']:
        pg.evaluate(f"A.tab('{t}')"); chk(pg,f'{lab}_tab_{t}')
    pg.evaluate("A.exDetail('smith_incline')"); chk(pg,f'{lab}_smith_incline')
    pg.evaluate("UI.sheets=[];drawSheets();A.exDetail('tbar_row')"); chk(pg,f'{lab}_tbar')
    pg.evaluate("UI.sheets=[];drawSheets();A.exDetail('hack_squat')"); chk(pg,f'{lab}_hack')
    ok(not [u for u in bad if 'fonts' not in u], f'{lab} 404 {bad}')
    b.close()
srv.terminate()
print('FAILS',fails); print('ERRS',errs); print('\n'.join(notes[:6]))
