import { listCompanies, listCountries } from "./api.js";
import { esc, completenessBadge, canMutate } from "./app.js";

export async function renderList(container) {
  container.innerHTML = `
    <div class="row mb-3">
      <div class="col">
        <h1 class="h4 mb-0">Companies</h1>
      </div>
      ${canMutate() ? `
      <div class="col-auto">
        <a class="btn btn-primary" href="#/companies/new">
          <i class="bi bi-plus-lg me-1"></i>Add company
        </a>
      </div>` : ""}
    </div>
    <div class="row mb-3 g-2">
      <div class="col-md-6 col-lg-4">
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input type="search" id="company-search" class="form-control"
                 placeholder="Search by name…" aria-label="Search companies">
        </div>
      </div>
      <div class="col-md-6 col-lg-4" id="country-filter-slot"></div>
    </div>
    <div id="list-body" class="card">
      <div class="card-body text-center text-secondary py-4">Loading…</div>
    </div>`;

  const search = container.querySelector("#company-search");
  const body = container.querySelector("#list-body");
  const slot = container.querySelector("#country-filter-slot");
  const selected = new Set();

  try {
    const countries = await listCountries();
    slot.innerHTML = countryFilterHtml(countries, selected);
    wireFilter(slot, selected, () => load());
  } catch (err) {
    slot.innerHTML = "";
  }

  let debounceTimer = null;

  async function load() {
    const q = search.value.trim();
    let companies;
    try {
      companies = await listCompanies(q, [...selected]);
    } catch (err) {
      body.innerHTML = `<div class="alert alert-danger m-3 mb-0">${esc(err.message)}</div>`;
      return;
    }
    body.innerHTML = renderTable(companies);
  }

  search.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 250);
  });

  load();
}

function wireFilter(slot, selected, reload) {
  const clearBtn = slot.querySelector("#clear-countries");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      selected.clear();
      slot.querySelectorAll(".country-check").forEach((cb) => (cb.checked = false));
      updateFilterBadge(slot, 0);
      reload();
    });
  }
  slot.querySelectorAll(".country-check").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(cb.value);
      else selected.delete(cb.value);
      updateFilterBadge(slot, selected.size);
      reload();
    });
  });
}

function countryFilterHtml(countries, selected) {
  const options = countries
    .map(
      (c) => `
      <div class="form-check">
        <input class="form-check-input country-check" type="checkbox" value="${esc(c.code)}"
               id="country-${esc(c.code)}" ${selected.has(c.code) ? "checked" : ""}>
        <label class="form-check-label" for="country-${esc(c.code)}">${esc(c.name)}</label>
      </div>`
    )
    .join("");
  return `
    <div class="dropdown">
      <button class="btn btn-outline-secondary dropdown-toggle w-100 text-start" type="button"
              data-bs-toggle="dropdown" aria-expanded="false">
        <i class="bi bi-funnel me-1"></i>Country filter
        <span id="country-filter-badge"></span>
      </button>
      <div class="dropdown-menu p-3 country-menu">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="muted-label">Filter by country</span>
          <button type="button" class="btn btn-sm btn-outline-secondary" id="clear-countries">Clear</button>
        </div>
        <div class="country-options">${options}</div>
      </div>
    </div>`;
}

function updateFilterBadge(slot, count) {
  const badge = slot.querySelector("#country-filter-badge");
  if (badge) {
    badge.innerHTML = count
      ? `<span class="badge rounded-pill text-bg-primary ms-1">${count}</span>`
      : "";
  }
}

function renderTable(companies) {
  if (companies.length === 0) {
    return `
      <div class="card-body text-center text-secondary py-5">
        <i class="bi bi-inbox d-block fs-2 mb-2"></i>
        No companies found.
      </div>`;
  }

  const rows = companies
    .map(
      (c) => `
      <tr class="company-row" data-id="${c.id}">
        <td>
          <div class="d-flex align-items-center gap-2">
            ${c.logo_url ? `<img src="${esc(c.logo_url)}" class="company-logo-thumb" alt="">` : ""}
            <a href="#/companies/${c.id}" class="fw-semibold text-decoration-none">${esc(c.name)}</a>
          </div>
        </td>
        <td>${c.industry ? esc(c.industry.name) : '<span class="stat-muted">—</span>'}</td>
        <td>${esc(c.hq_location) || '<span class="stat-muted">—</span>'}</td>
        <td>
          <span class="stat-muted"><i class="bi bi-paperclip me-1"></i>${c.artifacts_count ?? 0}</span>
        </td>
        <td>${completenessBadge(c)}</td>
      </tr>`
    )
    .join("");

  return `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Industry</th>
            <th scope="col">Headquarters</th>
            <th scope="col">Files</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}