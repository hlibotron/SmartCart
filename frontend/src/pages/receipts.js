import { icon } from "../shared/icons.js";
import {
  receipts as fallbackReceipts,
  receiptSummary as fallbackReceiptSummary,
} from "../data/receipts.js";
import { assetUrl, fetchJson, rerenderRoute } from "../shared/api.js";
import { appHref } from "../shared/navigation.js";

let receiptsData = {
  receipts: fallbackReceipts,
  receiptSummary: fallbackReceiptSummary,
};
let apiRequested = false;
let filtersOpen = false;
let receiptFiltersState = {
  query: "",
  period: "all",
  store: "all",
};

const receiptPeriodFilters = [
  { key: "all", label: "Весь час" },
  { key: "1w", label: "7 днів", days: 7 },
  { key: "1m", label: "30 днів", days: 30 },
  { key: "3m", label: "90 днів", days: 90 },
];

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function parseReceiptDate(value) {
  const [day, month, year] = String(value || "")
    .split(".")
    .map((part) => Number(part));

  if (!day || !month || !year) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getStoreOptions() {
  return Array.from(new Set(receiptsData.receipts.map((receipt) => receipt.store).filter(Boolean))).sort(
    (first, second) => first.localeCompare(second, "uk"),
  );
}

function receiptMatchesFilters(receipt) {
  const query = receiptFiltersState.query.trim().toLowerCase();
  if (query) {
    const haystack = [receipt.store, receipt.date, receipt.amount, receipt.items]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) {
      return false;
    }
  }

  if (receiptFiltersState.store !== "all" && receipt.store !== receiptFiltersState.store) {
    return false;
  }

  const period = receiptPeriodFilters.find((item) => item.key === receiptFiltersState.period);
  if (period?.days) {
    const receiptDate = parseReceiptDate(receipt.date);
    if (!receiptDate) {
      return false;
    }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - period.days);
    if (receiptDate < cutoff) {
      return false;
    }
  }

  return true;
}

function getFilteredReceipts() {
  return receiptsData.receipts.filter(receiptMatchesFilters);
}

function renderReceiptListContent(receipts) {
  if (!receipts.length) {
    return `
      <div class="receipts-empty">
        ${icon("receipt")}
        <strong>Чеків не знайдено</strong>
        <span>Змініть пошук або фільтри.</span>
      </div>
    `;
  }

  return receipts.map(renderReceiptCard).join("");
}

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
  const logoUrl = assetUrl(receipt.logoUrl || "");
  const logo = logoUrl
    ? `<span class="receipt-logo receipt-logo--image"><img src="${logoUrl}" alt="" loading="lazy" onerror="this.hidden = true;" /></span>`
    : `<span class="receipt-logo receipt-logo--${receipt.logo}">${receipt.logoText}</span>`;

  return `
    <button
      class="receipt-card interactive"
      type="button"
      data-store="${escapeAttribute(receipt.store)}"
      data-date="${escapeAttribute(receipt.date)}"
      ${receipt.id ? `data-receipt-id="${receipt.id}"` : ""}
    >
      ${logo}
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

function renderReceiptFilters() {
  const stores = getStoreOptions();
  return `
    <section class="receipts-filter-panel${filtersOpen ? " open" : ""}" aria-label="Фільтри чеків">
      <div class="receipt-filter-group">
        <span>Період</span>
        <div class="receipt-filter-options">
          ${receiptPeriodFilters
            .map(
              (period) => `
                <button
                  class="receipt-filter-chip interactive${receiptFiltersState.period === period.key ? " active" : ""}"
                  type="button"
                  data-receipt-period="${period.key}"
                >
                  ${period.label}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="receipt-filter-group">
        <span>Магазин</span>
        <div class="receipt-filter-options receipt-filter-options--stores">
          <button
            class="receipt-filter-chip interactive${receiptFiltersState.store === "all" ? " active" : ""}"
            type="button"
            data-receipt-store="all"
          >
            Усі
          </button>
          ${stores
            .map(
              (store) => `
                <button
                  class="receipt-filter-chip interactive${receiptFiltersState.store === store ? " active" : ""}"
                  type="button"
                  data-receipt-store="${escapeAttribute(store)}"
                >
                  ${store}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

export function renderReceiptsPage() {
  const visibleReceipts = getFilteredReceipts();

  return `
    <section class="receipts-page" aria-labelledby="receipts-title">
      <h1 id="receipts-title">Мої чеки</h1>

      <div class="receipts-search-row">
        <label class="receipts-search" aria-label="Пошук чеків по магазинах">
          ${icon("search")}
          <input
            id="receiptSearch"
            type="search"
            placeholder="Пошук по магазинах"
            autocomplete="off"
            value="${escapeAttribute(receiptFiltersState.query)}"
          />
        </label>
        <button class="receipts-filter-btn interactive${filtersOpen ? " active" : ""}" type="button" id="receiptFilterButton">
          ${icon("sliders")}
          <span>Фільтри</span>
        </button>
      </div>
      ${renderReceiptFilters()}

      <section class="receipts-stats" aria-label="Підсумок чеків">
        ${receiptsData.receiptSummary.map(renderSummaryStat).join("")}
      </section>

      <div class="receipts-result-count" id="receiptsResultCount">
        Показано ${visibleReceipts.length} з ${receiptsData.receipts.length}
      </div>

      <section class="receipts-list" aria-label="Список чеків">
        ${renderReceiptListContent(visibleReceipts)}
      </section>
    </section>
  `;
}

function bindReceiptCards() {
  document.querySelectorAll(".receipt-card").forEach((card) => {
    card.addEventListener("click", () => {
      const receiptPath = card.dataset.receiptId
        ? `/receipt-summary?receipt=${encodeURIComponent(card.dataset.receiptId)}`
        : "/receipt-summary";
      window.history.pushState({}, "", appHref(receiptPath));
      window.dispatchEvent(new Event("popstate"));
    });
  });
}

function updateVisibleReceipts() {
  const visibleReceipts = getFilteredReceipts();
  const list = document.querySelector(".receipts-list");
  const count = document.querySelector("#receiptsResultCount");
  if (list) {
    list.innerHTML = renderReceiptListContent(visibleReceipts);
    bindReceiptCards();
  }
  if (count) {
    count.textContent = `Показано ${visibleReceipts.length} з ${receiptsData.receipts.length}`;
  }
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
    receiptFiltersState.query = event.target.value;
    updateVisibleReceipts();
  });

  document.querySelector("#receiptFilterButton")?.addEventListener("click", () => {
    filtersOpen = !filtersOpen;
    rerenderRoute();
  });

  document.querySelectorAll("[data-receipt-period]").forEach((chip) => {
    chip.addEventListener("click", () => {
      receiptFiltersState.period = chip.dataset.receiptPeriod;
      rerenderRoute();
    });
  });

  document.querySelectorAll("[data-receipt-store]").forEach((chip) => {
    chip.addEventListener("click", () => {
      receiptFiltersState.store = chip.dataset.receiptStore;
      rerenderRoute();
    });
  });

  bindReceiptCards();
}
