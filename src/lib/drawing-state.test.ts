import { describe, it, expect } from 'vitest';
import { DrawingState, clipStroke, isScratch } from './drawing-state';
import type { Puzzle } from './shape-sudoku';
const puzzle: Puzzle = {size:3, initialBoard:[[0,null,null],[null,null,null],[null,null,null]], clues:[[true,false,false],[false,false,false],[false,false,false]], solution:[[0,1,2],[1,2,0],[2,0,1]]};
const triangle = [[.2,.8],[.5,.2],[.8,.8],[.2,.8]];
function draw(s: DrawingState, r=0,c=1) { s.begin(r,c,triangle[0]); triangle.slice(1).forEach(p=>s.point(p)); s.end(); }
describe('natural scratch gestures',()=>{
 const old=[triangle];
 const scrub=[[.05,.38],[.92,.48],[.1,.6],[.98,.7],[.04,.5],[.9,.4]];
 it.each([0,Math.PI/2,Math.PI/4])('accepts loose scrub rotated %s',angle=>{
  const points=scrub.map(([x,y])=>[.5+(x-.5)*Math.cos(angle)-(y-.5)*Math.sin(angle),.5+(x-.5)*Math.sin(angle)+(y-.5)*Math.cos(angle)]);
  expect(isScratch(points,old)).toBe(true);
  const dense=points.flatMap((p,i)=>i?Array.from({length:20},(_,j)=>points[i-1].map((v,k)=>v+(p[k]-v)*(j+1)/20)):[p]);
  expect(isScratch(dense,old)).toBe(true);
 });
 it('rejects ordinary shapes, jitter, distant scrubs, and absent old ink',()=>{
  const circle=Array.from({length:80},(_,i)=>[.5+.35*Math.cos(i/79*2*Math.PI),.5+.35*Math.sin(i/79*2*Math.PI)]);
  for(const points of [triangle,[[.1,.1],[.9,.9]],[[.1,.1],[.9,.9],[.9,.1],[.1,.9]],circle,circle.slice(0,40),Array.from({length:80},(_,i)=>[.5+(i%2)*.02,.5])])expect(isScratch(points,old)).toBe(false);
  expect(isScratch(scrub,[])).toBe(false);
  expect(isScratch(scrub.map(([x,y])=>[x+2,y+2]),old)).toBe(false);
 });
});
describe('drawing transactions',()=>{
 it('splits outside excursions without inventing border ink',()=>{
  expect(clipStroke([[.5,.5],[2,.5],[2,.8],[.5,.8]])).toEqual([[[.5,.5],[1,.5]],[[1,.8],[.5,.8]]]);
 });
 it('exposes independent active ink and permits scratch on a hint',()=>{
  const s=new DrawingState(puzzle);s.replace(0,1,1);
  s.begin(0,1,[.1,.5]);const view=s.activeStroke!;view.points[0][0]=9;expect(s.activeStroke!.points[0][0]).toBe(.1);
  for(let i=0;i<8;i++)s.point([i%2?.1:.9,.5]);s.end();
  expect(s.cell(0,1).value).toBe(null);s.undo();expect(s.cell(0,1).value).toBe(1);
 });
 it('guards late results after cancel, undo, clear, reset and mode changes',()=>{
  for(const action of ['cancel','undo','clear','reset','mode'] as const) {
   const s=new DrawingState(puzzle);draw(s);const t=s.request(0,1)!;
   if(action==='cancel'){s.begin(0,1,[.3,.3]);s.cancel();}
   if(action==='undo')s.undo();
   if(action==='clear')s.replace(0,1,null);
   if(action==='reset')s.reset(puzzle);
   if(action==='mode'){s.setMode(false);s.setMode(true);}
   expect(s.preview(t,1)).toBe(false);expect(s.cell(0,1).pending).toBe(false);
  }
 });
 it('owns and bounds a stroke, rolls cancellation back and preserves other cells',()=>{
  const s=new DrawingState(puzzle);draw(s);const before=s.cell(0,1);
  s.begin(0,1,[.2,.2]);s.point([2,-1]);s.cancel();
  expect(s.cell(0,1).ink).toEqual(before.ink);
  s.begin(1,1,[.2,.2]);s.point([2,-1]);s.end();
  expect(s.cell(1,1).ink[0][1][0]).toBeCloseTo(.5);
  expect(s.cell(1,1).ink[0][1][1]).toBeCloseTo(0);
  s.undo();expect(s.cell(0,1).ink).toEqual(before.ink);
  expect(s.begin(0,0,[.2,.2])).toBe(false);
 });
 it('undo restores a hint replacement and accepted cells resist ordinary strokes',()=>{
  const s=new DrawingState(puzzle);draw(s);s.replace(0,1,1);
  s.begin(0,1,[.1,.1]);s.point([.9,.9]);s.end();expect(s.cell(0,1).value).toBe(1);
  s.undo();expect(s.cell(0,1).ink).toEqual([triangle]);
 });
 it('scratch erase restores all accepted state on undo, but slash does not erase',()=>{
  const s=new DrawingState(puzzle);draw(s);const t=s.request(0,1)!;s.preview(t,1);s.commit(t);
  const before=s.cell(0,1);s.begin(0,1,[.1,.5]);s.point([.9,.5]);s.end();expect(s.cell(0,1).value).toBe(1);
  s.begin(0,1,[.1,.5]);for(let i=0;i<8;i++)s.point([i%2?.1:.9,.5]);s.end();
  expect(s.cell(0,1).ink).toEqual([]);s.undo();expect(s.cell(0,1)).toMatchObject({ink:before.ink,value:1,overlay:1});
 });
 it('preserves ink with recognized invalid overlay, then undoes the stroke',()=>{
  const s=new DrawingState(puzzle); draw(s); const token=s.request(0,1)!;
  expect(s.preview(token,0)).toBe(true); s.commit(token);
  expect(s.cell(0,1)).toMatchObject({value:null,overlay:0,invalid:true});
  expect(s.undo()).toBe(true); expect(s.cell(0,1).ink).toEqual([]);
 });
});
