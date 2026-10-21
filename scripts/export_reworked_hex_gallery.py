"""Local before/after export using the existing cached front compositor."""
import csv
import json
import shutil
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageStat
import export_hex_prints as compositor
from hex_icon_overlay import stamp_front_icons, infer_print_scale, load_json

SCRIPTS = Path(__file__).resolve().parent
EXPORTS = SCRIPTS.parent / 'exports'
PACK = Path('/Users/maikyon/Downloads/Hex Spirits Art Pack Aug 6')
CACHE = SCRIPTS / '_frame_cache'
OUT = EXPORTS / 'spirit-hex-before-after-v1'

def fit_for_hex(img, box):
    """Keep vertical artwork's head above the plate and below the top hex edge."""
    w, h = box[2]-box[0], box[3]-box[1]
    src = img.convert('RGBA')
    edge = src.crop((0, 0, max(1, src.width//12), max(1, src.height//12))).convert('RGB')
    color = tuple(round(v) for v in ImageStat.Stat(edge).mean)
    canvas = Image.new('RGBA', (w, h), color+(255,))
    factor = min(w*.98/src.width, h*.90/src.height)
    src = src.resize((round(src.width*factor), round(src.height*factor)), Image.Resampling.LANCZOS)
    mask = Image.new('L', src.size, 0)
    ImageDraw.Draw(mask).rectangle((20,20,src.width-21,src.height-21),fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(18))
    canvas.paste(src, ((w-src.width)//2, int(h*.04)), mask)
    return canvas

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repair-hollowbloom', action='store_true')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for folder in ['before', 'portraits', 'showcases', 'unmarked']:
        (OUT / folder).mkdir(exist_ok=True)
    roster = json.loads((EXPORTS / 'spirit-portraits-showcase-v2/manifest.json').read_text())
    rows = {r['Name']: r for r in csv.DictReader((PACK / 'hex_spirits_art_raw.csv').open())}
    config = load_json(CACHE / 'icon_placement_front.json')
    scale = infer_print_scale(config, 3000)
    compositor.MIN_NAME_PT = 45  # Long new titles must fit inside the existing name plate.
    compositor.fit_cover = fit_for_hex
    report = {'ok': [], 'fail': [], 'diffs': {}}
    manifest = []
    cached = None
    last_key = None
    for i, item in enumerate(roster):
        row = dict(rows[item['old_name']])
        eid = row['ExportID']
        before = OUT / 'before' / (eid + '.png')
        if not before.exists():
            source = SCRIPTS / '_composite_trial/with_icons' / (eid + '_front_with_icons.png')
            if not source.exists():
                raise FileNotFoundError(source)
            shutil.copy2(source, before)
        source = EXPORTS / 'spirit-portraits-showcase-v2' / item['destination']
        revision = 'pose-v2'
        for directory in ['spirit-iridescent-nine-cost-v1', 'spirit-cursed-taint-v1']:
            candidate = EXPORTS / directory / item['destination']
            if candidate.exists():
                source, revision = candidate, directory
        row['Name'] = item['name']
        row['ArtRawFile'] = str(source)  # Absolute path is supported by pathlib in compositor.
        key = (row['Tier'], row['OriginSubfolder'])
        if key != last_key:
            cached = None
            cached = compositor.load_origin_cache(CACHE, *key, compositor.TIER_SUBGROUPS)
            cached['overlays'] = [ov for ov in cached['overlays'] if ov['rec'].get('name') != 'IMG_5368' and ' / art / ' not in ov['rec'].get('path', '')]
            last_key = key
        destination = OUT / ('portraits' if item['kind'] == 'portrait' else 'showcases') / (eid + '.png')
        if args.force or not destination.exists() or (args.repair_hollowbloom and item['old_name'] == 'Florality'):
            count = len(report['fail'])
            compositor._export_one_from_cache(row, PACK, OUT / 'unmarked', cached, False, report)
            if len(report['fail']) > count:
                raise RuntimeError(report['fail'][-1])
            raw = OUT / 'unmarked' / (eid + '_front_game_print.png')
            with Image.open(raw) as im:
                framed, placed = stamp_front_icons(im, row, PACK, config, scale)
                framed.save(destination)
        manifest.append({**item, 'before': str(before), 'hex': str(destination), 'source_art': str(source), 'revision': revision})
        print(f'{i+1}/96 {item["name"]} {item["kind"]}', flush=True)
        (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    gallery(manifest)

def gallery(manifest):
    characters = {}
    for item in manifest:
        characters.setdefault(item['old_name'], {})[item['kind']] = item
    thumb, gap, cols, row_h = 360, 16, 4, 480
    cell_w = thumb * 3 + gap * 2
    width = 40 + cols * (cell_w + 24)
    height = 160 + ((len(characters)+cols-1)//cols) * row_h
    canvas = Image.new('RGB', (width, height), '#171b23')
    draw = ImageDraw.Draw(canvas)
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    font = ImageFont.truetype(font_path, 25)
    small = ImageFont.truetype(font_path, 21)
    title = ImageFont.truetype(font_path, 46)
    draw.text((30, 24), 'ARC SPIRITS — ORIGINAL / REWORKED PORTRAIT / REWORKED SHOWCASE', font=title, fill='white')
    draw.text((30, 86), '48 spirits · latest cursed and iridescent variants · existing hex frames and gameplay icons', font=font, fill='#b7c4d8')
    for i, (old, pair) in enumerate(characters.items()):
        item = pair['portrait']
        x = 24 + (i % cols)*(cell_w+24)
        y = 150 + (i // cols)*row_h
        label = f'{old} → {item["name"]}'
        f = font
        if draw.textlength(label, font=f)>cell_w:
            f = ImageFont.truetype(font_path, 20)
        draw.text((x, y), label, font=f, fill='white')
        draw.text((x, y+33), f'{item["region"]} · Cost {item["cost"]}', font=small, fill='#9eacc1')
        for n, (label, path) in enumerate([('BEFORE',item['before']),('AFTER · PORTRAIT',item['hex']),('AFTER · SHOWCASE',pair['showcase']['hex'])]):
            xx = x+n*(thumb+gap)
            with Image.open(path) as im:
                im=im.convert('RGBA')
                im.thumbnail((thumb,thumb),Image.Resampling.LANCZOS)
                canvas.paste(im,(xx+(thumb-im.width)//2,y+68+(thumb-im.height)//2),im)
            draw.text((xx+10,y+435),label,font=small,fill='#cad3df')
    canvas.save(OUT/'before-after-all-spirits.png')
    preview = canvas.copy()
    preview.thumbnail((2200,3000),Image.Resampling.LANCZOS)
    preview.save(OUT/'before-after-preview.png')
    print('Gallery complete',canvas.size,flush=True)

if __name__ == '__main__':
    main()
