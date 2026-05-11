import {
  dailyRecommendation as fallbackDailyRecommendation,
  frequentProducts as fallbackFrequentProducts,
  productFilters,
  products as fallbackProducts,
  productStats as fallbackProductStats,
} from "../data/products.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

let pageData = {
  dailyRecommendation: fallbackDailyRecommendation,
  frequentProducts: fallbackFrequentProducts,
  products: fallbackProducts,
  productStats: fallbackProductStats,
};
let apiRequested = false;

function renderProductThumb(type, className = "product-thumb") {
  return `<span class="${className} product-thumb--${type}" aria-hidden="true"><span></span></span>`;
}

export function renderProductSearch() {
  return `
    <label class="products-search" aria-label="Пошук продукту">
      ${icon("search")}
      <input id="productSearch" type="search" placeholder="Пошук продукту" autocomplete="off" />
    </label>
  `;
}

export function renderFrequentProducts() {
  return `
    <section class="products-section" aria-labelledby="frequent-products-title">
      <h2 id="frequent-products-title">Часто купуєте</h2>
      <div class="frequent-products">
        ${pageData.frequentProducts
          .map(
            (product) => `
              <button
                class="frequent-product-card interactive${product.active ? " active" : ""}"
                type="button"
                data-product-name="${product.name}"
              >
                ${renderProductThumb(product.thumb, "frequent-product-thumb")}
                <span>${product.name}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderProductStats() {
  return `
    <section class="product-stats" aria-label="Показники продуктів">
      ${pageData.productStats
        .map(
          (stat) => `
            <article class="product-stat-card">
              <span class="round-icon">${icon(stat.icon)}</span>
              <span>
                <small>${stat.label}</small>
                <strong>${stat.value}</strong>
              </span>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

export function renderProductFilters() {
  return `
    <div class="product-filters" aria-label="Фільтри продуктів">
      ${productFilters
        .map(
          (filter) => `
            <button
              class="product-filter-chip interactive${filter.active ? " active" : ""}"
              type="button"
              data-filter-key="${filter.key}"
            >
              ${filter.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

export function renderProductCard(product) {
  const badge = product.badge
    ? `<span class="product-badge product-badge--${product.badgeType}">${product.badge}</span>`
    : "";

  return `
    <button class="product-card interactive" type="button" data-product-name="${product.name}">
      ${renderProductThumb(product.thumb)}
      <span class="product-info">
        <strong>${product.name}</strong>
        <span>${product.description}</span>
        <small>${icon("calendar")}${product.frequency}</small>
      </span>
      <span class="product-price">
        <strong>${product.price}</strong>
        <span>${product.store}</span>
        <small>${icon("arrowDown")}${product.trend}</small>
      </span>
      <span class="product-action">
        ${badge}
        ${icon("chevron", "chevron")}
      </span>
    </button>
  `;
}

export function renderDailyRecommendation() {
  return `
    <button class="daily-recommendation interactive" type="button" id="dailyRecommendation">
      <span class="daily-recommendation-icon">
        <span></span>
      </span>
      <span>
        <strong>${pageData.dailyRecommendation.title}</strong>
        <small>${pageData.dailyRecommendation.text}</small>
      </span>
      <span class="daily-recommendation-arrow">${icon("arrowRight")}</span>
    </button>
  `;
}

export function renderProductsPage() {
  return `
    <section class="products-page" aria-labelledby="products-title">
      <h1 id="products-title">Продукти</h1>
      ${renderProductSearch()}
      ${renderFrequentProducts()}
      ${renderProductStats()}
      ${renderProductFilters()}
      <section class="products-list" aria-label="Список продуктів">
        ${pageData.products.map(renderProductCard).join("")}
      </section>
      ${renderDailyRecommendation()}
    </section>
  `;
}

export function bindProductsPage() {
  if (!apiRequested) {
    apiRequested = true;
    fetchJson("/api/products")
      .then((data) => {
        pageData = {
          dailyRecommendation: data.dailyRecommendation ?? fallbackDailyRecommendation,
          frequentProducts: Array.isArray(data.frequentProducts)
            ? data.frequentProducts
            : fallbackFrequentProducts,
          products: Array.isArray(data.products) ? data.products : fallbackProducts,
          productStats: Array.isArray(data.productStats)
            ? data.productStats
            : fallbackProductStats,
        };
        rerenderRoute();
      })
      .catch((error) => {
        console.warn(error.message);
      });
  }

  document.querySelector("#productSearch")?.addEventListener("input", (event) => {
    console.log("Search products:", event.target.value);
  });

  document.querySelectorAll(".frequent-product-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".frequent-product-card").forEach((item) => {
        item.classList.remove("active");
      });

      card.classList.add("active");
      console.log("Select frequent product:", card.dataset.productName);
    });
  });

  document.querySelectorAll(".product-filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".product-filter-chip").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      console.log("Products filter:", chip.dataset.filterKey);
    });
  });

  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      console.log("Open product:", card.dataset.productName);
      window.history.pushState(
        {},
        "",
        appHref(`/product-price?product=${encodeURIComponent(card.dataset.productName)}`),
      );
      window.dispatchEvent(new Event("popstate"));
    });
  });

  document.querySelector("#dailyRecommendation")?.addEventListener("click", () => {
    console.log("Open daily recommendation");
  });
}
