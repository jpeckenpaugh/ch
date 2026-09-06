import { changePassword } from "./api.js";
import { esc, showToast } from "./app.js";

export function renderPassword(container) {
  container.innerHTML = `
    <div class="row justify-content-center">
      <div class="col-sm-8 col-md-6 col-lg-5">
        <div class="card mt-2">
          <div class="card-body">
            <h1 class="h4 mb-1">Change password</h1>
            <p class="text-secondary mb-4">
              Update the password for your account. You stay signed in after the
              change; the new password is required next time you sign in.
            </p>
            <div id="password-alert"></div>
            <form id="password-form" novalidate>
              <div class="mb-3">
                <label for="pw-current" class="form-label">Current password</label>
                <input type="password" id="pw-current" name="current_password"
                       class="form-control" autocomplete="current-password" required>
              </div>
              <div class="mb-3">
                <label for="pw-new" class="form-label">New password</label>
                <input type="password" id="pw-new" name="new_password"
                       class="form-control" autocomplete="new-password" required minlength="8">
                <div class="form-text">At least 8 characters.</div>
              </div>
              <div class="mb-3">
                <label for="pw-confirm" class="form-label">Confirm new password</label>
                <input type="password" id="pw-confirm" name="confirm_password"
                       class="form-control" autocomplete="new-password" required>
              </div>
              <button type="submit" class="btn btn-primary w-100" id="pw-save-btn">
                <i class="bi bi-shield-lock me-1"></i>Update password
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>`;

  const form = container.querySelector("#password-form");
  const alertEl = container.querySelector("#password-alert");
  const btn = container.querySelector("#pw-save-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertEl.innerHTML = "";
    const current = form.elements["current_password"].value;
    const next = form.elements["new_password"].value;
    const confirm = form.elements["confirm_password"].value;
    if (!current || !next || !confirm) return;
    if (next !== confirm) {
      alertEl.innerHTML = `
        <div class="alert alert-danger py-2">
          <i class="bi bi-exclamation-triangle me-2"></i>New passwords do not match
        </div>`;
      return;
    }
    btn.disabled = true;
    try {
      await changePassword(current, next);
      showToast("Password updated");
      alertEl.innerHTML = `
        <div class="alert alert-success py-2">
          <i class="bi bi-check-circle me-2"></i>Password updated. The new password
          is required next time you sign in.
        </div>`;
      form.reset();
    } catch (err) {
      let message = err.message;
      if (err.status === 400 && err.detail === "INVALID_PASSWORD") {
        message = "Current password is incorrect";
      } else if (err.status === 422) {
        message = "New password is invalid (at least 8 characters)";
      }
      alertEl.innerHTML = `
        <div class="alert alert-danger py-2">
          <i class="bi bi-exclamation-triangle me-2"></i>${esc(message)}
        </div>`;
      btn.disabled = false;
    }
  });
}