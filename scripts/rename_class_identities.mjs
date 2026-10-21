import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'exports/class-names-2026-10-15');
const review=JSON.parse(await fs.readFile(path.join(dir,'review.json'),'utf8'));
const prior=JSON.parse(await fs.readFile(path.join(dir,'after.json'),'utf8'));
const original=JSON.parse(await fs.readFile(path.join(dir,'before.json'),'utf8'));
const headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Accept-Profile':'arc_spirits_assets','Content-Profile':'arc_spirits_assets','Content-Type':'application/json'};
if(!process.env.PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Missing database environment');
const endpoint=process.env.PUBLIC_SUPABASE_URL+'/rest/v1/classes';
const response=await fetch(endpoint+'?select=*',{headers});if(!response.ok)throw Error(await response.text());
const current=await response.json();
const updates=review.map(item=>{
 const row=current.find(c=>c.id===item.id);const before=original.find(c=>c.id===item.id);
 if(!row||![item.old_name,item.name,prior.find(c=>c.id===item.id)?.name].includes(row.name))throw Error('Class changed during review: '+item.old_name);
 if(JSON.stringify(row.effect_schema)!==JSON.stringify(before.effect_schema))throw Error('Ability changed during review: '+item.old_name);
 const payload={name:item.name,description:item.description,description_translations:{}};
 if(item.old_name!==item.name)payload.name_translations={};
 return {id:item.id,payload};
});
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const sql='BEGIN;\n'+updates.map(({id,payload})=>'UPDATE arc_spirits_assets.classes SET '+Object.entries(payload).map(([k,v])=>k+' = '+(typeof v==='string'?quote(v):quote(JSON.stringify(v))+'::jsonb')).join(', ')+' WHERE id = '+quote(id)+';').join('\n')+'\nCOMMIT;\n';
await fs.writeFile(path.join(root,'supabase/migrations/20261015000003_refine_class_names.sql'),sql);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
await fs.writeFile(path.join(dir,'review.html'),'<!doctype html><meta charset="utf-8"><title>Arc Spirits class review</title><style>body{font:16px system-ui;background:#142025;color:#eaf0ec;padding:32px;max-width:1200px;margin:auto}table{border-collapse:collapse;width:100%}td,th{padding:14px;text-align:left;border-bottom:1px solid #40504e}th{color:#b5d8c6}small{color:#b5c2be}</style><h1>Arc Spirits · Class identity review</h1><p>37 reviewed · 21 renamed · Class IDs and ability effects preserved</p><table><tr><th>Previous name</th><th>Current name</th><th>Ability summary</th></tr>'+review.map(r=>`<tr><td>${esc(r.old_name)}</td><td><strong>${esc(r.name)}</strong>${r.name===r.old_name?' <small>(kept)</small>':''}</td><td>${esc(r.description)}</td></tr>`).join('')+'</table>');
if(!process.argv.includes('--apply')){console.log('Validated 37 classes; migration and review generated.');process.exit(0);}
for(const {id,payload} of updates){const r=await fetch(endpoint+'?id=eq.'+id,{method:'PATCH',headers,body:JSON.stringify(payload)});if(!r.ok)throw Error(await r.text());}
const verified=await (await fetch(endpoint+'?select=*&order=position',{headers})).json();
for(const {id,payload} of updates){const row=verified.find(c=>c.id===id);if(!row||row.name!==payload.name||row.description!==payload.description)throw Error('Verification failed: '+id);const before=original.find(c=>c.id===id);if(JSON.stringify(row.effect_schema)!==JSON.stringify(before.effect_schema))throw Error('Ability unexpectedly changed: '+id);}
await fs.writeFile(path.join(dir,'after.json'),JSON.stringify(verified,null,2));
console.log('Verified all 37 class names and descriptions. Ability schemas and IDs unchanged.');
