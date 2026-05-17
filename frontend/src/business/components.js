import { cartIcon, icon } from "../shared/icons.js";
import { apiUrl } from "../shared/api.js";
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

const businessFilterKeys = [
  "period",
  "geography",
  "geoRegion",
  "geoCommunity",
  "geoCity",
  "category",
  "brand",
  "product",
  "retailer",
];

const fallbackFilterOptions = {
  period: [
    { value: "1w", label: "Останні 7 днів" },
    { value: "2w", label: "Останні 14 днів" },
    { value: "1m", label: "Останні 30 днів" },
    { value: "3m", label: "Останні 90 днів" },
  ],
  geography: [
    { value: "ukraine", label: "Вся Україна" },
  ],
  category: [
    { value: "all", label: "Усі категорії" },
    { value: "dairy", label: "Молочні" },
    { value: "meat", label: "М'ясні" },
    { value: "vegetables", label: "Овочі" },
    { value: "fruits", label: "Фрукти" },
    { value: "drinks", label: "Напої" },
    { value: "grocery", label: "Бакалія" },
    { value: "other", label: "Інше" },
  ],
  retailer: [
    { value: "all", label: "Усі ритейлери" },
    { value: "АТБ", label: "АТБ" },
    { value: "Сільпо", label: "Сільпо" },
    { value: "Novus", label: "Novus" },
    { value: "Фора", label: "Фора" },
    { value: "Ашан", label: "Ашан" },
  ],
};

const defaultFilterValues = {
  period: "1m",
  geography: "ukraine",
  category: "all",
  retailer: "all",
};

const geographyLevels = [
  {
    key: "region",
    title: "Область",
    placeholder: "Пошук області",
    emptyText: "Областей не знайдено",
  },
  {
    key: "community",
    title: "Громада",
    placeholder: "Пошук громади",
    emptyText: "Громад не знайдено",
  },
  {
    key: "city",
    title: "Місто",
    placeholder: "Пошук міста",
    emptyText: "Міст не знайдено",
  },
];

const categoryLevels = [
  {
    key: "category",
    title: "Категорія",
    placeholder: "Пошук категорії",
    emptyText: "Категорій не знайдено",
  },
  {
    key: "brand",
    title: "Бренд",
    placeholder: "Пошук бренда",
    emptyText: "Брендів не знайдено",
  },
  {
    key: "product",
    title: "Товар",
    placeholder: "Пошук товару",
    emptyText: "Товарів не знайдено",
  },
];

let openBusinessFilterKey = "";

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function normalizeFilterOptions(options = []) {
  return options
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, label: option };
      }

      return {
        value: String(option.value ?? option.key ?? option.label ?? ""),
        label: String(option.label ?? option.value ?? option.key ?? ""),
      };
    })
    .filter((option) => option.value && option.label);
}

function getFilterOptions(filterOptions, key) {
  return normalizeFilterOptions(filterOptions?.[key] ?? fallbackFilterOptions[key] ?? []);
}

function selectedGeoLabel(selection, level) {
  return selection?.[level]?.label || "";
}

function selectedCategoryLabel(selection, level) {
  return selection?.[level]?.label || "";
}

function renderBusinessGeographyMenu(filterOptions, isOpen = false) {
  const selection = filterOptions?.geoSelection ?? {};

  return `
    <div class="business-filter-menu business-filter-menu--geo" role="listbox" ${isOpen ? "" : "hidden"}>
      <button
        class="business-filter-option business-filter-option--country interactive${selection.scope === "ukraine" ? " active" : ""}"
        type="button"
        role="option"
        aria-selected="${selection.scope === "ukraine" ? "true" : "false"}"
        data-business-geo-country="ukraine"
      >
        Вся Україна
      </button>
      <div class="business-geo-filter-levels">
        ${geographyLevels
          .map(
            (level) => `
              <section class="business-geo-filter-level" data-business-geo-level="${level.key}">
                <header>
                  <strong>${level.title}</strong>
                  <small>${escapeAttribute(selectedGeoLabel(selection, level.key))}</small>
                </header>
                <label class="business-geo-search" aria-label="${level.placeholder}">
                  ${icon("search")}
                  <input
                    type="search"
                    placeholder="${level.placeholder}"
                    autocomplete="off"
                    data-business-geo-search="${level.key}"
                  />
                </label>
                <div
                  class="business-geo-results"
                  data-business-geo-results="${level.key}"
                  data-empty-text="${escapeAttribute(level.emptyText)}"
                >
                  <span>Введіть назву або оберіть зі списку</span>
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBusinessCategoryMenu(filterOptions, isOpen = false) {
  const selection = filterOptions?.categorySelection ?? {};

  return `
    <div class="business-filter-menu business-filter-menu--cascade" role="listbox" ${isOpen ? "" : "hidden"}>
      <button
        class="business-filter-option business-filter-option--country interactive${selection.scope === "all" ? " active" : ""}"
        type="button"
        role="option"
        aria-selected="${selection.scope === "all" ? "true" : "false"}"
        data-business-category-all="all"
      >
        Усі категорії
      </button>
      <div class="business-geo-filter-levels">
        ${categoryLevels
          .map(
            (level) => `
              <section class="business-geo-filter-level" data-business-category-level="${level.key}">
                <header>
                  <strong>${level.title}</strong>
                  <small>${escapeAttribute(selectedCategoryLabel(selection, level.key))}</small>
                </header>
                <label class="business-geo-search" aria-label="${level.placeholder}">
                  ${icon("search")}
                  <input
                    type="search"
                    placeholder="${level.placeholder}"
                    autocomplete="off"
                    data-business-category-search="${level.key}"
                  />
                </label>
                <div
                  class="business-geo-results"
                  data-business-category-results="${level.key}"
                  data-empty-text="${escapeAttribute(level.emptyText)}"
                >
                  <span>Введіть назву або оберіть зі списку</span>
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

export function businessFilterApiPath(path) {
  const sourceParams = new URLSearchParams(window.location.search);
  const apiParams = new URLSearchParams();

  businessFilterKeys.forEach((key) => {
    const value = sourceParams.get(key);
    if (value) {
      apiParams.set(key, value);
    }
  });

  const query = apiParams.toString();
  return query ? `${path}?${query}` : path;
}

export function businessHref(path) {
  const params = new URLSearchParams(window.location.search);
  const nextParams = new URLSearchParams();

  businessFilterKeys.forEach((key) => {
    const value = params.get(key);
    if (value) {
      nextParams.set(key, value);
    }
  });

  const query = nextParams.toString();
  return appHref(query ? `${path}?${query}` : path);
}

export function renderBusinessSidebar(activeKey = "overview") {
  const topItems = sidebarItems.filter((item) => !item.bottom);
  const bottomItems = sidebarItems.filter((item) => item.bottom);

  const renderItem = (item) => {
    const active = item.key === activeKey;
    const linkAttr = implementedBusinessRoutes.has(item.href) ? "data-link" : "data-business-mock-link";

    return `
      <a
        class="business-sidebar-link${active ? " active" : ""}"
        href="${businessHref(item.href)}"
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
        <a class="business-platform-switcher-link active interactive" href="${businessHref("/business")}" data-link data-short="Б" aria-current="page">
          Бізнес
        </a>
      </nav>

      <a class="business-sidebar-brand" href="${businessHref("/business")}" data-link aria-label="SmartCart Business">
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

export function renderBusinessTopFilters(
  filters,
  ariaLabel = "Фільтри бізнес-сторінки",
  filterOptions = {},
) {
  return `
    <div class="business-topline" aria-label="${ariaLabel}">
      <div class="business-filter-grid">
        ${Object.entries(filters ?? {})
          .map(
            ([key, value]) => {
              const options = getFilterOptions(filterOptions, key);
              const isGeographyFilter = key === "geography";
              const isCategoryFilter = key === "category";
              const isOpen = openBusinessFilterKey === key;

              return `
                <div class="business-filter-item">
                  <button
                    class="business-filter-card interactive"
                    type="button"
                    data-business-filter-key="${escapeAttribute(key)}"
                    aria-haspopup="listbox"
                    aria-expanded="${isOpen ? "true" : "false"}"
                  >
                    <span class="business-filter-icon">${icon(filterIcons[key])}</span>
                    <span>
                      <small>${filterLabels[key]}</small>
                      <strong>${escapeAttribute(value)}</strong>
                    </span>
                    ${icon("chevronDown", "business-filter-chevron")}
                  </button>
                  ${
                    isGeographyFilter
                      ? renderBusinessGeographyMenu(filterOptions, isOpen)
                      : isCategoryFilter
                        ? renderBusinessCategoryMenu(filterOptions, isOpen)
                      : `
                        <div class="business-filter-menu" role="listbox" ${isOpen ? "" : "hidden"}>
                          ${options
                            .map((option) => {
                              const selected = option.label === value;

                              return `
                                <button
                                  class="business-filter-option interactive${selected ? " active" : ""}"
                                  type="button"
                                  role="option"
                                  aria-selected="${selected ? "true" : "false"}"
                                  data-business-filter-option="${escapeAttribute(option.value)}"
                                >
                                  ${escapeAttribute(option.label)}
                                </button>
                              `;
                            })
                            .join("")}
                        </div>
                      `
                  }
                </div>
              `;
            },
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

export function renderBusinessPageShell({
  activeKey,
  title,
  filters,
  filterOptions,
  children,
  status,
  updatedLabel,
}) {
  return `
    <div class="business-overview-shell">
      ${renderBusinessSidebar(activeKey)}
      <main class="business-overview-main" id="page" tabindex="-1">
        ${renderBusinessTopFilters(filters, `Фільтри сторінки ${title}`, filterOptions)}
        <h1>${title}</h1>
        ${children}
        ${renderBusinessStatusLine(status, updatedLabel)}
      </main>
    </div>
  `;
}

export function bindBusinessTopFilters() {
  const closeMenus = () => {
    openBusinessFilterKey = "";

    document.querySelectorAll(".business-filter-card[aria-expanded='true']").forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });

    document.querySelectorAll(".business-filter-menu").forEach((menu) => {
      menu.hidden = true;
    });
  };

  const loadGeoResults = (level, query = "") => {
    const results = document.querySelector(`[data-business-geo-results="${level}"]`);
    if (!results) {
      return;
    }

    const url = new URL(window.location.href);
    const params = new URLSearchParams({ level, limit: "40" });
    const region = url.searchParams.get("geoRegion");
    const community = url.searchParams.get("geoCommunity");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if ((level === "community" || level === "city") && region) {
      params.set("region", region);
    }
    if (level === "city" && community) {
      params.set("community", community);
    }

    results.innerHTML = "<span>Завантаження...</span>";
    fetch(apiUrl(`/api/business/geography-units?${params.toString()}`), {
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Geo search failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          results.innerHTML = `<span>${escapeAttribute(results.dataset.emptyText || "Нічого не знайдено")}</span>`;
          return;
        }

        results.innerHTML = items
          .map(
            (item) => `
              <button
                class="business-geo-result interactive"
                type="button"
                data-business-geo-value="${escapeAttribute(item.value)}"
                data-business-geo-level="${escapeAttribute(item.level)}"
                data-business-geo-region="${escapeAttribute(item.regionCode || "")}"
                data-business-geo-community="${escapeAttribute(item.communityCode || "")}"
              >
                <strong>${escapeAttribute(item.label)}</strong>
                <small>${escapeAttribute(
                  [item.communityName, item.regionName].filter(Boolean).join(" · "),
                )}</small>
              </button>
            `,
          )
          .join("");
      })
      .catch((error) => {
        console.warn(error.message);
        results.innerHTML = "<span>Не вдалося завантажити довідник</span>";
      });
  };

  const loadAllGeoResults = () => {
    geographyLevels.forEach((level) => {
      const input = document.querySelector(`[data-business-geo-search="${level.key}"]`);
      loadGeoResults(level.key, input?.value || "");
    });
  };

  const applyGeoSelection = (button) => {
    const url = new URL(window.location.href);
    const level = button.dataset.businessGeoLevel;
    const value = button.dataset.businessGeoValue;

    if (!level || !value) {
      url.searchParams.set("geography", "ukraine");
      url.searchParams.delete("geoRegion");
      url.searchParams.delete("geoCommunity");
      url.searchParams.delete("geoCity");
    } else if (level === "region") {
      url.searchParams.set("geography", "region");
      url.searchParams.set("geoRegion", value);
      url.searchParams.delete("geoCommunity");
      url.searchParams.delete("geoCity");
    } else if (level === "community") {
      url.searchParams.set("geography", "community");
      if (button.dataset.businessGeoRegion) {
        url.searchParams.set("geoRegion", button.dataset.businessGeoRegion);
      }
      url.searchParams.set("geoCommunity", value);
      url.searchParams.delete("geoCity");
    } else if (level === "city") {
      url.searchParams.set("geography", "city");
      if (button.dataset.businessGeoRegion) {
        url.searchParams.set("geoRegion", button.dataset.businessGeoRegion);
      }
      if (button.dataset.businessGeoCommunity) {
        url.searchParams.set("geoCommunity", button.dataset.businessGeoCommunity);
      }
      url.searchParams.set("geoCity", value);
    }

    if (url.searchParams.get("geography") === defaultFilterValues.geography) {
      url.searchParams.delete("geography");
    }

    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    openBusinessFilterKey = "";
    window.dispatchEvent(new Event("popstate"));
  };

  const loadCategoryResults = (level, query = "") => {
    const results = document.querySelector(`[data-business-category-results="${level}"]`);
    if (!results) {
      return;
    }

    const url = new URL(window.location.href);
    const params = new URLSearchParams({ level, limit: "40" });
    const category = url.searchParams.get("category");
    const brand = url.searchParams.get("brand");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if ((level === "brand" || level === "product") && category) {
      params.set("category", category);
    }
    if (level === "product" && brand) {
      params.set("brand", brand);
    }

    results.innerHTML = "<span>Завантаження...</span>";
    fetch(apiUrl(`/api/business/category-units?${params.toString()}`), {
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Category search failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) {
          results.innerHTML = `<span>${escapeAttribute(results.dataset.emptyText || "Нічого не знайдено")}</span>`;
          return;
        }

        results.innerHTML = items
          .map(
            (item) => `
              <button
                class="business-geo-result interactive"
                type="button"
                data-business-category-value="${escapeAttribute(item.value)}"
                data-business-category-level="${escapeAttribute(item.level)}"
                data-business-category-category="${escapeAttribute(item.category || "")}"
                data-business-category-brand="${escapeAttribute(item.brand || "")}"
              >
                <strong>${escapeAttribute(item.label)}</strong>
                <small>${escapeAttribute(
                  [item.brand, item.category && item.level !== "category" ? item.category : ""]
                    .filter(Boolean)
                    .join(" · "),
                )}</small>
              </button>
            `,
          )
          .join("");
      })
      .catch((error) => {
        console.warn(error.message);
        results.innerHTML = "<span>Не вдалося завантажити довідник</span>";
      });
  };

  const loadAllCategoryResults = () => {
    categoryLevels.forEach((level) => {
      const input = document.querySelector(`[data-business-category-search="${level.key}"]`);
      loadCategoryResults(level.key, input?.value || "");
    });
  };

  const applyCategorySelection = (button) => {
    const url = new URL(window.location.href);
    const level = button.dataset.businessCategoryLevel;
    const value = button.dataset.businessCategoryValue;

    if (!level || !value) {
      url.searchParams.delete("category");
      url.searchParams.delete("brand");
      url.searchParams.delete("product");
    } else if (level === "category") {
      if (value === defaultFilterValues.category) {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", value);
      }
      url.searchParams.delete("brand");
      url.searchParams.delete("product");
    } else if (level === "brand") {
      if (button.dataset.businessCategoryCategory) {
        url.searchParams.set("category", button.dataset.businessCategoryCategory);
      }
      url.searchParams.set("brand", value);
      url.searchParams.delete("product");
    } else if (level === "product") {
      if (button.dataset.businessCategoryCategory) {
        url.searchParams.set("category", button.dataset.businessCategoryCategory);
      }
      if (button.dataset.businessCategoryBrand) {
        url.searchParams.set("brand", button.dataset.businessCategoryBrand);
      }
      url.searchParams.set("product", value);
    }

    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    openBusinessFilterKey = "category";
    window.dispatchEvent(new Event("popstate"));
  };

  document.querySelectorAll(".business-filter-card").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = button.closest(".business-filter-item");
      const menu = item?.querySelector(".business-filter-menu");
      if (!menu) {
        return;
      }

      const willOpen = menu.hidden;
      closeMenus();
      openBusinessFilterKey = willOpen ? button.dataset.businessFilterKey || "" : "";
      menu.hidden = !willOpen;
      button.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen && button.dataset.businessFilterKey === "geography") {
        loadAllGeoResults();
      }
      if (willOpen && button.dataset.businessFilterKey === "category") {
        loadAllCategoryResults();
      }
    });
  });

  document.querySelectorAll(".business-filter-menu").forEach((menu) => {
    menu.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.querySelectorAll(".business-filter-option").forEach((option) => {
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      if (option.dataset.businessGeoCountry) {
        applyGeoSelection(option);
        return;
      }
      if (option.dataset.businessCategoryAll) {
        applyCategorySelection(option);
        return;
      }

      const item = option.closest(".business-filter-item");
      const key = item?.querySelector(".business-filter-card")?.dataset.businessFilterKey;
      const value = option.dataset.businessFilterOption;
      if (!key || !value) {
        return;
      }

      const url = new URL(window.location.href);
      if (value === defaultFilterValues[key]) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }

      window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
      openBusinessFilterKey = "";
      window.dispatchEvent(new Event("popstate"));
    });
  });

  const geoSearchTimers = {};
  document.querySelectorAll("[data-business-geo-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const level = input.dataset.businessGeoSearch;
      clearTimeout(geoSearchTimers[level]);
      geoSearchTimers[level] = setTimeout(() => {
        loadGeoResults(level, input.value);
      }, 180);
    });
  });

  document.querySelectorAll(".business-geo-results").forEach((results) => {
    results.addEventListener("click", (event) => {
      const button = event.target.closest(".business-geo-result");
      if (!button) {
        return;
      }

      applyGeoSelection(button);
    });
  });

  const categorySearchTimers = {};
  document.querySelectorAll("[data-business-category-search]").forEach((input) => {
    input.addEventListener("input", () => {
      const level = input.dataset.businessCategorySearch;
      clearTimeout(categorySearchTimers[level]);
      categorySearchTimers[level] = setTimeout(() => {
        loadCategoryResults(level, input.value);
      }, 180);
    });
  });

  document.querySelectorAll("[data-business-category-results]").forEach((results) => {
    results.addEventListener("click", (event) => {
      const button = event.target.closest("[data-business-category-value]");
      if (!button) {
        return;
      }

      applyCategorySelection(button);
    });
  });

  if (openBusinessFilterKey === "category") {
    loadAllCategoryResults();
  }

  document.querySelector(".business-overview-main")?.addEventListener("click", (event) => {
    if (event.target.closest(".business-topline")) {
      return;
    }

    closeMenus();
  });
}

export function bindBusinessMockLinks() {
  bindBusinessTopFilters();

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
