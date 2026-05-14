import {
  bindBusinessMockLinks,
  renderBusinessKpiCards,
  renderBusinessPageShell,
} from "./components.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

let businessOverviewState = null;
let businessOverviewError = "";
let overviewRequested = false;

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

function renderBusinessDataState(title, message) {
  return renderBusinessPageShell({
    activeKey: "overview",
    title: "Огляд бізнесу",
    filters: loadingFilters,
    status: loadingStatus,
    children: `
      <section class="business-overview-card" aria-labelledby="business-data-state-title">
        <h2 id="business-data-state-title">${title}</h2>
        <p>${message}</p>
      </section>
    `,
  });
}

function renderUkraineMap() {
  return `
    <svg class="business-ukraine-map" viewBox="0 0 360 210" aria-label="Міні-мапа України">
      <path class="map-region" d="M22 97 51 76l38 7 27-20 31 12 19-19 42 10 30-17 31 20 39 3 30 24-17 31 9 31-42 11-25 25-42-8-36 16-36-19-43 2-26-23-45-4-12-31Z" />
      <path class="map-region map-region--strong" d="M122 73 151 67l27 18-4 32-26 14-34-11-8-26Z" />
      <path class="map-region" d="M55 84 92 88l20 28-22 28-39-4-23-24Z" />
      <path class="map-region" d="M181 86 217 67l38 16-6 37-36 11-31-15Z" />
      <path class="map-region" d="M257 80 310 87l25 25-13 37-55-1-19-29Z" />
      <path class="map-region" d="M113 130 151 140l18 35-44 8-32-27Z" />
      <path class="map-region" d="M181 135 221 132l28 22-15 35-47-8-18-27Z" />
    </svg>
  `;
}

function renderHeatmap() {
  const { weekdays, hours, heatmap } = businessOverviewState.peakHours;

  return `
    <div class="business-heatmap" aria-label="Теплова карта пікових годин">
      <div class="business-heatmap-hours">
        ${hours.map((hour) => `<span>${hour}</span>`).join("")}
      </div>
      <div class="business-heatmap-grid">
        ${heatmap
          .flatMap((row) => row.map((intensity) => `<span data-intensity="${intensity}"></span>`))
          .join("")}
      </div>
      <div class="business-heatmap-days">
        ${weekdays.map((day) => `<span>${day}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderForecastChart() {
  return `
    <svg class="business-forecast-chart" viewBox="0 0 520 178" aria-label="Міні-графік факту та прогнозу">
      <g class="chart-grid">
        <path d="M44 26H500" />
        <path d="M44 72H500" />
        <path d="M44 118H500" />
        <path d="M44 164H500" />
      </g>
      <g class="chart-axis">
        <text x="8" y="31">1,6</text>
        <text x="8" y="77">1,2</text>
        <text x="8" y="123">0,8</text>
        <text x="8" y="168">0,4</text>
        <text x="46" y="176">16 квіт</text>
        <text x="154" y="176">30 квіт</text>
        <text x="264" y="176">14 трав</text>
        <text x="386" y="176">28 трав</text>
      </g>
      <path class="chart-line chart-line--fact" d="M44 138 C76 126 84 118 112 116 S151 125 174 104 209 108 234 78 269 75 292 49 331 75 352 62" />
      <path class="chart-line chart-line--forecast" d="M352 62 C373 41 392 55 412 44 S450 72 468 51 488 39 500 28" />
    </svg>
  `;
}

function renderSummaryCards() {
  const { geography, peakHours, forecast } = businessOverviewState;

  return `
    <section class="business-summary-grid" aria-label="Короткі блоки бізнес-огляду">
      <article class="business-overview-card business-overview-card--geo">
        <header>
          ${icon("map")}
          <h2>Географія продажів</h2>
        </header>
        <div class="business-geo-layout">
          ${renderUkraineMap()}
          <div class="business-card-metrics">
            <span>
              <small>Топ регіон</small>
              <strong>${geography.topRegion}</strong>
            </span>
            <span>
              <small>Зростання продажів</small>
              <strong class="positive">${geography.growth}</strong>
            </span>
            <span>
              <small>Активних міст</small>
              <strong>${geography.activeCities}</strong>
            </span>
          </div>
        </div>
        <a class="business-card-link" href="${appHref("/business/geography")}" data-link>
          Детальніше про географію ${icon("arrowRight")}
        </a>
      </article>

      <article class="business-overview-card">
        <header>
          ${icon("clock")}
          <h2>Пікові години</h2>
        </header>
        <div class="business-peak-layout">
          <div class="business-card-metrics">
            <span>
              <small>Найактивніший час</small>
              <strong>${peakHours.time}</strong>
            </span>
            <span>
              <small>Топ день тижня</small>
              <strong>${peakHours.day}</strong>
            </span>
          </div>
          ${renderHeatmap()}
        </div>
        <a class="business-card-link" href="${appHref("/business/geography")}" data-link>
          Детальніше про пікові години ${icon("arrowRight")}
        </a>
      </article>

      <article class="business-overview-card business-overview-card--forecast">
        <header>
          ${icon("trendUp")}
          <h2>Прогноз та еластичність</h2>
        </header>
        <div class="business-chart-legend">
          <span><i></i> Факт</span>
          <span><i></i> Прогноз</span>
        </div>
        ${renderForecastChart()}
        <div class="business-forecast-metrics">
          <span>
            ${icon("activity")}
            <small>Еластичність</small>
            <strong>${forecast.elasticity}</strong>
          </span>
          <span>
            ${icon("target")}
            <small>Оптимальний діапазон ціни</small>
            <strong>${forecast.optimalPriceRange}</strong>
          </span>
        </div>
        <a class="business-card-link" href="${appHref("/business/forecast")}" data-link>
          Детальніше про прогноз та еластичність ${icon("arrowRight")}
        </a>
      </article>
    </section>
  `;
}

function renderSummaryTable() {
  return `
    <section class="business-summary-table-card" aria-labelledby="business-summary-table-title">
      <h2 id="business-summary-table-title">Короткий підсумок</h2>
      <div class="business-summary-table">
        ${businessOverviewState.summaryRows
          .map(
            (row) => `
              <div class="business-summary-row">
                <span class="business-summary-name">
                  ${icon(row.icon)}
                  <span>${row.label}</span>
                </span>
                <strong>${row.value}</strong>
                <em>${row.change.startsWith("Потенціал") ? row.change : `▲ ${row.change}`}</em>
                <a href="${appHref(row.href)}" ${["/business/geography", "/business/forecast"].includes(row.href) ? "data-link" : "data-business-mock-link"}>
                  ${row.action} ${icon("arrowRight")}
                </a>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderBusinessDashboardPage() {
  if (businessOverviewError) {
    return renderBusinessDataState("Не вдалося завантажити дані", businessOverviewError);
  }

  if (!businessOverviewState) {
    return renderBusinessDataState("Завантаження даних", "Отримуємо бізнес-показники зі SmartCart DB.");
  }

  return renderBusinessPageShell({
    activeKey: "overview",
    title: "Огляд бізнесу",
    filters: businessOverviewState.filters,
    status: businessOverviewState.status,
    children: `
        ${renderBusinessKpiCards(businessOverviewState.kpis, "Ключові показники огляду")}
        ${renderSummaryCards()}
        ${renderSummaryTable()}
      `,
  });
}

export function bindBusinessDashboardPage() {
  if (!overviewRequested) {
    overviewRequested = true;
    fetchJson("/api/business/overview")
      .then((data) => {
        businessOverviewState = data;
        rerenderRoute();
      })
      .catch((error) => {
        businessOverviewError = error.message;
        rerenderRoute();
      });
  }

  bindBusinessMockLinks();
}
