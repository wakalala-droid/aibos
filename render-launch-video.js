// Render the AI-BOS Launch Video (offline bundle) to a 4K mp4.
//
// The animation is a React timeline framework. The exportable surface is the
// <svg data-om-exportable-video-with-duration-secs> which is intrinsically
// 3840x2160 (1920x1080 authored * EXPORT_SCALE 2). Frames are driven by the
// framework's own export protocol: dispatch a `data-om-seek-to-time-frame`
// CustomEvent (detail.time in wall-clock seconds) on that svg; the Stage pauses
// and sets the timeline to that instant. We then screenshot the svg at scale=1
// (native 4K) using the real compositor and pipe PNGs into ffmpeg.
//
// Usage:
//   node render-launch-video.js probe          -> writes a few sample PNGs
//   node render-launch-video.js render          -> full mp4 via ffmpeg pipe

const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const MODE = process.argv[2] || 'probe';
const SRC = 'C:/Users/User/Downloads/AI-BOS Launch Video (offline).html';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const FFMPEG = 'C:/ffmpeg/bin/ffmpeg.exe'; // DLLs colocated here; root copy is broken
const OUTDIR = path.resolve(__dirname, '..');
const SCRATCH = process.env.RV_SCRATCH ||
  'C:/Users/User/AppData/Local/Temp/claude/C--Users-User-Desktop-AI-BOS-V2/3325ab20-7d7a-41d5-8290-927579d30b05/scratchpad/render';

const W = 3840, H = 2160, FPS = 60;
const SETTLE_RAFS = 3;       // rAFs to wait after a seek for React commit + paint
const fileUrl = 'file:///' + SRC.replace(/ /g, '%20');

function log(...a) { console.log('[render]', ...a); }

const DEBUG_PORT = 9333;
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function waitForEndpoint(port, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const v = await getJson(`http://127.0.0.1:${port}/json/version`); if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Edge debug endpoint never came up');
}

async function boot() {
  // Spawn Edge ourselves (puppeteer's launch handshake fails on this Edge build —
  // it hands off and exits 0). Connect over the DevTools websocket instead.
  const profile = (process.env.RV_SCRATCH || SCRATCH) + '/edge-profile';
  fs.mkdirSync(profile, { recursive: true });
  const edge = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--disable-features=CalculateNativeWinOcclusion',
    `--window-size=${W + 16},${H + 120}`,
    'about:blank',
  ], { stdio: 'ignore', detached: false });
  edge.on('error', (e) => log('edge spawn error', e.message));

  const wsUrl = await waitForEndpoint(DEBUG_PORT);
  log('connected to Edge', wsUrl);
  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  browser.__edgeProc = edge;
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.setViewport({ width: W, height: H + 60, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('console.error', m.text()); });

  log('loading', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'load', timeout: 120000 });

  // Wait for the bundler to unpack, React to mount, and the exportable svg to
  // appear at native size with scale==1 (viewport big enough to show it 1:1).
  await page.waitForSelector('svg[data-om-exportable-video-with-duration-secs]', { timeout: 120000 });
  await page.waitForFunction(() => {
    const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
    if (!svg) return false;
    const w = svg.getBoundingClientRect().width;
    // scale==1 means rendered width ~= intrinsic width attribute
    return Math.abs(w - svg.width.baseVal.value) < 2;
  }, { timeout: 120000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);

  const wallDuration = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
    return parseFloat(svg.getAttribute('data-om-exportable-video-with-duration-secs'));
  });
  log('wallDuration =', wallDuration, 's ; export will be', Math.round(wallDuration * FPS), 'frames @', FPS, 'fps');
  return { browser, page, wallDuration };
}

// Seek to wall-clock `t` seconds and wait for the frame to settle.
async function seek(page, t, rafs = SETTLE_RAFS) {
  await page.evaluate(async (t, rafs) => {
    const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
    svg.dispatchEvent(new CustomEvent('data-om-seek-to-time-frame', { detail: { time: t } }));
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    for (let i = 0; i < rafs; i++) await raf();
    if (document.fonts && document.fonts.status !== 'loaded') { try { await document.fonts.ready; } catch {} }
  }, t, rafs);
}

async function shot(page) {
  const svg = await page.$('svg[data-om-exportable-video-with-duration-secs]');
  const buf = await svg.screenshot({ type: 'png', captureBeyondViewport: false });
  await svg.dispose();
  return buf;
}

async function probe() {
  const { browser, page, wallDuration } = await boot();
  const samples = [0, 0.5, Math.min(2, wallDuration), wallDuration / 2, wallDuration - 0.05];
  fs.mkdirSync(SCRATCH + '/probe', { recursive: true });
  let i = 0;
  for (const t of samples) {
    await seek(page, t, 4);
    const buf = await shot(page);
    // crude blackness check: sample average byte value of PNG is meaningless;
    // instead decode pixel stats via canvas in-page.
    const stats = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-om-exportable-video-with-duration-secs]');
      const r = svg.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    const f = `${SCRATCH}/probe/frame_${String(i).padStart(2,'0')}_t${t.toFixed(2)}.png`;
    fs.writeFileSync(f, buf);
    log('probe', f, buf.length, 'bytes', JSON.stringify(stats));
    i++;
  }
  try { await browser.close(); } catch {}
  try { browser.__edgeProc && browser.__edgeProc.kill(); } catch {}
  log('probe done');
}

const FRAMES_DIR = (process.env.RV_SCRATCH || SCRATCH) + '/frames';
const PROGRESS = (process.env.RV_SCRATCH || SCRATCH) + '/progress.json';
const framePath = (i) => `${FRAMES_DIR}/frame_${String(i).padStart(6, '0')}.png`;
const OUT = path.join(OUTDIR, 'AI-BOS Launch Video 4K.mp4');

function writeProgress(o) { try { fs.writeFileSync(PROGRESS, JSON.stringify(o)); } catch {} }

// Capture all frames to disk. Resumable: any frame_*.png already on disk and
// non-empty is skipped, so an interrupted run continues where it left off.
async function capture() {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const { browser, page, wallDuration } = await boot();
  const nFrames = Math.round(wallDuration * FPS);
  const t0 = Date.now();
  let done = 0;
  for (let i = 0; i < nFrames; i++) {
    const fp = framePath(i);
    let st = null; try { st = fs.statSync(fp); } catch {}
    if (st && st.size > 1024) { done++; continue; } // already captured
    await seek(page, i / FPS);
    const buf = await shot(page);
    fs.writeFileSync(fp, buf);
    done++;
    if (i % 30 === 0 || i === nFrames - 1) {
      const el = (Date.now() - t0) / 1000;
      const newDone = done; // approximate rate on freshly captured
      const rate = newDone / el;
      const eta = (nFrames - done) / (rate || 1);
      log(`frame ${done}/${nFrames}  ${(100 * done / nFrames).toFixed(1)}%  ${rate.toFixed(2)} fps  ETA ${Math.round(eta)}s`);
      writeProgress({ phase: 'capture', done, nFrames, pct: +(100 * done / nFrames).toFixed(1), etaSec: Math.round(eta), ts: Date.now() });
    }
  }
  try { await browser.close(); } catch {}
  try { browser.__edgeProc && browser.__edgeProc.kill(); } catch {}
  writeProgress({ phase: 'captured', done: nFrames, nFrames, pct: 100, ts: Date.now() });
  log('capture complete:', nFrames, 'frames in', FRAMES_DIR);
  return nFrames;
}

// Encode the on-disk PNG sequence to a 4K H.264 mp4.
async function encode() {
  log('encoding ->', OUT);
  writeProgress({ phase: 'encode', ts: Date.now() });
  await new Promise((res, rej) => {
    const ff = spawn(FFMPEG, [
      '-y',
      '-framerate', String(FPS),
      '-i', `${FRAMES_DIR}/frame_%06d.png`,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '17',
      '-preset', 'medium',
      '-profile:v', 'high',
      '-level', '5.1',
      '-movflags', '+faststart',
      '-r', String(FPS),
      OUT,
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
    ff.on('error', rej);
    ff.on('close', (c) => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)));
  });
  writeProgress({ phase: 'done', out: OUT, ts: Date.now() });
  log('DONE ->', OUT);
}

async function render() { await capture(); await encode(); }

const run = MODE === 'capture' ? capture
  : MODE === 'encode' ? encode
  : MODE === 'render' ? render
  : probe;
run().catch((e) => { console.error(e); writeProgress({ phase: 'error', error: String(e && e.message || e), ts: Date.now() }); process.exit(1); });
