"""Create four native Thorium armor icons from AT's existing equipment masks.

Uses the installed Dorios pixel-art toolkit; writes only PNGs to --output.
Reports and construction records are kept under --report, outside the image folder.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]

def run(output:Path,report:Path,skill:Path,config_path:Path):
    output=output.resolve();report=report.resolve()
    if output==report or output in report.parents:
        raise ValueError('Keep reports outside the PNG output folder.')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Choose a new or empty output directory. Existing artwork is never replaced.')
    if report.exists() and any(report.iterdir()):
        raise ValueError('Choose a new or empty report directory.')
    sys.path.insert(0,str(skill.resolve()/'scripts'))
    from pixel_core import load_image,save_png,profile,write_json,digest
    from pixel_design import oklab
    from pixel_review import validate,review_path,write_report
    from pixel_ops import checker
    spec=json.loads(config_path.read_text(encoding='utf-8-sig'))
    ramp=[tuple(v) for v in spec['metal_ramp']]
    if len(ramp)<2 or any(oklab(a)[0]>=oklab(b)[0] for a,b in zip(ramp,ramp[1:])):
        raise ValueError('Metal ramp must have strictly increasing Oklab lightness.')
    protected={tuple(v) for v in spec['preserve_source_rgb']}
    sources={};ownership={};colors=set()
    for piece in spec['pieces']:
        path=ROOT/piece['source']
        if hashlib.sha256(path.read_bytes()).hexdigest()!=piece['sha256']:
            raise ValueError(f'Reference changed: {path}; inspect it before regenerating.')
        im,_=load_image(path)
        if im.size!=tuple(spec['native_size']):raise ValueError('Reference must already be native 16x16.')
        sources[piece['name']]=im
        mask=Image.new('L',im.size)
        for y in range(im.height):
            for x in range(im.width):
                c=im.getpixel((x,y))
                if c[3] and c[:3] not in protected:
                    mask.putpixel((x,y),255);colors.add(c[:3])
        ownership[piece['name']]=mask
    # One shared mapping preserves the same lighting role across all four pieces.
    ordered=sorted(colors,key=lambda c:oklab(c)[0]);lo=oklab(ordered[0])[0];hi=oklab(ordered[-1])[0]
    tl=oklab(ramp[0])[0];th=oklab(ramp[-1])[0]
    mapping={c:min(ramp,key=lambda t:abs(oklab(t)[0]-(tl+(oklab(c)[0]-lo)/(hi-lo)*(th-tl)))) for c in ordered}
    output.mkdir(parents=True,exist_ok=True);report.mkdir(parents=True,exist_ok=True)
    assets=[];mapped_images=[];images=[]
    write_json(report/'requirements.json',{'size':[16,16],'alpha':'binary','require_transparent':True,
      'palette':{'allowed':[list(c) for c in sorted(set(ramp)|protected)],'max_colors':len(set(ramp)|protected)}})
    cfg=profile('item',report/'requirements.json')
    for piece in spec['pieces']:
        name=piece['name'];original=sources[name];mask=ownership[name];im=original.copy()
        for y in range(16):
            for x in range(16):
                if mask.getpixel((x,y)):
                    old=im.getpixel((x,y));im.putpixel((x,y),(*mapping[old[:3]],old[3]))
        before_details=im.copy();patch_log=[]
        for point in piece['details']:
            x,y=point['xy']
            if not mask.getpixel((x,y)):raise ValueError(f'Detail crosses a protected region: {name} {x},{y}')
            old=im.getpixel((x,y));new=(*ramp[point['ramp_index']],old[3])
            if old!=new:im.putpixel((x,y),new);patch_log.append({'xy':[x,y],'before':list(old),'after':list(new)})
        assert im.getchannel('A').tobytes()==original.getchannel('A').tobytes()
        outside=[(x,y) for y in range(16) for x in range(16) if not mask.getpixel((x,y)) and im.getpixel((x,y))!=original.getpixel((x,y))]
        assert not outside
        local=validate(im,cfg,original=original,edit_mask=mask)
        if local['summary']['ERROR']:raise ValueError(f'Validation failed: {name}: {local["findings"]}')
        png=output/f'thorium_{name}.png';save_png(im,png,sources=[ROOT/piece['source'],config_path])
        reloaded,meta=load_image(png);assert reloaded.tobytes()==im.tobytes() and meta['format']=='PNG'
        review=review_path(png,cfg);write_report(review,report/f'thorium_{name}')
        record={'identity':f'Thorium {name} inventory icon','source':piece['source'],'source_sha256':piece['sha256'],
          'pixel_sha256':digest(im),'native_size':[16,16],'intent':spec['intent'],'purpose':piece['purpose'],
          'alpha_identical_to_template':True,'changes_outside_material_mask':0,'detail_changes':patch_log,
          'palette_visible_colors':len({c[:3] for c in im.get_flattened_data() if c[3]}),
          'technical':review['summary'],'human_approval':'required'}
        write_json(report/f'thorium_{name}-construction.json',record)
        mask.save(report/f'thorium_{name}-metal-mask.png');before_details.save(report/f'thorium_{name}-mapped-before-details.png')
        assets.append(record);images.append(im);mapped_images.append(before_details)
    font_path=Path('C:/Windows/Fonts/segoeui.ttf')
    font=ImageFont.truetype(str(font_path),19) if font_path.exists() else ImageFont.load_default()
    small=ImageFont.truetype(str(font_path),13) if font_path.exists() else ImageFont.load_default()
    gallery=Image.new('RGBA',(1000,360),(29,30,38,255));d=ImageDraw.Draw(gallery)
    d.text((22,12),'THORIUM | metal rosa chiclete | 16x16 nativo',font=font,fill='white')
    names=['Capacete','Peitoral','Cal\u00e7as','Botas']
    for i,(name,im) in enumerate(zip(names,images)):
        x=i*250;d.text((x+18,55),name,font=font,fill='#ffe0ef')
        gallery.alpha_composite(im,(x+18,98))
        enlarged=im.resize((128,128),Image.Resampling.NEAREST)
        d.rectangle((x+60,96,x+187,223),fill='#19151e');gallery.alpha_composite(enlarged,(x+60,96))
        d.text((x+18,250),'16x16 + 8x nearest',font=small,fill='#d3bdce')
        d.text((x+18,278),str(assets[i]['palette_visible_colors'])+' cores visiveis',font=small,fill='#d3bdce')
    save_png(gallery,output/'thorium_set_preview.png')
    comparison=Image.new('RGBA',(1000,455),(35,35,42,255));d=ImageDraw.Draw(comparison)
    for i,piece in enumerate(spec['pieces']):
        x=i*250;d.text((x+12,7),piece['name'],font=font,fill='white')
        for row,img in enumerate([sources[piece['name']],mapped_images[i],images[i]]):
            comparison.alpha_composite(checker(img).resize((112,112),Image.Resampling.NEAREST),(x+65,45+row*130))
    save_png(comparison,report/'template-mapped-final.png')
    write_json(report/'manifest.json',{'assets':assets,'color_direction':spec['palette_direction'],
      'method':'Explicit semantic material ownership + one shared lightness-role mapping + bounded native details.',
      'runtime_integration':'inventory images only; no item, atlas, recipe or equipped-armor changes',
      'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in output.glob('*.png')}})
    print(json.dumps({'output':str(output),'report':str(report),'assets':[{k:a[k] for k in ['identity','palette_visible_colors','technical']} for a in assets]},ensure_ascii=True))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--report',type=Path,required=True)
    parser.add_argument('--skill',type=Path,default=Path.home()/'.codex/skills/dorios-pixel-art-skill')
    parser.add_argument('--config',type=Path,default=ROOT/'docs/art/thorium/design.json')
    args=parser.parse_args()
    try:run(args.output,args.report,args.skill,args.config)
    except (ValueError,OSError) as exc:parser.exit(2,str(exc)+'\n')
