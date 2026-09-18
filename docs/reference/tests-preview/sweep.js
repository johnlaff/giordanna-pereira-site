const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const s=http.createServer((q,r)=>{r.setHeader('content-type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8440);
const U='http://localhost:8440/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const issues=[];
 const slugs=['edificio-vitalis','consultorio-ginecocare','banheiro-chocolate','habitacao-villa-verde','vila-jasmim-manga','sala-sindicato','mini-casa','unidade-basica-de-saude','espaco-aparecer','mirante-cestes'];
 const routes=['/','/projetos','/contato','/xyz',...slugs.map(s=>'/projeto/'+s)];
 for(const w of [1440,1024,768,375,320]){
  const p=await b.newPage({viewport:{width:w,height:w>500?900:740}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});
  for(const h of routes){
   await p.goto(U+'#'+h);await p.waitForTimeout(650);
   const r=await p.evaluate(()=>{
     const de=document.documentElement;const ov=de.scrollWidth-de.clientWidth;
     const imgs=[...document.querySelectorAll('main img')];const broken=imgs.filter(i=>!i.getAttribute('src')||(i.complete&&i.naturalWidth===0)).length;
     const wide=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>de.clientWidth+1&&getComputedStyle(e).position!=='fixed'}).slice(0,3).map(e=>e.tagName+'.'+(e.className||'').toString().split(' ')[0]);
     const links=[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
     const badHash=links.filter(h=>h.startsWith('#')&&!/^#\/(projetos|contato|projeto\/[a-z0-9-]+)?$/.test(h)&&h!=='#main'&&h!=='#/');
     const extNoRel=[...document.querySelectorAll('a[target=_blank]')].filter(a=>!/noopener/.test(a.rel)).length;
     const h1=document.querySelectorAll('main h1').length;
     const gal=document.querySelector('#gal');let galInfo=null;
     if(gal){const W=gal.clientWidth;const rows={};[...gal.children].forEach(b=>{const r=b.getBoundingClientRect();(rows[Math.round(r.top)]=rows[Math.round(r.top)]||[]).push(Math.round(r.right-gal.getBoundingClientRect().left))});galInfo={n:gal.children.length,badRows:Object.values(rows).filter(r=>Math.abs(Math.max(...r)-W)>2).length};}
     return {ov,broken,wide,badHash,extNoRel,h1,galInfo,title:document.title,page:document.body.dataset.page,ogimg:document.querySelector('meta[property="og:image"]').content};});
   const tag=`${h}@${w}`;
   if(r.ov>0)issues.push(tag+': rolagem horizontal '+r.ov+'px');
   if(r.broken)issues.push(tag+': '+r.broken+' imagens quebradas');
   if(r.wide.length)issues.push(tag+': elementos mais largos que a tela: '+r.wide.join(','));
   if(r.badHash.length)issues.push(tag+': links internos inválidos: '+r.badHash.join(','));
   if(r.extNoRel)issues.push(tag+': links externos sem noopener: '+r.extNoRel);
   if(r.h1!==1)issues.push(tag+': h1 = '+r.h1);
   if(r.galInfo&&r.galInfo.badRows)issues.push(tag+': galeria com '+r.galInfo.badRows+' linhas incompletas');
   if(h.startsWith('/projeto/')&&!r.ogimg.endsWith('/og/'+h.split('/')[2]+'.jpg'))issues.push(tag+': og:image '+r.ogimg);
   if(h==='/xyz'&&r.page!=='nf')issues.push(tag+': 404 não renderizou');
  }
  if(errs.length)issues.push(`erros de console @${w}: `+[...new Set(errs)].join(' | '));
  // lightbox em todos os projetos: abre a última foto, navega, fecha
  if(w===1440||w===375){for(const sl of slugs){await p.goto(U+'#/projeto/'+sl);await p.waitForTimeout(600);const n=await p.$$eval('#gal button',a=>a.length);
    await p.click(`#gal button[data-i="${n-1}"]`);await p.waitForTimeout(700);
    const st=await p.evaluate(()=>({open:!!document.querySelector('.pswp--open'),c:document.querySelector('#lb-count')?.textContent}));
    if(!st.open||st.c!==`${n} / ${n}`)issues.push(`lightbox ${sl}@${w}: `+JSON.stringify(st));
    if(n>2){await p.keyboard.press('ArrowRight');await p.waitForTimeout(500);const c2=await p.evaluate(()=>document.querySelector('#lb-count')?.textContent);if(c2!==`1 / ${n}`)issues.push(`loop ${sl}@${w}: `+c2);}
    await p.keyboard.press('Escape');await p.waitForTimeout(500);if(await p.evaluate(()=>!!document.querySelector('.pswp--open')))issues.push(`lightbox não fechou ${sl}@${w}`);}}
  await p.close();
 }
 // redimensionar com página em cache: galeria refaz o layout; carrossel continua consistente
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.goto(U+'#/projeto/habitacao-villa-verde');await p.waitForTimeout(600);await p.goto(U+'#/projetos');await p.waitForTimeout(500);
 await p.setViewportSize({width:390,height:800});await p.waitForTimeout(300);await p.goto(U+'#/projeto/habitacao-villa-verde');await p.waitForTimeout(700);
 const rz=await p.evaluate(()=>{const gal=document.querySelector('#gal');const W=gal.clientWidth;return [...gal.children].filter(b=>b.getBoundingClientRect().width>W+1).length});if(rz)issues.push('galeria em cache não refez o layout após redimensionar: '+rz+' tiles largos demais');
 await p.setViewportSize({width:1440,height:900});await p.goto(U+'#/');await p.waitForTimeout(700);await p.evaluate(()=>document.querySelector('#depoimentos').scrollIntoView());await p.waitForTimeout(400);
 await p.setViewportSize({width:800,height:900});await p.waitForTimeout(500);const q=await p.evaluate(()=>({vis:[...document.querySelectorAll('.qcard:not(.dim)')].length,sl:document.querySelector('#qtrack').scrollLeft}));if(q.vis<1)issues.push('carrossel após redimensionar: '+JSON.stringify(q));
 // formulário: envio válido e inválido
 await p.setViewportSize({width:1440,height:900});await p.goto(U+'#/contato');await p.waitForTimeout(600);
 await p.click('#f-send');await p.waitForTimeout(300);const inv=await p.$$eval('.fld.err',a=>a.length);if(!inv)issues.push('form: envio vazio não marcou erros');
 await p.fill('#f-nome','Teste');await p.fill('#f-email','teste@exemplo.com');await p.selectOption('#f-assunto',{index:1});await p.fill('#f-msg','Mensagem de teste com mais de dez caracteres.');await p.check('#f-consent');await p.click('#f-send');await p.waitForTimeout(1200);
 const ok=await p.evaluate(()=>document.querySelector('#f-ok').classList.contains('on'));if(!ok)issues.push('form: envio válido não mostrou confirmação');
 // navegação por teclado entre páginas: foco vai para o conteúdo
 await p.goto(U+'#/');await p.waitForTimeout(500);await p.click('.nav a[data-route="projetos"]');await p.waitForTimeout(900);const sy=await p.evaluate(()=>scrollY);if(sy!==0)issues.push('troca de página não voltou ao topo: '+sy);
 console.log(issues.length?'PROBLEMAS:\n- '+issues.join('\n- '):'VARREDURA LIMPA');await b.close();s.close();})();
