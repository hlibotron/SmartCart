const authTokenKey = "smartcart:auth-token";
const authUserKey = "smartcart:auth-user";

export function getAuthToken() {
  try {
    return window.localStorage.getItem(authTokenKey);
  } catch {
    return null;
  }
}

export function getAuthUser() {
  try {
    const rawUser = window.localStorage.getItem(authUserKey);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function setAuthSession({ token, user }) {
  try {
    window.localStorage.setItem(authTokenKey, token);
    window.localStorage.setItem(authUserKey, JSON.stringify(user));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function clearAuthSession() {
  try {
    window.localStorage.removeItem(authTokenKey);
    window.localStorage.removeItem(authUserKey);
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
