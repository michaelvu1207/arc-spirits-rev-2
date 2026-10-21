"""Assemble PNG contact sheets and validate exported regional hexes."""
from pathlib import Path
import json,zipfile
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]/'exports/spirit-regional-edges-v2'
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'
def font(n):return ImageFont.truetype(FONT,n)
def paste(canvas,path,x,y,size):
 with Image.open(path) as im:
  im=im.convert('RGBA');im.thumbnail((size,size),Image.Resampling.LANCZOS)
  canvas.paste(im,(x+(size-im.width)//2,y+(size-im.height)//2),im)

def main():
 manifest=json.loads((ROOT/'manifest.json').read_text())
 assert len(manifest)==96
 for m in manifest:
  with Image.open(m['hex']) as im:
   assert im.size==(3000,3000)
   assert im.getpixel((0,0))[3]==0
   im.load()
 portraits=[m for m in manifest if m['kind']=='portrait']
 show={m['id']:m for m in manifest if m['kind']=='showcase'}
 for compare in [False,True]:
  size=340;cw=720;rh=430;cols=6
  sheet=Image.new('RGB',(cols*cw+40,8*rh+140),'#172123');d=ImageDraw.Draw(sheet)
  d.text((28,20),'ARC SPIRITS / '+('FRAME COMPARISON' if compare else 'REGIONAL FRAME GALLERY'),font=font(42),fill='#F4ECD9')
  d.text((28,78),'Previous frame → New frame' if compare else '48 spirits · Portrait and showcase · Region × Cost',font=font(24),fill='#A9C4BD')
  for i,m in enumerate(portraits):
   x=20+(i%cols)*cw;y=140+(i//cols)*rh
   d.text((x+12,y),m['name'],font=font(21),fill='#F4ECD9')
   d.text((x+12,y+29),f'{m["region"]} / {m["cost"]} COST',font=font(17),fill='#A9C4BD')
   paths=[m['previous_hex'],m['hex']] if compare else [m['hex'],show[m['id']]['hex']]
   for j,p in enumerate(paths):paste(sheet,p,x+j*(size+20),y+62,size)
  dest=ROOT/('before-after-frames.png' if compare else 'gallery-all-spirits.png');sheet.save(dest)
  if not compare:
   sheet.thumbnail((2200,2200),Image.Resampling.LANCZOS);sheet.save(ROOT/'gallery-preview.png')
 print('Built original-layout edge galleries')
if __name__=='__main__':main()
