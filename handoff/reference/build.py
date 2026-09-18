import base64,json,os,re,sys
from PIL import Image
SRC='site.html'; OUT='site-final.html'; W='new/web'
src=open(SRC).read()
imgs={}; dims={}
for f in sorted(os.listdir(W)):
    k=f.rsplit('.',1)[0]; p=f'{W}/{f}'
    imgs[k]='data:image/webp;base64,'+base64.b64encode(open(p,'rb').read()).decode()
    w,h=Image.open(p).size; dims[k]=[w,h]
# keys referenced
refs=set(re.findall(r"'([a-z0-9-]+)'",src[src.index('const PROJECTS'):src.index('/* ===== helpers')]))
missing=[r for r in refs if r not in imgs and re.match(r'^(hero|vitalis|vila|aparecer|loft|banheiro|ubs|vv|sind|mirante|retrato|gineco)',r)]
missing=[m for m in missing if m not in ('vila-jasmim-manga','mirante-cestes','banheiro-chocolate','mini-casa')]
if missing: sys.exit('MISSING: '+str(missing))
out=(src.replace('{{IMGMAP}}', json.dumps(imgs))
        .replace('{{DIMS}}', json.dumps(dims,separators=(',',':')))
        .replace('{{SRCSET}}','{}').replace('{{LARGE}}','{}')
        .replace('{{HERO_BG}}', "'url('+IMG.hero+')'")
        .replace('{{DIST_HEAD}}','').replace('{{DIST_CSS}}','').replace('{{FORM_ENDPOINT}}',"''"))
assert '{{' not in out
open(OUT,'w').write(out)
print('built', len(imgs), 'images;', round(len(out)/1048576,2), 'MB')
