import { listUsers, createUser, updateUser, deleteUser } from "./api.js";
import { esc, showToast, currentUser } from "./app.js";

const LEVELS = ["guest", "read-only", "user", "admin"];
const BOOTSTRAP_ADMIN = "admin@localhost";

function levelOptions(selected) {
  return LEVELS.map(
    (l) => `<option value="${l}" ${l === selected ? "selected" : ""}>${l}</option>`
  ).join("");
}

function alertHtml(message) {
  return `<div class="alert alert-danger py-2 mb-0"><i class="bi bi-exclamation-triangle me-2"></i>${esc(message)}</div>`;
}

function createError(err) {
  if (err.status === 400 && err.detail === "REGISTER_USER_ALREADY_EXISTS") {
    return "An account with that email already exists";
  }
  if (err.status === 422) {
    return "Check the email and password (at least 8 characters)";
  }
  return err.message;
}

export async function renderUsers(container) {
  container.innerHTML = `
    <div class="mb-3">
      <h1 class="h4 mb-0">Users</h1>
      <p class="text-secondary mb-0">Manage accounts and their access levels.</p>
    </div>
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header"><span class="muted-label">Create account</span></div>
          <div class="card-body">
            <form id="create-user-form" novalidate>
              <div id="create-user-alert"></div>
              <div class="mb-2">
                <label class="form-label small mb-1" for="new-user-email">Email</label>
                <input id="new-user-email" type="email" class="form-control form-control-sm" required>
              </div>
              <div class="mb-2">
                <label class="form-label small mb-1" for="new-user-password">Initial password</label>
                <input id="new-user-password" type="password" class="form-control form-control-sm" required minlength="8">
                <div class="form-text">At least 8 characters.</div>
              </div>
              <div class="mb-3">
                <label class="form-label small mb-1" for="new-user-level">Access level</label>
                <select id="new-user-level" class="form-select form-select-sm">${levelOptions("user")}</select>
              </div>
              <button type="submit" class="btn btn-primary btn-sm w-100">
                <i class="bi bi-person-plus me-1"></i>Create account
              </button>
            </form>
          </div>
        </div>
      </div>
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header"><span class="muted-label">All accounts</span></div>
          <div class="card-body" id="users-list">
            <div class="text-center text-secondary py-3">Loading…</div>
          </div>
        </div>
      </div>
    </div>`;

  const createForm = container.querySelector("#create-user-form");
  const alertEl = container.querySelector("#create-user-alert");
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertEl.innerHTML = "";
    const email = createForm.querySelector("#new-user-email").value.trim();
    const password = createForm.querySelector("#new-user-password").value;
    const access_level = createForm.querySelector("#new-user-level").value;
    if (!email || !password) return;
    const btn = createForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await createUser({ email, password, access_level });
      showToast("Account created");
      createForm.reset();
      await loadUsers(container);
    } catch (err) {
      alertEl.innerHTML = alertHtml(createError(err));
    } finally {
      btn.disabled = false;
    }
  });

  await loadUsers(container);
}

async function loadUsers(container) {
  const listEl = container.querySelector("#users-list");
  listEl.innerHTML = `<div class="text-center text-secondary py-3">Loading…</div>`;
  let users;
  try {
    users = await listUsers();
  } catch (err) {
    listEl.innerHTML = alertHtml(err.message);
    return;
  }
  listEl.innerHTML = renderRows(users);
  wireRows(container, users);
}

function renderRows(users) {
  const me = currentUser();
  if (users.length === 0) {
    return `<div class="text-center text-secondary py-3">No accounts yet.</div>`;
  }
  return users
    .map((u) => {
      const isBootstrap = u.email === BOOTSTRAP_ADMIN;
      const isSelf = me && u.id === me.id;
      const levelLocked = isBootstrap || isSelf;
      const deleteLocked = isBootstrap || isSelf;
      const activeBadge = u.is_active
        ? `<span class="badge rounded-pill text-bg-success">Active</span>`
        : `<span class="badge rounded-pill text-bg-secondary">Inactive</span>`;
      return `
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom" data-id="${u.id}">
          <div>
            <div class="fw-semibold">${esc(u.email)}</div>
            <div class="stat-muted d-flex align-items-center gap-1">
              ${activeBadge}
              ${isBootstrap ? `<span class="small">· bootstrap admin</span>` : ""}
              ${isSelf ? `<span class="small">· you</span>` : ""}
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm user-level" data-id="${u.id}" ${levelLocked ? "disabled" : ""} title="Access level">
              ${levelOptions(u.access_level)}
            </select>
            <button type="button" class="btn btn-sm btn-outline-secondary user-active" data-id="${u.id}" ${isBootstrap ? "disabled" : ""}>
              <i class="bi ${u.is_active ? "bi-pause" : "bi-play"} me-1"></i>${u.is_active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger user-delete" data-id="${u.id}" ${deleteLocked ? "disabled" : ""}>
              <i class="bi bi-trash me-1"></i>Delete
            </button>
          </div>
        </div>`;
    })
    .join("");
}

function wireRows(container, users) {
  const listEl = container.querySelector("#users-list");

  listEl.querySelectorAll(".user-level").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const id = Number(sel.dataset.id);
      sel.disabled = true;
      try {
        await updateUser(id, { access_level: sel.value });
        showToast("Access level updated");
        await loadUsers(container);
      } catch (err) {
        showToast(err.message, "danger");
        sel.disabled = false;
      }
    });
  });

  listEl.querySelectorAll(".user-active").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const user = users.find((u) => u.id === id);
      const target = !user.is_active;
      if (!window.confirm(`Are you sure you want to ${target ? "activate" : "deactivate"} ${esc(user.email)}?`)) return;
      btn.disabled = true;
      try {
        await updateUser(id, { is_active: target });
        showToast(target ? "Account activated" : "Account deactivated");
        await loadUsers(container);
      } catch (err) {
        showToast(err.message, "danger");
        btn.disabled = false;
      }
    });
  });

  listEl.querySelectorAll(".user-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      const user = users.find((u) => u.id === id);
      if (!window.confirm(`Delete account ${esc(user.email)}? This cannot be undone.`)) return;
      btn.disabled = true;
      try {
        await deleteUser(id);
        showToast("Account deleted");
        await loadUsers(container);
      } catch (err) {
        showToast(err.message, "danger");
        btn.disabled = false;
      }
    });
  });
}