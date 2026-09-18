const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const s=http.createServer((q,r)=>{r.setHeader('content-type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8400);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const issues=[];
 // reflow 320px: sem rolagem horizontal
 for(const h of ['/','/projetos','/projeto/edificio-vitalis','/contato']){const p=await b.newPage({viewport:{width:320,height:640}});await p.goto('http://localhost:8400/#'+h);await p.waitForTimeout(800);
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(ov>0)issues.push(`overflow ${ov}px em ${h}@320`);await p.close();}
 // foco visível em todos os interativos da home + carrossel por teclado
 const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:8400/#/');await p.waitForTimeout(900);
 await p.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>e.classList.add('in')));
 let n=0,noOutline=[];
 for(let i=0;i<60;i++){await p.keyboard.press('Tab');const r=await p.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const cs=getComputedStyle(e);const vis=(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none'||e.matches(':focus-visible')&&(cs.textDecorationLine.includes('underline'));return {tag:e.tagName+'.'+(e.className||'').toString().slice(0,20)+' '+(e.getAttribute('aria-label')||e.textContent.trim().slice(0,15)),vis,fv:e.matches(':focus-visible'),inert:e.closest('[inert]')!==null};});
  if(!r)break;n++;if(r.fv&&!r.vis)noOutline.push(r.tag);if(r.inert)issues.push('foco entrou em elemento inerte: '+r.tag);}
 if(noOutline.length)issues.push('foco sem indicador visível: '+[...new Set(noOutline)].join(' | '));
 // carrossel: foco na trilha + setas
 await p.focus('#qtrack');const sl0=await p.$eval('#qtrack',t=>t.scrollLeft);await p.keyboard.press('ArrowRight');await p.waitForTimeout(800);const sl1=await p.$eval('#qtrack',t=>t.scrollLeft);
 if(sl1<=sl0)issues.push('ArrowRight não moveu o carrossel');
 await p.keyboard.press('ArrowLeft');await p.waitForTimeout(800);const sl2=await p.$eval('#qtrack',t=>t.scrollLeft);if(sl2!==sl0)issues.push('ArrowLeft não voltou');
 // botões do carrossel acessíveis por Tab e Enter
 await p.focus('.qbtn[data-dir="1"]');await p.keyboard.press('Enter');await p.waitForTimeout(800);if((await p.$eval('#qtrack',t=>t.scrollLeft))<=sl0)issues.push('Enter no botão próximo não moveu');
 // reduced motion: scroll instantâneo e sem transições no card
 const rm=await b.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});await rm.goto('http://localhost:8400/#/');await rm.waitForTimeout(900);
 const tr=await rm.$eval('.qcard',e=>getComputedStyle(e).transitionDuration);if(!/^0s/.test(tr))issues.push('reduced-motion: card ainda anima ('+tr+')');
 // zoom 200% (equivalente a 1280px de largura a 200% = 640px CSS): sem overflow, texto legível
 const z=await b.newPage({viewport:{width:640,height:450}});for(const h of ['/','/contato','/projeto/sala-sindicato']){await z.goto('http://localhost:8400/#'+h);await z.waitForTimeout(700);const ov=await z.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(ov>0)issues.push(`overflow ${ov}px em ${h}@zoom200`);}
 // lang, título, landmarks, skip link
 const meta=await p.evaluate(()=>({lang:document.documentElement.lang,title:document.title,main:!!document.querySelector('main'),nav:!!document.querySelector('nav'),skip:!!document.querySelector('.skip'),h1:document.querySelectorAll('h1').length}));
 if(meta.lang!=='pt-BR'||!meta.main||!meta.nav||!meta.skip||meta.h1!==1)issues.push('estrutura: '+JSON.stringify(meta));
 console.log(issues.length?'PROBLEMAS:\n- '+issues.join('\n- '):'A11Y MANUAL LIMPO ('+n+' elementos focáveis)');await b.close();s.close();})();
