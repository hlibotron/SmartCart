import {
  dailyRecommendation as fallbackDailyRecommendation,
  frequentProducts as fallbackFrequentProducts,
  productFilters,
  products as fallbackProducts,
  productStats as fallbackProductStats,
} from "../data/products.js";
import { assetUrl, fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { formatProductText } from "../shared/text.js";

let pageData = {
  dailyRecommendation: fallbackDailyRecommendation,
  frequentProducts: fallbackFrequentProducts,
  products: fallbackProducts,
  productStats: fallbackProductStats,
};
let apiRequested = false;
let selectedProductFilter = "all";
let productSearchQuery = "";
let currentProductsPage = 1;
const productsPerPage = 14;

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

function renderProductThumb(productOrType, className = "product-thumb") {
  const visual = typeof productOrType === "object" ? productOrType.visual ?? {} : {};
  const fallbackThumb = typeof productOrType === "object" ? productOrType.thumb : productOrType;
  const thumb = thumbClassName(visual.thumb ?? fallbackThumb);
  const imageUrl = assetUrl(visual.url || "");
  const fallbackMarkup = imageUrl || (typeof productOrType === "object" && productOrType.visual)
    ? ""
    : "<span></span>";

  return `
    <span class="${className} product-thumb--${thumb}" aria-hidden="true">
      ${
        imageUrl
          ? `<img src="${escapeAttribute(imageUrl)}" alt="" loading="lazy" onerror="this.hidden = true;" />`
          : ""
      }
      ${fallbackMarkup}
    </span>
  `;
}

function visiblePageNumbers(currentPage, totalPages) {
  const maxVisiblePages = 5;
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisiblePages / 2);
  const start = Math.min(
    Math.max(1, currentPage - halfWindow),
    totalPages - maxVisiblePages + 1,
  );

  return Array.from({ length: maxVisiblePages }, (_, index) => start + index);
}

export function renderProductSearch() {
  return `
    <label class="products-search" aria-label="Пошук продукту">
      ${icon("search")}
      <input
        id="productSearch"
        type="search"
        placeholder="Пошук продукту"
        autocomplete="off"
        value="${escapeAttribute(productSearchQuery)}"
      />
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
                data-product-id="${product.productId ?? ""}"
                data-product-name="${escapeAttribute(product.name)}"
              >
                ${renderProductThumb(product, "frequent-product-thumb")}
                <span>${formatProductText(product.name)}</span>
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
              class="product-filter-chip interactive${filter.key === selectedProductFilter ? " active" : ""}"
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
  const productName = formatProductText(product.name);
  const productDescription = formatProductText(product.description);

  return `
    <button
      class="product-card interactive"
      type="button"
      data-product-id="${product.productId ?? ""}"
      data-product-name="${escapeAttribute(product.name)}"
      data-search-text="${escapeAttribute(product.searchText || product.name)}"
      data-badge-type="${escapeAttribute(product.badgeType || "")}"
      data-has-purchases="${product.hasPurchases ? "true" : "false"}"
    >
      ${renderProductThumb(product)}
      <span class="product-info">
        <strong>${productName}</strong>
        <span>${productDescription}</span>
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
        <strong>${formatProductText(pageData.dailyRecommendation.title)}</strong>
        <small>${formatProductText(pageData.dailyRecommendation.text)}</small>
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
        <p class="products-empty" id="productsEmpty" hidden>Нічого не знайдено</p>
      </section>
      <nav class="products-pagination" id="productsPagination" aria-label="Сторінки продуктів">
        <button class="products-load-more interactive" type="button" id="productsLoadMore">
          Завантажити ще
        </button>
        <div class="products-page-numbers" id="productsPageNumbers" aria-label="Номери сторінок"></div>
      </nav>
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

  const applyProductsFilter = () => {
    const normalizedQuery = productSearchQuery.trim().toLocaleLowerCase("uk-UA");
    const matchedCards = [];

    document.querySelectorAll(".product-card").forEach((card) => {
      const searchText = `${card.dataset.searchText || ""} ${card.dataset.productName || ""}`
        .toLocaleLowerCase("uk-UA");
      const matchesSearch = !normalizedQuery || searchText.includes(normalizedQuery);
      const matchesFilter =
        selectedProductFilter === "all" ||
        (selectedProductFilter === "frequent" && card.dataset.hasPurchases === "true") ||
        (selectedProductFilter === "cashback" && card.dataset.badgeType === "cashback") ||
        (selectedProductFilter === "discount" && card.dataset.badgeType === "discount");
      const isVisible = matchesSearch && matchesFilter;

      if (isVisible) {
        matchedCards.push(card);
      }
    });

    const totalPages = Math.max(1, Math.ceil(matchedCards.length / productsPerPage));
    currentProductsPage = Math.min(currentProductsPage, totalPages);
    const visibleLimit = currentProductsPage * productsPerPage;

    document.querySelectorAll(".product-card").forEach((card) => {
      card.hidden = true;
    });

    matchedCards.forEach((card, index) => {
      card.hidden = index >= visibleLimit;
    });

    const emptyState = document.querySelector("#productsEmpty");
    if (emptyState) {
      emptyState.hidden = matchedCards.length > 0;
    }

    const pagination = document.querySelector("#productsPagination");
    if (pagination) {
      pagination.hidden = matchedCards.length <= productsPerPage;
    }

    const loadMore = document.querySelector("#productsLoadMore");
    if (loadMore) {
      loadMore.hidden = currentProductsPage >= totalPages;
    }

    const pageNumbers = document.querySelector("#productsPageNumbers");
    if (pageNumbers) {
      const visiblePages = visiblePageNumbers(currentProductsPage, totalPages);
      pageNumbers.innerHTML = `
        <button
          class="products-page-arrow interactive"
          type="button"
          data-page-direction="previous"
          aria-label="Попередня сторінка"
          ${currentProductsPage <= 1 ? "disabled" : ""}
        >
          ${icon("chevron", "chevron products-page-arrow-icon products-page-arrow-icon--prev")}
        </button>
        ${visiblePages
          .map(
            (pageNumber) => `
          <button
            class="products-page-number interactive${pageNumber === currentProductsPage ? " active" : ""}"
            type="button"
            data-page-number="${pageNumber}"
            aria-label="Сторінка ${pageNumber}"
          >
            ${pageNumber}
          </button>
        `,
          )
          .join("")}
        <button
          class="products-page-arrow interactive"
          type="button"
          data-page-direction="next"
          aria-label="Наступна сторінка"
          ${currentProductsPage >= totalPages ? "disabled" : ""}
        >
          ${icon("chevron", "chevron products-page-arrow-icon products-page-arrow-icon--next")}
        </button>
      `;

      pageNumbers.querySelectorAll(".products-page-number").forEach((button) => {
        button.addEventListener("click", () => {
          currentProductsPage = Number(button.dataset.pageNumber) || 1;
          applyProductsFilter();
        });
      });

      pageNumbers.querySelectorAll(".products-page-arrow").forEach((button) => {
        button.addEventListener("click", () => {
          if (button.disabled) {
            return;
          }

          currentProductsPage += button.dataset.pageDirection === "next" ? 1 : -1;
          currentProductsPage = Math.min(Math.max(1, currentProductsPage), totalPages);
          applyProductsFilter();
        });
      });
    }
  };

  document.querySelector("#productSearch")?.addEventListener("input", (event) => {
    productSearchQuery = event.target.value;
    currentProductsPage = 1;
    applyProductsFilter();
  });

  document.querySelectorAll(".frequent-product-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".frequent-product-card").forEach((item) => {
        item.classList.remove("active");
      });

      card.classList.add("active");
      productSearchQuery = card.dataset.productName || "";
      const searchInput = document.querySelector("#productSearch");
      if (searchInput) {
        searchInput.value = productSearchQuery;
      }
      currentProductsPage = 1;
      applyProductsFilter();
    });
  });

  document.querySelectorAll(".product-filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".product-filter-chip").forEach((item) => {
        item.classList.remove("active");
      });

      chip.classList.add("active");
      selectedProductFilter = chip.dataset.filterKey || "all";
      currentProductsPage = 1;
      applyProductsFilter();
    });
  });

  document.querySelector("#productsLoadMore")?.addEventListener("click", () => {
    currentProductsPage += 1;
    applyProductsFilter();
  });

  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const productId = card.dataset.productId;
      const fallbackProductParam = `product=${encodeURIComponent(card.dataset.productName || "")}`;
      window.history.pushState(
        {},
        "",
        appHref(
          `/product-price?${
            productId ? `productId=${encodeURIComponent(productId)}` : fallbackProductParam
          }`,
        ),
      );
      window.dispatchEvent(new Event("popstate"));
    });
  });

  document.querySelector("#dailyRecommendation")?.addEventListener("click", () => {
    console.log("Open daily recommendation");
  });

  applyProductsFilter();
}
