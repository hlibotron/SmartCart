import { activities, metrics, shortcuts } from "../data/home.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

function renderHeroArt() {
  return `
    <div class="hero-art" aria-hidden="true">
      <div class="art-blob"></div>
      <div class="bag"><span></span></div>
      <div class="phone">
        <div class="phone-notch"></div>
        <div class="receipt-art">
          <span class="receipt-currency">₴</span>
          <i></i><i></i><i></i><i></i><i></i>
        </div>
      </div>
      <div class="check-badge">${icon("check")}</div>
    </div>
  `;
}

function renderMetric(metric) {
  return `
    <article class="metric-card">
      <div class="metric-icon">${icon(metric.icon)}</div>
      <div>
        <p>${metric.label}</p>
        <strong>${metric.value}</strong>
        <span>${metric.delta}</span>
      </div>
    </article>
  `;
}

function renderShortcut(shortcut) {
  return `
    <a
      class="shortcut-card interactive"
      href="${appHref(shortcut.path)}"
      data-link
      data-section="${shortcut.title}"
    >
      <span class="round-icon">${icon(shortcut.icon)}</span>
      <strong>${shortcut.title}</strong>
      <span>${shortcut.description}</span>
      ${icon("chevron", "chevron")}
    </a>
  `;
}

function renderActivity(activity) {
  const marker = activity.logo
    ? `<div class="store-logo">${activity.logo}</div>`
    : `<span class="activity-icon">${icon(activity.icon)}</span>`;

  return `
    <article class="activity-item">
      ${marker}
      <div class="activity-copy">
        <h3>${activity.title}</h3>
        <p>${icon("calendar")}${activity.date}</p>
      </div>
      <strong class="${activity.positive ? "positive" : ""}">${activity.amount}</strong>
      ${icon("chevron", "chevron")}
    </article>
  `;
}

export function renderHomePage() {
  return `
    <h1>Головна</h1>

    <section class="hero-card" aria-labelledby="hero-title">
      <div class="hero-copy">
        <h2 id="hero-title">Контролюйте покупки, ціни та кешбек в одному місці</h2>
        <p>Скануйте чеки, порівнюйте ціни та отримуйте кешбек за покупки</p>
        <button class="scan-button interactive" type="button" id="scanButton">
          ${icon("camera")}
          Сканувати чек
        </button>
      </div>
      ${renderHeroArt()}
    </section>

    <section class="metrics-grid" aria-label="Показники">
      ${metrics.map(renderMetric).join("")}
    </section>

    <section class="section-block" aria-labelledby="quick-title">
      <h2 id="quick-title">Швидкий доступ</h2>
      <div class="shortcut-grid">
        ${shortcuts.map(renderShortcut).join("")}
      </div>
    </section>

    <section class="section-block" aria-labelledby="insights-title">
      <h2 id="insights-title">Останні інсайти</h2>
      <div class="insights-grid">
        <article class="insight-card">
          <div class="milk-box" aria-hidden="true"><span>MILK</span></div>
          <div>
            <h3>Краща ціна на молоко — АТБ</h3>
            <strong>₴24.90</strong>
            <span>економія ₴1.00</span>
          </div>
          ${icon("chevron", "chevron")}
        </article>

        <article class="insight-card">
          <span class="round-icon">${icon("milk")}</span>
          <div>
            <h3>Топ категорія місяця — Молочні</h3>
            <strong>27%</strong>
            <span>усіх витрат</span>
          </div>
          ${icon("chevron", "chevron")}
        </article>

        <article class="insight-card">
          <span class="coin-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="7" />
              <path d="M8.5 10.6h5.1a1.9 1.9 0 0 1 0 3.8H9.3M8.6 14.4h6.8M14.6 8.2v2.4M9.5 15.8v-2.4" />
            </svg>
          </span>
          <div>
            <h3>Очікує кешбек</h3>
            <strong>₴46</strong>
            <span>з 2 чеків</span>
          </div>
          ${icon("chevron", "chevron")}
        </article>
      </div>
    </section>

    <section class="section-block" aria-labelledby="activity-title">
      <h2 id="activity-title">Остання активність</h2>
      <div class="activity-card">
        ${activities.map(renderActivity).join("")}
      </div>
    </section>
  `;
}

export function bindHomePage() {
  document.querySelector("#scanButton")?.addEventListener("click", () => {
    console.log("Scan receipt clicked");
  });

  document.querySelectorAll("[data-section]").forEach((card) => {
    card.addEventListener("click", () => {
      console.log(`Open section: ${card.dataset.section}`);
    });
  });
}
