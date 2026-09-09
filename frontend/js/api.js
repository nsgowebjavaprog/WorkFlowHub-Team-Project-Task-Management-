/* ============================================================================
   api.js
   ------
   Small wrapper around fetch() that ALL other JS files use to talk to the
   Django backend. Centralizing this means:
     - one place that knows the base URL
     - one place that attaches the JWT "Authorization: Bearer <token>" header
     - one place that auto-refreshes an expired access token
   ========================================================================== */

// Base URL of the Django API. Change this if you deploy somewhere else.
const API_BASE = "http://localhost:8000/api";

// --- Token storage helpers ---------------------------------------------
// We keep tokens in localStorage so the user stays logged in across page
// reloads/tabs (a real production app might prefer httpOnly cookies for
// better XSS protection, but localStorage keeps this demo framework-free).
const Auth = {
  setTokens({ access, refresh }) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  },
  getAccess() {
    return localStorage.getItem("access_token");
  },
  getRefresh() {
    return localStorage.getItem("refresh_token");
  },
  clear() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  },
  isLoggedIn() {
    return !!this.getAccess();
  },
  setUser(user) {
    localStorage.setItem("user", JSON.stringify(user));
  },
  getUser() {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },
};

/**
 * apiRequest - the single function every page calls to hit the backend.
 * Automatically attaches the JWT, and retries ONCE after refreshing the
 * token if the server responds 401 (access token expired).
 */
async function apiRequest(path, { method = "GET", body = null, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && Auth.getAccess()) {
    headers["Authorization"] = `Bearer ${Auth.getAccess()}`;
  }

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

  let response = await doFetch();

  // Access token expired -> try to silently refresh it once, then retry.
  if (response.status === 401 && auth && Auth.getRefresh()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${Auth.getAccess()}`;
      response = await doFetch();
    }
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Surface a readable error message no matter the shape DRF returned
    const message =
      data?.error?.message || data?.detail || JSON.stringify(data) || "Request failed";
    throw new Error(message);
  }
  return data;
}

async function refreshAccessToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/login/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: Auth.getRefresh() }),
    });
    if (!res.ok) throw new Error("refresh failed");
    const data = await res.json();
    localStorage.setItem("access_token", data.access);
    return true;
  } catch {
    Auth.clear();
    window.location.href = "login.html";
    return false;
  }
}
