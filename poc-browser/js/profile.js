import {
  getCompany,
  listCountries,
  createLocation,
  updateLocation,
  deleteLocation,
  createReference,
  updateReference,
  deleteReference,
  createNews,
  updateNews,
  deleteNews,
  getSetting,
} from "./api.js";
import { collectCurrentsCandidates } from "./news-ranking/currents.js";
import { runLiveRanking } from "./news-ranking/controller.js";
import { createGemmaRanker } from "./news-ranking/model/gemma.js";
import {
  esc,
  completenessBadge,
  formatDate,
  showToast,
  canMutate,
} from "./app.js";

const LOCATION_TYPES = ["Headquarters", "Office", "Plant", "Other"];

export async function renderProfile(container, companyId) {
  const write = canMutate();
  container.innerHTML = `
    <div class="mb-3">
      <a href="#/" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1"></i>Back to companies
      </a>
    </div>
    <div id="profile-body" class="text-center text-secondary py-5">Loading…</div>`;

  const body = container.querySelector("#profile-body");
  let company;
  let countries;
  try {
    [company, countries] = await Promise.all([
      getCompany(companyId),
      listCountries(),
    ]);
  } catch (err) {
    body.innerHTML = `
      <div class="alert alert-danger mx-auto" style="max-width: 480px;">
        <i class="bi bi-exclamation-triangle me-2"></i>${esc(err.message)}
      </div>`;
    return;
  }

  body.className = "";
  body.innerHTML = `
    <div class="row g-4">
      <div class="col-lg-7">
        ${mainCard(company)}
        ${write ? `
        <div class="d-flex gap-2 flex-wrap mb-4">
          <a href="#/companies/${company.id}/edit" class="btn btn-outline-secondary">
            <i class="bi bi-pencil me-1"></i>Edit
          </a>
        </div>
` : ""}
        ${locationsCard(company, countries, write)}
      </div>

      <div class="col-lg-5">
        ${filesCard(company, write)}
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-6">${referencesCard(company, write)}</div>
      <div class="col-lg-6">${newsCard(company, write)}</div>
    </div>`;

  wireLocations(container, body, company, countries, write);
  wireReferences(container, body, company, write);
  wireNews(container, body, company, write);
}

function mainCard(company) {
  return `
    <div class="card mb-4">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
          <div class="d-flex align-items-center gap-3">
            <h2 class="h4 mb-0">${esc(company.name)}</h2>
          </div>
          ${completenessBadge(company)}
        </div>
        <dl class="row profile-dl mb-0">
          ${detailRow("Industry", company.industry ? esc(company.industry.name) : "")}
          ${detailRow("Headquarters", esc(company.hq_location))}
          ${detailRow("Website", websiteHtml(company.website))}
          ${detailRow("Contact email", mailHtml(company.contact_email))}
          ${detailRow("Contact phone", esc(company.contact_phone))}
          ${detailRow("Description", esc(company.description))}
        </dl>
      </div>
    </div>`;
}

function locationsCard(company, countries, write) {
  const locs = company.locations || [];
  const items =
    locs.length === 0
      ? `
      <div class="text-center text-secondary py-3">
        <i class="bi bi-geo-alt d-block fs-3 mb-2"></i>
        No locations yet.
      </div>`
      : locs
          .map(
            (l) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <div class="fw-semibold">${esc(l.label)}</div>
          <div class="stat-muted">
            ${esc(l.city)}${l.address ? ` · ${esc(l.address)}` : ""} · ${esc(l.country_name ?? l.country_code)}
            <span class="badge rounded-pill text-bg-light border ms-1">${esc(l.type)}</span>
          </div>
        </div>
        ${write ? `
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="btn btn-sm btn-outline-secondary edit-location" data-id="${l.id}">
            <i class="bi bi-pencil"></i><span class="visually-hidden">Edit</span>
          </button>
          <button class="btn btn-sm btn-outline-danger remove-location" data-id="${l.id}">
            <i class="bi bi-trash"></i><span class="visually-hidden">Remove</span>
          </button>
        </div>` : ""}
      </div>`
          )
          .join("");
  return `
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span class="muted-label">Locations</span>
        <div class="d-flex gap-2 align-items-center">
          <span class="badge text-bg-light border">${locs.length}</span>
          ${write ? `
          <button class="btn btn-sm btn-outline-primary" id="add-location-btn">
            <i class="bi bi-plus-lg me-1"></i>Add location
          </button>` : ""}
        </div>
      </div>
      <div class="card-body">
        <div id="location-list">${items}</div>
        <div id="location-editor" class="d-none mt-3"></div>
      </div>
    </div>`;
}

function referencesCard(company, write) {
  const refs = company.references || [];
  const items =
    refs.length === 0
      ? `
      <div class="text-center text-secondary py-3">
        <i class="bi bi-link-45deg d-block fs-3 mb-2"></i>
        No references yet.
      </div>`
      : refs
          .map(
            (r) => `
      <div class="py-2 border-bottom">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="fw-semibold">
              <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
            </div>
            ${r.description ? `<div class="stat-muted">${esc(r.description)}</div>` : ""}
            <div class="stat-muted small">
              Added by ${esc(r.added_by)} · added ${esc(formatDate(r.created_at))}
              ${r.updated_at !== r.created_at ? ` · updated ${esc(formatDate(r.updated_at))}` : ""}
            </div>
          </div>
          ${write ? `
          <div class="d-flex gap-2 flex-shrink-0">
            <button class="btn btn-sm btn-outline-secondary edit-reference" data-id="${r.id}">
              <i class="bi bi-pencil"></i><span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm btn-outline-danger remove-reference" data-id="${r.id}">
              <i class="bi bi-trash"></i><span class="visually-hidden">Remove</span>
            </button>
          </div>` : ""}
        </div>
      </div>`
          )
          .join("");
  return `
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span class="muted-label">References</span>
        <div class="d-flex gap-2 align-items-center">
          <span class="badge text-bg-light border">${refs.length}</span>
          ${write ? `
          <button class="btn btn-sm btn-outline-primary" id="add-reference-btn">
            <i class="bi bi-plus-lg me-1"></i>Add reference
          </button>` : ""}
        </div>
      </div>
      <div class="card-body">
        <div id="reference-list">${items}</div>
        <div id="reference-editor" class="d-none mt-3"></div>
      </div>
    </div>`;
}

function newsCard(company, write) {
  const news = company.news || [];
  const items =
    news.length === 0
      ? `
      <div class="text-center text-secondary py-3">
        <i class="bi bi-newspaper d-block fs-3 mb-2"></i>
        No news articles yet.
      </div>`
      : news
          .map(
            (n) => `
      <div class="py-2 border-bottom">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <div class="fw-semibold">
              <a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
            </div>
            <div class="stat-muted">${esc(n.source)} · ${esc(n.published_at)}</div>
            ${n.summary ? `<div class="stat-muted">${esc(n.summary)}</div>` : ""}
            <div class="mt-1">
              ${n.is_scraped
                ? `<span class="badge rounded-pill badge-scraped">Scraped</span>`
                : `<span class="badge rounded-pill text-bg-light border">Not scraped</span>`}
              <span class="stat-muted small ms-1">added ${esc(formatDate(n.created_at))}</span>
            </div>
          </div>
          ${write ? `
          <div class="d-flex gap-2 flex-shrink-0">
            <button class="btn btn-sm btn-outline-secondary edit-news" data-id="${n.id}">
              <i class="bi bi-pencil"></i><span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm btn-outline-danger remove-news" data-id="${n.id}">
              <i class="bi bi-trash"></i><span class="visually-hidden">Remove</span>
            </button>
          </div>` : ""}
        </div>
      </div>`
          )
          .join("");
  return `
    <div class="card mb-4">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span class="muted-label">News</span>
        <div class="d-flex gap-2 align-items-center">
          <span class="badge text-bg-light border">${news.length}</span>
          ${write ? `
          <button class="btn btn-sm btn-outline-primary" id="find-news-btn">
            <i class="bi bi-stars me-1"></i>Find news
          </button>
          <button class="btn btn-sm btn-outline-primary" id="add-news-btn">
            <i class="bi bi-plus-lg me-1"></i>Add news
          </button>` : ""}
        </div>
      </div>
      <div class="card-body">
        <div id="news-list">${items}</div>
        <div id="news-editor" class="d-none mt-3"></div>
      </div>
    </div>`;
}

function filesCard() {
  return `<div class="card mb-4"><div class="card-header">Files</div><div class="card-body text-secondary">Files are not included in this browser workspace.</div></div>`;
}

function detailRow(label, value) {
  const rendered = value == null || value === "" ? "<span class='text-secondary'>—</span>" : value;
  return `
    <dt class="col-sm-4 text-muted">${label}</dt>
    <dd class="col-sm-8">${rendered}</dd>`;
}

function websiteHtml(url) {
  if (!url) return "";
  const safe = esc(url);
  return `<a href="${safe}" target="_blank" rel="noopener">${safe}</a>`;
}

function mailHtml(email) {
  if (!email) return "";
  return `<a href="mailto:${esc(email)}">${esc(email)}</a>`;
}

function locationEditorHtml(countries, loc = null) {
  const countryOptions = [
    `<option value="">Select country…</option>`,
    ...countries.map(
      (c) => `
      <option value="${esc(c.code)}" ${loc && loc.country_code === c.code ? "selected" : ""}>
        ${esc(c.name)}
      </option>`
    ),
  ].join("");
  const typeOptions = LOCATION_TYPES.map(
    (t) => `<option value="${t}" ${loc && loc.type === t ? "selected" : ""}>${t}</option>`
  ).join("");
  return `
    <form id="location-form" class="border-top pt-3">
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label small mb-1" for="loc-label">Label</label>
          <input id="loc-label" name="label" class="form-control form-control-sm"
                 value="${loc ? esc(loc.label) : ""}" placeholder="e.g. Global HQ" required>
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1" for="loc-city">City</label>
          <input id="loc-city" name="city" class="form-control form-control-sm"
                 value="${loc ? esc(loc.city) : ""}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1" for="loc-country">Country</label>
          <select id="loc-country" name="country" class="form-select form-select-sm" required>
            ${countryOptions}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1" for="loc-type">Type</label>
          <select id="loc-type" name="type" class="form-select form-select-sm">
            ${typeOptions}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label small mb-1" for="loc-address">
            Address / region <span class="text-secondary">(optional)</span>
          </label>
          <input id="loc-address" name="address" class="form-control form-control-sm"
                 value="${loc ? esc(loc.address ?? "") : ""}">
        </div>
      </div>
      <div class="d-flex gap-2 mt-2">
        <button type="submit" class="btn btn-sm btn-primary">
          <i class="bi bi-check-lg me-1"></i>${loc ? "Save location" : "Add location"}
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary location-cancel">Cancel</button>
      </div>
      <div class="location-editor-error mt-2"></div>
    </form>`;
}

function referenceEditorHtml(ref = null) {
  return `
    <form id="reference-form" class="border-top pt-3">
      <div class="mb-2">
        <label class="form-label small mb-1" for="ref-title">Title</label>
        <input id="ref-title" name="title" class="form-control form-control-sm"
               value="${ref ? esc(ref.title) : ""}" required>
      </div>
      <div class="mb-2">
        <label class="form-label small mb-1" for="ref-url">URL</label>
        <input id="ref-url" name="url" type="url" class="form-control form-control-sm"
               value="${ref ? esc(ref.url) : ""}" required>
      </div>
      <div class="mb-2">
        <label class="form-label small mb-1" for="ref-description">
          Description <span class="text-secondary">(optional)</span>
        </label>
        <textarea id="ref-description" name="description" class="form-control form-control-sm" rows="2">${
          ref ? esc(ref.description ?? "") : ""
        }</textarea>
      </div>
      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-sm btn-primary">
          <i class="bi bi-check-lg me-1"></i>${ref ? "Save reference" : "Add reference"}
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary reference-cancel">Cancel</button>
      </div>
      <div class="reference-editor-error mt-2"></div>
    </form>`;
}

function newsEditorHtml(item = null) {
  return `
    <form id="news-form">
      <div class="mb-2">
        <label class="form-label small mb-1" for="news-title">Title</label>
        <input id="news-title" name="title" class="form-control form-control-sm"
               value="${item ? esc(item.title) : ""}" required>
      </div>
      <div class="row g-2">
        <div class="col-md-6">
          <label class="form-label small mb-1" for="news-source">Source</label>
          <input id="news-source" name="source" class="form-control form-control-sm"
                 value="${item ? esc(item.source) : ""}" required>
        </div>
        <div class="col-md-6">
          <label class="form-label small mb-1" for="news-date">Publication date</label>
          <input id="news-date" name="published_at" type="date" class="form-control form-control-sm"
                 value="${item ? esc(item.published_at) : ""}" required>
        </div>
      </div>
      <div class="mb-2">
        <label class="form-label small mb-1" for="news-url">URL</label>
        <input id="news-url" name="url" type="url" class="form-control form-control-sm"
               value="${item ? esc(item.url) : ""}" required>
      </div>
      <div class="mb-2">
        <label class="form-label small mb-1" for="news-summary">
          Summary / snippet <span class="text-secondary">(optional)</span>
        </label>
        <textarea id="news-summary" name="summary" class="form-control form-control-sm" rows="2">${
          item ? esc(item.summary ?? "") : ""
        }</textarea>
      </div>
      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-sm btn-primary">
          <i class="bi bi-check-lg me-1"></i>${item ? "Save news" : "Add news"}
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary news-cancel">Cancel</button>
      </div>
      <div class="news-editor-error mt-2"></div>
    </form>`;
}

function wireLocations(container, body, company, countries, write) {
  const editor = body.querySelector("#location-editor");
  let editingId = null;

  function openEditor(loc) {
    editingId = loc ? loc.id : null;
    editor.innerHTML = locationEditorHtml(countries, loc);
    editor.classList.remove("d-none");
    const form = editor.querySelector("#location-form");
    const errEl = editor.querySelector(".location-editor-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.innerHTML = "";
      const payload = {
        label: form.elements["label"].value.trim(),
        address: form.elements["address"].value.trim() || null,
        city: form.elements["city"].value.trim(),
        country_code: form.elements["country"].value,
        type: form.elements["type"].value,
      };
      if (!payload.label || !payload.city || !payload.country_code) return;
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        if (editingId) {
          await updateLocation(company.id, editingId, payload);
          showToast("Location updated");
        } else {
          await createLocation(company.id, payload);
          showToast("Location added");
        }
        renderProfile(container, company.id);
      } catch (err) {
        btn.disabled = false;
        errEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
      }
    });
    editor.querySelector(".location-cancel").addEventListener("click", closeEditor);
  }

  function closeEditor() {
    editor.classList.add("d-none");
    editor.innerHTML = "";
  }

  const addLocBtn = body.querySelector("#add-location-btn");
  if (addLocBtn) addLocBtn.addEventListener("click", () => openEditor(null));
  body.querySelectorAll(".edit-location").forEach((btn) => {
    btn.addEventListener("click", () => {
      const loc = (company.locations || []).find((l) => l.id === Number(btn.dataset.id));
      openEditor(loc);
    });
  });
  body.querySelectorAll(".remove-location").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Remove this location?")) return;
      try {
        await deleteLocation(company.id, Number(btn.dataset.id));
        showToast("Location removed");
        renderProfile(container, company.id);
      } catch (err) {
        showToast(err.message, "danger");
      }
    });
  });
}

function wireReferences(container, body, company, write) {
  const editor = body.querySelector("#reference-editor");
  let editingId = null;

  function openEditor(ref) {
    editingId = ref ? ref.id : null;
    editor.innerHTML = referenceEditorHtml(ref);
    editor.classList.remove("d-none");
    const form = editor.querySelector("#reference-form");
    const errEl = editor.querySelector(".reference-editor-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.innerHTML = "";
      const payload = {
        title: form.elements["title"].value.trim(),
        url: form.elements["url"].value.trim(),
        description: form.elements["description"].value.trim() || null,
      };
      if (!payload.title || !payload.url) return;
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        if (editingId) {
          await updateReference(company.id, editingId, payload);
          showToast("Reference updated");
        } else {
          await createReference(company.id, payload);
          showToast("Reference added");
        }
        renderProfile(container, company.id);
      } catch (err) {
        btn.disabled = false;
        errEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
      }
    });
    editor.querySelector(".reference-cancel").addEventListener("click", () => {
      editor.classList.add("d-none");
      editor.innerHTML = "";
    });
  }

  const addRefBtn = body.querySelector("#add-reference-btn");
  if (addRefBtn) addRefBtn.addEventListener("click", () => openEditor(null));
  body.querySelectorAll(".edit-reference").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ref = (company.references || []).find((r) => r.id === Number(btn.dataset.id));
      openEditor(ref);
    });
  });
  body.querySelectorAll(".remove-reference").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Remove this reference?")) return;
      try {
        await deleteReference(company.id, Number(btn.dataset.id));
        showToast("Reference removed");
        renderProfile(container, company.id);
      } catch (err) {
        showToast(err.message, "danger");
      }
    });
  });
}

function wireNews(container, body, company, write) {
  let editingId = null;

  function openEditor(item) {
    editingId = item ? item.id : null;
    const overlay = openNewsOverlay(item ? "Edit news" : "Add news", newsEditorHtml(item));
    const form = overlay.content.querySelector("#news-form");
    const errEl = overlay.content.querySelector(".news-editor-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.innerHTML = "";
      const payload = {
        title: form.elements["title"].value.trim(),
        source: form.elements["source"].value.trim(),
        url: form.elements["url"].value.trim(),
        published_at: form.elements["published_at"].value,
        summary: form.elements["summary"].value.trim() || null,
      };
      if (!payload.title || !payload.source || !payload.url || !payload.published_at) return;
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        if (editingId) {
          await updateNews(company.id, editingId, payload);
          showToast("News updated");
        } else {
          await createNews(company.id, payload);
          showToast("News added");
        }
        overlay.close();
        renderProfile(container, company.id);
      } catch (err) {
        btn.disabled = false;
        errEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
      }
    });
    overlay.content.querySelector(".news-cancel").addEventListener("click", overlay.close);
  }

  const addNewsBtn = body.querySelector("#add-news-btn");
  if (addNewsBtn) addNewsBtn.addEventListener("click", () => openEditor(null));
  const findNewsBtn = body.querySelector("#find-news-btn");
  if (findNewsBtn) findNewsBtn.addEventListener("click", () => openFinder());
  body.querySelectorAll(".edit-news").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = (company.news || []).find((n) => n.id === Number(btn.dataset.id));
      openEditor(item);
    });
  });
  body.querySelectorAll(".remove-news").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!window.confirm("Remove this news article?")) return;
      try {
        await deleteNews(company.id, Number(btn.dataset.id));
        showToast("News removed");
        renderProfile(container, company.id);
      } catch (err) {
        showToast(err.message, "danger");
      }
    });
  });

  function openFinder() {
    editingId = null;
    const overlay = openNewsOverlay("Find recent news", newsFinderHtml());
    const count = overlay.content.querySelector("#find-news-count");
    const status = overlay.content.querySelector("#find-news-status");
    overlay.content.querySelector(".news-finder-cancel").addEventListener("click", overlay.close);
    const run = overlay.content.querySelector("#find-news-run");
    run.addEventListener("click", async () => {
      run.disabled = true;
      status.innerHTML = `<div class="alert alert-info py-2 mb-0">Finding recent Currents candidates for ${esc(company.name)}…</div>`;
      try {
        const apiKey = (await getSetting("news.currents.api_key"))?.value;
        if (!apiKey) throw new Error('Add your Currents API key in Workspace before finding news.');
        const collected = await collectCurrentsCandidates({company, apiKey, limit: 10});
        if (!collected.length) throw new Error("Currents returned no usable recent articles for this company.");
        status.innerHTML = `<div class="alert alert-info py-2 mb-0">Loading Gemma to rank ${collected.length} Currents candidates locally…</div>`;
        const model = await createGemmaRanker({onProgress: (message) => { status.innerHTML = `<div class="alert alert-info py-2 mb-0">${esc(message)}</div>`; }});
        status.innerHTML = `<div class="alert alert-info py-2 mb-0">Ranking candidate articles locally…</div>`;
        const result = await runLiveRanking({company, existingNews: company.news || [], requested: Number(count.value), model, collectCandidates: async () => collected});
        if (!result.selected.length) throw new Error("Gemma did not select any usable articles.");
        renderFinderPreview(result, status, overlay, company, container);
      } catch (err) {
        status.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
        run.disabled = false;
      }
    });
  }
}

function newsFinderHtml() {
  return `<div id="news-finder">
    <p class="text-secondary small">Currents provides candidates using your browser-local API key. Gemma ranks them locally; nothing is added until you confirm.</p>
    <div class="row g-2 align-items-end"><div class="col-sm-4"><label class="form-label small mb-1" for="find-news-source">News source</label><select class="form-select form-select-sm" id="find-news-source"><option value="currents" selected>Currents News API</option></select></div><div class="col-sm-3"><label class="form-label small mb-1" for="find-news-count">Articles</label><select class="form-select form-select-sm" id="find-news-count"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></div><div class="col-sm-5 d-flex gap-2"><button class="btn btn-sm btn-primary" id="find-news-run"><i class="bi bi-stars me-1"></i>Find and rank</button><button class="btn btn-sm btn-outline-secondary news-finder-cancel">Cancel</button></div></div>
    <div class="mt-3" id="find-news-status"></div>
  </div>`;
}

function renderFinderPreview(result, status, overlay, company, container) {
  const rows = result.selected.map((item, index) => `<div class="form-check border-bottom py-2"><input class="form-check-input news-candidate" type="checkbox" value="${item.candidate_id}" id="candidate-${item.candidate_id}" checked><label class="form-check-label w-100" for="candidate-${item.candidate_id}"><span class="fw-semibold">${index + 1}. ${esc(item.title)}</span><span class="d-block small text-secondary">${esc(item.publisher)} · ${esc(item.published_at)}</span><span class="d-block small text-secondary">${esc(item.snippet)}</span></label></div>`).join("");
  status.innerHTML = `<div class="alert alert-success py-2">Gemma ranked ${result.candidates.length} new Currents candidates. Review the selected articles before adding them.</div><div class="border rounded p-2">${rows}<div class="d-flex gap-2 pt-3"><button class="btn btn-sm btn-primary" id="confirm-found-news">Add selected news</button><button class="btn btn-sm btn-outline-secondary" id="cancel-found-news">Cancel</button></div></div>`;
  status.querySelector("#cancel-found-news").addEventListener("click", overlay.close);
  status.querySelector("#confirm-found-news").addEventListener("click", async (event) => {
    const chosen = new Set([...status.querySelectorAll(".news-candidate:checked")].map((input) => Number(input.value)));
    const selected = result.selected.filter((item) => chosen.has(item.candidate_id));
    if (!selected.length) return;
    event.currentTarget.disabled = true;
    try {
      for (const item of selected) await createNews(company.id, {title: item.title, source: item.publisher, url: item.url, published_at: item.published_at, summary: item.snippet, is_scraped: true});
      showToast(`${selected.length} news article${selected.length === 1 ? "" : "s"} added`);
      overlay.close(); renderProfile(container, company.id);
    } catch (err) {
      event.currentTarget.disabled = false;
      status.insertAdjacentHTML("afterbegin", `<div class="alert alert-danger py-2">${esc(err.message)}</div>`);
    }
  });
}

function openNewsOverlay(title, content) {
  const element = document.createElement("div");
  element.className = "modal";
  element.tabIndex = -1;
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><div class="modal-header"><h2 class="modal-title fs-5">${esc(title)}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body">${content}</div></div></div>`;
  document.body.appendChild(element);
  const modal = window.bootstrap.Modal.getOrCreateInstance(element, { focus: true });
  element.addEventListener("hidden.bs.modal", () => { modal.dispose(); element.remove(); }, { once: true });
  modal.show();
  return { content: element.querySelector(".modal-body"), close: () => modal.hide() };
}
