// Shared Chrome DevTools Protocol harness for the browser test suite.
// Zero npm dependencies: uses Node's built-in fetch and WebSocket only.

const DEFAULT_CDP_URL =
  process.env.COMPANY_HUB_CDP_URL || "http://127.0.0.1:9222";

async function getWsUrl(cdpUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const list = await (await fetch(`${cdpUrl}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    if (Date.now() > deadline) throw new Error(`no chrome target at ${cdpUrl}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function connect(cdpUrl = DEFAULT_CDP_URL, timeoutMs = 20000) {
  const ws = new WebSocket(await getWsUrl(cdpUrl, timeoutMs));
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalJs(expression) {
    const res = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result.value;
  }

  async function waitFor(expr, timeout = 12000) {
    const start = Date.now();
    for (;;) {
      if (await evalJs(expr)) return true;
      if (Date.now() - start > timeout) return false;
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  async function navigate(url) {
    await send("Page.navigate", { url });
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.clearBrowserCookies");

  return {
    send,
    evalJs,
    waitFor,
    navigate,
    close() {
      ws.close();
    },
  };
}

export function loginEvalJs(password) {
  return `
    (() => {
      document.getElementById('login-email').value = 'admin@localhost';
      document.getElementById('login-password').value = ${JSON.stringify(password)};
      document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `;
}