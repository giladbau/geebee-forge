<script lang="ts">
  import { onMount } from 'svelte';
  import { LABELS, type Strokes, type infer } from '$lib/shape-sudoku-lab/cnn';
  let { buildVersion }: { buildVersion: string } = $props();
  type Result = ReturnType<typeof infer>;
  type Tile = {strokes: Strokes; current: number[][]; result: Result|null; revision: number; pending: boolean; ms: number|null};
  const tiles = $state<Tile[]>(Array.from({length:9},()=>({strokes:[],current:[],result:null,revision:0,pending:false,ms:null})));
  const canvases: HTMLCanvasElement[] = [];
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let active = $state(0), status = $state('Loading small CNN locally…'), ready = $state(false);
  let model = $state<Record<string,unknown>|null>(null), worker: Worker | null = null;
  let pointer: {id:number; tile:number; before:Result|null; ms:number|null}|null = null;
  let events: Record<string,unknown>[] = [], eventCount = 0;
  let totalEvents = $state(0);
  const clone = <T,>(value:T):T => JSON.parse(JSON.stringify(value));
  function capture(i:number,kind:string,extra:Record<string,unknown>={}) {
    const t=tiles[i];
    events.push({id:++eventCount,at:new Date().toISOString(),tile:i+1,kind,strokes:clone(t.strokes),current:clone(t.current),result:clone(t.result),...extra});
    if(events.length>100) events.shift();
    totalEvents=eventCount;
  }
  function cancelTimer(i:number) { clearTimeout(timers.get(i)); timers.delete(i); }
  function schedule(i:number) {
    cancelTimer(i);
    const t=tiles[i];
    if(!ready || !t.strokes.length || t.current.length) return;
    t.pending=true;
    timers.set(i,setTimeout(()=>{
      timers.delete(i);
      worker?.postMessage({type:'infer',tile:i,revision:t.revision,strokes:clone(t.strokes)});
    },400));
  }
  function unavailable(message:string) {
    ready=false;status='CNN unavailable: '+message;
    for(let i=0;i<9;i++) {cancelTimer(i);tiles[i].pending=false;}
  }
  function load() {
    ready=false; status='Loading small CNN locally…'; worker?.terminate();
    for(let i=0;i<9;i++) {cancelTimer(i);tiles[i].pending=false;}
    worker=new Worker(new URL('../../../lib/shape-sudoku-lab/cnn-worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(data.type==='ready') { model=data.model;ready=true;status='Ready — local CNN, epoch '+data.model.epoch; for(let i=0;i<9;i++) schedule(i); }
      else if(data.type==='result') {
        const t=tiles[data.tile];
        if(!t || data.revision!==t.revision || t.current.length) return;
        t.result=data.result;t.pending=false;t.ms=data.ms;capture(data.tile,'recognition',{ms:data.ms});
      } else if(data.type==='error') {
        if(data.tile!==undefined) {
          const t=tiles[data.tile];
          if(data.revision!==t.revision) return;
          t.pending=false;capture(data.tile,'inference-error',{error:data.error});
        }
        unavailable(data.error);
      }
    };
    worker.onerror=(e)=>unavailable(e.message);
    worker.postMessage({type:'load'});
  }
  onMount(()=>{
    load();
    return ()=>{worker?.terminate();for(const timer of timers.values()) clearTimeout(timer);};
  });
  function paint(i:number) {
    const canvas=canvases[i], ctx=canvas.getContext('2d')!;
    ctx.clearRect(0,0,256,256);ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#7dd3fc';ctx.fillStyle='#7dd3fc';
    for(const stroke of [...tiles[i].strokes,tiles[i].current]) {
      if(!stroke.length) continue;
      if(stroke.length===1) {ctx.beginPath();ctx.arc(stroke[0][0]*2.56,stroke[0][1]*2.56,2,0,2*Math.PI);ctx.fill();continue;}
      ctx.beginPath();ctx.moveTo(stroke[0][0]*2.56,stroke[0][1]*2.56);
      for(const [x,y] of stroke.slice(1)) ctx.lineTo(x*2.56,y*2.56);
      ctx.stroke();
    }
  }
  function point(e:PointerEvent,i:number) { const r=canvases[i].getBoundingClientRect();return [(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100]; }
  function down(e:PointerEvent,i:number) {
    if(pointer || !e.isPrimary || e.button!==0) return;
    e.preventDefault();active=i;cancelTimer(i);
    const t=tiles[i];pointer={id:e.pointerId,tile:i,before:clone(t.result),ms:t.ms};
    canvases[i].setPointerCapture(e.pointerId);
    t.revision++;t.pending=false;t.result=null;t.current=[point(e,i)];paint(i);
  }
  function move(e:PointerEvent,i:number) {
    if(pointer?.id!==e.pointerId || pointer.tile!==i) return;
    e.preventDefault();const batch=e.getCoalescedEvents?.() || [];
    for(const p of batch.length?batch:[e]) tiles[i].current.push(point(p,i));
    paint(i);
  }
  function up(e:PointerEvent,i:number) {
    if(pointer?.id!==e.pointerId || pointer.tile!==i) return;
    e.preventDefault();const t=tiles[i];t.current.push(point(e,i));
    t.strokes.push(t.current);t.current=[];pointer=null;
    if(canvases[i].hasPointerCapture(e.pointerId)) canvases[i].releasePointerCapture(e.pointerId);
    capture(i,'stroke-end',{pointerType:e.pointerType});paint(i);schedule(i);
  }
  function cancel(e:PointerEvent,i:number) {
    if(pointer?.id!==e.pointerId || pointer.tile!==i) return;
    const t=tiles[i];capture(i,'pointer-cancel',{pointerType:e.pointerType});
    t.current=[];t.result=pointer.before;t.ms=pointer.ms;pointer=null;t.revision++;
    if(canvases[i].hasPointerCapture(e.pointerId)) canvases[i].releasePointerCapture(e.pointerId);
    paint(i);if(!t.result) schedule(i);
  }
  function clear() {
    const i=active,t=tiles[i];capture(i,'clear');cancelTimer(i);
    if(pointer?.tile===i) {const id=pointer.id;pointer=null;if(canvases[i].hasPointerCapture(id)) canvases[i].releasePointerCapture(id);}
    t.revision++;t.current=[];t.strokes=[];t.result=null;t.pending=false;t.ms=null;paint(i);
  }
  function download() {
    const data={schemaVersion:1,buildVersion,recognizerVersion:'tiny-cnn-json-v1-pillow-width2-v1',model,exportedAt:new Date().toISOString(),coordinateSystem:'tile percentages; unfiltered pointer coordinates; pen lifts retained',source:'browser input; not verified human',scores:'uncalibrated softmax, not confidence',retention:'latest 100 events; memory only',userAgent:navigator.userAgent,totalEvents:eventCount,events,currentTiles:tiles.map((t,i)=>({tile:i+1,strokes:clone(t.strokes),current:clone(t.current),result:clone(t.result),pending:t.pending,ms:t.ms}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='shape-cnn-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
</script>

<main class="lab-shell">
  <h1>Shape CNN lab <span>Experiment</span></h1>
  <p class="intro">Draw freely in any cell with a pen, finger, or mouse. Lift and continue for multiple strokes. This tester does not change the main game.</p>
  <p class="labels">{LABELS.join(' · ')}</p>
  <p data-status role="status">{status}</p>
  {#if !ready && status.includes('unavailable')}<button data-retry onclick={load}>Retry model load</button>{/if}
  <div class="board">
    {#each tiles as tile,i}
      <div class:active={active===i} class="tile" data-result={tile.result?.label || ''}>
        <canvas bind:this={canvases[i]} width="256" height="256" aria-label={`Drawing cell ${i+1}`} onpointerdown={e=>down(e,i)} onpointermove={e=>move(e,i)} onpointerup={e=>up(e,i)} onpointercancel={e=>cancel(e,i)} onlostpointercapture={e=>cancel(e,i)}></canvas>
        <span class="cell-number">{i+1}</span>
        <span class="prediction">{tile.pending?'Thinking…':tile.result?.label || 'draw here'}</span>
      </div>
    {/each}
  </div>
  <div class="controls"><button data-clear onclick={clear}>Clear cell {active+1}</button><button data-export onclick={download}>Download diagnostics JSON</button></div>
  <section class="scores" aria-label="CNN scores">
    <h2>Cell {active+1} — uncalibrated scores</h2>
    <p>These are model rankings, not confidence or correctness. Every nonempty doodle gets a guess; there is no unknown-shape detector, geometry fallback, or puzzle hint.</p>
    {#if tiles[active].result}
      <ol>{#each tiles[active].result!.ranked as r}<li><span>{r.label}</span><span>{(r.score*100).toFixed(1)}%</span></li>{/each}</ol>
      <p>Last inference: {tiles[active].ms?.toFixed(1)} ms (worker).</p>
    {:else}<p>Draw to see all nine rankings.</p>{/if}
  </section>
  <details><summary>Privacy & experiment details</summary>
    <p>The small trained model downloads from this site. Inference runs locally in a browser worker; drawings are never uploaded. Up to 100 diagnostic events remain in memory until you close this page. Clear removes cell ink, not the local diagnostic history ({totalEvents} events recorded). Download only if you want to save it.</p>
    <p>64×64 white ink on black; aspect-preserving centering, padding 4, line width 2. The display canvas is not the model raster. Desktop synthetic parity has been tested; recognition quality and actual iPad/Pencil performance are not established.</p>
    <p>Build: <code>{buildVersion}</code></p>
    <p>Checkpoint: <code>{String(model?.checkpointSha256 || 'loading')}</code></p>
  </details>
</main>

<style>
  .lab-shell { max-width:680px;margin:0 auto;padding:76px 16px 40px;color:#e8eef2;font-family:system-ui,sans-serif; }
  h1 {font-size:1.6rem;margin:0 0 12px;}h1 span {font-size:.75rem;vertical-align:middle;background:#463447;padding:5px 8px;border-radius:8px;color:#f0abfc;}
  p {line-height:1.5;font-size:.9rem;} .intro,.labels {color:#afbac4;} .labels {font-size:.8rem;}
  .board {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%;max-width:480px;margin:16px auto;}
  .tile {position:relative;aspect-ratio:1;background:#202a33;border:2px solid #39434c;border-radius:12px;overflow:hidden;touch-action:none;}
  .tile.active {border-color:#a4d7f5;}
  canvas {position:absolute;inset:0;width:100%;height:100%;touch-action:none;user-select:none;}
  .prediction,.cell-number {position:absolute;pointer-events:none;font-size:.7rem;color:#c9d1d9;}
  .prediction {bottom:4px;left:0;right:0;text-align:center;background:#202a33b0;}.cell-number {top:4px;left:7px;opacity:.6;}
  .controls {display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
  button {background:#26333e;color:#e8eef2;border:1px solid #657685;border-radius:8px;padding:10px 12px;cursor:pointer;}
  button:focus-visible {outline:2px solid #7dd3fc;outline-offset:3px;}
  .scores {margin-top:24px;border-top:1px solid #39434c;}h2 {font-size:1.05rem;}
  ol {padding-left:25px;} li {padding:3px 0;}li span:last-child {float:right;font-variant-numeric:tabular-nums;}
  details {margin-top:20px;color:#afbac4;font-size:.85rem;overflow-wrap:anywhere;}summary {cursor:pointer;}code {font-size:.75rem;}
</style>
