// Run after npm run build. Optional URL argument tests a deployed Astro route.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname } from 'node:path';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failModel = false;
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    res.setHeader('Cache-Control', 'no-store');
    if (failModel && pathname.endsWith('/shape-cnn-v1.json')) { res.writeHead(503).end(); return; }
    if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    const file = resolve('dist', '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(resolve('dist') + '/')) throw Error('Invalid path');
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const profile = await mkdtemp(`${tmpdir()}/shape-lab-browser-`);
const browser = spawn(process.env.CHROMIUM || '/usr/bin/chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(Error('Chromium startup timeout')), 15000);
    browser.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    browser.on('error', reject);
  });
  const tabs = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
  socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(Error(JSON.stringify(msg.error))) : resolve(msg.result); }
  });
  const errors = [], requests = [];
  socket.addEventListener('message', e => { const m=JSON.parse(e.data); if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); if(m.method==='Log.entryAdded' && m.params.entry.level==='error') errors.push(m.params.entry); if(m.method==='Network.requestWillBeSent') requests.push(m.params.request); });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Network.enable');
  await cdp('Page.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.testWorkers=[];const RealWorker=window.Worker;window.Worker=class extends RealWorker {constructor(...args){super(...args);window.testWorkers.push(this);}};`});
  const base = `http://127.0.0.1:${server.address().port}`;
  await cdp('Emulation.setDeviceMetricsOverride', {width:1024,height:900,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate', {url:base+'/shape-sudoku-lab/'});
  const waitFor = async expr => { for(let i=0;i<100;i++) {if(await evaluate(expr)) return;await sleep(100);} throw Error('Timed out: '+expr); };
  await waitFor(`document.querySelectorAll('.tile canvas').length === 9`);
  await waitFor(`document.querySelector('[data-status]')?.textContent.includes('Ready')`);
  assert.match(await evaluate('document.body.textContent'), /uncalibrated/i);
  const rect = async i => evaluate(`(()=>{const c=document.querySelectorAll('.tile canvas')[${i}],r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,touch:getComputedStyle(c).touchAction};})()`);
  assert.equal((await rect(0)).touch, 'none');
  let pointerId;
  await evaluate(`document.addEventListener('pointerdown', e=>window.lastPointerId=e.pointerId)`);
  const draw = async (i, points, cancel=false, type='pen') => {
    const r=await rect(i), ps=points.map(([x,y])=>({x:r.x+x*r.width/100,y:r.y+y*r.height/100}));
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...ps[0],button:'left',buttons:1,clickCount:1,pointerType:type});
    pointerId=await evaluate('window.lastPointerId');
    assert.equal(await evaluate(`document.querySelectorAll('.tile canvas')[${i}].hasPointerCapture(${pointerId})`),true,'real pointer capture');
    for(const p of ps.slice(1,-1)) await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1,pointerType:type});
    if(cancel) await evaluate(`document.querySelectorAll('.tile canvas')[${i}].dispatchEvent(new PointerEvent('pointercancel',{pointerId:${pointerId},pointerType:'${type}',bubbles:true}))`);
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...ps.at(-1),button:'left',buttons:0,clickCount:1,pointerType:type});
  };
  await draw(0,[[50,10],[90,85],[10,85],[50,10]]);
  await waitFor(`document.querySelector('.tile').dataset.result === 'triangle'`);
  const before=await evaluate(`document.querySelector('.tile canvas').toDataURL()`);
  await draw(0,[[10,10],[90,10],[90,90]],true);
  await sleep(800);
  assert.equal(await evaluate(`document.querySelector('.tile canvas').toDataURL()`),before,'cancel restores ink');
  assert.equal(await evaluate(`document.querySelector('.tile').dataset.result`),'triangle','cancel restores result');
  // Later tile, real separate strokes, no forced intended label.
  await draw(1,[[10,10],[90,10]],false,'mouse');
  await draw(1,[[90,10],[90,90]],false,'mouse');
  await sleep(800);
  await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
  const download = async () => {
    const path=resolve(profile,'shape-cnn-diagnostics.json'); await rm(path,{force:true});
    await evaluate(`document.querySelector('[data-export]').click()`);
    for(let i=0;i<100;i++) {try{return JSON.parse(await readFile(path,'utf8'));}catch{await sleep(50);}}
    throw Error('No actual downloaded JSON');
  };
  const exported=await download();
  assert.equal(exported.currentTiles[1].strokes.length,2,'pen lifts preserved');
  assert.equal(exported.currentTiles[0].result.ranked.length,9);
  assert.ok(exported.events.some(e=>e.kind==='pointer-cancel' && e.current.length>0));
  assert.match(exported.model.checkpointSha256,/^[a-f0-9]{64}$/);
  assert.match(exported.buildVersion,/^[a-f0-9]{40}/);
  await draw(1,[[90,90],[10,90]]);
  await evaluate(`document.querySelector('[data-clear]').click()`); // pending inference/timer window
  await sleep(900);
  const cleared=await download();
  assert.equal(cleared.currentTiles[1].strokes.length,0);
  assert.equal(cleared.currentTiles[1].result,null);
  assert.equal(cleared.currentTiles[0].result.label,'triangle');
  assert.equal(await evaluate(`document.querySelector('.tile canvas').toDataURL()`),before);
  // Worker runs exact shipped implementation and model, with Python reference inputs.
  const reference=JSON.parse(await readFile('scripts/fixtures/shape-cnn-reference.json','utf8'));
  const workerFile=(await readdir('dist/_astro')).find(f=>f.startsWith('cnn-worker-') && f.endsWith('.js'));
  assert.ok(workerFile,'built worker exists');
  const parity=await evaluate(`(async()=>{
    const worker=new Worker('/_astro/${workerFile}',{type:'module'});
    const send=data=>new Promise((resolve,reject)=>{worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data);worker.onerror=e=>reject(Error(e.message));worker.postMessage(data);});
    await send({type:'load'});
    const results=[];
    for(const f of ${JSON.stringify(reference.fixtures)}) {
      const start=performance.now();const r=await send({type:'infer',id:f.id,strokes:f.strokes});
      results.push({id:f.id,pixelMismatches:r.pixels.filter((v,i)=>v!==f.pixels[i]).length,maxLogitError:Math.max(...r.result.logits.map((v,i)=>Math.abs(v-f.logits[i]))),argmaxAgreement:r.result.logits.indexOf(Math.max(...r.result.logits))===f.logits.indexOf(Math.max(...f.logits)),ms:performance.now()-start});
    }
    worker.terminate();return results;
  })()`);
  assert.equal(parity.length,reference.fixtures.length);
  assert.ok(parity.every(r=>r.pixelMismatches===0));
  assert.ok(parity.every(r=>r.maxLogitError<1e-4 && r.argmaxAgreement));
  await mkdir('verification/shape-cnn',{recursive:true});
  await writeFile('verification/shape-cnn/parity.json',JSON.stringify(parity,null,2));
  const sizes=[];
  for(const width of [320,390,768,1024]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    const bounds=await evaluate(`(()=>{const r=document.querySelector('.board').getBoundingClientRect();return {left:r.left,right:r.right,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
    assert.ok(bounds.left>=0 && bounds.right<=width);assert.equal(bounds.overflow,false);
    sizes.push({width,...bounds});
    if(width===390 || width===1024) {const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile('verification/shape-cnn/'+width+'.png',Buffer.from(shot.data,'base64'));}
  }
  assert.deepEqual(errors,[],'no runtime/console errors');
  assert.ok(requests.every(r=>r.method==='GET' && new URL(r.url).origin===base),'drawings never uploaded; only same-origin GETs');
  await draw(2,[[10,10],[90,90]]);
  assert.match(await evaluate(`document.querySelectorAll('.prediction')[2].textContent`), /Thinking/);
  await evaluate(`window.testWorkers[0].dispatchEvent(new ErrorEvent('error',{message:'Synthetic worker failure'}))`);
  assert.ok(!(await download()).currentTiles.some(t=>t.pending),'worker failure clears pending states');
  await sleep(500);
  assert.equal(await evaluate(`document.querySelectorAll('.tile')[2].dataset.result`),'','worker failure cancels scheduled inference');
  // A missing model must produce a visible error rather than a fallback guess.
  failModel = true;
  await cdp('Page.reload',{ignoreCache:true});
  await waitFor(`document.querySelector('[data-status]')?.textContent.includes('unavailable')`);
  assert.equal(await evaluate(`document.querySelectorAll('.tile[data-result="triangle"]').length`),0);
  failModel = false;
  await evaluate(`document.querySelector('[data-retry]').click()`);
  await waitFor(`document.querySelector('[data-status]')?.textContent.includes('Ready')`);
  const summary={fixtures:parity.length,pixelMismatches:parity.reduce((s,r)=>s+r.pixelMismatches,0),maxLogitError:Math.max(...parity.map(r=>r.maxLogitError)),argmaxAgreement:parity.filter(r=>r.argmaxAgreement).length,maxInferenceMs:Math.max(...parity.map(r=>r.ms)),sizes,checks:['load','pen+mouse capture','inference','pen lifts','pointercancel restoration','actual JSON download','later-cell clear race','no uploads','responsive bounds','no unexpected console errors','load error and retry']};
  await writeFile('verification/shape-cnn/summary.json',JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
} finally {
  socket?.close();
  const exited = new Promise(r => browser.once('exit', r)); browser.kill('SIGTERM'); await exited;
  await new Promise(r => server.close(r)); await rm(profile, {recursive:true,force:true});
}
