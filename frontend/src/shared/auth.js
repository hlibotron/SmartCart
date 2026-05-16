import { apiUrl } from "./api.js";
import { clearAuthSession, setAuthSession } from "./authSession.js";

async function authRequest(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Не вдалося виконати запит");
  }

  setAuthSession(data);
  return data;
}

export function loginUser(payload) {
  return authRequest("/api/auth/login", payload);
}

export function registerUser(payload) {
  return authRequest("/api/auth/register", payload);
}

export function logoutUser() {
  clearAuthSession();
}
