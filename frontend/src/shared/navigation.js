const rawBaseUrl = import.meta.env.BASE_URL ?? "/";
const basePath = rawBaseUrl === "/" ? "" : rawBaseUrl.replace(/\/$/, "");

export function stripBasePath(pathname = window.location.pathname) {
  if (!basePath) {
    return pathname || "/";
  }

  if (pathname === basePath) {
    return "/";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || "/";
  }

  return pathname || "/";
}

export function appHref(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
