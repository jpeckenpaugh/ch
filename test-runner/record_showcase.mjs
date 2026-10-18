import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const POC_ROOT = path.join(REPO_ROOT, 'poc-browser');
const DEMOS_DIR = path.join(REPO_ROOT, 'demos/latest');
const GALLERY_DIR = path.join(DEMOS_DIR, 'gallery');

// 1. Locate Playwright
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const sm3Playwright = path.resolve(REPO_ROOT, '../sm3/node_modules/playwright/index.mjs');
  if (fs.existsSync(sm3Playwright)) {
    ({ chromium } = await import(sm3Playwright));
  } else {
    throw new Error('Playwright not found in environment or ../sm3/node_modules/playwright');
  }
}

// 2. Locate FFmpeg
function getFFmpegPath() {
  const msPlaywrightFFmpeg = path.resolve(process.env.HOME, 'Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac');
  if (fs.existsSync(msPlaywrightFFmpeg)) return msPlaywrightFFmpeg;
  try {
    const whichOut = spawn('which', ['ffmpeg'], { encoding: 'utf8' });
    if (whichOut && whichOut.stdout) return whichOut.stdout.trim();
  } catch (_) {}
  return null;
}

// 3. Local HTTP Server for poc-browser
function startLocalServer(port = 8792) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.db': 'application/octet-stream',
    '.sqlite': 'application/octet-stream',
    '.sqlite3': 'application/octet-stream',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    let filePath = path.join(POC_ROOT, reqPath === '/' ? 'index.html' : reqPath);
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`[HTTP] Serving Company Hub POC on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

// 4. Interactive Cursor Helper
async function injectCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.style.position = 'fixed';
    c.style.top = '0';
    c.style.left = '0';
    c.style.width = '18px';
    c.style.height = '18px';
    c.style.borderRadius = '50%';
    c.style.backgroundColor = 'rgba(13, 110, 253, 0.75)';
    c.style.border = '2px solid #ffffff';
    c.style.boxShadow = '0 0 12px rgba(13, 110, 253, 0.9)';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '9999999';
    c.style.transform = 'translate(-50%, -50%)';
    c.style.transition = 'width 0.12s ease, height 0.12s ease, background-color 0.12s ease';
    document.body.appendChild(c);
    window.__setCursor = (x, y) => {
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    };
  });
}

async function smoothMove(page, targetX, targetY, steps = 15, delayMs = 12) {
  await page.mouse.move(targetX, targetY, { steps });
  await page.evaluate(({ x, y }) => window.__setCursor?.(x, y), { x: targetX, y: targetY });
  if (delayMs > 0) await page.waitForTimeout(delayMs);
}

async function clickAt(page, targetX, targetY) {
  await smoothMove(page, targetX, targetY);
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) {
      c.style.width = '12px';
      c.style.height = '12px';
      c.style.backgroundColor = 'rgba(10, 88, 202, 0.95)';
    }
  });
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) {
      c.style.width = '18px';
      c.style.height = '18px';
      c.style.backgroundColor = 'rgba(13, 110, 253, 0.75)';
    }
  });
  await page.waitForTimeout(100);
}

async function clickSelector(page, selector) {
  const el = await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
  const box = await el.boundingBox();
  if (box) {
    await clickAt(page, box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await el.click();
  }
}

// 5. Generate WebP Thumbnail
async function generateWebPThumbnail(browser, pngPath, outWebPPath) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    const pngBase64 = fs.readFileSync(pngPath).toString('base64');
    const dataUri = `data:image/png;base64,${pngBase64}`;

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body style="margin:0; background:#0f172a; display:flex; align-items:center; justify-content:center;">
        <canvas id="c" width="640" height="360" style="width:640px; height:360px;"></canvas>
      </body>
      </html>
    `);

    await page.evaluate(async (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.getElementById('c');
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, 640, 360);
          resolve();
        };
        img.src = src;
      });
    }, dataUri);

    const dataUrl = await page.evaluate(() => {
      const c = document.getElementById('c');
      return c.toDataURL('image/webp', 0.88);
    });

    const base64Data = dataUrl.replace(/^data:image\/webp;base64,/, '');
    fs.writeFileSync(outWebPPath, Buffer.from(base64Data, 'base64'));
    console.log(`[Thumbnail] Saved WebP thumbnail (${fs.statSync(outWebPPath).size} bytes) -> ${outWebPPath}`);
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
  const tempVideoDir = fs.mkdtempSync(path.join(REPO_ROOT, 'tmp-video-'));
  const ffmpegBin = getFFmpegPath();

  console.log(`[Setup] FFmpeg: ${ffmpegBin || 'NOT FOUND (will use raw WebM)'}`);
  console.log(`[Setup] Temp video dir: ${tempVideoDir}`);

  const server = await startLocalServer(8792);
  const BASE_URL = 'http://127.0.0.1:8792/#/';

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--enable-features=Vulkan'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    console.log(`[Playwright] Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await injectCursor(page);

    // ==========================================
    // STILL 1: 01-companies-directory.png
    // ==========================================
    console.log('[Gallery] Capturing 01-companies-directory.png...');
    await smoothMove(page, 300, 140);
    await page.screenshot({ path: path.join(GALLERY_DIR, '01-companies-directory.png') });
    console.log('Saved 01-companies-directory.png');

    // Video Beat 1: Search & Filter interaction (0s - 6s)
    await clickSelector(page, '#company-search');
    await page.keyboard.type('Toyo', { delay: 120 });
    await page.waitForTimeout(600);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(400);

    // Country filter dropdown interaction
    const filterBtn = await page.$('#country-filter-slot button');
    if (filterBtn) {
      const box = await filterBtn.boundingBox();
      if (box) {
        await clickAt(page, box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(600);
        // Click off dropdown
        await clickAt(page, 200, 200);
        await page.waitForTimeout(400);
      }
    }

    // Video Beat 2: Click on Toyota Motor (6s - 12s)
    console.log('[Beat] Opening Toyota Motor Profile...');
    await clickSelector(page, 'a[href="#/companies/1"]');
    await page.waitForTimeout(1000);
    await injectCursor(page);

    // ==========================================
    // STILL 2: 02-company-profile-overview.png
    // ==========================================
    console.log('[Gallery] Capturing 02-company-profile-overview.png...');
    await smoothMove(page, 450, 260);
    await page.screenshot({ path: path.join(GALLERY_DIR, '02-company-profile-overview.png') });
    console.log('Saved 02-company-profile-overview.png');

    // Scroll to Locations & References
    await page.mouse.wheel(0, 320);
    await page.waitForTimeout(800);

    // ==========================================
    // STILL 3: 03-company-intel-news.png
    // ==========================================
    console.log('[Gallery] Capturing 03-company-intel-news.png...');
    await smoothMove(page, 550, 380);
    await page.screenshot({ path: path.join(GALLERY_DIR, '03-company-intel-news.png') });
    console.log('Saved 03-company-intel-news.png');

    // Video Beat 3: Company Edit Form (12s - 17s)
    console.log('[Beat] Navigating to edit company form...');
    await page.mouse.wheel(0, -320);
    await page.waitForTimeout(400);
    await clickSelector(page, 'a[href="#/companies/1/edit"]');
    await page.waitForTimeout(1000);
    await injectCursor(page);

    // ==========================================
    // STILL 4: 04-company-editor.png
    // ==========================================
    console.log('[Gallery] Capturing 04-company-editor.png...');
    await smoothMove(page, 620, 250);
    await page.screenshot({ path: path.join(GALLERY_DIR, '04-company-editor.png') });
    console.log('Saved 04-company-editor.png');

    // Video Beat 4: Industries Taxonomy (17s - 22s)
    console.log('[Beat] Navigating to Industries taxonomy...');
    await clickSelector(page, '#nav-industries');
    await page.waitForTimeout(1000);
    await injectCursor(page);

    // ==========================================
    // STILL 5: 05-controlled-industries.png
    // ==========================================
    console.log('[Gallery] Capturing 05-controlled-industries.png...');
    await smoothMove(page, 240, 180);
    await page.screenshot({ path: path.join(GALLERY_DIR, '05-controlled-industries.png') });
    console.log('Saved 05-controlled-industries.png');

    // Type in new industry field
    await clickSelector(page, '#new-industry-name');
    await page.keyboard.type('Aerospace & Defense', { delay: 60 });
    await page.waitForTimeout(600);

    // Video Beat 5: News Ranking Benchmark (22s - 27s)
    console.log('[Beat] Navigating to News Ranking benchmark...');
    await clickSelector(page, '#nav-news-ranking');
    await page.waitForTimeout(1000);
    await injectCursor(page);

    // Run deterministic baseline
    await clickSelector(page, '#run-baseline');
    await page.waitForTimeout(1000);

    // ==========================================
    // STILL 6: 06-ai-news-ranking-benchmark.png
    // ==========================================
    console.log('[Gallery] Capturing 06-ai-news-ranking-benchmark.png...');
    await smoothMove(page, 500, 360);
    await page.screenshot({ path: path.join(GALLERY_DIR, '06-ai-news-ranking-benchmark.png') });
    console.log('Saved 06-ai-news-ranking-benchmark.png');

    // Video Beat 6: Workspace & Storage Overview (27s - 30.5s)
    console.log('[Beat] Navigating to Workspace storage dashboard...');
    await clickSelector(page, '#nav-workspace');
    await page.waitForTimeout(800);
    await injectCursor(page);
    await smoothMove(page, 640, 280);

    // Hold exact 30.5s
    const elapsed = Date.now() - startTime;
    const remainingMs = Math.max(0, 30500 - elapsed);
    if (remainingMs > 0) {
      console.log(`[Hold] Holding final steady state for ${(remainingMs / 1000).toFixed(1)}s to reach 30.5s...`);
      await page.waitForTimeout(remainingMs);
    }
  } finally {
    const videoObj = page.video();
    await context.close();
    await browser.close();
    server.close();

    const rawVideoPath = await videoObj.path();
    console.log(`[Video] Raw recording saved at: ${rawVideoPath}`);

    const finalWebM = path.join(DEMOS_DIR, 'demo.webm');
    if (ffmpegBin) {
      console.log(`[FFmpeg] Transcoding video with VP9 to exact 30.5s duration...`);
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegBin, [
          '-y',
          '-i', rawVideoPath,
          '-t', '30.5',
          '-c:v', 'libvpx-vp9',
          '-b:v', '750k',
          '-crf', '32',
          '-an',
          finalWebM,
        ], { stdio: 'inherit' });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}`));
        });
      });
    } else {
      console.log(`[Video] Moving raw WebM to ${finalWebM}...`);
      fs.copyFileSync(rawVideoPath, finalWebM);
    }

    try {
      fs.rmSync(tempVideoDir, { recursive: true, force: true });
    } catch (_) {}

    // Generate WebP thumbnail from Still 2 (Company Profile Dossier)
    const helperBrowser = await chromium.launch({ headless: true });
    try {
      const sourceStill = path.join(GALLERY_DIR, '02-company-profile-overview.png');
      const cardThumbWebP = path.join(DEMOS_DIR, 'thumb.webp');
      await generateWebPThumbnail(helperBrowser, sourceStill, cardThumbWebP);

      // Copy thumbnail into netfix / beta-livive-net / livive-net
      const chThumbInRepo = path.join(REPO_ROOT, 'thumbnails/company-hub.webp');
      fs.mkdirSync(path.dirname(chThumbInRepo), { recursive: true });
      fs.copyFileSync(cardThumbWebP, chThumbInRepo);

      const netfixThumb = path.resolve(REPO_ROOT, '../thumbnails/company-hub.webp');
      const betaThumb = path.resolve(REPO_ROOT, '../beta-livive-net/thumbnails/company-hub.webp');
      const liviveThumb = path.resolve(REPO_ROOT, '../livive-net/thumbnails/company-hub.webp');

      for (const tPath of [netfixThumb, betaThumb, liviveThumb]) {
        if (fs.existsSync(path.dirname(tPath))) {
          fs.copyFileSync(cardThumbWebP, tPath);
          console.log(`[Thumbnail] Copied to ${tPath}`);
        }
      }
    } finally {
      await helperBrowser.close();
    }

    console.log('[SUCCESS] All Company Hub showcase assets captured!');
    console.log(`  - Video: ${finalWebM} (${fs.statSync(finalWebM).size} bytes)`);
    for (const f of fs.readdirSync(GALLERY_DIR).sort()) {
      const p = path.join(GALLERY_DIR, f);
      console.log(`  - Gallery: ${f} (${fs.statSync(p).size} bytes)`);
    }
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
