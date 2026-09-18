"""Pacote de produção: dist/index.html + dist/img/<chave>-<largura>.webp (srcset) + og/. Independente de host.
Uso: python3 build_dist.py [--encode]   (--encode regenera as imagens a partir de sources.json)
"""
import json,os,re,sys,shutil,hashlib
from concurrent.futures import ProcessPoolExecutor
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
SRC='site.html'; DIST='dist'; IMGDIR=f'{DIST}/img'
SOURCES=json.load(open('sources.json'))
LADDER=[640,1200,1920,2560]
Q_DEFAULT=72; Q_HERO=80
FORM_ENDPOINT=os.environ.get('FORM_ENDPOINT','')   # ex.: https://formspree.io/f/xxxx — vazio até definir host/backend

def widths_for(k,srcw):
    ws=[w for w in LADDER if w<=srcw]
    if not ws or (srcw<1920 and srcw not in ws): ws.append(srcw)      # fonte pequena: inclui o tamanho nativo
    if k=='hero': ws=[w for w in ws if w!=2560]+[2304]                    # nativo do PDF
    if k=='vitalis-torre-sky': ws=[w for w in ws if w!=2560]+[2304]
    ws=sorted(set(min(w,srcw) for w in ws))
    return ws

def encode(job):
    k,src,ws=job
    im=Image.open(src).convert('RGB')
    out=[]
    for w in ws:
        p=f'{IMGDIR}/{k}-{w}.webp'
        if not os.path.exists(p):
            r=im if w==im.width else im.resize((w,round(w*im.height/im.width)),Image.LANCZOS)
            r.save(p,'WEBP',quality=Q_HERO if k in('hero','vitalis-torre-sky') else Q_DEFAULT,method=6)
        out.append((w,p))
    return k,out

def main():
    os.makedirs(IMGDIR,exist_ok=True)
    jobs=[]
    for k,src in SOURCES.items():
        if k=='mirante-mock':   # placeholder já pequeno
            shutil.copy(src,f'{IMGDIR}/{k}-1200.webp'); continue
        w=Image.open(src).size[0]
        jobs.append((k,src,widths_for(k,w)))
    if '--encode' in sys.argv:
        with ProcessPoolExecutor(4) as ex:
            for k,out in ex.map(encode,jobs): print(k,[w for w,_ in out])
    imgs={}; srcset={}; large={}; dims={}
    for f in sorted(os.listdir(IMGDIR)):
        m=re.match(r'(.+)-(\d+)\.webp$',f); k,w=m.group(1),int(m.group(2))
        srcset.setdefault(k,[]).append((w,f'img/{f}'))
    for k,lst in srcset.items():
        lst.sort()
        mid=min(lst,key=lambda t:abs(t[0]-1200))
        imgs[k]=mid[1]                                   # src de fallback
        large[k]=lst[-1][1]
        dims[k]=list(Image.open(f'{DIST}/{lst[-1][1]}').size)
        srcset[k]=', '.join(f'{u} {w}w' for w,u in lst)
    src=open(SRC).read()
    refs=set(re.findall(r"'([a-z0-9-]+)'",src[src.index('const PROJECTS'):src.index('/* ===== helpers')]))
    missing=[r for r in refs if r not in imgs and re.match(r'^(hero|vitalis|vila|aparecer|loft|banheiro|ubs|vv|sind|mirante|retrato|gineco)',r) and r not in ('vila-jasmim-manga','mirante-cestes','banheiro-chocolate','mini-casa')]
    if missing: sys.exit('MISSING: '+str(missing))
    hero=dict((w,u) for w,u in [(int(re.search(r'-(\d+)\.webp',u).group(1)),u) for u in [s.split(' ')[0] for s in srcset['hero'].split(', ')]])
    h1200,h1920,h2304=hero[1200],hero[1920],hero[2304]
    dist_css=f"""  /* produção: fundo da home por largura de tela (evita upscale) */
  .hero{{--hero-img:url({h2304}) !important}}
  @media(max-width:1600px){{.hero{{--hero-img:url({h1920}) !important}}}}
  @media(max-width:900px){{.hero{{--hero-img:url({h1200}) !important}}}}"""
    dist_head=f"""<link rel="preload" as="image" href="{h2304}" media="(min-width:1601px)" fetchpriority="high">
<link rel="preload" as="image" href="{h1920}" media="(min-width:901px) and (max-width:1600px)" fetchpriority="high">
<link rel="preload" as="image" href="{h1200}" media="(max-width:900px)" fetchpriority="high">"""
    out=(src.replace('{{IMGMAP}}', json.dumps(imgs,separators=(',',':')))
            .replace('{{DIMS}}', json.dumps(dims,separators=(',',':')))
            .replace('{{SRCSET}}', json.dumps(srcset,separators=(',',':')))
            .replace('{{LARGE}}', json.dumps(large,separators=(',',':')))
            .replace('{{HERO_BG}}', json.dumps(f'url({h1920})'))
            .replace('{{DIST_HEAD}}',dist_head).replace('{{DIST_CSS}}',dist_css)
            .replace('{{FORM_ENDPOINT}}',json.dumps(FORM_ENDPOINT)))
    assert '{{' not in out
    open(f'{DIST}/index.html','w').write(out)
    if os.path.isdir('og'):
        os.makedirs(f'{DIST}/og',exist_ok=True)
        for f in os.listdir('og'): shutil.copy(f'og/{f}',f'{DIST}/og/{f}')
    tot=sum(os.path.getsize(f'{IMGDIR}/{f}') for f in os.listdir(IMGDIR))
    print('dist:',len(imgs),'chaves,',len(os.listdir(IMGDIR)),'arquivos,',round(tot/1048576,1),'MB de imagens; index.html',round(os.path.getsize(f'{DIST}/index.html')/1024),'KB')

if __name__=='__main__': main()
