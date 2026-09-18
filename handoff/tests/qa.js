const { chromium } = require('playwright');
const fs=require('fs'),http=require('http');
(async()=>{
 const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8390);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const issues=[]; const errs=[];
 const p=await b.newPage({viewport:{width:375,height:740}});
 p.on('pageerror',e=>errs.push(e.message));
 const go=async h=>{await p.goto('http://localhost:8390/#'+h);await p.waitForTimeout(700);};
 const ov=async tag=>{const o=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(o>0)issues.push(`overflow ${o}px em ${tag}`);};

 // rotas
 for(const h of ['/','/projetos','/projeto/edificio-vitalis','/contato','/projeto/nao-existe']){
   await go(h); await ov(h+'@375');
   const h1=await p.$eval('main h1',e=>e.textContent.trim()).catch(()=>null);
   if(!h1)issues.push('sem h1 em '+h);
   const cur=await p.$$eval('.nav a[aria-current=page]',a=>a.length);
   if(h!=='/projeto/nao-existe'&&cur!==1)issues.push('aria-current errado em '+h+' ('+cur+')');
 }
 // header CAU + Home
 const cau=await p.$eval('.brand-cau',e=>e.textContent.trim()); if(cau!=='CAU nº A333733-2')issues.push('CAU header: '+cau);
 const navTxt=await p.$$eval('.nav a',a=>a.map(x=>x.textContent.trim()).join(','));
 if(navTxt!=='Home,Projetos,Contato')issues.push('nav: '+navTxt);
 // footer em todas as páginas + CAU centralizado
 const fcau=await p.$eval('.ftr-cau b',e=>e.textContent.trim()); if(fcau!=='CAU nº A333733-2')issues.push('CAU footer: '+fcau);
 // hero rail
 await go('/'); const rail=await p.$$eval('.rail a',a=>a.length); if(rail!==4)issues.push('rail social: '+rail);
 // viúva no hero-sub: última linha com 1 palavra?
 const widow=await p.evaluate(()=>{const el=document.querySelector('.hero-sub');const r=document.createRange();const words=el.textContent.trim().split(/\s+/);const last=words[words.length-1];const t=el.firstChild;const idx=el.textContent.lastIndexOf(last);r.setStart(t,idx);r.setEnd(t,idx+last.length);const lr=r.getBoundingClientRect();const prev=words[words.length-2];const pi=el.textContent.lastIndexOf(prev);r.setStart(t,pi);r.setEnd(t,pi+prev.length);const pr=r.getBoundingClientRect();return Math.abs(lr.top-pr.top)>4;});
 if(widow)issues.push('viúva no hero-sub @375');

 // grid + hover (desktop)
 const d=await b.newPage({viewport:{width:1280,height:800}}); d.on('pageerror',e=>errs.push(e.message));
 await d.goto('http://localhost:8390/#/projetos');await d.waitForTimeout(1600);
 const cards=await d.$$eval('.card',a=>a.length); if(cards!==10)issues.push('cards: '+cards);
 await d.hover('.card'); await d.waitForTimeout(300); await d.hover('.card'); await d.waitForTimeout(900);
 const hov=await d.evaluate(()=>{const c=document.querySelector('.card');return {veil:getComputedStyle(c.querySelector('.card-veil')).backgroundColor,txt:getComputedStyle(c.querySelector('.card-txt')).opacity,mark:getComputedStyle(c.querySelector('.card-mark i:nth-child(2)')).opacity}});
 if(!/0\.5/.test(hov.veil)||+hov.txt<0.9||+hov.mark<0.9)issues.push('hover: '+JSON.stringify(hov));
 await d.screenshot({path:'q-hover.jpg',quality:70,type:'jpeg'});

 // lightbox infinito
 await d.goto('http://localhost:8390/#/projeto/edificio-vitalis');await d.waitForTimeout(900);
 const n=await d.$$eval('#gal button',a=>a.length);
 await d.click('#gal button[data-i="0"]'); await d.waitForTimeout(500);
 if(!(await d.evaluate(()=>!!document.querySelector('.pswp--open'))))issues.push('lightbox não abriu');
 for(let i=0;i<n;i++){await d.keyboard.press('ArrowRight');await d.waitForTimeout(560);}
 const cnt=await d.$eval('#lb-count',e=>e.textContent.trim()); if(cnt!=='1 / '+n)issues.push('loop infinito falhou: '+cnt+' (esperado 1 / '+n+')');
 await d.keyboard.press('ArrowLeft');await d.waitForTimeout(560);
 const cnt2=await d.$eval('#lb-count',e=>e.textContent.trim()); if(cnt2!==n+' / '+n)issues.push('loop reverso falhou: '+cnt2);
 const lock=await d.evaluate(()=>document.body.classList.contains('lock')); if(!lock)issues.push('scroll não travado no lightbox');
 await d.screenshot({path:'q-lb.jpg',quality:70,type:'jpeg'});
 await d.keyboard.press('Escape');await d.waitForTimeout(700);
 if(await d.evaluate(()=>!!document.querySelector('.pswp--open')))issues.push('Esc não fechou');
 if(await d.evaluate(()=>document.body.classList.contains('lock')))issues.push('lock não removido');
 // share
 const sh=await d.$$eval('.share a',a=>a.map(x=>x.getAttribute('title')).join(','));
 if(sh!=='WhatsApp,LinkedIn,Facebook,E-mail')issues.push('share: '+sh);
 const ficha=await d.$$eval('.ficha dt',a=>a.map(x=>x.textContent).join(','));
 if(ficha!=='Local,Ano,Área,Equipe')issues.push('ficha: '+ficha);
 // prev/next projeto
 await d.click('.pn a.next');await d.waitForTimeout(700);
 if(!/consultorio-ginecocare/.test(d.url()))issues.push('próximo projeto falhou: '+d.url());
 await d.screenshot({path:'q-proj.jpg',quality:70,type:'jpeg',fullPage:false});

 // formulário
 await d.goto('http://localhost:8390/#/contato');await d.waitForTimeout(800);
 await d.click('#f-send');await d.waitForTimeout(200);
 const errCount=await d.$$eval('.fld.err',a=>a.length); if(errCount<3)issues.push('validação não marcou campos: '+errCount);
 await d.fill('#f-nome','Teste');await d.fill('#f-email','teste@exemplo.com');await d.selectOption('#f-assunto','Projeto residencial');await d.fill('#f-msg','Mensagem de teste com mais de dez caracteres.');await d.check('#f-consent');
 await d.click('#f-send');await d.waitForTimeout(1200);
 if(!(await d.$eval('#f-ok',e=>e.classList.contains('on'))))issues.push('sucesso do formulário não apareceu');
 // centralização do contato
 const centered=await d.evaluate(()=>{const w=document.querySelector('.cgrid').getBoundingClientRect();const vw=document.documentElement.clientWidth;return Math.abs((w.left+w.right)/2-vw/2)<4;});
 if(!centered)issues.push('contato não centralizado');
 await d.screenshot({path:'q-contato.jpg',quality:70,type:'jpeg',fullPage:true});

 // larguras
 for(const w of [320,768,1440]){await d.setViewportSize({width:w,height:800});for(const h of ['/','/projetos','/projeto/espaco-aparecer','/contato']){await d.goto('http://localhost:8390/#'+h);await d.waitForTimeout(500);const o=await d.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(o>0)issues.push(`overflow ${o}px ${h}@${w}`);}}

 // a11y básicos
 await d.setViewportSize({width:1280,height:800});await d.goto('http://localhost:8390/#/projeto/edificio-vitalis');await d.waitForTimeout(600);
 const noalt=await d.$$eval('img',a=>a.filter(i=>i.getAttribute('alt')===null).length); if(noalt)issues.push(noalt+' img sem alt');
 const heads=await d.$$eval('h1,h2,h3',a=>a.map(h=>+h.tagName[1])); let last=0;for(const h of heads){if(last&&h-last>1)issues.push('salto heading '+last+'->'+h);last=h;}
 const small=await d.$$eval('a,button',a=>a.filter(e=>!e.closest('.ficha dd')).filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.height<24||r.width<24)}).map(e=>e.textContent.trim().slice(0,15)||e.getAttribute('aria-label')));
 if(small.length)issues.push('alvos <24px: '+small.join('|'));

 const realErrs=errs.filter(e=>!/ERR_CONNECTION|Failed to load/.test(e));
 if(realErrs.length)issues.push('JS: '+realErrs.join(' | '));
 console.log(issues.length?('PROBLEMAS:\n- '+issues.join('\n- ')):'TUDO LIMPO');
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
