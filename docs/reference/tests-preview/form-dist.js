const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path');
let mode='ok';
const s=http.createServer((q,r)=>{
  if(q.method==='POST'&&q.url==='/api/contato'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{console.log(' POST body:',b.slice(0,120)+'…');r.statusCode=mode==='ok'?200:500;r.end();});return;}
  let u=q.url.split('#')[0].split('?')[0];if(u==='/')u='/index.html';const f=u==='/index.html'?'/tmp/claude-0/-home-claude/48ab517a-2ec5-5d2c-a8ab-70cec59ec48c/scratchpad/index-form.html':path.join('dist',u);
  if(!fs.existsSync(f)){r.statusCode=404;return r.end();}r.setHeader('Content-Type',f.endsWith('.html')?'text/html; charset=utf-8':'image/webp');r.end(fs.readFileSync(f));}).listen(8433);
(async()=>{const b=await chromium.launch();const issues=[];
 for(mode of ['ok','fail']){
  const p=await b.newPage({viewport:{width:1280,height:900}});
  await p.goto('http://localhost:8433/#/contato');await p.waitForTimeout(800);
  await p.fill('#f-nome','Teste');await p.fill('#f-email','t@t.com');await p.selectOption('#f-assunto','Outro');await p.fill('#f-msg','Mensagem de teste com mais de dez caracteres');await p.check('#f-consent');
  await p.click('#f-send');await p.waitForTimeout(1200);
  const ok=await p.evaluate(()=>document.querySelector('#f-ok').classList.contains('on'));
  const fail=await p.evaluate(()=>!document.querySelector('#f-fail').hidden);
  const hidden=await p.evaluate(()=>document.querySelector('#cf').hidden);
  console.log(`[${mode}] f-ok=${ok} f-fail=${fail} form-hidden=${hidden}`);
  if(mode==='ok'&&!(ok&&hidden&&!fail))issues.push('sucesso não exibido');
  if(mode==='fail'&&!(fail&&!ok&&!hidden))issues.push('falha não exibida');
  await p.close();}
 console.log(issues.length?'PROBLEMAS: '+issues.join(', '):'FORM DIST LIMPO');await b.close();s.close();})();
