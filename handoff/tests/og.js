const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const A='new/web';
const b64=f=>fs.readFileSync(f).toString('base64');
const font=(file,fam,w)=>`@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${b64('fonts/'+file)}) format('woff2')}`;
const css=`${font('cormorant-garamond-latin-500-normal.woff2','Cormorant',500)}${font('jost-latin-300-normal.woff2','Jost',300)}${font('jost-latin-400-normal.woff2','Jost',400)}
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;background:#232D38;font-family:Jost;color:#F1F2F0;position:relative}
.bg{position:absolute;inset:0;background-size:cover;background-position:var(--pos,center 40%)}
.veil{position:absolute;inset:0;background:linear-gradient(12deg,rgba(35,45,56,.94) 0%,rgba(35,45,56,.55) 45%,rgba(35,45,56,.08) 80%)}
.txt{position:absolute;left:72px;right:72px;bottom:64px}
.brand{display:flex;align-items:center;gap:16px;margin-bottom:26px}
.mark{width:34px;height:34px;position:relative}.mark i{position:absolute;width:16px;height:16px;border-radius:50%;background:#F1F2F0}
.mark i:nth-child(1){left:0;top:0;opacity:.55}.mark i:nth-child(2){right:0;top:0}.mark i:nth-child(3){left:0;bottom:0;border-radius:0 0 0 16px}.mark i:nth-child(4){right:0;bottom:0;opacity:.35;border-radius:0 0 16px 0}
.brand span{font-family:Cormorant;font-weight:500;font-size:30px;letter-spacing:.02em}
.brand small{font-family:Jost;font-weight:400;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#CDBCA4;margin-left:10px}
h1{font-family:Cormorant;font-weight:500;font-size:var(--fs,84px);line-height:1.02;max-width:820px}
h1 em{font-style:normal;color:#AFC0CC}
p{font-weight:300;font-size:24px;margin-top:18px;color:rgba(241,242,240,.85);max-width:680px}
.kind{font-weight:400;font-size:14px;letter-spacing:.26em;text-transform:uppercase;color:#CDBCA4;margin-bottom:14px}`;
const cards=[
 {file:'home',img:'hero',pos:'center 30%',html:`<div class="brand"><span class="mark"><i></i><i></i><i></i><i></i></span><span>Giordanna Pereira</span><small>Arquitetura</small></div><h1>Espaços projetados <em>para viver.</em></h1><p>Arquiteta e urbanista · Uberlândia, MG</p>`},
 {file:'sala-sindicato',img:'sind-r04',kind:'Comercial',title:'Sala Sindicato'},
 {file:'consultorio-ginecocare',img:'gineco-r04',kind:'Consultório · Saúde',title:'Consultório GinecoCare'},
 {file:'mirante-cestes',img:'mirante-mock',kind:'Comercial',title:'Mirante CESTES'},
 {file:'habitacao-villa-verde',img:'vv-r01',kind:'Conjunto habitacional',title:'Habitação Villa Verde'},
 {file:'unidade-basica-de-saude',img:'ubs-r04',kind:'Hospitalar',title:'Unidade Básica de Saúde'},
 {file:'edificio-vitalis',img:'vitalis-torre-sky',kind:'Comercial · Bem-estar',title:'Edifício Vitalis'},
 {file:'mini-casa',img:'loft-render',kind:'Residencial',title:'Mini Casa'},
 {file:'banheiro-chocolate',img:'banheiro-n04',pos:'center 45%',kind:'Residencial',title:'Banheiro Chocolate'},
 {file:'vila-jasmim-manga',img:'vila-1',kind:'Habitação de interesse social',title:'Vila Jasmim Manga'},
 {file:'espaco-aparecer',img:'aparecer-r01',kind:'Equipamento multifuncional',title:'Espaço Aparecer'},
 {file:'contato',img:'vitalis-d09',kind:'Contato',title:'Tem um projeto para tirar do papel?',fs:'70px'},
];
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 for(const c of cards){const p=await b.newPage({viewport:{width:1200,height:630}});
  const img='data:image/webp;base64,'+b64(path.join(A,c.img+'.webp'));
  const inner=c.html||`<div class="brand"><span class="mark"><i></i><i></i><i></i><i></i></span><span>Giordanna Pereira</span><small>Arquitetura</small></div><div class="kind">${c.kind}</div><h1 style="--fs:${c.fs||'84px'}">${c.title}</h1>`;
  await p.setContent(`<style>${css}</style><div class="bg" style="background-image:url(${img});--pos:${c.pos||'center 40%'}"></div><div class="veil"></div><div class="txt">${inner}</div>`);
  await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(150);
  await p.screenshot({path:`og/${c.file}.jpg`,type:'jpeg',quality:82});await p.close();}
 await b.close();
 console.log(fs.readdirSync('og').map(f=>f+' '+Math.round(fs.statSync('og/'+f).size/1024)+'KB').join('\n'));
})();
