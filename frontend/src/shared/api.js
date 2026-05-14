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

  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return `${BACKEND_ORIGIN}${normalizedPath}`;
  }

  return normalizedPath;
}

export function rerenderRoute() {
  window.dispatchEvent(new Event("popstate"));
}
