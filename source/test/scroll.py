import subprocess, time, os
from playwright.sync_api import sync_playwright
web = subprocess.Popen(['python3', '-m', 'http.server', '8773', '-d', '/home/claude/lgb/pages'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
fails, errs, log = [], [], []
def ok(c, m): (log if c else fails).append(m)
def top(pg): return pg.locator('.sheet-wrap').last
def click(pg, sel, scope=None): (scope or pg).locator(sel).first.click(); pg.wait_for_timeout(200)
SB = "(()=>{const b=document.querySelector('.sheet-wrap[data-sheet=\"%s\"] .sheet-b'); return b?b.scrollTop:-1})()"
def setsb(pg, id, y): pg.evaluate("y=>{document.querySelector('.sheet-wrap[data-sheet=\"%s\"] .sheet-b').scrollTop=y}" % id, y); pg.wait_for_timeout(100)
def jsclick(pg, sel): pg.evaluate("s=>[...document.querySelectorAll('.sheet-wrap')].pop().querySelector(s).click()", sel); pg.wait_for_timeout(200)
def sb(pg, id): return pg.evaluate(SB % id)
with sync_playwright() as p:
  for vw, vh, lab in [(375, 667, 'se'), (390, 844, 'm'), (1280, 860, 'd')]:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': vw, 'height': vh}, is_mobile=vw < 700, has_touch=vw < 700, timezone_id='Australia/Brisbane', service_workers='block')
    pg = ctx.new_page(); pg.set_default_timeout(8000); pg.route('**/fonts.g*/**', lambda r: r.abort())
    pg.on('pageerror', lambda e: errs.append(lab + ' ' + str(e)))
    pg.goto('http://localhost:8773/index.html', wait_until='domcontentloaded'); pg.wait_for_timeout(600)
    for i in range(7): click(pg, '[data-a="obNext"]')
    click(pg, '[data-a="obFinish"]')
    pg.evaluate("A.tab('train')"); click(pg, '[data-a="openTpl"]')
    setsb(pg, 'tpl', 99999); y0 = sb(pg, 'tpl'); ok(y0 > 300, f'{lab} tpl scrollable {y0}')
    # 換動作（腿日最後一格）
    n = pg.evaluate("S.settings.templates.legs.length")
    jsclick(pg, f'[data-a="tplSwap"][data-v="legs:{n-1}"]'); click(pg, '[data-a="pickEx"]', top(pg))
    y1 = sb(pg, 'tpl'); print(lab, 'max1', y0, pg.evaluate("(()=>{const b=document.querySelector('.sheet-wrap[data-sheet=\"tpl\"] .sheet-b'); return [b.scrollHeight-b.clientHeight, b.clientHeight]})()")); ok(abs(y1 - y0) < 5, f'{lab} swap keeps scroll {y0}->{y1}')
    # 調整 → 儲存
    jsclick(pg, f'[data-a="tplRx"][data-v="legs:{n-1}"]'); click(pg, '[data-a="rxSave"]', top(pg))
    y2 = sb(pg, 'tpl'); print(lab, 'max', pg.evaluate("(()=>{const b=document.querySelector('.sheet-wrap[data-sheet=\"tpl\"] .sheet-b'); return [b.scrollHeight-b.clientHeight, b.clientHeight]})()")); ok(abs(y2 - y0) < 5, f'{lab} rxSave keeps scroll {y0}->{y2}')
    # 調整 → 關閉
    jsclick(pg, f'[data-a="tplRx"][data-v="legs:{n-1}"]'); click(pg, '[data-a="closeSheet"]', top(pg))
    y3 = sb(pg, 'tpl'); ok(abs(y3 - y0) < 5, f'{lab} rx close keeps scroll {y3}')
    # 往上移
    y0 = sb(pg, 'tpl'); jsclick(pg, f'[data-a="tplMove"][data-v="legs:{n-1}"]'); y4 = sb(pg, 'tpl'); ok(abs(y4 - y0) < 5, f'{lab} move keeps {y0}->{y4}')
    # 刪除
    jsclick(pg, f'[data-a="tplDel"][data-v="legs:{n-1}"]'); click(pg, '.dialog [data-r="1"]'); y5 = sb(pg, 'tpl'); ok(y5 > 300, f'{lab} del keeps {y5}')
    # 加入動作
    setsb(pg, 'tpl', 99999); y0 = sb(pg, 'tpl')
    click(pg, '[data-a="tplAdd"][data-v="legs"]', top(pg)); ok(sb(pg, 'pick') == 0, f'{lab} new pick sheet starts top')
    # 搜尋（模擬注音輸入）
    cdp = ctx.new_cdp_session(pg)
    pg.locator('#pickq').click(); h0 = pg.evaluate("document.getElementById('pickq')")
    pg.evaluate("window.__q=document.getElementById('pickq')")
    for comp in ['ㄊ', 'ㄊㄨ', 'ㄊㄨㄟ']:
        cdp.send('Input.imeSetComposition', {'text': comp, 'selectionStart': len(comp), 'selectionEnd': len(comp)}); pg.wait_for_timeout(60)
    ok(pg.evaluate("document.getElementById('pickq')===window.__q"), f'{lab} pickq same node during composition')
    cdp.send('Input.insertText', {'text': '推'}); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.getElementById('pickq')===window.__q && document.activeElement===window.__q"), f'{lab} pickq kept focus')
    ok(pg.input_value('#pickq') == '推', f'{lab} pickq value ' + pg.input_value('#pickq'))
    names = pg.evaluate("[...document.querySelectorAll('.sheet-wrap[data-sheet=\"pick\"] [data-a=\"pickEx\"]')].map(x=>x.textContent)")
    ok(len(names) > 0 and all('推' in x for x in names), f'{lab} pick filtered {len(names)}')
    pg.keyboard.type('胸'); pg.wait_for_timeout(150); ok(pg.input_value('#pickq') == '推胸', f'{lab} normal typing')
    pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(150)
    click(pg, '[data-a="pickEx"]', top(pg)); y6 = sb(pg, 'tpl'); ok(y6 > 300, f'{lab} add keeps scroll {y6}')
    click(pg, '[data-a="closeSheet"]', top(pg))
    # 動作庫：搜尋注音 + 開詳細再關閉保持位置
    pg.evaluate("A.tab('library')"); pg.locator('#libq').click(); pg.evaluate("window.__q=document.getElementById('libq')")
    cdp.send('Input.imeSetComposition', {'text': 'ㄒㄩㄥ', 'selectionStart': 3, 'selectionEnd': 3}); pg.wait_for_timeout(80)
    cdp.send('Input.insertText', {'text': '胸'}); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.getElementById('libq')===window.__q && document.activeElement===window.__q") and pg.input_value('#libq') == '胸', f'{lab} libq ime')
    cnt = pg.evaluate("document.querySelectorAll('#app [data-a=\"exDetail\"]').length"); ok(0 < cnt < 66, f'{lab} lib filtered {cnt}')
    pg.fill('#libq', ''); pg.wait_for_timeout(150)
    ok(pg.evaluate("document.querySelectorAll('#app [data-a=\"exDetail\"]').length") > cnt, f'{lab} lib cleared')
    it = pg.locator('#app [data-a="exDetail"]').nth(20); it.scroll_into_view_if_needed(); pg.wait_for_timeout(100); w0 = pg.evaluate("scrollY")
    it.click(); pg.wait_for_timeout(250); click(pg, '[data-a="closeSheet"]', top(pg))
    w1 = pg.evaluate("scrollY"); ok(w0 > 500 and abs(w1 - w0) < 5, f'{lab} library keeps window scroll {w0}->{w1}')
    # 飲食搜尋注音
    pg.evaluate("A.tab('food')"); click(pg, '[data-a="addFood"]'); click(pg, '[data-a="foodTab"][data-v="all"]', top(pg))
    pg.locator('#foodq').click(); pg.evaluate("window.__q=document.getElementById('foodq')")
    cdp.send('Input.imeSetComposition', {'text': 'ㄈㄢˋ', 'selectionStart': 3, 'selectionEnd': 3}); pg.wait_for_timeout(80)
    cdp.send('Input.insertText', {'text': '飯'}); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.getElementById('foodq')===window.__q && document.activeElement===window.__q") and pg.input_value('#foodq') == '飯', f'{lab} foodq ime')
    fl = pg.evaluate("[...document.querySelectorAll('[data-a=\"pickFood\"]')].map(x=>x.textContent)"); ok(fl and all('飯' in x for x in fl), f'{lab} food filtered {len(fl)}')
    click(pg, '[data-a="pickFood"]', top(pg)); click(pg, '[data-a="closeSheet"]', top(pg))
    ok(pg.input_value('#foodq') == '飯', f'{lab} food search kept after back')
    # 設定 → 健身房 → 器材 → 返回，設定頁保持位置
    click(pg, '[data-a="closeSheet"]', top(pg)); pg.evaluate("A.tab('today')"); click(pg, '[data-a="settings"]')
    setsb(pg, 'settings', 99999); s0 = sb(pg, 'settings')
    click(pg, '[data-a="setTemplates"]', top(pg)); click(pg, '[data-a="closeSheet"]', top(pg))
    s1 = sb(pg, 'settings'); ok(s0 < 50 or abs(s1 - s0) < 5, f'{lab} settings keep {s0}->{s1}')
    b.close()
web.terminate()
print('LOG', len(log)); print('FAILS', fails); print('ERRS', errs)
