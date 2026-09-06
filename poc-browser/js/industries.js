import { createIndustry, listIndustries, renameIndustry } from "./api.js";
import { esc, showToast, canMutate } from "./app.js";

export async function renderIndustries(container) {
  const write = canMutate();
  container.innerHTML = `
    <div class="row mb-3">
      <div class="col">
        <h1 class="h4 mb-0">Industries</h1>
        <p class="text-secondary mb-0">${write ? "Add and rename the controlled industry list. Renaming updates every company that uses it." : "View the controlled industry list."}</p>
      </div>
    </div>
    <div class="row g-4">
      ${write ? `
      <div class="col-lg-5">
        <div class="card">
          <div class="card-body">
            <h2 class="h6 muted-label">Add industry</h2>
            <form id="add-industry-form" class="d-flex gap-2">
              <input id="new-industry-name" class="form-control" placeholder="New industry name" required>
              <button type="submit" class="btn btn-primary text-nowrap">
                <i class="bi bi-plus-lg me-1"></i>Add
              </button>
            </form>
            <div id="industry-alert" class="mt-2"></div>
          </div>
        </div>
      </div>
      <div class="col-lg-7">` : `<div class="col-12">`}
        <div class="card">
          <div class="card-header">
            <span class="muted-label">Standard list</span>
          </div>
          <div class="card-body" id="industry-list">
            <div class="text-center text-secondary py-3">Loading…</div>
          </div>
        </div>
      </div>
    </div>`;

  const listEl = container.querySelector("#industry-list");
  const addForm = container.querySelector("#add-industry-form");
  const alertEl = container.querySelector("#industry-alert");

  async function load() {
    try {
      const industries = await listIndustries();
      listEl.innerHTML = renderRows(industries);
      wireRows();
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
    }
  }

  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertEl.innerHTML = "";
      const input = addForm.querySelector("#new-industry-name");
      const name = input.value.trim();
      if (!name) return;
      const btn = addForm.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        await createIndustry(name);
        input.value = "";
        showToast("Industry added");
        await load();
      } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
      }
    });
  }

  function wireRows() {
    listEl.querySelectorAll(".rename-industry").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        listEl.querySelectorAll(".industry-edit-row").forEach((r) => r.remove());
        listEl.querySelectorAll(".industry-row").forEach((r) => (r.hidden = true));
        const nameRow = listEl.querySelector(`.industry-row[data-id="${id}"]`);
        nameRow.hidden = true;
        const editRow = document.createElement("div");
        editRow.className = "industry-edit-row d-flex gap-2 align-items-center py-2";
        editRow.innerHTML = `
          <input class="form-control form-control-sm industry-edit-input" value="${esc(btn.dataset.name)}">
          <button type="button" class="btn btn-sm btn-primary industry-edit-save"><i class="bi bi-check-lg"></i><span class="visually-hidden">Save</span></button>
          <button type="button" class="btn btn-sm btn-outline-secondary industry-edit-cancel"><i class="bi bi-x-lg"></i><span class="visually-hidden">Cancel</span></button>`;
        listEl.insertBefore(editRow, nameRow.nextSibling);
        const input = editRow.querySelector(".industry-edit-input");
        input.focus();
        editRow.querySelector(".industry-edit-cancel").addEventListener("click", () => {
          editRow.remove();
          listEl.querySelectorAll(".industry-row").forEach((r) => (r.hidden = false));
        });
        editRow.querySelector(".industry-edit-save").addEventListener("click", async () => {
          const newName = input.value.trim();
          if (!newName) return;
          const saveBtn = editRow.querySelector(".industry-edit-save");
          saveBtn.disabled = true;
          try {
            await renameIndustry(id, newName);
            showToast("Industry renamed");
            await load();
          } catch (err) {
            alertEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${esc(err.message)}</div>`;
            saveBtn.disabled = false;
          }
        });
      });
    });
  }

  function renderRows(industries) {
    if (industries.length === 0) {
      return `<div class="text-center text-secondary py-3">No industries yet.</div>`;
    }
    return industries
      .map(
        (i) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom industry-row" data-id="${i.id}">
        <span class="fw-semibold">${esc(i.name)}</span>
        ${write ? `
        <button type="button" class="btn btn-sm btn-outline-secondary rename-industry"
                data-id="${i.id}" data-name="${esc(i.name)}">
          <i class="bi bi-pencil me-1"></i>Rename
        </button>` : ""}
      </div>`
      )
      .join("");
  }

  await load();
}