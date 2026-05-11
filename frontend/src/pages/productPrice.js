import {
  priceChart as fallbackPriceChart,
  pricePeriods,
  priceSeries as fallbackPriceSeries,
  productPriceInsight as fallbackProductPriceInsight,
  selectedProduct as fallbackSelectedProduct,
  storePrices as fallbackStorePrices,
} from "../data/productPrice.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";

let priceData = {
  priceChart: fallbackPriceChart,
  priceSeries: fallbackPriceSeries,
  productPriceInsight: fallbackProductPriceInsight,
  selectedProduct: fallbackSelectedProduct,
  storePrices: fallbackStorePrices,
};
let loadedProductKey = null;
let selectedPricePeriod = "1m";

function applyPriceData(data) {
  priceData = {
    priceChart: data.priceChart?.xLabels ? data.priceChart : fallbackPriceChart,
    priceSeries: Array.isArray(data.priceSeries) ? data.priceSeries : fallbackPriceSeries,
    productPriceInsight: data.productPriceInsight ?? fallbackProductPriceInsight,
    selectedProduct: data.selectedProduct ?? fallbackSelectedProduct,
    storePrices: Array.isArray(data.storePrices) ? data.storePrices : fallbackStorePrices,
  };
}

function loadProductPrice(productName, period) {
  const key = `${productName}:${period}`;
  if (loadedProductKey === key) {
    return;
  }

  loadedProductKey = key;
  fetchJson(
    `/api/products/${encodeURIComponent(productName)}/prices?period=${encodeURIComponent(period)}`,
  )
    .then((data) => {
      applyPriceData(data);
      rerenderRoute();
    })
    .catch((error) => {
      console.warn(error.message);
    });
}

function renderProductThumb() {
  return `<span class="product-price-thumb product-price-thumb--${priceData.selectedProduct.thumb}" aria-hidden="true"><span></span></span>`;
}

function renderStoreLogo(store) {
  return `<span class="price-store-logo price-store-logo--${store.logo}">${store.logoText}</span>`;
}

function renderSelectedProduct() {
  return `
    <section class="selected-product-card" aria-label="Обраний продукт">
      ${renderProductThumb()}
      <span class="selected-product-copy">
        <strong>${priceData.selectedProduct.name}</strong>
        <small>${priceData.selectedProduct.description}</small>
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
  return `
    <section class="product-price-chart-card" aria-labelledby="price-chart-title">
      <div class="product-price-chart-heading">
        <h2 id="price-chart-title">${priceData.priceChart.title}</h2>
        ${icon("info")}
      </div>

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
    </section>
  `;
}

function renderStorePriceRow(store) {
  return `
    <button class="store-price-row interactive" type="button" data-store-name="${store.name}">
      ${renderStoreLogo(store)}
      <span class="store-price-name">${store.name}</span>
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
      ${priceData.storePrices.map(renderStorePriceRow).join("")}
    </section>
  `;
}

function renderPriceInsight() {
  return `
    <button class="product-price-insight interactive" type="button" id="productPriceInsight">
      <span class="product-price-insight-icon">${icon("trendUp")}</span>
      <span>
        <strong>${priceData.productPriceInsight.title}</strong>
        <small>${priceData.productPriceInsight.text}</small>
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
      ${renderChart()}
      ${renderStorePriceList()}
      ${renderPriceInsight()}
    </section>
  `;
}

export function bindProductPricePage() {
  const requestedProduct =
    new URLSearchParams(window.location.search).get("product") ?? fallbackSelectedProduct.name;

  loadProductPrice(requestedProduct, selectedPricePeriod);

  document.querySelectorAll(".product-price-period").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".product-price-period").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      console.log("Product price period:", chip.dataset.periodKey);
      selectedPricePeriod = chip.dataset.periodKey;
      loadProductPrice(requestedProduct, selectedPricePeriod);
    });
  });

  document.querySelectorAll(".store-price-row").forEach((row) => {
    row.addEventListener("click", () => {
      console.log("Open store price:", row.dataset.storeName);
    });
  });

  document.querySelector("#productPriceInsight")?.addEventListener("click", () => {
    console.log("Open product price insight");
  });
}
