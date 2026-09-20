// Run after npm run build. Optional URL argument tests a deployed Astro route.
import assert from 'node:assert/strict';
import { hasCompletionAfterMove } from '../src/lib/shape-sudoku.ts';
const names=['triangle','square','star','circle','crescent','cloud','lightning','rainbow','sun'];
const boardFrom=cs=>{const n=Math.sqrt(cs.length);return Array.from({length:n},(_,r)=>cs.slice(r*n,(r+1)*n).map(c=>{const i=names.findIndex(name=>new RegExp('^(Locked )?'+name+'( |,)','i').test(c.label));return i<0?null:i;}));};
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
  await cdp('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});await cdp('Page.navigate',{url:process.argv[2]||base+'/shape-sudoku/'});await waitFor(`document.querySelector('.mode-actions button')?.getAttribute('aria-pressed')==='true'`);
  await check('real CNN loaded',()=>waitFor(`document.querySelector('.drawing-help')?.textContent.includes('Experimental recognition')`));
  // Random puzzles may already contain every triangle; choose a usable fixture.
  for(let attempt=0;attempt<20;attempt++){
    const cs=await cells(),size=Math.sqrt(cs.length);
    if(cs.some((c,i)=>!c.clue&&hasCompletionAfterMove(boardFrom(cs),Math.floor(i/size),i%size,0)))break;
    await click('New Puzzle');
  }
  const initial=await cells(),n=Math.sqrt(initial.length),isTriangle=c=>/triangle/i.test(c.label);
  const valid=initial.findIndex((c,i)=>!c.clue&&hasCompletionAfterMove(boardFrom(initial),Math.floor(i/n),i%n,0)),invalid=initial.findIndex((c,i)=>!c.clue&&initial.some((d,j)=>isTriangle(d)&&(Math.floor(i/n)===Math.floor(j/n)||i%n===j%n))),editable=initial.findIndex(c=>!c.clue);
  await check('mouse does not ink',async()=>{await draw(editable,triangle,'mouse');assert.deepEqual(await cells(),initial);});
  await check('touch does not ink',async()=>{await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});const r=await rect(editable);await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(150);assert.deepEqual(await cells(),initial);});
  await check('clues immutable',async()=>{const i=initial.findIndex(c=>c.clue);await draw(i,triangle);assert.deepEqual((await cells())[i],initial[i]);});
  const preview=i=>`!!document.querySelectorAll('.grid>button')[${i}].querySelector('.recognition-overlay')`;
  await check('real CNN triangle preview and valid auto-placement',async()=>{assert.ok(valid>=0);await draw(valid,triangle);await waitFor(preview(valid));await waitFor(`document.querySelectorAll('.grid>button')[${valid}].getAttribute('aria-label').toLowerCase().startsWith('triangle')`);});
  await check('accepted ink crossfades to canonical icon',async()=>{
    await sleep(900);
    const styles=await evaluate(`(()=>{const b=document.querySelectorAll('.grid>button')[${valid}];return [getComputedStyle(b.querySelector('.ink-layer')).opacity,getComputedStyle(b.querySelector('.current-shape')).opacity]})()`);
    assert.deepEqual(styles,['0','1']);assert.ok((await cells())[valid].ink.length);
  });
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
  const sizes=[];for(const width of [320,390,768])await check('96px cell minimum and contained overflow '+width,async()=>{await cdp('Emulation.setDeviceMetricsOverride',{width,height:700,deviceScaleFactor:1,mobile:false});await sleep(100);const v=await evaluate(`(()=>{const s=document.querySelector('.board-scroll'),b=document.querySelector('.grid>button'),r=b.getBoundingClientRect();return {width:r.width,height:r.height,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,touch:getComputedStyle(b).touchAction};})()`);sizes.push({viewport:width,...v});assert.ok(v.width>=96&&v.height>=96);assert.equal(v.pageOverflow,false);assert.equal(v.touch,'none');assert.equal(await evaluate(`getComputedStyle(document.querySelector('.grid')).touchAction`),'none');assert.equal(await evaluate(`getComputedStyle(document.querySelector('.grid>button:disabled')).touchAction`),'none');});
  await check('real finger scroll without ink',async()=>{await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:false});await evaluate(`document.querySelector('.board-scroll').scrollIntoView({block:'center'});document.querySelector('.board-scroll').scrollLeft=0`);await sleep(100);const r=await evaluate(`(()=>{const r=document.querySelector('.board-scroll').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width}})()`),before=await cells(),x=r.x+r.width-20,y=Math.max(20,Math.min(650,r.y+60));await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let j=1;j<=10;j++){await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-j*14,y}]});await sleep(25);}await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(200);assert.ok(await evaluate(`document.querySelector('.board-scroll').scrollLeft>0`),'gesture must actually scroll');assert.deepEqual(await cells(),before);});
  await check('horizontal ownership locks axis and never hands off at boundary',async()=>{
    await evaluate(`document.documentElement.style.scrollBehavior='auto';document.querySelector('.board-scroll').scrollIntoView({block:'center'});document.querySelector('.board-scroll').scrollLeft=0`);await sleep(100);
    const r=await evaluate(`(()=>{const r=document.querySelector('.board-scroll').getBoundingClientRect();return {x:r.right-20,y:r.top+60}})()`);
    const snapshot=()=>evaluate(`[scrollX,scrollY,document.querySelector('.board-scroll').scrollLeft,document.querySelector('.board-scroll').scrollTop]`),before=await snapshot();
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});
    await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x-2,y:r.y-2}]});
    assert.deepEqual(await snapshot(),before,'sub-threshold jitter must not scroll');
    let previous=before[2];
    for(let j=1;j<=14;j++){
      await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x-j*16,y:r.y-(j%3)*2}]});
      const now=await snapshot();assert.deepEqual(now.slice(0,2),before.slice(0,2),'horizontal pan must not move page');assert.equal(now[3],before[3],'jitter must not pan vertically');assert.ok(now[2]>=previous,'board pan must be monotonic');previous=now[2];
    }
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(previous>before[2]);
  });
  await check('finger vertical gesture selects page without ink',async()=>{
    await evaluate(`document.querySelector('.board-scroll').scrollIntoView({block:'start'});window.scrollBy(0,-150)`);await sleep(100);
    const r=await evaluate(`(()=>{const r=document.querySelector('.grid').getBoundingClientRect();return {x:Math.max(40,r.x+30),y:r.y+80}})()`),before=await cells(),top=await evaluate('scrollY');
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});
    const boardLeft=await evaluate(`document.querySelector('.board-scroll').scrollLeft`);
    let previous=top;
    for(let j=1;j<=5;j++){
      await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+(j%2)*2,y:r.y-j*12}]});await sleep(40);
      const now=await evaluate('scrollY');assert.ok(now>=previous,'page pan must be monotonic');assert.equal(now,top+j*12,'page pan tracks absolute displacement');previous=now;
      assert.equal(await evaluate(`document.querySelector('.board-scroll').scrollLeft`),boardLeft);
    }
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await evaluate('scrollY')>top);assert.deepEqual(await cells(),before);
  });
  await check('finger cancellation and mode changes release capture',async()=>{
    const r=await rect(editable),p={x:r.x+r.width/2,y:r.y+r.height/2};
    await evaluate(`document.querySelector('.grid').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')window.fingerId=e.pointerId})`);
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-10,y:p.y}]});
    assert.equal(await evaluate(`document.querySelector('.grid').hasPointerCapture(window.fingerId)`),true);
    await cdp('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await evaluate(`document.querySelector('.grid').hasPointerCapture(window.fingerId)`),false);
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
    await click('Drawing mode');
    assert.equal(await evaluate(`document.querySelector('.grid').hasPointerCapture(window.fingerId)`),false);
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await click('Drawing mode');
  });
  await check('real pen retains capture without board or page pan; palm ignored',async()=>{
    const r=await rect(editable),x=r.x+r.width*.4,y=r.y+r.height*.4;
    await evaluate(`window.penEvents=[];document.querySelector('.grid').addEventListener('pointerdown',e=>{if(e.pointerType==='pen')window.penId=e.pointerId});document.querySelector('.grid').addEventListener('pointercancel',e=>window.penEvents.push(e.pointerType));window.scrollSnapshot=()=>[scrollX,scrollY,document.querySelector('.board-scroll').scrollLeft,document.querySelector('.board-scroll').scrollTop]`);
    const before=await evaluate('scrollSnapshot()');
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1,pointerType:'pen'});
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+25,y:y+30,button:'left',buttons:1,pointerType:'pen'});
    assert.equal(await evaluate(`document.querySelectorAll('.grid>button')[${editable}].hasPointerCapture(window.penId)`),true);
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30,y:y-30}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.deepEqual(await evaluate('scrollSnapshot()'),before);
    assert.equal(await evaluate(`document.querySelectorAll('.grid>button')[${editable}].hasPointerCapture(window.penId)`),true);
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+25,y:y+30,button:'left',buttons:0,clickCount:1,pointerType:'pen'});
    assert.deepEqual(await evaluate('scrollSnapshot()'),before);assert.deepEqual(await evaluate('penEvents'),[]);
    assert.ok((await cells())[editable].ink.length);await click('Reset');
  });
  for (const order of ['before','during','clue']) await check('palm lifetime rejection '+order,async()=>{
    const index=order==='clue'?initial.findIndex(c=>c.clue):editable;
    const r=await rect(index),x=r.x+r.width*.5,y=r.y+r.height*.5;
    const snapshot=()=>evaluate(`[scrollX,scrollY,document.querySelector('.board-scroll').scrollLeft,document.querySelector('.board-scroll').scrollTop]`);
    const touch=async(type,dx=0)=>cdp('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x-dx,y}]});
    const pen=async(type)=>cdp('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'pen'});
    if(order!=='during')await touch('touchStart');
    await pen('mousePressed');
    if(order==='during')await touch('touchStart');
    const before=await snapshot();
    await touch('touchMove',25);assert.deepEqual(await snapshot(),before,'palm cannot scroll during pen');
    await pen('mouseReleased');
    const ink=await cells();
    await touch('touchMove',55);assert.deepEqual(await snapshot(),before,'resting palm cannot resume after pen lift');
    await touch('touchEnd');assert.deepEqual(await cells(),ink,'palm cannot ink or place');
    await click('Reset');
  });
  await check('broad palm contact does not pan before pen',async()=>{
    const r=await rect(editable),x=r.x+r.width*.5,y=r.y+r.height*.5;
    const snapshot=()=>evaluate(`[scrollX,scrollY,document.querySelector('.board-scroll').scrollLeft]`),before=await snapshot();
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,radiusX:35,radiusY:30}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-50,y,radiusX:35,radiusY:30}]});
    await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual(await snapshot(),before);
  });
  const layoutMeasurements=[];
  for(const size of [4,8,9]) for(const width of [320,390,768,820,1024]) await check(`drawing bounds ${size}x${size} at ${width}`,async()=>{
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate(`(()=>{const s=document.querySelector('select[aria-label="Grid size"]');s.value='${size}';s.dispatchEvent(new Event('change',{bubbles:true}));document.documentElement.style.scrollBehavior='auto';})()`);
    await sleep(350);
    const measure=()=>evaluate(`(()=>{const s=document.querySelector('.board-scroll'),g=document.querySelector('.grid'),r=g.getBoundingClientRect(),sr=s.getBoundingClientRect(),cs=getComputedStyle(g);return {grid:[r.width,r.height],scroller:s.clientWidth,padding:cs.padding,border:cs.borderWidth,scrollLeft:s.scrollLeft,maxScroll:s.scrollWidth-s.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,cells:[...g.children].map(b=>{const c=b.getBoundingClientRect();return {width:c.width,height:c.height,left:c.left-r.left,right:c.right-r.left,top:c.top-r.top,bottom:c.bottom-r.top,visibleLeft:c.left-sr.left,visibleRight:c.right-sr.left};})};})()`);
    await evaluate(`document.querySelector('.board-scroll').scrollLeft=0`);
    const start=await measure();layoutMeasurements.push({size,viewport:width,...start});
    assert.equal(start.cells.length,size*size);assert.equal(start.pageOverflow,false);
    for(const c of start.cells){assert.ok(c.width>=96&&c.height>=96);assert.ok(c.left>=0&&c.top>=0&&c.right<=start.grid[0]&&c.bottom<=start.grid[1],JSON.stringify({size,width,grid:start.grid,cell:c,padding:start.padding}));}
    for(let row=0;row<size;row++){const c=start.cells[row*size];assert.ok(c.visibleLeft>=0&&c.visibleRight<=start.scroller);}
    await evaluate(`document.querySelector('.board-scroll').scrollLeft=1e6`);
    const end=await measure();
    for(let row=0;row<size;row++){const c=end.cells[row*size+size-1];assert.ok(c.visibleLeft>=0&&c.visibleRight<=end.scroller,'last column reachable');}
    // Reach the right edge using actual Chromium touch input, not scrollLeft.
    await evaluate(`document.querySelector('.board-scroll').scrollLeft=0;document.querySelector('.board-scroll').scrollIntoView({block:'start'});window.scrollBy(0,-120)`);
    const before=await cells();
    for(let swipe=0;swipe<12&&(await measure()).scrollLeft<start.maxScroll;swipe++){
      const p=await evaluate(`(()=>{const r=document.querySelector('.board-scroll').getBoundingClientRect();return {x:r.right-25,y:r.top+60}})()`);
      await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
      for(let j=1;j<=5;j++)await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-j*(start.scroller-50)/5,y:p.y}]});
      await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    const touched=await measure();assert.equal(touched.scrollLeft,start.maxScroll,'touch reaches right edge');assert.deepEqual(await cells(),before);
    const last=touched.cells.at(-1);assert.ok(last.visibleLeft>=0&&last.visibleRight<=touched.scroller);
  });
  await check('drawing uses available desktop width and respects theme padding',async()=>{
    await evaluate(`document.querySelector('.game-shell').style.setProperty('--space-sm','16px')`);
    await sleep(100);
    const v=await evaluate(`(()=>{const g=document.querySelector('.grid'),s=document.querySelector('.board-scroll'),r=g.getBoundingClientRect(),c=g.lastElementChild.getBoundingClientRect();return {grid:r.width,right:c.right-r.left,bottom:c.bottom-r.top,height:r.height,available:s.clientWidth}})()`);
    assert.ok(v.right<=v.grid&&v.bottom<=v.height,JSON.stringify(v));
    assert.ok(v.available>850,'large drawing board should use available desktop width');
  });
  await writeFile(out+'/layout.json',JSON.stringify(layoutMeasurements,null,2));
  const mobile=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(out+'/mobile.png',Buffer.from(mobile.data,'base64'));await check('no runtime errors',async()=>assert.deepEqual(errors,[]));await check('no uploads',async()=>assert.ok(requests.every(r=>r.method==='GET')));
  await writeFile(out+'/summary.json',JSON.stringify({results,sizes,initial,valid,invalid,errors},null,2));if(results.some(r=>!r.pass))process.exitCode=1;
}finally{socket?.close();const exited=new Promise(r=>browser.once('exit',r));browser.kill('SIGTERM');await exited;await new Promise(r=>server.close(r));await rm(profile,{recursive:true,force:true});}
