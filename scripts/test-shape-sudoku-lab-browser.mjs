// Run after npm run build. Optional URL argument tests a deployed Astro route.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, extname } from 'node:path';
import { canonicalPoints } from '../src/lib/shape-sudoku-lab/shapes.js';

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
