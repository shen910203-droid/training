import subprocess, time, json, os, urllib.request
from playwright.sync_api import sync_playwright
T = '/home/claude/lgb/test'
OUT = T + '/cloud'; os.makedirs(OUT, exist_ok=True)
gas = subprocess.Popen(['node', T + '/gas/mock.js', '/home/claude/lgb/server/Code.gs', '8790'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
web = subprocess.Popen(['python3', '-m', 'http.server', '8770', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
CLOUD = 'http://localhost:8790/exec'
fails, errs, log = [], [], []
def ok(c, m):
    (log if c else fails).append(m)
def server(): return json.loads(urllib.request.urlopen('http://localhost:8790/__state').read())
def sreset(): urllib.request.urlopen('http://localhost:8790/__reset').read()

OFF = {"status": 1, "product": {"product_name": "Protein Yoghurt", "brands": "Chobani", "serving_size": "170 g", "serving_quantity": 170,
       "nutriments": {"energy-kcal_100g": 70, "proteins_100g": 9.4, "carbohydrates_100g": 5.2, "fat_100g": 0.5}}}

def newdev(p, name, offline_flag):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id='Australia/Brisbane', service_workers='block')
    pg = ctx.new_page(); pg.set_default_timeout(10000)
    pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.route('**/world.openfoodfacts.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(OFF if '9300633603267' in r.request.url else {"status": 0})))
    def cloud_route(r):
        if offline_flag.get(name): return r.abort('internetdisconnected')
        return r.continue_()
    pg.route('**/localhost:8790/**', cloud_route)
    pg.on('pageerror', lambda e: errs.append(name + ' ' + str(e)))
    pg.on('console', lambda m: errs.append(name + ' console ' + m.text) if m.type == 'error' and 'internetdisconnected' not in m.text and 'ERR_INTERNET' not in m.text and 'Failed to fetch' not in m.text else None)
    pg.goto('http://localhost:8770/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(700)
    return b, pg

def top(pg): return pg.locator('.sheet-wrap').last
def click(pg, sel, scope=None):
    (scope or pg).locator(sel).first.click(); pg.wait_for_timeout(150)
def shot(pg, n): pg.wait_for_timeout(200); pg.screenshot(path=f'{OUT}/{n}.png')
def wait_sync(pg):
    pg.wait_for_timeout(50); pg.wait_for_function('!SYNC.busy && !SYNC.again', timeout=30000); pg.wait_for_timeout(150); pg.wait_for_function('!SYNC.busy && !SYNC.again', timeout=30000)

off = {}
with sync_playwright() as p:
    # ===== 裝置 A：設定、全部功能新增資料 =====
    bA, A = newdev(p, 'A', off)
    for i in range(7): click(A, '[data-a="obNext"]')
    click(A, '[data-a="obFinish"]')
    # 訓練
    click(A, '[data-a="startSession"]')
    plan = A.evaluate('liveSession().plan')
    for k, eid in enumerate(plan[:3]):
        for j in range(3):
            A.fill(f'#rw-{eid}', str(20 + k * 5 + j * 2)); A.fill(f'#rr-{eid}', '10'); click(A, f'[data-a="saveRow"][data-v="{eid}"]')
        click(A, f'[data-a="doneEx"][data-v="{eid}"]')
    # 機台設定
    click(A, f'[data-a="exMenu"][data-v="{plan[3]}"]'); click(A, '[data-a="exMenuGo"][data-v^="editMachineNote"]', top(A))
    A.fill('#mnote2', '座椅 4、握把最外側'); click(A, '[data-a="saveMnote2"]')
    click(A, '[data-a="finishSession"]');
    if A.locator('.dialog').count(): click(A, '.dialog [data-r="1"]')
    click(A, '[data-a="closeSheet"]', top(A))
    ok(A.evaluate('S.sessions.filter(s=>s.end).length') == 1, 'A workout saved')
    # 飲食：常用/全部/快速/照標示/高蛋白/複製/條碼
    A.evaluate("A.tab('food')")
    click(A, '[data-a="addFood"][data-v="b"]'); click(A, '[data-a="foodTab"][data-v="all"]', top(A)); click(A, '[data-a="pickFood"]', top(A)); click(A, '[data-a="qtySet"][data-v="1.5"]', top(A)); click(A, '[data-a="confirmFood"]', top(A))
    click(A, '[data-a="addFood"][data-v="l"]'); click(A, '[data-a="foodTab"][data-v="quick"]', top(A)); A.fill('#q-name', '便當'); A.fill('#q-k', '750'); A.fill('#q-p', '30'); click(A, '[data-a="quickAdd"]', top(A))
    click(A, '[data-a="addFood"][data-v="d"]'); click(A, '[data-a="foodTab"][data-v="new"]', top(A)); A.fill('#n-name', 'Coles 雞胸'); A.fill('#n-unit', '1 包'); A.fill('#n-k', '165'); A.fill('#n-p', '31'); click(A, '[data-a="newFood"]', top(A))
    # 條碼：拍照辨識
    click(A, '[data-a="addFood"][data-v="s"]'); click(A, '[data-a="scanFood"]', top(A)); shot(A, 'scan')
    A.locator('input[data-in="scanPhoto"]').set_input_files(T + '/fixture_ean.png')
    A.wait_for_selector('.sheet-wrap[data-sheet="bcfood"]', timeout=15000); shot(A, 'bcfood')
    ok(A.input_value('#bc-name') == 'Chobani Protein Yoghurt' and A.input_value('#bc-k') == '119', 'barcode lookup ' + A.input_value('#bc-name') + ' ' + A.input_value('#bc-k'))
    click(A, '[data-a="saveBarcodeFood"]', top(A)); click(A, '[data-a="confirmFood"]', top(A))
    # 再掃一次同條碼 → 直接用本機
    click(A, '[data-a="addFood"][data-v="s"]'); click(A, '[data-a="scanFood"]', top(A)); A.fill('#scancode', '9300633603267'); click(A, '[data-a="scanManual"]', top(A))
    ok(A.locator('.sheet-wrap[data-sheet="qty"]').count() == 1, 'barcode second scan local'); click(A, '[data-a="confirmFood"]', top(A))
    # 查不到
    click(A, '[data-a="addFood"][data-v="s"]'); click(A, '[data-a="scanFood"]', top(A)); A.fill('#scancode', '4710000000001'); click(A, '[data-a="scanManual"]', top(A)); A.wait_for_selector('.sheet-wrap[data-sheet="bcfood"]')
    shot(A, 'bc_notfound'); A.fill('#bc-name', '義美豆漿'); A.fill('#bc-unit', '1 瓶'); A.fill('#bc-k', '150'); A.fill('#bc-p', '9'); click(A, '[data-a="saveBarcodeFood"]', top(A)); click(A, '[data-a="confirmFood"]', top(A))
    # 複製昨天的餐：先做一筆昨天
    A.evaluate("()=>{S.foodlog.push({id:uid(),date:addDays(todayStr(),-1),meal:'b',name:'燕麥片',unit:'1 份',qty:1,kcal:150,p:5,c:27,f:3});save();render();}")
    click(A, '[data-a="addFood"][data-v="b"]'); click(A, '[data-a="copyMeal"]', top(A))
    # 編輯、刪除一筆
    click(A, '[data-a="editLog"]'); A.fill('#qty', '2'); click(A, '[data-a="saveLog"]', top(A))
    n_food = A.evaluate("S.foodlog.length")
    click(A, '[data-a="editLog"]'); click(A, '[data-a="delLog"]', top(A))
    ok(A.evaluate("S.foodlog.length") == n_food - 1, 'food delete')
    # 喝水、肌酸
    click(A, '[data-a="water"][data-v="500"]'); click(A, '[data-a="water"][data-v="250"]'); click(A, '[data-a="creatine"]')
    # 高蛋白
    A.evaluate("A.settings();A.setSupp()"); click(A, '[data-a="togHas"]', top(A)); click(A, '[data-a="saveSupp"]', top(A)); A.evaluate("UI.sheets=[];drawSheets();A.tab('today')")
    click(A, '[data-a="addShake"]')
    # 體重、圍度
    click(A, '[data-a="addWeight"]'); A.fill('#w-kg', '49.6'); click(A, '[data-a="saveWeight"]', top(A))
    A.evaluate("A.tab('progress')"); click(A, '[data-a="progSeg"][data-v="body"]'); click(A, '[data-a="addMeasure"]'); A.fill('#m-waist', '68'); A.fill('#m-arm', '25.5'); click(A, '[data-a="saveMeasure"]', top(A))
    # 進度照片
    click(A, '[data-a="progSeg"][data-v="photos"]')
    A.locator('input[data-pose="正面"]').set_input_files(T + '/fixture_photo.jpg'); A.wait_for_timeout(600)
    A.locator('input[data-pose="側面"]').set_input_files(T + '/fixture_photo.jpg'); A.wait_for_timeout(600)
    ok(A.evaluate('S.photos.length') == 2, 'progress photos')
    shot(A, 'photos')
    # 動作：影片、照片、會痛、自訂
    A.evaluate("A.exDetail('lat_pulldown')")
    A.fill('#vurl', '看這個 https://www.youtube.com/watch?v=abc'); A.fill('#vnote', '握法'); click(A, '[data-a="addVideo"]', top(A))
    A.locator('input[data-in="exPhoto"]').set_input_files(T + '/fixture_photo.jpg'); A.wait_for_timeout(600)
    A.fill('#painnote', '右肩'); click(A, '[data-a="setPain"]', top(A))
    ok(A.evaluate("S.exu.lat_pulldown.videos[0].url") == 'https://www.youtube.com/watch?v=abc', 'video url extracted')
    A.evaluate("UI.sheets=[];drawSheets();A.tab('library')"); click(A, '[data-a="customEx"]'); A.fill('#cx-name', '側平舉機'); click(A, '[data-a="saveCustomEx"]', top(A))
    A.evaluate("UI.sheets=[];drawSheets()")
    # 有氧
    A.evaluate("A.tab('train')"); click(A, '[data-a="addCardio"]'); A.fill('#c-min', '20'); click(A, '[data-a="saveCardio"]', top(A))
    # 健身房、課表
    A.evaluate("A.settings();A.setGyms()"); click(A, '[data-a="gymAdd"]', top(A)); A.fill('#gname', '台灣健身房'); click(A, '[data-a="saveGymName"]', top(A)); click(A, '[data-a="eqAll"]', top(A)); A.evaluate("UI.sheets=[];drawSheets()")
    ok(A.evaluate('S.gyms.length') == 2, 'second gym')
    A.evaluate("S.settings.activeGym=S.gyms[0].id;save()")
    snapA = A.evaluate("JSON.stringify({sets:S.sets.length,food:S.foodlog.length,foods:S.foods.length,w:S.weights.length,m:S.measures.length,ph:S.photos.length,cx:S.customEx.length,cardio:S.cardio.length,gyms:S.gyms.length,water:Object.keys(S.water).length})")
    log.append('A data ' + snapA)

    # ===== A 連雲端 =====
    A.evaluate("A.tab('today');A.cloud()"); shot(A, 'cloud_empty')
    A.fill('#cl-url', CLOUD); A.fill('#cl-key', 'wrong'); click(A, '[data-a="cloudConnect"]', top(A)); A.wait_for_timeout(500)
    ok('密碼不對' in A.locator('#cl-msg').text_content(), 'wrong key message')
    A.fill('#cl-key', 'testkey'); click(A, '[data-a="cloudConnect"]', top(A)); wait_sync(A); A.wait_for_timeout(300)
    shot(A, 'cloud_connected')
    st = server(); rows = st['rows'][1:]
    ok(A.evaluate('SYNC.pending') == 0 and A.evaluate('SYNC.status') == 'idle', 'A synced pending=%s status=%s err=%s' % (A.evaluate('SYNC.pending'), A.evaluate('SYNC.status'), A.evaluate('SYNC.meta.err')))
    ok(len([f for f in st['files'].values() if not f['trashed']]) == 3, 'photos uploaded 3: ' + str(st['files']))
    log.append('server rows after first sync %d, upload bytes %d' % (len(rows), st['bytesIn']))
    # 沒變動再同步 → 極少流量、沒有新列
    sreset(); A.evaluate("A.cloudSync()"); wait_sync(A); st2 = server()
    ok(len(st2['rows']) == len(st['rows']) and st2['bytesIn'] < 600, 'idle sync bytes %d calls %s' % (st2['bytesIn'], st2['calls']))
    # 一組訓練的流量
    sreset()
    print('DBG', A.evaluate("JSON.stringify({sheets:UI.sheets.map(s=>s.id),live:!!liveSession(),dlg:document.querySelectorAll('.dialog').length,sess:S.sessions.length})"))
    A.evaluate("A.tab('train')"); click(A, '[data-a="startSession"]'); eid = A.evaluate('UI.openEx')
    for j in range(3): A.fill(f'#rw-{eid}', str(30 + j)); A.fill(f'#rr-{eid}', '9'); click(A, f'[data-a="saveRow"][data-v="{eid}"]')
    A.evaluate("A.cloudSync()"); wait_sync(A); st3 = server()
    log.append('3 sets sync upload bytes %d calls %s' % (st3['bytesIn'], st3['calls']))
    ok(st3['bytesIn'] < 8000, '3-set sync too big %d' % st3['bytesIn'])

    # ===== 裝置 B：從雲端還原 =====
    bB, B = newdev(p, 'B', off)
    shot(B, 'B_welcome')
    click(B, '[data-a="obCloud"]'); B.fill('#cl-url', CLOUD); B.fill('#cl-key', 'testkey'); click(B, '[data-a="cloudConnect"]', top(B)); wait_sync(B); B.wait_for_timeout(500)
    ok(B.evaluate('!!S.profile') and B.evaluate('UI.sheets.length') == 0, 'B restored & onboarding closed')
    snapB = B.evaluate("JSON.stringify({sets:S.sets.length,food:S.foodlog.length,foods:S.foods.length,w:S.weights.length,m:S.measures.length,ph:S.photos.length,cx:S.customEx.length,cardio:S.cardio.length,gyms:S.gyms.length,water:Object.keys(S.water).length})")
    snapA2 = A.evaluate("JSON.stringify({sets:S.sets.length,food:S.foodlog.length,foods:S.foods.length,w:S.weights.length,m:S.measures.length,ph:S.photos.length,cx:S.customEx.length,cardio:S.cardio.length,gyms:S.gyms.length,water:Object.keys(S.water).length})")
    ok(snapA2 == snapB, 'B equals A: ' + snapA2 + ' vs ' + snapB)
    ok(B.evaluate("S.exu.lat_pulldown.notes!==undefined && S.exu.lat_pulldown.pain && S.exu.lat_pulldown.videos.length===1"), 'B exu restored')
    ok(B.evaluate("liveSession() && liveSession().plan.length>0"), 'B sees in-progress session')
    # B 照片從雲端下載
    B.evaluate("A.tab('progress')"); click(B, '[data-a="progSeg"][data-v="photos"]'); B.wait_for_timeout(1500)
    ok(B.evaluate("[...document.querySelectorAll('.photo-grid img')].every(i=>i.src.startsWith('data:image'))"), 'B photos downloaded')
    shot(B, 'B_photos')
    B.evaluate("A.exDetail('lat_pulldown')"); B.wait_for_timeout(1200)
    ok(B.evaluate("[...document.querySelectorAll('.sheet-wrap img[data-imgkey]')].every(i=>i.src.startsWith('data:image'))"), 'B machine photo downloaded')
    B.evaluate("UI.sheets=[];drawSheets()")

    # ===== B 修改、刪除 → A 收到 =====
    B.evaluate("A.tab('progress');UI.progSeg='body';render()")
    wdate = B.evaluate("S.weights[S.weights.length-1].date")
    click(B, '[data-a="addWeight"]'); B.fill('#w-kg', '50.2'); click(B, '[data-a="saveWeight"]', top(B))
    B.evaluate("A.tab('food')"); fid = B.evaluate("S.foodlog[0].id"); B.evaluate(f"A.delLog('{fid}')")
    B.evaluate("A.cloudSync()"); wait_sync(B)
    A.evaluate("A.cloudSync()"); wait_sync(A)
    ok(A.evaluate(f"S.weights.find(w=>w.date==='{wdate}').kg") == 50.2, 'A got B weight edit')
    ok(A.evaluate(f"!S.foodlog.some(f=>f.id==='{fid}')"), 'A got B delete')
    # 刪除不會復活：A 再同步、B 再同步
    A.evaluate("A.cloudSync()"); wait_sync(A); B.evaluate("A.cloudSync()"); wait_sync(B)
    ok(B.evaluate(f"!S.foodlog.some(f=>f.id==='{fid}')") and A.evaluate(f"!S.foodlog.some(f=>f.id==='{fid}')"), 'tombstone holds')
    # 刪照片 → 雲端檔案進垃圾桶
    pid = A.evaluate("S.photos[0].id"); A.evaluate(f"(async()=>{{const p=S.photos.find(x=>x.id==='{pid}'); await Store.del('img:'+p.key); S.photos=S.photos.filter(x=>x.id!=='{pid}'); save();}})()")
    A.wait_for_timeout(200); A.evaluate("A.cloudSync()"); wait_sync(A)
    st = server(); ok(sum(1 for f in st['files'].values() if f['trashed']) == 1, 'photo trashed on delete ' + str(st['files']))
    B.evaluate("A.cloudSync()"); wait_sync(B); ok(B.evaluate('S.photos.length') == 1, 'B photo removed')

    # ===== 離線 =====
    off['A'] = True
    A.evaluate("A.tab('food')"); click(A, '[data-a="addFood"][data-v="d"]'); click(A, '[data-a="foodTab"][data-v="quick"]', top(A)); A.fill('#q-k', '500'); A.fill('#q-p', '25'); click(A, '[data-a="quickAdd"]', top(A))
    A.evaluate("A.cloudSync()"); wait_sync(A)
    ok(A.evaluate("SYNC.status") == 'error' and A.evaluate("SYNC.pending") > 0, 'offline pending kept')
    A.evaluate("A.tab('today')"); shot(A, 'A_offline_badge')
    off['A'] = False
    A.evaluate("A.cloudSync()"); wait_sync(A)
    ok(A.evaluate("SYNC.status") == 'idle' and A.evaluate("SYNC.pending") == 0, 'back online synced')
    B.evaluate("A.cloudSync()"); wait_sync(B)
    ok(B.evaluate("S.foodlog.length") == A.evaluate("S.foodlog.length"), 'B got offline entry')

    # ===== 衝突：A、B 同時改同一筆 =====
    sid = A.evaluate("S.sets[0].id")
    A.evaluate(f"S.sets.find(x=>x.id==='{sid}').reps=11;save()"); B.evaluate(f"S.sets.find(x=>x.id==='{sid}').reps=12;save()")
    B.evaluate("A.cloudSync()"); wait_sync(B); A.evaluate("A.cloudSync()"); wait_sync(A)
    ra = A.evaluate(f"S.sets.find(x=>x.id==='{sid}').reps"); B.evaluate("A.cloudSync()"); wait_sync(B); rb = B.evaluate(f"S.sets.find(x=>x.id==='{sid}').reps")
    ok(ra == rb == 12, 'conflict resolved same on both: A=%s B=%s' % (ra, rb))
    keys = [r[0] for r in server()['rows'][1:]]
    ok(len(keys) == len(set(keys)), 'no duplicate rows on server')

    # ===== 中斷：雲端已寫入但回應遺失 → 重送不重複 =====
    A.evaluate("()=>{S.weights.push({date:addDays(todayStr(),-3),kg:49.9,t:Date.now()});save();}")
    state = {'n': 0}
    def drop(r):
        if 'push' in (r.request.post_data or '') and state['n'] == 0:
            state['n'] = 1
            resp = r.fetch(); return r.abort('connectionreset')
        return r.continue_()
    A.unroute('**/localhost:8790/**'); A.route('**/localhost:8790/**', drop)
    A.evaluate("A.cloudSync()"); wait_sync(A)
    ok(A.evaluate("SYNC.status") == 'error', 'lost response -> error')
    A.evaluate("A.cloudSync()"); wait_sync(A)
    keys = [r[0] for r in server()['rows'][1:]]
    ok(len(keys) == len(set(keys)) and A.evaluate("SYNC.pending") == 0 and A.evaluate("SYNC.status") == 'idle', 'retry after lost response no dup, status ' + A.evaluate("SYNC.status") + ' ' + str(A.evaluate("SYNC.meta.err")))

    # ===== 同時同步（加鎖）=====
    A.evaluate("()=>{for(let i=0;i<30;i++) S.foodlog.push({id:uid(),date:todayStr(),meal:'s',name:'A'+i,unit:'份',qty:1,kcal:10,p:1,c:1,f:0});save();}")
    B.evaluate("()=>{for(let i=0;i<30;i++) S.foodlog.push({id:uid(),date:todayStr(),meal:'s',name:'B'+i,unit:'份',qty:1,kcal:10,p:1,c:1,f:0});save();}")
    A.evaluate("A.cloudSync()"); B.evaluate("A.cloudSync()"); wait_sync(A); wait_sync(B)
    A.evaluate("A.cloudSync()"); wait_sync(A); B.evaluate("A.cloudSync()"); wait_sync(B)
    ok(A.evaluate("S.foodlog.length") == B.evaluate("S.foodlog.length"), 'parallel sync converge A=%s B=%s' % (A.evaluate("S.foodlog.length"), B.evaluate("S.foodlog.length")))
    revs = [int(r[3]) for r in server()['rows'][1:]]
    ok(len(revs) == len(set(revs)), 'server revs unique')

    # ===== 大量資料：一年份 =====
    sreset()
    A.evaluate("""()=>{const t=todayStr(); for(let d=0;d<270;d++){const sid=uid(); S.sessions.push({id:sid,date:addDays(t,-400+d),day:'push',round:1,start:'18:00',startTs:0,end:'19:00',plan:[]}); for(let n=1;n<=20;n++) S.sets.push({id:uid(),sid,ex:'chest_press',n,w:30,add:0,tw:30,reps:10,rir:'',warm:false});} for(let d=0;d<365;d++) for(let m=0;m<4;m++) S.foodlog.push({id:uid(),date:addDays(t,-d-2),meal:'l',name:'便當',unit:'個',qty:1,kcal:700,p:30,c:90,f:20}); save();}""")
    t0 = time.time(); A.evaluate("A.cloudSync()"); wait_sync(A); dt = time.time() - t0
    st = server(); log.append('big push: %d rows on server, %.1fs, %d KB, calls %d' % (len(st['rows']) - 1, dt, st['bytesIn'] // 1024, len(st['calls'])))
    ok(A.evaluate("SYNC.pending") == 0, 'big push done')
    t0 = time.time(); B.evaluate("A.cloudSync()"); wait_sync(B); log.append('big pull %.1fs' % (time.time() - t0))
    ok(B.evaluate("S.sets.length") == A.evaluate("S.sets.length"), 'big pull equal')
    sreset(); A.evaluate("A.cloudSync()"); wait_sync(A); st = server(); ok(st['bytesIn'] < 600, 'idle after big %d' % st['bytesIn'])

    # ===== 重新比對全部 =====
    A.evaluate("A.cloudResync()"); wait_sync(A); keys = [r[0] for r in server()['rows'][1:]]
    ok(len(keys) == len(set(keys)) and A.evaluate("SYNC.pending") == 0, 'resync no dup')
    # 重新整理後狀態保留
    A.reload(wait_until='domcontentloaded'); A.wait_for_timeout(2500); wait_sync(A)
    ok(A.evaluate("SYNC.status") == 'idle' and A.evaluate("SYNC.pending") == 0, 'after reload idle')
    shot(A, 'A_today_synced')
    A.evaluate("A.settings()"); shot(A, 'A_settings'); A.evaluate("A.cloud()"); shot(A, 'A_cloud_sheet')
    bA.close(); bB.close()
gas.terminate(); web.terminate()
print('LOG'); [print(' ', l) for l in log]
print('FAILS', fails); print('ERRS', errs[:20])
