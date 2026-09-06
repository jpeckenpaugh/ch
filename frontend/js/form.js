import {
  createCompany,
  updateCompany,
  deleteCompany,
  getCompany,
  listIndustries,
  listCountries,
  createLocation,
} from "./api.js";
import { esc, showToast, canMutate } from "./app.js";

const FIELDS = [
  ["name", "Name", "text", true],
  ["website", "Website", "url", false],
  ["contact_email", "Contact email", "email", false],
  ["contact_phone", "Contact phone", "text", false],
  ["description", "Description", "textarea", false],
];

const LOCATION_TYPES = ["Headquarters", "Office", "Plant", "Other"];

export async function renderForm(container, companyId) {
  if (!canMutate()) {
    container.innerHTML = `
      <div class="row justify-content-center">
        <div class="col-sm-8 col-md-6 col-lg-5">
          <div class="card mt-4">
            <div class="card-body p-4 text-center">
              <i class="bi bi-shield-lock d-block fs-1 text-secondary mb-3"></i>
              <h1 class="h4 mb-2">Not permitted</h1>
              <p class="text-secondary mb-0">
                Your account does not have permission to create or edit companies.
              </p>
              <a href="#/" class="btn btn-outline-secondary mt-3">Back to companies</a>
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  const editing = companyId != null;
  let company = null;
  let industries = [];
  let countries = [];
  try {
    if (editing) company = await getCompany(companyId);
    industries = await listIndustries();
    if (!editing) countries = await listCountries();
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger mx-auto" style="max-width: 560px;">
        <i class="bi bi-exclamation-triangle me-2"></i>${esc(err.message)}
      </div>`;
    return;
  }

  const backHash = editing ? `#/companies/${companyId}` : "#/";
  container.innerHTML = `
    <div class="mb-3">
      <a href="${backHash}" class="btn btn-sm btn-outline-secondary">
        <i class="bi bi-arrow-left me-1"></i>Back
      </a>
    </div>
    <div class="card mx-auto" style="max-width: 720px;">
      <div class="card-body">
        <h1 class="h4 mb-4">${editing ? esc(`Edit ${company.name}`) : "Add company"}</h1>
        <form id="company-form" novalidate>
          <div id="form-alert"></div>
          ${FIELDS.map(fieldHtml).join("")}
          <div class="mb-3">
            <label for="field-industry" class="form-label">Industry</label>
            <select id="field-industry" name="industry" class="form-select">
              <option value="">No industry</option>
              ${industries.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join("")}
            </select>
          </div>
          ${!editing ? locationEditorSection(countries) : ""}
          <div class="d-flex gap-2 mt-4">
            <button type="submit" class="btn btn-primary" id="save-btn">
              <i class="bi bi-check-lg me-1"></i>Save
            </button>
            <a href="${backHash}" class="btn btn-outline-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>`;

  const form = container.querySelector("#company-form");
  const saveBtn = container.querySelector("#save-btn");
  const alertEl = container.querySelector("#form-alert");

  if (editing && company) {
    FIELDS.forEach(([name]) => {
      const input = form.elements[name];
      if (input) input.value = company[name] ?? "";
    });
    form.elements["industry"].value = company.industry ? company.industry.id : "";
  }

  if (!editing) {
    wireLocationRows(container, countries);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertEl.innerHTML = "";
    const data = {
      name: form.elements["name"].value.trim(),
      industry_id: form.elements["industry"].value
        ? Number(form.elements["industry"].value)
        : null,
      website: form.elements["website"].value.trim() || null,
      contact_email: form.elements["contact_email"].value.trim() || null,
      contact_phone: form.elements["contact_phone"].value.trim() || null,
      description: form.elements["description"].value.trim() || null,
    };

    if (!data.name) {
      showFieldError(form, "name");
      return;
    }

    let locations = [];
    if (!editing) {
      try {
        locations = collectLocations(form);
      } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger py-2">${esc(err.message)}</div>`;
        return;
      }
    }

    saveBtn.disabled = true;
    try {
      if (editing) {
        const saved = await updateCompany(companyId, data);
        showToast("Company updated");
        window.location.hash = `#/companies/${saved.id}`;
      } else {
        const saved = await createCompany(data);
        if (locations.length) {
          try {
            for (const loc of locations) {
              await createLocation(saved.id, loc);
            }
          } catch (err) {
            try {
              await deleteCompany(saved.id);
            } catch {
              /* best effort rollback */
            }
            saveBtn.disabled = false;
            alertEl.innerHTML = `<div class="alert alert-danger py-2">${esc(err.message)}</div>`;
            return;
          }
        }
        showToast("Company added");
        window.location.hash = `#/companies/${saved.id}`;
      }
    } catch (err) {
      saveBtn.disabled = false;
      if (err.status === 422 && !data.name) {
        showFieldError(form, "name");
      } else {
        alertEl.innerHTML = `<div class="alert alert-danger py-2">${esc(err.message)}</div>`;
      }
    }
  });
}

function locationEditorSection(countries) {
  const countryOptions = [
    `<option value="">Select country…</option>`,
    ...countries.map(
      (c) => `<option value="${esc(c.code)}">${esc(c.name)}</option>`
    ),
  ].join("");
  const typeOptions = LOCATION_TYPES.map(
    (t) => `<option value="${t}">${t}</option>`
  ).join("");
  return `
    <div class="card mb-3">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span class="muted-label">Initial locations</span>
        <button type="button" class="btn btn-sm btn-outline-primary" id="add-location-row">
          <i class="bi bi-plus-lg me-1"></i>Add location
        </button>
      </div>
      <div class="card-body">
        <div id="location-rows"></div>
        <div class="text-secondary small">
          Optional. Locations are attached after the company is created; a location
          error undoes the creation.
        </div>
      </div>
    </div>`;
}

function locationRowHtml(countries) {
  const countryOptions = [
    `<option value="">Select country…</option>`,
    ...countries.map(
      (c) => `<option value="${esc(c.code)}">${esc(c.name)}</option>`
    ),
  ].join("");
  const typeOptions = LOCATION_TYPES.map(
    (t) => `<option value="${t}">${t}</option>`
  ).join("");
  return `
    <div class="location-row border rounded p-2 mb-2 bg-white">
      <div class="row g-2">
        <div class="col-md-4">
          <input data-field="label" class="form-control form-control-sm" placeholder="Label (e.g. Global HQ)">
        </div>
        <div class="col-md-4">
          <input data-field="city" class="form-control form-control-sm" placeholder="City">
        </div>
        <div class="col-md-4">
          <select data-field="country_code" class="form-select form-select-sm">
            ${countryOptions}
          </select>
        </div>
        <div class="col-md-4">
          <select data-field="type" class="form-select form-select-sm">
            ${typeOptions}
          </select>
        </div>
        <div class="col-md-6">
          <input data-field="address" class="form-control form-control-sm" placeholder="Address / region (optional)">
        </div>
        <div class="col-md-2 d-flex align-items-end">
          <button type="button" class="btn btn-sm btn-outline-danger remove-location-row">
            <i class="bi bi-trash"></i><span class="visually-hidden">Remove location</span>
          </button>
        </div>
      </div>
    </div>`;
}

function wireLocationRows(container, countries) {
  const rows = container.querySelector("#location-rows");
  container.querySelector("#add-location-row").addEventListener("click", () => {
    rows.insertAdjacentHTML("beforeend", locationRowHtml(countries));
  });
  rows.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-location-row");
    if (btn) btn.closest(".location-row").remove();
  });
}

function collectLocations(form) {
  const result = [];
  form.querySelectorAll(".location-row").forEach((row) => {
    const loc = {
      label: row.querySelector('[data-field="label"]').value.trim(),
      address: row.querySelector('[data-field="address"]').value.trim() || null,
      city: row.querySelector('[data-field="city"]').value.trim(),
      country_code: row.querySelector('[data-field="country_code"]').value,
      type: row.querySelector('[data-field="type"]').value,
    };
    const hasAny = Boolean(loc.label || loc.address || loc.city || loc.country_code);
    if (!hasAny) return;
    if (!loc.label || !loc.city || !loc.country_code) {
      throw new Error("Each location needs a label, city, and country");
    }
    result.push(loc);
  });
  return result;
}

function fieldHtml([name, label, type, required]) {
  const isTextarea = type === "textarea";
  const control = isTextarea
    ? `<textarea id="field-${name}" name="${name}" class="form-control" rows="3"></textarea>`
    : `<input type="${type}" id="field-${name}" name="${name}" class="form-control" ${required ? "required" : ""}>`;
  return `
    <div class="mb-3">
      <label for="field-${name}" class="form-label">
        ${label}${required ? ' <span class="text-danger">*</span>' : ""}
      </label>
      ${control}
    </div>`;
}

function showFieldError(form, name) {
  const input = form.elements[name];
  input.classList.add("is-invalid");
  input.setCustomValidity("Name is required");
  input.reportValidity();
  input.addEventListener(
    "input",
    () => {
      input.classList.remove("is-invalid");
      input.setCustomValidity("");
    },
    { once: true }
  );
}