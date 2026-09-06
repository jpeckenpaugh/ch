# Company Hub browser workspace POC

This isolated copy explores Company Hub as a static application with a local
SQLite workspace. The original FastAPI application and OpenCode agents are
unchanged. Agents, authentication and binary artifacts are outside this POC.

## Run

From the repository root:

```sh
python3 poc-browser/serve.py --port 8011
```

Open http://127.0.0.1:8011 in a current Chromium browser. No FastAPI process is
needed. JavaScript, Bootstrap and SQLite WebAssembly are served locally.
The Python script is only a convenient static file server; deployment may use
any static host with correct WebAssembly MIME support. OPFS requires a secure
context (HTTPS or localhost).

The browser origin owns its workspace. Use the same host and port to return to
the same data. Browser storage permission and quota are shown in the app;
export snapshots for backups. Multiple simultaneous tabs are outside scope.

## Development record

- [Contract](docs/contract.md): retained application behavior and adaptations.
- [Ledger](docs/development.md): stage gates and verification evidence.
- [Handoffs](docs/handoffs/): bounded sub-agent work and integration notes.

Automated browser checks use isolated port 8011, Chrome CDP port 9231, and a
temporary browser profile. They refuse occupied ports and clean only their own
processes. Stop your POC static server before running them. Any comparison
against FastAPI must explicitly use port 8001 and temporary data; port 8000 is
reserved for another workflow.
