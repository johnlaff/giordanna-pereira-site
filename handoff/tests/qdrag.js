const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const s=http.createServer((q,r)=>{r.setHeader('content-type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8397);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1440,height:900}});const issues=[];
 await p.goto('http://localhost:8397/#/');await p.waitForTimeout(800);
 await p.evaluate(()=>document.querySelector('#depoimentos').scrollIntoView());await p.waitForTimeout(700);
 const txt=await p.$('.qcard:not(.clone)[data-i="2"] p');const bb=await txt.boundingBox();
 // cursor sobre o texto (repouso)
 await p.mouse.move(bb.x+40,bb.y+20);const cur=await p.evaluate(()=>getComputedStyle(document.elementFromPoint(innerWidth/2,0)||document.body).cursor);
 const curTxt=await p.evaluate(([x,y])=>getComputedStyle(document.elementFromPoint(x,y)).cursor,[bb.x+40,bb.y+20]);
 if(curTxt!=='auto'&&curTxt!=='text'&&curTxt!=='default')issues.push('cursor em repouso: '+curTxt);
 // arraste iniciado sobre o texto: não pode selecionar, deve mover o carrossel
 const sl0=await p.$eval('#qtrack',t=>t.scrollLeft);
 await p.mouse.down();for(let i=1;i<=12;i++){await p.mouse.move(bb.x+40-i*30,bb.y+20);await p.waitForTimeout(16);}
 const mid=await p.evaluate(()=>({cur:getComputedStyle(document.querySelector('#qtrack')).cursor,sel:getSelection().toString().length,drag:document.querySelector('#qtrack').classList.contains('drag')}));
 await p.mouse.up();await p.waitForTimeout(900);
 const sl1=await p.$eval('#qtrack',t=>t.scrollLeft);const sel=await p.evaluate(()=>getSelection().toString().length);
 if(mid.drag)issues.push('arraste sobre o texto engatou o carrossel');
 if(!sel)issues.push('arraste sobre o texto não selecionou nada');
 if(sl1!==sl0)issues.push('arraste sobre o texto moveu o carrossel: '+sl0+'→'+sl1);
 await p.evaluate(()=>getSelection().removeAllRanges());
 // arraste pela superfície do card (fora do texto) move e não seleciona
 const card=await (await p.$('.qcard:not(.clone)[data-i="2"]')).boundingBox();const cx=card.x+card.width-12, cy=card.y+card.height/2;
 const c0=await p.evaluate(([x,y])=>getComputedStyle(document.elementFromPoint(x,y)).cursor,[cx,cy]);if(c0!=='grab')issues.push('cursor na superfície do card: '+c0);
 await p.mouse.move(cx,cy);await p.mouse.down();for(let i=1;i<=12;i++){await p.mouse.move(cx-i*30,cy);await p.waitForTimeout(16);}
 const mid2=await p.evaluate(()=>({cur:getComputedStyle(document.querySelector('#qtrack')).cursor,sel:getSelection().toString().length,drag:document.querySelector('#qtrack').classList.contains('drag')}));
 await p.mouse.up();await p.waitForTimeout(900);const slB=await p.$eval('#qtrack',t=>t.scrollLeft);
 if(mid2.cur!=='grabbing'||!mid2.drag)issues.push('arraste pela superfície: '+JSON.stringify(mid2));
 if(mid2.sel||await p.evaluate(()=>getSelection().toString().length))issues.push('arraste pela superfície selecionou texto');
 if(slB<=sl0)issues.push('arraste pela superfície não moveu: '+sl0+'→'+slB);
 const after=await p.evaluate(()=>getComputedStyle(document.querySelector('#qtrack')).cursor);if(after==='grabbing')issues.push('cursor preso em grabbing');
 // movimento abaixo do limiar = clique normal (não move)
 const sl2=await p.$eval('#qtrack',t=>t.scrollLeft);await p.mouse.move(bb.x+60,bb.y+40);await p.mouse.down();await p.mouse.move(bb.x+63,bb.y+41);await p.mouse.up();await p.waitForTimeout(500);
 const sl3=await p.$eval('#qtrack',t=>t.scrollLeft);if(sl3!==sl2)issues.push('movimento < limiar moveu o carrossel');
 // duplo clique seleciona palavra
 const t2=await p.$('.qcard:not(.clone)[data-i="3"] p');const b2=await t2.boundingBox();await p.mouse.dblclick(b2.x+30,b2.y+20);await p.waitForTimeout(200);
 const w=await p.evaluate(()=>getSelection().toString());if(!w.trim())issues.push('duplo clique não selecionou palavra');
 // toque (mobile) continua com scroll nativo
 const m=await b.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true});await m.goto('http://localhost:8397/#/');await m.waitForTimeout(800);
 await m.evaluate(()=>document.querySelector('#depoimentos').scrollIntoView());await m.waitForTimeout(600);
 const tb=await (await m.$('#qtrack')).boundingBox();const ms0=await m.$eval('#qtrack',t=>t.scrollLeft);
 const cdp=await m.context().newCDPSession(m);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tb.x+300,y:tb.y+150}]});
 for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tb.x+300-i*22,y:tb.y+150}]});await m.waitForTimeout(16);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(900);
 const ms1=await m.$eval('#qtrack',t=>t.scrollLeft);if(ms1<=ms0)issues.push('toque não moveu: '+ms0+'→'+ms1);
 console.log(issues.length?'PROBLEMAS:\n- '+issues.join('\n- '):'DRAG LIMPO');await b.close();s.close();})();
