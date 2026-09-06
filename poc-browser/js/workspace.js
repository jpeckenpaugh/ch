import {db} from './db/client.js';
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
}
