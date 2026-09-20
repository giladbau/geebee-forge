import { afterEach, expect, it, vi } from 'vitest';
import { DrawingController } from './drawing-controller';
import { DrawingState } from './drawing-state';
import { generatePuzzle } from './shape-sudoku';
import { LABELS } from './shape-sudoku-lab/cnn';

it.each([[4,8],[5,4],[6,5],[7,6],[8,7]])('maps accepted model index %i to game symbol %i', (modelIndex, symbol) => {
 const {controller,state,row,column}=setup();
 const preview=vi.spyOn(state,'preview');
 controller.load();const worker=FakeWorker.last;worker.send({type:'ready'});
 vi.advanceTimersByTime(400);const request=worker.postMessage.mock.calls[1][0];
 // Deliberately reversed: ranking order is not model order or game order.
 const ranked=LABELS.map((label,index)=>({label,score:index===modelIndex?.95:.005})).reverse();
 worker.send({...request,type:'result',result:{ranked}});
 expect(preview).toHaveBeenCalledWith(expect.anything(),symbol);
 controller.destroy();
});
class FakeWorker {
 static last: FakeWorker;
 onmessage: ((e:{data:any})=>void)|null=null;
 onerror: (()=>void)|null=null;
 onmessageerror: (()=>void)|null=null;
 postMessage=vi.fn(); terminate=vi.fn();
 constructor(){FakeWorker.last=this;}
 send(data:any){this.onmessage?.({data});}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function setup(){
 vi.useFakeTimers();vi.stubGlobal('Worker',FakeWorker);
 const puzzle=generatePuzzle(4),state=new DrawingState(puzzle);
 const row=puzzle.clues.findIndex(r=>r.includes(false)),column=puzzle.clues[row].indexOf(false);
 state.begin(row,column,[.2,.2]);state.point([.8,.2]);state.point([.8,.8]);state.point([.2,.2]);state.end();
 const changed=vi.fn(),placed=vi.fn(),controller=new DrawingController(state,changed,placed);
 return {controller,state,row,column,changed,placed};
}
it('loads lazily and sends no inference before worker readiness',()=>{
 const {controller,row,column}=setup();expect(controller.status).toBe('idle');
 controller.recognize(row,column);vi.runAllTimers();controller.load();
 expect(controller.status).toBe('loading');expect(FakeWorker.last.postMessage).toHaveBeenCalledTimes(1);
 FakeWorker.last.send({type:'ready'});expect(controller.status).toBe('ready');
 vi.advanceTimersByTime(400);expect(FakeWorker.last.postMessage.mock.calls[1][0].type).toBe('infer');controller.destroy();
});
it('waits 400ms and rejects cancelled or duplicate results',()=>{
 const {controller,state,row,column}=setup();controller.load();const worker=FakeWorker.last;worker.send({type:'ready'});
 controller.recognize(row,column);vi.advanceTimersByTime(399);expect(worker.postMessage).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(1);const request=worker.postMessage.mock.calls[1][0];
 expect(request.strokes).toEqual(state.cell(row,column).ink);expect(request).not.toHaveProperty('puzzle');
 const preview=vi.spyOn(state,'preview');controller.cancel();worker.send({...request,type:'result',result:{ranked:[]}});
 expect(preview).not.toHaveBeenCalled();controller.destroy();expect(vi.getTimerCount()).toBe(0);
});
it('reports worker errors honestly and permits retry',()=>{
 const {controller}=setup();controller.load();const old=FakeWorker.last;old.onerror?.();
 expect(controller.status).toBe('error');expect(old.terminate).toHaveBeenCalled();
 controller.load();expect(controller.status).toBe('loading');FakeWorker.last.send({type:'ready'});
 expect(controller.status).toBe('ready');controller.destroy();
});
