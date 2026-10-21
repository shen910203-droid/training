import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from exdata import EX, EQUIP, TEMPLATES, FOODS
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, 'src')
eqname = {q[0]: q[1] for q in EQUIP}
ex = []
for (i, name, day, eq, load, pri, sec, t, img, cues) in EX:
    mach = eqname[eq[0]] if eq else '自體重'
    if eq and eq[0] in ('dumbbell', 'barbell') and len(eq) > 1: mach = eqname[eq[0]] + '＋' + eqname[eq[1]]
    ex.append(dict(id=i, name=name, day=day, eq=eq, load=load, pri=pri, sec=sec, t=t, img=img, cues=cues, mach=mach))
ids = {e['id'] for e in ex}
for d, slots in TEMPLATES.items():
    for s in slots:
        for x in s: assert x in ids, x
data = dict(ex=ex, equip=[dict(id=q[0], name=q[1], desc=q[2], cat=q[3], img=q[4]) for q in EQUIP], templates=TEMPLATES, foods=FOODS,
            imgmap=json.load(open(os.path.join(src, 'imgmap.json'))))
body = json.load(open(os.path.join(src, 'body.json')))
css = open(os.path.join(src, 'style.css')).read()
core = open(os.path.join(src, 'core.js')).read()
ui = open(os.path.join(src, 'ui.js')).read()
syncjs = open(os.path.join(src, 'sync.js')).read()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&display=swap">'
inner = ('<style>' + css + '</style>\n<div id="app"></div><nav id="nav" aria-label="主選單"></nav><div id="timer" hidden></div><div id="layer"></div><div id="toast" aria-live="polite"></div>\n'
         '<script>const DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';const BODY=' + json.dumps(body, separators=(',', ':')) + ';</script>\n'
         '<script>' + core + '</script>\n<script>' + syncjs + '</script>\n<script>' + ui + '</script>\n')
dist = os.path.join(root, 'dist')
# artifact 版
open(os.path.join(dist, 'index.html'), 'w').write('<title>Training</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + FONTS + '\n' + inner)
# GitHub Pages 版
pages = os.path.join(root, 'pages'); os.makedirs(pages, exist_ok=True)
head = ('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<title>Training</title><meta name="theme-color" content="#0c0e0f"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Training">'
        '<link rel="apple-touch-icon" href="icon-180.png"><link rel="manifest" href="manifest.json">' + FONTS +
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
open(os.path.join(pages, 'index.html'), 'w').write(head + '<script>window.APP_MODE="pages";</script>' + inner + '</body></html>')
import shutil, hashlib
os.makedirs(os.path.join(pages, 'lib'), exist_ok=True)
shutil.copy('/tmp/zx/package/umd/index.min.js', os.path.join(pages, 'lib', 'zxing.min.js'))
if os.path.exists(os.path.join(pages, 'img')): shutil.rmtree(os.path.join(pages, 'img'))
shutil.copytree(os.path.join(dist, 'img'), os.path.join(pages, 'img'))
imgs = sorted('img/' + f for f in os.listdir(os.path.join(pages, 'img')))
hsh = hashlib.sha1()
for f in ['index.html', 'manifest.json'] + imgs: hsh.update(open(os.path.join(pages, f), 'rb').read())
ver = hsh.hexdigest()[:10]
sw = open(os.path.join(src, 'sw.js')).read().replace('__VER__', ver).replace('__IMGS__', json.dumps(imgs))
open(os.path.join(pages, 'sw.js'), 'w').write(sw)
print('sw version', ver)
json.dump({"name": "Training", "short_name": "Training", "start_url": ".", "display": "standalone", "background_color": "#0c0e0f", "theme_color": "#0c0e0f",
           "icons": [{"src": "icon-512.png", "sizes": "512x512", "type": "image/png"}, {"src": "icon-180.png", "sizes": "180x180", "type": "image/png"}]},
          open(os.path.join(pages, 'manifest.json'), 'w'), ensure_ascii=False)
print('ok', os.path.getsize(os.path.join(dist, 'index.html')))
