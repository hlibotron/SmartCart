import { analyticsPeriods, categoryBreakdown } from "../data/analytics.js";
import { assetUrl, fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { formatProductText } from "../shared/text.js";

const fallbackCategory = categoryBreakdown[0];

let categoryData = {
  category: fallbackCategory,
  summary: {
    title: fallbackCategory.name,
    subtitle: "Немає даних",
    total: "₴0",
    percentText: "0% від усіх витрат",
    items: "0 товарів",
    receipts: "0 чеків",
    averageItem: "₴0",
  },
  stats: [],
  topProducts: [],
  recentReceipts: [],
};
let loadedCategoryKey = null;
let selectedPeriod = "1m";

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function thumbClassName(value) {
  const normalized = String(value || "info").replace(/[^a-z0-9_-]/gi, "");
  return normalized || "info";
}

function loadCategoryAnalytics(categoryKey, period) {
  const loadKey = `${categoryKey}:${period}`;
  if (loadedCategoryKey === loadKey) {
    return;
  }

  loadedCategoryKey = loadKey;
  fetchJson(
    `/api/analytics/categories/${encodeURIComponent(categoryKey)}?period=${encodeURIComponent(period)}`,
  )
    .then((data) => {
      categoryData = {
        category: data.category ?? fallbackCategory,
        summary: data.summary ?? categoryData.summary,
        stats: Array.isArray(data.stats) ? data.stats : [],
        topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
        recentReceipts: Array.isArray(data.recentReceipts) ? data.recentReceipts : [],
      };
      rerenderRoute();
    })
    .catch((error) => {
      console.warn(error.message);
    });
}

function renderPeriodChips() {
  return `
    <div class="analytics-periods" aria-label="Період аналітики категорії">
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

function renderCategoryHero() {
  const category = categoryData.category;
  return `
    <section
      class="analytics-category-hero"
      style="--category-color: ${category.color}; --category-soft: ${category.colorSoft};"
      aria-label="Підсумок категорії"
    >
      <span class="analytics-category-hero-icon">${icon(category.icon)}</span>
      <span class="analytics-category-hero-copy">
        <small>${categoryData.summary.subtitle}</small>
        <strong>${categoryData.summary.title}</strong>
        <em>${categoryData.summary.percentText}</em>
      </span>
      <span class="analytics-category-hero-total">
        <strong>${categoryData.summary.total}</strong>
        <small>${categoryData.summary.items}</small>
      </span>
    </section>
  `;
}

function renderStat(stat) {
  return `
    <article class="analytics-category-stat">
      <span>${icon(stat.icon)}</span>
      <small>${stat.label}</small>
      <strong>${stat.value}</strong>
    </article>
  `;
}

function visibleCategoryStats() {
  const stats = categoryData.stats.length
    ? categoryData.stats
    : [
        { label: "Товарів", value: categoryData.summary.items, icon: "basket" },
        { label: "Чеків", value: categoryData.summary.receipts, icon: "receipt" },
        { label: "Середній товар", value: categoryData.summary.averageItem, icon: "tag" },
      ];

  return stats.filter((stat) => stat.label !== "Витрачено");
}

function renderProductThumb(product) {
  const visual = product.visual ?? {};
  const imageUrl = assetUrl(visual.url || "");
  const thumb = thumbClassName(visual.thumb);
  const fallbackMarkup = imageUrl ? "" : "<span></span>";

  return `
    <span class="analytics-category-product-thumb analytics-category-product-thumb--${thumb}" aria-hidden="true">
      ${
        imageUrl
          ? `<img src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" onerror="this.hidden = true;" />`
          : ""
      }
      ${fallbackMarkup}
    </span>
  `;
}

function renderProductRow(product) {
  const productName = formatProductText(product.name);

  return `
    <button
      class="analytics-category-product-row interactive"
      type="button"
      data-product-name="${escapeAttribute(product.name)}"
    >
      ${renderProductThumb(product)}
      <span class="analytics-category-product-copy">
        <strong>${productName}</strong>
        <small>${product.store} · ${product.items}</small>
      </span>
      <span class="analytics-category-product-price">
        <strong>${product.amount}</strong>
        <small>${product.latestPrice}</small>
      </span>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

function renderStoreLogo(receipt) {
  const logoUrl = assetUrl(receipt.logoUrl || "");
  return logoUrl
    ? `<span class="analytics-category-receipt-logo analytics-category-receipt-logo--image"><img src="${escapeAttribute(logoUrl)}" alt="" loading="lazy" onerror="this.hidden = true;" /></span>`
    : `<span class="analytics-category-receipt-logo analytics-category-receipt-logo--${receipt.logo}">${receipt.logoText}</span>`;
}

function renderReceiptRow(receipt) {
  return `
    <button
      class="analytics-category-receipt-row interactive"
      type="button"
      data-receipt-id="${receipt.id}"
    >
      ${renderStoreLogo(receipt)}
      <span class="analytics-category-receipt-copy">
        <strong>${receipt.store}</strong>
        <small>${receipt.date} · ${receipt.items}</small>
      </span>
      <strong>${receipt.amount}</strong>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

function renderEmptyState(text) {
  return `
    <div class="analytics-category-empty">
      ${icon("info")}
      <span>${text}</span>
    </div>
  `;
}

export function renderAnalyticsCategoryPage() {
  return `
    <section class="analytics-category-page" aria-labelledby="analytics-category-title">
      <h1 id="analytics-category-title">Аналітика категорії</h1>
      ${renderPeriodChips()}
      ${renderCategoryHero()}

      <section class="analytics-category-stats" aria-label="Показники категорії">
        ${visibleCategoryStats().map(renderStat).join("")}
      </section>

      <section class="analytics-category-section" aria-labelledby="analytics-category-products">
        <h2 id="analytics-category-products">Товари категорії</h2>
        <div class="analytics-category-list">
          ${
            categoryData.topProducts.length
              ? categoryData.topProducts.map(renderProductRow).join("")
              : renderEmptyState("У цій категорії ще немає товарів за обраний період.")
          }
        </div>
      </section>

      <section class="analytics-category-section" aria-labelledby="analytics-category-receipts">
        <h2 id="analytics-category-receipts">Чеки з категорією</h2>
        <div class="analytics-category-list">
          ${
            categoryData.recentReceipts.length
              ? categoryData.recentReceipts.map(renderReceiptRow).join("")
              : renderEmptyState("Чеків з цією категорією за обраний період не знайдено.")
          }
        </div>
      </section>
    </section>
  `;
}

export function bindAnalyticsCategoryPage() {
  const params = new URLSearchParams(window.location.search);
  const categoryKey = params.get("category") || fallbackCategory.key;
  selectedPeriod = params.get("period") || selectedPeriod;

  loadCategoryAnalytics(categoryKey, selectedPeriod);

  document.querySelectorAll(".analytics-period-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const nextPeriod = chip.dataset.periodKey;
      window.history.pushState(
        {},
        "",
        appHref(
          `/analytics-category?category=${encodeURIComponent(categoryKey)}&period=${encodeURIComponent(
            nextPeriod,
          )}`,
        ),
      );
      window.dispatchEvent(new Event("popstate"));
    });
  });

  document.querySelectorAll(".analytics-category-product-row").forEach((row) => {
    row.addEventListener("click", () => {
      const productName = row.dataset.productName;
      if (!productName) {
        return;
      }
      window.history.pushState(
        {},
        "",
        appHref(`/product-price?product=${encodeURIComponent(productName)}`),
      );
      window.dispatchEvent(new Event("popstate"));
    });
  });

  document.querySelectorAll(".analytics-category-receipt-row").forEach((row) => {
    row.addEventListener("click", () => {
      const receiptId = row.dataset.receiptId;
      if (!receiptId) {
        return;
      }
      window.history.pushState(
        {},
        "",
        appHref(`/receipt-summary?receipt=${encodeURIComponent(receiptId)}`),
      );
      window.dispatchEvent(new Event("popstate"));
    });
  });
}
