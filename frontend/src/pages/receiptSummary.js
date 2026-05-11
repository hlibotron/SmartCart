import {
  receiptFilters,
  receiptItems as fallbackReceiptItems,
  receiptSummary as fallbackReceiptSummary,
} from "../data/receiptSummary.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";

let summaryData = {
  receiptItems: fallbackReceiptItems,
  receiptSummary: fallbackReceiptSummary,
};
let loadedReceipt = null;

function renderStoreLogo(summary) {
  return `<span class="receipt-summary-logo receipt-summary-logo--${summary.logo}">${summary.logoText}</span>`;
}

export function renderReceiptOverview() {
  return `
    <section class="receipt-overview-card" aria-label="Загальна інформація про чек">
      <div class="receipt-store-row">
        ${renderStoreLogo(summaryData.receiptSummary)}
        <div class="receipt-store-info">
          <strong>${summaryData.receiptSummary.store}</strong>
          <span>${icon("calendar")}${summaryData.receiptSummary.dateTime}</span>
          <span class="receipt-scan-status">${icon("check")}${summaryData.receiptSummary.status}</span>
        </div>
        <div class="receipt-overview-total">
          <span class="receipt-status-badge">${icon("check")}${summaryData.receiptSummary.statusBadge}</span>
          <strong>${summaryData.receiptSummary.total}</strong>
        </div>
      </div>

      <div class="receipt-summary-stats">
        ${summaryData.receiptSummary.stats
          .map(
            (stat) => `
              <span>
                <span class="summary-stat-icon">${icon(stat.icon)}</span>
                <span class="summary-stat-copy">
                  <small>${stat.label}</small>
                  <strong>${stat.value}</strong>
                </span>
              </span>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderFilterChips() {
  return `
    <div class="receipt-filter-chips" aria-label="Фільтри товарів у чеку">
      ${receiptFilters
        .map(
          (filter) => `
            <button
              class="receipt-filter-chip interactive${filter.active ? " active" : ""}"
              type="button"
              data-filter-key="${filter.key}"
            >
              ${filter.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderProductThumb(item) {
  return `
    <span class="receipt-item-thumb receipt-item-thumb--${item.thumbnail}" aria-hidden="true">
      <span></span>
    </span>
  `;
}

function renderValue(value, label = "") {
  if (!value) {
    return `<strong class="muted-value">—</strong>`;
  }

  return `<strong>${value}</strong>${label ? ` <em>${label}</em>` : ""}`;
}

export function renderReceiptItem(item) {
  return `
    <button class="receipt-item-card interactive" type="button" data-item-name="${item.name}">
      <div class="receipt-item-product">
        ${renderProductThumb(item)}
        <div class="receipt-item-info">
          <strong>${item.name}</strong>
          <span>${item.quantity}</span>
          <span>${item.unitPrice}</span>
        </div>
      </div>
      <span class="receipt-item-cell receipt-item-total">
        <small>Сума</small>
        <strong>${item.total}</strong>
      </span>
      <span class="receipt-item-cell receipt-detail-pill receipt-detail-pill--discount">
        <span>
          <small>Знижка</small>
          ${renderValue(item.discount)}
        </span>
      </span>
      <span class="receipt-item-cell receipt-detail-pill receipt-detail-pill--store-cashback">
        <span>
          <small>Кешбек магазину</small>
          ${renderValue(item.storeCashback, item.storeCashbackLabel)}
        </span>
      </span>
      <span class="receipt-item-cell receipt-detail-pill receipt-detail-pill--smartcart">
        <span>
          <small>Кешбек SmartCart</small>
          ${renderValue(item.smartCartCashback)}
        </span>
      </span>
    </button>
  `;
}

export function renderReceiptTotals() {
  return `
    <section class="receipt-total-card" aria-label="Підсумки чеку">
      <div class="receipt-total-list">
        ${summaryData.receiptSummary.totals
          .map(
            (total, index) => `
              <div class="receipt-total-row receipt-total-row--${index}">
                ${icon(index === 0 ? "calendar" : index === 1 ? "tag" : "refresh")}
                <span>${total.label}</span>
                <strong>${total.value}</strong>
              </div>
            `,
          )
          .join("")}
      </div>

      <div class="receipt-cashback-panel">
        <div class="receipt-cashback-total">
          <span>${summaryData.receiptSummary.expectedCashback.label}</span>
          <strong>${summaryData.receiptSummary.expectedCashback.value}</strong>
        </div>
      </div>
    </section>
  `;
}

export function renderReceiptSummaryPage() {
  return `
    <section class="receipt-summary-page" aria-labelledby="receipt-summary-title">
      <h1 id="receipt-summary-title">Підсумок чеку</h1>
      ${renderReceiptOverview()}
      ${renderFilterChips()}
      <section class="receipt-items-list" aria-label="Товари з чеку">
        ${summaryData.receiptItems.map(renderReceiptItem).join("")}
      </section>
      ${renderReceiptTotals()}
    </section>
  `;
}

export function bindReceiptSummaryPage() {
  const receiptId = new URLSearchParams(window.location.search).get("receipt");
  const endpoint = receiptId ? `/api/receipts/${encodeURIComponent(receiptId)}` : "/api/receipts/latest";
  const receiptKey = receiptId ?? "latest";

  if (loadedReceipt !== receiptKey) {
    loadedReceipt = receiptKey;
    fetchJson(endpoint)
      .then((data) => {
        summaryData = {
          receiptItems: Array.isArray(data.receiptItems)
            ? data.receiptItems
            : fallbackReceiptItems,
          receiptSummary: data.receiptSummary ?? fallbackReceiptSummary,
        };
        rerenderRoute();
      })
      .catch((error) => {
        console.warn(error.message);
      });
  }

  document.querySelectorAll(".receipt-filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".receipt-filter-chip").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      console.log("Receipt summary filter:", chip.dataset.filterKey);
    });
  });

  document.querySelectorAll(".receipt-item-card").forEach((card) => {
    card.addEventListener("click", () => {
      console.log("Open receipt item:", card.dataset.itemName);
    });
  });

  document.querySelector("#openReceiptCashback")?.addEventListener("click", () => {
    console.log("Open cashback from receipt summary");
  });

  document.querySelector("#saveReceipt")?.addEventListener("click", () => {
    console.log("Save receipt");
  });
}
