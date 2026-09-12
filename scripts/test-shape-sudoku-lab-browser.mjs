// Run after npm run build. Optional URL argument tests a deployed Astro route.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname } from 'node:path';
import { canonicalPoints } from '../src/lib/shape-sudoku-lab/shapes.js';
import { drawingFixtures, negativeFixtures } from '../src/lib/shape-sudoku-lab/drawing-fixtures.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
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
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  const url = process.argv[2] || `http://127.0.0.1:${server.address().port}/shape-sudoku-lab/`;
  await cdp('Page.navigate', { url });
  for (let i = 0; i < 100; i++) { if (await evaluate('document.querySelectorAll(".board .tile").length === 9')) break; await sleep(100); }
  const styles = await evaluate(`(() => {
    const tile = document.querySelector('.board .tile'), canvas = tile.querySelector('canvas'), overlay = tile.querySelector('.overlay');
    const t = getComputedStyle(tile), c = getComputedStyle(canvas), o = getComputedStyle(overlay), r = tile.getBoundingClientRect();
    return { count: document.querySelectorAll('.board .tile').length, position: t.position, touch: t.touchAction, width: r.width, height: r.height, canvasPosition: c.position, canvasTouch: c.touchAction, overlayPosition: o.position, overlayOpacity: o.opacity, boardTouch: getComputedStyle(document.querySelector('.board')).touchAction, shellTouch: getComputedStyle(document.querySelector('.lab-shell')).touchAction };
  })()`);
  console.log(url, styles);
  assert.equal(styles.count, 9);
  assert.equal(styles.position, 'relative');
  assert.equal(styles.touch, 'none');
  assert.equal(styles.width, styles.height);
  assert.ok(styles.width >= 92 && styles.width <= 96);
  assert.equal(styles.canvasPosition, 'absolute');
  assert.equal(styles.canvasTouch, 'none');
  assert.equal(styles.overlayPosition, 'absolute');
  assert.equal(styles.overlayOpacity, '0');
  assert.equal(styles.boardTouch, 'pan-x pan-y');
  assert.equal(styles.shellTouch, 'auto');
  const rect = await evaluate(`(() => { const r = document.querySelector('.tile canvas').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
  const points = canonicalPoints('triangle', 64).map(([x, y]) => ({ x: rect.x + x * rect.width / 100, y: rect.y + y * rect.height / 100 }));
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...points[0], button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  for (const point of points.slice(1)) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'left', buttons: 1, pointerType: 'pen' });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.at(-1), button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
  await sleep(1000);
  const recognized = await evaluate(`(() => { const tile = document.querySelector('.tile'), o = tile.querySelector('.overlay'); const r = o.getBoundingClientRect(), t = tile.getBoundingClientRect(); return { label: tile.querySelector('.label').textContent, opacity: getComputedStyle(o).opacity, shape: !!o.querySelector('polygon'), inside: r.x >= t.x && r.y >= t.y && r.right <= t.right && r.bottom <= t.bottom, width: r.width, height: r.height }; })()`);
  console.log('Pen drawing result:', recognized);
  assert.equal(recognized.label, 'triangle');
  assert.equal(recognized.opacity, '0.45');
  assert.equal(recognized.shape, true);
  assert.equal(recognized.inside, true);
  assert.ok(recognized.width > 0 && recognized.height > 0);
  // CDP has no pen-cancel command: cancel a real in-progress pen stroke at the DOM boundary.
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...points[0], button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  for (const point of points.slice(1)) await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point, button: 'left', buttons: 1, pointerType: 'pen' });
  await evaluate(`document.querySelector('.tile canvas').dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'pen', pointerId: 1, bubbles: true }))`);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.at(-1), button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
  await sleep(1000);
  assert.equal(await evaluate(`document.querySelector('.tile .label').textContent`), 'triangle');
  await evaluate(`[...document.querySelectorAll('.controls button')].find(b => b.textContent === 'Undo').click()`);
  await sleep(50);
  assert.equal(await evaluate(`document.querySelector('.tile .label').textContent`), 'draw a shape', 'cancel must not add an undo entry or commit ink');
  assert.equal(await evaluate(`[...document.querySelectorAll('.controls button')].find(b => b.textContent === 'Undo').disabled`), true);
  console.log('PASS: cancelled pen stroke restores prior overlay without committing ink or undo history');
  // Replay authored synthetic paths through the actual Astro island's pen input.
  // This is Chromium/CDP, not physical iPad/Pencil validation.
  const fixtureResults = [];
  for (const fixture of [...drawingFixtures, ...negativeFixtures]) {
    await evaluate(`[...document.querySelectorAll('.controls button')].find(b => b.textContent === 'Clear tile').click()`);
    for (const stroke of fixture.strokes) {
      const ps = stroke.map(([x,y]) => ({x:rect.x+x*rect.width/100, y:rect.y+y*rect.height/100}));
      await cdp('Input.dispatchMouseEvent', {type:'mousePressed', ...ps[0], button:'left', buttons:1, clickCount:1, pointerType:'pen'});
      for (const p of ps.slice(1,-1)) await cdp('Input.dispatchMouseEvent', {type:'mouseMoved', ...p, button:'left', buttons:1, pointerType:'pen'});
      assert.equal(await evaluate(`document.querySelector('.tile .overlay').classList.contains('visible')`), false, 'no mid-stroke guess');
      await cdp('Input.dispatchMouseEvent', {type:'mouseReleased', ...ps.at(-1), button:'left', buttons:0, clickCount:1, pointerType:'pen'});
      // Real pen lifts, including a pause long enough to evaluate incomplete ink.
      if (fixture.id === 'separate-square-sides') await sleep(850);
    }
    const inkBefore = await evaluate(`document.querySelector('.tile canvas').toDataURL()`);
    await sleep(900);
    const result = await evaluate(`({label:document.querySelector('.tile .label').textContent, visible:document.querySelector('.tile .overlay').classList.contains('visible'), ink:document.querySelector('.tile canvas').toDataURL()})`);
    assert.equal(result.label, fixture.name || 'uncertain - keep drawing', fixture.id);
    assert.equal(result.visible, !!fixture.name, fixture.id);
    assert.equal(result.ink, inkBefore, fixture.id + ': recognition must preserve ink');
    fixtureResults.push({id:fixture.id, label:result.label, inkPreserved:true});
  }
  console.log('Synthetic pen fixture results:', JSON.stringify(fixtureResults));
  console.log(`PASS: ${fixtureResults.length} authored pen fixtures, including quick/imperfect/multistroke and uncertainty; no mid-stroke guesses; ink preserved`);
  // Explicit download: read the actual file Chromium saved, not a mocked payload.
  await cdp('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:profile});
  await evaluate(`(() => { const details = document.querySelector('.diagnostics'); details.open = true; const input = details.querySelector('input'); input.value = 'synthetic oval'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await evaluate(`document.querySelector('.diagnostics button').click()`);
  let exported;
  for (let i=0;i<50;i++) { try { exported=JSON.parse(await readFile(resolve(profile,'shape-sudoku-attempts.json'),'utf8')); break; } catch { await sleep(100); } }
  assert.ok(exported, 'actual JSON download must complete');
  assert.match(exported.buildVersion, /^[a-f0-9]{40}$/);
  assert.equal(exported.attempts.at(-1).intendedShape, 'synthetic oval');
  assert.equal(exported.attempts.at(-1).result.name, null);
  assert.ok(exported.attempts.at(-1).result.rejectionReasons.length);
  assert.equal(exported.attempts.at(-1).result.rankedDistances.length, 9);
  assert.ok(exported.attempts.at(-1).strokes[0].length > 20);
  assert.ok(exported.attempts.some(a => a.kind === 'pointer-cancel'));
  console.log('PASS: actual local JSON download with strokes, ranked scores, rejection reasons, annotation, build', exported.buildVersion);
  // Synthetic multi-tile retry: clear must target the last drawn tile, cancel its timer.
  await evaluate(`(() => { const canvas = document.querySelectorAll('.tile canvas')[1], r=canvas.getBoundingClientRect(); for (const [type,x,y] of [['pointerdown',20,20],['pointermove',80,20],['pointerup',80,80]]) canvas.dispatchEvent(new PointerEvent(type,{pointerType:'pen',pointerId:7,clientX:r.x+x*r.width/100,clientY:r.y+y*r.height/100,bubbles:true})); [...document.querySelectorAll('.controls button')].find(b=>b.textContent==='Clear tile').click(); })()`);
  await sleep(900);
  assert.equal(await evaluate(`document.querySelectorAll('.tile .label')[1].textContent`), 'draw a shape');
  assert.equal(await evaluate(`document.querySelector('.tile .label').textContent`), 'uncertain - keep drawing');
  console.log('PASS: clear targets last drawn tile and cancels pending recognition');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  const desktop = await evaluate(`(() => { const r = document.querySelector('.tile').getBoundingClientRect(); return { width: r.width, height: r.height }; })()`);
  assert.equal(desktop.width, desktop.height);
  assert.ok(desktop.width >= 112 && desktop.width <= 116);
  console.log('PASS: built Astro route layout, tile-only touch capture, pen recognition and visible bounded overlay; desktop:', desktop);
} finally {
  socket?.close();
  const exited = new Promise(r => browser.once('exit', r));
  browser.kill('SIGTERM');
  await exited;
  await new Promise(r => server.close(r));
  await rm(profile, { recursive: true, force: true });
}
