import { assetUrl, fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";
import { formatProductText } from "../shared/text.js";

let loadedStoreMapKey = null;
let selectedMapRetailer = "all";
let selectedMapStoreId = null;
let storeMapZoom = 8;
let storeMapPan = { x: 0, y: 0 };
const mapViewportSize = { width: 760, height: 520 };
const mapTileSize = 256;
const kyivRegionBounds = {
  north: 51.55,
  south: 49.15,
  west: 29.15,
  east: 32.15,
};
const kyivRegionCenter = {
  latitude: (kyivRegionBounds.north + kyivRegionBounds.south) / 2,
  longitude: (kyivRegionBounds.west + kyivRegionBounds.east) / 2,
};
let storeMapData = {
  product: null,
  city: "Київ",
  mapStatus: "missing_coordinates",
  coordinateNotice: "Дані магазинів ще не завантажені.",
  priceLayer: {
    source: "mock_fallback",
    label: "MVP fallback price",
    notice: "Ціни на мапі будуть показані після завантаження даних.",
  },
  summary: {
    storesCount: 0,
    displayedStoresCount: 0,
    storesWithCoordinates: 0,
    bestPrice: null,
    bestRetailer: null,
  },
  retailers: [],
  stores: [],
};

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function applyStoreMapData(data) {
  storeMapData = {
    product: data.product ?? storeMapData.product,
    city: data.city || "Київ",
    mapStatus: data.mapStatus || "missing_coordinates",
    coordinateNotice: data.coordinateNotice || "",
    priceLayer: data.priceLayer ?? storeMapData.priceLayer,
    summary: data.summary ?? storeMapData.summary,
    retailers: Array.isArray(data.retailers) ? data.retailers : [],
    stores: Array.isArray(data.stores) ? data.stores : [],
  };
}

function loadProductStoreMap(productId, retailer = selectedMapRetailer) {
  if (!productId) {
    return;
  }

  const key = `${productId}:${retailer}`;
  if (loadedStoreMapKey === key) {
    return;
  }

  loadedStoreMapKey = key;
  const params = new URLSearchParams({
    city: "Київ",
    retailer,
    limit: "80",
  });

  fetchJson(`/api/products/${encodeURIComponent(productId)}/store-prices-map?${params.toString()}`)
    .then((data) => {
      applyStoreMapData(data);
      rerenderRoute();
    })
    .catch((error) => {
      console.warn(error.message);
    });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeStoreId(store) {
  return String(store.storeId ?? `${store.retailer || "store"}-${store.address || ""}`);
}

function hashString(value) {
  return Array.from(String(value || "")).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    2166136261,
  );
}

function estimatedCoordinateForStore(store, index) {
  const value = hashString(`${store.chainKey || store.retailer || ""}:${store.address || ""}:${index}`);
  const latitudeRatio = ((value >>> 4) % 1000) / 1000;
  const longitudeRatio = ((value >>> 14) % 1000) / 1000;
  const latitudePadding = (kyivRegionBounds.north - kyivRegionBounds.south) * 0.12;
  const longitudePadding = (kyivRegionBounds.east - kyivRegionBounds.west) * 0.12;

  return {
    latitude:
      kyivRegionBounds.south +
      latitudePadding +
      latitudeRatio * (kyivRegionBounds.north - kyivRegionBounds.south - latitudePadding * 2),
    longitude:
      kyivRegionBounds.west +
      longitudePadding +
      longitudeRatio * (kyivRegionBounds.east - kyivRegionBounds.west - longitudePadding * 2),
  };
}

function isKyivRegionCoordinate(latitude, longitude) {
  return (
    latitude >= kyivRegionBounds.south &&
    latitude <= kyivRegionBounds.north &&
    longitude >= kyivRegionBounds.west &&
    longitude <= kyivRegionBounds.east
  );
}

function storesForMap() {
  return storeMapData.stores.map((store, index) => {
    const latitude = Number(store.latitude);
    const longitude = Number(store.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude) && isKyivRegionCoordinate(latitude, longitude)) {
      return {
        ...store,
        latitude,
        longitude,
        isEstimatedCoordinate: false,
      };
    }

    const estimated = estimatedCoordinateForStore(store, index);
    return {
      ...store,
      latitude: estimated.latitude,
      longitude: estimated.longitude,
      isEstimatedCoordinate: true,
    };
  });
}

function resetMapCamera() {
  storeMapZoom = 8;
  storeMapPan = { x: 0, y: 0 };
}

function worldPoint(latitude, longitude, zoom) {
  const clampedLatitude = clamp(latitude, -85.05112878, 85.05112878);
  const sinLatitude = Math.sin((clampedLatitude * Math.PI) / 180);
  const worldSize = mapTileSize * 2 ** zoom;

  return {
    x: ((longitude + 180) / 360) * worldSize,
    y:
      (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      worldSize,
  };
}

function activeMapStore(storesWithCoordinates = coordinateStores()) {
  if (!selectedMapStoreId) {
    return null;
  }

  return storesWithCoordinates.find((store) => normalizeStoreId(store) === selectedMapStoreId) || null;
}

function mapCenterForStores(storesWithCoordinates) {
  const activeStore = activeMapStore(storesWithCoordinates);
  if (activeStore) {
    return {
      latitude: Number(activeStore.latitude),
      longitude: Number(activeStore.longitude),
    };
  }

  return kyivRegionCenter;
}

function mapProjection(storesWithCoordinates = coordinateStores()) {
  const mapCenter = mapCenterForStores(storesWithCoordinates);
  const center = worldPoint(mapCenter.latitude, mapCenter.longitude, storeMapZoom);

  return {
    zoom: storeMapZoom,
    topLeft: {
      x: center.x - mapViewportSize.width / 2,
      y: center.y - mapViewportSize.height / 2,
    },
  };
}

function tileUrl(tileX, tileY, zoom) {
  const tileCount = 2 ** zoom;
  const normalizedX = ((tileX % tileCount) + tileCount) % tileCount;

  return `https://tile.openstreetmap.org/${zoom}/${normalizedX}/${tileY}.png`;
}

function renderStoreLogo(store) {
  const logoUrl = assetUrl(store.logoUrl || "");

  return logoUrl
    ? `<span class="price-store-logo price-store-logo--image"><img src="${escapeAttribute(logoUrl)}" alt="" loading="lazy" onerror="this.hidden = true;" /></span>`
    : `<span class="price-store-logo price-store-logo--${escapeAttribute(store.logo || "store")}">${escapeAttribute(store.logoText || store.retailer || "М")}</span>`;
}

function coordinateStores() {
  return storesForMap().filter(
    (store) => Number.isFinite(Number(store.latitude)) && Number.isFinite(Number(store.longitude)),
  );
}

function markerPosition(store, projection) {
  const point = worldPoint(Number(store.latitude), Number(store.longitude), projection.zoom);
  const x = point.x - projection.topLeft.x;
  const y = point.y - projection.topLeft.y;

  return `left: ${x.toFixed(1)}px; top: ${y.toFixed(1)}px;`;
}

function renderMapMarker(store, projection, isBest) {
  const storeId = normalizeStoreId(store);
  const isActive = selectedMapStoreId === storeId;
  const estimatedClass = store.isEstimatedCoordinate ? " estimated" : "";

  return `
    <button
      class="store-map-marker${isBest ? " best" : ""}${isActive ? " active" : ""}${estimatedClass}"
      type="button"
      data-map-store-id="${escapeAttribute(storeId)}"
      style="${markerPosition(store, projection)}"
      aria-label="${escapeAttribute(`${store.retailer}, ${store.price}, ${store.address}`)}"
    >
      <span class="store-map-marker-pin" aria-hidden="true"></span>
      <span class="store-map-marker-card">
        <strong>${escapeAttribute(store.price)}</strong>
        <small>${escapeAttribute(store.retailer || "Магазин")}</small>
      </span>
    </button>
  `;
}

function renderRetailerFilters() {
  const retailers = [{ key: "all", name: "Усі магазини", count: storeMapData.summary.storesCount || 0 }].concat(
    storeMapData.retailers,
  );

  return `
    <div class="store-map-retailers" aria-label="Фільтр мереж">
      ${retailers
        .map(
          (retailer) => `
            <button
              class="store-map-filter interactive${retailer.key === selectedMapRetailer ? " active" : ""}"
              type="button"
              data-map-retailer="${escapeAttribute(retailer.key)}"
            >
              ${escapeAttribute(retailer.name)}
              <span>${retailer.count}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function bestPriceValue() {
  return Math.min(
    ...storeMapData.stores
      .map((store) => Number(store.priceValue))
      .filter((value) => Number.isFinite(value)),
  );
}

function renderStoreMapListRow(store, index, bestValue) {
  const isBest = Number(store.priceValue) === bestValue;
  const storeId = normalizeStoreId(store);
  const isActive = selectedMapStoreId === storeId;

  return `
    <button class="store-map-list-row interactive${isActive ? " active" : ""}" type="button" data-store-location-id="${escapeAttribute(storeId)}">
      ${renderStoreLogo(store)}
      <span class="store-map-list-index">${index + 1}</span>
      <span class="store-map-list-copy">
        <strong>${escapeAttribute(store.retailer)}</strong>
        <small>${escapeAttribute(store.address)}</small>
        <small>${escapeAttribute(store.observedAt ? `чек: ${store.observedAt}` : "ціна з чеку")}</small>
      </span>
      <span class="store-map-list-price">
        ${isBest ? `<small>Найнижча ціна</small>` : ""}
        <strong>${escapeAttribute(store.price)}</strong>
        <small>${store.receiptCount ? `${store.receiptCount} чек${store.receiptCount === 1 ? "" : "ів"}` : "чек"}</small>
      </span>
      ${icon("chevron", "chevron")}
    </button>
  `;
}

function selectedRetailerName() {
  if (selectedMapRetailer === "all") {
    return "Усі магазини";
  }

  return storeMapData.retailers.find((retailer) => retailer.key === selectedMapRetailer)?.name || "Обрана мережа";
}

function mapAreaName() {
  return "Київська область";
}

function renderSummaryCard() {
  const productName = storeMapData.product?.name || "Обраний продукт";

  return `
    <section class="store-map-summary-card" aria-label="Підсумок магазинів">
      <span class="store-map-summary-icon">${icon("store")}</span>
      <span class="store-map-summary-copy">
        <small>${escapeAttribute(selectedRetailerName())}</small>
        <strong>${escapeAttribute(formatProductText(productName))}</strong>
      </span>
      <span class="store-map-summary-meta">
        <small>${icon("mapPin")}${escapeAttribute(mapAreaName())}</small>
        <small>${icon("store")}${storeMapData.summary.storesCount || 0} магазинів</small>
      </span>
    </section>
  `;
}

function renderMapTiles(projection) {
  const startTileX = Math.floor(projection.topLeft.x / mapTileSize) - 1;
  const endTileX = Math.floor((projection.topLeft.x + mapViewportSize.width) / mapTileSize) + 1;
  const startTileY = Math.floor(projection.topLeft.y / mapTileSize) - 1;
  const endTileY = Math.floor((projection.topLeft.y + mapViewportSize.height) / mapTileSize) + 1;
  const maxTile = 2 ** projection.zoom - 1;
  const tiles = [];

  for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
    if (tileY < 0 || tileY > maxTile) {
      continue;
    }

    for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
      tiles.push({
        x: tileX * mapTileSize - projection.topLeft.x,
        y: tileY * mapTileSize - projection.topLeft.y,
        src: tileUrl(tileX, tileY, projection.zoom),
      });
    }
  }

  return tiles
    .map(
      (tile) => `
        <img
          class="store-map-tile"
          src="${escapeAttribute(tile.src)}"
          alt=""
          loading="lazy"
          draggable="false"
          style="left: ${tile.x.toFixed(1)}px; top: ${tile.y.toFixed(1)}px;"
          onerror="this.hidden = true;"
        />
      `,
    )
    .join("");
}

function renderMapLayer(projection) {
  return `
    <div class="store-map-tiles" aria-hidden="true">
      <span class="store-map-water store-map-water--1"></span>
      <span class="store-map-park store-map-park--1">Парк</span>
      <span class="store-map-park store-map-park--2">Сквер</span>
      <span class="store-map-block store-map-block--1"></span>
      <span class="store-map-block store-map-block--2"></span>
      <span class="store-map-block store-map-block--3"></span>
      <span class="store-map-block store-map-block--4"></span>
      <span class="store-map-block store-map-block--5"></span>
      <span class="store-map-road store-map-road--primary"></span>
      <span class="store-map-road store-map-road--secondary"></span>
      <span class="store-map-road store-map-road--third"></span>
      <span class="store-map-road store-map-road--fourth"></span>
      <span class="store-map-road store-map-road--fifth"></span>
      <span class="store-map-road-label store-map-road-label--1">просп. Перемоги</span>
      <span class="store-map-road-label store-map-road-label--2">вул. Велика Васильківська</span>
      <span class="store-map-road-label store-map-road-label--3">бул. Лесі Українки</span>
      <span class="store-map-district store-map-district--1">Шевченківський</span>
      <span class="store-map-district store-map-district--2">Печерськ</span>
      <span class="store-map-district store-map-district--3">Поділ</span>
      ${renderMapTiles(projection)}
    </div>
  `;
}

function renderMapViewport() {
  const storesWithCoordinates = coordinateStores();
  const bestValue = bestPriceValue();
  const hasBestPrice = Number.isFinite(bestValue);
  const projection = mapProjection(storesWithCoordinates);
  const hasEstimatedCoordinates = storesWithCoordinates.some((store) => store.isEstimatedCoordinate);

  return `
    <div class="store-map-viewport">
      <div
        class="store-map-surface"
        style="--store-map-zoom: ${storeMapZoom}; --store-map-pan-x: ${storeMapPan.x}px; --store-map-pan-y: ${storeMapPan.y}px;"
      >
        ${renderMapLayer(projection)}
        ${
          storesWithCoordinates.length
            ? storesWithCoordinates
                .map((store) => renderMapMarker(store, projection, hasBestPrice && Number(store.priceValue) === bestValue))
                .join("")
            : `
              <div class="store-map-placeholder">
                ${icon("mapPin")}
                <strong>Координати очікують валідації</strong>
                <span>${escapeAttribute(storeMapData.coordinateNotice || "У dataset немає lat/lon для побудови маркерів.")}</span>
              </div>
            `
        }
      </div>
      <div class="store-map-controls" aria-label="Керування мапою">
        <button class="store-map-control interactive" type="button" data-map-zoom="in" aria-label="Збільшити мапу">+</button>
        <button class="store-map-control interactive" type="button" data-map-zoom="out" aria-label="Зменшити мапу">−</button>
        <button class="store-map-control interactive" type="button" data-map-zoom="reset" aria-label="Скинути масштаб">
          ${icon("target")}
        </button>
      </div>
      <div class="store-map-scale" aria-label="Поточний масштаб">z${storeMapZoom}</div>
      <a
        class="store-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap
      </a>
      ${
        hasEstimatedCoordinates
          ? `<div class="store-map-coordinate-note">Частину адрес розміщено приблизно до геокодування.</div>`
          : ""
      }
    </div>
  `;
}

function renderStoreMapContent() {
  const visibleStores = storeMapData.stores.slice(0, 8);
  const bestValue = bestPriceValue();

  return `
    ${renderSummaryCard()}
    ${renderRetailerFilters()}

    <section class="store-map-card" aria-labelledby="store-map-title">
      <div class="store-map-heading">
        <span>
          <small>${escapeAttribute(mapAreaName())}</small>
          <h2 id="store-map-title">Мапа цін у магазинах</h2>
        </span>
        <strong>${storeMapData.summary.displayedStoresCount || visibleStores.length} показано</strong>
      </div>
      ${renderMapViewport()}
      <div class="store-map-notice">
        <strong>${escapeAttribute(storeMapData.priceLayer.label || "MVP fallback price")}</strong>
        <span>${escapeAttribute(storeMapData.priceLayer.notice || "")}</span>
      </div>
    </section>

    <section class="store-map-list" aria-label="Магазини на мапі">
      ${
        visibleStores.length
          ? visibleStores.map((store, index) => renderStoreMapListRow(store, index, bestValue)).join("")
          : `<p class="store-price-empty">Магазини для мапи ще не завантажені.</p>`
      }
    </section>

    <section class="store-map-best-card" aria-label="Найкраща ціна">
      <span>${icon("trendUp")}</span>
      <strong>
        Найкраща ціна ${storeMapData.summary.bestRetailer ? `в мережі ${escapeAttribute(storeMapData.summary.bestRetailer)}` : ""}
        ${storeMapData.summary.bestPrice ? `— ${escapeAttribute(storeMapData.summary.bestPrice)}` : ""}
      </strong>
      <small>Порівняння використовує реальні магазини з dataset і тимчасовий mock-шар цін.</small>
    </section>
  `;
}

function renderMissingProduct() {
  return `
    <section class="store-map-empty">
      ${icon("mapPin")}
      <strong>Оберіть продукт для мапи</strong>
      <span>Сторінка мапи відкривається з конкретного продукту, щоб показати магазини і ціни.</span>
      <a class="primary-action interactive" href="${appHref("/products")}" data-link>До продуктів</a>
    </section>
  `;
}

export function renderStoreMapPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("productId");

  return `
    <section class="store-map-page" aria-labelledby="stores-map-title">
      <h1 id="stores-map-title">Ціни в магазинах</h1>
      ${productId ? renderStoreMapContent() : renderMissingProduct()}
    </section>
  `;
}

export function bindStoreMapPage() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("productId");
  const requestedRetailer = params.get("retailer") || "all";

  if (requestedRetailer !== selectedMapRetailer) {
    selectedMapRetailer = requestedRetailer;
    loadedStoreMapKey = null;
    selectedMapStoreId = null;
    resetMapCamera();
  }

  loadProductStoreMap(productId, selectedMapRetailer);

  document.querySelectorAll("[data-map-retailer]").forEach((filter) => {
    filter.addEventListener("click", () => {
      selectedMapRetailer = filter.dataset.mapRetailer || "all";
      loadedStoreMapKey = null;
      selectedMapStoreId = null;
      resetMapCamera();

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("retailer", selectedMapRetailer);
      window.history.pushState({}, "", appHref(`/stores-map?${nextParams.toString()}`));
      loadProductStoreMap(productId, selectedMapRetailer);
    });
  });

  document.querySelectorAll("[data-map-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.mapZoom;
      if (action === "in") {
        storeMapZoom = Math.min(14, storeMapZoom + 1);
      } else if (action === "out") {
        storeMapZoom = Math.max(8, storeMapZoom - 1);
      } else {
        resetMapCamera();
      }
      rerenderRoute();
    });
  });

  document.querySelectorAll("[data-map-store-id]").forEach((marker) => {
    marker.addEventListener("click", () => {
      selectedMapStoreId = marker.dataset.mapStoreId || null;
      storeMapPan = { x: 0, y: 0 };
      rerenderRoute();
    });
  });

  document.querySelectorAll("[data-store-location-id]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedMapStoreId = row.dataset.storeLocationId || null;
      storeMapPan = { x: 0, y: 0 };
      rerenderRoute();
    });
  });

  const viewport = document.querySelector(".store-map-viewport");
  const surface = document.querySelector(".store-map-surface");
  if (!viewport || !surface) {
    return;
  }

  let dragStart = null;
  const updateSurfaceTransform = () => {
    surface.style.setProperty("--store-map-pan-x", `${storeMapPan.x}px`);
    surface.style.setProperty("--store-map-pan-y", `${storeMapPan.y}px`);
  };

  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) {
      return;
    }

    dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: storeMapPan.x,
      panY: storeMapPan.y,
    };
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    const maxPan = Math.max(180, 22 * storeMapZoom);
    storeMapPan = {
      x: clamp(dragStart.panX + event.clientX - dragStart.x, -maxPan, maxPan),
      y: clamp(dragStart.panY + event.clientY - dragStart.y, -maxPan, maxPan),
    };
    updateSurfaceTransform();
  });

  const endDrag = (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    dragStart = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
}
