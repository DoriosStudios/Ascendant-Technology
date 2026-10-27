"""Build Thorium's native material/equipment family; PNG output and reports are separate."""
from __future__ import annotations
import argparse,hashlib,json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'docs/art/thorium/family-v3/catalog.json'

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--report',type=Path,required=True)
    parser.add_argument('--catalog',type=Path,default=CATALOG)
    parser.add_argument('--skill',type=Path,default=Path.home()/'.codex/skills/dorios-pixel-art-skill')
    parser.add_argument('--only',choices=['all','armor','tools','materials','blocks','crops'],default='all')
    args=parser.parse_args(argv)
    try:return build(args)
    except (ValueError,OSError) as exc:parser.exit(2,str(exc)+'\n')

def gallery(items,output,path,title):
    font_path=Path('C:/Windows/Fonts/segoeui.ttf')
    font=ImageFont.truetype(str(font_path),17) if font_path.exists() else ImageFont.load_default()
    small=ImageFont.truetype(str(font_path),13) if font_path.exists() else ImageFont.load_default()
    columns=6 if len(items)>8 else 4
    rows=(len(items)+columns-1)//columns
    im=Image.new('RGBA',(columns*240,rows*246+80),(30,31,38,255));d=ImageDraw.Draw(im)
    d.text((20,12),title,font=font,fill='#f0e0e8')
    d.text((20,42),'Pixels nativos | fundos escuro / claro | ampliacao inteira sem interpolacao',font=small,fill='#bdafb8')
    for i,a in enumerate(items):
        x=i%columns*240;y=80+i//columns*246
        d.rounded_rectangle((x+6,y,x+234,y+235),radius=7,fill='#272731')
        name=a['label'].replace(' de Tório','').replace('Tório ','').replace('Tório','Metal')
        if len(name)>27:name=name[:26]+'…'
        d.text((x+16,y+12),name,font=small,fill='#efdbe5')
        native=Image.open(output/(a['name']+'.png')).convert('RGBA')
        scale=max(1,96//max(native.size));zoom=native.resize((native.width*scale,native.height*scale),Image.Resampling.NEAREST)
        for offset,color in [(14,'#19171f'),(128,'#d9d3d8')]:
            d.rectangle((x+offset,y+45,x+offset+95,y+140),fill=color)
            im.alpha_composite(zoom,(x+offset+(96-zoom.width)//2,y+45+(96-zoom.height)//2))
        im.alpha_composite(native,(x+16,y+172))
        d.text((x+58,y+172),f'{native.width}x{native.height} | {scale}x',font=small,fill='#c2b2bd')
    im.save(path)

def check_contract(asset, im, base):
    """Enforce creator-selected reference masks; geometry differences are diagnostics only."""
    if 'contract' not in asset:return {'mode':'legacy_no_contract'}
    contract_path=base/asset['contract']
    contract=json.loads(contract_path.read_text('utf-8-sig'))
    mode=contract['mode']
    if mode=='new_rectangular_sheet':
        if list(im.size)!=contract['size'] or list(im.getchannel('A').getbbox())!=contract['expected_bounds']:
            raise ValueError(f"{asset['name']}: rectangular plate bounds violated")
        return {'mode':mode,'bounds':list(im.getchannel('A').getbbox())}
    reference=(contract_path.parent/contract['reference']).resolve()
    if hashlib.sha256(reference.read_bytes()).hexdigest()!=contract['sha256']:
        raise ValueError(f"{asset['name']}: reference digest changed")
    with Image.open(reference) as opened:source=opened.convert('RGBA')
    if source.size!=im.size:raise ValueError(f"{asset['name']}: reference dimensions changed")
    alpha_exact=source.getchannel('A').tobytes()==im.getchannel('A').tobytes()
    if contract.get('alpha_identical') and not alpha_exact:
        raise ValueError(f"{asset['name']}: reference alpha changed")
    allowed={tuple(v) for v in contract.get('edit_coordinates',[])}
    protected_changes=[(x,y) for y in range(im.height) for x in range(im.width)
        if (x,y) not in allowed and source.getpixel((x,y))!=im.getpixel((x,y))]
    if protected_changes:raise ValueError(f"{asset['name']}: protected RGBA changed at {protected_changes[:8]}")
    return {'mode':mode,'reference':str(reference),'reference_sha256':contract['sha256'],
        'alpha_exact':alpha_exact,'editable_pixels':len(allowed),
        'protected_pixels':im.width*im.height-len(allowed),'protected_pixel_changes':0,
        'changed_pixels':sum(a!=b for a,b in zip(source.get_flattened_data(),im.get_flattened_data()))}

def build(args):
    output=args.output.resolve();report=args.report.resolve();catalog_path=args.catalog.resolve()
    if output==report or output in report.parents:raise ValueError('Reports must stay outside the PNG output folder.')
    for directory in [output,report]:
        if directory.exists() and any(directory.iterdir()):raise ValueError(f'Use a new/empty output: {directory}')
    sys.path.insert(0,str(args.skill.resolve()/'scripts'))
    from pixel_core import read_json,write_json,load_image,save_png,profile,digest
    from pixel_design import render,oklab
    from pixel_review import review_path,write_report,enrich_review
    catalog=read_json(catalog_path);all_assets=catalog['assets']
    groups={'armor':{'armor'},'tools':{'tool'},'materials':{'material','component'},'blocks':{'block'},'crops':{'crop'}}
    assets=all_assets if args.only=='all' else [a for a in all_assets if a['kind'] in groups[args.only]]
    if not assets:raise ValueError('No assets match this selection.')
    # Validate all plans before creating outputs. Native geometry failures are not silently cropped.
    prepared=[]
    for a in assets:
        if a['kind'] not in ('block','crop') and max(a['size'])>24:
            raise ValueError('New inventory icons must not exceed 24x24; prefer 16x16.')
        design=catalog_path.parent/a['design'];spec=read_json(design);im,record=render(spec,design.parent)
        again,_=render(spec,design.parent)
        if im.tobytes()!=again.tobytes():raise ValueError('Native construction is not deterministic.')
        contract=check_contract(a,im,catalog_path.parent)
        prepared.append((a,spec,im,record,design,contract))
    output.mkdir(parents=True,exist_ok=True);report.mkdir(parents=True,exist_ok=True)
    results=[]
    for a,spec,im,record,design,contract in prepared:
        path=output/(a['name']+'.png');save_png(im,path,sources=[design,catalog_path])
        decoded,meta=load_image(path)
        assert meta['format']=='PNG' and decoded.tobytes()==im.tobytes() and im.mode=='RGBA'
        overrides={'size':a['size'],'alpha':'opaque' if a['kind']=='block' else 'binary',
         'require_transparent':a['kind']!='block','palette':{'allowed':list(spec['palette'].values()),'max_colors':len(set(tuple(v) for v in spec['palette'].values()))}}
        cfg_path=report/(a['name']+'-requirements.json');write_json(cfg_path,overrides)
        cfg=profile('block' if a['kind']=='block' else 'item',cfg_path)
        technical=review_path(path,cfg);enrich_review(technical,im,record)
        if technical['summary']['ERROR']:raise ValueError(f'{a["name"]}: {technical["findings"]}')
        write_json(report/(a['name']+'-design-record.json'),record)
        write_report(technical,report/(a['name']+'-review'))
        measurements={'name':a['name'],'label':a['label'],'destination':a['destination'],'size':list(im.size),'kind':a['kind'],
          'technical':technical['summary'],'colors':len({v[:3] for v in im.get_flattened_data() if v[3]}),
          'pixel_sha256':digest(im),'file_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'deterministic':True,
          'artistic_status':'pending_visual_review','human_approval':'required','contract':contract,'revision_scope':a.get('revision_scope','unspecified')}
        if a['kind']=='armor':
            titanium=load_image(catalog_path.parent/'references'/f'{a["name"].replace("thorium_","titanium_")}.png')[0]
            old=load_image(catalog_path.parent/'previous'/f'{a["name"]}.png')[0]
            differences=sum(x!=y for x,y in zip(im.getchannel('A').get_flattened_data(),titanium.getchannel('A').get_flattened_data()))
            measurements['alpha_differences_vs_titanium']=differences
            measurements['old_thorium_alpha_differences']=sum(x!=y for x,y in zip(im.getchannel('A').get_flattened_data(),old.getchannel('A').get_flattened_data()))
        results.append(measurements)
    gallery(assets,output,output/'thorium_family_preview.png','THORIUM | referencias preservadas | ferro com metal rosa')
    armor=[a for a in assets if a['kind']=='armor']
    if armor:gallery(armor,output,output/'thorium_set_preview.png','THORIUM | armadura preservada nesta revisao | 16x16 nativo')
    write_json(report/'manifest.json',{'assets':results,'catalog':str(catalog_path),'selection':args.only,
      'artistic_status':'pending_visual_review','human_approval':'required',
      'generated_images':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in output.glob('*.png')}})
    print(json.dumps({'assets':len(results),'output':str(output),'errors':sum(a['technical']['ERROR'] for a in results),
      'warnings':sum(a['technical']['WARNING'] for a in results),'armor_geometry':[{k:a[k] for k in ['name','alpha_differences_vs_titanium']} for a in results if a['kind']=='armor']},ensure_ascii=True))
    return 0

if __name__=='__main__':raise SystemExit(main())
