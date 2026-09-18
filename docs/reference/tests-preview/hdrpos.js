const {chromium}=require('playwright');const fs=require('fs'),http=require('http');
(async()=>{const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8426);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const issues=[];
for(const w of [1440,1024,375]){const p=await b.newPage({viewport:{width:w,height:900}});let ref=null;
 for(const r of ['/','/projetos','/projeto/edificio-vitalis','/contato','/nada']){await p.goto('http://localhost:8426/#'+r);await p.waitForTimeout(500);
  const m=await p.evaluate(()=>{const R=e=>{const b=document.querySelector(e).getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]};return {hdr:R('.hdr'),brand:R('.hdr .brand'),nav:R('.hdr .nav'),home:R('.nav a[data-route=home]'),contato:R('.nav a[data-route=contato]')}});
  const key=JSON.stringify(m); if(ref===null){ref=key;} else if(key!==ref){issues.push(`@${w} ${r}: header em posição diferente\n    ref ${ref}\n    got ${key}`);}
 }
 await p.close();}
console.log(issues.length?('PROBLEMAS:\n- '+issues.join('\n- ')):'HEADER IDÊNTICO EM TODAS AS PÁGINAS (1440/1024/375)');
await b.close();srv.close();})();
