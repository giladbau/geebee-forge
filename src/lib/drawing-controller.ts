import { DrawingState, type RecognitionToken } from './drawing-state';
import { provisionalRecognition } from './drawing-recognition';
import { LABELS } from './shape-sudoku-lab/cnn';
import { gameSymbolForLabel } from './shape-symbols';

/** Browser adapter. Tokens stay here; the worker never receives puzzle information. */
export class DrawingController {
 private worker: Worker | null = null;
 private requests = new Map<number, RecognitionToken>();
 private timers = new Set<ReturnType<typeof setTimeout>>();
 private serial = 0;
 private queued = new Set<string>();
 status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
 constructor(readonly state: DrawingState, private changed: () => void, private placed: (r:number,c:number) => void) {}
 private later(fn:()=>void, ms:number) { const t=setTimeout(()=>{this.timers.delete(t);fn();},ms);this.timers.add(t); }
 cancel() {
  for(const t of this.timers) clearTimeout(t);
  this.timers.clear();this.requests.clear();this.queued.clear();
 }
 load() {
  if(this.status==='ready'||this.status==='loading')return;
  this.worker?.terminate();this.status='loading';this.changed();
  try {
   const worker=new Worker(new URL('./shape-sudoku-lab/cnn-worker.ts',import.meta.url),{type:'module'});
   this.worker=worker;
   worker.onerror=()=>this.fail();worker.onmessageerror=()=>this.fail();
   worker.onmessage=({data})=>{
    if(this.worker!==worker)return;
    if(data?.type==='ready'&&this.status==='loading') {this.status='ready';this.changed();this.resume();return;}
    if(data?.type==='error') {this.fail();return;}
    if(data?.type!=='result'||!Number.isInteger(data.id))return;
    const token=this.requests.get(data.id);if(!token)return;
    this.requests.delete(data.id);
    if(data.revision!==token.revision||data.tile!==`${token.row}-${token.column}`)return;
    const ranked=data.result?.ranked;
    const scores=LABELS.map(label=>Array.isArray(ranked)?ranked.find((r:any)=>r?.label===label)?.score:undefined);
    const modelIndex=provisionalRecognition(token.ink,scores);
    const symbol=modelIndex===null?null:gameSymbolForLabel(LABELS[modelIndex]);
    if(!this.state.preview(token,symbol))return;
    this.changed();
    if(symbol!==null)this.later(()=>{const accepted=this.state.commit(token);this.changed();if(accepted)this.placed(token.row,token.column);},600);
   };
   worker.postMessage({type:'load'});
  } catch {this.fail();}
 }
 private fail() {for(const token of this.requests.values())this.state.preview(token,null);this.cancel();this.worker?.terminate();this.worker=null;this.status='error';this.changed();}
 /** Resume preserved unfinished ink after loading, mode changes or interrupted work. */
 resume() {
  this.state.board().forEach((row,r)=>row.forEach((value,c)=>{
   const cell=this.state.cell(r,c);
   if(value===null&&cell.ink.length&&!cell.invalid)this.recognize(r,c);
  }));
 }
 recognize(row:number,column:number) {
  const key=`${row}-${column}`;
  if(this.status!=='ready'||this.queued.has(key))return;
  this.queued.add(key);
  this.later(()=>{
   this.queued.delete(key);
   if(this.status!=='ready'||!this.worker)return;
   const token=this.state.request(row,column);if(!token)return;
   const id=++this.serial;this.requests.set(id,token);this.changed();
   try {this.worker.postMessage({type:'infer',id,tile:`${row}-${column}`,revision:token.revision,strokes:token.ink});}catch{this.fail();}
  },400);
 }
 destroy() {this.cancel();this.worker?.terminate();this.worker=null;}
}
