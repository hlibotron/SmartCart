const BACKEND_ORIGIN = "http://127.0.0.1:8000";

export async function fetchJson(path) {
  const response = await fetch(path, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json();
}

export function assetUrl(path) {
  if (!path || !String(path).startsWith("/uploads/")) {
    return path;
  }

  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return `${BACKEND_ORIGIN}${path}`;
  }

  return path;
}

export function rerenderRoute() {
  window.dispatchEvent(new Event("popstate"));
}
