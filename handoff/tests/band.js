const {chromium}=require('playwright');const fs=require('fs'),http=require('http');
(async()=>{const srv=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8425);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const issues=[];
for(const [w,h] of [[1440,900],[1920,1080],[2560,1440],[375,740],[1366,768]]){const p=await b.newPage({viewport:{width:w,height:h}});
 for(const r of ['/contato','/projetos','/','/projeto/mini-casa-loft','/nada']){await p.goto('http://localhost:8425/#'+r);await p.waitForTimeout(600);
  const m=await p.evaluate(()=>{const f=document.querySelector('.ftr').getBoundingClientRect();return {ftrBottom:Math.round(f.bottom),doc:document.documentElement.scrollHeight,vh:innerHeight}});
  if(m.doc<m.vh||m.ftrBottom<m.vh-1)issues.push(`${r}@${w}x${h}: rodapé termina em ${m.ftrBottom}px de ${m.vh} (doc ${m.doc})`);}
 // header nos cantos e hero no gutter
 await p.goto('http://localhost:8425/#/');await p.waitForTimeout(600);
 const g=await p.evaluate(()=>({brandL:Math.round(document.querySelector('.hdr .brand').getBoundingClientRect().left),navR:Math.round(innerWidth-document.querySelector('.hdr .nav').getBoundingClientRect().right),heroL:Math.round(document.querySelector('.hero-content').getBoundingClientRect().left),gutter:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter'))}));
 if(Math.abs(g.brandL-g.gutter)>2||Math.abs(g.heroL-g.gutter)>2)issues.push(`@${w}: header/hero fora do gutter ${JSON.stringify(g)}`);
 await p.close();}
console.log(issues.length?('PROBLEMAS:\n- '+issues.join('\n- ')):'SEM FAIXA / BORDAS OK');
await b.close();srv.close();})();
