const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const html=fs.readFileSync('site-final.html');
const s=http.createServer((q,r)=>{if(q.url.startsWith('/host')){r.setHeader('content-type','text/html');r.end('<!doctype html><body style="margin:0"><iframe id="f" src="/site#/" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock" style="width:100vw;height:100vh;border:0"></iframe>');}else{r.setHeader('content-type','text/html; charset=utf-8');r.end(html);}}).listen(8460);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:1440,height:900}});await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://localhost:8460'});const p=await ctx.newPage();const issues=[];
 p.on('pageerror',e=>issues.push('JS '+e.message));
 await p.goto('http://localhost:8460/host');await p.waitForTimeout(1500);
 const f=p.frameLocator('#f');const frame=p.frames().find(fr=>fr.url().includes('/site'));
 // e-mail no rail do hero
 await f.locator('.rail a[href^=mailto]').click();await p.waitForTimeout(500);
 let toast=await frame.evaluate(()=>document.querySelector('.gtoast')?.textContent);let clip=await frame.evaluate(()=>navigator.clipboard.readText().catch(()=>'')); 
 if(!/E-mail copiado: giordannapb.arq@gmail.com/.test(toast||''))issues.push('toast e-mail: '+toast);if(clip!=='giordannapb.arq@gmail.com')issues.push('clipboard e-mail: '+clip);
 // ainda no site (não navegou para página de erro)
 if(!(await frame.evaluate(()=>!!document.querySelector('#hdr'))))issues.push('iframe navegou para fora do site');
 // link externo com _blank (WhatsApp)
 const pagesBefore=ctx.pages().length;await f.locator('.rail a[href*="wa.me"]').click();await p.waitForTimeout(600);
 toast=await frame.evaluate(()=>document.querySelector('.gtoast')?.textContent);clip=await frame.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
 if(ctx.pages().length===pagesBefore){if(!/Link copiado/.test(toast||''))issues.push('toast whatsapp: '+toast);if(!/wa\.me/.test(clip))issues.push('clipboard whatsapp: '+clip);}
 // compartilhar por e-mail em página de projeto
 await frame.evaluate(()=>{location.hash='#/projeto/mini-casa'});await p.waitForTimeout(900);
 await f.locator('.share a[href^="mailto:?"]').click();await p.waitForTimeout(500);toast=await frame.evaluate(()=>document.querySelector('.gtoast')?.textContent);if(!/Link copiado/.test(toast||''))issues.push('toast compartilhar e-mail: '+toast);
 // fora de iframe: comportamento normal (sem interceptar)
 const p2=await ctx.newPage();await p2.goto('http://localhost:8460/site#/');await p2.waitForTimeout(800);
 const emb=await p2.evaluate(()=>EMBEDDED);if(emb)issues.push('EMBEDDED verdadeiro fora de iframe');
 console.log(issues.length?'PROBLEMAS:\n- '+issues.join('\n- '):'EMBED LIMPO');await b.close();s.close();})();
