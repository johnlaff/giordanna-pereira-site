const { chromium } = require('playwright');
const fs=require('fs'),http=require('http');
(async()=>{
 const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8404);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const issues=[];const errs=[];
 const p=await b.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>errs.push(e.message));
 // skip link não muda de página
 await p.goto('http://localhost:8404/#/projetos');await p.waitForTimeout(800);
 await p.keyboard.press('Tab');await p.keyboard.press('Enter');await p.waitForTimeout(400);
 const h1=await p.$eval('main h1',e=>e.textContent.trim());if(h1!=='Projetos')issues.push('skip link mudou de página: '+h1);
 const foc=await p.evaluate(()=>document.activeElement.tagName);if(foc!=='H1')issues.push('skip link não focou o conteúdo: '+foc);
 // voltar com lightbox aberto
 await p.goto('http://localhost:8404/#/projeto/edificio-vitalis');await p.waitForTimeout(800);
 await p.click('#gal button[data-i="0"]');await p.waitForTimeout(400);
 await p.goBack();await p.waitForTimeout(900);
 const open=await p.evaluate(()=>!!document.querySelector('.pswp--open'));const lock=await p.evaluate(()=>document.body.classList.contains('lock'));
 if(open||lock)issues.push('lightbox ficou aberto/travado após voltar');
 // galeria com 2 fotos: loop
 await p.goto('http://localhost:8404/#/projeto/mini-casa');await p.waitForTimeout(800);
 await p.click('#gal button[data-i="1"]');await p.waitForTimeout(700);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(600);
 const c=await p.$eval('#lb-count',e=>e.textContent.trim());if(c!=='1 / 2')issues.push('navegação com 2 fotos: '+c);
 await p.keyboard.press('Escape');
 // rota inválida + volta
 await p.goto('http://localhost:8404/#/qualquer');await p.waitForTimeout(500);
 const nf=await p.$eval('main h1',e=>e.textContent.trim());if(nf!=='Página não encontrada')issues.push('404: '+nf);
 // foco visível: contraste do outline em fundo claro
 await p.goto('http://localhost:8404/#/contato');await p.waitForTimeout(600);
 await p.focus('#f-nome');const oc=await p.evaluate(()=>getComputedStyle(document.activeElement).outlineColor);
 // (o input usa box-shadow próprio; checa um link claro)
 await p.focus('.c-list a');const oc2=await p.evaluate(()=>getComputedStyle(document.activeElement).outlineColor);
 if(!/46, 58, 72/.test(oc2))issues.push('outline em fundo claro não é navy: '+oc2);
 // título das páginas
 await p.goto('http://localhost:8404/#/projetos');await p.waitForTimeout(400);const t=await p.title();if(!/^Projetos — /.test(t))issues.push('title: '+t);
 const real=errs.filter(e=>!/ERR_CONNECTION|Failed to load/.test(e));if(real.length)issues.push('JS: '+real.join('|'));
 console.log(issues.length?('PROBLEMAS:\n- '+issues.join('\n- ')):'QA2 LIMPO');
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
