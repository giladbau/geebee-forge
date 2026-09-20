import { applyMove, type Board, type Cell, type Puzzle } from './shape-sudoku';
import type { Strokes } from './shape-sudoku-lab/cnn';
export interface DrawingCell { ink: Strokes; overlay: Cell; value: Cell; invalid: boolean; pending: boolean; revision: number }
export interface RecognitionToken { row: number; column: number; revision: number; epoch: number; ink: Strokes }
const copy = <T>(v:T):T => structuredClone(v);
/** Provisional conservative horizontal scrub: five full-width reversals over old ink. */
export function isScratch(points:number[][], ink:Strokes):boolean {
 const old=ink.flat();if(!old.length||points.length<7)return false;
 const minX=Math.min(...old.map(p=>p[0])),maxX=Math.max(...old.map(p=>p[0]));
 const minY=Math.min(...old.map(p=>p[1])),maxY=Math.max(...old.map(p=>p[1]));
 const span=Math.max(.35,maxX-minX);let turns=0,last=0,anchor=points[0][0];
 for(const p of points) {
  if(p[1]<minY||p[1]>maxY)return false;
  const dx=p[0]-anchor;if(Math.abs(dx)<span)continue;
  const sign=Math.sign(dx);if(last&&sign!==last)turns++;last=sign;anchor=p[0];
 }
 return turns>=5 && Math.min(...points.map(p=>p[0]))<=minX && Math.max(...points.map(p=>p[0]))>=maxX;
}
/** Clip segments, splitting excursions rather than drawing along the cell border. */
export function clipStroke(points:number[][]):Strokes {
 const result:Strokes=[];let run:number[][]=[];
 for(let i=1;i<points.length;i++) {
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1,ok=true;
  for(const [p,q] of [[-dx,a[0]],[dx,1-a[0]],[-dy,a[1]],[dy,1-a[1]]]) {
   if(p===0){if(q<0)ok=false;continue;}
   const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
  }
  if(!ok||lo>hi){if(run.length)result.push(run);run=[];continue;}
  const start=lo===0?a.slice():[a[0]+lo*dx,a[1]+lo*dy],end=hi===1?b.slice():[a[0]+hi*dx,a[1]+hi*dy];
  if(lo>0&&run.length){result.push(run);run=[];}
  if(!run.length)run.push(start);run.push(end);
  if(hi<1){result.push(run);run=[];}
 }
 if(run.length)result.push(run);
 if(points.length===1&&points[0].every(v=>v>=0&&v<=1))result.push([points[0].slice()]);
 return result;
}
/** No DOM, timers, worker or puzzle-aware recognition. Coordinates are cell-local. */
export class DrawingState {
 private cells: DrawingCell[][];
 private history: {row:number; column:number; before:DrawingCell}[]=[];
 private active: {row:number; column:number; before:DrawingCell; points:number[][]}|null=null;
 private clock=0;
 private epoch=0;
 private drawing=true;
 constructor(private puzzle: Puzzle, board: Board=puzzle.initialBoard) {
  this.cells=board.map(row=>row.map(value=>({ink:[],overlay:null,value,invalid:false,pending:false,revision:++this.clock})));
 }
 get activeStroke():{row:number;col:number;points:number[][]}|null { return this.active ? {row:this.active.row,col:this.active.column,points:copy(this.active.points)} : null; }
 get canUndo():boolean { return this.history.length>0; }
 cell(r:number,c:number):DrawingCell { return copy(this.cells[r][c]); }
 board():Board { return this.cells.map(row=>row.map(c=>c.value)); }
 private touch(c:DrawingCell) { c.revision=++this.clock; c.pending=false; }
 begin(row:number,column:number,p:number[]):boolean {
  if(this.active || !this.drawing || !this.cells[row]?.[column] || this.puzzle.clues[row][column] || p.length!==2 || !p.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) return false;
  const c=this.cells[row][column]; this.active={row,column,before:copy(c),points:[p.slice()]};
  this.touch(c); if(c.value===null) { c.overlay=null;c.invalid=false; } return true;
 }
 point(p:number[]) { if(this.active && p.length===2 && p.every(Number.isFinite)) this.active.points.push(p.slice()); }
 end() {
  const a=this.active;if(!a)return;this.active=null;const c=this.cells[a.row][a.column];
  if(isScratch(a.points,a.before.ink.length ? a.before.ink : a.before.value!==null ? [[[.2,.2],[.8,.8]]] : [])) {
   this.history.push({row:a.row,column:a.column,before:a.before});
   Object.assign(c,{ink:[],overlay:null,value:null,invalid:false});this.touch(c);return;
  }
  if(c.value!==null) { Object.assign(c,a.before);this.touch(c);return; }
  this.history.push({row:a.row,column:a.column,before:a.before});c.ink.push(...clipStroke(a.points));this.touch(c);
 }
 request(row:number,column:number):RecognitionToken|null {
  const c=this.cells[row][column];if(!this.drawing||this.active||!c.ink.length||c.value!==null)return null;
  this.touch(c);c.pending=true;return {row,column,revision:c.revision,epoch:this.epoch,ink:copy(c.ink)};
 }
 private current(t:RecognitionToken) { return this.drawing && t.epoch===this.epoch && this.cells[t.row]?.[t.column]?.revision===t.revision; }
 preview(t:RecognitionToken,symbol:Cell):boolean {
  if(!this.current(t))return false;
  if(symbol!==null&&(!Number.isInteger(symbol)||symbol<0||symbol>8))return false;
  const c=this.cells[t.row][t.column];c.pending=false;c.overlay=symbol;c.invalid=false;return true;
 }
 commit(t:RecognitionToken):boolean {
  if(!this.current(t))return false;const c=this.cells[t.row][t.column];if(c.overlay===null)return false;
  const next=applyMove(this.puzzle,this.board(),t.row,t.column,c.overlay);
  c.invalid=next===null;if(next)c.value=next[t.row][t.column];this.touch(c);return next!==null;
 }
 cancel() {
  const a=this.active;if(!a)return;this.active=null;
  this.cells[a.row][a.column]=copy(a.before);this.touch(this.cells[a.row][a.column]);
 }
 setMode(drawing:boolean) {
  this.cancel();this.drawing=drawing;this.epoch++;
  this.cells.flat().forEach(c=>this.touch(c));
 }
 reset(puzzle:Puzzle) {
  this.cancel();this.puzzle=puzzle;this.epoch++;this.history=[];
  this.cells=puzzle.initialBoard.map(row=>row.map(value=>({ink:[],overlay:null,value,invalid:false,pending:false,revision:++this.clock})));
 }
 /** Caller supplies the result of existing applyHint/applyMove, not an unchecked guess. */
 replace(row:number,column:number,value:Cell):boolean {
  this.cancel();if(this.puzzle.clues[row]?.[column]!==false)return false;
  if(value!==null && (!Number.isInteger(value)||value<0||value>=this.puzzle.size))return false;
  const c=this.cells[row][column];this.history.push({row,column,before:copy(c)});
  Object.assign(c,{ink:[],overlay:null,value,invalid:false});this.touch(c);return true;
 }
 undo():boolean {
  this.cancel();
  const h=this.history.pop();if(!h)return false;
  this.cells[h.row][h.column]=copy(h.before);this.touch(this.cells[h.row][h.column]);return true;
 }
}
