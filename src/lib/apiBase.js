// In the Capacitor app there is no same-origin server to call relative
// paths like "/api/...", so callers must resolve against the deployed
// web app's domain instead. On the web build this env var is typically
// unset and everything keeps working exactly as before (relative path).
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}
