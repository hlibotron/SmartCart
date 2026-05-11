import {
  analyticsPeriods,
  analyticsSummary as fallbackAnalyticsSummary,
  categoryBreakdown as fallbackCategoryBreakdown,
  topCategory as fallbackTopCategory,
} from "../data/analytics.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";

let analyticsData = {
  analyticsSummary: fallbackAnalyticsSummary,
  categoryBreakdown: fallbackCategoryBreakdown,
  topCategory: fallbackTopCategory,
};
let loadedPeriod = null;
let selectedPeriod = "1m";

function applyAnalyticsData(data) {
  analyticsData = {
    analyticsSummary: data.analyticsSummary ?? fallbackAnalyticsSummary,
    categoryBreakdown: Array.isArray(data.categoryBreakdown)
      ? data.categoryBreakdown
      : fallbackCategoryBreakdown,
    topCategory: data.topCategory ?? fallbackTopCategory,
  };
}

function loadAnalytics(period) {
  if (loadedPeriod === period) {
    return;
  }

  loadedPeriod = period;
  fetchJson(`/api/analytics/categories?period=${encodeURIComponent(period)}`)
    .then((data) => {
      applyAnalyticsData(data);
      rerenderRoute();
    })
    .catch((error) => {
      console.warn(error.message);
    });
}

function renderPeriodChips() {
  return `
    <div class="analytics-periods" aria-label="Період аналітики">
      ${analyticsPeriods
        .map(
          (period) => `
            <button
              class="analytics-period-chip interactive${period.key === selectedPeriod ? " active" : ""}"
              type="button"
              data-period-key="${period.key}"
            >
              ${period.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function buildDonutGradient() {
  let start = 0;

  return analyticsData.categoryBreakdown
    .map((category) => {
      const end = start + category.percent;
      const segment = `${category.color} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(", ");
}

function renderDonutChart() {
  return `
    <div class="analytics-donut" style="--donut-gradient: ${buildDonutGradient()};">
      <div class="analytics-donut-center">
        <strong>${analyticsData.analyticsSummary.total}</strong>
        <span>${analyticsData.analyticsSummary.totalLabel}</span>
        <span>${analyticsData.analyticsSummary.totalPeriod}</span>
      </div>
      ${analyticsData.categoryBreakdown
        .map(
          (category, index) => `
            <span class="analytics-donut-label analytics-donut-label--${index}" style="color: ${category.color};">
              ${category.percent}%
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderLegend() {
  return `
    <div class="analytics-legend">
      ${analyticsData.categoryBreakdown
        .map(
          (category) => `
            <div class="analytics-legend-row">
              <span class="analytics-dot" style="background: ${category.color};"></span>
              <span>${category.name}</span>
              <strong>${category.amount} <small>(${category.percent}%)</small></strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCategoryRow(category) {
  return `
    <button class="analytics-category-row interactive" type="button" data-category-name="${category.name}">
      <span class="analytics-category-icon" style="--category-color: ${category.color}; --category-soft: ${category.colorSoft};">
        ${icon(category.icon)}
      </span>
      <span class="analytics-category-name">
        <strong>${category.name}</strong>
        <small>${category.items}</small>
      </span>
      <strong class="analytics-category-amount">${category.amount}</strong>
      <span class="analytics-percent-pill">${category.percent}%</span>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

function renderAnalyticsCard() {
  return `
    <section class="analytics-card" aria-labelledby="analytics-card-title">
      <div class="analytics-card-heading">
        <h2 id="analytics-card-title">${analyticsData.analyticsSummary.title}</h2>
        ${icon("info")}
        <p>${analyticsData.analyticsSummary.subtitle}</p>
      </div>

      <div class="analytics-chart-grid">
        ${renderDonutChart()}
        ${renderLegend()}
      </div>

      <div class="analytics-table">
        <div class="analytics-table-head" aria-hidden="true">
          <span>Категорія</span>
          <span>Витрачено</span>
          <span>Частка</span>
        </div>
        ${analyticsData.categoryBreakdown.map(renderCategoryRow).join("")}
      </div>
    </section>
  `;
}

function renderTopCategoryCard() {
  return `
    <button class="analytics-top-card interactive" type="button" data-top-category="${analyticsData.topCategory.name}">
      <span class="analytics-top-title">
        <strong>Топ категорія місяця</strong>
        <span>✦</span>
      </span>
      <small>${analyticsData.topCategory.subtitle}</small>

      <div class="analytics-top-content">
        <span class="analytics-top-icon">${icon(analyticsData.topCategory.icon)}</span>
        <span class="analytics-top-copy">
          <strong>${analyticsData.topCategory.name}</strong>
          <span>${analyticsData.topCategory.description}</span>
          <b>${analyticsData.topCategory.amount} <small>(${analyticsData.topCategory.percentText})</small></b>
        </span>
        <span class="analytics-sparkline" aria-hidden="true">
          <svg viewBox="0 0 150 54">
            <path d="M5 38 C18 27 25 24 37 35 S61 38 73 25 S94 31 105 18 S124 7 145 12" />
            <circle cx="145" cy="12" r="3.5" />
          </svg>
          <span>${analyticsData.topCategory.trend}</span>
        </span>
      </div>
    </button>
  `;
}

export function renderAnalyticsPage() {
  return `
    <section class="analytics-page" aria-labelledby="analytics-title">
      <h1 id="analytics-title">Аналітика покупок</h1>
      ${renderPeriodChips()}
      ${renderAnalyticsCard()}
      ${renderTopCategoryCard()}
    </section>
  `;
}

export function bindAnalyticsPage() {
  loadAnalytics(selectedPeriod);

  document.querySelectorAll(".analytics-period-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".analytics-period-chip").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      console.log("Analytics period:", chip.dataset.periodKey);
      selectedPeriod = chip.dataset.periodKey;
      loadAnalytics(selectedPeriod);
    });
  });

  document.querySelectorAll(".analytics-category-row").forEach((row) => {
    row.addEventListener("click", () => {
      console.log("Open category analytics:", row.dataset.categoryName);
    });
  });

  document.querySelector(".analytics-top-card")?.addEventListener("click", (event) => {
    console.log("Open top category:", event.currentTarget.dataset.topCategory);
  });
}
