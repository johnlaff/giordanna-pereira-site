const {chromium}=require('playwright');const fs=require('fs');
const b64=f=>fs.readFileSync(f).toString('base64');
const font=(file,fam,w)=>`@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${b64('fonts/'+file)}) format('woff2')}`;
const css=`${font('cormorant-garamond-latin-500-normal.woff2','Cormorant',500)}${font('jost-latin-400-normal.woff2','Jost',400)}
*{margin:0;box-sizing:border-box}body{width:1200px;height:800px;background:#E4E8EA;font-family:Jost;color:#2E3A48;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.c1{position:absolute;width:640px;height:640px;border-radius:50%;border:1px solid rgba(46,58,72,.18);right:-180px;top:-260px}
.c2{position:absolute;width:520px;height:520px;border-radius:50%;background:rgba(205,188,164,.22);left:-200px;bottom:-240px}
.box{text-align:center;position:relative}
.mark{display:block;width:44px;height:44px;position:relative;margin:0 auto 34px}.mark i{position:absolute;width:20px;height:20px;border-radius:50%;background:#2E3A48}
.mark i:nth-child(1){left:0;top:0;opacity:.55}.mark i:nth-child(2){right:0;top:0}.mark i:nth-child(3){left:0;bottom:0;border-radius:0 0 0 20px}.mark i:nth-child(4){right:0;bottom:0;border-radius:0 0 20px 0;opacity:.4}
h1{font-family:Cormorant;font-weight:500;font-size:64px;line-height:1.05}
p{margin-top:0;font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:#5E6B78}`;
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const p=await b.newPage({viewport:{width:1200,height:800}});
 await p.setContent(`<style>${css}</style><div class="c1"></div><div class="c2"></div><div class="box"><p>Imagens em breve</p></div>`);
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(150);
 await p.screenshot({path:'new/web/mirante-mock.png'});await b.close();})();
