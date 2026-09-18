const {chromium}=require('playwright'),http=require('http'),fs=require('fs');
const s=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8455);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.goto('http://localhost:8455/#/');await p.waitForTimeout(600);
 await p.evaluate(()=>document.querySelector('.about-photo').scrollIntoView({block:'center'}));
 await p.waitForTimeout(1500); // fim da transição .rv
 const r=await p.evaluate(()=>{const el=document.querySelector('.about-photo');const cs=getComputedStyle(el,'::after');const rc=el.getBoundingClientRect();return {border:cs.borderTopColor,iso:getComputedStyle(el).isolation,x:rc.right+14,y:rc.bottom+14};});
 // pixel na borda inferior direita da moldura (14px fora da foto): deve ser cor areia, não navy puro
 const shot=await p.screenshot({clip:{x:r.x-1,y:r.y-1,width:2,height:2}});
 const {PNG}=require('pngjs');const png=PNG.sync.read(shot);const px=[png.data[0],png.data[1],png.data[2]];
 await p.screenshot({path:'/tmp/claude-0/-home-claude/48ab517a-2ec5-5d2c-a8ab-70cec59ec48c/scratchpad/about-frame.png',clip:{x:0,y:0,width:1440,height:900}});
 console.log(r,'pixel',px, px[0]>60?'MOLDURA VISÍVEL':'MOLDURA SUMIDA');
 await b.close();s.close();})();
