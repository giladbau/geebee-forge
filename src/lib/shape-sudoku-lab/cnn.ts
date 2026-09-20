// Dependency-free inference for the exported tiny_cnn_v1 (not a generic runtime).
export const LABELS = ['triangle', 'square', 'star', 'circle', 'sun', 'crescent', 'cloud', 'lightning', 'rainbow'];
export type Strokes = number[][][];
export interface Model {
  format: string; labels: string[]; checkpointSha256: string; epoch: number;
  modelConfig: {architecture: string; channels: number[]; pooled_size: number; num_classes: number};
  renderingConfig: {size: number; padding: number; line_width: number};
  tensors: Record<string, {shape: number[]; values: number[]}>;
}
export function validateModel(model: Model) {
  const config = {architecture:'tiny_cnn_v1', channels:[16,32,64], pooled_size:2, num_classes:9};
  if (model.format !== 'shape-cnn-json-v1' || JSON.stringify(model.labels) !== JSON.stringify(LABELS) ||
      JSON.stringify(model.modelConfig) !== JSON.stringify(config) ||
      JSON.stringify(model.renderingConfig) !== JSON.stringify({size:64,padding:4,line_width:2}) ||
      !/^[a-f0-9]{64}$/.test(model.checkpointSha256)) throw Error('Unsupported CNN model contract');
  const shapes = {'features.0.weight':[16,1,3,3], 'features.0.bias':[16], 'features.3.weight':[32,16,3,3], 'features.3.bias':[32], 'features.6.weight':[64,32,3,3], 'features.6.bias':[64], 'classifier.weight':[9,256], 'classifier.bias':[9]};
  for (const [name, shape] of Object.entries(shapes)) {
    const t = model.tensors?.[name];
    if (!t || JSON.stringify(t.shape) !== JSON.stringify(shape) || t.values.length !== shape.reduce((a,b)=>a*b,1) || !t.values.every(Number.isFinite)) throw Error(`Invalid tensor: ${name}`);
  }
  return model;
}

// Width-2, non-antialiased rasterizer matching Pillow's integer wide-line scan
// conversion, rather than Canvas2D's antialiased strokes. Adapted from Pillow
// src/libImaging/Draw.c (HPND license; see docs/shape-cnn-pillow-LICENSE.txt).
const up = (v: number) => Math.sign(v) * Math.floor(Math.abs(v)+0.5);
const down = (v: number) => Math.sign(v) * Math.ceil(Math.abs(v)-0.5);
const f32 = Math.fround;
function polygon(pixels: Float32Array, vertices: number[][]) {
  const hline = (a: number,y: number,b: number) => {
    if(y<0 || y>=64) return;
    if(a>b) [a,b]=[b,a];
    for(let x=Math.max(0,a);x<=Math.min(63,b);x++) pixels[y*64+x]=1;
  };
  const edges = vertices.map(([x0,y0],i) => {
    const [x1,y1]=vertices[(i+1)%vertices.length];
    return {x0,y0,xmin:Math.min(x0,x1),xmax:Math.max(x0,x1),ymin:Math.min(y0,y1),ymax:Math.max(y0,y1),dx:y0===y1?0:f32((x1-x0)/(y1-y0))};
  });
  const ymax=Math.max(...edges.map(e=>e.ymax));
  for(const e of edges) if(e.ymin===e.ymax) hline(e.xmin,e.ymin,e.xmax);
  const table=edges.filter(e=>e.ymin!==e.ymax);
  const at=(e: typeof edges[number],y: number)=>f32(f32((y-e.y0)*e.dx)+e.x0);
  for(let y=Math.max(0,Math.min(...edges.map(e=>e.ymin)));y<=Math.min(63,ymax);y++) {
    const xx: number[]=[];
    for(let i=0;i<table.length;i++) {
      const e=table[i];
      if(y<e.ymin || y>e.ymax) continue;
      xx.push(at(e,y));
      if(y===e.ymax && y<ymax) xx.push(xx.at(-1)!);
      else if((y===e.ymin || y===e.ymax) && e.dx!==0) {
        for(let k=0;k<i;k++) {
          const o=table[k];
          if((y!==o.ymin && y!==o.ymax) || o.dx===0 || up(xx.at(-1)!)!==up(at(o,y))) continue;
          const offset=y===e.ymax?-1:1;
          if(y+offset<o.ymin || y+offset>o.ymax) continue;
          const a=at(e,y+offset), b=at(o,y+offset), x=xx.at(-1)!;
          if(x>a+1 && x>b+1) xx[xx.length-1]=up(Math.max(a,b))+1;
          else if(x<a-1 && x<b-1) xx[xx.length-1]=up(Math.min(a,b))-1;
          break;
        }
      }
    }
    xx.sort((a,b)=>a-b);
    for(let i=1;i<xx.length;i+=2) hline(up(xx[i-1]),y,down(xx[i]));
  }
}
export function rasterize(strokes: Strokes) {
  if(!Array.isArray(strokes) || strokes.some(s=>!Array.isArray(s) || s.some(p=>!Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite)))) throw Error('Invalid strokes');
  const pixels=new Float32Array(4096), points=strokes.flat();
  if(!points.length) return pixels;
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(const [x,y] of points) { xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y); }
  const extent=Math.max(xmax-xmin,ymax-ymin), scale=extent?54/extent:1;
  const roundEven=(v: number)=>v%1===0.5?(Math.floor(v)%2===0?Math.floor(v):Math.ceil(v)):Math.round(v);
  for(const stroke of strokes) {
    const transformed=stroke.map(([x,y])=>[(x-(xmin+xmax)/2)*scale+31.5,(y-(ymin+ymax)/2)*scale+31.5]);
    if(!transformed.length) continue;
    if(transformed.every(p=>p[0]===transformed[0][0] && p[1]===transformed[0][1])) {
      const [x,y]=transformed[0].map(roundEven);
      for(const [dx,dy] of [[0,-1],[-1,0],[0,0],[1,0],[0,1]]) if(x+dx>=0 && x+dx<64 && y+dy>=0 && y+dy<64) pixels[(y+dy)*64+x+dx]=1;
      continue;
    }
    const ps=transformed.map(p=>p.map(Math.trunc));
    for(let i=1;i<ps.length;i++) {
      const [x0,y0]=ps[i-1], [x1,y1]=ps[i], dx=x1-x0,dy=y1-y0;
      if(dx===0 && dy===0) { pixels[y0*64+x0]=1;continue; }
      const length=Math.hypot(dx,dy), dxmax=down(dy/length),dymax=down(dx/length);
      polygon(pixels,[[x0,y0+dymax],[x1,y1+dymax],[x1+dxmax,y1],[x0+dxmax,y0]]);
    }
  }
  return pixels;
}

export function infer(model: Model, pixels: Float32Array) {
  if(pixels.length!==4096 || !pixels.every(Number.isFinite)) throw Error('Expected finite 64×64 raster');
  const t=(name: string)=>model.tensors[name].values;
  let input: Float32Array=pixels,size=64,inputs=1;
  for(const [layer,outputs] of [[0,16],[3,32],[6,64]]) {
    const weights=t(`features.${layer}.weight`),bias=t(`features.${layer}.bias`);
    const half=size/2, next=new Float32Array(outputs*half*half);
    for(let o=0;o<outputs;o++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      let sum=bias[o];
      for(let c=0;c<inputs;c++) for(let ky=0;ky<3;ky++) {
        const iy=y+ky-1; if(iy<0 || iy>=size) continue;
        for(let kx=0;kx<3;kx++) { const ix=x+kx-1;if(ix>=0 && ix<size) sum+=input[c*size*size+iy*size+ix]*weights[((o*inputs+c)*3+ky)*3+kx]; }
      }
      const index=o*half*half+(y>>1)*half+(x>>1);
      next[index]=Math.max(next[index],sum); // ReLU + max pool, float32 storage
    }
    input=next;size=half;inputs=outputs;
  }
  const pooled=new Float32Array(256);
  for(let c=0;c<64;c++) for(let y=0;y<2;y++) for(let x=0;x<2;x++) {
    let sum=0;
    for(let dy=0;dy<4;dy++) for(let dx=0;dx<4;dx++) sum+=input[c*64+(y*4+dy)*8+x*4+dx];
    pooled[c*4+y*2+x]=sum/16;
  }
  const weights=t('classifier.weight'),bias=t('classifier.bias');
  const logits=bias.map((b,o)=>pooled.reduce((sum,v,i)=>sum+v*weights[o*256+i],b));
  const exps=logits.map(v=>Math.exp(v-Math.max(...logits))),total=exps.reduce((a,b)=>a+b,0);
  const ranked=LABELS.map((label,i)=>({label,logit:logits[i],score:exps[i]/total})).sort((a,b)=>b.score-a.score);
  return {label:ranked[0].label,logits,ranked};
}
