import sys, os, json, subprocess, time
from playwright.sync_api import sync_playwright
ROOT = '/home/claude/lgb/pages'
OUT = '/home/claude/lgb/test/shots'
os.makedirs(OUT, exist_ok=True)
# 複製圖片到 pages
subprocess.run(['rm', '-rf', ROOT + '/img']); subprocess.run(['cp', '-r', '/home/claude/lgb/dist/img', ROOT + '/img'])
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
problems = []

CHECK_JS = """() => {
 const W = document.documentElement.clientWidth; const out = [];
 if (document.scrollingElement.scrollWidth > W + 1) out.push('page horizontal scroll ' + document.scrollingElement.scrollWidth + '>' + W);
 const els = document.querySelectorAll('#app *, #layer *, #timer *, #nav *');
 for (const el of els) {
   const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
   const r = el.getBoundingClientRect(); if (!r.width) continue;
   if (el.closest('.chips.scroll') || el.closest('svg') || el.closest('.sheet-wrap[style*="hidden"]')) continue;
   if (r.right > W + 1 && r.width < W * 3) out.push('offscreen: ' + el.tagName + '.' + el.className + ' "' + (el.textContent||'').trim().slice(0,30) + '" right=' + Math.round(r.right));
   if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0 && !el.closest('.sheet-h'))
     out.push('clipped: ' + el.tagName + '.' + el.className + ' "' + (el.textContent||'').trim().slice(0,30) + '"');
   if (el.children.length === 0 && el.textContent.trim() && ['BUTTON','SPAN','DIV','B','LABEL'].includes(el.tagName) && cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 2)
     out.push('nowrap overflow: ' + el.tagName + '.' + el.className + ' "' + el.textContent.trim().slice(0,30) + '"');
 }
 return [...new Set(out)].slice(0, 20);
}"""

def shot(page, name):
    page.wait_for_timeout(350)
    page.screenshot(path=f'{OUT}/{name}.png', full_page=False)
    res = page.evaluate(CHECK_JS)
    if res: problems.append((name, res))

def click(page, sel, nth=0):
    loc = page.locator(sel)
    loc.nth(nth).click()
    page.wait_for_timeout(250)

def closeTop(page):
    page.locator('.sheet-wrap').last.locator('[data-a="closeSheet"]').first.click(); page.wait_for_timeout(250)

def flow(p, label, vw, vh):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, has_touch=vw < 700, is_mobile=vw < 700, locale='zh-TW', timezone_id='Australia/Brisbane')
    page = ctx.new_page(); page.route('**/fonts.g*/**', lambda r: r.abort()); page.route('**/openfoodfacts.org/**', lambda r: r.abort())
    page.on('console', lambda m: errors.append(f'[{label}] console {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'[{label}] pageerror: {e}'))
    page.goto('http://localhost:8765/index.html'); page.wait_for_timeout(1200)
    # 引導
    for i in range(8):
        shot(page, f'{label}_ob{i}')
        if i == 7: click(page, '[data-a="obFinish"]'); break
        click(page, '[data-a="obNext"]')
    shot(page, f'{label}_today')
    page.evaluate('window.scrollTo(0, 2000)'); shot(page, f'{label}_today_bottom'); page.evaluate('window.scrollTo(0,0)')
    # 訓練
    click(page, '[data-a="startSession"]')
    shot(page, f'{label}_session')
    eid = page.evaluate('UI.openEx')
    for w in (20, 24, 27):
        page.fill(f'#rw-{eid}', str(w)); page.fill(f'#rr-{eid}', '10'); click(page, f'[data-a="saveRow"][data-v="{eid}"]')
    shot(page, f'{label}_session_after3')
    if not page.locator('#timer .in').count(): problems.append((label, ['timer not shown']))
    click(page, f'[data-a="doneEx"][data-v="{eid}"]')
    eid2 = page.evaluate('UI.openEx')
    page.fill(f'#rw-{eid2}', '30'); click(page, f'[data-a="saveRow"][data-v="{eid2}"]')
    page.fill(f'#rw-{eid2}', '60'); page.locator(f'[data-a="saveRow"][data-v="{eid2}"]').click(); page.wait_for_timeout(250)
    shot(page, f'{label}_bigweight_warn'); click(page, '.dialog [data-r="1"]')
    click(page, f'[data-a="exMenu"][data-v="{eid2}"]'); shot(page, f'{label}_exmenu')
    page.locator('.sheet-wrap').last.locator('[data-a="exMenuGo"]').first.click(); page.wait_for_timeout(300)
    shot(page, f'{label}_exdetail')
    page.locator('.sheet-b').last.evaluate('e=>e.scrollTop=900'); shot(page, f'{label}_exdetail2')
    page.locator('.sheet-b').last.evaluate('e=>e.scrollTop=2200'); shot(page, f'{label}_exdetail3')
    page.fill('#vurl', 'https://www.youtube.com/watch?v=abc123'); page.fill('#vnote', '看 0:45 握法'); click(page, '[data-a="addVideo"]')
    closeTop(page)
    click(page, f'[data-a="exMenu"][data-v="{eid2}"]'); page.locator('.sheet-wrap').last.locator('[data-a="exMenuGo"][data-v^="swapEx"]').click(); page.wait_for_timeout(250)
    shot(page, f'{label}_swap'); click(page, '[data-a="pickEx"]')
    page.wait_for_timeout(300); shot(page, f'{label}_swap_confirm')
    click(page, '.dialog [data-r="0"]')
    # 結束
    click(page, '[data-a="finishSession"]'); shot(page, f'{label}_finish_confirm'); click(page, '.dialog [data-r="1"]')
    shot(page, f'{label}_summary'); print(label,'sheets at summary', page.evaluate('UI.sheets.map(s=>s.id)')); closeTop(page)
    # 飲食
    click(page, '#nav [data-v="food"]'); shot(page, f'{label}_food')
    click(page, '[data-a="addFood"][data-v="b"]'); shot(page, f'{label}_addfood_fav')
    click(page, '[data-a="foodTab"][data-v="all"]'); shot(page, f'{label}_addfood_all')
    click(page, '[data-a="pickFood"]'); shot(page, f'{label}_qty'); click(page, '[data-a="qty"][data-v="0.5"]'); click(page, '[data-a="confirmFood"]')
    click(page, '[data-a="addFood"][data-v="l"]'); click(page, '[data-a="foodTab"][data-v="quick"]'); page.fill('#q-k', '750'); page.fill('#q-p', '30'); click(page, '[data-a="quickAdd"]')
    click(page, '[data-a="addFood"][data-v="s"]'); click(page, '[data-a="scanFood"]'); page.wait_for_timeout(500); shot(page, f'{label}_scan')
    page.fill('#scancode', '4710000000001'); click(page, '[data-a="scanManual"]'); page.wait_for_timeout(800); shot(page, f'{label}_bcfood'); closeTop(page); closeTop(page)
    click(page, '[data-a="addFood"][data-v="d"]'); click(page, '[data-a="foodTab"][data-v="new"]'); shot(page, f'{label}_newfood')
    page.fill('#n-name', 'Coles 雞胸肉'); page.fill('#n-unit', '1 包'); page.fill('#n-k', '165'); page.fill('#n-p', '31'); click(page, '[data-a="newFood"]')
    click(page, '[data-a="water"][data-v="500"]')
    shot(page, f'{label}_food_after')
    page.evaluate('window.scrollTo(0, 3000)'); shot(page, f'{label}_food_bottom'); page.evaluate('window.scrollTo(0,0)')
    # 進度
    click(page, '#nav [data-v="progress"]'); shot(page, f'{label}_prog')
    page.evaluate('window.scrollTo(0, 900)'); shot(page, f'{label}_prog2'); page.evaluate('window.scrollTo(0, 2500)'); shot(page, f'{label}_prog3'); page.evaluate('window.scrollTo(0,0)')
    for seg in ['body', 'lifts', 'photos']:
        click(page, f'[data-a="progSeg"][data-v="{seg}"]'); shot(page, f'{label}_prog_{seg}')
    click(page, '[data-a="progSeg"][data-v="overview"]'); click(page, '[data-a="aiCopy"]'); shot(page, f'{label}_ai'); closeTop(page)
    # 動作庫
    click(page, '#nav [data-v="library"]'); shot(page, f'{label}_lib')
    click(page, '[data-a="libMine"]'); page.evaluate('window.scrollTo(0, 99999)'); shot(page, f'{label}_lib_all_bottom'); page.evaluate('window.scrollTo(0,0)')
    # 設定
    click(page, '#nav [data-v="today"]'); click(page, '[data-a="settings"]'); shot(page, f'{label}_settings')
    for a in ['cloud', 'setProfile', 'setGyms', 'setTemplates', 'setCycle', 'setTraining', 'setSupp', 'backup', 'about']:
        page.locator('.sheet-wrap').last.locator(f'[data-a="{a}"]').first.click(); page.wait_for_timeout(300); shot(page, f'{label}_set_{a}')
        if a == 'setGyms':
            page.locator('.sheet-wrap').last.locator('[data-a="gymEquip"]').first.click(); page.wait_for_timeout(300); shot(page, f'{label}_equip'); closeTop(page)
        closeTop(page)
    closeTop(page)
    # 體重
    click(page, '[data-a="addWeight"]'); page.fill('#w-kg', '49.4'); click(page, '[data-a="saveWeight"]')
    # 重新整理後資料還在？
    page.reload(); page.wait_for_timeout(1200)
    n = page.evaluate('S.sets.length'); fl = page.evaluate('S.foodlog.length'); vid = page.evaluate('Object.values(S.exu).reduce((a,u)=>a+(u.videos||[]).length,0)')
    if n < 5 or fl < 3 or vid < 1: problems.append((label, [f'persist fail sets={n} food={fl} vids={vid}']))
    shot(page, f'{label}_reload')
    b.close()

def seeded(p, label, vw, vh):
    """塞 5 週假資料測自動校正、圖表"""
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=2, is_mobile=vw < 700, has_touch=vw < 700, timezone_id='Australia/Brisbane')
    page = ctx.new_page(); page.route('**/fonts.g*/**', lambda r: r.abort())
    page.on('pageerror', lambda e: errors.append(f'[{label}] pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'[{label}] console {m.type}: {m.text}') if m.type in ('error',) else None)
    page.goto('http://localhost:8765/index.html'); page.wait_for_timeout(1000)
    page.evaluate("""() => {
      const t = todayStr();
      S.profile = {sex:'m',birthYear:2002,height:174,startKg:49,goal:'bulk',act:1.55,createdAt:addDays(t,-35),creatineStart:null};
      const g={id:'g1',name:'Brisbane 健身房',equip:DATA.equip.map(q=>q.id)}; S.gyms=[g]; S.settings.activeGym='g1'; S.settings.templates=defaultTemplates(); S.settings.onboarded=true;
      S.targets=[Object.assign({date:addDays(t,-35),reason:'首次設定（公式）'},calcTargets(S.profile,49))];
      S.weights=[]; for(let i=35;i>=0;i-=4) S.weights.push({date:addDays(t,-i),kg:Math.round((49+ (35-i)*0.005 + (Math.random()-.5)*0.3)*10)/10});
      S.foodlog=[]; for(let i=30;i>=1;i--){ if(i%5===0) continue; S.foodlog.push({id:uid(),date:addDays(t,-i),meal:'l',name:'便當',unit:'1 個',qty:1,kcal:2300+Math.round(Math.random()*300),p:85,c:300,f:70}); }
      const days=['push','pull','legs']; let r=1; let k=0;
      for(let i=34;i>=2;i-=4){ for(let j=0;j<3;j++){ const d=addDays(t,-i+j); const day=days[j]; const sid=uid(); S.sessions.push({id:sid,date:d,tz:'Australia/Brisbane',gymId:'g1',day,round:r,start:'18:00',startTs:0,end:'19:00',plan:dayPlan(S,day)});
        dayPlan(S,day).forEach(ex=>{ const e=EXMAP[ex]; for(let n=1;n<=3;n++){ const w=20+k*1+n*2; S.sets.push({id:uid(),sid,ex,n,w,add:0,tw:totalWeight(e,w,0,S),reps:8+n,rir:'2-3',warm:false}); } }); }
        r++; k++; }
      S.settings.cycle={idx:0,round:r,restOn:null};
      S.measures=[{id:uid(),date:addDays(t,-20),waist:70,arm:26,chest:84},{id:uid(),date:t,waist:70.5,arm:27,chest:86}];
      saveNow();
    }""")
    page.reload(); page.wait_for_timeout(1200)
    shot(page, f'{label}_seed_today')
    page.evaluate('window.scrollTo(0, 1200)'); shot(page, f'{label}_seed_today2'); page.evaluate('window.scrollTo(0,0)')
    click(page, '#nav [data-v="progress"]'); shot(page, f'{label}_seed_prog')
    page.evaluate('window.scrollTo(0, 800)'); shot(page, f'{label}_seed_prog2')
    page.evaluate('window.scrollTo(0, 1700)'); shot(page, f'{label}_seed_prog3'); page.evaluate('window.scrollTo(0,0)')
    click(page, '[data-a="progSeg"][data-v="body"]'); shot(page, f'{label}_seed_body')
    click(page, '[data-a="progSeg"][data-v="lifts"]'); shot(page, f'{label}_seed_lifts')
    click(page, '[data-a="exDetail"]'); page.locator('.sheet-b').last.evaluate('e=>e.scrollTop=2000'); shot(page, f'{label}_seed_exhist')
    closeTop(page)
    click(page, '#nav [data-v="train"]'); shot(page, f'{label}_seed_train')
    click(page, '[data-a="startSession"]'); shot(page, f'{label}_seed_session')
    ad = page.evaluate('JSON.stringify(adaptive(S,todayStr()))')
    print(label, 'adaptive:', ad)
    b.close()

with sync_playwright() as p:
    flow(p, 'm', 390, 844)
    flow(p, 'd', 1280, 860)
    seeded(p, 'ms', 390, 844)
    seeded(p, 'ds', 1280, 860)
srv.terminate()
print('ERRORS:'); [print(' ', e) for e in errors]
print('PROBLEMS:'); [print(' ', n, r) for n, r in problems]
