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
const url = 'http://127.0.0.1:8011/probe.html';
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
  await cdp.evalJs('window.probe = undefined');
  await cdp.navigate(url);
  assert.equal(await cdp.waitFor('Boolean(window.probe)', 20000), true, 'probe facade loaded');
  await cdp.evalJs('window.probe.init()');
}
const call = (name, payload = {}) => cdp.evalJs(`window.probe.call(${JSON.stringify(name)}, ${JSON.stringify(payload)})`);
async function check(name, action) {
  await action();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
try {
  await requireFreePort(8011);
  await requireFreePort(9231);
  profile = await mkdtemp(path.join(tmpdir(), 'company-hub-poc-stage1-'));
  const server = start(path.join(root, '.venv/bin/python'), ['poc-browser/serve.py', '--port', '8011']);
  await waitServer(server);
  await launchBrowser();
  await check('fresh probe workspace and mutation', async () => {
    assert.deepEqual(await call('probe.read'), []);
    assert.equal((await call('probe.add', { value: 'survives-restart' })).value, 'survives-restart');
  });
  await check('page reload preserves mutation', async () => {
    await loadProbe();
    assert.deepEqual((await call('probe.read')).map(row => row.value), ['survives-restart']);
  });
  await check('browser process restart preserves mutation in same profile', async () => {
    cdp.close(); cdp = null;
    await stop(browser);
    await launchBrowser();
    assert.deepEqual((await call('probe.read')).map(row => row.value), ['survives-restart']);
  });
  await check('failed persistence restores previous database and permits subsequent writes', async () => {
    await call('test.failNextPersist');
    await assert.rejects(call('probe.add', { value: 'must-not-survive' }));
    assert.deepEqual((await call('probe.read')).map(row => row.value), ['survives-restart']);
    await call('probe.add', { value: 'after-recovery' });
    await loadProbe();
    assert.deepEqual((await call('probe.read')).map(row => row.value), ['survives-restart', 'after-recovery']);
  });
  await check('concurrent submitted mutations serialize without loss', async () => {
    const rows = await cdp.evalJs(`Promise.all(Array.from({length: 8}, (_, i) => window.probe.call('probe.add', {value: 'queue-' + i})))`);
    assert.equal(new Set(rows.map(row => row.id)).size, 8);
    await loadProbe();
    assert.deepEqual((await call('probe.read')).slice(2).map(row => row.value), Array.from({length: 8}, (_, i) => 'queue-' + i));
  });
  await check('export contains SQLite file signature', async () => {
    const header = await cdp.evalJs(`(async () => { const result = await window.probe.exportWorkspace(); const bytes = result.bytes ?? result; return Array.from(new Uint8Array(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, 16)); })()`);
    assert.deepEqual(header, [...Buffer.from('SQLite format 3\0')]);
  });
  await check('foreign keys remain enabled after export and mutation', async () => {
    assert.equal(await call('probe.foreignKeys'), 1);
    await call('probe.add', { value: 'foreign-key-check' });
    assert.equal(await call('probe.foreignKeys'), 1);
  });
  await check('diagnostics available', async () => {
    const diagnostics = await cdp.evalJs('window.probe.status()');
    assert.ok(diagnostics && typeof diagnostics === 'object');
    assert.equal(diagnostics.state, 'saved');
    assert.equal(diagnostics.workspace, 'company-hub-probe');
    assert.equal(typeof diagnostics.persistent, 'boolean');
    assert.ok(diagnostics.quota > 0);
    assert.ok(diagnostics.usage >= 0);
    assert.ok(diagnostics.revision > 0);
    assert.ok(diagnostics.lastSave.bytes > 0);
    assert.ok(diagnostics.lastSave.milliseconds >= 0);
    assert.ok(diagnostics.lastSave.totalMilliseconds >= 0);
    results.push({ diagnostics });
    console.log(JSON.stringify(diagnostics));
  });
  await writeFile(path.join(root, 'poc-browser/tests/stage-1-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), url, cdpUrl, results }, null, 2) + '\n');
} catch (error) {
  console.error(error);
  for (const child of children) console.error(child.output());
  process.exitCode = 1;
} finally {
  cdp?.close();
  for (const child of [...children]) await stop(child);
  if (profile) await rm(profile, { recursive: true, force: true });
}
