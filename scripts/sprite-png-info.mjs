// Lecture uniquement : dimensions, alpha et régions. Aucun bitmap n'est modifié.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function readSpritePng(path) {
  const png = readFileSync(path);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw Error(`PNG RGBA8 non entrelacé attendu : ${path}`);
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 4;
  const data = Buffer.alloc(stride * height);
  const paeth = (a,b,c) => { const p=a+b-c, pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c); return pa<=pb&&pa<=pc?a:pb<=pc?b:c; };
  for (let y=0;y<height;y++) {
    const filter=raw[y*(stride+1)];
    for(let x=0;x<stride;x++) {
      const i=y*stride+x, a=x>=4?data[i-4]:0,b=y?data[i-stride]:0,c=y&&x>=4?data[i-stride-4]:0;
      const predictor=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
      data[i]=(raw[y*(stride+1)+1+x]+predictor)&255;
    }
  }
  return { width, height, data };
}

export function alphaBounds(image, rect = { x:0, y:0, width:image.width, height:image.height }) {
  let minX=image.width,minY=image.height,maxX=-1,maxY=-1;
  for(let y=rect.y;y<rect.y+rect.height;y++) for(let x=rect.x;x<rect.x+rect.width;x++) {
    if(image.data[(y*image.width+x)*4+3] <= 102) continue;
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  return maxX<0 ? null : { x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1 };
}

export function alphaComponents(image, minimumArea=250) {
  const {width,height,data}=image, seen=new Uint8Array(width*height), stack=new Int32Array(width*height), result=[];
  for(let start=0;start<seen.length;start++) {
    if(seen[start]||data[start*4+3]<=102)continue;
    let length=1,area=0,minX=width,minY=height,maxX=0,maxY=0;stack[0]=start;seen[start]=1;
    while(length) {
      const i=stack[--length],x=i%width,y=Math.floor(i/width);area++;
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      for(const j of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1]) {
        if(j<0||seen[j]||data[j*4+3]<=102)continue;seen[j]=1;stack[length++]=j;
      }
    }
    if(area>=minimumArea)result.push({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,area});
  }
  return result.sort((a,b)=>b.area-a.area);
}
