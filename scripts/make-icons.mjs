// Renders public/icons/*.png from the logo mark using headless Chrome (no image dependencies).
// Usage: node scripts/make-icons.mjs   (Chrome path: CHROME env var or the Windows default)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outDir = new URL('../public/icons/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);

// scale is the fraction of the canvas the mark occupies; maskable icons keep it inside the safe zone.
const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.68 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
];

const markup = (
  size,
  scale,
) => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#05060a}
svg{display:block;width:${size}px;height:${size}px}</style>
<svg viewBox="0 0 512 512"><defs><radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#1a1d3a"/><stop offset="1" stop-color="#05060a"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#g)"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
<circle cx="256" cy="256" r="150" fill="none" stroke="#ffc15a" stroke-width="30"/><circle cx="256" cy="256" r="62" fill="#ffc15a"/></g></svg>`;

const port = 9800 + Math.floor(Math.random() * 100);
const ch = spawn(
  chrome,
  [
    '--headless=new',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(tmpdir() + '/icons-')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
await new Promise((r) => setTimeout(r, 2200));
const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m.result);
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await send('Page.enable');
for (const t of TARGETS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: t.size,
    height: t.size,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const { frameTree } = await send('Page.getFrameTree');
  await send('Page.setDocumentContent', {
    frameId: frameTree.frame.id,
    html: markup(t.size, t.scale),
  });
  await new Promise((r) => setTimeout(r, 300));
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: t.size, height: t.size, scale: 1 },
  });
  writeFileSync(outDir + t.file, Buffer.from(shot.data, 'base64'));
  console.log('wrote', t.file);
}
ws.close();
ch.kill();
process.exit(0);
