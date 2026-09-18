const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const AXE=fs.readFileSync('/home/claude/out/node_modules/axe-core/axe.min.js','utf8');
const s=http.createServer((q,r)=>{r.setHeader('content-type','text/html; charset=utf-8');r.end(fs.readFileSync('site-final.html'))}).listen(8399);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const out={};
 for(const w of [1440,375]){
  const p=await b.newPage({viewport:{width:w,height:w>400?900:812}});
  for(const h of ['/','/projetos','/projeto/sala-sindicato','/projeto/banheiro-chocolate','/contato','/xyz']){
   await p.goto('http://localhost:8399/#'+h);await p.waitForTimeout(900);
   await p.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>e.classList.add('in')));
   // varre a página para revelar tudo
   const H=await p.evaluate(()=>document.body.scrollHeight);for(let y=0;y<H;y+=700){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(60);}await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(400);
   await p.addScriptTag({content:AXE});
   const r=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});return r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,4).map(n=>n.target.join(' ')+' :: '+(n.failureSummary||'').split('\n')[1])}));});
   out[h+'@'+w]=r;
  }
  // lightbox aberto
  await p.goto('http://localhost:8399/#/projeto/sala-sindicato');await p.waitForTimeout(900);await p.click('.gal button[data-i="0"]');await p.waitForTimeout(700);
  await p.addScriptTag({content:AXE});
  out['lightbox@'+w]=await p.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}});return r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,4).map(n=>n.target.join(' '))}));});
  await p.close();
 }
 let n=0;for(const [k,v] of Object.entries(out)){if(v.length){n+=v.length;console.log('==',k);for(const x of v){console.log(' -',x.id,'['+x.impact+']',x.help);x.nodes.forEach(t=>console.log('     ',t));}}}
 console.log(n?`\n${n} violações`:'AXE LIMPO');await b.close();s.close();})();
