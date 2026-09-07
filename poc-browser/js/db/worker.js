/* Classic sql.js loader remains confined to this worker. */
const probe = new URL(self.location.href).searchParams.get('probe') === '1';
let SQL, database, storage, seed, schema, initialized = false, failed = null;
let queue = Promise.resolve();
const registry = new Map();
function register(name, handler, write = false) { registry.set(name, {handler, write}); }
function query(sql, params = []) {
  const statement = database.prepare(sql);
  try { statement.bind(params); const rows = []; while (statement.step()) rows.push(statement.getAsObject()); return rows; }
  finally { statement.free(); }
}
function open(bytes) { const db = new SQL.Database(bytes); db.run('PRAGMA foreign_keys=ON'); return db; }
function ensureWorkspaceSettings() {
  if (!probe) database.run(`CREATE TABLE IF NOT EXISTS workspace_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}
async function initialize() {
  if (failed) throw failed;
  if (initialized) return;
  importScripts(new URL('../../vendor/sql.js/sql-wasm.js', self.location.href).href);
  SQL = await initSqlJs({locateFile:() => new URL('../../vendor/sql.js/sql-wasm.wasm', self.location.href).href});
  const [{WorkspaceStorage}, seeds] = await Promise.all([import('./persistence.js'), import('./seed.js')]);
  seed = await seeds.seedBytes(SQL, probe);
  storage = new WorkspaceStorage(probe ? 'company-hub-probe' : 'company-hub', {seedVersion:probe ? 'probe-v1' : 'company-hub-seed-v1', schemaRevision:probe ? null : '0003_sprint03_roles'});
  database = open(await storage.openWorkspace(seed));
  if (!probe) { schema = await import('./schema.js'); schema.validateSchema(database); }
  if (!probe) {
    ensureWorkspaceSettings();
    const {registerOperations} = await import('./repo/index.js');
    registerOperations({register, query, run:(sql,params=[])=>database.run(sql,params)});
  }
  initialized = true;
}
async function recover(error) {
  try { if (database) database.close(); database = null; database = open(new Uint8Array(await storage.exportWorkspace())); }
  catch (recoveryError) { failed = new Error(`Workspace recovery failed; reload required: ${recoveryError.message}`); throw failed; }
  throw error;
}
function snapshot() {
  try { return database.export(); }
  finally { database.run('PRAGMA foreign_keys=ON'); }
}
async function persist() {
  const start = performance.now();
  const wasmHeapBefore = SQL.HEAPU8?.buffer.byteLength ?? null;
  try {
    const bytes = snapshot();
    const wasmHeapAfterExport = SQL.HEAPU8?.buffer.byteLength ?? null;
    await storage.replaceWorkspace(bytes);
    Object.assign(storage.lastSave, {totalMilliseconds:performance.now()-start, wasmHeapBefore, wasmHeapAfterExport});
  }
  catch (error) { return recover(error); }
}
async function replace(bytes) {
  let candidate;
  if (probe) {
    candidate = open(new Uint8Array(bytes));
    try {
      if (candidate.exec('PRAGMA integrity_check')[0]?.values[0]?.[0] !== 'ok') {
        throw new Error('Invalid SQLite database');
      }
    } catch (error) { candidate.close(); throw error; }
  } else {
    candidate = schema.openValidatedImport(SQL, bytes);
  }
  // Keep the validated candidate open, avoiding a fallible reopen after commit.
  database.close(); database = null;
  try {
    await storage.replaceWorkspace(new Uint8Array(bytes));
    database = candidate;
    ensureWorkspaceSettings();
  } catch (error) {
    candidate.close();
    return recover(error);
  }
  return status();
}

function status() { return {...storage.metadata, state:failed ? 'failed' : 'saved', workspace:storage.name, workspaceBytes:storage.workspaceBytes, databaseMemoryBytes:SQL.HEAPU8?.buffer.byteLength ?? null, workerJSHeapBytes:performance.memory?.usedJSHeapSize ?? null, lastSave:storage.lastSave || null, metadataWarning:storage.metadataWarning || null}; }
register('workspace.status', status);
register('workspace.export', () => snapshot().buffer);
register('workspace.replace', payload => replace(payload.bytes));
register('workspace.reset', () => replace(seed));
register('workspace.close', async () => { database.close(); database = null; await storage.closeWorkspace(); initialized = false; return null; });
if (probe) {
  register('probe.foreignKeys', () => query('PRAGMA foreign_keys')[0].foreign_keys);
  register('probe.read', () => query('SELECT id,value FROM probe ORDER BY id'));
  register('probe.add', ({value}) => { if (typeof value !== 'string') throw new Error('value must be a string'); database.run('INSERT INTO probe(value) VALUES (?)', [value]); return query('SELECT id,value FROM probe WHERE id=last_insert_rowid()')[0]; }, true);
  register('test.failNextPersist', () => {storage.failNext = true; return {armed:true};});
}
async function dispatch(op, payload) {
  await initialize();
  if (failed) throw failed;
  if (op === 'workspace.init') return status();
  const entry = registry.get(op);
  if (!entry) throw new Error(`Unknown workspace operation: ${op}`);
  if (!entry.write) return entry.handler(payload);
  database.run('BEGIN');
  let result;
  try { result = await entry.handler(payload); database.run('COMMIT'); }
  catch (error) { try { database.run('ROLLBACK'); } catch {} throw error; }
  await persist();
  return result;
}
self.onmessage = ({data:{id, op, payload = {}}}) => {
  queue = queue.then(async () => {
    try { const result = await dispatch(op, payload); self.postMessage({id, result}, result instanceof ArrayBuffer ? [result] : []); }
    catch (error) { self.postMessage({id, error:{message:error.message, name:error.name, status:error.status, detail:error.detail, body:error.body}}); }
  });
};
