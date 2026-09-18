const { chromium } = require('playwright');
const fs=require('fs'),http=require('http');
(async()=>{
 const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8411);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const issues=[],errs=[];
 const p=await b.newPage({viewport:{width:375,height:740}});p.on('pageerror',e=>errs.push(e.message));
 const go=async h=>{await p.goto('http://localhost:8411/#'+h);await p.waitForTimeout(800);};
 await go('/projeto/edificio-vitalis');await p.click('#gal button[data-i="0"]');await p.waitForTimeout(500);let c=await p.$eval('#lb-count',e=>e.textContent);if(c!=='1 / 31')issues.push('vitalis: '+c);await p.keyboard.press('Escape');await p.waitForTimeout(500);
 await p.click('.pn a.next');await p.waitForTimeout(900);await p.click('#gal button[data-i="0"]');await p.waitForTimeout(500);c=await p.$eval('#lb-count',e=>e.textContent);if(c!=='1 / 11')issues.push('vila: '+c);await p.keyboard.press('Escape');await p.waitForTimeout(500);
 // voltar ao Vitalis (cache) -> galeria certa
 await p.click('.pn a:not(.next)');await p.waitForTimeout(900);const h1=await p.$eval('main h1',e=>e.textContent.trim());
 await p.click('#gal button[data-i="0"]');await p.waitForTimeout(500);c=await p.$eval('#lb-count',e=>e.textContent);if(c!=='1 / 31')issues.push('cache vitalis: '+c+' ('+h1+')');await p.keyboard.press('Escape');await p.waitForTimeout(500);
 // véu: durante a troca, header sempre sólido e véu cobre
 await p.click('.nav a[href="#/"]');const seq=[];for(let i=0;i<12;i++){await p.waitForTimeout(45);seq.push(await p.evaluate(()=>({v:+getComputedStyle(document.querySelector('#veil')).opacity,s:document.querySelector('.hdr').classList.contains('solid'),op:+getComputedStyle(document.querySelector('main')).opacity,dark:document.querySelector('#veil').classList.contains('dark')})));}
 if(seq.some(x=>x.op<1))issues.push('main animou opacidade');
 if(!seq.some(x=>x.v>0.8))issues.push('véu não cobriu');
 if(seq.some(x=>!x.s&&x.v>0.05&&!x.dark))issues.push('header transparente com véu claro ativo');if(!seq.some(x=>x.dark))issues.push('véu da home não é escuro');
 await p.waitForTimeout(600);const home=await p.$eval('main h1',e=>e.textContent.trim());if(!/Espaços/.test(home))issues.push('home: '+home);
 const hv=await p.evaluate(()=>+getComputedStyle(document.querySelector('#veil')).opacity);if(hv>0)issues.push('véu ficou visível: '+hv);
 const hs=await p.evaluate(()=>document.querySelector('.hdr').classList.contains('solid'));if(hs)issues.push('header não ficou transparente na home');
 // formulário resetado ao voltar
 await p.click('.nav a[href="#/contato"]');await p.waitForTimeout(900);await p.fill('#f-nome','A');await p.fill('#f-email','a@b.co');await p.selectOption('#f-assunto','Outro');await p.fill('#f-msg','mensagem com dez caracteres+');await p.check('#f-consent');await p.click('#f-send');await p.waitForTimeout(1000);
 await p.click('.nav a[href="#/"]');await p.waitForTimeout(900);await p.click('.nav a[href="#/contato"]');await p.waitForTimeout(900);
 const fh=await p.$eval('#cf',e=>e.hidden);if(fh)issues.push('formulário não resetou');
 const real=errs.filter(e=>!/ERR_CONNECTION|Failed to load/.test(e));if(real.length)issues.push('JS: '+real.join('|'));
 console.log(seq.map(x=>`${x.v.toFixed(2)}${x.s?'S':'t'}`).join(' '));
 console.log(issues.length?('PROBLEMAS:\n- '+issues.join('\n- ')):'CACHE/VÉU LIMPO');
 await b.close();srv.close();
})().catch(e=>{console.error(e);process.exit(1)});
