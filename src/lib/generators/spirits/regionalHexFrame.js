/** Shared SVG renderer for browser previews, batch exports, and live spirit data. */
export const FRAME_REGIONS = {
 Forest: { dark:'#173D30', mid:'#386449', light:'#A8BD81', paper:'#F4F0D7', metal:'#C7A968', motif:'leaf' },
 Mountain: { dark:'#26353B', mid:'#526970', light:'#B6CBD0', paper:'#F0F0E6', metal:'#D1B88A', motif:'crystal' },
 Fire: { dark:'#46221D', mid:'#9E4027', light:'#ED9A4A', paper:'#FFF0D2', metal:'#EBB163', motif:'flame' },
 Water: { dark:'#153F4A', mid:'#287483', light:'#9BD8D2', paper:'#EAF5EB', metal:'#BBD9CC', motif:'wave' },
 Sun: { dark:'#573717', mid:'#AE782B', light:'#F4D178', paper:'#FFF4DA', metal:'#E9BA50', motif:'sun' },
 Moon: { dark:'#302640', mid:'#665079', light:'#C8B4DE', paper:'#F0EAF6', metal:'#D3C9E3', motif:'moon' },
 Heroes: { dark:'#263D51', mid:'#536E83', light:'#B1C6CC', paper:'#F5EEE0', metal:'#CAB285', motif:'star' }
};

const ALIASES = {'flower forest':'Forest','floral forest':'Forest','forest':'Forest','cyber city':'Mountain','mountain':'Mountain','lantern lights':'Fire','fire':'Fire','moon tide':'Water','water':'Water','astral':'Sun','astral realm':'Sun','sun':'Sun','void':'Moon','moon':'Moon','human enclave':'Heroes','royal family':'Heroes','heroes':'Heroes'};
const xml = (s) => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const poly = (points,fill,extra='') => `<polygon points="${points}" fill="${fill}" ${extra}/>`;
const hex = (inset=0) => [[45+inset,500],[273+inset*.5,105+inset*.866],[727-inset*.5,105+inset*.866],[955-inset,500],[727-inset*.5,895-inset*.866],[273+inset*.5,895-inset*.866]].map(p=>p.join(',')).join(' ');

export function resolveFrame(region,cost) {
 const canonical = FRAME_REGIONS[region] ? region : ALIASES[String(region).toLowerCase().trim()];
 if (!canonical) throw new Error(`Unknown frame region: ${region}`);
 if (![1,3,7,9].includes(cost) || (canonical==='Heroes' ? cost!==1 : cost===1)) throw new Error(`Unsupported frame: ${canonical} / ${cost}`);
 return {region:canonical,cost,key:`${canonical.toLowerCase()}-${cost}`,palette:FRAME_REGIONS[canonical],weight:cost===9?32:cost===7?23:14};
}

/** Resolve IDs through catalogs; explicit region overrides support the new art identities. */
export function frameDataFromSpirit(spirit, {origins=[],classes=[],region,name,artHref,iconUrl=(p)=>p}={}) {
 const originIds=spirit.traits?.origin_ids??[];
 const resolvedRegion=region??spirit.region??origins.find(o=>o.id===originIds[0])?.name;
 const frame=resolveFrame(resolvedRegion,spirit.cost);
 const traits=[];
 for(const id of spirit.traits?.class_ids??[]) {
  const cls=classes.find(c=>c.id===id);
  if(!cls)throw new Error(`Missing class catalog entry: ${id}`);
  const existing=traits.find(t=>t.id===id);
  if(existing)existing.count++;
  else traits.push({id,name:cls.name,count:1,iconHref:cls.icon_png?iconUrl(cls.icon_png):null});
 }
 return {id:spirit.id,name:name??spirit.name,region:frame.region,cost:spirit.cost,artHref:artHref??spirit.art_raw_image_url,traits,cursed:traits.some(t=>t.name==='Cursed Spirit')};
}

function motif(type,color) {
 const p=(d)=>`<path d="${d}" fill="${color}"/>`;
 if(type==='leaf')return p('M0 38C-45 10-33-24 0-40C30-14 37 10 0 38Z')+p('M-9 27C-46 30-60 4-48-22C-18-22-1-2-9 27Z');
 if(type==='crystal')return poly('0,-48 18,-13 12,39 -12,39 -18,-13',color)+poly('-22,-24 -40,-7 -30,32 -18,28',color)+poly('24,-18 43,-4 32,31 20,28',color);
 if(type==='flame')return p('M0 40C-51 19-21-13-15-24C-16-6-8-3-5-4C-12-27 9-50 16-53C6-21 34-13 35 11C36 25 22 38 0 40Z');
 if(type==='wave')return p('M-43 17C-20-18 3-37 30-20C43-11 38 9 17 7C30-1 15-17 2-4C-11 9-16 29-43 17ZM-35 30C-13 21 4 39 35 17C20 45-5 42-35 30Z');
 if(type==='moon')return p('M20-39A42 42 0 1 0 20 39A32 38 0 0 1 20-39Z');
 let result=type==='sun'?'<circle r="21" fill="'+color+'"/>':poly('0,-36 11,-10 36,0 11,10 0,36 -11,10 -36,0 -11,-10',color);
 if(type==='sun')for(let i=0;i<8;i++)result+=`<g transform="rotate(${i*45})">${poly('-4,-27 0,-43 4,-27',color)}</g>`;
 return result;
}

function nameLines(name) {
 if(name.length<28)return [name];
 const comma=name.indexOf(',');
 if(comma>5&&comma<28)return [name.slice(0,comma),name.slice(comma+1).trim()];
 const words=name.split(' ');let best=1;
 for(let i=1;i<words.length;i++)if(Math.abs(words.slice(0,i).join(' ').length-words.slice(i).join(' ').length)<Math.abs(words.slice(0,best).join(' ').length-words.slice(best).join(' ').length))best=i;
 return [words.slice(0,best).join(' '),words.slice(best).join(' ')];
}

/** All layout coordinates are in a stable 1000-unit space. No art is baked into frames. */
export function renderRegionalHexSvg(data,{size=1500,frameOnly=false}={}) {
 const f=resolveFrame(data.region,data.cost),p=f.palette;
 if(!frameOnly&&!data.artHref)throw new Error('Raw artwork is required');
 const safeHref=(s)=>{if(!/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/|\/)/.test(s))throw new Error('Invalid image URL');return xml(s);};
 const inner=hex(f.weight+8);
 const lines=nameLines(data.name??'');
 const slots=data.traits??[];
 if(slots.length>5)throw new Error('At most five distinct trait icons fit this frame');
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 1000 1000"><defs><clipPath id="art-clip">${poly(inner,'white')}</clipPath><clipPath id="token-clip">${poly(hex(),'white')}</clipPath></defs><g clip-path="url(#token-clip)">`;
 svg+=poly(hex(),p.dark);
 svg+=poly(hex(7),p.light);
 svg+=poly(hex(12),p.dark);
 if(!frameOnly)svg+=`<g clip-path="url(#art-clip)"><rect x="50" y="105" width="900" height="800" fill="${xml(data.background??p.paper)}"/><image x="125" y="130" width="750" height="765" preserveAspectRatio="xMidYMin meet" xlink:href="${safeHref(data.artHref)}"/></g>`;
 else svg+=poly(inner,p.paper);
 // Segmented facet bands follow the hex perimeter; each cost has a distinct silhouette.
 const count=data.cost===9?5:data.cost===7?3:1;
 for(const side of [-1,1]) {
  svg+=`<g transform="translate(500 500) scale(${side} 1)">`;
  for(let k=0;k<count;k++){
   const y=-245+k*102;
   const edge=455-Math.abs(y)*.577-13;
   svg+=poly(`-${edge},${y-22} -${edge+10},${y} -${edge},${y+22} -${edge-10},${y}`,k%2?p.light:p.mid);
  }
  const ornamentY=data.cost===9?325:data.cost===7?365:455;
  svg+=`</g><g transform="translate(${side===-1?161:839} ${ornamentY}) rotate(${side*30}) scale(${data.cost===9?.78:data.cost===7?.58:.34})">${motif(p.motif,p.metal)}</g>`;
 }
 if(data.cost>=7) {
  for(let i=-2;i<=2;i++)svg+=`<g transform="translate(${500+i*49} ${127+Math.abs(i)*5}) scale(${data.cost===9?.63:.36})">${motif(p.motif,i===0?p.metal:p.light)}</g>`;
 }
 if(data.cost===9) {
  // Pearl bands are region-safe: cream, aqua, mint and gold; purple belongs to Moon.
  const opal=data.region==='Moon'?['#F1E7FC','#C4B0DE',p.metal]:[p.paper,p.light,'#AFD6C1',p.metal];
  for(let i=0;i<6;i++)svg+=poly(`${338+i*54},864 ${362+i*54},848 ${385+i*54},864 ${362+i*54},880`,opal[i%4]);
 }
 // Quiet, opaque title plate and separate trait rail keep the art uncluttered.
 svg+=poly('169,714 831,714 790,786 210,786',p.dark);
 svg+=poly('189,709 811,709 802,720 198,720',p.metal);
 lines.forEach((line,i)=>{
  const length=line.length;
  const fontSize=Math.min(lines.length===1?31:26,560/(length*.59));
  svg+=`<text x="500" y="${lines.length===1?762:746+i*26}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${fontSize}" letter-spacing="1" fill="${p.paper}">${xml(line.toUpperCase())}</text>`;
 });
 svg+=poly('221,795 779,795 744,851 256,851',p.paper);
 const slotWidth=Math.min(110,430/Math.max(slots.length,1));
 slots.forEach((t,i)=>{
  const x=500+(i-(slots.length-1)/2)*slotWidth;
  if(t.iconHref)svg+=`<image x="${x-20}" y="802" width="40" height="40" xlink:href="${safeHref(t.iconHref)}"/>`;
  else svg+=`<text x="${x}" y="830" text-anchor="middle" font-family="Arial" font-size="13" fill="${p.dark}">${xml(t.name.slice(0,12))}</text>`;
  if(t.count>1)svg+=`<circle cx="${x+24}" cy="830" r="12" fill="${p.dark}"/><text x="${x+24}" y="835" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="${p.paper}">${t.count}</text>`;
 });
 // Region crest and numeric cost are bound to data, not filename or artwork color.
 svg+=`<g transform="translate(500 870) scale(.31)">${motif(p.motif,p.light)}</g>`;
 svg+=poly('500,103 537,125 537,168 500,190 463,168 463,125',p.dark);
 svg+=poly('500,110 531,129 531,165 500,183 469,165 469,129',p.metal);
 svg+=poly('500,116 525,132 525,162 500,177 475,162 475,132',p.dark);
 svg+=`<text x="500" y="160" text-anchor="middle" font-family="Arial" font-weight="700" font-size="36" fill="${p.paper}">${data.cost}</text>`;
 if(data.cursed)svg+=`<path d="M218 735L244 745L230 760L261 774M782 735L756 745L770 760L739 774" fill="none" stroke="#AB332D" stroke-width="5"/>`;
 return svg+'</g></svg>';
}
