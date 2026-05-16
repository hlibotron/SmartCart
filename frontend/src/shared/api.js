import { authHeaders } from "./authSession.js";

const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8000";
const configuredBackendOrigin = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");

export function apiOrigin() {
  if (configuredBackendOrigin) {
    return configuredBackendOrigin;
  }

  if (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  ) {
    return DEFAULT_BACKEND_ORIGIN;
  }

  return "";
}

export function apiUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const origin = apiOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

export async function fetchJson(path) {
  const response = await fetch(apiUrl(path), {
    headers: {
      Accept: "application/json",
      ...authHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json();
}

export function assetUrl(path) {
  if (!path) {
    return path;
  }

  const value = String(path);
  const uploadIndex = value.indexOf("uploads/");
  const normalizedPath =
    value.startsWith("/uploads/")
      ? value
      : uploadIndex >= 0 && !/^https?:\/\//i.test(value)
        ? `/${value.slice(uploadIndex)}`
        : value;

  if (!normalizedPath.startsWith("/uploads/")) {
    return path;
  }

  return apiUrl(normalizedPath);
}

export function rerenderRoute() {
  window.dispatchEvent(new Event("popstate"));
}
