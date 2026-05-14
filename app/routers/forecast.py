"""
Forecast router — provides pricing optimisation and market comparison data
for the frontend /forecast page (forecast.js).

Endpoints
---------
GET /api/forecast/pricing
    XGBoost-based demand elasticity and optimal price calculation.

GET /api/forecast/market
    Store-vs-market receipt comparison from real DB data (with mock fallback).
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import Optional
from collections import defaultdict

import pandas as pd
import numpy as np
import joblib
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Receipt, ReceiptItem
from app.utils.mock_data import generate_mock_market
router = APIRouter(prefix="/forecast", tags=["forecast"])


_model = None
_MODEL_PATH=Path(os.getenv("XGB_MODEL_PATH", "analytics/xgb_pricing_model.pkl")).resolve()

def _load_model():
    global _model
    if _model is None:
        try:
            print(f"🔄 Пробуем загрузить модель по пути: {_MODEL_PATH}")
            _model = joblib.load(_MODEL_PATH)
            print("✅ Модель XGBoost успешно загружена!")
        except Exception as e:
            print(f"❌ Ошибка загрузки ML-модели: {type(e).__name__} - {e}")
            _model = None
    return _model


@router.get("/pricing")
def forecast_pricing(
        price: float = Query(50.0, description="Поточна ціна, грн"),
        comp_price: float = Query(50.0, description="Ціна конкурента, грн"),
        loyalty: int = Query(8, ge=1, le=10, description="Лояльність сегмента 1-10"),
        days: int = Query(7, ge=1, le=90, description="Днів з останньої покупки"),
):
    """
    Returns demand-elasticity curve data + optimal price point.
    If the XGBoost model is unavailable the endpoint falls back to an
    analytical sigmoid approximation so the frontend always gets a valid response.
    """

    model = _load_model()
    test_prices = np.linspace(price * 0.8, price * 1.3, 30)
    elasticity_points = []
    revenue_points = []

    for p in test_prices:
        rpi = p / comp_price
        price_gap = p - comp_price

        if model is not None:
            try:
                features = pd.DataFrame([{
                    "our_price": p,
                    "competitor_price": comp_price,
                    "rpi": rpi,
                    "price_gap": price_gap,
                    "days_since_last_purchase": days,
                    "user_loyalty": loyalty,
                }])
                prob_buy = float(model.predict_proba(features)[0][1])
            except Exception:
                prob_buy = _analytical_prob(rpi, loyalty, days)
        else:
            prob_buy = _analytical_prob(rpi, loyalty, days)

        if rpi > 1.4:
            prob_buy = prob_buy * (1.4 / rpi) ** 5

        prob_buy = float(np.clip(prob_buy, 0.0, 1.0))
        revenue = p * prob_buy

        elasticity_points.append({"price": round(p, 2), "demand": round(prob_buy * 100, 1)})
        revenue_points.append({"price": round(p, 2), "revenue": round(revenue, 2), "prob": round(prob_buy * 100, 1)})

    optimal = max(revenue_points, key=lambda r: r["revenue"])

    max_rev = optimal["revenue"]
    band = [r for r in revenue_points if r["revenue"] >= max_rev * 0.95]
    band_low = min(r["price"] for r in band)
    band_high = max(r["price"] for r in band)

    current_prob = next((r["prob"] for r in revenue_points if
                         abs(r["price"] - price) == min(abs(r["price"] - price) for r in revenue_points)), None)
    current_revenue = next((r["revenue"] for r in revenue_points if
                            abs(r["price"] - price) == min(abs(r["price"] - price) for r in revenue_points)), None)

    demand_change_pct = round(
        ((optimal["prob"] - (current_prob or optimal["prob"])) / max((current_prob or 1), 1)) * 100, 1)

    return {
        "elasticityPoints": elasticity_points,
        "revenuePoints": revenue_points,
        "optimalPrice": optimal["price"],
        "optimalBand": {"low": round(band_low, 2), "high": round(band_high, 2)},
        "currentPrice": round(price, 2),
        "currentRevenue": round(current_revenue or 0, 2),
        "maxRevenue": round(max_rev, 2),
        "expectedDemandChange": f"{'+' if demand_change_pct >= 0 else ''}{demand_change_pct}%",
        "modelAvailable": model is not None,
    }


def _analytical_prob(rpi: float, loyalty: int, days: int) -> float:
    """Sigmoid fallback that mirrors the training data generation logic."""
    risk = (rpi - 1.0) * 12.0 - (loyalty - 5) * 0.8 + (days - 14) * 0.05
    return float(1 / (1 + np.exp(risk)))


@router.get("/market")
async def forecast_market(
        store: Optional[str] = Query("АТБ", description="Магазин для фокусу"),
        category: Optional[str] = Query(None, description="Фільтр категорії"),
        days: int = Query(14, ge=1, le=90, description="Кількість днів для аналізу"),
        db: AsyncSession = Depends(get_db),
):
    """
    Returns daily receipt count and average check for the selected store vs
    the whole market. Falls back to mock data when the DB is empty.
    """
    rows = await _load_market_rows(db, days, category)

    if not rows:
        rows = generate_mock_market(days, category)
        is_mock = True
    else:
        is_mock = False

    result = _aggregate_market(rows, store, days)
    result["isMock"] = is_mock
    return result


async def _load_market_rows(db: AsyncSession, days: int, category: Optional[str]):
    """Завантаження реальних даних з БД."""
    try:
        since = date.today() - timedelta(days=days)
        stmt = (
            select(
                func.date(Receipt.receipt_datetime).label("date"),
                Receipt.store.label("store"),
                ReceiptItem.category.label("category"),
                ReceiptItem.brand.label("brand"),
                Receipt.total.label("receipt_total"),
                Receipt.id.label("receipt_id"),
            )
            .join(ReceiptItem, Receipt.id == ReceiptItem.receipt_id)
            .where(Receipt.receipt_datetime >= since)
        )
        if category:
            stmt = stmt.where(ReceiptItem.category == category)

        result = await db.execute(stmt)
        return [dict(r._mapping) for r in result.all()]
    except Exception as e:
        print(f"⚠️ Помилка доступу до БД: {e}")
        return []

def _aggregate_market(rows: list[dict], focus_store: str, days: int) -> dict:
    from collections import defaultdict

    market_by_date: dict[date, dict] = defaultdict(lambda: {"ids": set(), "totals": []})
    store_by_date: dict[date, dict] = defaultdict(lambda: {"ids": set(), "totals": []})

    for row in rows:
        d = row["date"] if isinstance(row["date"], date) else row["date"]
        rid = row["receipt_id"]
        total = float(row["receipt_total"] or 0)

        market_by_date[d]["ids"].add(rid)
        market_by_date[d]["totals"].append(total)

        if row["store"] == focus_store:
            store_by_date[d]["ids"].add(rid)
            store_by_date[d]["totals"].append(total)

    all_dates = sorted(market_by_date.keys())
    daily_data = []
    for d in all_dates:
        m = market_by_date[d]
        s = store_by_date.get(d, {"ids": set(), "totals": []})
        market_receipts = len(m["ids"])
        store_receipts = len(s["ids"])
        daily_data.append({
            "date": str(d),
            "marketReceipts": market_receipts,
            "storeReceipts": store_receipts,
            "otherReceipts": market_receipts - store_receipts,
            "avgMarketCheck": round(sum(m["totals"]) / len(m["totals"]), 2) if m["totals"] else 0,
            "avgStoreCheck": round(sum(s["totals"]) / len(s["totals"]), 2) if s["totals"] else 0,
        })

    total_market = sum(d["marketReceipts"] for d in daily_data)
    total_store = sum(d["storeReceipts"] for d in daily_data)
    share = round(total_store / total_market * 100, 1) if total_market else 0

    all_store_checks = [row["receipt_total"] for row in rows if row["store"] == focus_store and row["receipt_total"]]
    all_market_checks = [row["receipt_total"] for row in rows if row["receipt_total"]]

    avg_store = round(sum(float(x) for x in all_store_checks) / len(all_store_checks), 2) if all_store_checks else 0
    avg_market = round(sum(float(x) for x in all_market_checks) / len(all_market_checks), 2) if all_market_checks else 0

    return {
        "focusStore": focus_store,
        "dailyData": daily_data,
        "kpis": {
            "totalMarketReceipts": total_market,
            "totalStoreReceipts": total_store,
            "marketShare": f"{share}%",
            "avgStoreCheck": f"{avg_store:.2f} ₴",
            "avgMarketCheck": f"{avg_market:.2f} ₴",
        },
    }


@router.get("/trend")
async def forecast_trend(
        store: Optional[str] = Query(None, description="Магазин для фокусу"),
        days_history: int = Query(14, description="Днів історії"),
        days_forecast: int = Query(7, description="Днів прогнозу"),
        db: AsyncSession = Depends(get_db),
):

    rows = await _load_market_rows(db, days_history, None)

    if store:
        rows = [r for r in rows if r["store"] and store.lower() in r["store"].lower()]

    daily_counts = defaultdict(int)
    for r in rows:
        d = r["date"] if isinstance(r["date"], date) else date.fromisoformat(str(r["date"]))
        daily_counts[d] += 1

    if len(daily_counts) < 3:
        daily_counts.clear()
        seed_val = sum(ord(c) for c in (store or "default"))
        rng = np.random.default_rng(seed_val)

        base_date = date.today() - timedelta(days=days_history)

        base_traffic = 45 + (seed_val % 30)

        for i in range(days_history):
            fake_date = base_date + timedelta(days=i)
            daily_counts[fake_date] = max(5, int(rng.normal(base_traffic, 12)))

    sorted_dates = sorted(daily_counts.keys())
    if not sorted_dates:
        return {"data": []}

    y_hist = [daily_counts[d] for d in sorted_dates]
    x_hist = np.arange(len(y_hist))

    if len(y_hist) > 1:
        z = np.polyfit(x_hist, y_hist, 1)
        trend_model = np.poly1d(z)
    else:
        trend_model = lambda x: y_hist[0] if y_hist else 0

    chart_data = []

    for i, d in enumerate(sorted_dates):
        chart_data.append({
            "date": d.strftime("%d.%m"),
            "count": y_hist[i],
            "isPrediction": False
        })

    last_date = sorted_dates[-1]

    rng_pred = np.random.default_rng(sum(ord(c) for c in (store or "default")) + 1)

    for i in range(1, days_forecast + 1):
        next_date = last_date + timedelta(days=i)
        pred = max(0, int(trend_model(len(y_hist) - 1 + i) + rng_pred.normal(0, 3)))
        chart_data.append({
            "date": next_date.strftime("%d.%m"),
            "count": pred,
            "isPrediction": True
        })

    return {"data": chart_data}

@router.get("/brand-impact")
async def forecast_brand_impact(
        store: str = Query("АТБ", description="Магазин"),
        brand: str = Query("Coca-Cola", description="Бренд"),
        days: int = Query(14, description="Днів історії"),
        db: AsyncSession = Depends(get_db),
):
    from collections import defaultdict
    rows = await _load_market_rows(db, days, None)
    if not rows:
        rows = generate_mock_market(days, None)

    store_rows = [r for r in rows if r["store"] and store.lower() in r["store"].lower()]

    receipts = defaultdict(list)
    for r in store_rows:
        receipts[r["receipt_id"]].append(r)

    daily_stats = defaultdict(lambda: {"with_brand": 0, "total": 0})
    total_with, total_without = 0, 0
    sum_with, sum_without = 0.0, 0.0

    for rid, items in receipts.items():
        d_val = items[0]["date"]
        date_str = d_val.strftime("%d.%m") if isinstance(d_val, date) else str(d_val)[-5:].replace("-", ".")
        r_total = float(items[0]["receipt_total"] or 0)

        has_brand = any(brand.lower() in str(i.get("brand") or "").lower() for i in items)

        daily_stats[date_str]["total"] += 1
        if has_brand:
            daily_stats[date_str]["with_brand"] += 1
            total_with += 1
            sum_with += r_total
        else:
            total_without += 1
            sum_without += r_total

    sorted_dates = sorted(daily_stats.keys())
    chart_data = [{"date": d, "withBrand": daily_stats[d]["with_brand"], "totalReceipts": daily_stats[d]["total"]} for d in sorted_dates]

    avg_with = sum_with / total_with if total_with > 0 else 0
    avg_without = sum_without / total_without if total_without > 0 else 0
    penetration = (total_with / (total_with + total_without) * 100) if (total_with + total_without) > 0 else 0

    return {
        "store": store,
        "brand": brand,
        "chartData": chart_data,
        "kpis": {
            "totalWith": total_with,
            "totalReceipts": total_with + total_without,
            "penetration": round(penetration, 1),
            "avgCheckWith": round(avg_with, 2),
            "avgCheckWithout": round(avg_without, 2),
            "checkDiff": round(avg_with - avg_without, 2)
        }
    }