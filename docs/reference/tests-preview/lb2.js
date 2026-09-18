const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const s=http.createServer((q,r)=>{r.setHeader('content-type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8411);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const issues=[];
 const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>issues.push('JS: '+e.message));
 // galeria justificada: cada linha preenche a largura, sem buracos
 for(const slug of ['habitacao-villa-verde','banheiro-chocolate','edificio-vitalis','consultorio-ginecocare','mini-casa','mirante-cestes','vila-jasmim-manga']){
  await p.goto('http://localhost:8411/#/projeto/'+slug);await p.waitForTimeout(700);
  const r=await p.evaluate(()=>{const g=document.querySelector('#gal');const W=g.clientWidth;const bs=[...g.children].map(b=>{const r=b.getBoundingClientRect();return {l:Math.round(r.left-g.getBoundingClientRect().left),r:Math.round(r.right-g.getBoundingClientRect().left),t:Math.round(r.top),h:Math.round(r.height)}});
    const rows={};bs.forEach(x=>{(rows[x.t]=rows[x.t]||[]).push(x)});const bad=[];for(const [t,items] of Object.entries(rows)){items.sort((a,b)=>a.l-b.l);const last=items[items.length-1];if(Math.abs(last.r-W)>2)bad.push('linha em '+t+' termina em '+last.r+'/'+W);const hs=new Set(items.map(i=>i.h));if(hs.size>1)bad.push('alturas diferentes na linha '+t+': '+[...hs]);}
    [...g.children].forEach(b=>{if(Math.abs(b.getBoundingClientRect().height-parseFloat(b.style.height))>1)bad.push('altura renderizada difere do layout: '+b.dataset.i);});
    return {n:bs.length,rows:Object.keys(rows).length,bad,W};});
  if(r.bad.length)issues.push(slug+': '+r.bad.join(' | '));
 }
 // lightbox: abrir, contador, loop, zoom, fechar
 await p.goto('http://localhost:8411/#/projeto/sala-sindicato');await p.waitForTimeout(700);
 await p.click('.gal button[data-i="0"]');await p.waitForTimeout(700);
 const st=async()=>p.evaluate(()=>({open:!!document.querySelector('.pswp--open'),count:document.querySelector('#lb-count')?.textContent,zoom:window.pswpInst?+pswpInst.currSlide.currZoomLevel.toFixed(3):null,fit:window.pswpInst?+pswpInst.currSlide.zoomLevels.fit.toFixed(3):null}));
 let a=await st();if(!a.open||a.count!=='1 / 9')issues.push('abertura: '+JSON.stringify(a));
 await p.keyboard.press('ArrowLeft');await p.waitForTimeout(600);a=await st();if(a.count!=='9 / 9')issues.push('loop para trás: '+a.count);
 await p.keyboard.press('ArrowRight');await p.waitForTimeout(600);a=await st();if(a.count!=='1 / 9')issues.push('loop para frente: '+a.count);
 // zoom por duplo clique e por roda
 const bb=await p.evaluate(()=>{const r=pswpInst.currSlide.content.element.getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height}});
 await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(600);a=await st();if(!(a.zoom>a.fit*1.5))issues.push('clique não ampliou: '+JSON.stringify(a));
 await p.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);await p.waitForTimeout(600);a=await st();if(Math.abs(a.zoom-a.fit)>0.01)issues.push('segundo clique não voltou ao fit: '+JSON.stringify(a));
 await p.evaluate(()=>{const r=pswpInst.currSlide.content.element.getBoundingClientRect();pswpInst.currSlide.content.element.dispatchEvent(new WheelEvent('wheel',{deltaY:-240,bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));});await p.waitForTimeout(500);a=await st();if(!(a.zoom>a.fit*1.05))issues.push('roda não ampliou: '+JSON.stringify(a));
 // arrastar (pan) com zoom: a imagem se move
 const p0=await p.evaluate(()=>pswpInst.currSlide.pan.x);await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);await p.mouse.down();await p.mouse.move(bb.x+bb.width/2-150,bb.y+bb.height/2,{steps:8});await p.mouse.up();await p.waitForTimeout(400);const p1=await p.evaluate(()=>pswpInst.currSlide.pan.x);if(p1>=p0)issues.push('pan com zoom não moveu: '+p0+'→'+p1);
 await p.keyboard.press('Escape');await p.waitForTimeout(600);a=await st();if(a.open)issues.push('Escape não fechou');
 const foc=await p.evaluate(()=>document.activeElement&&document.activeElement.closest('#gal')?document.activeElement.dataset.i:null);if(foc!=='0')issues.push('foco não voltou para a miniatura: '+foc);
 // clique fora da imagem fecha? (fundo) e prancha em zoom
 // grade de projetos 10 => 3,3,3 + 1 largo
 await p.goto('http://localhost:8411/#/projetos');await p.waitForTimeout(700);await p.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>{e.classList.add('in');e.style.transition='none'}));await p.waitForTimeout(300);
 const g=await p.evaluate(()=>{const ws=[...document.querySelectorAll('.card-wrap')].map(c=>{const r=c.getBoundingClientRect();return [Math.round(r.top),Math.round(r.width)]});const rows={};ws.forEach(([t,w])=>{(rows[t]=rows[t]||[]).push(w)});return Object.values(rows).map(r=>r.length);});
 if(JSON.stringify(g)!==JSON.stringify([1,3,3,3]))issues.push('grid desktop: '+JSON.stringify(g));
 // carrossel infinito
 await p.goto('http://localhost:8411/#/');await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('#depoimentos').scrollIntoView());await p.waitForTimeout(500);
 const vis=async()=>p.evaluate(()=>[...document.querySelectorAll('.qcard:not(.dim)')].map(c=>c.querySelector('b').textContent).join(','));
 const v0=await vis();for(let i=0;i<6;i++){await p.click('.qbtn.next');await p.waitForTimeout(700);}await p.waitForTimeout(300);const v6=await vis();
 if(v0!==v6)issues.push('loop 6x next não voltou ao início: '+v0+' vs '+v6);
 await p.click('.qbtn.prev');await p.waitForTimeout(800);const vp=await vis();if(!vp.startsWith('Leon'))issues.push('prev do início não foi para o último: '+vp);
 // recarregar mantém a rota e volta ao topo
 await p.goto('http://localhost:8411/#/contato');await p.waitForTimeout(600);await p.evaluate(()=>scrollTo(0,600));await p.waitForTimeout(200);
 await p.reload();await p.waitForTimeout(900);const rl=await p.evaluate(()=>({h:location.hash,y:scrollY,page:document.body.dataset.page}));if(rl.page!=='contato'||rl.y!==0)issues.push('reload contato: '+JSON.stringify(rl));
 await p.goto('http://localhost:8411/#/');await p.waitForTimeout(600);await p.evaluate(()=>scrollTo(0,1200));await p.waitForTimeout(200);await p.reload();await p.waitForTimeout(900);const rh=await p.evaluate(()=>scrollY);if(rh!==0)issues.push('reload home não voltou ao topo: '+rh);
 // sem hash (host perdeu) após estar em projetos
 await p.goto('http://localhost:8411/#/projetos');await p.waitForTimeout(500);await p.goto('http://localhost:8411/');await p.waitForTimeout(900);const rp=await p.evaluate(()=>document.body.dataset.page);if(rp!=='projetos')issues.push('rota não restaurada sem hash: '+rp);
 await p.close();
 // mobile: grade sem legenda, overlay permanente; galeria 1 por linha p/ paisagem
 const m=await b.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true});m.on('pageerror',e=>issues.push('JS mobile: '+e.message));
 await m.goto('http://localhost:8411/#/projetos');await m.waitForTimeout(800);
 const mo=await m.evaluate(()=>{const c=document.querySelector('.card');const cs=getComputedStyle(c.querySelector('.card-txt'));return {txt:cs.opacity,veil:getComputedStyle(c.querySelector('.card-veil')).backgroundColor,cap:getComputedStyle(document.querySelector('.card-cap')).display}});
 if(mo.txt!=='1'||mo.cap!=='none'||mo.veil==='rgba(35, 45, 56, 0)')issues.push('mobile overlay: '+JSON.stringify(mo));
 await m.goto('http://localhost:8411/#/projeto/habitacao-villa-verde');await m.waitForTimeout(700);
 const mg=await m.evaluate(()=>{const g=document.querySelector('#gal');const W=g.clientWidth;return [...g.children].map(b=>{const r=b.getBoundingClientRect();return Math.round(r.right-g.getBoundingClientRect().left)}).filter(x=>Math.abs(x-W)>2).length});
 // (linhas com 2 retratos terminam na largura total também) -> só checa que todas as linhas terminam em W
 const mrows=await m.evaluate(()=>{const g=document.querySelector('#gal');const W=g.clientWidth;const rows={};[...g.children].forEach(b=>{const r=b.getBoundingClientRect();(rows[Math.round(r.top)]=rows[Math.round(r.top)]||[]).push(Math.round(r.right-g.getBoundingClientRect().left))});return Object.values(rows).map(r=>Math.max(...r)-W).filter(d=>Math.abs(d)>2).length});
 if(mrows)issues.push('galeria mobile com linhas incompletas: '+mrows);
 await m.click('.gal button[data-i="0"]');await m.waitForTimeout(800);const mopen=await m.evaluate(()=>!!document.querySelector('.pswp--open'));if(!mopen)issues.push('lightbox mobile não abriu');
 console.log(issues.length?'PROBLEMAS:\n- '+issues.join('\n- '):'LB2 LIMPO');await b.close();s.close();})();
