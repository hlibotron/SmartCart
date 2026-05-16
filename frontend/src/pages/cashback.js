import { cashbackFallbackData } from "../data/cashbackFallbackData.js";
import {
  getCashbackPageData,
  startCashbackWithdraw,
  updateCashbackAutoActivation,
} from "../services/cashbackService.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { assetUrl, rerenderRoute } from "../shared/api.js";

const payoutSetupPath = "/profile/payout";
let cashbackState = {
  data: cashbackFallbackData,
  loading: true,
  warning: "",
};
let apiRequested = false;
let activeFilter = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navigate(path) {
  window.history.pushState({}, "", appHref(path));
  rerenderRoute();
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  navigate("/");
}

function numericAmount(value) {
  const match = String(value || "").replace(/\s/g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function hasPayoutMethod(summary) {
  return Boolean(summary.payoutMethodLabel && summary.payoutMethodLabel !== "Не додано");
}

function renderSkeleton() {
  return `
    <section class="cashback-page" aria-labelledby="cashback-title">
      <div class="cashback-page-header">
        <button class="cashback-back-button interactive" type="button" data-cashback-back aria-label="Назад">
          ${icon("arrowLeft")}
        </button>
        <h1 id="cashback-title">Керування кешбеком</h1>
      </div>
      <div class="cashback-card cashback-balance-card is-skeleton"></div>
      <div class="cashback-card cashback-toggle-row is-skeleton"></div>
      <div class="cashback-filter-row">
        <span class="cashback-chip-skeleton"></span>
        <span class="cashback-chip-skeleton"></span>
        <span class="cashback-chip-skeleton"></span>
      </div>
      <div class="cashback-card cashback-payout-card is-skeleton"></div>
      <section class="cashback-history-section" aria-labelledby="cashback-history-title">
        <h2 id="cashback-history-title">Історія кешбеку</h2>
        <div class="cashback-history-list is-skeleton">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </section>
    </section>
  `;
}

function renderBalanceCard(summary) {
  return `
    <section class="cashback-card cashback-balance-card" aria-label="Баланс кешбеку">
      <div class="cashback-balance-grid">
        <span>
          <small>Доступно<br />до виведення</small>
          <strong>${escapeHtml(summary.availableBalance)}</strong>
        </span>
        <i aria-hidden="true"></i>
        <span>
          <small>Очікує<br />підтвердження</small>
          <strong class="cashback-pending-value">${escapeHtml(summary.pendingBalance)}</strong>
        </span>
      </div>
      <button class="cashback-withdraw-button interactive" type="button" id="cashbackWithdrawButton">
        ${icon("creditCard")}
        <span>Вивести на картку</span>
      </button>
    </section>
  `;
}

function renderAutoActivation(summary) {
  const enabled = Boolean(summary.autoActivationEnabled);
  return `
    <section class="cashback-card cashback-toggle-row" aria-label="Автоактивація кампаній">
      <span class="cashback-row-icon">${icon("clock")}</span>
      <strong>Автоактивація кампаній</strong>
      <button
        class="cashback-toggle interactive${enabled ? " active" : ""}"
        type="button"
        id="cashbackAutoToggle"
        role="switch"
        aria-checked="${enabled ? "true" : "false"}"
      >
        <span></span>
      </button>
    </section>
  `;
}

function renderFilters(filters) {
  return `
    <div class="cashback-filter-row" aria-label="Фільтр історії кешбеку">
      ${filters
        .map(
          (filter) => `
            <button
              class="cashback-filter-chip interactive${filter.key === activeFilter ? " active" : ""}"
              type="button"
              data-cashback-filter="${escapeHtml(filter.key)}"
            >
              ${escapeHtml(filter.label)}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCardBrand() {
  return `
    <span class="cashback-card-brand" aria-hidden="true">
      <i></i>
      <i></i>
    </span>
  `;
}

function renderPayoutMethod(summary) {
  return `
    <section class="cashback-card cashback-payout-card" aria-labelledby="cashback-payout-title">
      <span class="cashback-payout-copy">
        <strong id="cashback-payout-title">Спосіб виплати</strong>
        <span>
          ${renderCardBrand()}
          <b>${escapeHtml(summary.payoutMethodLabel || "Не додано")}</b>
        </span>
      </span>
      <button class="cashback-change-button interactive" type="button" id="cashbackChangePayout">
        Змінити
      </button>
    </section>
  `;
}

function itemTone(status) {
  if (status === "pending") {
    return "pending";
  }
  if (status === "withdrawn") {
    return "withdrawn";
  }
  return "credited";
}

function renderHistoryIcon(item) {
  if (item.image) {
    return `<img src="${escapeHtml(assetUrl(item.image))}" alt="" loading="lazy" onerror="this.hidden = true;" />`;
  }

  return icon(item.icon || (item.type === "withdraw" ? "creditCard" : "cashback"));
}

function renderHistoryItem(item) {
  const tone = itemTone(item.status);
  return `
    <article class="cashback-history-row">
      <span class="cashback-history-icon cashback-history-icon--${tone}">
        ${renderHistoryIcon(item)}
      </span>
      <span class="cashback-history-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.date)}</small>
      </span>
      <span class="cashback-history-meta">
        <strong class="${String(item.amount).startsWith("-") ? "negative" : "positive"}">
          ${escapeHtml(item.amount)}
        </strong>
        <small class="cashback-status cashback-status--${tone}">
          ${escapeHtml(item.statusLabel)}
        </small>
      </span>
    </article>
  `;
}

function filteredHistory() {
  const items = cashbackState.data.history;
  return activeFilter === "all" ? items : items.filter((item) => item.status === activeFilter);
}

function renderHistory() {
  const items = filteredHistory();
  return `
    <section class="cashback-history-section" aria-labelledby="cashback-history-title">
      <h2 id="cashback-history-title">Історія кешбеку</h2>
      <div class="cashback-history-list">
        ${
          items.length
            ? items.map(renderHistoryItem).join("")
            : `<p class="cashback-history-empty">Немає операцій у цьому статусі.</p>`
        }
      </div>
    </section>
  `;
}

function renderInfoCard(infoText) {
  return `
    <section class="cashback-info-card" aria-label="Коли зараховується кешбек">
      <span>${icon("info")}</span>
      <p>${escapeHtml(infoText)}</p>
    </section>
  `;
}

export function renderCashbackPage() {
  if (cashbackState.loading) {
    return renderSkeleton();
  }

  const { summary, filters, info } = cashbackState.data;
  return `
    <section class="cashback-page" aria-labelledby="cashback-title">
      <div class="cashback-page-header">
        <button class="cashback-back-button interactive" type="button" data-cashback-back aria-label="Назад">
          ${icon("arrowLeft")}
        </button>
        <h1 id="cashback-title">Керування кешбеком</h1>
      </div>
      ${cashbackState.warning ? `<p class="cashback-warning">${escapeHtml(cashbackState.warning)}</p>` : ""}
      ${renderBalanceCard(summary)}
      ${renderAutoActivation(summary)}
      ${renderFilters(filters)}
      ${renderPayoutMethod(summary)}
      ${renderHistory()}
      ${renderInfoCard(info)}
    </section>
  `;
}

export function bindCashbackPage() {
  document.querySelector("[data-cashback-back]")?.addEventListener("click", goBack);

  if (!apiRequested) {
    apiRequested = true;
    getCashbackPageData()
      .then((result) => {
        cashbackState = {
          data: result.data,
          loading: false,
          warning: result.warning || "",
        };
        rerenderRoute();
      })
      .catch((error) => {
        console.warn(error.message);
        cashbackState = {
          data: cashbackFallbackData,
          loading: false,
          warning: "Дані кешбеку можуть бути тимчасово неактуальні",
        };
        rerenderRoute();
      });
    return;
  }

  document.querySelectorAll("[data-cashback-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.cashbackFilter || "all";
      rerenderRoute();
    });
  });

  document.querySelector("#cashbackAutoToggle")?.addEventListener("click", async () => {
    const nextValue = !cashbackState.data.summary.autoActivationEnabled;
    cashbackState = {
      ...cashbackState,
      data: {
        ...cashbackState.data,
        summary: {
          ...cashbackState.data.summary,
          autoActivationEnabled: nextValue,
        },
      },
    };
    rerenderRoute();
    await updateCashbackAutoActivation(nextValue);
  });

  document.querySelector("#cashbackWithdrawButton")?.addEventListener("click", async () => {
    const summary = cashbackState.data.summary;
    if (numericAmount(summary.availableBalance) <= 0) {
      console.log("Cashback withdraw unavailable: empty balance");
      return;
    }

    if (!hasPayoutMethod(summary)) {
      navigate(payoutSetupPath);
      return;
    }

    const result = await startCashbackWithdraw();
    if (result.redirectPath) {
      navigate(result.redirectPath);
      return;
    }

    console.log("Cashback withdraw flow is not connected yet");
  });

  document.querySelector("#cashbackChangePayout")?.addEventListener("click", () => {
    navigate(payoutSetupPath);
  });
}
