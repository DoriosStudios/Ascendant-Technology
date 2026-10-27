"""Regression contracts for the creator-requested Thorium reference correction."""
from pathlib import Path
import hashlib, importlib.util, json, subprocess, sys
import pytest
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'docs/art/thorium/family-v3'
CATALOG=json.loads((BASE/'catalog.json').read_text('utf-8-sig'))
ASSETS=CATALOG['assets']
spec=importlib.util.spec_from_file_location('thorium_family',ROOT/'tools/generate-thorium-family.py')
generator=importlib.util.module_from_spec(spec);spec.loader.exec_module(generator)
sys.path.insert(0,str(Path.home()/'.codex/skills/dorios-pixel-art-skill/scripts'))
from pixel_design import render,oklab

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def opened(path):
    with Image.open(path) as im:return im.convert('RGBA')
def asset(name):return next(a for a in ASSETS if a['name']==name)

@pytest.mark.parametrize('a',ASSETS,ids=lambda a:a['name'])
def test_native_render_and_reference_contract(a):
    path=BASE/a['design'];plan=json.loads(path.read_text('utf-8-sig'))
    im,_=render(plan,path.parent)
    assert list(im.size)==a['size']
    assert im.tobytes()==opened(BASE/'final'/(a['name']+'.png')).tobytes()
    assert render(plan,path.parent)[0].tobytes()==im.tobytes()
    generator.check_contract(a,im,BASE)
    assert set(im.getchannel('A').get_flattened_data())<=({255} if a['kind']=='block' else {0,255})

@pytest.mark.parametrize('a',[a for a in ASSETS if a['kind']=='tool'],ids=lambda a:a['name'])
def test_iron_shape_wood_and_contour_unchanged(a):
    ref=opened(BASE/'references'/(a['name'].replace('thorium_','iron_')+'.png'))
    im=opened(BASE/'final'/(a['name']+'.png'))
    assert ref.size==im.size
    assert ref.getchannel('A').tobytes()==im.getchannel('A').tobytes()
    changed=0
    for old,new in zip(ref.get_flattened_data(),im.get_flattened_data()):
        r,g,b,alpha=old
        metal=alpha and r==g==b and r>24
        if metal:
            assert new[:3]!=old[:3];changed+=1
        else:assert new==old
    assert changed>0

@pytest.mark.parametrize('name',['thorium_mesh','thorium_net'])
def test_titanium_nonmetal_exact(name):
    ref=opened(BASE/'references'/(name.replace('thorium_','titanium_')+'.png'))
    im=opened(BASE/'final'/(name+'.png'))
    for old,new in zip(ref.get_flattened_data(),im.get_flattened_data()):
        r,g,b,alpha=old
        if alpha and b>r+4 and b>=g:assert new!=old
        else:assert new==old
    assert ref.getchannel('A').tobytes()==im.getchannel('A').tobytes()

@pytest.mark.parametrize('a',[a for a in ASSETS if a['revision_scope']=='preserved'],ids=lambda a:a['name'])
def test_unrequested_assets_remain_byte_identical(a):
    previous=BASE/'previous'/(a['name']+'.png')
    assert sha(BASE/'final'/(a['name']+'.png'))==sha(previous)
    assert sha(ROOT/a['destination'])==sha(previous)
    assert sha(ROOT/'extras/generated_textures'/(a['name']+'.png'))==sha(previous)

@pytest.mark.parametrize('name',['thorium_ore','deepslate_thorium_ore'])
def test_ore_host_preserved_outside_small_irregular_inclusions(name):
    a=asset(name);cp=BASE/a['contract'];c=json.loads(cp.read_text('utf-8'))
    ref=opened(cp.parent/c['reference']);im=opened(BASE/'final'/(name+'.png'))
    points={tuple(p) for p in c['edit_coordinates']}
    assert len(points)==30
    assert all(ref.getpixel(p)==im.getpixel(p) for p in [(x,y) for y in range(16) for x in range(16)] if p not in points)
    assert sum(ref.getpixel((x,y))!=im.getpixel((x,y)) for y in range(16) for x in range(16))==30
    pending=set(points);sizes=[]
    while pending:
        stack=[pending.pop()];n=0
        while stack:
            x,y=stack.pop();n+=1
            for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if p in pending:pending.remove(p);stack.append(p)
        sizes.append(n)
    assert sorted(sizes)==[3,3,3,4,5,6,6]

@pytest.mark.parametrize('mutation',['protected_rgb','alpha','hidden_rgb'])
def test_illegal_reference_edits_rejected(mutation):
    a=asset('thorium_sword');im=opened(BASE/'final/thorium_sword.png')
    points=[(x,y) for y in range(im.height) for x in range(im.width)]
    if mutation=='protected_rgb':
        p=next(p for p in points if im.getpixel(p)==(24,24,24,255));im.putpixel(p,(25,24,24,255))
    elif mutation=='alpha':
        p=next(p for p in points if im.getpixel(p)[3]);v=im.getpixel(p);im.putpixel(p,(*v[:3],0))
    else:
        p=next(p for p in points if not im.getpixel(p)[3]);im.putpixel(p,(1,2,3,0))
    with pytest.raises(ValueError):generator.check_contract(a,im,BASE)

def test_nugget_footprint_and_plate_rectangle():
    old=opened(BASE/'previous/thorium_nugget.png');new=opened(BASE/'final/thorium_nugget.png')
    assert sum(p[3]>0 for p in new.get_flattened_data())<sum(p[3]>0 for p in old.get_flattened_data())
    plate=opened(BASE/'final/thorium_plate.png');assert plate.getchannel('A').getbbox()==(2,4,14,12)
    assert all(plate.getpixel((x,y))[3]==255 for y in range(5,11) for x in range(3,13))

@pytest.mark.parametrize('name',['thorium_dust','raw_thorium'])
def test_actual_dust_and_raw_lighting_range_increased(name):
    def span(path):
        levels=[oklab(p[:3])[0] for p in opened(path).get_flattened_data() if p[3]]
        return max(levels)-min(levels)
    assert span(BASE/'final'/(name+'.png'))>span(BASE/'previous'/(name+'.png'))

def test_pinned_local_reference_files_unchanged():
    for row in json.loads((BASE/'reference-provenance.json').read_text('utf-8-sig')):
        assert sha(BASE/'references'/row['snapshot'])==row['sha256']
        assert sha(Path(row['source']))==row['sha256']
    for row in json.loads((BASE/'host-provenance.json').read_text('utf-8-sig')):
        assert sha(BASE/'references'/row['snapshot'])==row['sha256']

def test_cli_rebuild_and_no_overwrite(tmp_path):
    output=tmp_path/'images';report=tmp_path/'reports'
    cmd=[sys.executable,str(ROOT/'tools/generate-thorium-family.py'),'--output',str(output),'--report',str(report)]
    run=subprocess.run(cmd,capture_output=True,text=True);assert run.returncode==0,run.stderr
    originals={p.name:sha(p) for p in output.glob('*.png')}
    assert len(originals)==32
    for a in ASSETS:assert originals[a['name']+'.png']==sha(BASE/'final'/(a['name']+'.png'))
    retry=subprocess.run(cmd,capture_output=True,text=True)
    assert retry.returncode==2 and 'new/empty' in retry.stderr
    assert originals=={p.name:sha(p) for p in output.glob('*.png')}
    armorout=tmp_path/'armor';armorreport=tmp_path/'armor-reports'
    run=subprocess.run([sys.executable,str(ROOT/'tools/generate-thorium-icons.py'),'--output',str(armorout),'--report',str(armorreport)],capture_output=True,text=True)
    assert run.returncode==0,run.stderr
    for a in ASSETS:
        if a['kind']=='armor':assert sha(armorout/(a['name']+'.png'))==sha(BASE/'previous'/(a['name']+'.png'))
