import type { RegionalFrameData } from './regionalHexFrame.js';
import { restyleHexEdges } from './regionalHexEdges.js';

/** Restyle an already composed original-layout front without moving any elements. */
export async function generateRegionalHexFront(data: RegionalFrameData, originalFront: Blob): Promise<Blob> {
 const url=URL.createObjectURL(originalFront);
 try {
  const image=new Image();
  image.src=url;
  await image.decode();
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  restyleHexEdges(pixels.data,canvas.width,canvas.height,data.region,data.cost);
  context.putImageData(pixels,0,0);
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
 } finally { URL.revokeObjectURL(url); }
}
