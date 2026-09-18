const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const s=http.createServer((q,r)=>{r.setHeader('content-type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8430);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const issues=[];
 const p=await b.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>issues.push('JS '+e.message));
 await p.goto('http://localhost:8430/#/');await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('#depoimentos').scrollIntoView());await p.waitForTimeout(600);
 const vis=()=>p.evaluate(()=>[...document.querySelectorAll('.qcard:not(.dim)')].map(c=>c.querySelector('b').textContent.slice(0,4)).join(','));
 const sl=()=>p.evaluate(()=>Math.round(document.querySelector('#qtrack').scrollLeft));
 // 1) arraste com mouse para a direita (voltar) a partir do primeiro, segurando parado 400ms antes de soltar
 const card=await (await p.$('.qcard:not(.clone)[data-i="0"]')).boundingBox();const x0=card.x+card.width-12,y0=card.y+card.height/2;
 await p.mouse.move(x0,y0);await p.mouse.down();for(let i=1;i<=10;i++){await p.mouse.move(x0+i*25,y0);await p.waitForTimeout(16);}
 const during=await sl();await p.waitForTimeout(400);const held=await sl();if(Math.abs(held-during)>2)issues.push('saltou enquanto o mouse estava pressionado: '+during+'→'+held);
 await p.mouse.up();await p.waitForTimeout(900);let v=await vis();if(!v.startsWith('Leon,Valq,Mari'))issues.push('arraste para trás do primeiro: '+v);
 // 2) arraste pequeno (menos de meio card) solta e volta para o mesmo
 const c2=await (await p.$('.qcard:not(.clone)[data-i="0"]')).boundingBox();const x1=c2.x+c2.width-12,y1=c2.y+c2.height/2;
 await p.mouse.move(x1,y1);await p.mouse.down();for(let i=1;i<=4;i++){await p.mouse.move(x1-i*20,y1);await p.waitForTimeout(16);}await p.mouse.up();await p.waitForTimeout(900);
 const v2=await vis();if(v2!==v)issues.push('arraste curto mudou de card: '+v+' → '+v2);
 // 3) arraste longo para frente cruzando o fim (a partir do último)
 for(let i=0;i<6;i++){await p.click('.qbtn.next');await p.waitForTimeout(600);}
 v=await vis();
 const c3=await (await p.$('.qcard:not(.dim)')).boundingBox();const x2=c3.x+c3.width-12,y2=c3.y+c3.height/2;
 await p.mouse.move(x2,y2);await p.mouse.down();for(let i=1;i<=16;i++){await p.mouse.move(x2-i*30,y2);await p.waitForTimeout(16);}await p.waitForTimeout(300);await p.mouse.up();await p.waitForTimeout(1000);
 const v3=await vis();const order=['Valq','Mari','Whal','Nath','Mich','Leon'];const first=v.split(',')[0],first3=v3.split(',')[0];
 const d=(order.indexOf(first3)-order.indexOf(first)+6)%6;if(d!==1&&d!==2)issues.push('arraste longo saltou de forma inesperada: '+v+' → '+v3);
 // 4) muitos cliques rápidos
 for(let i=0;i<12;i++){await p.click('.qbtn.next');await p.waitForTimeout(120);}await p.waitForTimeout(1200);const v4=await vis();if(v4.split(',').length!==3)issues.push('após cliques rápidos: '+v4);
 for(let i=0;i<12;i++){await p.click('.qbtn.prev');await p.waitForTimeout(120);}await p.waitForTimeout(1200);const v5=await vis();if(v5.split(',').length!==3)issues.push('após cliques rápidos (prev): '+v5);
 await p.close();
 // 5) toque: deslizar segurando parado antes de soltar, nas duas fronteiras
 const m=await b.newPage({viewport:{width:375,height:812},hasTouch:true,isMobile:true});
 await m.goto('http://localhost:8430/#/');await m.waitForTimeout(800);await m.evaluate(()=>document.querySelector('#depoimentos').scrollIntoView());await m.waitForTimeout(600);
 const tb=await (await m.$('#qtrack')).boundingBox();const cdp=await m.context().newCDPSession(m);
 const swipe=async(dir)=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tb.x+180,y:tb.y+150}]});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tb.x+180+dir*i*18,y:tb.y+150}]});await m.waitForTimeout(16);}await m.waitForTimeout(400);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(1000);};
 const mv=()=>m.evaluate(()=>[...document.querySelectorAll('.qcard:not(.dim)')].map(c=>c.querySelector('b').textContent.slice(0,4)).join(','));
 await swipe(1);const t1=await mv();if(t1!=='Leon')issues.push('toque para trás do primeiro: '+t1);
 await swipe(-1);const t2=await mv();if(t2!=='Valq')issues.push('toque de volta ao primeiro: '+t2);
 for(let i=0;i<5;i++){await swipe(-1);}const t3=await mv();if(t3!=='Leon')issues.push('toque 5x: '+t3);
 await swipe(-1);const t4=await mv();if(t4!=='Valq')issues.push('toque cruzando o fim: '+t4);
 console.log(issues.length?'PROBLEMAS:\n- '+issues.join('\n- '):'LOOP LIMPO');await b.close();s.close();})();
