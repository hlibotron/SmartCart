import {
  bindBusinessMockLinks,
  businessFilterApiPath,
  renderBusinessKpiCards,
  renderBusinessPageShell,
} from "./components.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

let businessGeographyState = null;
let businessGeographyError = "";
let geographyRequestKey = "";

const loadingFilters = {
  period: "Завантаження",
  geography: "SmartCart DB",
  category: "Завантаження",
  retailer: "Завантаження",
};

const loadingStatus = {
  updatedAt: "завантаження",
  source: "SmartCart DB",
};

const growthPotentialTitle =
  "Потенціал росту = різниця між поточними продажами і очікуваними продажами, якщо регіон/товар досягне рівня схожих кращих регіонів.";

function renderBusinessDataState(title, message) {
  return renderBusinessPageShell({
    activeKey: "geography",
    title: "Географія та пікові години",
    filters: loadingFilters,
    filterOptions: {},
    status: loadingStatus,
    updatedLabel: "Оновлено",
    children: `
      <section class="business-overview-card" aria-labelledby="business-data-state-title">
        <h2 id="business-data-state-title">${title}</h2>
        <p>${message}</p>
      </section>
    `,
  });
}

function renderRegionMap() {
  const { map, mapLegend } = businessGeographyState;

  return `
    <section class="business-overview-card business-geo-map-card" aria-labelledby="business-geo-map-title">
      <h2 id="business-geo-map-title">Продажі по містах і регіонах</h2>
      <div class="business-region-map-wrap">
        <svg class="business-region-map" viewBox="0 0 720 410" aria-label="Карта продажів по регіонах">
          <path class="geo-region geo-region--1" d="M42 172 93 129l78 15 54-39 63 24 39-39 84 21 60-35 63 42 80 7 62 48-34 62 18 62-84 22-52 49-84-15-72 33-72-39-87 3-52-46-91-9-24-62Z" />
          <path class="geo-region geo-region--4" d="M107 138 182 146l40 56-44 55-78-9-46-48Z" />
          <path class="geo-region geo-region--5" d="M246 124 303 110l54 36-8 64-52 29-68-22-16-52Z" />
          <path class="geo-region geo-region--3" d="M360 147 432 109l76 32-12 74-72 22-63-30Z" />
          <path class="geo-region geo-region--2" d="M511 132 617 146l50 50-26 74-110-2-38-58Z" />
          <path class="geo-region geo-region--3" d="M226 244 302 264l36 70-88 16-64-54Z" />
          <path class="geo-region geo-region--4" d="M362 254 442 248l56 44-30 70-94-16-36-54Z" />
          <path class="geo-region geo-region--2" d="M100 250 166 260l52 49-36 42-91-19-42-48Z" />
          <path class="geo-region geo-region--1" d="M502 274 617 278l50 40-58 46-96-12-38-38Z" />
          <path class="geo-region geo-region--selected" d="M317 121 362 141l16 43-33 34-49-12-16-41Z" />
          <circle class="geo-city-dot" cx="334" cy="170" r="7" />
          <path class="geo-border" d="M42 172 93 129l78 15 54-39 63 24 39-39 84 21 60-35 63 42 80 7 62 48-34 62 18 62-84 22-52 49-84-15-72 33-72-39-87 3-52-46-91-9-24-62Z" />
        </svg>

        <div class="business-map-tooltip">
          <strong>${map.selectedRegion}</strong>
          <b>${map.selectedRegionSales}</b>
          <span>▲ ${map.selectedRegionGrowth} до попер. 30 днів</span>
        </div>

        <div class="business-map-legend" aria-label="Легенда продажів">
          <strong>Продажі, млн ₴</strong>
          ${mapLegend
            .map(
              (item) => `
                <span>
                  <i data-level="${item.level}"></i>
                  ${item.label}
                </span>
              `,
            )
            .join("")}
        </div>
      </div>
      <p class="business-map-caption">Дані за останні 30 днів ${icon("info")}</p>
    </section>
  `;
}

function renderGrowthRegionsTable() {
  return `
    <section class="business-overview-card business-growth-card" aria-labelledby="business-growth-title">
      <div class="business-card-title-row">
        <h2 id="business-growth-title">Регіони з потенціалом росту</h2>
        <span class="business-info-icon" title="${growthPotentialTitle}">${icon("info")}</span>
      </div>

      <div class="business-growth-table">
        <div class="business-growth-head" aria-hidden="true">
          <span>#</span>
          <span>Регіон</span>
          <span>Продажі, млн ₴</span>
          <span>Зміна</span>
          <span>Потенціал</span>
        </div>
        ${businessGeographyState.growthRegions
          .map(
            (row, index) => `
              <div class="business-growth-row">
                <span>${index + 1}</span>
                <strong>${row.region}</strong>
                <span>${row.sales}</span>
                <em>▲ ${row.change}</em>
                <span class="business-potential-cell">
                  <b>${row.score}</b>
                  <i class="${row.potential === "Високий" ? "high" : "medium"}">${row.potential}</i>
                </span>
              </div>
            `,
          )
          .join("")}
      </div>

      <footer class="business-card-footer">
        <span>Показано топ-5 регіонів</span>
        <a href="${appHref("/business/geography/all")}" data-business-mock-link>
          Переглянути всі регіони ${icon("arrowRight")}
        </a>
      </footer>
    </section>
  `;
}

function renderPeakHeatmap() {
  const { days, hours, heatmap } = businessGeographyState.peakHours;

  return `
    <section class="business-overview-card business-peak-hours-card" aria-labelledby="business-peak-title">
      <div class="business-card-title-row">
        <h2 id="business-peak-title">Пікові години покупок</h2>
        <span
          class="business-info-icon"
          title="Показує середню інтенсивність покупок за днями тижня і годинами на основі чеків за вибраний період."
        >
          ${icon("info")}
        </span>
      </div>

      <div class="business-week-heatmap" aria-label="Heatmap покупок за днями та годинами">
        <div class="business-week-heatmap-hours">
          ${hours.map((hour) => `<span>${hour}</span>`).join("")}
        </div>
        <div class="business-week-heatmap-days">
          ${days.map((day) => `<span>${day}</span>`).join("")}
        </div>
        <div class="business-week-heatmap-grid">
          ${heatmap
            .flatMap((row) => row.map((intensity) => `<span data-intensity="${intensity}"></span>`))
            .join("")}
        </div>
      </div>

      <div class="business-heatmap-scale">
        <span>Низька активність</span>
        <i></i>
        <span>Висока активність</span>
      </div>
    </section>
  `;
}

function renderPeakSummaryCards() {
  const { peakHours } = businessGeographyState;
  const cards = [
    {
      label: "Найактивніший день",
      value: peakHours.topDay,
      subtitle: `${peakHours.topDayShare} від тижневих продажів`,
      icon: "calendar",
    },
    {
      label: "Піковий інтервал",
      value: peakHours.peakInterval,
      subtitle: `${peakHours.peakIntervalShare} від добових продажів`,
      icon: "clock",
    },
    {
      label: "Найслабший період",
      value: peakHours.weakestPeriod,
      subtitle: `${peakHours.weakestPeriodShare} від добових продажів`,
      icon: "activity",
      tone: "warning",
    },
  ];

  return `
    <section class="business-peak-summary" aria-label="Короткий підсумок пікових годин">
      ${cards
        .map(
          (card) => `
            <article class="business-peak-mini-card${card.tone === "warning" ? " warning" : ""}">
              <span>${icon(card.icon)}</span>
              <div>
                <small>${card.label}</small>
                <strong>${card.value}</strong>
                <em>${card.subtitle}</em>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderHourlyBarChart() {
  const bars = businessGeographyState.peakHours.hourlySales;
  const maxValue = Math.max(...bars.map((bar) => bar.value));

  return `
    <section class="business-hourly-chart" aria-labelledby="business-hourly-title">
      <h2 id="business-hourly-title">Продажі за годинами <span>(середнє за 30 днів)</span></h2>
      <div class="business-hourly-chart-area">
        <div class="business-hourly-y-axis">
          <span>12</span>
          <span>6</span>
          <span>0</span>
        </div>
        <div class="business-hourly-bars">
          ${bars
            .map(
              (bar) => `
                <span style="height: ${Math.max(8, (bar.value / maxValue) * 100)}%;" title="${bar.hour}:00 · ${bar.value} млн ₴"></span>
              `,
            )
            .join("")}
        </div>
        <div class="business-hourly-x-axis">
          ${bars
            .filter((bar) => Number(bar.hour) % 2 === 0)
            .map((bar) => `<span>${bar.hour}</span>`)
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPeakRightPanel() {
  return `
    <div class="business-peak-right-panel">
      ${renderPeakSummaryCards()}
      ${renderHourlyBarChart()}
    </div>
  `;
}

export function renderBusinessGeographyPage() {
  if (businessGeographyError) {
    return renderBusinessDataState("Не вдалося завантажити дані", businessGeographyError);
  }

  if (!businessGeographyState) {
    return renderBusinessDataState("Завантаження даних", "Отримуємо географію та пікові години зі SmartCart DB.");
  }

  return renderBusinessPageShell({
    activeKey: "geography",
    title: "Географія та пікові години",
    filters: businessGeographyState.filters,
    filterOptions: businessGeographyState.filterOptions,
    status: businessGeographyState.status,
    updatedLabel: "Оновлено",
    children: `
      ${renderBusinessKpiCards(businessGeographyState.kpis, "Ключові показники географії та пікових годин")}
      <div class="business-geography-row business-geography-row--map">
        ${renderRegionMap()}
        ${renderGrowthRegionsTable()}
      </div>
      <div class="business-geography-row business-geography-row--peaks">
        ${renderPeakHeatmap()}
        ${renderPeakRightPanel()}
      </div>
    `,
  });
}

export function bindBusinessGeographyPage() {
  const requestKey = businessFilterApiPath("/api/business/geography");

  if (geographyRequestKey !== requestKey) {
    geographyRequestKey = requestKey;
    fetchJson(requestKey)
      .then((data) => {
        businessGeographyState = data;
        businessGeographyError = "";
        rerenderRoute();
      })
      .catch((error) => {
        businessGeographyError = error.message;
        rerenderRoute();
      });
  }

  bindBusinessMockLinks();
}
