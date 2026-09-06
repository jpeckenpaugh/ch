export function createClient({probe = false} = {}) {
  const url = new URL('./worker.js', import.meta.url);
  if (probe) url.searchParams.set('probe', '1');
  const worker = new Worker(url);
  let nextId = 0, terminalError;
  const pending = new Map();
  worker.onmessage = ({data}) => {
    const request = pending.get(data.id); if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(Object.assign(new Error(data.error.message), data.error));
    else request.resolve(data.result);
  };
  worker.onerror = event => {
    terminalError = new Error(event.message || 'Workspace worker failed');
    for (const request of pending.values()) request.reject(terminalError);
    pending.clear();
  };
  const call = (op, payload = {}) => new Promise((resolve, reject) => {
    if (terminalError) return reject(terminalError);
    const id = ++nextId; pending.set(id, {resolve,reject}); try { worker.postMessage({id,op,payload}); } catch (error) { pending.delete(id); reject(error); }
  });
  let diagnostics = {persistent:false, usage:null, quota:null};
  async function storageStatus(requestPersist = false) {
    try { diagnostics.persistent = requestPersist ? await navigator.storage.persist() : await navigator.storage.persisted(); } catch {}
    try { const {usage,quota} = await navigator.storage.estimate(); Object.assign(diagnostics,{usage,quota}); } catch {}
    return diagnostics;
  }
  return {
    call,
    async init() { await storageStatus(true); return {...await call('workspace.init'), ...diagnostics}; },
    async status() { await storageStatus(); return {...await call('workspace.status'), ...diagnostics}; },
    exportWorkspace:() => call('workspace.export'),
    replaceWorkspace:bytes => call('workspace.replace', {bytes}),
    resetWorkspace:() => call('workspace.reset'),
    closeWorkspace:() => call('workspace.close'),
  };
}
export const db = createClient({probe:new URL(location.href).searchParams.get('probe') === '1' || location.pathname.endsWith('/probe.html')});
