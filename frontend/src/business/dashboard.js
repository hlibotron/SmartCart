import {
  businessHref,
  bindBusinessMockLinks,
  businessFilterApiPath,
  renderBusinessKpiCards,
  renderBusinessPageShell,
} from "./components.js";
import {
  businessKyivMap,
  businessKyivProjection,
  renderBusinessCommunityChoropleth,
  renderBusinessMapTiles,
} from "./geography.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";

let businessOverviewState = null;
let businessOverviewError = "";
let overviewRequestKey = "";
let businessOverviewMapZoom = 1;

const businessOverviewMapZoomMin = 1;
const businessOverviewMapZoomMax = 2.8;
const businessOverviewMapZoomStep = 0.25;

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function businessOverviewMapViewBox() {
  const width = businessKyivMap.width / businessOverviewMapZoom;
  const height = businessKyivMap.height / businessOverviewMapZoom;
  const x = (businessKyivMap.width - width) / 2;
  const y = (businessKyivMap.height - height) / 2;

  return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`;
}

function businessOverviewMapZoomPercent() {
  return `${Math.round(businessOverviewMapZoom * 100)}%`;
}

function renderOverviewMapControls() {
  return `
    <div class="business-map-controls business-overview-map-controls" aria-label="Керування масштабом мапи огляду">
      <button
        class="business-map-control interactive"
        type="button"
        data-business-overview-map-zoom="out"
        aria-label="Зменшити мапу"
        ${businessOverviewMapZoom <= businessOverviewMapZoomMin ? "disabled" : ""}
      >−</button>
      <span class="business-map-zoom-label" data-business-overview-map-zoom-label>${businessOverviewMapZoomPercent()}</span>
      <button
        class="business-map-control interactive"
        type="button"
        data-business-overview-map-zoom="in"
        aria-label="Збільшити мапу"
        ${businessOverviewMapZoom >= businessOverviewMapZoomMax ? "disabled" : ""}
      >+</button>
      <button
        class="business-map-control business-map-control--reset interactive"
        type="button"
        data-business-overview-map-zoom="reset"
        aria-label="Скинути масштаб"
      >${icon("refresh")}</button>
    </div>
  `;
}

function renderBusinessDataState(title, message) {
  return renderBusinessPageShell({
    activeKey: "overview",
    title: "Огляд бізнесу",
    filters: loadingFilters,
    filterOptions: {},
    status: loadingStatus,
    children: `
      <section class="business-overview-card" aria-labelledby="business-data-state-title">
        <h2 id="business-data-state-title">${title}</h2>
        <p>${message}</p>
      </section>
    `,
  });
}

function renderUkraineMap(geography) {
  const projection = businessKyivProjection();

  return `
    <div class="business-overview-map-wrap">
      <svg
        class="business-ukraine-map business-region-map"
        viewBox="${businessOverviewMapViewBox()}"
        role="img"
        aria-label="Карта громад Київської області з аналітичним шаром продажів"
        data-business-overview-map
      >
        <defs>
          <clipPath id="business-kyiv-overview-clip">
            <path d="${businessKyivMap.outlinePath}" clip-rule="evenodd" />
          </clipPath>
        </defs>
        <path class="business-region-map-shadow" d="${businessKyivMap.outlinePath}" fill-rule="evenodd" />
        <foreignObject x="0" y="0" width="${businessKyivMap.width}" height="${businessKyivMap.height}" clip-path="url(#business-kyiv-overview-clip)">
          <div xmlns="http://www.w3.org/1999/xhtml" class="business-region-map-surface">
            <div class="business-region-map-tiles" aria-hidden="true">
              ${renderBusinessMapTiles(projection)}
            </div>
            <div class="business-region-map-overlay" aria-hidden="true"></div>
          </div>
        </foreignObject>
        <g class="business-community-layer" clip-path="url(#business-kyiv-overview-clip)">
          ${renderBusinessCommunityChoropleth()}
        </g>
        <path class="business-region-map-outline" d="${businessKyivMap.outlinePath}" fill-rule="evenodd" />
      </svg>
      ${renderOverviewMapControls()}
      <div class="business-map-tooltip business-overview-map-tooltip">
        <strong>${geography.topRegion}</strong>
        <b>${geography.growth}</b>
        <span>динаміка продажів</span>
      </div>
      <a
        class="business-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap
      </a>
    </div>
  `;
}

function updateBusinessOverviewMapZoomDom() {
  const map = document.querySelector("[data-business-overview-map]");
  const zoomLabel = document.querySelector("[data-business-overview-map-zoom-label]");

  map?.setAttribute("viewBox", businessOverviewMapViewBox());
  if (zoomLabel) {
    zoomLabel.textContent = businessOverviewMapZoomPercent();
  }

  document.querySelectorAll("[data-business-overview-map-zoom]").forEach((button) => {
    const action = button.dataset.businessOverviewMapZoom;
    button.disabled =
      (action === "out" && businessOverviewMapZoom <= businessOverviewMapZoomMin) ||
      (action === "in" && businessOverviewMapZoom >= businessOverviewMapZoomMax);
  });
}

function setBusinessOverviewMapZoom(value) {
  businessOverviewMapZoom = clamp(value, businessOverviewMapZoomMin, businessOverviewMapZoomMax);
  updateBusinessOverviewMapZoomDom();
}

function bindBusinessOverviewMapControls() {
  const wrap = document.querySelector(".business-overview-map-wrap");

  if (!wrap || wrap.dataset.businessOverviewMapBound === "true") {
    return;
  }

  wrap.dataset.businessOverviewMapBound = "true";
  wrap.querySelectorAll("[data-business-overview-map-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.businessOverviewMapZoom;

      if (action === "in") {
        setBusinessOverviewMapZoom(businessOverviewMapZoom + businessOverviewMapZoomStep);
      } else if (action === "out") {
        setBusinessOverviewMapZoom(businessOverviewMapZoom - businessOverviewMapZoomStep);
      } else {
        setBusinessOverviewMapZoom(1);
      }
    });
  });

  updateBusinessOverviewMapZoomDom();
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

function overviewElasticityStarPath(cx, cy, r) {
  const points = [];

  for (let index = 0; index < 10; index += 1) {
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    const radius = index % 2 === 0 ? r : r * 0.45;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }

  return points.join(" ");
}

function renderForecastChart() {
  const points = [
    { price: 18, revenue: 72, probability: 92 },
    { price: 20, revenue: 96, probability: 84 },
    { price: 22, revenue: 118, probability: 75 },
    { price: 24, revenue: 134, probability: 64 },
    { price: 26, revenue: 141, probability: 53 },
    { price: 28, revenue: 132, probability: 42 },
    { price: 30, revenue: 116, probability: 32 },
    { price: 32, revenue: 92, probability: 24 },
  ];
  const width = 720;
  const height = 260;
  const left = 46;
  const right = 40;
  const top = 24;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const prices = points.map((point) => point.price);
  const revenues = points.map((point) => point.revenue);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const revMin = Math.max(0, Math.min(...revenues) - 12);
  const revMax = Math.max(...revenues) + 12;
  const xPrice = (price) => left + ((price - minPrice) / (maxPrice - minPrice)) * plotWidth;
  const yRevenue = (revenue) => top + ((revMax - revenue) / (revMax - revMin)) * plotHeight;
  const yProbability = (value) => top + ((100 - value) / 100) * plotHeight;
  const revenuePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xPrice(point.price).toFixed(1)} ${yRevenue(point.revenue).toFixed(1)}`)
    .join(" ");
  const probabilityPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xPrice(point.price).toFixed(1)} ${yProbability(point.probability).toFixed(1)}`)
    .join(" ");
  const optimalPoint = points.reduce((best, point) => (point.revenue > best.revenue ? point : best), points[0]);
  const optimalX = xPrice(optimalPoint.price);
  const optimalY = yRevenue(optimalPoint.revenue);
  const priceTicks = [18, 20, 22, 24, 26, 28, 30, 32];
  const revTicks = [80, 100, 120, 140];
  const probabilityTicks = [0, 25, 50, 75, 100];

  return `
    <svg
      class="business-elasticity-chart business-overview-elasticity-chart"
      viewBox="0 0 ${width} ${height}"
      aria-label="Крива доходу та еластичність попиту"
    >
      <g class="forecast-grid">
        ${probabilityTicks
          .map((value) => `<path d="M${left} ${yProbability(value).toFixed(0)}H${width - right}" />`)
          .join("")}
      </g>

      <path class="business-overview-revenue-line" d="${revenuePath}" />
      <path class="business-overview-probability-line" d="${probabilityPath}" />
      <polygon class="business-overview-optimal-star" points="${overviewElasticityStarPath(optimalX, optimalY, 7)}" />

      <g class="forecast-axis">
        <text x="0" y="14" fill="#2563eb" font-weight="600">Дохід, ₴</text>
        ${revTicks
          .map((value) => `<text x="${left - 8}" y="${(yRevenue(value) + 4).toFixed(0)}" text-anchor="end">${value}</text>`)
          .join("")}

        <text x="${width - right + 6}" y="14" fill="#10b981" font-weight="600">Попит, %</text>
        ${probabilityTicks
          .map((value) => `<text x="${width - right + 8}" y="${(yProbability(value) + 4).toFixed(0)}" text-anchor="start">${value}</text>`)
          .join("")}

        ${priceTicks
          .map((price) => `<text x="${xPrice(price).toFixed(0)}" y="${height - 10}" text-anchor="middle">${price}</text>`)
          .join("")}
        <text x="${left + plotWidth / 2}" y="${height - 1}" text-anchor="middle" fill="#9ca3af">Тестова ціна, ₴</text>
      </g>

      <text class="elasticity-price-label" x="${optimalX.toFixed(0)}" y="${(optimalY - 14).toFixed(0)}" text-anchor="middle">
        ${optimalPoint.price.toFixed(2)} ₴
      </text>
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
          ${renderUkraineMap(geography)}
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
        <a class="business-card-link" href="${businessHref("/business/geography")}" data-link>
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
        <a class="business-card-link" href="${businessHref("/business/geography")}" data-link>
          Детальніше про пікові години ${icon("arrowRight")}
        </a>
      </article>

      <article class="business-overview-card business-overview-card--forecast business-elasticity-card">
        <header>
          ${icon("trendUp")}
          <h2>Крива доходу та еластичність попиту</h2>
        </header>
        <div class="business-chart-legend business-elasticity-legend business-overview-elasticity-legend">
          <span><i></i> Очікуваний дохід</span>
          <span><i></i> Ймовірність покупки</span>
          <span><i></i> Оптимальна ціна</span>
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
        <a class="business-card-link" href="${businessHref("/business/forecast")}" data-link>
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
                <a href="${businessHref(row.href)}" ${["/business/geography", "/business/forecast"].includes(row.href) ? "data-link" : "data-business-mock-link"}>
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
    filterOptions: businessOverviewState.filterOptions,
    status: businessOverviewState.status,
    children: `
        ${renderBusinessKpiCards(businessOverviewState.kpis, "Ключові показники огляду")}
        ${renderSummaryCards()}
        ${renderSummaryTable()}
      `,
  });
}

export function bindBusinessDashboardPage() {
  const requestKey = businessFilterApiPath("/api/business/overview");

  if (overviewRequestKey !== requestKey) {
    overviewRequestKey = requestKey;
    fetchJson(requestKey)
      .then((data) => {
        businessOverviewState = data;
        businessOverviewError = "";
        rerenderRoute();
      })
      .catch((error) => {
        businessOverviewError = error.message;
        rerenderRoute();
      });
  }

  bindBusinessMockLinks();
  bindBusinessOverviewMapControls();
}
