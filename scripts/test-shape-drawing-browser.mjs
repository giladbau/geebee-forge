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

  const out='.output/verification/shape-drawing';await mkdir(out,{recursive:true});const results=[];
  const check=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}console.log(JSON.stringify(results.at(-1)));};
  const waitFor=async(expr)=>{for(let t=0;t<5000;t+=40){if(await evaluate(expr))return;await sleep(40);}throw Error('Timed out: '+expr);};
  const click=async(text)=>{await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);await sleep(60);};
  const cells=()=>evaluate(`[...document.querySelectorAll('.grid>button')].map(b=>({label:b.getAttribute('aria-label'),clue:b.disabled,ink:[...b.querySelectorAll('.ink-layer path')].map(p=>p.getAttribute('d')),invalid:b.classList.contains('invalid-drawing')}))`);
  const rect=async(i)=>evaluate(`(()=>{const b=document.querySelectorAll('.grid>button')[${i}];b.scrollIntoView({block:'center',inline:'center'});const r=b.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  const draw=async(i,points,type='pen')=>{const r=await rect(i);const ps=points.map(([x,y])=>({x:r.x+x*r.width,y:r.y+y*r.height}));await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...ps[0],button:'left',buttons:1,clickCount:1,pointerType:type});for(const p of ps.slice(1))await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...p,button:'left',buttons:1,pointerType:type});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...ps.at(-1),button:'left',buttons:0,clickCount:1,pointerType:type});};
  const triangle=[[.5,.1],[.9,.85],[.1,.85],[.5,.1]],base=`http://127.0.0.1:${server.address().port}`;
  await cdp('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:process.argv[2]||base+'/shape-sudoku/'});await waitFor(`document.querySelector('.mode-actions button')`);await click('Drawing mode');
  await check('real CNN loaded',()=>waitFor(`document.querySelector('.drawing-help')?.textContent.includes('Experimental recognition')`));
  const initial=await cells(),n=Math.sqrt(initial.length),isTriangle=c=>/triangle/i.test(c.label);
  const valid=initial.findIndex((c,i)=>!c.clue&&!initial.some((d,j)=>isTriangle(d)&&(Math.floor(i/n)===Math.floor(j/n)||i%n===j%n))),invalid=initial.findIndex((c,i)=>!c.clue&&initial.some((d,j)=>isTriangle(d)&&(Math.floor(i/n)===Math.floor(j/n)||i%n===j%n))),editable=initial.findIndex(c=>!c.clue);
  await check('mouse does not ink',async()=>{await draw(editable,triangle,'mouse');assert.deepEqual(await cells(),initial);});
  await check('touch does not ink',async()=>{await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});const r=await rect(editable);await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(150);assert.deepEqual(await cells(),initial);});
  await check('clues immutable',async()=>{const i=initial.findIndex(c=>c.clue);await draw(i,triangle);assert.deepEqual((await cells())[i],initial[i]);});
  const preview=i=>`!!document.querySelectorAll('.grid>button')[${i}].querySelector('.recognition-overlay')`;
  await check('real CNN triangle preview and valid auto-placement',async()=>{assert.ok(valid>=0);await draw(valid,triangle);await waitFor(preview(valid));await waitFor(`document.querySelectorAll('.grid>button')[${valid}].getAttribute('aria-label').toLowerCase().startsWith('triangle')`);});
  await check('accepted shape survives mode switch',async()=>{assert.ok(isTriangle((await cells())[valid]));const before=await cells();await click('Drawing mode');await click('Drawing mode');assert.deepEqual(await cells(),before);});
  await check('scratch erase and undo',async()=>{const before=(await cells())[valid];assert.ok(isTriangle(before));await draw(valid,Array.from({length:9},(_,j)=>[j%2?.95:.05,.5]));await sleep(100);assert.equal((await cells())[valid].ink.length,0);assert.match((await cells())[valid].label,/Empty/);await click('Undo');assert.deepEqual((await cells())[valid],before);});
  await check('undo accepted stroke',async()=>{await click('Undo');assert.deepEqual((await cells())[valid],initial[valid]);});
  await check('real CNN invalid shape retains ink and cue',async()=>{assert.ok(invalid>=0);await draw(invalid,triangle);await waitFor(`document.querySelectorAll('.grid>button')[${invalid}].classList.contains('invalid-drawing')`);const c=(await cells())[invalid];assert.match(c.label,/Empty/);assert.ok(c.ink.length);});
  await click('Reset');
  await check('unfinished ink survives mode switch',async()=>{await draw(editable,[[.3,.3],[.31,.31]]);const before=(await cells())[editable].ink;assert.ok(before.length);await click('Drawing mode');await click('Drawing mode');assert.deepEqual((await cells())[editable].ink,before);});await click('Reset');
  await check('hint undo',async()=>{const before=await cells();await click('Hint');assert.notDeepEqual((await cells()).map(c=>c.label),before.map(c=>c.label));await click('Undo');assert.deepEqual((await cells()).map(c=>c.label),before.map(c=>c.label));});
  await check('reset cancels scheduled inference',async()=>{await draw(editable,triangle);await click('Reset');await sleep(1600);assert.deepEqual(await cells(),initial);});
  await check('reset during preview prevents stale commit',async()=>{await draw(valid,triangle);await waitFor(preview(valid));await click('Reset');await sleep(900);assert.deepEqual(await cells(),initial);});
  const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(out+'/desktop.png',Buffer.from(shot.data,'base64'));
  const sizes=[];for(const width of [320,390,768])await check('96px cell minimum and contained overflow '+width,async()=>{await cdp('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false});await sleep(100);const v=await evaluate(`(()=>{const s=document.querySelector('.board-scroll'),b=document.querySelector('.grid>button'),r=b.getBoundingClientRect();return {width:r.width,height:r.height,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,touch:getComputedStyle(b).touchAction};})()`);sizes.push({viewport:width,...v});assert.ok(v.width>=96&&v.height>=96);assert.equal(v.pageOverflow,false);assert.match(v.touch,/pan-x pan-y/);});
  await check('real finger scroll without ink',async()=>{await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:false});await evaluate(`document.querySelector('.board-scroll').scrollIntoView({block:'center'});document.querySelector('.board-scroll').scrollLeft=0`);await sleep(100);const r=await evaluate(`(()=>{const r=document.querySelector('.board-scroll').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}})()`),before=await cells(),x=r.x+r.width-20,y=Math.max(20,Math.min(650,r.y+60));await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let j=1;j<=10;j++){await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-j*14,y}]});await sleep(25);}await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(200);assert.ok(await evaluate(`document.querySelector('.board-scroll').scrollLeft>0`),'gesture must actually scroll');assert.deepEqual(await cells(),before);});
  const mobile=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(mobile.data,'base64'));await check('no runtime errors',async()=>assert.deepEqual(errors,[]));await check('no uploads',async()=>assert.ok(requests.every(r=>r.method==='GET')));
  await writeFile(out+'/summary.json',JSON.stringify({results,sizes,initial,valid,invalid,errors},null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}finally{socket?.close();const exited=new Promise(r=>browser.once('exit',r));browser.kill('SIGTERM');await exited;await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
