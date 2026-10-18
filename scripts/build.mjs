import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.join(root,'src'), out=path.join(root,'dist');
await mkdir(out,{recursive:true});
const allowed=new Set(['.html','.css','.js','.svg','.png','.webp','.jpg','.woff2']);
async function copy(dir,relative=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error('Symlinks are not included in public builds');
    const rel=path.join(relative,entry.name),file=path.join(dir,entry.name);
    if(entry.isDirectory()){await copy(file,rel);continue;}
    if(!allowed.has(path.extname(entry.name)))throw new Error(`Unexpected public file: ${rel}`);
    if((await stat(file)).size>10*1024*1024)throw new Error(`Oversized public asset: ${rel}`);
    await mkdir(path.dirname(path.join(out,rel)),{recursive:true});await cp(file,path.join(out,rel));
  }
}
await copy(source);console.log('Static site built in dist/ (desktop client excluded).');
