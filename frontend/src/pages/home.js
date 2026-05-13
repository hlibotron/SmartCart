import {
  activities as fallbackActivities,
  insights as fallbackInsights,
  metrics as fallbackMetrics,
  shortcuts,
} from "../data/home.js";
import { assetUrl, fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

let homeData = {
  activities: fallbackActivities,
  insights: fallbackInsights,
  metrics: fallbackMetrics,
};
let apiRequested = false;

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

function setScanStatus(message, state = "") {
  const status = document.querySelector("#scanStatus");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.state = state;
}

function setScanPending(isPending) {
  const scanButton = document.querySelector("#scanButton");
  if (!scanButton) {
    return;
  }

  scanButton.disabled = isPending;
  scanButton.classList.toggle("is-loading", isPending);
}

async function uploadReceiptPhoto(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/receipt-scans/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null);
    throw new Error(details?.detail || `Помилка сканування: ${response.status}`);
  }

  const result = await response.json();
  const receiptId = result.receipt_id;
  if (!receiptId) {
    throw new Error("Сервер не повернув ID чеку");
  }

  window.history.pushState(
    {},
    "",
    appHref(`/receipt-summary?receipt=${encodeURIComponent(receiptId)}`),
  );
  window.dispatchEvent(new Event("popstate"));
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

function markerImage(url) {
  return `<img src="${assetUrl(url)}" alt="" loading="lazy" onerror="this.hidden = true;" />`;
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
      <span class="shortcut-copy">
        <strong>${shortcut.title}</strong>
        <span>${shortcut.description}</span>
      </span>
      ${icon("chevron", "chevron")}
    </a>
  `;
}

function renderActivity(activity) {
  const logoUrl = assetUrl(activity.logoUrl || "");
  const marker = logoUrl
    ? `<div class="store-logo store-logo--image">${markerImage(logoUrl)}</div>`
    : activity.logoText || activity.logo
      ? `<div class="store-logo">${activity.logoText ?? activity.logo}</div>`
      : `<span class="activity-icon">${icon(activity.icon || "info")}</span>`;

  return `
    <article class="activity-item${activity.path ? " interactive" : ""}" ${activity.path ? `data-path="${activity.path}"` : ""}>
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

function renderInsight(insight) {
  const logoUrl = assetUrl(insight.logoUrl || "");
  const marker = logoUrl
    ? `<span class="round-icon insight-logo">${markerImage(logoUrl)}</span>`
    : `<span class="round-icon">${icon(insight.icon || "info")}</span>`;

  return `
    <article class="insight-card${insight.path ? " interactive" : ""}" ${insight.path ? `data-path="${insight.path}"` : ""}>
      ${marker}
      <div>
        <h3>${insight.title}</h3>
        <strong>${insight.value}</strong>
        <span>${insight.subtitle}</span>
      </div>
      ${icon("chevron", "chevron")}
    </article>
  `;
}

export function renderHomePage() {
  return `
    <h1>Головна</h1>

    <section class="hero-card" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p>Скануйте чеки, порівнюйте ціни та отримуйте кешбек за покупки</p>
        <button class="scan-button interactive" type="button" id="scanButton">
          ${icon("camera")}
          Сканувати чек
        </button>
        <input
          class="receipt-camera-input"
          id="receiptCameraInput"
          type="file"
          accept="image/*"
          capture="environment"
        />
        <span class="scan-status" id="scanStatus" role="status" aria-live="polite"></span>
      </div>
      ${renderHeroArt()}
    </section>

    <section class="metrics-grid" aria-label="Показники">
      ${homeData.metrics.map(renderMetric).join("")}
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
        ${homeData.insights.map(renderInsight).join("")}
      </div>
    </section>

    <section class="section-block" aria-labelledby="activity-title">
      <h2 id="activity-title">Остання активність</h2>
      <div class="activity-card">
        ${homeData.activities.map(renderActivity).join("")}
      </div>
    </section>
  `;
}

export function bindHomePage() {
  const cameraInput = document.querySelector("#receiptCameraInput");

  if (!apiRequested) {
    apiRequested = true;
    fetchJson("/api/home")
      .then((data) => {
        homeData = {
          activities: Array.isArray(data.activities) ? data.activities : fallbackActivities,
          insights: Array.isArray(data.insights) ? data.insights : fallbackInsights,
          metrics: Array.isArray(data.metrics) ? data.metrics : fallbackMetrics,
        };
        rerenderRoute();
      })
      .catch((error) => {
        console.warn(error.message);
      });
  }

  document.querySelector("#scanButton")?.addEventListener("click", () => {
    cameraInput?.click();
  });

  cameraInput?.addEventListener("change", async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    setScanPending(true);
    setScanStatus("Розпізнаємо чек...", "loading");

    try {
      await uploadReceiptPhoto(file);
    } catch (error) {
      console.warn(error.message);
      setScanStatus(error.message || "Не вдалося розпізнати чек", "error");
    } finally {
      setScanPending(false);
      event.target.value = "";
    }
  });

  document.querySelectorAll("[data-section]").forEach((card) => {
    card.addEventListener("click", () => {
      console.log(`Open section: ${card.dataset.section}`);
    });
  });

  document.querySelectorAll("[data-path]").forEach((item) => {
    item.addEventListener("click", () => {
      window.history.pushState({}, "", appHref(item.dataset.path));
      window.dispatchEvent(new Event("popstate"));
    });
  });
}
