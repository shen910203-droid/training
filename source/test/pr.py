import subprocess, time, os
from playwright.sync_api import sync_playwright
OUT = '/home/claude/lgb/test/prshots'; os.makedirs(OUT, exist_ok=True)
web = subprocess.Popen(['python3', '-m', 'http.server', '8779', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
CHECK = """() => { const W=document.documentElement.clientWidth, out=[]; if (document.scrollingElement.scrollWidth>W+1) out.push('hscroll');
 for (const el of document.querySelectorAll('#app *,#layer *')) { const cs=getComputedStyle(el); if(cs.display==='none'||el.closest('svg')||el.closest('.chips.scroll')||el.classList.contains('hidden-file')) continue; const r=el.getBoundingClientRect(); if(!r.width) continue;
  if (r.right>W+1) out.push('off:'+el.className+':'+(el.textContent||'').trim().slice(0,20));
  if (el.children.length===0 && el.textContent.trim() && el.scrollWidth>el.clientWidth+2 && !el.classList.contains('ell') && !el.closest('.rxbar') && !el.closest('.warnbox') && cs.overflow!=='visible') out.push('clip:'+el.className+':'+el.textContent.trim().slice(0,20)); }
 return [...new Set(out)].slice(0,10); }"""
def click(pg, sel): pg.locator(sel).first.click(); pg.wait_for_timeout(180)
def shot(pg, n):
    pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/{n}.png'); r = pg.evaluate(CHECK)
    if r: fails.append(n + ' layout ' + str(r))
with sync_playwright() as p:
  for vw, vh, lab in [(375, 667, 'se'), (390, 844, 'm'), (1280, 860, 'd')]:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, is_mobile=vw < 700, has_touch=vw < 700, timezone_id='Australia/Brisbane', service_workers='block')
    pg = ctx.new_page(); pg.set_default_timeout(8000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(lab + ' ' + str(e)))
    pg.goto('http://localhost:8779/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
    for i in range(7): click(pg, '[data-a="obNext"]')
    click(pg, '[data-a="obFinish"]')
    # --- PR 規則（直接在資料層） ---
    pg.evaluate("""()=>{ const T=Date.now()-86400000*10; const sid0='h1';
      S.sessions.push({id:sid0,date:addDays(todayStr(),-8),day:'push',start:'10:00',end:'11:00',gymId:S.gyms[0].id,plan:['chest_press'],round:1});
      const mk=(sid,n,tw,reps,t,rir)=>({id:uid(),sid,ex:'chest_press',n,w:tw,add:0,tw,reps,rir:rir||'',fail:rir==='0',warm:false,t});
      S.sets.push(mk(sid0,1,20,10,T,'2'),mk(sid0,2,20,8,T+1,'1'),mk(sid0,3,20,7,T+2,'0'));
      S.sessions.push({id:'h2',date:addDays(todayStr(),-4),day:'push',start:'10:00',end:'11:00',gymId:S.gyms[0].id,plan:['chest_press'],round:1});
      const a=mk('h2',1,20,11,T+100), b=mk('h2',2,22,6,T+101,'1'), c=mk('h2',3,22,6,T+102,'1'), d=mk('h2',4,21,9,T+103);
      a.pr='估計 1RM 新高'; S.sets.push(a,b,c,d); recomputePRs(S); save(); window.__ids=[a.id,b.id,c.id,d.id]; }""")
    fl = pg.evaluate("__ids.map(id=>{const s=S.sets.find(x=>x.id===id); return [s.pr||null, s.rp||null]})")
    ok(fl[0][0] is None and fl[0][1] and '次數新高' in fl[0][1], lab + ' 20x11 is rep record not PR ' + str(fl[0]))
    ok(fl[1][0] and '重量新高 22kg' in fl[1][0], lab + ' 22x6 weight PR ' + str(fl[1]))
    ok(fl[2][0] is None and fl[2][1] is None, lab + ' second 22x6 no PR ' + str(fl[2]))
    ok(fl[3][0] is None and fl[3][1] and '21kg' in fl[3][1], lab + ' 21x9 = rep record at >=21kg ' + str(fl[3]))
    first = pg.evaluate("S.sets.filter(x=>x.sid==='h1').some(x=>x.pr||x.rp)"); ok(not first, lab + ' first session no PR')
    # 舊版標記開機時重算
    pg.evaluate("()=>{ S.sets.find(x=>x.id===__ids[0]).pr='估計 1RM 新高'; S.settings.prVer=0; saveNow(); }"); pg.wait_for_timeout(300)
    pg.reload(wait_until='domcontentloaded'); pg.wait_for_timeout(800)
    ok(pg.evaluate("!S.sets.find(x=>x.id===__ids?.[0])?.pr") if pg.evaluate("typeof __ids!=='undefined'") else pg.evaluate("!S.sets.some(x=>x.pr==='估計 1RM 新高')"), lab + ' legacy PR cleared on boot')
    ok(pg.evaluate("S.settings.prVer") == 2, lab + ' prVer')
    # --- 建議文字用到留幾下 ---
    sg = pg.evaluate("suggestion(S, EXMAP.chest_press, phaseOf(8), null).text")
    ok('（' in sg, lab + ' suggestion shows rir ' + sg)
    pg.evaluate("""()=>{ const T=Date.now()-86400000*2; S.sessions.push({id:'h3',date:addDays(todayStr(),-2),day:'push',start:'1',end:'2',gymId:S.gyms[0].id,plan:['incline_chest_press'],round:8});
      S.sets.push({id:uid(),sid:'h3',ex:'incline_chest_press',n:1,w:30,add:0,tw:30,reps:6,rir:'0',fail:true,warm:false,t:T}); save(); }""")
    sg2 = pg.evaluate("suggestion(S, EXMAP.incline_chest_press, phaseOf(8), null)")
    ok(sg2['type'] == 'down' and '減一格' in sg2['text'], lab + ' failed below range -> down ' + sg2['text'])
    # --- 實際訓練畫面 ---
    pg.evaluate("A.tab('train')"); click(pg, '[data-a="startSession"]')
    ok('留' in pg.locator('#ex-chest_press .prev').first.inner_text() or '力竭' in pg.locator('#ex-chest_press').inner_text(), lab + ' prev cell shows rir')
    ok('（留' in pg.locator('#ex-chest_press .exc-h').inner_text() or '（力竭' in pg.locator('#ex-chest_press .exc-h').inner_text(), lab + ' header shows rir')
    shot(pg, lab + '_session_prev')
    ok(pg.input_value('#rw-chest_press') == '22' and pg.input_value('#rr-chest_press') == '10', lab + ' prefill follows suggestion ' + pg.input_value('#rw-chest_press') + 'x' + pg.input_value('#rr-chest_press'))
    # 輸入框有焦點時按 ✓：先收鍵盤
    pg.locator('#rr-chest_press').click(); pg.fill('#rr-chest_press', '10')
    ok(pg.evaluate("document.activeElement.id") == 'rr-chest_press', lab + ' focused')
    pg.fill('#rw-chest_press', '22'); pg.locator('#rr-chest_press').focus()
    click(pg, '[data-a="saveRow"][data-v="chest_press"]')
    ok(pg.evaluate("!isField(document.activeElement)"), lab + ' blurred after save')
    st = pg.evaluate("S.sets.filter(x=>x.ex==='chest_press').slice(-1)[0]")
    ok(st['tw'] == 22 and st.get('rp') and not st.get('pr'), lab + ' 22x10 = rep record ' + str([st.get('pr'), st.get('rp')]))
    ok('進步' in pg.locator('#toast').inner_text(), lab + ' rep toast')
    ok(pg.locator('.rirbox [data-a="rowRir"]').count() == 6, lab + ' rir chips shown for normal set')
    shot(pg, lab + '_rir_chips')
    click(pg, '.rirbox [data-a="rowRir"][data-v$=":2"]')
    ok(pg.evaluate("S.sets.filter(x=>x.ex==='chest_press').slice(-1)[0].rir") == '2', lab + ' rir saved')
    ok('留2' in pg.locator('#ex-chest_press .srow.done').last.inner_text(), lab + ' done row shows 留2')
    pg.fill('#rw-chest_press', '24'); click(pg, '[data-a="saveRow"][data-v="chest_press"]')
    st2 = pg.evaluate("S.sets.filter(x=>x.ex==='chest_press').slice(-1)[0]")
    ok(st2.get('pr') and '24kg' in st2['pr'], lab + ' 24 = weight PR')
    ok('PR' in pg.locator('#toast').inner_text(), lab + ' PR toast')
    click(pg, '.rirbox [data-a="rowRir"][data-v$=":0"]')
    ok(pg.evaluate("S.sets.filter(x=>x.ex==='chest_press').slice(-1)[0].fail") is True, lab + ' fail flag')
    shot(pg, lab + '_after_fail')
    # 修改組 → 重算
    pg.locator('#ex-chest_press [data-a="editSet"]').last.click(); pg.wait_for_timeout(200)
    ok(pg.locator('[data-a="esFail"]').count() == 0, lab + ' no separate fail chip')
    pg.fill('#es-w', '20'); click(pg, '[data-a="saveEditSet"]')
    st3 = pg.evaluate("S.sets.filter(x=>x.ex==='chest_press').slice(-1)[0]")
    ok(not st3.get('pr'), lab + ' PR removed after editing down')
    # 總結
    pg.evaluate("A.sessionDetail && A.sessionDetail(liveSession().id)"); pg.wait_for_timeout(200)
    b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
