import {
  bindBusinessMockLinks,
  businessFilterApiPath,
  renderBusinessKpiCards,
  renderBusinessPageShell,
} from "./components.js";
import { kyivCommunityMapData } from "./kyivCommunityMapData.js";
import { fetchJson, rerenderRoute } from "../shared/api.js";
import { icon } from "../shared/icons.js";
import { appHref } from "../shared/navigation.js";

let businessGeographyState = null;
let businessGeographyError = "";
let geographyRequestKey = "";
let businessRegionMapZoom = 1;

const businessRegionMapZoomMin = 1;
const businessRegionMapZoomMax = 2.8;
const businessRegionMapZoomStep = 0.25;

const loadingFilters = {
  period: "Завантаження",
  geography: "SmartCart DB",
  category: "Завантаження",
  retailer: "Завантаження",
};

const loadingStatus = {
  updatedAt: "завантаження",
  source: "SmartCart DB",
};

const growthPotentialTitle =
  "Потенціал росту = різниця між поточними продажами і очікуваними продажами, якщо регіон/товар досягне рівня схожих кращих регіонів.";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export const businessKyivMap = {
  width: 720,
  height: 410,
  tileSize: 256,
  zoom: 7,
  scale: 1.1,
  center: { latitude: 50.26, longitude: 30.78 },
  outlinePath:
    "M208.6 45.9L213.6 67.4L214.7 68L214.9 63.1L216.7 62.7L224.6 68.4L227.7 73.9L233 78.5L228.3 85.2L228.5 90.6L229.5 91.5L225.9 90L223.2 90.8L223 96.3L225.4 96.9L228.6 100.2L229 103.5L234 109L231.6 114L234.8 116.2L236.1 115.4L236.6 117.7L231.9 117L230.7 118L234 121.1L232.4 122.5L232.5 124L229 124.1L232.1 125.4L235.3 123.7L238.9 124.5L239.7 129.3L241.6 131.2L239.5 135.9L236.1 137.4L234 141.8L230.4 141.7L229.5 143.2L230.3 144.2L228.2 146.3L229.1 147.1L227.7 146.9L226.3 148.2L231.7 153.2L232.1 159.9L230.4 161.6L227.6 161.1L228.5 163L227.9 164.6L232.5 167.3L232.9 171.9L230.2 173.7L227.5 171.9L226.5 174.7L231.6 175.1L231.7 176.7L230 180.1L226.1 180.6L227.3 182.8L230 182.4L229.9 181L237.9 179.5L240.9 183L240.7 187L243.6 188.6L245.6 187.3L246 189.6L243 192.2L244.5 194L249.2 195.5L251.1 195.1L249.4 199.1L250.7 202.3L248.5 202.7L249.2 203.8L248.4 204.2L252.2 209.7L250.4 210.3L246.2 217.5L251.1 221.9L247.8 225.7L247.4 227.2L248.9 227.9L246.6 229L251.6 234.9L251.4 238.8L249 240.6L251.7 244.7L250.9 245.9L253.6 248.8L253.3 250.8L255 250.9L254 251.9L255.4 254.3L254.4 254.7L254.7 256.1L248.4 259.4L244.6 263.3L245.1 264.7L248.5 265.2L247.4 266.4L245.9 265.9L243.9 268.6L242.2 268L241.1 270.3L236.5 271.2L236 273.8L232.7 271.3L230.9 272.8L231.6 274.2L230.2 276L228.8 274.5L226.7 276.3L225.7 275.8L228 282.6L225.3 287.6L226.4 290.1L231.6 290.1L230.7 297L233.2 297.9L232.4 300.1L235.4 302L232.7 304.6L231.8 308.6L234.9 313.5L236.5 318.2L235.8 319.9L238.8 322.6L240.3 322L240.4 323.9L237.8 323.4L236.2 325.5L241.4 331.9L239.1 333.4L236.1 338.2L232.4 339.2L232.1 343L233.9 344.7L234.7 349.2L235.9 350.3L239.9 350.5L243.7 353L242.6 353.9L244 357.8L243.2 359.1L245.9 362.1L248.1 361.5L250.9 363.5L252 359.9L253.9 362.5L253.5 363.7L257.3 365.1L256.1 367.5L254.6 368L257.9 372.3L263.3 371.2L263.9 372.5L267.7 371L270.2 371.3L269.6 369.2L271.7 368.5L275.1 361.8L277.5 361.2L276.6 352L277.9 352.9L280.2 351.5L282.6 351.5L282.9 349.6L284.6 348.6L289.8 350.4L290.8 356.1L293.1 358.4L294.3 355.6L292.6 353.4L295.1 351.7L295.6 349L302 349.5L300.9 357.7L318.6 360.7L319.5 363.6L321.7 353.3L324.1 353.5L323.3 349.2L325.9 348.7L325.7 345.8L329.3 343.9L333.5 349.6L336.7 349.8L336.5 348.3L338.7 345.8L340.3 346.2L342.7 343.1L345.9 345.2L348 344.6L348.2 345.5L349.7 345.4L354.9 349L357 346.9L359.9 347.2L362 345.6L368.6 346.1L370.3 344.2L372.9 344.9L375.7 339.3L375.7 337.4L374.1 336.1L377.7 334.8L381.4 335L382.7 333.7L382.5 330.6L385 327.4L385.3 329.5L386.4 329.7L386 327.1L391.5 323.6L391.3 320.6L392.5 318.2L391.8 316.5L392.9 314.3L394.2 313.6L396 315L397.4 314.5L396 312L397.3 310.7L394.9 310.1L395.6 307.1L402.3 296L402.2 293.6L403.2 294.3L403.8 293L401.7 291.9L404.3 287.1L403 286.4L403.7 286.2L402.5 283.3L403.7 280.3L401 278.2L404.2 271.7L402.8 268.6L406.8 266.1L408.1 267.7L413.1 262.4L418.7 261.8L420.1 260L415.5 255.6L415.5 254.3L416.8 253.5L415.5 252.5L413.3 251.3L410.9 253L412.6 249.9L410.9 250.2L411.1 248.9L420.4 246.7L425.8 248.1L426.6 249.6L424.6 255.6L425.5 262.4L426.6 264.8L429.1 265.3L429.8 267.4L431.8 267.4L432.3 270L433.5 269.4L433.6 266L436.4 264.6L437.8 265.1L440.2 260.1L443.4 260.2L443.6 267.9L453.3 268.8L457.3 262.2L459.5 262.1L459.2 258L461.7 255.9L463.5 250.9L471.1 251.5L472.4 254.2L473.9 251.6L474 247L472.1 242.6L479 238.7L480.1 239.6L480.8 237.4L474.7 236.2L472.5 236.9L473.3 229.9L479.7 226.1L477.9 223.6L476.8 224.3L475.6 220.9L478.7 222L482.2 215.3L481.5 214.2L483.9 213.4L487.8 216.3L490.8 211L493 211.3L494 209.9L491.1 207L492.3 202.4L490.5 201.4L496.2 198L495.1 196.2L497.4 192.9L496.3 190.2L498.3 188L497.6 186.8L494.2 186.2L491.8 187.4L489.6 187L490.6 186.1L489.8 184.2L492.4 181.1L491.8 180.5L487.8 183.5L486.7 182.7L484.4 173.9L479.4 172.5L480.1 170.2L478.5 169.6L479.7 169L480.4 169.9L480.8 167.8L482.4 167.9L482.8 169.4L486.9 167.9L488.5 165.5L487.1 163.2L488.4 162.7L488.5 160.9L477.3 160.4L473.4 152.1L470.5 150.4L468 146.5L463.2 147.8L463.3 150.6L460.4 150.7L460.3 158L450.5 157.4L449 159.1L446.8 159L446.7 162.4L445.1 164L439.2 162.9L437.4 164.2L434.4 161.6L434.3 163.8L431.4 163.7L427.6 165.6L426.6 167.3L424.1 166.7L423.5 164.6L418.5 162.5L415.1 167.2L414 162.9L408.3 161.2L406.7 156.8L400.8 155.6L400.8 153.3L398.6 153.2L398.6 150.4L404.3 150.5L404.8 149.5L403.8 148.3L404.8 147.3L401.9 144.5L404.4 140.9L403.9 136.2L402.7 136.3L402.6 134.8L401.1 135.3L401.1 131.9L398.5 131.8L398.8 130.6L394.2 127.9L394.7 124L389.6 122.9L389 125.5L377.6 125.7L377.1 126.8L371.2 125.3L371 124.1L369.7 124.9L369.5 128.4L365.8 128.8L365.2 127.2L366.5 127.2L366.6 123.6L369.2 123L369.1 122.1L366.8 122.7L365.7 125.6L362.4 125.3L358.8 123.1L356 124.5L355.5 122.6L356.7 121.2L355.7 117.4L356.5 116.9L358.1 118.3L359 117.2L358.5 115.9L359.7 115L359.2 108.2L355.3 104.9L350.4 103.8L346.4 93.9L346.2 87.8L342.3 86.7L342.1 83.8L331.9 85.1L331.2 81L333 76.5L330.2 73.6L333.2 71.9L333.7 70.5L331.5 67.1L331 61.9L332 60.3L334.9 60.5L336.1 59.5L333.7 58.4L335 56L332.5 52L334.6 50.5L337.8 51.1L337.5 48.3L332.4 43.5L327.3 44.6L328.3 39.3L324.4 39.4L321.7 38.3L314.4 30.6L317.7 27.7L316.2 21L317.1 20.6L315.4 20.1L306.6 10.5L303.2 9.3L299.9 6.2L298.8 6.7L298.3 10L294.7 7.2L293.7 10.2L283.3 7.4L283.4 9.8L281 11L279.6 10.4L278.1 12.9L274.6 9.5L270.5 11.7L270 16.8L267.1 16.3L266.5 14.9L263.6 16.3L263.2 14.6L261.3 14.9L261.6 17.6L256.3 15.1L255 9.4L256.5 7.9L255.6 3.1L253 3.8L249.5 6.3L249.1 7.7L247.3 7.2L246.2 8.4L245.2 7.2L244.3 9.1L242.7 9.2L242.4 12.8L239.8 14.3L235.7 11L233.8 17.3L234.2 20.5L233.4 20.4L231.4 24.8L224 21.9L217.9 26.3L217.8 28.1L221.2 27.6L221.5 35.9L216.5 36.5L218.5 39.4L217.4 41.4L218.6 42L217.3 44.4L215.3 45.2L215 43.7Z M305.5 178.8L306.6 176.7L305.9 174.8L307.7 172.1L307.1 169.7L308.9 167.6L308 165.5L312.2 162.1L311.7 158.7L314.6 160L315.1 158.4L316.1 158.4L312.7 156.2L319 155.7L319 153.7L328.3 154L328.4 156L331.3 156.8L332.2 159.2L336.1 161.9L336.2 163.8L338.5 164.8L337.7 161L347.4 161.9L349 158.9L351.8 157.6L351.9 158.7L353.4 158.6L352.8 155.8L354 153L358.6 154.1L359.1 155.4L360.4 154.7L363.6 157.2L364.3 161.5L357.2 164.4L358.2 165.9L355.8 167.5L358 169.9L356.9 169.9L356.1 172.2L357.2 172.1L357.5 173.4L356.3 173.9L361.2 177.7L361.8 180.6L364.6 182.4L363.3 184.3L359.6 183.8L360.1 185.3L358.2 187L356.1 187.4L353.7 185.8L352.7 188.4L353.3 190.2L351.7 191.3L348.8 189.3L349.9 187.5L345.6 189.1L346.2 192.8L344.6 191.1L343.1 191.5L347.2 200.3L346.2 200.6L345.1 199.2L344.6 201.5L342.9 202.1L346.5 208.5L345.7 208.9L346.3 210.3L341.3 212.3L340.6 207.3L338.4 202.3L337.4 202.3L337.3 203.5L336.2 202.5L336.6 200.1L334.7 200.2L335.3 196.1L332.9 194.6L331.6 195.3L331.1 193.2L329.5 193.5L328.8 189.3L325.7 189.8L325 187.5L326.2 186L318.6 179.4L316.9 175L316.8 175.8L314.2 176.4L310.1 175.6L308.9 178.9L307.9 178.1L306.4 179.4Z M313.7 168.6L314.7 169.7L316.8 169.5L316.5 167.5Z M340.6 5.6L341.6 5L342 6.5L347.2 4.4L360.2 6.3L360.9 4.2L360.5 2L355.6 1.6L355.6 0.4L352.9 -0.3L353 3.2L349.1 3.2L344.8 5.8L342.5 5.7L341.2 4.3Z M348.3 6.1L349.2 4.8Z M354.2 163.9L354.4 165.6L357.2 164.4L357.1 163.5Z M356.8 5.9L357.5 5.8Z M358.6 6.1L359.7 6.7Z",
};

function mapWorldPoint(latitude, longitude, zoom) {
  const sinLatitude = Math.sin((Math.max(Math.min(latitude, 85.05112878), -85.05112878) * Math.PI) / 180);
  const worldSize = businessKyivMap.tileSize * 2 ** zoom;

  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize,
  };
}

export function businessKyivProjection() {
  const center = mapWorldPoint(businessKyivMap.center.latitude, businessKyivMap.center.longitude, businessKyivMap.zoom);

  return {
    topLeft: {
      x: center.x - businessKyivMap.width / (2 * businessKyivMap.scale),
      y: center.y - businessKyivMap.height / (2 * businessKyivMap.scale),
    },
  };
}

function businessRegionMapViewBox() {
  const width = businessKyivMap.width / businessRegionMapZoom;
  const height = businessKyivMap.height / businessRegionMapZoom;
  const x = (businessKyivMap.width - width) / 2;
  const y = (businessKyivMap.height - height) / 2;

  return `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`;
}

function businessRegionMapZoomPercent() {
  return `${Math.round(businessRegionMapZoom * 100)}%`;
}

function businessMapTileUrl(tileX, tileY) {
  const tilesPerAxis = 2 ** businessKyivMap.zoom;
  const normalizedX = ((tileX % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;

  return `https://tile.openstreetmap.org/${businessKyivMap.zoom}/${normalizedX}/${tileY}.png`;
}

export function renderBusinessMapTiles(projection) {
  const startTileX = Math.floor(projection.topLeft.x / businessKyivMap.tileSize) - 1;
  const endTileX = Math.floor((projection.topLeft.x + businessKyivMap.width / businessKyivMap.scale) / businessKyivMap.tileSize) + 1;
  const startTileY = Math.floor(projection.topLeft.y / businessKyivMap.tileSize) - 1;
  const endTileY = Math.floor((projection.topLeft.y + businessKyivMap.height / businessKyivMap.scale) / businessKyivMap.tileSize) + 1;
  const tilesPerAxis = 2 ** businessKyivMap.zoom;
  const tiles = [];

  for (let tileX = startTileX; tileX <= endTileX; tileX += 1) {
    for (let tileY = startTileY; tileY <= endTileY; tileY += 1) {
      if (tileY < 0 || tileY >= tilesPerAxis) {
        continue;
      }

      const left = (tileX * businessKyivMap.tileSize - projection.topLeft.x) * businessKyivMap.scale;
      const top = (tileY * businessKyivMap.tileSize - projection.topLeft.y) * businessKyivMap.scale;
      const size = businessKyivMap.tileSize * businessKyivMap.scale;

      tiles.push(`
        <img
          class="business-region-map-tile"
          src="${businessMapTileUrl(tileX, tileY)}"
          alt=""
          loading="lazy"
          style="left: ${left.toFixed(2)}px; top: ${top.toFixed(2)}px; width: ${size.toFixed(2)}px; height: ${size.toFixed(2)}px;"
        />
      `);
    }
  }

  return tiles.join("");
}

export function renderBusinessCommunityChoropleth() {
  return kyivCommunityMapData
    .map(
      (community) => `
        <path
          class="business-map-community"
          data-level="${community.level}"
          data-community-name="${community.fullName}"
          data-community-sales="${community.sales} млн ₴"
          d="${community.path}"
          fill-rule="evenodd"
          aria-label="${community.fullName}: ${community.sales} млн гривень"
        >
          <title>${community.fullName}: ${community.sales} млн ₴</title>
        </path>
      `,
    )
    .join("");
}

function renderBusinessMapControls() {
  return `
    <div class="business-map-controls" aria-label="Керування масштабом мапи">
      <button
        class="business-map-control interactive"
        type="button"
        data-business-map-zoom="out"
        aria-label="Зменшити мапу"
        ${businessRegionMapZoom <= businessRegionMapZoomMin ? "disabled" : ""}
      >−</button>
      <span class="business-map-zoom-label" data-business-map-zoom-label>${businessRegionMapZoomPercent()}</span>
      <button
        class="business-map-control interactive"
        type="button"
        data-business-map-zoom="in"
        aria-label="Збільшити мапу"
        ${businessRegionMapZoom >= businessRegionMapZoomMax ? "disabled" : ""}
      >+</button>
      <button
        class="business-map-control business-map-control--reset interactive"
        type="button"
        data-business-map-zoom="reset"
        aria-label="Скинути масштаб"
      >${icon("refresh")}</button>
    </div>
  `;
}

function renderBusinessDataState(title, message) {
  return renderBusinessPageShell({
    activeKey: "geography",
    title: "Географія та пікові години",
    filters: loadingFilters,
    filterOptions: {},
    status: loadingStatus,
    updatedLabel: "Оновлено",
    children: `
      <section class="business-overview-card" aria-labelledby="business-data-state-title">
        <h2 id="business-data-state-title">${title}</h2>
        <p>${message}</p>
      </section>
    `,
  });
}

function renderRegionMap() {
  const { map, mapLegend } = businessGeographyState;
  const selectedRegion = map.selectedRegion || "Київська область";
  const projection = businessKyivProjection();

  return `
    <section class="business-overview-card business-geo-map-card" aria-labelledby="business-geo-map-title">
      <h2 id="business-geo-map-title">Київська область: продажі по громадах</h2>
      <div class="business-region-map-wrap">
        <svg
          class="business-region-map"
          viewBox="${businessRegionMapViewBox()}"
          role="img"
          aria-label="Реальна мапа громад Київської області з аналітичним шаром продажів"
          data-business-region-map
        >
          <defs>
            <clipPath id="business-kyiv-oblast-clip">
              <path d="${businessKyivMap.outlinePath}" clip-rule="evenodd" />
            </clipPath>
          </defs>
          <path class="business-region-map-shadow" d="${businessKyivMap.outlinePath}" fill-rule="evenodd" />
          <foreignObject x="0" y="0" width="720" height="410" clip-path="url(#business-kyiv-oblast-clip)">
            <div xmlns="http://www.w3.org/1999/xhtml" class="business-region-map-surface">
              <div class="business-region-map-tiles" aria-hidden="true">
                ${renderBusinessMapTiles(projection)}
              </div>
              <div class="business-region-map-overlay" aria-hidden="true"></div>
            </div>
          </foreignObject>
          <g class="business-community-layer" clip-path="url(#business-kyiv-oblast-clip)">
            ${renderBusinessCommunityChoropleth()}
          </g>
          <path class="business-region-map-outline" d="${businessKyivMap.outlinePath}" fill-rule="evenodd" />
        </svg>
        ${renderBusinessMapControls()}
        <div class="business-community-tooltip" data-business-community-tooltip hidden>
          <strong></strong>
          <b></b>
        </div>
        <a
          class="business-map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap
        </a>

        <div class="business-map-tooltip">
          <strong>${selectedRegion}</strong>
          <b>${map.selectedRegionSales}</b>
          <span>▲ ${map.selectedRegionGrowth} до попер. 30 днів</span>
        </div>

        <div class="business-map-legend" aria-label="Легенда продажів">
          <strong>Продажі, млн ₴</strong>
          ${mapLegend
            .map(
              (item) => `
                <span>
                  <i data-level="${item.level}"></i>
                  ${item.label}
                </span>
              `,
            )
            .join("")}
        </div>
      </div>
      <p class="business-map-caption">Дані за останні 30 днів ${icon("info")}</p>
    </section>
  `;
}

function renderGrowthRegionsTable() {
  return `
    <section class="business-overview-card business-growth-card" aria-labelledby="business-growth-title">
      <div class="business-card-title-row">
        <h2 id="business-growth-title">Регіони з потенціалом росту</h2>
        <span class="business-info-icon" title="${growthPotentialTitle}">${icon("info")}</span>
      </div>

      <div class="business-growth-table">
        <div class="business-growth-head" aria-hidden="true">
          <span>#</span>
          <span>Регіон</span>
          <span>Продажі, млн ₴</span>
          <span>Зміна</span>
          <span>Потенціал</span>
        </div>
        ${businessGeographyState.growthRegions
          .map(
            (row, index) => `
              <div class="business-growth-row">
                <span>${index + 1}</span>
                <strong>${row.region}</strong>
                <span>${row.sales}</span>
                <em>▲ ${row.change}</em>
                <span class="business-potential-cell">
                  <b>${row.score}</b>
                  <i class="${row.potential === "Високий" ? "high" : "medium"}">${row.potential}</i>
                </span>
              </div>
            `,
          )
          .join("")}
      </div>

      <footer class="business-card-footer">
        <span>Показано топ-5 регіонів</span>
        <a href="${appHref("/business/geography/all")}" data-business-mock-link>
          Переглянути всі регіони ${icon("arrowRight")}
        </a>
      </footer>
    </section>
  `;
}

function renderPeakHeatmap() {
  const { days, hours, heatmap } = businessGeographyState.peakHours;

  return `
    <section class="business-overview-card business-peak-hours-card" aria-labelledby="business-peak-title">
      <div class="business-card-title-row">
        <h2 id="business-peak-title">Пікові години покупок</h2>
        <span
          class="business-info-icon"
          title="Показує середню інтенсивність покупок за днями тижня і годинами на основі чеків за вибраний період."
        >
          ${icon("info")}
        </span>
      </div>

      <div class="business-week-heatmap" aria-label="Heatmap покупок за днями та годинами">
        <div class="business-week-heatmap-hours">
          ${hours.map((hour) => `<span>${hour}</span>`).join("")}
        </div>
        <div class="business-week-heatmap-days">
          ${days.map((day) => `<span>${day}</span>`).join("")}
        </div>
        <div class="business-week-heatmap-grid">
          ${heatmap
            .flatMap((row) => row.map((intensity) => `<span data-intensity="${intensity}"></span>`))
            .join("")}
        </div>
      </div>

      <div class="business-heatmap-scale">
        <span>Низька активність</span>
        <i></i>
        <span>Висока активність</span>
      </div>
    </section>
  `;
}

function renderPeakSummaryCards() {
  const { peakHours } = businessGeographyState;
  const cards = [
    {
      label: "Найактивніший день",
      value: peakHours.topDay,
      subtitle: `${peakHours.topDayShare} від тижневих продажів`,
      icon: "calendar",
    },
    {
      label: "Піковий інтервал",
      value: peakHours.peakInterval,
      subtitle: `${peakHours.peakIntervalShare} від добових продажів`,
      icon: "clock",
    },
    {
      label: "Найслабший період",
      value: peakHours.weakestPeriod,
      subtitle: `${peakHours.weakestPeriodShare} від добових продажів`,
      icon: "activity",
      tone: "warning",
    },
  ];

  return `
    <section class="business-peak-summary" aria-label="Короткий підсумок пікових годин">
      ${cards
        .map(
          (card) => `
            <article class="business-peak-mini-card${card.tone === "warning" ? " warning" : ""}">
              <span>${icon(card.icon)}</span>
              <div>
                <small>${card.label}</small>
                <strong>${card.value}</strong>
                <em>${card.subtitle}</em>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderHourlyBarChart() {
  const bars = businessGeographyState.peakHours.hourlySales;
  const maxValue = Math.max(...bars.map((bar) => bar.value));

  return `
    <section class="business-hourly-chart" aria-labelledby="business-hourly-title">
      <h2 id="business-hourly-title">Продажі за годинами <span>(середнє за 30 днів)</span></h2>
      <div class="business-hourly-chart-area">
        <div class="business-hourly-y-axis">
          <span>12</span>
          <span>6</span>
          <span>0</span>
        </div>
        <div class="business-hourly-bars">
          ${bars
            .map(
              (bar) => `
                <span style="height: ${Math.max(8, (bar.value / maxValue) * 100)}%;" title="${bar.hour}:00 · ${bar.value} млн ₴"></span>
              `,
            )
            .join("")}
        </div>
        <div class="business-hourly-x-axis">
          ${bars
            .filter((bar) => Number(bar.hour) % 2 === 0)
            .map((bar) => `<span>${bar.hour}</span>`)
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPeakRightPanel() {
  return `
    <div class="business-peak-right-panel">
      ${renderPeakSummaryCards()}
      ${renderHourlyBarChart()}
    </div>
  `;
}

function updateBusinessRegionMapZoomDom() {
  const map = document.querySelector("[data-business-region-map]");
  const zoomLabel = document.querySelector("[data-business-map-zoom-label]");

  map?.setAttribute("viewBox", businessRegionMapViewBox());
  if (zoomLabel) {
    zoomLabel.textContent = businessRegionMapZoomPercent();
  }

  document.querySelectorAll("[data-business-map-zoom]").forEach((button) => {
    const action = button.dataset.businessMapZoom;
    button.disabled =
      (action === "out" && businessRegionMapZoom <= businessRegionMapZoomMin) ||
      (action === "in" && businessRegionMapZoom >= businessRegionMapZoomMax);
  });
}

function setBusinessRegionMapZoom(value) {
  businessRegionMapZoom = clamp(value, businessRegionMapZoomMin, businessRegionMapZoomMax);
  updateBusinessRegionMapZoomDom();
}

function bindBusinessRegionMapInteractions() {
  const wrap = document.querySelector(".business-region-map-wrap");
  const tooltip = wrap?.querySelector("[data-business-community-tooltip]");

  if (!wrap || wrap.dataset.businessRegionMapBound === "true") {
    return;
  }

  wrap.dataset.businessRegionMapBound = "true";

  wrap.querySelectorAll("[data-business-map-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.businessMapZoom;
      if (action === "in") {
        setBusinessRegionMapZoom(businessRegionMapZoom + businessRegionMapZoomStep);
      } else if (action === "out") {
        setBusinessRegionMapZoom(businessRegionMapZoom - businessRegionMapZoomStep);
      } else {
        setBusinessRegionMapZoom(1);
      }
    });
  });

  if (!tooltip) {
    return;
  }

  let activeCommunity = null;
  const tooltipTitle = tooltip.querySelector("strong");
  const tooltipValue = tooltip.querySelector("b");

  const positionTooltip = (event) => {
    const bounds = wrap.getBoundingClientRect();
    const nextLeft = event.clientX - bounds.left + 14;
    const nextTop = event.clientY - bounds.top + 14;
    const maxLeft = Math.max(8, bounds.width - tooltip.offsetWidth - 8);
    const maxTop = Math.max(8, bounds.height - tooltip.offsetHeight - 8);

    tooltip.style.left = `${clamp(nextLeft, 8, maxLeft)}px`;
    tooltip.style.top = `${clamp(nextTop, 8, maxTop)}px`;
  };

  const showTooltip = (community, event) => {
    activeCommunity?.classList.remove("is-active");
    activeCommunity = community;
    activeCommunity.classList.add("is-active");

    if (tooltipTitle) {
      tooltipTitle.textContent = community.dataset.communityName || "Громада";
    }
    if (tooltipValue) {
      tooltipValue.textContent = community.dataset.communitySales || "";
    }

    tooltip.hidden = false;
    positionTooltip(event);
  };

  const hideTooltip = () => {
    activeCommunity?.classList.remove("is-active");
    activeCommunity = null;
    tooltip.hidden = true;
  };

  wrap.querySelectorAll(".business-map-community").forEach((community) => {
    community.addEventListener("pointerenter", (event) => showTooltip(community, event));
    community.addEventListener("pointermove", positionTooltip);
    community.addEventListener("pointerleave", hideTooltip);
  });

  updateBusinessRegionMapZoomDom();
}

export function renderBusinessGeographyPage() {
  if (businessGeographyError) {
    return renderBusinessDataState("Не вдалося завантажити дані", businessGeographyError);
  }

  if (!businessGeographyState) {
    return renderBusinessDataState("Завантаження даних", "Отримуємо географію та пікові години зі SmartCart DB.");
  }

  return renderBusinessPageShell({
    activeKey: "geography",
    title: "Географія та пікові години",
    filters: businessGeographyState.filters,
    filterOptions: businessGeographyState.filterOptions,
    status: businessGeographyState.status,
    updatedLabel: "Оновлено",
    children: `
      ${renderBusinessKpiCards(businessGeographyState.kpis, "Ключові показники географії та пікових годин")}
      <div class="business-geography-row business-geography-row--map">
        ${renderRegionMap()}
        ${renderGrowthRegionsTable()}
      </div>
      <div class="business-geography-row business-geography-row--peaks">
        ${renderPeakHeatmap()}
        ${renderPeakRightPanel()}
      </div>
    `,
  });
}

export function bindBusinessGeographyPage() {
  const requestKey = businessFilterApiPath("/api/business/geography");

  if (geographyRequestKey !== requestKey) {
    geographyRequestKey = requestKey;
    fetchJson(requestKey)
      .then((data) => {
        businessGeographyState = data;
        businessGeographyError = "";
        rerenderRoute();
      })
      .catch((error) => {
        businessGeographyError = error.message;
        rerenderRoute();
      });
  }

  bindBusinessMockLinks();
  bindBusinessRegionMapInteractions();
}
