import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  profile=await mkdtemp(path.join(tmpdir(),'company-hub-poc-metrics-'));
  const server=start(path.join(root,'.venv/bin/python'),['poc-browser/serve.py','--port','8011']);
  await waitServer(server); await launchBrowser();
  for(const mib of [10,50,100]) {
    const fixture=path.join(profile,`fixture-${mib}.db`);
    const generator=start(path.join(root,'.venv/bin/python'),['poc-browser/tests/make-metrics-fixture.py','poc-browser/data/seed.db',fixture,String(mib)]);
    const [exitCode]=await once(generator,'exit'); assert.equal(exitCode,0,generator.output());
    await cdp.evalJs(`(()=>{document.querySelector('#metrics-file')?.remove(); const input=document.createElement('input');input.type='file';input.id='metrics-file';document.body.append(input);})()`);
    const {root:documentNode}=await cdp.send('DOM.getDocument');
    const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:documentNode.nodeId,selector:'#metrics-file'});
    await cdp.send('DOM.setFileInputFiles',{nodeId,files:[fixture]});
    await cdp.evalJs(`(async()=>{const bytes=await document.querySelector('#metrics-file').files[0].arrayBuffer();await companyHub.db.replaceWorkspace(bytes);})()`);
    const samples=[];
    for(let trial=0;trial<5;trial++) {
      samples.push(await cdp.evalJs(`(async()=>{const start=performance.now();await companyHub.db.call('industries.create',{name:'Metric ${mib} trial ${trial}'}); const roundTripMilliseconds=performance.now()-start; const status=await companyHub.db.status();return {roundTripMilliseconds,lastSave:status.lastSave,workspaceBytes:status.workspaceBytes,usage:status.usage,quota:status.quota,persistent:status.persistent,databaseMemoryBytes:status.databaseMemoryBytes??null,workerJSHeapBytes:status.workerJSHeapBytes??null,pageHeap:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}:null};})()`));
    }
    const exportedBytes=await cdp.evalJs('companyHub.db.exportWorkspace().then(bytes=>bytes.byteLength)');
    results.push({targetMiB:mib,exportedBytes,samples});
    console.log(`PASS ${mib} MiB saves: ${samples.map(s=>s.lastSave.totalMilliseconds.toFixed(1)).join(', ')} ms; exported ${exportedBytes} bytes`);
    await rm(fixture);
  }
  await writeFile(path.join(root,'poc-browser/tests/stage-3-metrics-results.json'),JSON.stringify({testedAt:new Date().toISOString(),browser:await cdp.send('Browser.getVersion'),platform:process.platform,results},null,2)+'\n');
} catch(error) { console.error(error); for(const child of children) console.error(child.output()); process.exitCode=1; }
finally {cdp?.close();for(const child of [...children])await stop(child);if(profile)await rm(profile,{recursive:true,force:true});}
