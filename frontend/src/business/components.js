import { cartIcon, icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

const implementedBusinessRoutes = new Set([
  "/business",
  "/business/overview",
  "/business/geography",
  "/business/forecast",
]);

const sidebarItems = [
  { label: "Огляд", icon: "dashboard", href: "/business", key: "overview" },
  { label: "Географія та пікові години", icon: "mapPin", href: "/business/geography", key: "geography" },
  { label: "Прогноз та еластичність", icon: "trendUp", href: "/business/forecast", key: "forecast" },
  { label: "Налаштування", icon: "settings", href: "/business/settings", key: "settings", bottom: true },
  { label: "Довідка", icon: "helpCircle", href: "/business/help", key: "help", bottom: true },
];

const filterIcons = {
  period: "calendar",
  geography: "mapPin",
  category: "tag",
  retailer: "store",
};

const filterLabels = {
  period: "Період",
  geography: "Географія",
  category: "Категорія",
  retailer: "Ритейлер",
};

export function renderBusinessSidebar(activeKey = "overview") {
  const topItems = sidebarItems.filter((item) => !item.bottom);
  const bottomItems = sidebarItems.filter((item) => item.bottom);

  const renderItem = (item) => {
    const active = item.key === activeKey;
    const linkAttr = implementedBusinessRoutes.has(item.href) ? "data-link" : "data-business-mock-link";

    return `
      <a
        class="business-sidebar-link${active ? " active" : ""}"
        href="${appHref(item.href)}"
        ${linkAttr}
        ${active ? 'aria-current="page"' : ""}
      >
        ${icon(item.icon)}
        <span>${item.label}</span>
      </a>
    `;
  };

  return `
    <aside class="business-sidebar" aria-label="SmartCart Business навігація">
      <nav class="business-platform-switcher" aria-label="Перемикання між клієнтською та бізнес частиною">
        <a class="business-platform-switcher-link interactive" href="${appHref("/")}" data-link data-short="К">
          Клієнт
        </a>
        <a class="business-platform-switcher-link active interactive" href="${appHref("/business")}" data-link data-short="Б" aria-current="page">
          Бізнес
        </a>
      </nav>

      <a class="business-sidebar-brand" href="${appHref("/business")}" data-link aria-label="SmartCart Business">
        ${cartIcon("business-sidebar-logo")}
        <span>
          <strong>SmartCart</strong>
          <small>Business</small>
        </span>
      </a>

      <nav class="business-sidebar-nav" aria-label="Бізнес розділи">
        ${topItems.map(renderItem).join("")}
      </nav>

      <nav class="business-sidebar-nav business-sidebar-nav--bottom" aria-label="Підтримка">
        ${bottomItems.map(renderItem).join("")}
      </nav>
    </aside>
  `;
}

export function renderBusinessTopFilters(filters, ariaLabel = "Фільтри бізнес-сторінки") {
  return `
    <div class="business-topline" aria-label="${ariaLabel}">
      <div class="business-filter-grid">
        ${Object.entries(filters)
          .map(
            ([key, value]) => `
              <button class="business-filter-card interactive" type="button">
                <span class="business-filter-icon">${icon(filterIcons[key])}</span>
                <span>
                  <small>${filterLabels[key]}</small>
                  <strong>${value}</strong>
                </span>
                ${icon("chevronDown", "business-filter-chevron")}
              </button>
            `,
          )
          .join("")}
      </div>

      <div class="business-top-actions">
        <button class="business-export-button interactive" type="button">
          ${icon("download")}
          Експорт
        </button>
        <button class="business-bell-button interactive" type="button" aria-label="Сповіщення">
          ${icon("bell")}
          <span>3</span>
        </button>
        <button class="business-user-button interactive" type="button" aria-label="Профіль користувача">
          <span class="business-avatar">ОК</span>
          ${icon("chevronDown")}
        </button>
      </div>
    </div>
  `;
}

export function renderBusinessKpiCards(kpis, ariaLabel = "Ключові бізнес-показники") {
  return `
    <section class="business-kpis" aria-label="${ariaLabel}">
      ${Object.values(kpis)
        .map(
          (kpi) => `
            <article class="business-kpi-card${kpi.sparkline ? "" : " no-sparkline"}" title="${kpi.meaning ?? kpi.tooltip ?? ""}">
              <span class="business-kpi-icon">${icon(kpi.icon)}</span>
              <span class="business-kpi-copy">
                <span class="business-kpi-label">
                  ${kpi.label}
                  ${
                    kpi.tooltip
                      ? `<span class="business-info-icon" title="${kpi.tooltip}">${icon("info")}</span>`
                      : ""
                  }
                </span>
                <strong>${kpi.value}</strong>
                ${kpi.subtitle ? `<small>${kpi.subtitle}</small>` : ""}
                ${
                  kpi.change
                    ? `<em><b>▲ ${kpi.change}</b> ${kpi.description}</em>`
                    : ""
                }
              </span>
              ${
                kpi.sparkline
                  ? `
                    <svg class="business-kpi-sparkline" viewBox="0 0 70 34" aria-hidden="true">
                      <path d="${kpi.sparkline}" />
                    </svg>
                  `
                  : kpi.subtitle
                    ? ""
                    : ""
              }
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

export function renderBusinessStatusLine(status, updatedLabel = "Дані оновлено") {
  return `
    <footer class="business-status-line">
      <span>${updatedLabel}: ${status.updatedAt}</span>
      ${icon("refresh")}
      <i></i>
      <span>Дані надано: ${status.source}</span>
      <b aria-hidden="true"></b>
    </footer>
  `;
}

export function renderBusinessPageShell({ activeKey, title, filters, children, status, updatedLabel }) {
  return `
    <div class="business-overview-shell">
      ${renderBusinessSidebar(activeKey)}
      <main class="business-overview-main" id="page" tabindex="-1">
        ${renderBusinessTopFilters(filters, `Фільтри сторінки ${title}`)}
        <h1>${title}</h1>
        ${children}
        ${renderBusinessStatusLine(status, updatedLabel)}
      </main>
    </div>
  `;
}

export function bindBusinessMockLinks() {
  document.querySelectorAll("[data-business-mock-link]").forEach((link) => {
    link.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        console.log("Business mock route:", link.getAttribute("href"));
      },
      { capture: true },
    );
  });
}
