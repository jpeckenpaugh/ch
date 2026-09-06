import { login, me, providers } from "./api.js";
import { esc, setSession } from "./app.js";

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-sm-8 col-md-6 col-lg-4">
        <div class="card mt-4">
          <div class="card-body p-4">
            <h1 class="h4 text-center mb-1">Company Hub</h1>
            <p class="text-center text-secondary mb-4">Sign in to continue</p>
            <div id="login-alert"></div>
            <form id="login-form" novalidate>
              <div class="mb-3">
                <label for="login-email" class="form-label">Email</label>
                <input type="email" id="login-email" name="email" class="form-control"
                       autocomplete="username" required autofocus>
              </div>
              <div class="mb-3">
                <label for="login-password" class="form-label">Password</label>
                <input type="password" id="login-password" name="password" class="form-control"
                       autocomplete="current-password" required>
              </div>
              <button type="submit" class="btn btn-primary w-100" id="login-btn">
                <i class="bi bi-box-arrow-in-right me-1"></i>Sign in
              </button>
            </form>
            <div id="google-sso-slot"></div>
          </div>
        </div>
      </div>
    </div>`;

  const form = container.querySelector("#login-form");
  const alertEl = container.querySelector("#login-alert");
  const btn = container.querySelector("#login-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertEl.innerHTML = "";
    const email = form.elements["email"].value.trim();
    const password = form.elements["password"].value;
    if (!email || !password) return;
    btn.disabled = true;
    try {
      await login(email, password);
      const user = await me();
      setSession(user);
    } catch (err) {
      let message = err.message;
      if (err.status === 400 && err.detail === "LOGIN_BAD_CREDENTIALS") {
        message = "Invalid email or password";
      }
      alertEl.innerHTML = `
        <div class="alert alert-danger py-2">
          <i class="bi bi-exclamation-triangle me-2"></i>${esc(message)}
        </div>`;
      btn.disabled = false;
    }
  });

  try {
    const p = await providers();
    const slot = container.querySelector("#google-sso-slot");
    if (slot && p && p.google) {
      slot.innerHTML = `
        <hr class="my-3">
        <a class="btn btn-outline-secondary w-100" href="/api/auth/authorize">
          <i class="bi bi-google me-1"></i>Sign in with Google
        </a>`;
    }
  } catch {
    /* SSO availability unknown; fall back to email/password only */
  }
}