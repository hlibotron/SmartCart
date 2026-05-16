import { profileFallbackData } from "../data/profileFallbackData.js";
import { fetchJson } from "../shared/api.js";
import packageJson from "../../package.json";

const appVersion = import.meta.env.VITE_APP_VERSION || packageJson.version || "1.2.0";

function settledValue(result) {
  return result.status === "fulfilled" ? result.value : null;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function findStatValue(stats, labels) {
  if (!Array.isArray(stats)) {
    return undefined;
  }

  const normalizedLabels = labels.map((label) => label.toLowerCase());
  return stats.find((stat) => normalizedLabels.includes(String(stat.label ?? "").toLowerCase()))
    ?.value;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function formatMoney(value, fallback) {
  const amount = toNumber(value);
  if (amount === undefined) {
    return fallback;
  }

  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `${amount.toLocaleString("uk-UA", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })} ₴`;
}

function parseReceiptDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const [day, month, year] = value.split(".");
    if (day && month && year) {
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function currentMonthReceiptCount(receiptsData, profileData) {
  const receipts = Array.isArray(receiptsData?.receipts) ? receiptsData.receipts : [];
  if (receipts.length) {
    const now = new Date();
    return receipts.filter((receipt) => {
      const date = parseReceiptDate(receipt.date ?? receipt.receiptDate ?? receipt.createdAt);
      return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
  }

  return toNumber(findStatValue(profileData?.stats, ["Чеків", "Чеки", "Receipts"]));
}

function payoutLabel(cashbackData, settingsData) {
  const method = firstDefined(
    cashbackData?.payout_method,
    cashbackData?.payoutMethod,
    cashbackData?.summary?.payoutMethod,
    settingsData?.payout_method,
    settingsData?.payoutMethod,
  );

  if (!method) {
    return undefined;
  }

  if (typeof method === "string") {
    return method;
  }

  const last4 = method.last4 || method.cardLast4;
  return last4 ? `Картка •••• ${last4}` : method.label;
}

function normalizeProfileData(results) {
  const profileData = settledValue(results.profile);
  const receiptsData = settledValue(results.receipts);
  const cashbackData = settledValue(results.cashback);
  const homeData = settledValue(results.home);
  const settingsData = settledValue(results.settings);
  const referralData = settledValue(results.referral);

  const cashbackValue = firstDefined(
    cashbackData?.available_balance,
    cashbackData?.availableBalance,
    cashbackData?.summary?.available,
    cashbackData?.summary?.expected,
    findStatValue(cashbackData?.stats, ["Очікує", "Доступно", "Кешбек"]),
    findStatValue(profileData?.stats, ["Кешбек"]),
  );
  const savingsValue = firstDefined(
    homeData?.monthly_savings,
    homeData?.monthlySavings,
    findStatValue(homeData?.metrics, ["Економія"]),
    profileData?.summary?.monthlySavings,
  );

  const location = firstDefined(
    profileData?.user?.city,
    profileData?.user?.location,
    settingsData?.location?.city,
    settingsData?.location,
    settingsData?.city,
  );

  return {
    user: {
      name: firstDefined(profileData?.user?.name, profileData?.user?.username, profileFallbackData.user.name),
      subtitle: firstDefined(profileData?.user?.subtitle, profileFallbackData.user.subtitle),
      avatarUrl: firstDefined(profileData?.user?.avatarUrl, profileData?.user?.avatar_url, null),
      level: firstDefined(profileData?.user?.level, profileFallbackData.user.level),
    },
    stats: {
      receiptsCount:
        currentMonthReceiptCount(receiptsData, profileData) ?? profileFallbackData.stats.receiptsCount,
      cashbackAvailable: formatMoney(cashbackValue, profileFallbackData.stats.cashbackAvailable),
      monthlySavings: formatMoney(savingsValue, profileFallbackData.stats.monthlySavings),
    },
    settings: {
      location: firstDefined(location, profileFallbackData.settings.location),
      payoutMethodLabel: firstDefined(payoutLabel(cashbackData, settingsData), profileFallbackData.settings.payoutMethodLabel),
      appVersion: firstDefined(settingsData?.appVersion, settingsData?.app_version, appVersion, profileFallbackData.settings.appVersion),
    },
    referral: {
      title: firstDefined(referralData?.title, referralData?.summary?.title, profileFallbackData.referral.title),
      description: firstDefined(
        referralData?.description,
        referralData?.summary?.description,
        profileFallbackData.referral.description,
      ),
      bonus: firstDefined(referralData?.bonus, referralData?.summary?.bonus, profileFallbackData.referral.bonus),
    },
  };
}

export async function getProfileOverview() {
  const [profile, receipts, cashback, home, settings, referral] = await Promise.allSettled([
    fetchJson("/api/profile"),
    fetchJson("/api/receipts"),
    fetchJson("/api/cashback"),
    fetchJson("/api/home"),
    fetchJson("/api/user/settings"),
    fetchJson("/api/referral/summary"),
  ]);

  const results = { profile, receipts, cashback, home, settings, referral };
  const fulfilledCount = Object.values(results).filter((result) => result.status === "fulfilled").length;

  if (!fulfilledCount) {
    return {
      data: profileFallbackData,
      warning: "Деякі дані тимчасово недоступні",
      isFallback: true,
    };
  }

  return {
    data: normalizeProfileData(results),
    warning:
      fulfilledCount < Object.values(results).length ? "Деякі дані тимчасово недоступні" : "",
    isFallback: false,
  };
}
