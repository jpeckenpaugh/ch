// Storage boundary: OPFS replacement commits only when writable.close resolves.
export class WorkspaceStorage {
  constructor(name, {seedVersion = 'probe-v1', schemaRevision = null} = {}) { this.name = name; this.seedVersion = seedVersion; this.schemaRevision = schemaRevision; this.failNext = false; }
  async openWorkspace(seedBytes) {
    const root = await navigator.storage.getDirectory();
    this.directory = await root.getDirectoryHandle(this.name, {create:true});
    this.file = await this.directory.getFileHandle('company_hub.db', {create:true});
    this.metadata = {revision:0, lastPersisted:null, seedVersion:this.seedVersion, schemaRevision:this.schemaRevision};
    try { Object.assign(this.metadata, JSON.parse(await (await (await this.directory.getFileHandle('workspace.json')).getFile()).text())); } catch {}
    const bytes = new Uint8Array(await (await this.file.getFile()).arrayBuffer());
    this.workspaceBytes = bytes.byteLength;
    if (bytes.length) return bytes;
    await this.replaceWorkspace(seedBytes);
    return seedBytes;
  }
  async exportWorkspace() { return (await this.file.getFile()).arrayBuffer(); }
  async replaceWorkspace(bytes) {
    const start = performance.now();
    const writable = await this.file.createWritable();
    try {
      await writable.write(bytes);
      if (this.failNext) { this.failNext = false; throw new Error('Injected OPFS persistence failure'); }
      await writable.close();
    } catch (error) { try { await writable.abort(); } catch {} throw error; }
    this.workspaceBytes = bytes.byteLength;
    this.metadata = {...this.metadata, revision:this.metadata.revision + 1, lastPersisted:new Date().toISOString()};
    this.lastSave = {bytes:bytes.byteLength, milliseconds:performance.now()-start};
    this.metadataWarning = null;
    try {
      const sidecar = await (await this.directory.getFileHandle('workspace.json', {create:true})).createWritable();
      try { await sidecar.write(JSON.stringify(this.metadata)); await sidecar.close(); }
      catch (error) { try { await sidecar.abort(); } catch {} throw error; }
    } catch (error) { this.metadataWarning = error.message; }
  }
  async resetWorkspace(seedBytes) { await this.replaceWorkspace(seedBytes); }
  async closeWorkspace() { this.file = null; this.directory = null; }
}
