// mainの完成版を本番ルートへ配置し、共有済みの/cube/と従来版も残す。
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const game=join(root,'prototype-3d/dist'),classic=join(root,'.build/classic'),output=join(root,'dist');

// ビルドが揃ってから、生成物の出力先だけを作り直す。
await Promise.all([access(join(game,'index.html')),access(join(classic,'index.html'))]);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(game,output,{recursive:true});
await cp(game,join(output,'cube'),{recursive:true});
await cp(classic,join(output,'classic'),{recursive:true});
await writeFile(join(output,'.nojekyll'),'');

// 各URLのHTMLから参照する、ローカルのスクリプトとCSSが存在することを確認する。
for(const path of ['', 'cube', 'classic']){
  const directory=join(output,path),html=await readFile(join(directory,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^\"]+)"/g))await access(join(directory,match[1]));
}
console.log('本番 /、共有済み /cube/、従来版 /classic/ を dist/ に作成しました。');
