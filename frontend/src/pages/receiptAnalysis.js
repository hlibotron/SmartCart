import {
  clearReceiptScanSession,
  getReceiptScanState,
} from "../shared/receiptScanSession.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { rerenderRoute } from "../shared/api.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navigate(path) {
  window.history.pushState({}, "", appHref(path));
  window.dispatchEvent(new Event("popstate"));
}

function renderProcessing(state) {
  return `
    <section class="receipt-analysis-page" aria-labelledby="receipt-analysis-title">
      <div class="receipt-analysis-visual" aria-hidden="true">
        <span class="receipt-analysis-pulse">${icon("receiptCheck")}</span>
        <i></i>
        <i></i>
      </div>
      <p class="receipt-analysis-kicker">Сканування запущено</p>
      <h1 id="receipt-analysis-title">Аналізуємо чек</h1>
      <p class="receipt-analysis-copy">
        Розпізнаємо товари, суми, знижки та кешбек. Після завершення одразу відкриємо підсумок.
      </p>
      <div class="receipt-analysis-card" role="status" aria-live="polite">
        <span>${icon("refresh")}</span>
        <span>
          <strong>${escapeHtml(state.fileName || "Фото чеку")}</strong>
          <small>Йде аналіз чеку...</small>
        </span>
      </div>
      <div class="receipt-analysis-steps" aria-label="Етапи аналізу">
        <span class="active">Завантаження</span>
        <span class="active">OCR</span>
        <span>Підсумок</span>
      </div>
    </section>
  `;
}

function renderError(state) {
  return `
    <section class="receipt-analysis-page receipt-analysis-page--error" aria-labelledby="receipt-analysis-title">
      <div class="receipt-analysis-visual" aria-hidden="true">
        <span>${icon("info")}</span>
      </div>
      <p class="receipt-analysis-kicker">Не вдалося завершити</p>
      <h1 id="receipt-analysis-title">Чек не розпізнано</h1>
      <p class="receipt-analysis-copy">${escapeHtml(state.error || "Спробуйте зробити фото ще раз.")}</p>
      <button class="receipt-analysis-action interactive" type="button" id="receiptAnalysisBack">
        Повернутись
      </button>
    </section>
  `;
}

export function renderReceiptAnalysisPage() {
  const state = getReceiptScanState();
  if (state.status === "error") {
    return renderError(state);
  }

  return renderProcessing(state);
}

export function bindReceiptAnalysisPage() {
  const state = getReceiptScanState();
  if (state.status === "done" && state.receiptId) {
    const receiptId = state.receiptId;
    clearReceiptScanSession();
    navigate(`/receipt-summary?receipt=${encodeURIComponent(receiptId)}`);
    return;
  }

  if (state.status === "idle") {
    navigate("/");
    return;
  }

  const handleStateChange = () => rerenderRoute();
  window.addEventListener("receipt-scan-statechange", handleStateChange, { once: true });

  document.querySelector("#receiptAnalysisBack")?.addEventListener("click", () => {
    clearReceiptScanSession();
    navigate("/");
  });
}
