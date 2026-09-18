// simula o vídeo: mede luminância média da faixa do header a cada frame durante as trocas
const { chromium } = require('playwright');
const fs=require('fs'),http=require('http');
(async()=>{
 const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8416);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:375,height:740}});
 await p.goto('http://localhost:8416/#/');await p.waitForTimeout(1200);
 const lum=async()=>{const buf=await p.screenshot({clip:{x:0,y:0,width:375,height:90},type:'png'});const {PNG}=require('pngjs');const png=PNG.sync.read(buf);let s=0,n=0;for(let i=0;i<png.data.length;i+=4*7){s+=0.299*png.data[i]+0.587*png.data[i+1]+0.114*png.data[i+2];n++;}return Math.round(s/n);};
 const run=async(sel,label)=>{await p.click(sel);const v=[];for(let i=0;i<16;i++){v.push(await lum());}console.log(label,v.join(' '));const spike=v.some((x,i)=>i>0&&x-v[i-1]>25&&x>120);if(spike)console.log('  ⚠ salto claro no header');};
 await run('.nav a[href="#/projetos"]','home→projetos ');
 await p.waitForTimeout(600);await run('.nav a[href="#/"]','projetos→home ');
 await p.waitForTimeout(600);await run('.nav a[href="#/contato"]','home→contato  ');
 await p.waitForTimeout(600);await run('.nav a[href="#/projetos"]','contato→proj  ');
 await b.close();srv.close();
})();
