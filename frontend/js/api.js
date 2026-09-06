export class HttpError extends Error {
  constructor(status, detail, body) {
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

const API_BASE = "/api";

let onUnauthorized = null;

export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

async function http(path, options = {}) {
  const res = await fetch(path, options);
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  let body = null;
  if (contentType.includes("application/json")) {
    body = await res.json();
  }

  if (!res.ok) {
    let detail = body?.detail;
    if (detail == null && body?.message) detail = body.message;
    if (detail == null) detail = `Request failed (${res.status})`;
    if (res.status === 403) {
      detail = "You don't have permission to perform this action";
    }
    if (res.status === 401 && !options.bypassAuth && onUnauthorized) {
      onUnauthorized();
    }
    throw new HttpError(res.status, detail, body);
  }
  return body;
}

const json = (method, data) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const login = (email, password) =>
  http(`${API_BASE}/auth/login`, {
    ...json("POST", { email, password }),
    bypassAuth: true,
  });

export const logout = () =>
  http(`${API_BASE}/auth/logout`, { method: "POST", bypassAuth: true });

export const me = () => http(`${API_BASE}/auth/me`, { bypassAuth: true });

export const changePassword = (oldPassword, newPassword) =>
  http(`${API_BASE}/auth/change-password`, {
    ...json("POST", { old_password: oldPassword, new_password: newPassword }),
  });

export const listIndustries = () => http(`${API_BASE}/industries`);

export const createIndustry = (name) =>
  http(`${API_BASE}/industries`, json("POST", { name }));

export const renameIndustry = (id, name) =>
  http(`${API_BASE}/industries/${id}`, json("PUT", { name }));

export const listCountries = () => http(`${API_BASE}/countries`);

export const listCompanies = (q, countries) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (countries && countries.length) params.set("countries", countries.join(","));
  const qs = params.toString();
  return http(`${API_BASE}/companies${qs ? `?${qs}` : ""}`);
};

export const getCompany = (id) => http(`${API_BASE}/companies/${id}`);

export const createCompany = (data) =>
  http(`${API_BASE}/companies`, json("POST", data));

export const updateCompany = (id, data) =>
  http(`${API_BASE}/companies/${id}`, json("PUT", data));

export const deleteCompany = (id) =>
  http(`${API_BASE}/companies/${id}`, { method: "DELETE" });

export const createLocation = (companyId, data) =>
  http(`${API_BASE}/companies/${companyId}/locations`, json("POST", data));

export const updateLocation = (companyId, locationId, data) =>
  http(`${API_BASE}/companies/${companyId}/locations/${locationId}`, json("PUT", data));

export const deleteLocation = (companyId, locationId) =>
  http(`${API_BASE}/companies/${companyId}/locations/${locationId}`, { method: "DELETE" });

export const createReference = (companyId, data) =>
  http(`${API_BASE}/companies/${companyId}/references`, json("POST", data));

export const updateReference = (companyId, referenceId, data) =>
  http(`${API_BASE}/companies/${companyId}/references/${referenceId}`, json("PUT", data));

export const deleteReference = (companyId, referenceId) =>
  http(`${API_BASE}/companies/${companyId}/references/${referenceId}`, { method: "DELETE" });

export const createNews = (companyId, data) =>
  http(`${API_BASE}/companies/${companyId}/news`, json("POST", data));

export const updateNews = (companyId, newsId, data) =>
  http(`${API_BASE}/companies/${companyId}/news/${newsId}`, json("PUT", data));

export const deleteNews = (companyId, newsId) =>
  http(`${API_BASE}/companies/${companyId}/news/${newsId}`, { method: "DELETE" });

export async function uploadArtifact(companyId, file) {
  const fd = new FormData();
  fd.append("file", file);
  return http(`${API_BASE}/companies/${companyId}/artifacts`, {
    method: "POST",
    body: fd,
  });
}

export const deleteArtifact = (id) =>
  http(`${API_BASE}/artifacts/${id}`, { method: "DELETE" });

export const generateDocument = (companyId) =>
  http(`${API_BASE}/companies/${companyId}/documents/generate`, {
    method: "POST",
  });

export async function uploadLogo(companyId, file) {
  const fd = new FormData();
  fd.append("file", file);
  return http(`${API_BASE}/companies/${companyId}/logo`, {
    method: "POST",
    body: fd,
  });
}

export const deleteLogo = (companyId) =>
  http(`${API_BASE}/companies/${companyId}/logo`, { method: "DELETE" });

export const providers = () =>
  http(`${API_BASE}/auth/providers`, { bypassAuth: true });

export const listUsers = () => http(`${API_BASE}/auth/users`);

export const createUser = (data) =>
  http(`${API_BASE}/auth/users`, json("POST", data));

export const updateUser = (id, data) =>
  http(`${API_BASE}/auth/users/${id}`, json("PATCH", data));

export const deleteUser = (id) =>
  http(`${API_BASE}/auth/users/${id}`, { method: "DELETE" });