import numpy as np
from datetime import date, timedelta
from typing import Optional


def generate_mock_market(days: int, category: Optional[str] = None):
    """Генерує випадкові дані про ринок, якщо база порожня."""
    np.random.seed(42)
    today = date.today()
    dates = [today - timedelta(days=days - i) for i in range(days)]

    stores = ["АТБ", "Сільпо", "Novus", "Фора", "Ашан", "Інші магазини"]
    categories = ["Напої", "Снеки", "Молочка"] if not category else [category]
    brands = ["Coca-Cola", "Яготинське", "Sandora", "Lays", "Власна марка", "Інше"]

    data = []
    for i in range(min(days * 150, 2000)):
        d = np.random.choice(dates)
        store = np.random.choice(stores, p=[0.35, 0.25, 0.15, 0.10, 0.05, 0.10])
        cat = np.random.choice(categories)
        brand = np.random.choice(brands)

        base = 100 if store != "Ашан" else 250
        modifier = 1.3 if brand in ["Coca-Cola", "Яготинське"] else 1.0
        total = float(np.random.uniform(base * 0.5, base * 1.5)) * modifier

        data.append({
            "date": d,
            "store": store,
            "category": cat,
            "brand": brand,
            "receipt_total": total,
            "receipt_id": f"mock_{i}"
        })
    return data