import { businessForecastData } from "../data/businessMockData.js";
import {
  bindBusinessMockLinks,
  renderBusinessKpiCards,
  renderBusinessPageShell,
} from "./components.js";
import { icon } from "../shared/icons.js";

const chart = {
  width: 720,
  height: 260,
  left: 46,
  right: 22,
  top: 24,
  bottom: 42,
};

function chartX(index, total) {
  return chart.left + (index / Math.max(total - 1, 1)) * (chart.width - chart.left - chart.right);
}

function chartY(value, min, max) {
  return chart.top + ((max - value) / (max - min)) * (chart.height - chart.top - chart.bottom);
}

function linePath(points, getValue, min, max) {
  let started = false;

  return points
    .map((point, index) => {
      const value = getValue(point);
      if (value == null) {
        return null;
      }

      const command = started ? "L" : "M";
      started = true;
      return `${command}${chartX(index, points.length).toFixed(1)} ${chartY(value, min, max).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

function renderDemandForecastChart() {
  const points = businessForecastData.demandForecastPoints;
  const actualPath = linePath(points, (point) => point.actual, 0, 120);
  const forecastPath = linePath(points, (point) => point.forecast, 0, 120);
  const highPoints = points
    .map((point, index) =>
      point.high == null ? null : `${chartX(index, points.length).toFixed(1)} ${chartY(point.high, 0, 120).toFixed(1)}`,
    )
    .filter(Boolean);
  const lowPoints = points
    .map((point, index) =>
      point.low == null ? null : `${chartX(index, points.length).toFixed(1)} ${chartY(point.low, 0, 120).toFixed(1)}`,
    )
    .filter(Boolean)
    .reverse();
  const confidencePath = `M${highPoints.join(" L")} L${lowPoints.join(" L")} Z`;

  return `
    <section class="business-overview-card business-forecast-card" aria-labelledby="business-demand-title">
      <div class="business-card-title-row">
        <h2 id="business-demand-title">Прогноз попиту</h2>
        <span class="business-info-icon" title="Прогноз побудовано на основі сезонності, тренду та зовнішніх факторів.">${icon("info")}</span>
      </div>
      <div class="business-chart-legend business-forecast-legend">
        <span><i></i> Факт</span>
        <span><i></i> Прогноз</span>
        <span><i></i> Довірчий інтервал (80%)</span>
      </div>
      <svg class="business-demand-chart" viewBox="0 0 ${chart.width} ${chart.height}" aria-label="Графік прогнозу попиту">
        <g class="forecast-grid">
          <path d="M${chart.left} 42H698" />
          <path d="M${chart.left} 80H698" />
          <path d="M${chart.left} 118H698" />
          <path d="M${chart.left} 156H698" />
          <path d="M${chart.left} 194H698" />
        </g>
        <g class="forecast-axis">
          <text x="10" y="44">120</text>
          <text x="18" y="82">90</text>
          <text x="18" y="120">60</text>
          <text x="18" y="158">30</text>
          <text x="24" y="196">0</text>
          ${points
            .map((point, index) => `<text x="${chartX(index, points.length) - 16}" y="238">${point.date}</text>`)
            .join("")}
          <text x="0" y="18">тис. л</text>
        </g>
        <path class="forecast-confidence" d="${confidencePath}" />
        <path class="forecast-line forecast-line--actual" d="${actualPath}" />
        <path class="forecast-line forecast-line--future" d="${forecastPath}" />
      </svg>
      <p class="business-chart-caption">${icon("check")} Прогноз побудовано на основі сезонності, тренду та зовнішніх факторів.</p>
    </section>
  `;
}

function renderMilkPack() {
  return `
    <div class="business-milk-pack" aria-hidden="true">
      <span>МОЛОКО</span>
      <strong>2.5%</strong>
      <i></i>
      <small>900 мл</small>
    </div>
  `;
}

function renderProductDetails() {
  const { product } = businessForecastData;
  const rows = [
    ["SKU", product.sku],
    ["Поточна ціна", product.currentPrice],
    ["Очікуваний попит (30 днів)", `${product.expectedDemand30d}<em>${product.expectedGrowth}</em>`],
    ["Очікуваний обсяг продажів", product.expectedSales],
    ["Середньоденний попит", product.avgDailyDemand],
    ["Довірчий інтервал прогнозу (80%)", product.confidenceInterval],
  ];

  return `
    <section class="business-overview-card business-product-detail-card" aria-labelledby="business-product-title">
      ${renderMilkPack()}
      <div class="business-product-details">
        <h2 id="business-product-title">${product.name}</h2>
        <div class="business-product-metrics">
          ${rows
            .map(
              ([label, value], index) => `
                <div class="${index === rows.length - 1 ? "with-divider" : ""}">
                  <span>${label}</span>
                  <strong>${value}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderElasticityChart() {
  const points = businessForecastData.elasticityPoints;
  const minPrice = 20;
  const maxPrice = 36;
  const minDemand = 0;
  const maxDemand = 120;
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const xForPrice = (price) => chart.left + ((price - minPrice) / (maxPrice - minPrice)) * plotWidth;
  const yForDemand = (demand) => chart.top + ((maxDemand - demand) / (maxDemand - minDemand)) * plotHeight;
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xForPrice(point.price).toFixed(1)} ${yForDemand(point.demand).toFixed(1)}`)
    .join(" ");
  const bandX = xForPrice(24.8);
  const bandWidth = xForPrice(26.6) - bandX;
  const currentX = xForPrice(25.4);
  const currentY = yForDemand(72);

  return `
    <section class="business-overview-card business-elasticity-card" aria-labelledby="business-elasticity-title">
      <div class="business-card-title-row">
        <h2 id="business-elasticity-title">Цінова еластичність</h2>
        <span
          class="business-info-icon"
          title="Цінова еластичність показує, як змінюється попит при зміні ціни. Чим нижче значення, тим сильніше попит реагує на зміну ціни."
        >
          ${icon("info")}
        </span>
      </div>
      <div class="business-chart-legend business-elasticity-legend">
        <span><i></i> Очікуваний попит</span>
        <span><i></i> Поточна ціна</span>
        <span><i></i> Оптимальний діапазон</span>
      </div>
      <svg class="business-elasticity-chart" viewBox="0 0 ${chart.width} ${chart.height}" aria-label="Графік цінової еластичності">
        <g class="forecast-grid">
          <path d="M${chart.left} 42H698" />
          <path d="M${chart.left} 80H698" />
          <path d="M${chart.left} 118H698" />
          <path d="M${chart.left} 156H698" />
          <path d="M${chart.left} 194H698" />
        </g>
        <rect class="elasticity-optimal-band" x="${bandX}" y="${chart.top}" width="${bandWidth}" height="${plotHeight}" />
        <line class="elasticity-current-line" x1="${currentX}" y1="${chart.top}" x2="${currentX}" y2="${chart.top + plotHeight}" />
        <path class="forecast-line forecast-line--actual" d="${path}" />
        <circle class="elasticity-current-dot" cx="${currentX}" cy="${currentY}" r="5" />
        <g class="forecast-axis">
          <text x="0" y="18">Очікуваний попит, тис. л</text>
          <text x="10" y="44">120</text>
          <text x="18" y="82">90</text>
          <text x="18" y="120">60</text>
          <text x="18" y="158">30</text>
          <text x="24" y="196">0</text>
          ${[20, 22, 24, 26, 28, 30, 32, 34, 36]
            .map((price) => `<text x="${xForPrice(price) - 8}" y="238">${price}</text>`)
            .join("")}
          <text x="308" y="256">Ціна, ₴ за 1 л</text>
        </g>
        <text class="elasticity-label" x="${bandX}" y="68">24,80 – 26,60 ₴</text>
        <text class="elasticity-price-label" x="${currentX - 24}" y="48">25,40 ₴</text>
      </svg>
    </section>
  `;
}

function renderPriceComparison() {
  const { price, retailers } = businessForecastData;
  const summaryRows = [
    ["Поточна ціна", price.current],
    ["Оптимальна ціна (середина діапазону)", price.optimal],
    ["Очікувана зміна попиту при оптимальній ціні", price.expectedDemandChange],
  ];

  return `
    <section class="business-overview-card business-price-card" aria-labelledby="business-price-title">
      <h2 id="business-price-title">Порівняння цін</h2>
      <div class="business-price-summary-table">
        ${summaryRows
          .map(
            ([label, value], index) => `
              <div class="${index === 1 ? "highlight" : ""}">
                <span>${label}</span>
                <strong>${value}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="business-retailer-table">
        <div class="business-retailer-head" aria-hidden="true">
          <span>Ритейлер</span>
          <span>Ціна, ₴ / л</span>
          <span>Відхилення від оптимальної</span>
        </div>
        ${retailers
          .map(
            (retailer) => `
              <div class="business-retailer-row">
                <span>
                  <i class="retailer-logo retailer-logo--${retailer.retailer.toLowerCase()}">${retailer.logo}</i>
                  ${retailer.retailer}
                </span>
                <strong>${retailer.price}</strong>
                <em class="${retailer.tone}">${retailer.deviation} (${retailer.deviationPercent})</em>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderBottomStrip() {
  const { price } = businessForecastData;
  const stripItems = [
    { label: "Поточна ціна", value: price.current, icon: "tag" },
    { label: "Оптимальна ціна", value: price.optimal, icon: "target" },
    { label: "Очікувана зміна попиту", value: price.expectedDemandChange, icon: "analytics" },
  ];

  return `
    <section class="business-forecast-strip" aria-label="Фінальний підсумок прогнозу">
      ${stripItems
        .map(
          (item) => `
            <article>
              <span>${icon(item.icon)}</span>
              <div>
                <small>${item.label}</small>
                <strong>${item.value}</strong>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

export function renderBusinessForecastPage() {
  return renderBusinessPageShell({
    activeKey: "forecast",
    title: "Прогноз та еластичність",
    filters: businessForecastData.filters,
    status: businessForecastData.status,
    updatedLabel: "Оновлено",
    children: `
      ${renderBusinessKpiCards(businessForecastData.kpis, "Ключові показники прогнозу та еластичності")}
      <div class="business-forecast-row">
        ${renderDemandForecastChart()}
        ${renderProductDetails()}
      </div>
      <div class="business-forecast-row">
        ${renderElasticityChart()}
        ${renderPriceComparison()}
      </div>
      ${renderBottomStrip()}
    `,
  });
}

export function bindBusinessForecastPage() {
  bindBusinessMockLinks();
}
