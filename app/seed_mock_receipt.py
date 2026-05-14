from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import delete, select

from app.categories import normalize_category
from app.db.database import AsyncSessionLocal
from app.db.models import Product, Receipt, ReceiptItem, Store, User


MOCK_MARKER = "SMARTCART_DEMO_RECEIPT_V1"
MOCK_USER_TELEGRAM_ID = 990000001


@dataclass(frozen=True)
class SeedItem:
    raw_name: str
    item_name: str
    price: Decimal
    quantity: Decimal
    unit: str
    discount_amount: Decimal
    store_cashback_amount: Decimal
    store_cashback_percent: Decimal
    smartcart_cashback_amount: Decimal
    category: str
    brand: str | None
    thumbnail: str
    is_promotional: bool = False


MOCK_RECEIPT_ITEMS: list[SeedItem] = [
    SeedItem(
        raw_name="МОЛОКО ГАЛИЧИНА 2.5% 900МЛ",
        item_name="Молоко Галичина 2.5% 900 мл",
        price=Decimal("26.90"),
        quantity=Decimal("2"),
        unit="шт",
        discount_amount=Decimal("4.00"),
        store_cashback_amount=Decimal("0.54"),
        store_cashback_percent=Decimal("1.00"),
        smartcart_cashback_amount=Decimal("1.35"),
        category="Молочні",
        brand="Галичина",
        thumbnail="milk",
        is_promotional=True,
    ),
    SeedItem(
        raw_name="ЙОГУРТ ГРЕЦЬКИЙ 150Г ГАЛИЧИНА",
        item_name="Йогурт грецький 150 г",
        price=Decimal("31.90"),
        quantity=Decimal("1"),
        unit="шт",
        discount_amount=Decimal("0.00"),
        store_cashback_amount=Decimal("0.64"),
        store_cashback_percent=Decimal("2.00"),
        smartcart_cashback_amount=Decimal("0.80"),
        category="Молочні",
        brand="Галичина",
        thumbnail="yogurt",
    ),
    SeedItem(
        raw_name="ЯЙЦЯ КУРЯЧІ С0 10ШТ ЯСЕНСВІТ",
        item_name="Яйця курячі С0 10 шт",
        price=Decimal("63.90"),
        quantity=Decimal("1"),
        unit="шт",
        discount_amount=Decimal("3.90"),
        store_cashback_amount=Decimal("0.00"),
        store_cashback_percent=Decimal("0.00"),
        smartcart_cashback_amount=Decimal("0.00"),
        category="Бакалія",
        brand="Ясенсвіт",
        thumbnail="eggs",
        is_promotional=True,
    ),
    SeedItem(
        raw_name="КАВА JACOBS MONARCH МЕЛЕНА 230Г",
        item_name="Кава мелена Jacobs Monarch 230 г",
        price=Decimal("118.00"),
        quantity=Decimal("1"),
        unit="шт",
        discount_amount=Decimal("12.00"),
        store_cashback_amount=Decimal("2.36"),
        store_cashback_percent=Decimal("2.00"),
        smartcart_cashback_amount=Decimal("4.72"),
        category="Напої",
        brand="Jacobs",
        thumbnail="coffee",
        is_promotional=True,
    ),
    SeedItem(
        raw_name="БАНАНИ ВАГОВІ",
        item_name="Банани",
        price=Decimal("59.90"),
        quantity=Decimal("1.12"),
        unit="кг",
        discount_amount=Decimal("0.00"),
        store_cashback_amount=Decimal("0.00"),
        store_cashback_percent=Decimal("0.00"),
        smartcart_cashback_amount=Decimal("0.00"),
        category="Фрукти",
        brand=None,
        thumbnail="banana",
    ),
    SeedItem(
        raw_name="СИР ТВЕРДИЙ КЛАСИЧНИЙ 45%",
        item_name="Сир твердий класичний 45%",
        price=Decimal("289.90"),
        quantity=Decimal("0.48"),
        unit="кг",
        discount_amount=Decimal("8.25"),
        store_cashback_amount=Decimal("0.00"),
        store_cashback_percent=Decimal("0.00"),
        smartcart_cashback_amount=Decimal("2.80"),
        category="Молочні",
        brand=None,
        thumbnail="cheese",
        is_promotional=True,
    ),
    SeedItem(
        raw_name="ХЛІБ ТОСТОВИЙ НАРІЗАНИЙ 450Г",
        item_name="Хліб тостовий нарізний 450 г",
        price=Decimal("34.90"),
        quantity=Decimal("1"),
        unit="шт",
        discount_amount=Decimal("0.00"),
        store_cashback_amount=Decimal("0.00"),
        store_cashback_percent=Decimal("0.00"),
        smartcart_cashback_amount=Decimal("0.00"),
        category="Бакалія",
        brand=None,
        thumbnail="jar",
    ),
    SeedItem(
        raw_name="ВОДА МОРШИНСЬКА Н/Г 1.5Л",
        item_name="Вода негазована 1.5 л",
        price=Decimal("21.90"),
        quantity=Decimal("2"),
        unit="шт",
        discount_amount=Decimal("0.00"),
        store_cashback_amount=Decimal("0.88"),
        store_cashback_percent=Decimal("2.00"),
        smartcart_cashback_amount=Decimal("0.00"),
        category="Напої",
        brand="Моршинська",
        thumbnail="bottle",
    ),
    SeedItem(
        raw_name="ПАСТА ЗУБНА COLGATE MAX BLAST 100МЛ",
        item_name="Паста зубна Colgate Max Blast 100 мл",
        price=Decimal("49.90"),
        quantity=Decimal("1"),
        unit="шт",
        discount_amount=Decimal("5.00"),
        store_cashback_amount=Decimal("0.00"),
        store_cashback_percent=Decimal("0.00"),
        smartcart_cashback_amount=Decimal("0.00"),
        category="Бакалія",
        brand="Colgate",
        thumbnail="jar",
        is_promotional=True,
    ),
    SeedItem(
        raw_name="МАКАРОНИ BARILLA PENNE RIGATE 500Г",
        item_name="Макарони Barilla Penne Rigate 500 г",
        price=Decimal("52.90"),
        quantity=Decimal("2"),
        unit="шт",
        discount_amount=Decimal("0.00"),
        store_cashback_amount=Decimal("0.00"),
        store_cashback_percent=Decimal("0.00"),
        smartcart_cashback_amount=Decimal("1.20"),
        category="Бакалія",
        brand="Barilla",
        thumbnail="jar",
    ),
]

MOCK_RECEIPT_DATETIME = datetime(2026, 5, 13, 19, 48)
MOCK_STORE_NAME = "Сільпо"
MOCK_USERNAME = "demo.receipt"


def store_visual(store_name: str) -> tuple[str, str]:
    normalized = store_name.lower()
    if "сільпо" in normalized or "silpo" in normalized:
        return "silpo", "Сільпо"
    if "атб" in normalized or "atb" in normalized:
        return "atb", "АТБ"
    if "novus" in normalized:
        return "novus", "NOVUS"
    if "ашан" in normalized or "auchan" in normalized:
        return "auchan", "Ашан"
    return "default", store_name[:8]


def quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def calculate_gross_total(item: SeedItem) -> Decimal:
    return quantize_money(item.price * item.quantity)


def calculate_net_total(item: SeedItem) -> Decimal:
    return quantize_money(calculate_gross_total(item) - item.discount_amount)


def build_ocr_text() -> str:
    lines = [
        MOCK_MARKER,
        "СІЛЬПО",
        "Дата: 13.05.2026 19:48",
        "Адреса: м. Тернопіль, вул. Перля, 3",
        "",
    ]
    for item in MOCK_RECEIPT_ITEMS:
        lines.append(
            f"{item.raw_name}  {calculate_gross_total(item):.2f} x {item.quantity} = {calculate_net_total(item):.2f}"
        )
        if item.discount_amount > 0:
            lines.append(f"  ЗНИЖКА -{item.discount_amount:.2f}")
        if item.store_cashback_amount > 0 or item.smartcart_cashback_amount > 0:
            lines.append(
                f"  КЕШБЕК {(item.store_cashback_amount + item.smartcart_cashback_amount):.2f}"
            )
    lines.extend(["", "РАЗОМ ДО СПЛАТИ", ""])
    return "\n".join(lines)


def build_product_payload(item: SeedItem) -> dict[str, object]:
    category = normalize_category(item.category, raw_name=item.raw_name, item_name=item.item_name)
    return {
        "name": item.item_name,
        "description": item.raw_name,
        "category": category.name,
        "brand": item.brand,
        "unit": item.unit,
        "thumbnail": item.thumbnail,
        "is_tracked": True,
        "has_cashback": bool(item.store_cashback_amount or item.smartcart_cashback_amount),
    }


async def get_or_create_user(db):
    result = await db.execute(select(User).where(User.telegram_id == MOCK_USER_TELEGRAM_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(telegram_id=MOCK_USER_TELEGRAM_ID, username=MOCK_USERNAME)
        db.add(user)
        await db.flush()
        return user

    if user.username != MOCK_USERNAME:
        user.username = MOCK_USERNAME
    return user


async def get_or_create_store(db):
    result = await db.execute(select(Store).where(Store.name == MOCK_STORE_NAME))
    store = result.scalar_one_or_none()
    logo, logo_text = store_visual(MOCK_STORE_NAME)
    if store is None:
        store = Store(name=MOCK_STORE_NAME, logo=logo, logo_text=logo_text)
        db.add(store)
        await db.flush()
        return store

    store.logo = store.logo or logo
    store.logo_text = store.logo_text or logo_text
    return store


async def upsert_product(db, item: SeedItem) -> Product:
    result = await db.execute(select(Product).where(Product.name == item.item_name))
    product = result.scalar_one_or_none()
    payload = build_product_payload(item)

    if product is None:
        product = Product(**payload)
        db.add(product)
        await db.flush()
        return product

    for key, value in payload.items():
        if value is None:
            continue
        if getattr(product, key) in (None, ""):
            setattr(product, key, value)
    return product


async def seed_mock_receipt() -> None:
    total_discount = quantize_money(sum((item.discount_amount for item in MOCK_RECEIPT_ITEMS), Decimal("0")))
    store_cashback_total = quantize_money(
        sum((item.store_cashback_amount for item in MOCK_RECEIPT_ITEMS), Decimal("0"))
    )
    smartcart_cashback_total = quantize_money(
        sum((item.smartcart_cashback_amount for item in MOCK_RECEIPT_ITEMS), Decimal("0"))
    )
    total = quantize_money(sum((calculate_net_total(item) for item in MOCK_RECEIPT_ITEMS), Decimal("0")))
    ocr_raw_text = build_ocr_text()

    async with AsyncSessionLocal() as db:
        user = await get_or_create_user(db)
        await get_or_create_store(db)

        existing_result = await db.execute(select(Receipt).where(Receipt.ocr_raw_text == ocr_raw_text))
        receipt = existing_result.scalar_one_or_none()
        if receipt is None:
            receipt = Receipt(user_id=user.id)
            db.add(receipt)
            await db.flush()
        else:
            await db.execute(delete(ReceiptItem).where(ReceiptItem.receipt_id == receipt.id))

        receipt.user_id = user.id
        receipt.store = MOCK_STORE_NAME
        receipt.receipt_datetime = MOCK_RECEIPT_DATETIME
        receipt.total = total
        receipt.currency = "UAH"
        receipt.total_discount = total_discount
        receipt.store_cashback_total = store_cashback_total
        receipt.smartcart_cashback_total = smartcart_cashback_total
        receipt.image_url = None
        receipt.ocr_raw_text = ocr_raw_text
        receipt.processing_status = "processed"

        for item in MOCK_RECEIPT_ITEMS:
            product = await upsert_product(db, item)
            category = normalize_category(item.category, raw_name=item.raw_name, item_name=item.item_name)
            db.add(
                ReceiptItem(
                    receipt_id=receipt.id,
                    product_id=product.id,
                    raw_name=item.raw_name,
                    item_name=item.item_name,
                    price=item.price,
                    quantity=item.quantity,
                    unit=item.unit,
                    discount_amount=item.discount_amount,
                    store_cashback_amount=item.store_cashback_amount,
                    store_cashback_percent=item.store_cashback_percent,
                    smartcart_cashback_amount=item.smartcart_cashback_amount,
                    category=category.name,
                    brand=item.brand,
                    thumbnail=item.thumbnail,
                    is_promotional=item.is_promotional,
                    match_confidence=Decimal("0.96"),
                    match_status="matched",
                )
            )

        await db.commit()

        print("Seeded mock receipt:")
        print(f"  receipt_id={receipt.id}")
        print(f"  store={receipt.store}")
        print(f"  datetime={receipt.receipt_datetime.isoformat(sep=' ')}")
        print(f"  items={len(MOCK_RECEIPT_ITEMS)}")
        print(f"  total={receipt.total}")
        print(f"  total_discount={receipt.total_discount}")
        print(f"  store_cashback_total={receipt.store_cashback_total}")
        print(f"  smartcart_cashback_total={receipt.smartcart_cashback_total}")


if __name__ == "__main__":
    asyncio.run(seed_mock_receipt())