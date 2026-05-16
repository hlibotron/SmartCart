import { icon } from "../shared/icons.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";

let cashbackData = {
  summary: {
    title: "Активні кампанії",
    description: "₴46 очікує на зарахування з 2 чеків",
  },
  stats: [
    { label: "Очікує", value: "₴46", icon: "gift" },
    { label: "З магазинів", value: "₴28", icon: "store" },
    { label: "SmartCart", value: "₴18", icon: "cashback" },
  ],
  offers: [],
};
let apiRequested = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCashbackStat(stat) {
  return `
    <article class="page-card cashback-stat-card">
      <span class="round-icon">${icon(stat.icon || "gift")}</span>
      <h2>${escapeHtml(stat.value)}</h2>
      <p>${escapeHtml(stat.label)}</p>
    </article>
  `;
}

function renderOffer(offer) {
  return `
    <article class="page-card cashback-offer-card">
      <span class="round-icon">${icon(offer.icon || "gift")}</span>
      <h2>${escapeHtml(offer.title)}</h2>
      <p>${escapeHtml(offer.subtitle)} · ${escapeHtml(offer.value)}</p>
      <small>${escapeHtml(offer.endsAt)}</small>
    </article>
  `;
}

export function renderCashbackPage() {
  return `
    <section class="cashback-page" aria-labelledby="cashback-title">
      <h1 id="cashback-title">Кешбек</h1>
      <section class="page-card">
        <span class="round-icon">${icon("gift")}</span>
        <h2>${escapeHtml(cashbackData.summary.title)}</h2>
        <p>${escapeHtml(cashbackData.summary.description)}</p>
      </section>

      <section class="cashback-stats" aria-label="Показники кешбеку">
        ${cashbackData.stats.map(renderCashbackStat).join("")}
      </section>

      <section class="section-block" aria-labelledby="cashback-offers-title">
        <h2 id="cashback-offers-title">Пропозиції</h2>
        <div class="cashback-offers">
          ${
            cashbackData.offers.length
              ? cashbackData.offers.map(renderOffer).join("")
              : `
                <article class="page-card">
                  <span class="round-icon">${icon("info")}</span>
                  <h2>Немає активних пропозицій</h2>
                  <p>Кешбек з чеків зʼявиться тут після сканування покупок.</p>
                </article>
              `
          }
        </div>
      </section>
    </section>
  `;
}

export function bindCashbackPage() {
  if (apiRequested) {
    return;
  }

  apiRequested = true;
  fetchJson("/api/cashback")
    .then((data) => {
      cashbackData = {
        summary: data.summary ?? cashbackData.summary,
        stats: Array.isArray(data.stats) ? data.stats : cashbackData.stats,
        offers: Array.isArray(data.offers) ? data.offers : cashbackData.offers,
      };
      rerenderRoute();
    })
    .catch((error) => {
      console.warn(error.message);
    });
}
