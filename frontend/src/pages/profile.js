import { profileFallbackData } from "../data/profileFallbackData.js";
import { getProfileOverview } from "../services/profileService.js";
import { rerenderRoute } from "../shared/api.js";
import { logoutUser } from "../shared/auth.js";
import { getAuthToken } from "../shared/authSession.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

let profileState = {
  data: profileFallbackData,
  status: "loading",
  warning: "",
};
let apiRequested = false;
let requestedToken = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SC"
  );
}

function navigate(path) {
  window.history.pushState({}, "", appHref(path));
  window.dispatchEvent(new Event("popstate"));
}

function renderSkeleton() {
  return `
    <section class="profile-page" aria-labelledby="profile-title" aria-busy="true">
      <h1 class="profile-title" id="profile-title">Профіль</h1>
      <div class="profile-header">
        <span class="profile-skeleton profile-skeleton-avatar"></span>
        <div class="profile-header-copy">
          <span class="profile-skeleton profile-skeleton-line"></span>
          <span class="profile-skeleton profile-skeleton-line short"></span>
          <span class="profile-skeleton profile-skeleton-line badge"></span>
        </div>
        ${icon("chevron", "chevron")}
      </div>
      <section class="profile-overview" aria-label="Завантаження показників профілю">
        ${[1, 2, 3]
          .map(
            () => `
              <article class="profile-stat">
                <span class="profile-skeleton profile-skeleton-stat"></span>
                <span class="profile-skeleton profile-skeleton-line short"></span>
                <span class="profile-skeleton profile-skeleton-line short"></span>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="profile-card" aria-label="Завантаження налаштувань">
        ${[1, 2, 3, 4, 5, 6]
          .map(
            () => `
              <div class="profile-settings-row">
                <span class="round-icon">${icon("info")}</span>
                <span class="profile-skeleton profile-skeleton-line"></span>
                <span class="profile-skeleton profile-skeleton-line short"></span>
                ${icon("chevron", "chevron")}
              </div>
            `,
          )
          .join("")}
      </section>
    </section>
  `;
}

function renderAvatar(user) {
  if (user.avatarUrl) {
    return `
      <span class="profile-avatar">
        <img src="${escapeHtml(user.avatarUrl)}" alt="" loading="lazy" onerror="this.remove();" />
      </span>
    `;
  }

  return `<span class="profile-avatar" aria-hidden="true">${escapeHtml(initials(user.name))}</span>`;
}

function renderStat({ iconName, label, value, subtitle }) {
  return `
    <article class="profile-stat">
      <span class="profile-stat-label">${icon(iconName)}${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </article>
  `;
}

function renderSettingsRow({ iconName, title, value, target, action }) {
  return `
    <button
      class="profile-settings-row interactive"
      type="button"
      data-profile-action="${escapeHtml(action || "navigate")}"
      ${target ? `data-profile-target="${escapeHtml(target)}"` : ""}
    >
      <span class="round-icon">${icon(iconName)}</span>
      <span class="profile-settings-title">${escapeHtml(title)}</span>
      ${value ? `<span class="profile-settings-value">${escapeHtml(value)}</span>` : "<span></span>"}
      ${icon("chevron", "chevron")}
    </button>
  `;
}

export function renderProfilePage() {
  if (profileState.status === "loading") {
    return renderSkeleton();
  }

  const { user, stats, settings } = profileState.data;
  const statItems = [
    {
      iconName: "receipt",
      label: "Чеки",
      value: stats.receiptsCount,
      subtitle: "за цей місяць",
    },
    {
      iconName: "wallet",
      label: "Кешбек",
      value: stats.cashbackAvailable,
      subtitle: "доступно",
    },
    {
      iconName: "trendUp",
      label: "Економія",
      value: stats.monthlySavings,
      subtitle: "за цей місяць",
    },
  ];

  const settingRows = [
    {
      iconName: "mapPin",
      title: "Моя локація",
      value: settings.location,
      target: "/profile/location",
      action: "missing-route",
    },
    {
      iconName: "bell",
      title: "Сповіщення",
      target: "/profile/notifications",
      action: "missing-route",
    },
    {
      iconName: "creditCard",
      title: "Спосіб виплати кешбеку",
      value: settings.payoutMethodLabel,
      target: "/cashback",
    },
    {
      iconName: "shield",
      title: "Конфіденційність",
      target: "/profile/privacy",
      action: "missing-route",
    },
    {
      iconName: "helpCircle",
      title: "Підтримка",
      target: "/support",
      action: "missing-route",
    },
    {
      iconName: "info",
      title: "Про додаток",
      value: settings.appVersion,
      target: "/about",
      action: "missing-route",
    },
  ];

  return `
    <section class="profile-page" aria-labelledby="profile-title">
      <h1 class="profile-title" id="profile-title">Профіль</h1>

      <button class="profile-header interactive" type="button" data-profile-action="missing-route" data-profile-target="/profile/edit">
        ${renderAvatar(user)}
        <span class="profile-header-copy">
          <span class="profile-name">${escapeHtml(user.name)}</span>
          <p>${escapeHtml(user.subtitle)}</p>
          <span class="profile-level">${icon("shield")}${escapeHtml(user.level)}</span>
        </span>
        ${icon("chevron", "chevron")}
      </button>

      <section class="profile-overview" aria-label="Показники профілю">
        ${statItems.map(renderStat).join("")}
      </section>

      <section class="profile-card" aria-label="Налаштування профілю">
        ${settingRows.map(renderSettingsRow).join("")}
      </section>

      <button class="profile-logout interactive" type="button" data-profile-action="logout">
        ${icon("logOut")}
        Вийти з акаунту
      </button>

      ${profileState.warning ? `<p class="profile-warning">${escapeHtml(profileState.warning)}</p>` : ""}
    </section>
  `;
}

export function bindProfilePage() {
  const authToken = getAuthToken();
  if (requestedToken !== authToken) {
    apiRequested = false;
    requestedToken = authToken;
    profileState = {
      data: profileFallbackData,
      status: "loading",
      warning: "",
    };
  }

  if (!apiRequested) {
    apiRequested = true;
    getProfileOverview()
      .then(({ data, warning }) => {
        profileState = {
          data,
          status: "ready",
          warning,
        };
        rerenderRoute();
      })
      .catch((error) => {
        console.warn(error.message);
        profileState = {
          data: profileFallbackData,
          status: "ready",
          warning: "Деякі дані тимчасово недоступні",
        };
        rerenderRoute();
      });
  }

  document.querySelectorAll("[data-profile-action]").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.profileAction;
      const target = element.dataset.profileTarget;

      if (action === "logout") {
        logoutUser();
        navigate("/login");
        return;
      }

      if (action === "missing-route") {
        console.warn(`Route is not implemented yet: ${target}`);
        return;
      }

      if (target) {
        navigate(target);
      }
    });
  });
}
