import sys, os, json
sys.path.insert(0,'src')
from exdata import EX, EQUIP
from PIL import Image, ImageOps
EK='/tmp/everkinetic_data/src/images-web/'; FE='/tmp/free-exercise-db/exercises/'
keys=set([e[8] for e in EX if e[8]]+[q[4] for q in EQUIP if q[4]])
out={}; missing=[]
for k in sorted(keys):
    src,name=k.split(':',1); files=[]
    for i in (1,2):
        if src=='ek':
            p=f'{EK}{name}-{i}.png'
            if not os.path.exists(p): missing.append(p); continue
            im=Image.open(p).convert('RGBA')
            # line art: use alpha only -> grayscale lines on transparent
            a=im.split()[3]; g=ImageOps.grayscale(im)
            im2=Image.merge('LA',(g,a))
            im2.thumbnail((440,440))
            fn=f'{name}-{i}.png'; im2.save('dist/img/'+fn,optimize=True)
        else:
            p=f'{FE}{name}/{i-1}.jpg'
            if not os.path.exists(p): missing.append(p); continue
            im=Image.open(p).convert('RGB'); im.thumbnail((520,520))
            fn=f'fe-{name}-{i}.jpg'; im.save('dist/img/'+fn,quality=72,optimize=True)
        files.append('img/'+fn)
    out[k]=files
json.dump(out,open('src/imgmap.json','w'),ensure_ascii=False,indent=0)
print('missing',missing)
