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
const wait = async expression => assert.equal(await cdp.waitFor(expression),true,expression);
const click = selector => cdp.evalJs(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fill = fields => cdp.evalJs(`Object.entries(${JSON.stringify(fields)}).forEach(([selector,value])=>document.querySelector(selector).value=value)`);
const submit = selector => cdp.evalJs(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
const route = async hash => { await cdp.evalJs(`location.hash=${JSON.stringify(hash)}`); await new Promise(resolve=>setTimeout(resolve,200)); };
const get = id => cdp.evalJs(`companyHub.db.call('companies.get',{id:${id}})`);
try {
  await requireFreePort(8011); await requireFreePort(9231);
  profile=await mkdtemp(path.join(tmpdir(),'company-hub-poc-writes-'));
  const server=start(path.join(root,'.venv/bin/python'),['poc-browser/serve.py','--port','8011']);
  await waitServer(server); await launchBrowser();
  await cdp.evalJs('window.confirm=()=>true');
  let id;
  await check('company plus initial location saved atomically through form',async()=>{
    await route('#/companies/new'); await wait("Boolean(document.querySelector('#company-form'))");
    await fill({'#field-name':'Browser Test Co'}); await click('#add-location-row');
    await fill({'[data-field="label"]':'HQ','[data-field="city"]':'Boston','[data-field="country_code"]':'US','[data-field="type"]':'Headquarters'});
    const before=await cdp.evalJs('companyHub.db.status()');
    await submit('#company-form'); await wait("document.querySelector('#profile-body h2')?.textContent==='Browser Test Co'");
    id=await cdp.evalJs('Number(location.hash.split("/").at(-1))');
    assert.equal((await get(id)).locations.length,1);
    assert.equal((await cdp.evalJs('companyHub.db.status()')).revision,before.revision+1);
  });
  await check('company edit survives reload',async()=>{
    await route(`#/companies/${id}/edit`); await wait("Boolean(document.querySelector('#company-form'))");
    await fill({'#field-name':'Browser Test Updated'}); await submit('#company-form');
    await wait("document.querySelector('#profile-body h2')?.textContent==='Browser Test Updated'");
    await loadProbe(); await route(`#/companies/${id}`); await wait("document.querySelector('#profile-body h2')?.textContent==='Browser Test Updated'");
    await cdp.evalJs('window.confirm=()=>true');
  });
  for(const entity of ['location','reference','news']) await check(`${entity} add edit delete persists`,async()=>{
    await click(`#add-${entity}-btn`); await wait(`Boolean(document.querySelector('#${entity}-form'))`);
    const values=entity==='location'?{'#location-form [name="label"]':'Extra','#location-form [name="city"]':'London','#location-form [name="country"]':'GB','#location-form [name="type"]':'Office'}:entity==='reference'?{'#ref-title':'Extra','#ref-url':'https://example.com/ref'}:{'#news-title':'Extra','#news-source':'Example','#news-url':'https://example.com/news','#news-date':'2026-09-06'};
    const property=entity==='location'?'locations':entity==='reference'?'references':'news';
    const initial=(await get(id))[property].length;
    await fill(values); await submit(`#${entity}-form`);
    await wait(`document.querySelectorAll('.edit-${entity}').length===${initial+1}`);
    const child=(await get(id))[property].find(row=>(row.label??row.title)==='Extra');
    await click(`.edit-${entity}[data-id="${child.id}"]`);
    await fill({[entity==='location'?'#location-form [name="label"]':entity==='reference'?'#ref-title':'#news-title']:'Edited'});
    await submit(`#${entity}-form`);
    await wait(`!document.querySelector('#${entity}-form')`);
    assert.equal((await get(id))[property].find(row=>row.id===child.id)[entity==='location'?'label':'title'],'Edited');
    await click(`.remove-${entity}[data-id="${child.id}"]`);
    await wait(`document.querySelectorAll('.edit-${entity}').length===${initial}`);
    await loadProbe(); await route(`#/companies/${id}`); await wait("Boolean(document.querySelector('#profile-body h2'))");
    await cdp.evalJs('window.confirm=()=>true');
    assert.equal((await get(id))[property].length,initial);
  });
  await check('industry create and rename survives reload',async()=>{
    await route('#/industries'); await wait("Boolean(document.querySelector('#add-industry-form'))");
    await fill({'#new-industry-name':'Browser Industry'}); await submit('#add-industry-form');
    await wait("Boolean(document.querySelector('.rename-industry[data-name="+'"Browser Industry"'+"]'))");
    await click('.rename-industry[data-name="Browser Industry"]'); await fill({'.industry-edit-input':'Browser Renamed'}); await click('.industry-edit-save');
    await wait("Boolean(document.querySelector('.rename-industry[data-name="+'"Browser Renamed"'+"]'))");
    await loadProbe(); await route('#/industries');
    await wait("Boolean(document.querySelector('.rename-industry[data-name="+'"Browser Renamed"'+"]'))");
  });
  await writeFile(path.join(root,'poc-browser/tests/stage-3-write-ui-results.json'),JSON.stringify({testedAt:new Date().toISOString(),results},null,2)+'\n');
} catch(error) { console.error(error); for(const child of children) console.error(child.output()); process.exitCode=1; }
finally {cdp?.close();for(const child of [...children])await stop(child);if(profile)await rm(profile,{recursive:true,force:true});}
