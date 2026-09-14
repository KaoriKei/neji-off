// ヘッドレス Chrome を CDP で遠隔操作して NEJI OFF を自動プレイし、スクショを撮る
// 使い方: npm run preview を起動した状態で
//   npx tsx scripts/solution.ts 7 > /tmp/sol7.json && node scripts/autoplay.mjs 7 /tmp/shots7 solve /tmp/sol7.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [,, levelArg = '1', outDir = './shots', mode = 'solve', solPath] = process.argv;
const level = Number(levelArg);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const W = 540, H = 960, SCALE = 0.5;
fs.mkdirSync(outDir, { recursive: true });

const sol = JSON.parse(fs.readFileSync(solPath, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--user-data-dir=/tmp/neji-chrome-cdp', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required',
  'about:blank',
], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map(); const logs = [];
try {
  let targets = null;
  for (let i = 0; i < 30 && !targets; i++) {
    await sleep(300);
    try { targets = await (await fetch(`http://localhost:${PORT}/json`)).json(); } catch {}
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`[console.${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') logs.push(`[EXCEPTION] ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ''}`);
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(r.result.data, 'base64'));
  };
  const tap = async (x, y) => {
    const sx = x * SCALE, sy = y * SCALE;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sx, y: sy });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sx, y: sy, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sx, y: sy, button: 'left', clickCount: 1 });
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `http://localhost:4173/?level=${level}` });
  await sleep(3500);
  await shot('00-start');

  if (mode === 'solve') {
    if (sol.covered) {
      await tap(sol.covered.x, sol.covered.y);
      await sleep(110);
      await shot('01-covered-tap');
      await sleep(500);
    }
    const moves = sol.moves;
    for (let i = 0; i < moves.length; i++) {
      await tap(moves[i].x, moves[i].y);
      if (i === 0) { await sleep(230); await shot('02-flying'); }
      if (i === 2) { await sleep(120); await shot('03-mid'); }
      await sleep(650);
      if (i === Math.floor(moves.length / 2)) await shot('04-half');
    }
    await sleep(1800);
    await shot('09-end');
  } else {
    const moves = sol.stuck ?? [];
    for (let i = 0; i < moves.length; i++) {
      await tap(moves[i].x, moves[i].y);
      await sleep(650);
    }
    await sleep(600);
    await shot('05-stuck');
    // 満杯タップの反応
    const any = sol.moves.find((m) => !moves.some((s) => s.id === m.id));
    if (any) { await tap(any.x, any.y); await sleep(100); await shot('06-full-tap'); }
    // リトライ
    await tap(540, 1790);
    await sleep(700);
    await shot('07-after-retry');
  }
} finally {
  fs.writeFileSync(path.join(outDir, 'console.log'), logs.join('\n') + '\n');
  try { ws?.close(); } catch {}
  chrome.kill('SIGKILL');
}
console.log('done', outDir, 'logs:', logs.length);
