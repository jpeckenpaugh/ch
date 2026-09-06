import { renderList } from "./list.js";
import { renderProfile } from "./profile.js";
import { renderForm } from "./form.js";
import { renderIndustries } from "./industries.js";
import { renderPassword } from "./password.js";
import { renderLogin } from "./login.js";
import { renderUsers } from "./users.js";
import { me, logout, setOnUnauthorized } from "./api.js";

const view = document.getElementById("view");
let session = null;

export function currentUser() {
  return session;
}

export function accessLevel() {
  return session ? session.access_level : null;
}

export function isAdmin() {
  return accessLevel() === "admin";
}

export function canMutate() {
  const level = accessLevel();
  return level === "user" || level === "admin";
}

export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function completenessBadge(company) {
  if (company.is_complete) {
    return `<span class="badge rounded-pill badge-complete"><i class="bi bi-check-circle me-1"></i>Complete</span>`;
  }
  return `<span class="badge rounded-pill badge-incomplete"><i class="bi bi-exclamation-triangle me-1"></i>Incomplete</span>`;
}

export function sourceBadge(source) {
  const cls =
    source === "generated" ? "badge-source-generated" : "badge-source-upload";
  const label = source === "generated" ? "Generated" : "Uploaded";
  return `<span class="badge rounded-pill ${cls}">${label}</span>`;
}

export function formatSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function showToast(message, type = "success") {
  const area = document.getElementById("toast-area");
  const icons = {
    success: "bi-check-circle-fill text-success",
    danger: "bi-exclamation-triangle-fill text-danger",
    warning: "bi-exclamation-circle-fill text-warning",
    info: "bi-info-circle-fill text-info",
  };
  const el = document.createElement("div");
  el.className = "toast align-items-center text-bg-light border-0";
  el.setAttribute("role", "status");
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${icons[type] || icons.info} me-2"></i>${esc(message)}
      </div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;
  area.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 3500 });
  toast.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

export function showViewLoading() {
  view.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-secondary" role="status">
        <span class="visually-hidden">Loading…</span>
      </div>
    </div>`;
}

export function setSession(user) {
  session = user;
  updateNav();
  const atLanding = !window.location.hash || window.location.hash === "#/";
  if (atLanding) {
    render(parseRoute("#/"));
  } else {
    window.location.hash = "#/";
  }
}

function parseRoute(hash) {
  const path = (hash || "#/").replace(/^#/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "list" };
  if (parts[0] === "industries") return { name: "industries" };
  if (parts[0] === "password") return { name: "password" };
  if (parts[0] === "users") return { name: "users" };
  if (parts[0] === "companies") {
    if (parts[1] === "new") return { name: "form", companyId: null };
    if (parts[1] && parts[2] === "edit")
      return { name: "form", companyId: Number(parts[1]) };
    if (parts[1]) return { name: "profile", companyId: Number(parts[1]) };
    return { name: "list" };
  }
  return { name: "list" };
}

function updateNav() {
  const nav = document.getElementById("nav-bar");
  if (!session) {
    if (nav) nav.classList.add("d-none");
    return;
  }
  if (nav) nav.classList.remove("d-none");
  const guest = session.access_level === "guest";
  const admin = session.access_level === "admin";
  const companies = document.getElementById("nav-companies");
  const industries = document.getElementById("nav-industries");
  const users = document.getElementById("nav-users");
  if (companies) companies.classList.toggle("d-none", guest);
  if (industries) industries.classList.toggle("d-none", guest);
  if (users) users.classList.toggle("d-none", !admin);
}

function renderBlockedGuest(container) {
  container.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-sm-8 col-md-6 col-lg-5">
        <div class="card mt-4">
          <div class="card-body p-4 text-center">
            <i class="bi bi-hourglass-split d-block fs-1 text-secondary mb-3"></i>
            <h1 class="h4 mb-2">Access pending</h1>
            <p class="text-secondary mb-0">
              Your account has not been granted access yet. An administrator must
              elevate your account before you can use Company Hub. You can change
              your password or log out from the menu above.
            </p>
          </div>
        </div>
      </div>
    </div>`;
}

function render(route) {
  if (!session) {
    renderLogin(view);
    return;
  }
  if (session.access_level === "guest") {
    if (route.name === "password") renderPassword(view);
    else renderBlockedGuest(view);
    return;
  }
  showViewLoading();
  if (route.name === "profile") renderProfile(view, route.companyId);
  else if (route.name === "form") renderForm(view, route.companyId);
  else if (route.name === "industries") renderIndustries(view);
  else if (route.name === "password") renderPassword(view);
  else if (route.name === "users") renderUsers(view);
  else renderList(view);
}

export function navigate(hash) {
  window.location.hash = hash;
}

async function boot() {
  try {
    session = await me();
  } catch (err) {
    session = null;
    if (err.status !== 401) {
      showToast("Unable to verify session", "warning");
    }
  }

  setOnUnauthorized(() => {
    session = null;
    updateNav();
    render(parseRoute(location.hash));
  });

  const logoutBtn = document.getElementById("nav-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await logout();
      } catch {
        /* ignore */
      }
      session = null;
      updateNav();
      render(parseRoute(location.hash));
    });
  }

  window.addEventListener("hashchange", () => render(parseRoute(location.hash)));
  updateNav();
  render(parseRoute(location.hash));
}

boot();