import { icon } from "../shared/icons.js";
import {
  receipts as fallbackReceipts,
  receiptSummary as fallbackReceiptSummary,
} from "../data/receipts.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";

let receiptsData = {
  receipts: fallbackReceipts,
  receiptSummary: fallbackReceiptSummary,
};
let apiRequested = false;

function renderSummaryStat(stat, index) {
  return `
    <article class="receipts-stat${index > 0 ? " with-divider" : ""}">
      <span class="round-icon">${icon(stat.icon)}</span>
      <div>
        <p>${stat.label}</p>
        <strong>${stat.value}</strong>
        <span>${stat.trend}</span>
      </div>
    </article>
  `;
}

function renderReceiptCard(receipt) {
  return `
    <button
      class="receipt-card interactive"
      type="button"
      data-store="${receipt.store}"
      data-date="${receipt.date}"
      ${receipt.id ? `data-receipt-id="${receipt.id}"` : ""}
    >
      <span class="receipt-logo receipt-logo--${receipt.logo}">${receipt.logoText}</span>
      <span class="receipt-meta">
        <strong>${receipt.store}</strong>
        <span>${icon("calendar")}${receipt.date}</span>
        <span>${icon("basket")}${receipt.items}</span>
      </span>
      <strong class="receipt-amount">${receipt.amount}</strong>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

export function renderReceiptsPage() {
  return `
    <section class="receipts-page" aria-labelledby="receipts-title">
      <h1 id="receipts-title">Мої чеки</h1>

      <div class="receipts-search-row">
        <label class="receipts-search" aria-label="Пошук чеків по магазинах">
          ${icon("search")}
          <input id="receiptSearch" type="search" placeholder="Пошук по магазинах" autocomplete="off" />
        </label>
        <button class="receipts-filter-btn interactive" type="button" id="receiptFilterButton">
          ${icon("sliders")}
          <span>Фільтри</span>
        </button>
      </div>

      <section class="receipts-stats" aria-label="Підсумок чеків">
        ${receiptsData.receiptSummary.map(renderSummaryStat).join("")}
      </section>

      <section class="receipts-list" aria-label="Список чеків">
        ${receiptsData.receipts.map(renderReceiptCard).join("")}
      </section>
    </section>
  `;
}

export function bindReceiptsPage() {
  if (!apiRequested) {
    apiRequested = true;
    fetchJson("/api/receipts")
      .then((data) => {
        receiptsData = {
          receipts: Array.isArray(data.receipts) ? data.receipts : fallbackReceipts,
          receiptSummary: Array.isArray(data.receiptSummary)
            ? data.receiptSummary
            : fallbackReceiptSummary,
        };
        rerenderRoute();
      })
      .catch((error) => {
        console.warn(error.message);
      });
  }

  document.querySelector("#receiptSearch")?.addEventListener("input", (event) => {
    console.log("Search receipts:", event.target.value);
  });

  document.querySelector("#receiptFilterButton")?.addEventListener("click", () => {
    console.log("Open receipt filters");
  });

  document.querySelectorAll(".receipt-card").forEach((card) => {
    card.addEventListener("click", () => {
      console.log("Open receipt:", card.dataset.store, card.dataset.date);
      const receiptPath = card.dataset.receiptId
        ? `/receipt-summary?receipt=${encodeURIComponent(card.dataset.receiptId)}`
        : "/receipt-summary";
      window.history.pushState({}, "", receiptPath);
      window.dispatchEvent(new Event("popstate"));
    });
  });
}
