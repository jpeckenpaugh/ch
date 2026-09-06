// Browser smoke suite adapted from tmp/browser-smoke.mjs as node:test.
// Requires a live server (COMPANY_HUB_URL) and Chrome on :9222.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { connect, loginEvalJs } from "./cdp.mjs";

const BASE = process.env.COMPANY_HUB_URL || "http://127.0.0.1:8000";
const PW = process.env.COMPANY_HUB_ADMIN_PASSWORD || "test-admin-password";

let cdp;

before(async () => {
  cdp = await connect();
  await cdp.navigate(`${BASE}/`);
});

after(() => {
  cdp.close();
});

test("login view rendered when unauthenticated", async () => {
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').toLowerCase().includes('sign in to continue')`
    )
  );
});

test("nav hidden when unauthenticated", async () => {
  assert.ok(
    await cdp.evalJs(`document.getElementById('nav-bar').classList.contains('d-none')`)
  );
});

test("login navigates to companies list", async () => {
  await cdp.evalJs(loginEvalJs(PW));
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('add company')`)
  );
});

test("nav visible when authenticated", async () => {
  assert.ok(
    await cdp.evalJs(`!document.getElementById('nav-bar').classList.contains('d-none')`)
  );
});

test("change password nav present when authenticated", async () => {
  assert.ok(await cdp.waitFor(`!!document.getElementById('nav-password')`));
});

test("seeded companies rendered", async () => {
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Toyota Motor') && (document.body.innerText||'').includes('Shell')`
    )
  );
});

test("country filter control present", async () => {
  assert.ok(
    await cdp.waitFor(
      `!!document.getElementById('country-filter-slot') && !!document.getElementById('country-filter-slot').querySelector('.country-check')`
    )
  );
});

test("profile renders main details", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Toyota Motor') && (document.body.innerText||'').toLowerCase().includes('manufacturing')`
    )
  );
});

test("profile has Locations section with HQ", async () => {
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').toLowerCase().includes('global hq') && (document.body.innerText||'').toLowerCase().includes('locations')`
    )
  );
});

test("profile has References section", async () => {
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('references')`)
  );
});

test("profile has News section", async () => {
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('news')`)
  );
});

test("profile has Logo section", async () => {
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('logo')`)
  );
});

test("industries view renders list", async () => {
  await cdp.evalJs("location.hash = '#/industries'");
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Energy') && (document.body.innerText||'').includes('Manufacturing') && (document.body.innerText||'').toLowerCase().includes('add industry')`
    )
  );
});

test("add form has industry dropdown", async () => {
  await cdp.evalJs("location.hash = '#/companies/new'");
  assert.ok(
    await cdp.waitFor(
      `document.getElementById('field-industry') && document.getElementById('field-industry').options.length >= 7`
    )
  );
});

test("add form has locations editor", async () => {
  assert.ok(await cdp.waitFor(`!!document.getElementById('add-location-row')`));
});

test("logout returns to login view", async () => {
  await cdp.evalJs("location.hash = '#/'");
  await cdp.waitFor(`!!document.getElementById('nav-logout')`);
  await cdp.evalJs("document.getElementById('nav-logout').click()");
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('sign in to continue')`)
  );
});