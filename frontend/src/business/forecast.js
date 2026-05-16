import {
  bindBusinessMockLinks,
  renderBusinessKpiCards,
  renderBusinessPageShell,
} from "./components.js";
import { apiUrl } from "../shared/api.js";
import { icon } from "../shared/icons.js";


const chart = { width: 720, height: 260, left: 46, right: 22, top: 24, bottom: 42 };

function chartX(index, total) {
  return chart.left + (index / Math.max(total - 1, 1)) * (chart.width - chart.left - chart.right);
}
function chartY(value, min, max) {
  return chart.top + ((max - value) / (max - min)) * (chart.height - chart.top - chart.bottom);
}
function linePath(points, getValue, min, max) {
  let started = false;
  return points
    .map((point, index) => {
      const value = getValue(point);
      if (value == null) return null;
      const command = started ? "L" : "M";
      started = true;
      return `${command}${chartX(index, points.length).toFixed(1)} ${chartY(value, min, max).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

async function fetchPricing(params = {}) {
  const qs = new URLSearchParams({
    price:      params.price      ?? 50,
    comp_price: params.comp_price ?? 50,
    loyalty:    params.loyalty    ?? 8,
    days:       params.days       ?? 7,
  });
  const res = await fetch(apiUrl(`/api/forecast/pricing?${qs}`));
  if (!res.ok) throw new Error("pricing fetch failed");
  return res.json();
}

async function fetchMarket(params = {}) {
  const qs = new URLSearchParams({ store: params.store ?? "АТБ", days: params.days ?? 14 });
  if (params.category) qs.set("category", params.category);
  const res = await fetch(apiUrl(`/api/forecast/market?${qs}`));
  if (!res.ok) throw new Error("market fetch failed");
  return res.json();
}

async function fetchBrandImpact(store, brand) {
  try {
    const qs = new URLSearchParams({ store, brand, days: 14 });
    const res = await fetch(apiUrl(`/api/forecast/brand-impact?${qs}`));
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function fetchTrend(store = "АТБ") {
  try {
    const qs = new URLSearchParams({ store });
    const res = await fetch(apiUrl(`/api/forecast/trend?${qs}`));
    if (!res.ok) return { data: [] };
    return await res.json();
  } catch (err) {
    console.error("Помилка fetchTrend:", err);
    return { data: [] };
  }
}

window._updateBrandAnalysis = async function(storeName, brandName) {
  if (storeName) _brandParams.store = storeName;
  if (brandName) _brandParams.brand = brandName;

  const row2 = document.getElementById("forecast-row-2");
  if (row2) row2.innerHTML = _loadingCard("Аналіз бренду", "Оновлення даних...");

  _brandImpact = await fetchBrandImpact(_brandParams.store, _brandParams.brand);

  if (row2 && _brandImpact) {
    row2.innerHTML = renderBrandImpactChart() + renderBrandImpactStats();
  }
};

window._updateTrendStore = async function(storeName) {
  _marketParams.store = storeName; // Оновлюємо глобальний стан

  const row3 = document.getElementById("forecast-row-3");
  if (row3) row3.innerHTML = _loadingCard("Трафік та Порівняння", `Завантаження даних для ${storeName}...`);

  try {
    // Оновлюємо обидва графіка одночасно, щоб вони були синхронізовані!
    [_trend, _market] = await Promise.all([
      fetchTrend(storeName),
      fetchMarket(_marketParams)
    ]);

    if (row3) row3.innerHTML = renderTrafficTrendChart(_trend?.data) + renderPriceComparison();
  } catch (e) {
    console.error(e);
  }
};
// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _pricing = null;
let _market  = null;
let _trend = null;
let _loading = false;
let _brandImpact = null;

const _brandParams = { store: "АТБ", brand: "Coca-Cola" };
const _pricingParams = { price: 50, comp_price: 50, loyalty: 8, days: 7 };
const _marketParams  = { store: "АТБ", days: 14 };

// ---------------------------------------------------------------------------
// Controls panel
// ---------------------------------------------------------------------------

function renderControls() {
  const p = _pricingParams;
  return `
    <div class="forecast-controls" id="forecast-controls">
      <div class="forecast-controls__header">
        <span class="forecast-controls__title">Симуляція ринку</span>
        <span class="forecast-controls__status" id="forecast-status"></span>
      </div>
      <div class="forecast-controls__grid">

        <div class="forecast-control-group">
          <label for="ctrl-price">
            Ціна товару
            <span class="forecast-control-badge" id="ctrl-price-val">${p.price} ₴</span>
          </label>
          <div class="forecast-control-input-row">
            <input type="range" id="ctrl-price-range" min="10" max="200" step="1" value="${p.price}"
              oninput="document.getElementById('ctrl-price').value=this.value; document.getElementById('ctrl-price-val').textContent=this.value+' ₴'; window._forecastUpdate()" />
            <input type="number" id="ctrl-price" min="10" max="200" step="1" value="${p.price}"
              oninput="document.getElementById('ctrl-price-range').value=this.value; document.getElementById('ctrl-price-val').textContent=this.value+' ₴'; window._forecastUpdate()" />
          </div>
        </div>

        <div class="forecast-control-group">
          <label for="ctrl-comp">
            Ціна конкурента
            <span class="forecast-control-badge" id="ctrl-comp-val">${p.comp_price} ₴</span>
          </label>
          <div class="forecast-control-input-row">
            <input type="range" id="ctrl-comp-range" min="10" max="200" step="1" value="${p.comp_price}"
              oninput="document.getElementById('ctrl-comp').value=this.value; document.getElementById('ctrl-comp-val').textContent=this.value+' ₴'; window._forecastUpdate()" />
            <input type="number" id="ctrl-comp" min="10" max="200" step="1" value="${p.comp_price}"
              oninput="document.getElementById('ctrl-comp-range').value=this.value; document.getElementById('ctrl-comp-val').textContent=this.value+' ₴'; window._forecastUpdate()" />
          </div>
        </div>

        <div class="forecast-control-group">
          <label>
            Лояльність сегмента
            <span class="forecast-control-badge" id="ctrl-loyalty-val">${p.loyalty} / 10</span>
          </label>
          <input type="range" id="ctrl-loyalty" min="1" max="10" step="1" value="${p.loyalty}"
            oninput="document.getElementById('ctrl-loyalty-val').textContent=this.value+' / 10'; window._forecastUpdate()" />
          <div class="forecast-control-ticks"><span>1</span><span>5</span><span>10</span></div>
        </div>

        <div class="forecast-control-group">
          <label>
            Днів з останньої покупки
            <span class="forecast-control-badge" id="ctrl-days-val">${p.days} дн.</span>
          </label>
          <input type="range" id="ctrl-days" min="1" max="30" step="1" value="${p.days}"
            oninput="document.getElementById('ctrl-days-val').textContent=this.value+' дн.'; window._forecastUpdate()" />
          <div class="forecast-control-ticks"><span>1</span><span>15</span><span>30</span></div>
        </div>

      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function renderBrandImpactChart() {
  if (!_brandImpact || !_brandImpact.chartData.length) return _loadingCard("Проникнення бренду", "Немає даних");

  const data = _brandImpact.chartData;
  const W = 720, H = 260, L = 46, R = 40, T = 24, B = 42;
  const plotW = W - L - R, plotH = H - T - B;

  const maxVal = Math.max(...data.map(d => d.totalReceipts), 10) * 1.2;
  const getX = (i) => L + (i / (data.length - 1)) * plotW;
  const getY = (v) => T + ((maxVal - v) / maxVal) * plotH;

  const totalPath = data.map((d, i) => `${i===0?"M":"L"}${getX(i).toFixed(1)} ${getY(d.totalReceipts).toFixed(1)}`).join(" ");
  const brandPath = data.map((d, i) => `${i===0?"M":"L"}${getX(i).toFixed(1)} ${getY(d.withBrand).toFixed(1)}`).join(" ");

  const storeOptions = ["АТБ", "Сільпо", "Novus", "Фора", "Ашан", "Інші магазини"].map(s =>
    `<option value="${s}" ${s === _brandParams.store ? "selected" : ""}>${s}</option>`
  ).join("");

  const brandOptions = ["Coca-Cola", "Яготинське", "Sandora", "Lays", "Власна марка"].map(b =>
    `<option value="${b}" ${b === _brandParams.brand ? "selected" : ""}>${b}</option>`
  ).join("");

  const yTicks = [0, maxVal / 4, (maxVal / 4) * 2, (maxVal / 4) * 3, maxVal];

  return `
    <section class="business-overview-card" aria-labelledby="business-brand-title">
      <div class="business-card-title-row">
        <h2 id="business-brand-title" style="display: flex; align-items: center; gap: 12px; margin: 0;">
          Кошик бренду
          <select onchange="window._updateBrandAnalysis(this.value, null)" style="font-size: 13px; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-weight: 600; outline: none; cursor: pointer;">
            ${storeOptions}
          </select>
          <select onchange="window._updateBrandAnalysis(null, this.value)" style="font-size: 13px; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0; background: #eaf8f0; color: #087a3d; font-weight: 600; outline: none; cursor: pointer;">
            ${brandOptions}
          </select>
        </h2>
      </div>
      
      <div class="business-chart-legend" style="display:flex; gap:20px; margin-bottom: 12px;">
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#94a3b8" stroke-width="3"/></svg> Усі чеки
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#10b981" stroke-width="3"/></svg> Чеки з брендом
        </span>
      </div>

      <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; overflow:visible;">
        <g class="forecast-grid">
          ${yTicks.map(v => `<path d="M${L} ${getY(v).toFixed(0)}H${W-R}" stroke="#f3f4f6"/>`).join("")}
        </g>
        
        <path d="${totalPath}" fill="none" stroke="cbd5e1" stroke-width="3" stroke-linejoin="round"/>
        <path d="${brandPath}" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round" style="stroke: #10b981 !important;" />
        
        <g class="forecast-axis">
          <text x="0" y="14" fill="#10b981" font-weight="600">Чеки, шт</text>
          ${yTicks.map(v => `<text x="${L-8}" y="${(getY(v)+4).toFixed(0)}" text-anchor="end" fill="#6b7280">${v.toFixed(0)}</text>`).join("")}
          <text x="${L}" y="${H-10}" text-anchor="start" fill="#94a3b8">${data[0].date}</text>
          <text x="${W-R}" y="${H-10}" text-anchor="end" fill="#94a3b8">${data[data.length-1].date}</text>
        </g>
      </svg>
    </section>
  `;
}

function renderBrandImpactStats() {
  if (!_brandImpact) return "";
  const kpis = _brandImpact.kpis;
  const diffSign = kpis.checkDiff > 0 ? "+" : "";
  const diffClass = kpis.checkDiff > 0 ? "positive" : (kpis.checkDiff < 0 ? "negative" : "neutral");

  return `
    <section class="business-overview-card business-price-card" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h2 style="font-size: 18px; font-weight: 900; color: var(--sc-text);">Вплив бренду: ${_brandImpact.brand}</h2>
        <div class="business-price-summary-table" style="margin-top: 16px;">
          <div class="highlight">
            <span>Проникнення в чеки</span>
            <strong style="color: var(--sc-green); font-size: 16px;">${kpis.penetration}%</strong>
          </div>
          <div>
            <span>Знайдено чеків з брендом</span>
            <strong>${kpis.totalWith} з ${kpis.totalReceipts}</strong>
          </div>
        </div>
      </div>
      <div style="margin-top: 24px;">
        <h3 style="font-size: 13px; font-weight: 750; color: #64748b; margin-bottom: 12px; text-transform: uppercase;">
          Аналіз середнього чеку
        </h3>
        <div class="business-retailer-table">
          <div class="business-retailer-head" aria-hidden="true">
            <span>Категорія чеків</span><span>Сер. чек</span><span>Вплив бренду</span>
          </div>
          <div class="business-retailer-row">
            <span><i class="retailer-logo" style="background:var(--sc-green);">✓</i> З брендом</span>
            <strong>${kpis.avgCheckWith.toFixed(2)} ₴</strong>
            <em class="${diffClass}" style="font-size: 13px;">${diffSign}${kpis.checkDiff.toFixed(2)} ₴</em>
          </div>
          <div class="business-retailer-row">
            <span><i class="retailer-logo" style="background:#cbd5e1;">✕</i> Без бренду</span>
            <strong>${kpis.avgCheckWithout.toFixed(2)} ₴</strong>
            <em class="neutral">—</em>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTrafficTrendChart(data = []) {
  if (!data || !data.length) return _loadingCard("Прогноз трафіку", "Немає даних");

  const W = 720, H = 260, L = 46, R = 40, T = 24, B = 42;
  const plotW = W - L - R, plotH = H - T - B;

  const counts = data.map(d => d.count);
  const dataMax = Math.max(...counts);

  const maxVal = dataMax > 100 ? Math.ceil(dataMax / 40) * 40 + 40 : 150;

  const getX = (i) => L + (i / (data.length - 1)) * plotW;
  const getY = (v) => T + ((maxVal - v) / maxVal) * plotH;

  const hist = data.filter(d => !d.isPrediction);
  const pred = data.filter(d => d.isPrediction);

  if (hist.length && pred.length) pred.unshift(hist[hist.length - 1]);

  const histPath = hist.map((d, i) => `${i===0?"M":"L"}${getX(data.indexOf(d)).toFixed(1)} ${getY(d.count).toFixed(1)}`).join(" ");
  const predPath = pred.map((d, i) => `${i===0?"M":"L"}${getX(data.indexOf(d)).toFixed(1)} ${getY(d.count).toFixed(1)}`).join(" ");

  const currentStore = _marketParams.store || "АТБ";
  const storeOptions = ["АТБ", "Сільпо", "Novus", "Фора", "Ашан", "Інші магазини"].map(s =>
    `<option value="${s}" ${s === currentStore ? "selected" : ""}>${s}</option>`
  ).join("");

  // Рахуємо кроки для бокової осі (завжди 4 проміжки)
  const yStep = maxVal / 4;
  const yTicks = [0, yStep, yStep * 2, yStep * 3, maxVal];

  return `
    <section class="business-overview-card" aria-labelledby="business-traffic-title">
      <div class="business-card-title-row">
        <h2 id="business-traffic-title" style="display: flex; align-items: center; gap: 12px; margin: 0;">
          Трафік
          <select onchange="window._updateTrendStore(this.value)" style="font-size: 13px; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc; color: #1e293b; font-weight: 600; outline: none; cursor: pointer;">
            ${storeOptions}
          </select>
        </h2>
        <span class="business-info-icon" title="Тренд розраховано за останні 14 днів">${icon("info")}</span>
      </div>
      
      <div class="business-chart-legend" style="display:flex; gap:20px; margin-bottom: 12px;">
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#10b981" stroke-width="3"/></svg> Факт
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#10b981" stroke-width="3" stroke-dasharray="4 4"/></svg> Очікуваний тренд
        </span>
      </div>

      <svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto; overflow:visible;" aria-label="Графік трафіку">
        <g class="forecast-grid">
          ${yTicks.map(v => `<path d="M${L} ${getY(v).toFixed(0)}H${W-R}" stroke="#f3f4f6"/>`).join("")}
        </g>
        
        <path d="${histPath}" fill="none" stroke="#10b981" stroke-width="3" stroke-linejoin="round" />
        <path d="${predPath}" fill="none" stroke="#10b981" stroke-width="3" stroke-dasharray="6 4" stroke-linejoin="round" />
        
        <circle cx="${getX(hist.length-1).toFixed(1)}" cy="${getY(hist[hist.length-1].count).toFixed(1)}" r="4" fill="#10b981" />
        
        <g class="forecast-axis">
          <text x="0" y="14" fill="#10b981" font-weight="600">Чеки, шт</text>
          ${yTicks.map(v => `<text x="${L-8}" y="${(getY(v)+4).toFixed(0)}" text-anchor="end" fill="#6b7280">${v.toFixed(0)}</text>`).join("")}

          <text x="${L}" y="${H-10}" text-anchor="start" fill="#94a3b8">${data[0].date}</text>
          <text x="${getX(hist.length-1)}" y="${H-10}" text-anchor="middle" fill="#059669" font-weight="600">Сьогодні</text>
          <text x="${W-R}" y="${H-10}" text-anchor="end" fill="#94a3b8">${data[data.length-1].date}</text>
        </g>
      </svg>
    </section>
  `;
}

function renderProductDetails() {
  if (!_pricing) return _loadingCard("Деталі товару", "Завантаження...");
  const p = _pricing;

  const optPt = p.revenuePoints.find(pt => pt.price === p.optimalPrice) || p.revenuePoints[0];
  const optProb = optPt.prob || optPt.probability || 0;

  const priceDiff = p.optimalPrice - p.currentPrice;
  const diffSign = priceDiff > 0 ? "+" : "";
  const diffStr = priceDiff !== 0
    ? `<em class="${priceDiff > 0 ? 'positive' : 'negative'}" style="font-size: 12px; margin-left: 8px;">(${diffSign}${priceDiff.toFixed(2)} ₴)</em>`
    : "";

  const compPrice = _pricingParams.comp_price || 50;

  const rows = [
    { label: "Поточна ціна", value: `${p.currentPrice.toFixed(2)} ₴`, extra: "" },
    { label: "Ціна конкурента", value: `${compPrice.toFixed(2)} ₴`, extra: "" },
    { label: "Оптимальна ціна", value: `${p.optimalPrice.toFixed(2)} ₴`, extra: diffStr, highlight: true },
    { label: "Очікуваний дохід", value: `${p.maxRevenue.toFixed(2)} ₴`, extra: "" },
    { label: "Ймовірність покупки", value: `${optProb}%`, extra: "" },
  ];

  const sourceText = p.modelAvailable ? "XGBoost Engine" : "Аналітична апроксимація";

  return `
    <section class="business-overview-card business-price-card" aria-labelledby="business-product-title" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h2 id="business-product-title">Оптимізація ціни</h2>
        
        <div class="business-price-summary-table" style="margin-top: 16px;">
          ${rows.map((row, index) => `
            <div class="${row.highlight ? "highlight" : ""}">
              <span>${row.label}</span>
              <span style="display: flex; align-items: center; justify-content: flex-end;">
                <strong style="${index !== rows.length - 1 ? 'color: var(--sc-text);' : ''}">${row.value}</strong>
                ${row.extra}
              </span>
            </div>
          `).join("")}
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8;">
        <span>Джерело моделі:</span>
        <strong style="color: #64748b; background: #f8fafc; padding: 4px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
          ${sourceText}
        </strong>
      </div>
    </section>
  `;
}

function renderElasticityChart() {
  // Шукаємо дані: вони можуть бути в chartData (від API) або revenuePoints (моки)
  const pts = _pricing.chartData || _pricing.revenuePoints || _pricing.elasticityPoints;
  if (!pts || pts.length === 0) return _loadingCard("Цінова еластичність", "Завантаження...");

  const prices   = pts.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Параметри полотна з другого графіка (трохи розширив правий відступ для другої осі)
  const W = 720, H = 260, L = 46, R = 40, T = 24, B = 42;
  const plotW = W - L - R;
  const plotH = H - T - B;

  const revenues = pts.map((p) => p.revenue || p.actual || 0);
  const minRev   = Math.min(...revenues);
  const maxRev   = Math.max(...revenues);

  // Запобіжник для масштабу осі доходу
  const revPad   = maxRev === minRev ? maxRev * 0.1 || 10 : (maxRev - minRev) * 0.1;
  const revMin   = Math.max(0, minRev - revPad);
  const revMax   = maxRev + revPad;

  const xP = (price) => L + ((price - minPrice) / (maxPrice - minPrice)) * plotW;
  const yR = (rev)   => T + ((revMax - rev) / (revMax - revMin)) * plotH;

  // 🔥 ВИПРАВЛЕННЯ ПОМИЛКИ: безпечно читаємо probability або prob
  const getProb = (p) => p.probability !== undefined ? p.probability : (p.prob || p.demand || 0);
  const yPr = (p)     => T + ((100 - getProb(p)) / 100) * plotH;

  // Генеруємо шляхи (шматок магії SVG)
  const revPath  = pts.map((p,i) => `${i===0?"M":"L"}${xP(p.price).toFixed(1)} ${yR(p.revenue || p.actual).toFixed(1)}`).join(" ");
  const probPath = pts.map((p,i) => `${i===0?"M":"L"}${xP(p.price).toFixed(1)} ${yPr(p).toFixed(1)}`).join(" ");

  // Знаходимо оптимальну точку (Зірку)
  const optPrice = _pricing.optimal ? _pricing.optimal.price : (_pricing.optimalPrice || pts[0].price);
  const optPt = pts.reduce((a,b) => Math.abs(a.price - optPrice) < Math.abs(b.price - optPrice) ? a : b);
  const starX = xP(optPt.price);
  const starY = yR(optPt.revenue || optPt.actual);

  // Функція малювання п'ятикутної зірки
  function starPath(cx, cy, r) {
    const pts5 = [];
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      pts5.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
    }
    return pts5.join(" ");
  }

  // Кроки для осей
  const priceStep = (maxPrice - minPrice) / 6;
  const priceTicks = Array.from({length: 7}, (_,i) => +(minPrice + priceStep*i).toFixed(1));

  const revStep = (revMax - revMin) / 4;
  const revTicks = Array.from({length: 5}, (_,i) => revMin + revStep*i);
  const probTicks = [0, 25, 50, 75, 100];

  return `
    <section class="business-overview-card business-elasticity-card" aria-labelledby="business-elasticity-title">
      <div class="business-card-title-row">
        <h2 id="business-elasticity-title">Крива доходу та Еластичність попиту</h2>
        <span class="business-info-icon" title="Синя лінія — дохід, зелена пунктирна — ймовірність покупки.">${icon("info")}</span>
      </div>
      
      <div class="business-chart-legend business-elasticity-legend" style="display:flex; gap:20px; margin-bottom: 12px;">
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#2563eb" stroke-width="3"/></svg>
           Очікуваний дохід
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="#10b981" stroke-width="2" stroke-dasharray="4 3"/></svg>
           Ймовірність покупки
        </span>
        <span style="display:flex; align-items:center; gap:6px;">
           <svg width="12" height="12" viewBox="-7 -7 14 14"><polygon points="${starPath(0,0,6)}" fill="#ef4444"/></svg>
           Оптимальна ціна
        </span>
      </div>

      <svg class="business-elasticity-chart" viewBox="0 0 ${W} ${H}" style="overflow:visible;">
        <g class="forecast-grid">
          ${probTicks.map((v) => `<path d="M${L} ${yPr({probability: v}).toFixed(0)}H${W-R}" stroke="#f3f4f6"/>`).join("")}
        </g>
        
        <path d="${revPath}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round" />
        <path d="${probPath}" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" />
        
        <polygon points="${starPath(starX, starY, 7)}" fill="#ef4444" />
        
        <g class="forecast-axis">
          <text x="0" y="14" fill="#2563eb" font-weight="600">Дохід, ₴</text>
          ${revTicks.map(v => `<text x="${L-8}" y="${(yR(v)+4).toFixed(0)}" text-anchor="end" fill="#6b7280">${v.toFixed(0)}</text>`).join("")}
          
          <text x="${W-R+6}" y="14" fill="#10b981" font-weight="600">Попит, %</text>
          ${probTicks.map(v => `<text x="${W-R+8}" y="${(yPr({probability: v})+4).toFixed(0)}" text-anchor="start" fill="#6b7280">${v}</text>`).join("")}
          
          ${priceTicks.map(pr => `<text x="${xP(pr).toFixed(0)}" y="${H-10}" text-anchor="middle" fill="#6b7280">${pr}</text>`).join("")}
          <text x="${L + plotW/2}" y="${H+8}" text-anchor="middle" fill="#9ca3af" font-size="11">Тестова ціна, ₴</text>
        </g>
        
        <text class="elasticity-price-label" x="${starX.toFixed(0)}" y="${(starY - 14).toFixed(0)}" text-anchor="middle" fill="#ef4444" font-weight="700">${optPrice.toFixed(2)} ₴</text>
      </svg>
    </section>
  `;
}

function renderPriceComparison() {
  if (!_market) return _loadingCard("Аналіз ринку", "Завантаження...");
  const kpis = _market.kpis;

  // Рахуємо різницю середнього чеку між обраним магазином та усім ринком
  const storeCheck = parseFloat(kpis.avgStoreCheck) || 0;
  const marketCheck = parseFloat(kpis.avgMarketCheck) || 0;
  const diff = storeCheck - marketCheck;
  const diffSign = diff > 0 ? "+" : "";
  const diffHtml = diff !== 0
    ? `<em class="${diff > 0 ? 'positive' : 'negative'}">${diffSign}${diff.toFixed(2)} ₴</em>`
    : `<em class="neutral">0.00 ₴</em>`;

  // Формуємо рядки для верхньої таблиці, спираючись на дані про трафік
  const rows = [
    { label: "Частка ринку (за чеками)", value: kpis.marketShare, highlight: true },
    { label: `Трафік ${_market.focusStore}`, value: `${kpis.totalStoreReceipts} шт`, highlight: false },
    { label: "Трафік всього ринку", value: `${kpis.totalMarketReceipts} шт`, highlight: false },
  ];

  return `
    <section class="business-overview-card business-price-card" aria-labelledby="business-market-title" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <h2 id="business-market-title">Аналіз ринку: ${_market.focusStore}</h2>
        
        <div class="business-price-summary-table" style="margin-top: 16px;">
          ${rows.map((row, index) => `
            <div class="${row.highlight ? "highlight" : ""}">
              <span>${row.label}</span>
              <span style="display: flex; align-items: center; justify-content: flex-end;">
                <strong style="${index !== 0 ? 'color: var(--sc-text);' : 'color: var(--sc-green);'}">${row.value}</strong>
              </span>
            </div>
          `).join("")}
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h3 style="font-size: 13px; font-weight: 750; color: #64748b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
          Порівняння середнього чеку
        </h3>
        <div class="business-retailer-table">
          <div class="business-retailer-head" aria-hidden="true">
            <span>Суб'єкт</span><span>Сер. чек</span><span>Різниця</span>
          </div>
          <div class="business-retailer-row">
            <span><i class="retailer-logo">${_market.focusStore[0]}</i> ${_market.focusStore}</span>
            <strong>${kpis.avgStoreCheck}</strong>
            ${diffHtml}
          </div>
          <div class="business-retailer-row">
            <span><i class="retailer-logo" style="background:#64748b;">∑</i> Весь ринок</span>
            <strong>${kpis.avgMarketCheck}</strong>
            <em class="neutral">—</em>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildKpis() {
  if (!_pricing || !_market || !_brandImpact) return [];

  const b = _brandImpact.kpis;
  const m = _market.kpis;

  // Рахуємо приріст чеку у відсотках для дельти
  const checkLiftPct = ((b.avgCheckWith - b.avgCheckWithout) / b.avgCheckWithout * 100).toFixed(1);

  return [
    {
      label: "Потенціал доходу",
      value: `${_pricing.maxRevenue.toFixed(2)} ₴`,
      delta: "при оптимальній ціні",
      icon: "analytics"
    },
    {
      label: "Проникнення бренду",
      value: `${b.penetration}%`,
      delta: `у кожному ${Math.round(100/b.penetration)} чеку`,
      icon: "target"
    },
    {
      label: "Вплив на чек",
      value: `${b.checkDiff > 0 ? "+" : ""}${b.checkDiff.toFixed(2)} ₴`,
      delta: `${checkLiftPct >= 0 ? "+" : ""}${checkLiftPct}% до чеку`,
      icon: "wallet"
    },
    {
      label: "Частка ринку (магазин)",
      value: m.marketShare,
      delta: `всього ${m.totalStoreReceipts} чеків`,
      icon: "basket"
    },
  ];
}
// ---------------------------------------------------------------------------
// Debounced refresh
// ---------------------------------------------------------------------------

let _debounceTimer = null;

function _scheduleRefresh() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(_doRefresh, 400);
}

async function _doRefresh() {
  if (_loading) return;
  _loading = true;

  const statusEl = document.getElementById("forecast-status");
  if (statusEl) { statusEl.textContent = "Оновлення..."; statusEl.style.opacity = "1"; }

  _pricingParams.price      = parseFloat(document.getElementById("ctrl-price")?.value   ?? 50);
  _pricingParams.comp_price = parseFloat(document.getElementById("ctrl-comp")?.value    ?? 50);
  _pricingParams.loyalty    = parseInt(document.getElementById("ctrl-loyalty")?.value   ?? 8);
  _pricingParams.days       = parseInt(document.getElementById("ctrl-days")?.value      ?? 7);

  try {
    _pricing = await fetchPricing(_pricingParams);
  } catch (e) {
    console.error("[forecast] refresh error:", e);
    if (statusEl) statusEl.textContent = "Помилка оновлення";
    _loading = false;
    return;
  }

  const kpisWrap = document.getElementById("forecast-kpis");
  if (kpisWrap) kpisWrap.innerHTML = renderBusinessKpiCards(buildKpis(), "Ключові показники прогнозу та еластичності");

  const row1 = document.getElementById("forecast-row-1");
  if (row1) row1.innerHTML = renderElasticityChart() + renderProductDetails();

  const row2 = document.getElementById("forecast-row-2");
  if (row2) row2.innerHTML = renderBrandImpactChart() + renderBrandImpactStats();

  const row3 = document.getElementById("forecast-row-3");
  if (row3) row3.innerHTML = renderTrafficTrendChart(_trend?.data) + renderPriceComparison();

  if (statusEl) { statusEl.textContent = ""; statusEl.style.opacity = "0"; }
  _loading = false;
}

window._forecastUpdate = _scheduleRefresh;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _loadingCard(title, msg) {
  return `
    <section class="business-overview-card" style="display:flex;align-items:center;justify-content:center;min-height:200px;">
      <div style="text-align:center;color:#94a3b8;font-size:13px;">${title}: ${msg}</div>
    </section>`;
}

function _addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderBusinessForecastPage() {
  return renderBusinessPageShell({
    activeKey:    "forecast",
    title:        "Прогноз та еластичність",
    filters:      [],
    status:       { updatedAt: new Date().toISOString() },
    updatedLabel: "Оновлено",
    children: `
      <div id="forecast-kpis"></div>
      ${renderControls()}
      <div class="business-forecast-row" id="forecast-row-1">
        ${_loadingCard("Прогноз попиту", "Завантаження...")}
        ${_loadingCard("Деталі ціноутворення", "Завантаження...")}
      </div>
      <div class="business-forecast-row" id="forecast-row-2">
        ${_loadingCard("Цінова еластичність", "Завантаження...")}
        ${_loadingCard("Порівняння", "Завантаження...")}
      </div>
      <div class="business-forecast-row" id="forecast-row-3">
        ${_loadingCard("Кошик бренду", "Завантаження...")}
        ${_loadingCard("Аналітика кошика", "Завантаження...")}
      </div>
      <div id="forecast-strip" style="margin-top: 24px;"></div>
    `,
  });
}

export async function bindBusinessForecastPage() {
  bindBusinessMockLinks();

  try {
    [_pricing, _market, _trend, _brandImpact] = await Promise.all([
      fetchPricing(_pricingParams),
      fetchMarket(_marketParams),
      fetchTrend(_marketParams.store),
      fetchBrandImpact(_brandParams.store, _brandParams.brand)
    ]);
  } catch (err) {
    console.error("[forecast] API error:", err);
    return;
  }

  const kpisWrap = document.getElementById("forecast-kpis");
  if (kpisWrap) kpisWrap.innerHTML = renderBusinessKpiCards(buildKpis(), "Ключові показники прогнозу та еластичності");

  const row1 = document.getElementById("forecast-row-1");
  if (row1) row1.innerHTML = renderElasticityChart() + renderProductDetails();

  const row2 = document.getElementById("forecast-row-2");
  if (row2) row2.innerHTML = renderBrandImpactChart() + renderBrandImpactStats();

  const row3 = document.getElementById("forecast-row-3");
  if (row3) row3.innerHTML = renderTrafficTrendChart(_trend?.data) + renderPriceComparison();

}
