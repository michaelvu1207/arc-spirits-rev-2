import { resolveFrame } from './regionalHexFrame.js';

// Coordinates measured from the original 3000px front, not the redesigned SVG.
const vertices = [[100,1508],[800,294],[2200,294],[2900,1508],[2200,2716],[800,2716]];
const planes = vertices.map((a,i)=>{
 const b=vertices[(i+1)%6], dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
 return {x:a[0],y:a[1],nx:-dy/length,ny:dx/length,dx:dx/length,dy:dy/length};
});
const rgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

/** Only the narrow outer rim and its existing halo are editable. */
export function edgeCoordinates(x,y,width,height) {
 x=x*3000/width;y=y*3000/height;
 let depth=Infinity,along=0;
 for(const p of planes){
  const d=(x-p.x)*p.nx+(y-p.y)*p.ny;
  if(d<depth){depth=d;along=(x-p.x)*p.dx+(y-p.y)*p.dy;}
 }
 return {depth,along,editable:depth>=-60&&depth<=52};
}

/** Mutates RGB only. Artwork, typography, icons, inner rim and alpha stay intact. */
export function restyleHexEdges(pixels,width,height,region,cost) {
 if(pixels.length!==width*height*4)throw new Error('Expected RGBA pixels');
 const {palette}=resolveFrame(region,cost);
 const dark=rgb(palette.dark),light=rgb(palette.light),metal=rgb(palette.metal);
 let changed=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  if(!pixels[i+3])continue;
  const {depth,along,editable}=edgeCoordinates(x,y,width,height);
  if(!editable)continue;
  const luminance=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/255;
  // Broad facets retain the original painted texture; higher tiers add metal inlays.
  const period=cost===9?150:cost===7?240:360;
  const facet=((along+depth*2)%period+period)%period/period;
  const tint=cost>=7&&depth>14&&depth<25&&facet>.65?metal:light;
  const value=Math.max(.12,Math.min(.94,luminance*.78+(facet>.55?.16:0)));
  const blend=Math.min(1,(52-depth)/8,(depth+60)/16);
  for(let c=0;c<3;c++)pixels[i+c]=Math.round(pixels[i+c]*(1-blend)+(dark[c]+(tint[c]-dark[c])*value)*blend);
  changed++;
 }
 return changed;
}
