import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {restyleHexEdges,edgeCoordinates} from '../src/lib/generators/spirits/regionalHexEdges.js';
const root=path.resolve('exports/spirit-regional-edges-v2');
const source=JSON.parse(await fs.readFile('exports/spirit-hex-before-after-v1/manifest.json','utf8'));
await fs.mkdir(root,{recursive:true});
const manifest=[];
for(const item of source){
 const {data,info}=await sharp(item.hex).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const original=Buffer.from(data);
 restyleHexEdges(data,info.width,info.height,item.region,item.cost);
 let differences=0;
 for(let i=0;i<data.length;i+=4){
  if(data[i+3]!==original[i+3])throw Error('Alpha changed');
  if(data[i]!==original[i]||data[i+1]!==original[i+1]||data[i+2]!==original[i+2]){
   differences++;
   const p=i/4;
   if(!edgeCoordinates(p%info.width,Math.floor(p/info.width),info.width,info.height).editable)throw Error('Protected pixel changed');
  }
 }
 if(!differences)throw Error('Empty restyle');
 const id=path.basename(item.hex,'.png');
 const hex=path.join(root,item.kind+'s',id+'.png');
 await fs.mkdir(path.dirname(hex),{recursive:true});
 await sharp(data,{raw:info}).png().toFile(hex);
 manifest.push({...item,id,previous_hex:item.hex,hex,changed_pixels:differences});
 console.log(`${manifest.length}/96 ${item.name}`);
}
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(root,'validation.json'),JSON.stringify({hexes:manifest.length,alpha:'byte-identical',outside_edge_mask:'byte-identical',layout:'original composite retained'},null,2));
const cards=manifest.filter(m=>m.kind==='portrait').map(m=>`<article><h2>${m.name} · ${m.region} · ${m.cost}</h2><div>${[m.previous_hex,m.hex,manifest.find(s=>s.id===m.id&&s.kind==='showcase').hex].map(p=>`<a href="${path.relative(root,p)}"><img loading="lazy" src="${path.relative(root,p)}"></a>`).join('')}</div></article>`).join('');
await fs.writeFile(path.join(root,'gallery.html'),`<!doctype html><meta charset="utf-8"><title>Original layout · Regional edges</title><style>body{background:#172123;color:#eee;font:16px system-ui;margin:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(620px,1fr));gap:24px}article{background:#263134;padding:16px}h2{font-size:17px}article div{display:flex}img{width:100%}a{color:#ddd}</style><h1>Original layout · Regional edges</h1><p>Each row: original frame with current art → restyled portrait → restyled showcase. Only the outer rim changes.</p><p><a href="gallery-all-spirits.png">Full PNG gallery</a> · <a href="before-after-frames.png">Before / after PNG</a></p><main>${cards}</main>`);
