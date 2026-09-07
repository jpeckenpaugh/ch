import {db} from './db/client.js';
import {deleteSetting, getSetting, setSetting} from './api.js';
import {collectCurrentsCandidates} from './news-ranking/currents.js';
import {esc, formatSize} from './app.js';

export async function renderWorkspace(container) {
  container.innerHTML = `
    <div class="card mx-auto" style="max-width:760px">
      <div class="card-body">
        <h1 class="h4">Workspace</h1>
        <p class="text-secondary">Your company information is saved in this browser. Export a database file to back it up or move it to another device.</p>
        <div id="workspace-status" aria-live="polite">Checking storage…</div>
        <div class="d-flex flex-wrap gap-2 my-3">
          <button id="workspace-export" class="btn btn-primary">Export workspace</button>
          <button id="workspace-import" class="btn btn-outline-primary">Import workspace</button>
          <button id="workspace-reset" class="btn btn-outline-danger">Reset to sample data</button>
        </div>
        <input id="workspace-file" type="file" accept=".db,.sqlite,.sqlite3" class="d-none" aria-label="Choose a Company Hub database">
        <p class="small text-secondary">Import and reset replace the current workspace. Export a copy first if you want to keep it. Files and logos are not included in this POC.</p>
        <div id="workspace-message" role="status" aria-live="polite"></div>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', `
    <div class="card mx-auto mt-4" style="max-width:760px">
      <div class="card-body">
        <h2 class="h5">News providers</h2>
        <p class="text-secondary small">Configure a personal Currents API key to find candidates that Gemma can rank locally.</p>
        <p class="small mb-3"><a href="https://currentsapi.services/en/register" target="_blank" rel="noopener">Get a free Currents API key</a></p>
        <div id="currents-key-state" class="small mb-2">Checking configuration…</div>
        <div class="input-group">
          <input id="currents-api-key" class="form-control" type="password" autocomplete="off" placeholder="Paste your Currents API key" aria-label="Currents API key">
          <button id="currents-save" class="btn btn-primary">Save key</button>
        </div>
        <div class="d-flex gap-2 mt-2"><button id="currents-test" class="btn btn-sm btn-outline-primary">Test key</button><button id="currents-remove" class="btn btn-sm btn-outline-danger">Remove key</button></div>
        <div id="currents-message" class="small mt-3" role="status" aria-live="polite"></div>
      </div>
    </div>`);
  const statusElement = container.querySelector('#workspace-status');
  const message = container.querySelector('#workspace-message');
  const fileInput = container.querySelector('#workspace-file');
  const buttons = [...container.querySelectorAll('button')];
  let busy = false;

  async function refresh() {
    const status = await db.status();
    statusElement.innerHTML = `
      <dl class="row mb-0">
        <dt class="col-sm-4">Storage</dt><dd class="col-sm-8">${status.persistent ? 'Persistent' : 'Browser-managed — export a backup'}</dd>
        <dt class="col-sm-4">Workspace size</dt><dd class="col-sm-8">${esc(formatSize(status.workspaceBytes))}</dd>
        <dt class="col-sm-4">Browser storage</dt><dd class="col-sm-8">${status.quota == null ? 'Unavailable' : `${esc(formatSize(status.usage))} used / ${esc(formatSize(status.quota))} quota`}</dd>
        <dt class="col-sm-4">Revision</dt><dd class="col-sm-8">${esc(status.revision)}</dd>
        <dt class="col-sm-4">State</dt><dd class="col-sm-8">Saved</dd>
      </dl>
      ${status.metadataWarning ? '<p class="text-warning mb-0">Data saved; revision metadata could not be updated.</p>' : ''}`;
  }

  async function perform(label, action) {
    if (busy) return;
    busy = true;
    buttons.forEach(button => { button.disabled = true; });
    message.textContent = label;
    message.className = 'text-secondary';
    try {
      const result = await action();
      await refresh();
      message.className = 'text-success';
      message.textContent = result;
    } catch (error) {
      message.className = 'text-danger';
      message.textContent = error.message;
    } finally {
      busy = false;
      buttons.forEach(button => { button.disabled = false; });
      fileInput.value = '';
    }
  }

  container.querySelector('#workspace-export').onclick = () => perform('Preparing export…', async () => {
    const bytes = await db.exportWorkspace();
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/vnd.sqlite3'}));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `company-hub-${new Date().toISOString().slice(0,10)}.db`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Allow the browser to begin the download before releasing its object URL.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'Workspace export prepared.';
  });
  container.querySelector('#workspace-import').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!confirm('Replace this workspace with the selected database? Export first to keep a backup.')) {
      fileInput.value = '';
      return;
    }
    perform('Validating and importing…', async () => {
      await db.replaceWorkspace(await file.arrayBuffer());
      return 'Workspace imported. Open Companies to view the restored records.';
    });
  };
  container.querySelector('#workspace-reset').onclick = () => {
    if (!confirm('Replace this workspace with the original sample data?')) return;
    perform('Restoring sample data…', async () => {
      await db.resetWorkspace();
      return 'Sample workspace restored.';
    });
  };
  await refresh();
  const currentsKey = 'news.currents.api_key';
  const keyInput = container.querySelector('#currents-api-key');
  const keyState = container.querySelector('#currents-key-state');
  const keyMessage = container.querySelector('#currents-message');
  const keyButtons = [...container.querySelectorAll('#currents-save,#currents-test,#currents-remove')];
  let savedKey = '';
  function mask(value) { return value ? `Configured ••••${value.slice(-4)}` : 'No Currents API key saved.'; }
  async function refreshKey() {
    savedKey = (await getSetting(currentsKey))?.value || '';
    keyState.textContent = mask(savedKey);
    container.querySelector('#currents-remove').disabled = !savedKey;
    container.querySelector('#currents-test').disabled = !savedKey;
  }
  async function performKey(action) {
    keyButtons.forEach(button => { button.disabled = true; });
    keyMessage.className = 'small mt-3 text-secondary';
    try {
      const result = await action();
      keyMessage.className = 'small mt-3 text-success'; keyMessage.textContent = result;
      await refreshKey();
    } catch (error) { keyMessage.className = 'small mt-3 text-danger'; keyMessage.textContent = error.message; }
    finally { keyButtons.forEach(button => { button.disabled = false; }); await refreshKey(); }
  }
  container.querySelector('#currents-save').onclick = () => performKey(async () => {
    const value = keyInput.value.trim();
    if (!value) throw new Error('Paste an API key to save it.');
    await setSetting(currentsKey, value); keyInput.value = '';
    return 'Currents API key saved in this browser workspace.';
  });
  container.querySelector('#currents-test').onclick = () => performKey(async () => {
    const results = await collectCurrentsCandidates({company: {name: 'Toyota'}, apiKey: savedKey, limit: 1});
    return `Connection succeeded. Currents returned ${results.length} usable Toyota article${results.length === 1 ? '' : 's'}.`;
  });
  container.querySelector('#currents-remove').onclick = () => performKey(async () => {
    await deleteSetting(currentsKey); return 'Currents API key removed from this browser workspace.';
  });
  await refreshKey();
}
