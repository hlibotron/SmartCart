import { cashbackFallbackData } from "../data/cashbackFallbackData.js";
import { apiUrl, fetchJson } from "../shared/api.js";
import { authHeaders } from "../shared/authSession.js";

function settledValue(result) {
  return result.status === "fulfilled" ? result.value : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function formatMoney(value, fallback = "₴0") {
  if (typeof value === "string") {
    return value.trim() || fallback;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return fallback;
  }

  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `₴${amount.toLocaleString("uk-UA", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function payoutLabel(method, fallback = "") {
  if (!method) {
    return fallback;
  }

  if (typeof method === "string") {
    return method;
  }

  const last4 = method.last4 || method.cardLast4;
  return firstDefined(method.label, last4 ? `•••• ${last4}` : "", fallback);
}

function normalizeStatus(status, type) {
  const value = String(status || "").toLowerCase();
  if (value.includes("pending") || value.includes("очіку")) {
    return "pending";
  }
  if (value.includes("withdraw") || value.includes("payout") || value.includes("вивед")) {
    return "withdrawn";
  }
  if (type === "withdraw") {
    return "withdrawn";
  }
  return "credited";
}

function statusLabel(status) {
  if (status === "pending") {
    return "Очікує";
  }
  if (status === "withdrawn") {
    return "Виконано";
  }
  return "Зараховано";
}

function normalizeHistoryItem(item, index = 0) {
  const type = item.type || (String(item.amount || "").startsWith("-") ? "withdraw" : "cashback");
  const status = normalizeStatus(item.status, type);

  return {
    id: String(item.id ?? `cashback-item-${index}`),
    title: firstDefined(item.title, item.productName, item.product_name, "Кешбек"),
    date: firstDefined(item.date, item.createdAt, item.created_at, ""),
    amount: formatMoney(firstDefined(item.amount, item.value), cashbackFallbackData.history[index]?.amount || "₴0"),
    status,
    statusLabel: firstDefined(item.statusLabel, item.status_label, statusLabel(status)),
    type,
    icon: firstDefined(item.icon, type === "withdraw" ? "creditCard" : "cashback"),
    image: firstDefined(item.image, item.product_image, item.productImage, ""),
  };
}

function normalizeSummary(summary = {}, legacyData = null) {
  const fallback = cashbackFallbackData.summary;
  const payoutMethod = firstDefined(
    summary.payout_method,
    summary.payoutMethod,
    summary.payoutMethodLabel,
    legacyData?.payout_method,
    legacyData?.payoutMethod,
  );

  return {
    availableBalance: formatMoney(
      firstDefined(summary.available_balance, summary.availableBalance, summary.available, legacyData?.available_balance),
      fallback.availableBalance,
    ),
    pendingBalance: formatMoney(
      firstDefined(summary.pending_balance, summary.pendingBalance, summary.pending, summary.expected),
      fallback.pendingBalance,
    ),
    autoActivationEnabled: Boolean(
      firstDefined(
        summary.auto_activation_enabled,
        summary.autoActivationEnabled,
        legacyData?.auto_activation_enabled,
        fallback.autoActivationEnabled,
      ),
    ),
    payoutMethodLabel: payoutLabel(payoutMethod, fallback.payoutMethodLabel),
  };
}

function normalizePageData({ summary, history, legacyData, isFallback = false }) {
  const historyItems = Array.isArray(history)
    ? history
    : Array.isArray(history?.items)
      ? history.items
      : Array.isArray(history?.history)
        ? history.history
        : null;
  const normalizedHistory = Array.isArray(historyItems)
    ? historyItems.map(normalizeHistoryItem)
    : Array.isArray(legacyData?.history)
      ? legacyData.history.map(normalizeHistoryItem)
      : cashbackFallbackData.history;

  return {
    data: {
      summary: normalizeSummary(summary?.summary ?? summary ?? legacyData?.summary, legacyData),
      filters: cashbackFallbackData.filters,
      history: normalizedHistory,
      info: legacyData?.info || cashbackFallbackData.info,
    },
    isFallback,
    warning: isFallback ? "Дані кешбеку можуть бути тимчасово неактуальні" : "",
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json().catch(() => ({}));
}

export async function getCashbackPageData() {
  // TODO: replace fallback once GET /api/cashback/summary and /api/cashback/history are implemented.
  const [summaryResult, historyResult] = await Promise.allSettled([
    fetchJson("/api/cashback/summary"),
    fetchJson("/api/cashback/history"),
  ]);
  const summary = settledValue(summaryResult);
  const history = settledValue(historyResult);

  if (summary || history) {
    return normalizePageData({ summary, history, isFallback: !summary || !history });
  }

  const legacyResult = await Promise.allSettled([fetchJson("/api/cashback")]);
  const legacyData = settledValue(legacyResult[0]);
  if (legacyData) {
    return normalizePageData({ legacyData, isFallback: true });
  }

  return normalizePageData({
    summary: cashbackFallbackData.summary,
    history: cashbackFallbackData.history,
    legacyData: cashbackFallbackData,
    isFallback: true,
  });
}

export async function updateCashbackAutoActivation(enabled) {
  // TODO: expects PATCH /api/cashback/settings { auto_activation_enabled: boolean }.
  return requestJson("/api/cashback/settings", {
    method: "PATCH",
    body: JSON.stringify({ auto_activation_enabled: enabled }),
  }).catch(() => ({ autoActivationEnabled: enabled, isFallback: true }));
}

export async function startCashbackWithdraw() {
  // TODO: expects POST /api/cashback/withdraw and optionally { redirectPath }.
  return requestJson("/api/cashback/withdraw", {
    method: "POST",
    body: JSON.stringify({}),
  }).catch(() => ({ handled: false, isFallback: true }));
}
