import {
  priceChart as fallbackPriceChart,
  pricePeriods,
  priceSeries as fallbackPriceSeries,
  productPriceInsight as fallbackProductPriceInsight,
  selectedProduct as fallbackSelectedProduct,
  storePrices as fallbackStorePrices,
} from "../data/productPrice.js";
import { assetUrl, fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { formatProductText } from "../shared/text.js";

let priceData = {
  priceChart: fallbackPriceChart,
  priceSeries: fallbackPriceSeries,
  productPriceInsight: fallbackProductPriceInsight,
  selectedProduct: fallbackSelectedProduct,
  storePrices: fallbackStorePrices,
};
let loadedProductKey = null;
let loadedComparisonData = null;
let loadedComparisonProductKey = null;
let activeProductKey = null;
let latestLoadRequestId = 0;
let selectedPricePeriod = "1m";
let selectedPriceSource = "receipt";
const lastProductPriceQueryKey = "smartcart:lastProductPriceQuery";
const seriesColors = ["#f97316", "#0f4c92", "#16a34a", "#ef1212", "#a678e8", "#6aa5f8"];
const priceSourceFilters = [
  {
    key: "receipt",
    label: "Чеки користувачів",
    description: "ціни зі спільних чеків",
  },
  {
    key: "official",
    label: "Офіційні сайти",
    description: "ціни з сайтів магазинів",
  },
];

function applyPriceData(data) {
  priceData = {
    priceChart: data.priceChart?.yTicks ? data.priceChart : fallbackPriceChart,
    priceSeries: Array.isArray(data.priceSeries) ? data.priceSeries : fallbackPriceSeries,
    productPriceInsight: data.productPriceInsight ?? fallbackProductPriceInsight,
    selectedProduct: data.selectedProduct ?? fallbackSelectedProduct,
    storePrices: Array.isArray(data.storePrices) ? data.storePrices : fallbackStorePrices,
  };
}

function fallbackPriceDataForProduct(productKey, { byId = false } = {}) {
  return {
    priceChart: emptyPriceChart(),
    priceSeries: [],
    productPriceInsight: {
      title: "Завантаження цін",
      text: "Дані для товару оновлюються.",
    },
    selectedProduct: {
      ...fallbackSelectedProduct,
      name: byId ? "Завантаження товару" : productKey || fallbackSelectedProduct.name,
      description: "Дані оновлюються",
      price: "—",
      badge: "Завантаження",
    },
    storePrices: [],
  };
}

function productStateKey(productKey, { byId = false } = {}) {
  return `${byId ? "id" : "name"}:${String(productKey || "")}`;
}

function productRequestKey(productKey, period, { byId = false } = {}) {
  return `${productStateKey(productKey, { byId })}:${period}`;
}

function resetProductStateIfNeeded(productKey, { byId = false } = {}) {
  const nextProductKey = productStateKey(productKey, { byId });
  if (activeProductKey === nextProductKey) {
    return false;
  }

  activeProductKey = nextProductKey;
  loadedProductKey = null;
  loadedComparisonData = null;
  loadedComparisonProductKey = null;
  latestLoadRequestId += 1;
  priceData = fallbackPriceDataForProduct(productKey, { byId });
  return true;
}

function timestampFromObservedAt(value) {
  const [datePart = "", timePart = ""] = String(value || "").split("·").map((part) => part.trim());
  const [day, month, year] = datePart.split(".").map(Number);
  const [hours = 0, minutes = 0] = timePart.split(":").map(Number);

  if (!day || !month || !year) {
    return 0;
  }

  return new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
}

function chartTicksForPrices(prices) {
  if (!prices.length) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const chartMin = Math.max(0, Math.floor(minPrice) - 2);
  const chartMax = Math.ceil(maxPrice) + 2;
  const step = Math.max(1, (chartMax - chartMin) / 6);

  return Array.from({ length: 7 }, (_, index) => Number((chartMin + step * index).toFixed(2)));
}

function sourceLabelFor(sourceKey) {
  return sourceKey === "receipt" ? "чек" : "сайт";
}

function retailerKeyFromName(name) {
  const value = String(name || "").toLowerCase();

  if (value.includes("атб") || value.includes("atb")) {
    return "atb";
  }
  if (value.includes("сільпо") || value.includes("silpo")) {
    return "silpo";
  }
  if (value.includes("novus")) {
    return "novus";
  }
  if (value.includes("ашан") || value.includes("auchan")) {
    return "auchan";
  }
  if (value.includes("varus")) {
    return "varus";
  }
  if (value.includes("еко") || value.includes("eko")) {
    return "eko_market";
  }

  return "all";
}

function normalizePriceObservation(price, sourceKey) {
  return {
    ...price,
    sourceKey,
    sourceLabel: sourceLabelFor(sourceKey),
    timestamp: timestampFromObservedAt(price.observedAt),
  };
}

function emptyPriceChart() {
  return {
    title: "Динаміка ціни за 1 шт, ₴",
    yTicks: [0, 1, 2, 3, 4, 5, 6],
    xLabels: [],
  };
}

function buildPriceDataFromComparison(data, sourceKey = selectedPriceSource) {
  const product = data.product ?? {};
  const officialObservations = (Array.isArray(data.priceHistory) ? data.priceHistory : [])
    .filter((price) => Number.isFinite(Number(price.priceValue)))
    .map((price) => normalizePriceObservation(price, "official"))
    .sort((left, right) => left.timestamp - right.timestamp);
  const receiptObservations = (Array.isArray(data.receiptObservedPrices)
    ? data.receiptObservedPrices
    : []
  )
    .filter((price) => Number.isFinite(Number(price.priceValue)))
    .map((price) => normalizePriceObservation(price, "receipt"))
    .sort((left, right) => left.timestamp - right.timestamp);
  const latestOfficial = (Array.isArray(data.officialPrices) ? data.officialPrices : [])
    .filter((price) => Number.isFinite(Number(price.priceValue)))
    .map((price) => normalizePriceObservation(price, "official"));
  const selectedObservations =
    sourceKey === "receipt"
      ? receiptObservations
      : officialObservations.length
        ? officialObservations
        : latestOfficial;
  const productHeaderPrice =
    [...receiptObservations, ...officialObservations, ...latestOfficial]
      .filter((price) => Number.isFinite(Number(price.priceValue)))
      .sort((left, right) => right.timestamp - left.timestamp)[0] ??
    data.bestOfficialOffer ??
    null;
  const prices = selectedObservations.map((price) => Number(price.priceValue));
  const grouped = selectedObservations.reduce((accumulator, price) => {
    const store = price.store || "Магазин";
    accumulator.set(store, [...(accumulator.get(store) || []), price]);
    return accumulator;
  }, new Map());
  const priceSeries = Array.from(grouped.entries()).map(([store, entries], index) => ({
    store,
    color: seriesColors[index % seriesColors.length],
    values: entries.map((entry) => Number(entry.priceValue)),
  }));
  const storePrices = Array.from(grouped.entries()).map(([store, entries]) => {
    const sortedEntries = entries.slice().sort((left, right) => left.timestamp - right.timestamp);
    const latest = sortedEntries.at(-1);
    const previous = sortedEntries.at(-2) ?? latest;
    const change = Number(latest.priceValue) - Number(previous.priceValue);

    return {
      name: store,
      logo: latest.logo,
      logoText: latest.logoText || store.slice(0, 8),
      logoUrl: latest.logoUrl,
      price: latest.price,
      priceValue: Number(latest.priceValue),
      change: `${change > 0 ? "+" : ""}${change.toFixed(2)}`,
      changeDirection: change <= 0 ? "down" : "up",
      sourceLabel: latest.sourceLabel,
      sourceKey: latest.sourceKey,
    };
  }).sort((left, right) => left.priceValue - right.priceValue);
  const labels = selectedObservations
    .map((price) => String(price.observedAt || "").split("·")[0]?.trim())
    .filter(Boolean);
  const xLabels = [...new Set(labels)].slice(-5);
  const bestStore = storePrices
    .slice()
    .sort((left, right) => left.priceValue - right.priceValue)[0];

  return {
    priceChart: prices.length
      ? {
          title:
            sourceKey === "receipt"
              ? "Динаміка за чеками користувачів, ₴"
              : "Динаміка з офіційних сайтів, ₴",
          yTicks: chartTicksForPrices(prices),
          xLabels,
        }
      : emptyPriceChart(),
    priceSeries,
    productPriceInsight: {
      title: bestStore ? `Найнижча остання ціна — ${bestStore.name}` : "Недостатньо даних",
      text:
        selectedObservations.length > 0
          ? sourceKey === "receipt"
            ? "Показано ціни зі спільних чеків користувачів за обраний період."
            : data.notice || "Показано тільки ціни з офіційних сайтів магазинів."
          : `Для режиму “${sourceKey === "receipt" ? "Чеки користувачів" : "Офіційні сайти"}” ще немає цін за обраний період.`,
    },
    selectedProduct: {
      id: product.id ?? null,
      name: product.name || fallbackSelectedProduct.name,
      description: product.brand || product.category?.name || "Товар з бази",
      price: productHeaderPrice?.price || "₴0",
      badge: productHeaderPrice ? "Остання доступна ціна" : "Цін ще немає",
      thumb: product.visual?.thumb || product.thumbnail || product.category?.icon || fallbackSelectedProduct.thumb,
      visual: product.visual ?? {
        thumb: product.thumbnail || product.category?.icon || fallbackSelectedProduct.thumb,
      },
    },
    storePrices,
  };
}

function loadProductPrice(productKey, period, { byId = false } = {}) {
  const key = productRequestKey(productKey, period, { byId });
  const requestProductKey = productStateKey(productKey, { byId });
  if (loadedProductKey === key) {
    return;
  }

  loadedProductKey = key;
  const requestId = latestLoadRequestId + 1;
  latestLoadRequestId = requestId;
  const path = byId
    ? `/api/products/${encodeURIComponent(productKey)}/price-comparison?period=${encodeURIComponent(period)}`
    : `/api/products/${encodeURIComponent(productKey)}/prices?period=${encodeURIComponent(period)}`;

  fetchJson(path)
    .then((data) => {
      if (requestId !== latestLoadRequestId || activeProductKey !== requestProductKey) {
        return;
      }

      if (byId) {
        loadedComparisonData = data;
        loadedComparisonProductKey = requestProductKey;
      }
      applyPriceData(byId ? buildPriceDataFromComparison(data, selectedPriceSource) : data);
      rerenderRoute();
    })
    .catch((error) => {
      if (requestId === latestLoadRequestId && loadedProductKey === key) {
        loadedProductKey = null;
      }
      console.warn(error.message);
    });
}

function thumbClassName(value) {
  const normalized = String(value || "info").replace(/[^a-z0-9_-]/gi, "");
  return normalized || "info";
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function renderProductThumb() {
  const visual = priceData.selectedProduct.visual ?? {};
  const thumb = thumbClassName(visual.thumb ?? priceData.selectedProduct.thumb);
  const imageUrl = assetUrl(visual.url || "");
  const fallbackMarkup = imageUrl || priceData.selectedProduct.visual ? "" : "<span></span>";

  return `
    <span class="product-price-thumb product-price-thumb--${thumb}" aria-hidden="true">
      ${
        imageUrl
          ? `<img src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" onerror="this.hidden = true;" />`
          : ""
      }
      ${fallbackMarkup}
    </span>
  `;
}

function renderStoreLogo(store) {
  const logoUrl = assetUrl(store.logoUrl || "");
  return logoUrl
    ? `<span class="price-store-logo price-store-logo--image"><img src="${logoUrl}" alt="" loading="lazy" onerror="this.hidden = true;" /></span>`
    : `<span class="price-store-logo price-store-logo--${store.logo}">${store.logoText}</span>`;
}

function renderSelectedProduct() {
  return `
    <section class="selected-product-card" aria-label="Обраний продукт">
      ${renderProductThumb()}
      <span class="selected-product-copy">
        <strong>${formatProductText(priceData.selectedProduct.name)}</strong>
        <small>${formatProductText(priceData.selectedProduct.description)}</small>
      </span>
      <span class="selected-product-price">
        <strong>${priceData.selectedProduct.price}</strong>
        <small>${priceData.selectedProduct.badge}</small>
      </span>
    </section>
  `;
}

function renderPeriodControl() {
  return `
    <div class="product-price-periods" aria-label="Період ціни">
      ${pricePeriods
        .map(
          (period) => `
            <button
              class="product-price-period interactive${period.key === selectedPricePeriod ? " active" : ""}"
              type="button"
              data-period-key="${period.key}"
            >
              ${period.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderPriceSourceFilters() {
  return `
    <div class="product-price-source-filters" aria-label="Джерело цін">
      ${priceSourceFilters
        .map(
          (source) => `
            <button
              class="product-price-source-filter interactive${source.key === selectedPriceSource ? " active" : ""}"
              type="button"
              data-price-source="${source.key}"
            >
              <strong>${source.label}</strong>
              <small>${source.description}</small>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function scalePoint(value, index, values) {
  const width = 300;
  const height = 176;
  const min = Math.min(...priceData.priceChart.yTicks);
  const max = Math.max(...priceData.priceChart.yTicks);
  const x = values.length > 1 ? (index / (values.length - 1)) * width : width / 2;
  const y = height - ((value - min) / Math.max(max - min, 1)) * height;

  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function buildPolyline(values) {
  return values.map((value, index) => scalePoint(value, index, values).join(",")).join(" ");
}

function renderChart() {
  const hasSeries = priceData.priceSeries.some((series) => series.values.length > 0);

  return `
    <section class="product-price-chart-card" aria-labelledby="price-chart-title">
      <div class="product-price-chart-heading">
        <h2 id="price-chart-title">${priceData.priceChart.title}</h2>
        ${icon("info")}
      </div>

      ${
        hasSeries
          ? `
        <div class="price-chart">
          <div class="price-chart-y-axis">
            ${priceData.priceChart.yTicks
              .slice()
              .reverse()
              .map((tick) => `<span>${tick}</span>`)
              .join("")}
          </div>
          <svg class="price-chart-svg" viewBox="0 0 340 220" aria-hidden="true">
            <g class="price-chart-grid" transform="translate(28 18)">
              ${priceData.priceChart.yTicks
                .map((_, index) => `<line x1="0" x2="300" y1="${index * 29.3}" y2="${index * 29.3}" />`)
                .join("")}
            </g>
            <g transform="translate(28 18)">
              ${priceData.priceSeries
                .map(
                  (series) => `
                    <polyline points="${buildPolyline(series.values)}" style="stroke: ${series.color};" />
                    ${series.values
                      .map((value, index) => {
                        const [x, y] = scalePoint(value, index, series.values);
                        return `<circle cx="${x}" cy="${y}" r="3.2" style="fill: ${series.color}; stroke: ${series.color};" />`;
                      })
                      .join("")}
                  `,
                )
                .join("")}
            </g>
          </svg>
          <div class="price-chart-x-axis">
            ${priceData.priceChart.xLabels.map((label) => `<span>${label}</span>`).join("")}
          </div>
        </div>

        <div class="price-chart-legend">
          ${priceData.priceSeries
            .map(
              (series) => `
                <span>
                  <i style="background: ${series.color};"></i>
                  ${series.store}
                </span>
              `,
            )
            .join("")}
        </div>
      `
          : `<p class="price-chart-empty">Для вибраного джерела ще немає цін за цей період.</p>`
      }
    </section>
  `;
}

function renderStorePriceRow(store) {
  return `
    <button class="store-price-row interactive" type="button" data-store-name="${escapeAttribute(store.name)}">
      ${renderStoreLogo(store)}
      <span class="store-price-name">
        <strong>${store.name}</strong>
        <small class="store-price-source store-price-source--${store.sourceKey || "neutral"}">
          ${store.sourceLabel || "ціна"}
        </small>
      </span>
      <strong>${store.price}</strong>
      <span class="store-price-change store-price-change--${store.changeDirection}">
        ${store.changeDirection === "up" ? "▲" : "▼"} ${store.change}
      </span>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

function renderStorePriceList() {
  return `
    <section class="store-price-list" aria-label="Ціни по магазинах">
      ${
        priceData.storePrices.length
          ? priceData.storePrices.map(renderStorePriceRow).join("")
          : `<p class="store-price-empty">Немає цін для вибраного джерела.</p>`
      }
    </section>
  `;
}

function renderPriceInsight() {
  return `
    <button class="product-price-insight interactive" type="button" id="productPriceInsight">
      <span class="product-price-insight-icon">${icon("trendUp")}</span>
      <span>
        <strong>${formatProductText(priceData.productPriceInsight.title)}</strong>
        <small>${formatProductText(priceData.productPriceInsight.text)}</small>
      </span>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

export function renderProductPricePage() {
  return `
    <section class="product-price-page" aria-labelledby="product-price-title">
      <h1 id="product-price-title">Ціни на продукт</h1>
      ${renderSelectedProduct()}
      ${renderPeriodControl()}
      ${renderPriceSourceFilters()}
      ${renderChart()}
      ${renderStorePriceList()}
      ${renderPriceInsight()}
    </section>
  `;
}

export function bindProductPricePage() {
  const params = new URLSearchParams(window.location.search);
  const requestedProductId = params.get("productId");
  const requestedProductParam = params.get("product");

  if (!requestedProductId && !requestedProductParam) {
    const savedQuery = window.sessionStorage?.getItem(lastProductPriceQueryKey);
    if (savedQuery) {
      window.history.replaceState({}, "", appHref(`/product-price${savedQuery}`));
      rerenderRoute();
      return;
    }
  }

  if (requestedProductId || requestedProductParam) {
    window.sessionStorage?.setItem(lastProductPriceQueryKey, window.location.search);
  }

  const requestedProduct = requestedProductParam ?? fallbackSelectedProduct.name;
  const productKey = requestedProductId ?? requestedProduct;
  const isProductIdRequest = Boolean(requestedProductId);

  if (resetProductStateIfNeeded(productKey, { byId: isProductIdRequest })) {
    rerenderRoute();
    return;
  }

  loadProductPrice(productKey, selectedPricePeriod, {
    byId: isProductIdRequest,
  });

  document.querySelectorAll(".product-price-period").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".product-price-period").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      console.log("Product price period:", chip.dataset.periodKey);
      selectedPricePeriod = chip.dataset.periodKey;
      loadProductPrice(productKey, selectedPricePeriod, {
        byId: isProductIdRequest,
      });
    });
  });

  document.querySelectorAll(".product-price-source-filter").forEach((filter) => {
    filter.addEventListener("click", () => {
      selectedPriceSource = filter.dataset.priceSource || "receipt";

      if (loadedComparisonData && loadedComparisonProductKey === activeProductKey) {
        applyPriceData(buildPriceDataFromComparison(loadedComparisonData, selectedPriceSource));
        rerenderRoute();
      }
    });
  });

  document.querySelectorAll(".store-price-row").forEach((row) => {
    row.addEventListener("click", () => {
      const mapProductId = requestedProductId || priceData.selectedProduct.id;
      if (!mapProductId) {
        console.warn("Cannot open stores map without product id:", row.dataset.storeName);
        return;
      }

      const params = new URLSearchParams({
        productId: mapProductId,
        retailer: retailerKeyFromName(row.dataset.storeName || ""),
      });
      window.history.pushState({}, "", appHref(`/stores-map?${params.toString()}`));
      rerenderRoute();
    });
  });

  document.querySelector("#productPriceInsight")?.addEventListener("click", () => {
    console.log("Open product price insight");
  });
}
