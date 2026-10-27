const fs=require('node:fs'),path=require('node:path'),{PNG}=require('pngjs');
const dir=process.argv[2]||'docs/previews/ui-review/before', filter=process.argv[3]||'--main.png';
const files=fs.readdirSync(dir).filter(f=>f.endsWith(filter)).sort();
for(let start=0;start<files.length;start+=12){
 const group=files.slice(start,start+12),out=new PNG({width:1440,height:Math.ceil(group.length/3)*270});out.data.fill(255);
 group.forEach((f,i)=>{const im=PNG.sync.read(fs.readFileSync(path.join(dir,f)));for(let y=0;y<270;y++)for(let x=0;x<480;x++){const s=(Math.floor(y*im.height/270)*im.width+Math.floor(x*im.width/480))*4,d=((Math.floor(i/3)*270+y)*1440+(i%3)*480+x)*4;im.data.copy(out.data,d,s,s+4);}});
 const name='contact-'+(start/12+1)+'.png';fs.writeFileSync(path.join(dir,name),PNG.sync.write(out));console.log(name+': '+group.join(', '));
}
