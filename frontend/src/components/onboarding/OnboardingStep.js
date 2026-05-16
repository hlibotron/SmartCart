import receiptPhoneUrl from "../../assets/onboarding/receipt-phone.png";
import { icon } from "../../shared/icons.js";
import { appHref } from "../../shared/navigation.js";

const locationTabs = [
  { key: "city", label: "Місто" },
  { key: "community", label: "Громада" },
  { key: "region", label: "Область" },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTitle(title) {
  return escapeHtml(title)
    .split("\n")
    .map((line) => `<span>${line}</span>`)
    .join("");
}

function renderIntroStep() {
  return `
    <div class="onboarding-visual" aria-label="Телефон із відсканованим чеком">
      <span class="onboarding-badge onboarding-badge--analytics">${icon("analytics")}</span>
      <span class="onboarding-badge onboarding-badge--percent">%</span>
      <span class="onboarding-badge onboarding-badge--bag">${icon("shoppingBag")}</span>
      <img src="${receiptPhoneUrl}" alt="Телефон із чеком у руці" />
    </div>
  `;
}

function locationLabel(item) {
  return [item.communityName, item.regionName].filter(Boolean).join(" · ");
}

function renderLocationStep(step, state = {}) {
  const activeLevel = state.activeLevel || "city";
  const activeTab = locationTabs.find((tab) => tab.key === activeLevel) || locationTabs[0];
  const query = state.query || "";
  const selectedValue = state.selected?.value || "";
  const fallbackItems = step.cities.map((city) => ({
    value: city,
    label: city,
    level: "city",
    regionName: "",
    communityName: "",
  }));
  const items =
    Array.isArray(state.items) && state.items.length
      ? state.items
      : !query && !state.loadedKey
        ? fallbackItems
        : [];
  const sectionLabel = state.loading
    ? "Завантаження..."
    : query
      ? "Результати пошуку"
      : `Рекомендовані ${activeTab.label.toLocaleLowerCase("uk-UA")}`;

  return `
    <div class="onboarding-location">
      <div class="onboarding-tabs" aria-label="Тип локації">
        ${locationTabs
          .map(
            (tab) => `
              <button
                class="onboarding-tab${tab.key === activeLevel ? " active" : ""}"
                type="button"
                data-onboarding-location-tab="${tab.key}"
              >
                ${tab.label}
              </button>
            `,
          )
          .join("")}
      </div>

      <label class="onboarding-search" aria-label="Пошук локації">
        ${icon("search")}
        <input
          id="onboardingLocationSearch"
          type="search"
          placeholder="Пошук: ${activeTab.label.toLocaleLowerCase("uk-UA")}"
          autocomplete="off"
          value="${escapeHtml(query)}"
        />
        ${icon("search")}
      </label>

      <p class="onboarding-section-label">${sectionLabel}</p>
      <div class="onboarding-city-list">
        ${
          items.length
            ? items
                .map((item, index) => {
            const selected = selectedValue ? item.value === selectedValue : index === 0;
            const meta = locationLabel(item);
            return `
              <button
                class="onboarding-city${selected ? " selected" : ""}"
                type="button"
                data-onboarding-location-value="${escapeHtml(item.value)}"
                data-onboarding-location-label="${escapeHtml(item.label)}"
                data-onboarding-location-level="${escapeHtml(item.level || activeLevel)}"
                data-onboarding-location-region="${escapeHtml(item.regionCode || "")}"
                data-onboarding-location-community="${escapeHtml(item.communityCode || "")}"
              >
                <span class="onboarding-city-icon">${icon("mapPin")}</span>
                <span class="onboarding-city-copy">
                  <strong>${escapeHtml(item.label)}</strong>
                  ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
                </span>
                <span class="onboarding-city-check">${icon("check")}</span>
              </button>
            `;
          })
                .join("")
            : `
              <div class="onboarding-location-empty">
                ${icon("search")}
                <strong>Нічого не знайдено</strong>
                <span>Спробуйте інший запит або вкладку.</span>
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderPermissionsStep(step) {
  return `
    <div class="onboarding-permissions">
      <div class="onboarding-permission-list">
        ${step.permissions
          .map(
            (permission) => `
              <article class="permission-card">
                <span class="permission-icon">${icon(permission.icon)}</span>
                <span class="permission-copy">
                  <strong>${escapeHtml(permission.title)}</strong>
                  <span>${escapeHtml(permission.description)}</span>
                </span>
                <span class="permission-check">${icon("check")}</span>
              </article>
            `,
          )
          .join("")}
      </div>

      <article class="security-card">
        <span class="security-icon">${icon("shield")}</span>
        <span>
          <strong>Це безпечно</strong>
          <span>Ми не передаємо ваші дані третім особам</span>
        </span>
      </article>
    </div>
  `;
}

function renderStepContent(step, state) {
  if (step.type === "intro") {
    return renderIntroStep();
  }

  if (step.type === "location") {
    return renderLocationStep(step, state.location);
  }

  return renderPermissionsStep(step);
}

export function renderOnboardingStep(step, stepIndex, totalSteps, state = {}) {
  const isLastStep = stepIndex === totalSteps - 1;
  const canGoBack = stepIndex > 0;

  return `
    <section class="onboarding-page" aria-labelledby="onboarding-title">
      ${
        canGoBack
          ? `
            <button
              class="onboarding-back interactive"
              type="button"
              data-onboarding-back
              aria-label="Повернутись назад"
            >
              ${icon("arrowLeft")}
              <span>Назад</span>
            </button>
          `
          : '<div class="onboarding-back-spacer" aria-hidden="true"></div>'
      }
      <div class="onboarding-copy">
        <p class="onboarding-step">${step.step}</p>
        <h1 id="onboarding-title">${renderTitle(step.title)}</h1>
        ${step.description ? `<p class="onboarding-description">${escapeHtml(step.description)}</p>` : ""}
      </div>

      <div class="onboarding-main">
        ${renderStepContent(step, state)}
      </div>

      <div class="onboarding-actions">
        <button class="onboarding-primary interactive" type="button" data-onboarding-next>
          ${isLastStep ? "Розпочати покупки" : "Продовжити"}
        </button>
        ${
          step.type === "intro"
            ? `
              <a class="onboarding-login interactive" href="${appHref("/login")}" data-link>
                Увійти в акаунт
              </a>
            `
            : ""
        }
        ${
          step.type === "permissions"
            ? `
              <p class="onboarding-footer-note">
                ${icon("lock")}
                Ваші дані під захистом
              </p>
            `
            : ""
        }
      </div>
    </section>
  `;
}
