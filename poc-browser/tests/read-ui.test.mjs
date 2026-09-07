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
  await requireFreePort(8011);
  await requireFreePort(9231);
  profile = await mkdtemp(path.join(tmpdir(), 'company-hub-poc-read-ui-'));
  const server = start(path.join(root, '.venv/bin/python'), ['poc-browser/serve.py', '--port', '8011']);
  await waitServer(server);
  await launchBrowser();
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `window.pageErrors=[]; window.addEventListener('error', event => pageErrors.push(event.message)); window.addEventListener('unhandledrejection', event => pageErrors.push(String(event.reason)));`});
  await loadProbe();
  const companies = await cdp.evalJs("window.companyHub.db.call('companies.list')");
  const first = companies[0];
  const route = async hash => {
    await cdp.evalJs(`location.hash = ${JSON.stringify(hash)}`);
    await new Promise(resolve => setTimeout(resolve, 300));
  };
  await check('company directory displays canonical seed', async () => {
    assert.ok(companies.length > 0);
    assert.equal(await cdp.waitFor(`document.querySelectorAll('.company-row').length === ${companies.length}`), true);
    assert.equal(await cdp.evalJs("document.querySelectorAll('#nav-users,#nav-logout,#nav-password').length"), 0);
  });
  await check('search filters rendered company rows', async () => {
    const query = first.name;
    const count = await cdp.evalJs(`window.companyHub.db.call('companies.list', {q:${JSON.stringify(query)}}).then(rows=>rows.length)`);
    await cdp.evalJs(`document.querySelector('#company-search').value=${JSON.stringify(query)}; document.querySelector('#company-search').dispatchEvent(new Event('input'));`);
    assert.equal(await cdp.waitFor(`document.querySelectorAll('.company-row').length===${count}`), true);
  });
  await check('country filter updates displayed companies', async () => {
    await cdp.evalJs(`document.querySelector('#company-search').value=''; const checkbox=document.querySelector('.country-check[value="US"]'); checkbox.checked=true; checkbox.dispatchEvent(new Event('change'));`);
    const count = await cdp.evalJs("window.companyHub.db.call('companies.list',{countries:['US']}).then(rows=>rows.length)");
    assert.equal(await cdp.waitFor(`document.querySelectorAll('.company-row').length===${count}`), true);
  });
  await check('profile displays company and retained child cards', async () => {
    await route(`#/companies/${first.id}`);
    assert.equal(await cdp.waitFor(`document.querySelector('#profile-body h2')?.textContent===${JSON.stringify(first.name)}`), true);
    assert.equal(await cdp.evalJs("document.querySelectorAll('#generate-btn,#logo-form,#upload-form,a[download]').length"), 0);
    assert.equal(await cdp.evalJs("Boolean(document.querySelector('#find-news-btn'))"), true);
    await cdp.evalJs("document.querySelector('#add-news-btn').click()");
    assert.equal(await cdp.waitFor("Boolean(document.querySelector('.modal.show #news-form'))"), true, 'add-news form opens as an overlay');
    await cdp.evalJs("document.querySelector('.modal.show [data-bs-dismiss=modal]').click()");
    assert.equal(await cdp.waitFor("!document.querySelector('.modal.show')"), true, 'add-news overlay closes');
    await cdp.evalJs("document.querySelector('#find-news-btn').click()");
    assert.equal(await cdp.waitFor("document.querySelector('.modal.show #find-news-source')?.value === 'currents' && Boolean(document.querySelector('.modal.show #find-news-count'))"), true, 'find-news overlay offers Currents ranking');
    await cdp.evalJs("document.querySelector('.modal.show [data-bs-dismiss=modal]').click()");
    const text = await cdp.evalJs("document.querySelector('#profile-body').textContent");
    for (const label of ['Locations','References','News','Files']) assert.ok(text.includes(label), label);
    const screenshot = await cdp.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
    await writeFile('/tmp/company-hub-stage-2-profile.png', Buffer.from(screenshot.data,'base64'));
  });
  await check('industry view and owner controls load', async () => {
    await route('#/industries');
    const count=await cdp.evalJs("window.companyHub.db.call('industries.list').then(rows=>rows.length)");
    assert.equal(await cdp.waitFor(`document.querySelectorAll('.industry-row').length===${count}`), true);
    assert.equal(await cdp.evalJs("Boolean(document.querySelector('#add-industry-form'))"),true);
  });
  await check('create and edit forms load lookup data', async () => {
    await route('#/companies/new');
    assert.equal(await cdp.waitFor("Boolean(document.querySelector('#company-form'))"),true);
    assert.equal(await cdp.evalJs("Boolean(document.querySelector('#add-location-row'))"),true);
    assert.ok(await cdp.evalJs("document.querySelector('#field-industry').options.length")>1);
    await route(`#/companies/${first.id}/edit`);
    assert.equal(await cdp.waitFor(`document.querySelector('#field-name')?.value===${JSON.stringify(first.name)}`),true);
  });
  await check('workspace diagnostics load', async () => {
    await route('#/workspace');
    assert.equal(await cdp.waitFor("document.querySelector('#view').textContent.includes('Browser storage')"),true);
    assert.equal(await cdp.evalJs("Boolean(document.querySelector('#currents-api-key,#currents-save,#currents-test'))"),true);
    await cdp.evalJs("window.companyHub.db.call('settings.set',{data:{key:'news.currents.api_key',value:'test-key'}})");
    assert.equal(await cdp.evalJs("window.companyHub.db.call('settings.get',{key:'news.currents.api_key'}).then(row=>row.value)"), 'test-key');
    await cdp.evalJs("window.companyHub.db.call('settings.delete',{data:{key:'news.currents.api_key'}})");
  });
  await check('no API resources or browser runtime errors', async () => {
    const apiResources = await cdp.evalJs("performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>new URL(name).pathname.startsWith('/api/'))");
    assert.deepEqual(apiResources, []);
    assert.deepEqual(await cdp.evalJs('window.pageErrors'),[]);
  });
  await writeFile(path.join(root,'poc-browser/tests/stage-2-ui-results.json'), JSON.stringify({testedAt:new Date().toISOString(),url,cdpUrl,companies:companies.length,screenshot:'/tmp/company-hub-stage-2-profile.png',results},null,2)+'\n');
} catch(error) {
  console.error(error);
  for(const child of children) console.error(child.output());
  process.exitCode=1;
} finally {
  cdp?.close();
  for(const child of [...children]) await stop(child);
  if(profile) await rm(profile,{recursive:true,force:true});
}
