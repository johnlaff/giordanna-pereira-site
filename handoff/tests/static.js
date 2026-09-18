// servidor estático simples p/ testar o dist
const http=require('http'),fs=require('fs'),path=require('path');
const T={'.html':'text/html; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.js':'text/javascript'};
module.exports=(port,root)=>http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0].split('#')[0]);if(u==='/')u='/index.html';const f=path.join(root,u);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end('404');}
 r.setHeader('Content-Type',T[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(r);}).listen(port);
