// Browser interaction suite adapted from tmp/browser-interactions.mjs as node:test.
// Requires a live server (COMPANY_HUB_URL) and Chrome on :9222.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { connect, loginEvalJs } from "./cdp.mjs";

// Tiny valid PNGs for logo upload flows (1x1 red, 2x2 blue). The logo endpoint
// gates on the image/* content-type only, and the inline-render checks need
// bytes the browser can actually decode.
const TINY_PNG_A =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
const TINY_PNG_B =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGNgYPj/H4KhDAA/0gf5tBJPzQAAAABJRU5ErkJggg==";

// Build a page-side expression that drops a File onto a file input and submits
// its form. Used to drive the logo upload/replace UI through the real handler.
function fileUploadJs(selector, b64, name, mime) {
  return `
    (() => {
      const bytes = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0));
      const file = new File([bytes], ${JSON.stringify(name)}, { type: ${JSON.stringify(mime)} });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById(${JSON.stringify(selector)});
      input.files = dt.files;
      input.closest('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `;
}

const BASE = process.env.COMPANY_HUB_URL || "http://127.0.0.1:8000";
const PW = process.env.COMPANY_HUB_ADMIN_PASSWORD || "test-admin-password";

let cdp;

before(async () => {
  cdp = await connect();
  await cdp.navigate(`${BASE}/`);
  await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('sign in to continue')`);
  await cdp.evalJs(loginEvalJs(PW));
  await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('add company')`);
});

after(() => {
  cdp.close();
});

test("country filter GB narrows list to HSBC/Shell", async () => {
  await cdp.waitFor(
    `!!document.getElementById('country-filter-slot') && !!document.getElementById('country-filter-slot').querySelector('.country-check')`
  );
  await cdp.evalJs(`
    (() => {
      const cb = document.getElementById('country-filter-slot').querySelector('[value="GB"]');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('HSBC') && (document.body.innerText||'').includes('Shell') && !(document.body.innerText||'').includes('Toyota Motor')`
    )
  );
});

test("clearing filter restores full list", async () => {
  await cdp.evalJs(
    `document.getElementById('country-filter-slot').querySelector('#clear-countries').click()`
  );
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Toyota Motor') && (document.body.innerText||'').includes('Carrefour')`
    )
  );
});

test("reference added via UI appears on profile", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  await cdp.waitFor(`!!document.getElementById('add-reference-btn')`);
  await cdp.evalJs(`
    (() => {
      document.getElementById('add-reference-btn').click();
      const f = document.getElementById('reference-form');
      f.elements['title'].value = 'Browser Smoke Ref';
      f.elements['url'].value = 'https://example.org/smoke';
      f.elements['description'].value = 'added via UI smoke';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Browser Smoke Ref') && (document.body.innerText||'').toLowerCase().includes('added by admin@localhost')`
    )
  );
});

test("reference removed via UI", async () => {
  await cdp.evalJs(`
    (() => {
      const btn = [...document.querySelectorAll('.remove-reference')].find((b) => b.parentElement.parentElement.innerText.includes('Browser Smoke Ref'));
      window.confirm = () => true;
      btn.click();
    })()
  `);
  assert.ok(
    await cdp.waitFor(`!(document.body.innerText||'').includes('Browser Smoke Ref')`)
  );
});

test("location added via UI appears on profile", async () => {
  await cdp.waitFor(`!!document.getElementById('add-location-btn')`);
  await cdp.evalJs(`
    (() => {
      document.getElementById('add-location-btn').click();
      const f = document.getElementById('location-form');
      f.elements['label'].value = 'Smoke Office';
      f.elements['city'].value = 'Berlin';
      f.elements['country'].value = 'DE';
      f.elements['type'].value = 'Office';
      f.elements['address'].value = '1 Smoke St';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Smoke Office') && (document.body.innerText||'').includes('Berlin')`
    )
  );
});

test("location removed via UI", async () => {
  await cdp.evalJs(`
    (() => {
      const btn = [...document.querySelectorAll('.remove-location')].find((b) => b.parentElement.parentElement.innerText.includes('Smoke Office'));
      window.confirm = () => true;
      btn.click();
    })()
  `);
  assert.ok(
    await cdp.waitFor(`!(document.body.innerText||'').includes('Smoke Office')`)
  );
});

test("industry renamed via UI", async () => {
  await cdp.evalJs("location.hash = '#/industries'");
  await cdp.waitFor(`!!document.querySelector('.rename-industry')`);
  await cdp.evalJs(`
    (() => {
      const row = [...document.querySelectorAll('.industry-row')].find((r) => r.innerText.includes('Energy'));
      row.querySelector('.rename-industry').click();
      const input = document.querySelector('.industry-edit-input');
      input.value = 'Energy Smoke';
      document.querySelector('.industry-edit-save').click();
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Energy Smoke') && !(document.body.innerText||'').includes('\\nEnergy\\n')`
    )
  );
});

test("industry renamed back to Energy", async () => {
  await cdp.evalJs(`
    (() => {
      const row = [...document.querySelectorAll('.industry-row')].find((r) => r.innerText.includes('Energy Smoke'));
      row.querySelector('.rename-industry').click();
      const input = document.querySelector('.industry-edit-input');
      input.value = 'Energy';
      document.querySelector('.industry-edit-save').click();
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Energy') && !(document.body.innerText||'').includes('Energy Smoke')`
    )
  );
});

test("company created via form with location lands on its profile", async () => {
  await cdp.evalJs("location.hash = '#/companies/new'");
  await cdp.waitFor(`!!document.getElementById('company-form')`);
  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('company-form');
      f.elements['name'].value = 'UI Created Co';
      f.elements['website'].value = 'https://ui.example';
      f.elements['industry'].value = '1';
      document.getElementById('add-location-row').click();
      const row = document.querySelector('.location-row');
      row.querySelector('[data-field="label"]').value = 'HQ';
      row.querySelector('[data-field="city"]').value = 'London';
      row.querySelector('[data-field="country_code"]').value = 'GB';
      row.querySelector('[data-field="type"]').value = 'Headquarters';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `location.hash.startsWith('#/companies/') && (document.body.innerText||'').includes('UI Created Co') && (document.body.innerText||'').includes('London')`
    )
  );
});

// --- Sprint 01 edit flows (Stage 8 additions) ---

test("location edited via UI", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  await cdp.waitFor(`!!document.querySelector('.edit-location')`);
  await cdp.evalJs(`
    (() => {
      [...document.querySelectorAll('.edit-location')].find((b) => b.parentElement.parentElement.innerText.includes('Global HQ')).click();
    })()
  `);
  await cdp.waitFor(`!!document.getElementById('location-form')`);
  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('location-form');
      f.elements['city'].value = 'Nagoya';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Nagoya') && !(document.body.innerText||'').includes('Toyota City')`
    )
  );
  await cdp.waitFor(`!!document.querySelector('.edit-location')`);
  await cdp.evalJs(`
    (() => {
      [...document.querySelectorAll('.edit-location')].find((b) => b.parentElement.parentElement.innerText.includes('Global HQ')).click();
    })()
  `);
  await cdp.waitFor(`!!document.getElementById('location-form')`);
  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('location-form');
      f.elements['city'].value = 'Toyota City';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(await cdp.waitFor(`(document.body.innerText||'').includes('Toyota City')`));
});

test("reference edited via UI preserves adder", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  await cdp.waitFor(`!!document.getElementById('add-reference-btn')`);
  await cdp.evalJs(`
    (() => {
      document.getElementById('add-reference-btn').click();
      const f = document.getElementById('reference-form');
      f.elements['title'].value = 'Edit Me Ref';
      f.elements['url'].value = 'https://example.org/editme';
      f.elements['description'].value = 'before edit';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(await cdp.waitFor(`(document.body.innerText||'').includes('Edit Me Ref')`));
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('added by admin@localhost')`)
  );
  await cdp.evalJs(`
    (() => {
      [...document.querySelectorAll('.edit-reference')].find((b) => b.parentElement.parentElement.innerText.includes('Edit Me Ref')).click();
    })()
  `);
  await cdp.waitFor(`!!document.getElementById('reference-form')`);
  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('reference-form');
      f.elements['title'].value = 'Renamed Ref';
      f.elements['description'].value = 'after edit';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('Renamed Ref') && !(document.body.innerText||'').includes('Edit Me Ref') && (document.body.innerText||'').includes('after edit')`
    )
  );
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('added by admin@localhost')`)
  );
});

test("edited reference removed via UI", async () => {
  await cdp.evalJs(`
    (() => {
      const btn = [...document.querySelectorAll('.remove-reference')].find((b) => b.parentElement.parentElement.innerText.includes('Renamed Ref'));
      window.confirm = () => true;
      btn.click();
    })()
  `);
  assert.ok(
    await cdp.waitFor(`!(document.body.innerText||'').includes('Renamed Ref')`)
  );
});

test("news added via UI is not scraped", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  await cdp.waitFor(`!!document.getElementById('add-news-btn')`);
  await cdp.evalJs(`
    (() => {
      document.getElementById('add-news-btn').click();
      const f = document.getElementById('news-form');
      f.elements['title'].value = 'News Add Ref';
      f.elements['source'].value = 'Example Wire';
      f.elements['url'].value = 'https://example.org/news';
      f.elements['published_at'].value = '2026-08-15';
      f.elements['summary'].value = 'a summary';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(await cdp.waitFor(`(document.body.innerText||'').includes('News Add Ref')`));
  assert.ok(await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('not scraped')`));
});

test("news edited via UI", async () => {
  await cdp.evalJs(`
    (() => {
      [...document.querySelectorAll('.edit-news')].find((b) => b.parentElement.parentElement.innerText.includes('News Add Ref')).click();
    })()
  `);
  await cdp.waitFor(`!!document.getElementById('news-form')`);
  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('news-form');
      f.elements['title'].value = 'News Updated Title';
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(
      `(document.body.innerText||'').includes('News Updated Title') && !(document.body.innerText||'').includes('News Add Ref')`
    )
  );
});

test("news removed via UI", async () => {
  await cdp.evalJs(`
    (() => {
      const btn = [...document.querySelectorAll('.remove-news')].find((b) => b.parentElement.parentElement.innerText.includes('News Updated Title'));
      window.confirm = () => true;
      btn.click();
    })()
  `);
  assert.ok(
    await cdp.waitFor(`!(document.body.innerText||'').includes('News Updated Title')`)
  );
});

// --- Logo UI flows + inline-render confirmation (Stage 8 additions) ---

test("logo uploaded via UI renders inline on profile", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  await cdp.waitFor(`!!document.getElementById('logo-file')`);
  const before = await cdp.evalJs(`(document.querySelector('.profile-logo')||{}).src || ''`);
  await cdp.evalJs(fileUploadJs("logo-file", TINY_PNG_A, "logo.png", "image/png"));
  assert.ok(
    await cdp.waitFor(
      `!!document.querySelector('.profile-logo') && document.querySelector('.profile-logo').src !== ${JSON.stringify(before)} && (() => { const i = document.querySelector('.profile-logo'); return i.complete && i.naturalWidth > 0; })()`
    )
  );
});

test("logo shown as thumbnail on companies list", async () => {
  await cdp.evalJs("location.hash = '#/'");
  assert.ok(await cdp.waitFor(`!!document.querySelector('.company-logo-thumb')`));
  assert.ok(
    await cdp.evalJs(
      `(() => { const i = document.querySelector('.company-logo-thumb'); return i.complete && i.naturalWidth > 0; })()`
    )
  );
});

test("logo replaced via UI", async () => {
  await cdp.evalJs("location.hash = '#/companies/1'");
  await cdp.waitFor(`!!document.getElementById('logo-file')`);
  const before = await cdp.evalJs(`(document.querySelector('.profile-logo')||{}).src || ''`);
  await cdp.evalJs(fileUploadJs("logo-file", TINY_PNG_B, "logo2.png", "image/png"));
  assert.ok(
    await cdp.waitFor(
      `!!document.querySelector('.profile-logo') && document.querySelector('.profile-logo').src !== ${JSON.stringify(before)}`
    )
  );
  assert.ok(
    await cdp.evalJs(
      `(() => { const i = document.querySelector('.profile-logo'); return i.complete && i.naturalWidth > 0; })()`
    )
  );
});

test("logo removed via UI renders nothing", async () => {
  await cdp.evalJs(`
    (() => {
      window.confirm = () => true;
      document.getElementById('logo-remove').click();
    })()
  `);
  assert.ok(await cdp.waitFor(`!document.querySelector('.profile-logo')`));
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('no logo set')`)
  );
});

// --- Sprint 02 auth (self-service password change) ---

test("password changed via UI; old password rejected, new password signs in, then restored", async () => {
  const NEW_PW = "sprint02-new-admin-pw";

  await cdp.evalJs("location.hash = '#/password'");
  await cdp.waitFor(`!!document.getElementById('password-form')`);

  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('password-form');
      f.elements['current_password'].value = ${JSON.stringify(PW)};
      f.elements['new_password'].value = ${JSON.stringify(NEW_PW)};
      f.elements['confirm_password'].value = ${JSON.stringify(NEW_PW)};
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').includes('Password updated')`)
  );

  await cdp.evalJs("document.getElementById('nav-logout').click()");
  await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('sign in to continue')`);

  await cdp.evalJs(loginEvalJs(PW));
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('invalid email or password')`)
  );

  await cdp.evalJs(loginEvalJs(NEW_PW));
  await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('add company')`);

  await cdp.evalJs("location.hash = '#/password'");
  await cdp.waitFor(`!!document.getElementById('password-form')`);
  await cdp.evalJs(`
    (() => {
      const f = document.getElementById('password-form');
      f.elements['current_password'].value = ${JSON.stringify(NEW_PW)};
      f.elements['new_password'].value = ${JSON.stringify(PW)};
      f.elements['confirm_password'].value = ${JSON.stringify(PW)};
      f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()
  `);
  assert.ok(
    await cdp.waitFor(`(document.body.innerText||'').includes('Password updated')`)
  );

  await cdp.evalJs("document.getElementById('nav-logout').click()");
  await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('sign in to continue')`);

  await cdp.evalJs(loginEvalJs(PW));
  await cdp.waitFor(`(document.body.innerText||'').toLowerCase().includes('add company')`);
});