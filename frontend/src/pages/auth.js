import { loginUser, registerUser } from "../shared/auth.js";
import { fetchJson } from "../shared/api.js";
import { getAuthUser } from "../shared/authSession.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { completeOnboarding } from "../shared/onboarding.js";

let authMode = "login";
let authState = {
  pending: false,
  error: "",
};
let citySearchTimer = null;
let citySearchRequest = 0;
let citySuggestions = [];
let citySearchShouldFocus = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navigate(path) {
  window.history.pushState({}, "", appHref(path));
  window.dispatchEvent(new Event("popstate"));
}

function setAuthState(nextState) {
  authState = { ...authState, ...nextState };
  window.dispatchEvent(new Event("popstate"));
}

function authTitle() {
  return authMode === "register" ? "Створіть акаунт" : "Увійдіть в акаунт";
}

function authSubtitle() {
  return authMode === "register"
    ? "Збережіть чеки, кешбек і налаштування для свого профілю."
    : "Продовжуйте з власними чеками, кешбеком і профілем.";
}

function fieldValue(name) {
  if (name === "city" && !authState.values?.city) {
    try {
      const selectedLocation = JSON.parse(
        window.localStorage.getItem("smartcart:selected-location") || "null",
      );
      if (selectedLocation?.label) {
        return escapeHtml(selectedLocation.label);
      }
    } catch {
      return "";
    }
  }

  return escapeHtml(authState.values?.[name] || "");
}

function renderCitySuggestions() {
  return `
    <datalist id="authCityOptions">
      ${citySuggestions
        .map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.regionName || "")}</option>`)
        .join("")}
    </datalist>
  `;
}

export function renderAuthPage(mode = "login") {
  authMode = mode;
  const isRegister = authMode === "register";

  return `
    <section class="auth-page" aria-labelledby="auth-title">
      <a class="auth-brand interactive" href="${appHref("/onboarding")}" data-link>
        <span>${icon("shoppingBag")}</span>
        Smart<span>Cart</span>
      </a>

      <div class="auth-copy">
        <p>${isRegister ? "Реєстрація" : "Вхід"}</p>
        <h1 id="auth-title">${authTitle()}</h1>
        <span>${authSubtitle()}</span>
      </div>

      <form class="auth-form" id="authForm" novalidate>
        ${
          isRegister
            ? `
              <label class="auth-field">
                <span>Імʼя</span>
                <input name="name" type="text" autocomplete="name" required minlength="2" value="${fieldValue("name")}" />
              </label>
            `
            : ""
        }
        <label class="auth-field">
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" required value="${fieldValue("email")}" />
        </label>
        <label class="auth-field">
          <span>Пароль</span>
          <input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required minlength="${isRegister ? "6" : "1"}" />
        </label>
        ${
          isRegister
            ? `
              <label class="auth-field">
                <span>Місто</span>
                <input
                  id="authCitySearch"
                  name="city"
                  type="text"
                  autocomplete="address-level2"
                  list="authCityOptions"
                  value="${fieldValue("city")}"
                />
                ${renderCitySuggestions()}
              </label>
            `
            : ""
        }
        ${authState.error ? `<p class="auth-error" role="alert">${escapeHtml(authState.error)}</p>` : ""}
        <button class="auth-submit interactive" type="submit" ${authState.pending ? "disabled" : ""}>
          ${authState.pending ? "Зачекайте..." : isRegister ? "Зареєструватися" : "Увійти"}
        </button>
      </form>

      <p class="auth-switch">
        ${isRegister ? "Вже маєте акаунт?" : "Ще немає акаунта?"}
        <a href="${appHref(isRegister ? "/login" : "/register")}" data-link>
          ${isRegister ? "Увійти" : "Зареєструватися"}
        </a>
      </p>
    </section>
  `;
}

export function renderLoginPage() {
  return renderAuthPage("login");
}

export function renderRegisterPage() {
  return renderAuthPage("register");
}

export function bindAuthPage() {
  const cityInput = document.querySelector("#authCitySearch");
  if (citySearchShouldFocus && cityInput) {
    cityInput.focus({ preventScroll: true });
    cityInput.setSelectionRange(cityInput.value.length, cityInput.value.length);
    citySearchShouldFocus = false;
  }

  cityInput?.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    window.clearTimeout(citySearchTimer);
    citySearchTimer = window.setTimeout(() => {
      const requestId = ++citySearchRequest;
      const params = new URLSearchParams({ level: "city", limit: "25" });
      if (query) {
        params.set("q", query);
      }

      fetchJson(`/api/business/geography-units?${params.toString()}`)
        .then((data) => {
          if (requestId !== citySearchRequest) {
            return;
          }
          citySuggestions = Array.isArray(data.items) ? data.items : [];
          authState = {
            ...authState,
            values: {
              ...authState.values,
              city: cityInput.value,
            },
          };
          citySearchShouldFocus = true;
          window.dispatchEvent(new Event("popstate"));
        })
        .catch((error) => {
          console.warn(error.message);
        });
    }, 220);
  });

  document.querySelector("#authForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    authState.values = values;
    setAuthState({ pending: true, error: "" });

    try {
      if (authMode === "register") {
        await registerUser({
          name: values.name,
          email: values.email,
          password: values.password,
          city: values.city || null,
        });
      } else {
        await loginUser({
          email: values.email,
          password: values.password,
        });
      }

      authState = { pending: false, error: "", values: {} };
      completeOnboarding();
      navigate("/");
    } catch (error) {
      setAuthState({
        pending: false,
        error: error.message || "Не вдалося увійти",
      });
    }
  });

  const currentUser = getAuthUser();
  if (currentUser && !authState.pending) {
    document.querySelector(".auth-copy span")?.setAttribute("title", currentUser.email || "");
  }
}
