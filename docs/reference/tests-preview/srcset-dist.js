const {chromium}=require('playwright');
const s=require('./static')(8422,'dist');
(async()=>{
 const b=await chromium.launch(); const issues=[];
 for(const [w,h,dpr] of [[2560,1440,1],[1440,900,2],[390,844,3]]){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:dpr});
  const bad=[]; p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url());});
  await p.goto('http://localhost:8422/#/');await p.waitForTimeout(1200);
  const hero=await p.evaluate(()=>getComputedStyle(document.querySelector('.hero-img')).backgroundImage);
  await p.goto('http://localhost:8422/#/projetos');await p.waitForTimeout(1500);
  await p.evaluate(()=>window.scrollTo(0,99999));await p.waitForTimeout(1200);
  const cards=await p.evaluate(()=>[...document.querySelectorAll('.card img')].slice(0,3).map(i=>i.currentSrc.split('/').pop()+' @'+Math.round(i.getBoundingClientRect().width)+'css'));
  await p.goto('http://localhost:8422/#/projeto/edificio-vitalis');await p.waitForTimeout(1500);
  const gal=await p.evaluate(()=>[...document.querySelectorAll('#gal img')].slice(0,4).map(i=>i.currentSrc.split('/').pop()+' @'+Math.round(i.getBoundingClientRect().width)+'css'));
  await p.click('#gal button');await p.waitForTimeout(1800);
  const lb=await p.evaluate(()=>{const i=document.querySelector('.pswp__img');return i?i.currentSrc.split('/').pop()+' @'+Math.round(i.getBoundingClientRect().width)+'css':'NO IMG'});
  console.log(`\n[${w}x${h} @${dpr}x] hero=${hero.replace(/.*\//,'').replace(/"\)$/,'')}\n cards: ${cards.join(' | ')}\n gal: ${gal.join(' | ')}\n lightbox: ${lb}`);
  if(bad.length)issues.push(...bad);
  await p.close();
 }
 console.log(issues.length?'PROBLEMAS: '+issues.join(', '):'\nSRCSET LIMPO (sem 404)');
 await b.close();s.close();
})();
