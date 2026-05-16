from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from sqlalchemy import delete, func, select

from app.categories import normalize_category
from app.db.database import AsyncSessionLocal
from app.db.models import Product, Receipt, ReceiptItem, Store


IMPORT_MARKER = "SMARTCART_PUBLIC_RECEIPTS_IMPORT_V1"
DEFAULT_SOURCE = "/home/noname/Apps/smartcart_ref/generated_receipts_300.json"


def money(value: Any, default: str = "0") -> Decimal:
    if value is None:
        value = default
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def quantity(value: Any) -> Decimal:
    if value is None:
        value = "1"
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def parse_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.utcnow()
    return datetime.fromisoformat(value)


def store_visual(store_name: str | None) -> tuple[str, str]:
    value = (store_name or "Магазин").lower()
    if "сільпо" in value or "silpo" in value:
        return "silpo", "Сільпо"
    if "атб" in value or "atb" in value:
        return "atb", "АТБ"
    if "фора" in value or "fora" in value:
        return "fora", "Фора"
    if "novus" in value:
        return "novus", "Novus"
    if "ашан" in value or "auchan" in value:
        return "auchan", "Ашан"
    if "варус" in value or "varus" in value:
        return "default", "Varus"
    if "еко" in value or "eko" in value:
        return "default", "Еко маркет"
    return "default", (store_name or "Магазин")[:8]


async def upsert_store(db, store_name: str | None) -> Store | None:
    if not store_name:
        return None

    result = await db.execute(select(Store).where(func.lower(Store.name) == store_name.lower()))
    store = result.scalar_one_or_none()
    logo, logo_text = store_visual(store_name)
    if store is None:
        store = Store(name=store_name, logo=logo, logo_text=logo_text)
        db.add(store)
        await db.flush()
        return store

    store.logo = store.logo or logo
    store.logo_text = store.logo_text or logo_text
    return store


async def upsert_product(db, item: dict[str, Any]) -> Product:
    name = str(item["item_name"]).strip()
    category = normalize_category(
        item.get("category"),
        raw_name=item.get("raw_name"),
        item_name=name,
    )
    brand = item.get("brand")
    thumbnail = item.get("thumbnail") or category.icon
    has_cashback = (
        money(item.get("store_cashback_amount")) > 0
        or money(item.get("store_cashback_percent")) > 0
        or money(item.get("smartcart_cashback_amount")) > 0
    )

    result = await db.execute(select(Product).where(func.lower(Product.name) == name.lower()))
    product = result.scalar_one_or_none()
    if product is None:
        product = Product(
            name=name,
            description=brand or category.name or "Товар з чеків",
            category=category.name,
            brand=brand,
            unit=item.get("unit") or "шт",
            thumbnail=thumbnail,
            is_tracked=True,
            has_cashback=has_cashback,
        )
        db.add(product)
        await db.flush()
        return product

    product.description = product.description or brand or category.name or "Товар з чеків"
    product.category = product.category or category.name
    product.brand = product.brand or brand
    product.unit = product.unit or item.get("unit") or "шт"
    product.thumbnail = product.thumbnail or thumbnail
    product.has_cashback = bool(product.has_cashback or has_cashback)
    return product


async def clear_previous_import(db) -> int:
    result = await db.execute(
        select(Receipt.id).where(Receipt.ocr_raw_text.like(f"{IMPORT_MARKER}%"))
    )
    receipt_ids = [row[0] for row in result.all()]
    if not receipt_ids:
        return 0

    await db.execute(delete(ReceiptItem).where(ReceiptItem.receipt_id.in_(receipt_ids)))
    await db.execute(delete(Receipt).where(Receipt.id.in_(receipt_ids)))
    await db.flush()
    return len(receipt_ids)


async def import_receipts(path: Path) -> dict[str, int]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("Expected top-level JSON array with receipts")

    async with AsyncSessionLocal() as db:
        removed = await clear_previous_import(db)
        receipts_count = 0
        items_count = 0
        products_seen: set[str] = set()
        stores_seen: set[str] = set()

        for index, receipt_payload in enumerate(payload, start=1):
            store_name = receipt_payload.get("store")
            if store_name:
                stores_seen.add(store_name)
            await upsert_store(db, store_name)

            items = receipt_payload.get("items") or []
            total_discount = sum((money(item.get("discount_amount")) for item in items), Decimal("0"))
            store_cashback_total = sum(
                (money(item.get("store_cashback_amount")) for item in items),
                Decimal("0"),
            )
            smartcart_cashback_total = sum(
                (money(item.get("smartcart_cashback_amount")) for item in items),
                Decimal("0"),
            )
            total = sum(
                (
                    max(
                        Decimal("0"),
                        money(item.get("price")) * quantity(item.get("quantity"))
                        - money(item.get("discount_amount")),
                    )
                    for item in items
                ),
                Decimal("0"),
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            receipt_datetime = parse_datetime(receipt_payload.get("receipt_datetime"))
            receipt = Receipt(
                user_id=None,
                store=store_name,
                receipt_datetime=receipt_datetime,
                total=total,
                currency=receipt_payload.get("currency") or "UAH",
                total_discount=total_discount,
                store_cashback_total=store_cashback_total,
                smartcart_cashback_total=smartcart_cashback_total,
                image_url=receipt_payload.get("image_url"),
                ocr_raw_text=(
                    f"{IMPORT_MARKER}:"
                    f"{path.name}:"
                    f"{index}:"
                    f"{store_name or 'unknown'}:"
                    f"{receipt_datetime.isoformat()}"
                ),
                processing_status="processed",
            )
            db.add(receipt)
            await db.flush()

            receipt_items = []
            for item in items:
                product = await upsert_product(db, item)
                products_seen.add(product.name)
                category = normalize_category(
                    item.get("category"),
                    raw_name=item.get("raw_name"),
                    item_name=item.get("item_name"),
                    product_category=product.category,
                )
                receipt_items.append(
                    ReceiptItem(
                        receipt_id=receipt.id,
                        product_id=product.id,
                        raw_name=item.get("raw_name"),
                        item_name=item.get("item_name"),
                        price=money(item.get("price")),
                        quantity=quantity(item.get("quantity")),
                        unit=item.get("unit") or "шт",
                        discount_amount=money(item.get("discount_amount")),
                        store_cashback_amount=money(item.get("store_cashback_amount")),
                        store_cashback_percent=money(item.get("store_cashback_percent")),
                        smartcart_cashback_amount=money(item.get("smartcart_cashback_amount")),
                        category=category.name,
                        brand=item.get("brand"),
                        thumbnail=item.get("thumbnail") or product.thumbnail,
                        is_promotional=bool(item.get("is_promotional")),
                        match_confidence=Decimal("1"),
                        match_status="public_import",
                    )
                )

            db.add_all(receipt_items)
            receipts_count += 1
            items_count += len(receipt_items)

        await db.commit()

    return {
        "removed_previous_receipts": removed,
        "inserted_receipts": receipts_count,
        "inserted_items": items_count,
        "stores": len(stores_seen),
        "products": len(products_seen),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import public receipt observations into SmartCart DB.")
    parser.add_argument("path", nargs="?", default=DEFAULT_SOURCE)
    args = parser.parse_args()

    summary = asyncio.run(import_receipts(Path(args.path)))
    for key, value in summary.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
