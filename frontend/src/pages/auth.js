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
const citySearchCache = new Map();

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
    <div
      class="auth-city-dropdown"
      id="authCityDropdown"
      role="listbox"
      aria-label="Знайдені міста"
      hidden
    ></div>
  `;
}

function citySubtitle(item) {
  return [item.communityName, item.regionName].filter(Boolean).join(" · ");
}

function renderCityDropdown(items, { loading = false, query = "" } = {}) {
  const dropdown = document.querySelector("#authCityDropdown");
  if (!dropdown) {
    return;
  }

  if (loading) {
    dropdown.innerHTML = `<span class="auth-city-status">Шукаємо міста...</span>`;
    dropdown.hidden = false;
    return;
  }

  if (!query.trim()) {
    dropdown.innerHTML = "";
    dropdown.hidden = true;
    return;
  }

  if (!items.length) {
    dropdown.innerHTML = `<span class="auth-city-status">Міст не знайдено</span>`;
    dropdown.hidden = false;
    return;
  }

  dropdown.innerHTML = items
    .map(
      (item) => `
        <button
          class="auth-city-option interactive"
          type="button"
          role="option"
          data-city-label="${escapeHtml(item.label)}"
        >
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(citySubtitle(item))}</small>
        </button>
      `,
    )
    .join("");
  dropdown.hidden = false;
}

function closeCityDropdown() {
  const dropdown = document.querySelector("#authCityDropdown");
  if (!dropdown) {
    return;
  }

  dropdown.innerHTML = "";
  dropdown.hidden = true;
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
              <div class="auth-field auth-field--city">
                <label id="authCityLabel" for="authCitySearch">Місто</label>
                <span class="auth-city-control">
                  <input
                    id="authCitySearch"
                    name="city"
                    type="text"
                    autocomplete="off"
                    role="combobox"
                    aria-labelledby="authCityLabel"
                    aria-controls="authCityDropdown"
                    aria-expanded="false"
                    value="${fieldValue("city")}"
                  />
                  ${renderCitySuggestions()}
                </span>
              </div>
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
  const cityDropdown = document.querySelector("#authCityDropdown");

  cityInput?.addEventListener("input", (event) => {
    const query = event.target.value.trim();
    window.clearTimeout(citySearchTimer);
    authState = {
      ...authState,
      values: {
        ...authState.values,
        city: event.target.value,
      },
    };

    if (!query) {
      citySearchRequest += 1;
      cityInput.setAttribute("aria-expanded", "false");
      closeCityDropdown();
      return;
    }

    renderCityDropdown([], { loading: true, query });
    cityInput.setAttribute("aria-expanded", "true");
    const requestId = ++citySearchRequest;

    citySearchTimer = window.setTimeout(() => {
      const params = new URLSearchParams({ level: "city", limit: "25" });
      params.set("q", query);
      const cacheKey = params.toString();
      const cachedItems = citySearchCache.get(cacheKey);
      if (cachedItems) {
        if (requestId === citySearchRequest) {
          renderCityDropdown(cachedItems, { query });
          cityInput.setAttribute("aria-expanded", "true");
        }
        return;
      }

      fetchJson(`/api/business/geography-units?${params.toString()}`)
        .then((data) => {
          if (requestId !== citySearchRequest) {
            return;
          }

          const items = Array.isArray(data.items) ? data.items : [];
          citySearchCache.set(cacheKey, items);
          renderCityDropdown(items, { query });
          cityInput.setAttribute("aria-expanded", "true");
        })
        .catch((error) => {
          console.warn(error.message);
          if (requestId === citySearchRequest) {
            closeCityDropdown();
            cityInput.setAttribute("aria-expanded", "false");
          }
        });
    }, 220);
  });

  cityInput?.addEventListener("keydown", (event) => {
    const options = Array.from(document.querySelectorAll(".auth-city-option"));
    if (event.key === "Escape") {
      closeCityDropdown();
      cityInput.setAttribute("aria-expanded", "false");
      return;
    }

    if (event.key !== "ArrowDown" || !options.length) {
      return;
    }

    event.preventDefault();
    options[0].focus();
  });

  cityDropdown?.addEventListener("keydown", (event) => {
    const options = Array.from(cityDropdown.querySelectorAll(".auth-city-option"));
    const activeIndex = options.indexOf(document.activeElement);

    if (event.key === "Escape") {
      closeCityDropdown();
      cityInput?.setAttribute("aria-expanded", "false");
      cityInput?.focus();
      return;
    }

    if (!["ArrowDown", "ArrowUp"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (activeIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus();
  });

  cityDropdown?.addEventListener("click", (event) => {
    const option = event.target instanceof Element
      ? event.target.closest(".auth-city-option")
      : null;
    if (!option || !cityInput) {
      return;
    }

    cityInput.value = option.dataset.cityLabel || "";
    authState = {
      ...authState,
      values: {
        ...authState.values,
        city: cityInput.value,
      },
    };
    closeCityDropdown();
    cityInput.setAttribute("aria-expanded", "false");
    cityInput.focus();
  });

  cityInput?.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (cityDropdown?.contains(document.activeElement)) {
        return;
      }

      closeCityDropdown();
      cityInput.setAttribute("aria-expanded", "false");
    }, 0);
  });

  cityDropdown?.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (cityDropdown.contains(document.activeElement) || cityInput === document.activeElement) {
        return;
      }

      closeCityDropdown();
      cityInput?.setAttribute("aria-expanded", "false");
    }, 0);
  });

  cityDropdown?.addEventListener("pointerdown", (event) => {
    const option = event.target instanceof Element
      ? event.target.closest(".auth-city-option")
      : null;
    if (option) {
      event.preventDefault();
      return;
    }
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
