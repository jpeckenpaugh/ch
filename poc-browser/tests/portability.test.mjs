import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from '../../tests/browser/cdp.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const url = 'http://127.0.0.1:8011/index.html';
const cdpUrl = 'http://127.0.0.1:9231';
const chromePath = process.env.COMPANY_HUB_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const children = new Set();
const results = [];
let profile;
let browser;
let cdp;

async function requireFreePort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', error => reject(new Error(error.code === 'EADDRINUSE' ? `Port ${port} is occupied; refusing to use or stop another process.` : `Cannot check port ${port}: ${error.code}: ${error.message}`)));
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise(resolve => server.close(resolve));
}
function start(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.on('error', error => { output += error.message; });
  child.on('exit', () => children.delete(child));
  child.output = () => output;
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
}
async function waitServer(server) {
  for (let count = 0; count < 80; count++) {
    if (server.exitCode !== null) throw new Error(`Static server exited: ${server.output()}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Static server did not serve probe: ${server.output()}`);
}
async function launchBrowser() {
  await requireFreePort(9231);
  browser = start(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9231', `--user-data-dir=${profile}`, 'about:blank']);
  cdp = await connect(cdpUrl);
  await loadProbe();
}
async function loadProbe() {
  await cdp.evalJs('window.appReady = undefined');
  await cdp.navigate(url);
  assert.equal(await cdp.waitFor('Boolean(window.appReady)', 20000), true, 'probe facade loaded');
  await cdp.evalJs('window.appReady');
}
async function check(name, action) {
  await action();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
try {
  await requireFreePort(8011); await requireFreePort(9231);
  profile = await mkdtemp(path.join(tmpdir(), 'company-hub-portability-'));
  const server = start(path.join(root, '.venv/bin/python'), ['poc-browser/serve.py', '--port', '8011']);
  await waitServer(server); await launchBrowser();
  const call = (op,payload={}) => cdp.evalJs(`companyHub.db.call(${JSON.stringify(op)},${JSON.stringify(payload)})`);
  const original = await call('companies.list');
  const id = original[0].id;
  await check('canonical lifecycle export reset import restores persisted edits', async () => {
    assert.equal(original.length,6);
    await call('companies.update',{id,data:{name:'Portable workspace marker'}});
    await loadProbe();
    assert.equal((await call('companies.get',{id})).name,'Portable workspace marker');
    await cdp.evalJs('companyHub.db.exportWorkspace().then(bytes => {window.savedWorkspace=bytes;return bytes.byteLength;})');
    await cdp.evalJs('companyHub.db.resetWorkspace()');
    assert.equal((await call('companies.get',{id})).name,original[0].name);
    await cdp.evalJs('companyHub.db.replaceWorkspace(window.savedWorkspace)');
    assert.equal((await call('companies.get',{id})).name,'Portable workspace marker');
    await loadProbe();
    assert.equal((await call('companies.get',{id})).name,'Portable workspace marker');
  });
  await check('invalid import leaves current data intact immediately and after reload', async () => {
    await assert.rejects(cdp.evalJs('companyHub.db.replaceWorkspace(new Uint8Array(128).buffer)'));
    assert.equal((await call('companies.get',{id})).name,'Portable workspace marker');
    await loadProbe();
    assert.equal((await call('companies.get',{id})).name,'Portable workspace marker');
  });
  await cdp.evalJs("location.hash='#/workspace'");
  assert.ok(await cdp.waitFor("Boolean(document.querySelector('#workspace-export'))"));
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:profile});
  let download;
  await check('visible export button downloads a standard SQLite file', async () => {
    await cdp.evalJs("document.querySelector('#workspace-export').click()");
    for(let attempt=0;attempt<100;attempt++) {
      download=(await readdir(profile)).find(name=>/^company-hub-.*\.db$/.test(name));
      if(download)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(download,'download completed');
    assert.equal((await readFile(path.join(profile,download))).subarray(0,16).toString(),'SQLite format 3\0');
  });
  await check('visible reset confirmation restores sample data', async () => {
    const click=cdp.evalJs("document.querySelector('#workspace-reset').click()");
    await new Promise(resolve=>setTimeout(resolve,100));
    await cdp.send('Page.handleJavaScriptDialog',{accept:true}); await click;
    assert.ok(await cdp.waitFor("document.querySelector('#workspace-message').textContent==='Sample workspace restored.'"));
    assert.equal((await call('companies.get',{id})).name,original[0].name);
  });
  await check('visible import input restores exported file after confirmation', async () => {
    const {root:doc}=await cdp.send('DOM.getDocument');
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.nodeId,selector:'#workspace-file'});
    const selection=cdp.send('DOM.setFileInputFiles',{nodeId,files:[path.join(profile,download)]});
    await new Promise(resolve=>setTimeout(resolve,100));
    await cdp.send('Page.handleJavaScriptDialog',{accept:true}); await selection;
    assert.ok(await cdp.waitFor("document.querySelector('#workspace-message').textContent.startsWith('Workspace imported.')"));
    assert.equal((await call('companies.get',{id})).name,'Portable workspace marker');
    const screenshot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile('/tmp/company-hub-stage-4-workspace.png',Buffer.from(screenshot.data,'base64'));
  });
  await check('replacement persistence failure preserves previous probe state', async () => {
    await cdp.navigate('http://127.0.0.1:8011/probe.html');
    assert.ok(await cdp.waitFor('Boolean(window.probeReady)'));await cdp.evalJs('window.probeReady');
    await cdp.evalJs("probe.call('probe.add',{value:'keep on failed replacement'})");
    await cdp.evalJs("probe.call('test.failNextPersist')");
    await assert.rejects(cdp.evalJs('probe.resetWorkspace()'));
    assert.equal((await cdp.evalJs("probe.call('probe.read')"))[0].value,'keep on failed replacement');
  });
  await writeFile(path.join(root,'poc-browser/tests/stage-4-results.json'),JSON.stringify({testedAt:new Date().toISOString(),results},null,2)+'\n');
} catch(error) {
  console.error(error);for(const child of children)console.error(child.output());process.exitCode=1;
} finally {
  cdp?.close();for(const child of [...children])await stop(child);
  if(profile)await rm(profile,{recursive:true,force:true});
}
