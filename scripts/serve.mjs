import { spawn } from 'node:child_process';
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../src/',import.meta.url)));
const release=process.env.SOFT999_PREVIEW_RELEASE||'';
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    if(pathname==='/api/release'){let available=false;try{available=!!release&&(await stat(release)).isFile();}catch{}res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({available}));return;}
    let file;
    if(pathname==='/download/client.zip'){
      if(!release){res.writeHead(404);res.end();return;}file=release;res.setHeader('Content-Disposition','attachment; filename="Soft-99.9-Windows-Free.zip"');res.setHeader('Content-Type','application/zip');
    }else{
      file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end();return;}
      res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    }
    const item=await stat(file);if(!item.isFile())throw new Error('Not a file');
    res.setHeader('Content-Length',item.size);res.setHeader('Cache-Control','no-store');res.writeHead(200);
    if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  } catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Страница не найдена');}
});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${port}`;console.log(`Soft 99.9 landing: ${url}`);
  if(process.argv.includes('--open')&&process.platform==='win32'){
    const child=spawn('cmd.exe',['/d','/s','/c',`start "" "${url}"`],{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();
  }
});
