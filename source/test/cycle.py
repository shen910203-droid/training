import subprocess, time
from playwright.sync_api import sync_playwright
web = subprocess.Popen(['python3', '-m', 'http.server', '8782', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
def T(mo, dd, hh): return time.mktime((2026, mo, dd, hh, 30, 0, 0, 0, -1))
def train(pg, day, finish='all', choose=None):
    pg.evaluate("A.tab('train')"); pg.locator(f'[data-a="startSession"][data-v="{day}"]').first.click(); pg.wait_for_timeout(250)
    ok(pg.evaluate("liveSession().day") == day, 'started ' + day)
    plan = pg.evaluate("liveSession().plan")
    todo = plan if finish == 'all' else plan[:1]
    for eid in todo:
        n = pg.evaluate(f"sessionRx(S,liveSession(),EXMAP['{eid}']).sets")
        for j in range(n):
            if pg.locator(f'#rw-{eid}').count(): pg.fill(f'#rw-{eid}', '20')
            pg.fill(f'#rr-{eid}', '10'); pg.locator(f'[data-a="saveRow"][data-v="{eid}"]').click(); pg.wait_for_timeout(60)
        pg.locator(f'[data-a="doneEx"][data-v="{eid}"]').click(); pg.wait_for_timeout(100)
    pg.locator('[data-a="finishSession"]').first.click(); pg.wait_for_timeout(300)
    if choose is not None: pg.locator(f'.dialog [data-r="{choose}"]').click(); pg.wait_for_timeout(300)
    pg.evaluate("UI.sheets=[];drawSheets();render()")
def nxt(pg): return pg.evaluate("[nextTrainDay(S), ORDER[S.settings.cycle.idx], S.settings.cycle.restOn, S.settings.cycle.round]")
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block', timezone_id='Australia/Brisbane')
    pg = ctx.new_page(); pg.set_default_timeout(8000)
    pg.clock.install(time=T(10, 31, 18)); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8782/index.html'); pg.wait_for_timeout(800)
    for i in range(7): pg.locator('[data-a="obNext"]').click(); pg.wait_for_timeout(120)
    pg.locator('[data-a="obFinish"]').click(); pg.wait_for_timeout(200)
    # 1. 正常：腿日 → 明天休息 → 後天推日
    pg.evaluate("()=>{S.settings.cycle={idx:2,round:3,restOn:null}; save(); render();}")
    train(pg, 'legs'); r = nxt(pg)
    ok(r[0] == 'push' and r[1] == 'rest' and r[2] == '2026-11-01', '1 legs->rest ' + str(r))
    ok('推日' in pg.locator('#app').inner_text(), '1 shows push next')
    pg.clock.set_system_time(T(11, 1, 9)); pg.evaluate("render()"); ok(nxt(pg)[1] == 'rest', '1 rest day')
    pg.clock.set_system_time(T(11, 2, 9)); pg.evaluate("render()"); r = nxt(pg); ok(r[1] == 'push' and r[3] == 4, '1 push next round ' + str(r))
    # 2. 排程是推日，但改練腿日 → 下一次不能還是腿日
    train(pg, 'legs'); r = nxt(pg)
    ok(r[1] == 'rest' and r[0] == 'push', '2 off-schedule legs -> rest/push ' + str(r))
    # 3. 排程是拉日，改練推日 → 下一次拉日
    pg.evaluate("()=>{S.settings.cycle={idx:1,round:4,restOn:null}; save(); render();}")
    train(pg, 'push'); r = nxt(pg); ok(r[1] == 'pull', '3 push -> pull ' + str(r))
    # 4. 沒練完選「下次再練一次」：下次同一天（即使是改練的）
    pg.clock.set_system_time(T(11, 3, 9)); pg.evaluate("render()")
    pg.evaluate("()=>{S.settings.cycle={idx:0,round:4,restOn:null}; save(); render();}")
    train(pg, 'legs', finish='partial', choose=2); r = nxt(pg); ok(r[1] == 'legs', '4 partial repeat legs ' + str(r))
    # 5. 沒練完選「算練完」→ 往下走
    pg.clock.set_system_time(T(11, 4, 9)); pg.evaluate("render()")
    train(pg, 'legs', finish='partial', choose=1); r = nxt(pg); ok(r[1] == 'rest', '5 partial counted done -> rest ' + str(r))
    # 6. 休息日直接去練推日 → 練完下一次拉日
    pg.clock.set_system_time(T(11, 5, 9)); pg.evaluate("render()"); ok(nxt(pg)[1] == 'rest', '6 is rest day')
    train(pg, 'push'); r = nxt(pg); ok(r[1] == 'pull', '6 rest-day push -> pull ' + str(r))
    b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
