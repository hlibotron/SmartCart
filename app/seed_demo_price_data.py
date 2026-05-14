from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import delete, func, select

from app.db.database import AsyncSessionLocal
from app.db.models import Product, ProductListing, ProductPrice, Receipt, ReceiptItem, Store, User


SEED_MARKER = "SMARTCART_DEMO_PRICE_SEED_V1"
SEED_USER_TELEGRAM_ID = 990000002
OFFICIAL_SOURCE = "demo-official-site-json"
OFFICIAL_SOURCE_TYPE = "official_store_site"
OFFICIAL_PRICE_SCOPE = "official_online_reference"
TARGET_PRODUCT_NAME = "БАТОНЧИК SNICKERS CREAMY MARS 54 Г"


@dataclass(frozen=True)
class SeedItem:
    name: str
    price: Decimal
    quantity: Decimal = Decimal("1")
    unit: str = "шт"
    discount_amount: Decimal = Decimal("0")
    store_cashback_amount: Decimal = Decimal("0")
    store_cashback_percent: Decimal = Decimal("0")
    smartcart_cashback_amount: Decimal = Decimal("0")
    category: str = "Бакалія"
    brand: str | None = None
    thumbnail: str = "jar"
    is_promotional: bool = False


@dataclass(frozen=True)
class ReceiptSeed:
    store_name: str
    receipt_datetime: datetime
    items: list[SeedItem]


@dataclass(frozen=True)
class PriceSeed:
    store_name: str
    observed_at: datetime
    price: Decimal
    source_name: str


def normalize_name(value: str) -> str:
    normalized = value.lower().replace("’", "'")
    normalized = re.sub(r"[^0-9a-zа-яіїєґ%.' ]+", " ", normalized, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", normalized).strip()


def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def gross_total(item: SeedItem) -> Decimal:
    return money(item.price * item.quantity)


def net_total(item: SeedItem) -> Decimal:
    return money(gross_total(item) - item.discount_amount)


def receipt_marker(receipt: ReceiptSeed) -> str:
    return f"{SEED_MARKER}::{receipt.store_name}::{receipt.receipt_datetime.isoformat()}"


def receipt_ocr_text(receipt: ReceiptSeed) -> str:
    lines = [
        receipt_marker(receipt),
        receipt.store_name,
        receipt.receipt_datetime.strftime("%d.%m.%Y %H:%M"),
        "",
    ]
    for item in receipt.items:
        lines.append(f"{item.name} {gross_total(item):.2f} x {item.quantity} = {net_total(item):.2f}")
        if item.discount_amount > 0:
            lines.append(f"  ЗНИЖКА -{item.discount_amount:.2f}")
        cashback = item.store_cashback_amount + item.smartcart_cashback_amount
        if cashback > 0:
            lines.append(f"  КЕШБЕК {cashback:.2f}")
    return "\n".join(lines)


def store_logo(store_name: str) -> tuple[str, str]:
    normalized = store_name.lower()
    if "сільпо" in normalized or "silpo" in normalized:
        return "silpo", "Сільпо"
    if "атб" in normalized or "atb" in normalized:
        return "atb", "АТБ"
    if "novus" in normalized:
        return "novus", "NOVUS"
    if "varus" in normalized or "варус" in normalized:
        return "default", "Varus"
    if "fora" in normalized or "фора" in normalized:
        return "default", "Фора"
    return "default", store_name[:8]


def official_package_price(price: Decimal) -> Decimal:
    return (price / Decimal("54") * Decimal("1000")).quantize(Decimal("0.01"))


def receipt_items_for_store(store_name: str) -> list[SeedItem]:
    common_target = SeedItem(
        name=TARGET_PRODUCT_NAME,
        price=Decimal("44.90"),
        category="Бакалія",
        brand="Mars",
        thumbnail="jar",
        is_promotional=True,
    )

    items_by_store: dict[str, list[SeedItem]] = {
        "Сільпо": [
            common_target,
            SeedItem("Молоко Галичина 2.5% 900 мл", Decimal("26.90"), brand="Галичина", thumbnail="milk", category="Молочні", store_cashback_amount=Decimal("0.54"), store_cashback_percent=Decimal("1.00")),
            SeedItem("Банани", Decimal("18.60"), quantity=Decimal("0.62"), unit="кг", category="Фрукти", thumbnail="banana"),
        ],
        "АТБ-Маркет": [
            SeedItem(TARGET_PRODUCT_NAME, Decimal("45.60"), category="Бакалія", brand="Mars", thumbnail="jar"),
            SeedItem("Яйця курячі С0 10 шт", Decimal("63.90"), category="Бакалія", brand="Ясенсвіт", thumbnail="eggs", discount_amount=Decimal("3.90"), is_promotional=True),
            SeedItem("Кава мелена Jacobs Monarch 230 г", Decimal("118.00"), category="Напої", brand="Jacobs", thumbnail="coffee", smartcart_cashback_amount=Decimal("4.72")),
        ],
        "Varus": [
            SeedItem(TARGET_PRODUCT_NAME, Decimal("45.90"), category="Бакалія", brand="Mars", thumbnail="jar"),
            SeedItem("Йогурт грецький 150 г", Decimal("31.90"), category="Молочні", brand="Галичина", thumbnail="yogurt", store_cashback_amount=Decimal("0.64"), store_cashback_percent=Decimal("2.00")),
            SeedItem("Хліб тостовий нарізний 450 г", Decimal("34.90"), category="Бакалія", thumbnail="jar"),
        ],
        "Novus": [
            SeedItem(TARGET_PRODUCT_NAME, Decimal("45.20"), category="Бакалія", brand="Mars", thumbnail="jar"),
            SeedItem("Сир твердий класичний 45%", Decimal("289.90"), quantity=Decimal("0.48"), unit="кг", category="Молочні", thumbnail="cheese", smartcart_cashback_amount=Decimal("2.80"), is_promotional=True),
            SeedItem("Вода негазована 1.5 л", Decimal("21.90"), quantity=Decimal("2"), category="Напої", brand="Моршинська", thumbnail="bottle"),
        ],
        "Фора": [
            SeedItem(TARGET_PRODUCT_NAME, Decimal("46.30"), category="Бакалія", brand="Mars", thumbnail="jar"),
            SeedItem("Паста зубна Colgate Max Blast 100 мл", Decimal("49.90"), category="Бакалія", brand="Colgate", thumbnail="jar", discount_amount=Decimal("5.00"), is_promotional=True),
            SeedItem("Сік апельсиновий", Decimal("42.50"), quantity=Decimal("1"), unit="шт", category="Напої", thumbnail="bottle"),
        ],
    }

    return items_by_store[store_name]


RECEIPT_SEEDS = [
    ReceiptSeed("Сільпо", datetime(2026, 5, 3, 18, 10), receipt_items_for_store("Сільпо")),
    ReceiptSeed("АТБ-Маркет", datetime(2026, 5, 6, 12, 30), receipt_items_for_store("АТБ-Маркет")),
    ReceiptSeed("Varus", datetime(2026, 5, 8, 19, 5), receipt_items_for_store("Varus")),
    ReceiptSeed("Novus", datetime(2026, 5, 11, 13, 20), receipt_items_for_store("Novus")),
    ReceiptSeed("Фора", datetime(2026, 5, 13, 17, 45), receipt_items_for_store("Фора")),
]


PRICE_SEEDS = [
    PriceSeed("Сільпо", datetime(2026, 5, 4, 9, 15), Decimal("43.90"), "Сільпо онлайн"),
    PriceSeed("Сільпо", datetime(2026, 5, 12, 10, 5), Decimal("44.20"), "Сільпо онлайн"),
    PriceSeed("АТБ-Маркет", datetime(2026, 5, 5, 10, 5), Decimal("44.50"), "АТБ онлайн"),
    PriceSeed("АТБ-Маркет", datetime(2026, 5, 12, 11, 35), Decimal("45.10"), "АТБ онлайн"),
    PriceSeed("Varus", datetime(2026, 5, 6, 11, 20), Decimal("45.20"), "Varus онлайн"),
    PriceSeed("Varus", datetime(2026, 5, 13, 11, 5), Decimal("45.70"), "Varus онлайн"),
]


async def get_or_create_user(db: AsyncSessionLocal) -> User:
    result = await db.execute(select(User).where(User.telegram_id == SEED_USER_TELEGRAM_ID))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(telegram_id=SEED_USER_TELEGRAM_ID, username="demo.pricing")
        db.add(user)
        await db.flush()
        return user

    user.username = user.username or "demo.pricing"
    return user


async def get_or_create_store(db: AsyncSessionLocal, store_name: str) -> Store:
    result = await db.execute(select(Store).where(Store.name == store_name))
    store = result.scalar_one_or_none()
    logo, logo_text = store_logo(store_name)
    if store is None:
        store = Store(name=store_name, logo=logo, logo_text=logo_text)
        db.add(store)
        await db.flush()
        return store

    store.logo = store.logo or logo
    store.logo_text = store.logo_text or logo_text
    return store


async def get_or_create_product(db: AsyncSessionLocal, item: SeedItem) -> Product:
    result = await db.execute(select(Product).where(Product.name == item.name))
    product = result.scalar_one_or_none()
    if product is None:
        product = Product(
            name=item.name,
            description="Шоколадний батончик 54 г" if item.name == TARGET_PRODUCT_NAME else item.name,
            category=item.category,
            brand=item.brand,
            unit=item.unit,
            thumbnail=item.thumbnail,
            is_tracked=True,
            has_cashback=bool(item.store_cashback_amount or item.smartcart_cashback_amount),
        )
        db.add(product)
        await db.flush()
        return product

    if item.name == TARGET_PRODUCT_NAME:
        product.description = "Шоколадний батончик 54 г"
        product.category = "Бакалія"
        product.brand = "Mars"
        product.unit = "шт"
        product.thumbnail = "jar"
        product.is_tracked = True
        product.has_cashback = False
    else:
        product.brand = product.brand or item.brand
        product.category = product.category or item.category
        product.unit = product.unit or item.unit
        product.thumbnail = product.thumbnail or item.thumbnail
        product.is_tracked = True
    return product


async def upsert_listing_and_price(
    db: AsyncSessionLocal,
    *,
    product: Product,
    store: Store,
    price_seed: PriceSeed,
) -> None:
    normalized_name = normalize_name(TARGET_PRODUCT_NAME)
    package_quantity = Decimal("54")
    package_unit = "г"

    listing_result = await db.execute(
        select(ProductListing).where(
            ProductListing.product_id == product.id,
            ProductListing.store_id == store.id,
            ProductListing.source == OFFICIAL_SOURCE,
        )
    )
    listing = listing_result.scalar_one_or_none()
    if listing is None:
        listing = ProductListing(
            product_id=product.id,
            store_id=store.id,
            raw_name=TARGET_PRODUCT_NAME,
            normalized_name=normalized_name,
            brand="Mars",
            category="Бакалія",
            product_url=f"https://example.com/{normalized_name.replace(' ', '-')}",
            image_url=None,
            availability=True,
            package_quantity=package_quantity,
            package_unit=package_unit,
            source=OFFICIAL_SOURCE,
            source_type=OFFICIAL_SOURCE_TYPE,
            price_scope=OFFICIAL_PRICE_SCOPE,
            first_seen_at=price_seed.observed_at,
            last_seen_at=price_seed.observed_at,
        )
        db.add(listing)
        await db.flush()
    else:
        listing.raw_name = TARGET_PRODUCT_NAME
        listing.normalized_name = normalized_name
        listing.brand = listing.brand or "Mars"
        listing.category = "Бакалія"
        listing.package_quantity = package_quantity
        listing.package_unit = package_unit
        listing.source = OFFICIAL_SOURCE
        listing.source_type = OFFICIAL_SOURCE_TYPE
        listing.price_scope = OFFICIAL_PRICE_SCOPE
        listing.last_seen_at = price_seed.observed_at

    existing_price_result = await db.execute(
        select(ProductPrice).where(
            ProductPrice.product_id == product.id,
            ProductPrice.store_id == store.id,
            ProductPrice.source == OFFICIAL_SOURCE,
            ProductPrice.observed_at == price_seed.observed_at,
        )
    )
    if existing_price_result.scalar_one_or_none():
        return

    db.add(
        ProductPrice(
            product_id=product.id,
            store_id=store.id,
            listing_id=listing.id,
            price=price_seed.price,
            currency="UAH",
            observed_at=price_seed.observed_at,
            price_per_unit=official_package_price(price_seed.price),
            package_quantity=package_quantity,
            package_unit=package_unit,
            is_promotional=price_seed.price <= Decimal("44.00"),
            source=OFFICIAL_SOURCE,
            source_type=OFFICIAL_SOURCE_TYPE,
            price_scope=OFFICIAL_PRICE_SCOPE,
        )
    )


async def seed_receipt(db: AsyncSessionLocal, user: User, receipt: ReceiptSeed) -> None:
    receipt_row = Receipt(
        user_id=user.id,
        store=receipt.store_name,
        receipt_datetime=receipt.receipt_datetime,
        currency="UAH",
        image_url=None,
        ocr_raw_text=receipt_ocr_text(receipt),
        processing_status="processed",
    )
    db.add(receipt_row)
    await db.flush()

    total_discount = Decimal("0")
    total_store_cashback = Decimal("0")
    total_smartcart_cashback = Decimal("0")

    for item in receipt.items:
        product = await get_or_create_product(db, item)
        total_discount += item.discount_amount
        total_store_cashback += item.store_cashback_amount
        total_smartcart_cashback += item.smartcart_cashback_amount
        db.add(
            ReceiptItem(
                receipt_id=receipt_row.id,
                product_id=product.id,
                raw_name=item.name,
                item_name=item.name,
                price=item.price,
                quantity=item.quantity,
                unit=item.unit,
                discount_amount=item.discount_amount,
                store_cashback_amount=item.store_cashback_amount,
                store_cashback_percent=item.store_cashback_percent,
                smartcart_cashback_amount=item.smartcart_cashback_amount,
                category=item.category,
                brand=item.brand,
                thumbnail=item.thumbnail,
                is_promotional=item.is_promotional,
                match_confidence=Decimal("0.98"),
                match_status="matched",
            )
        )

    receipt_row.total_discount = money(total_discount)
    receipt_row.store_cashback_total = money(total_store_cashback)
    receipt_row.smartcart_cashback_total = money(total_smartcart_cashback)
    receipt_row.total = money(
        sum((money(item.price * item.quantity) - item.discount_amount for item in receipt.items), Decimal("0"))
    )


async def clear_previous_demo_data(db: AsyncSessionLocal, target_product_id: int | None = None) -> None:
    await db.execute(delete(Receipt).where(Receipt.ocr_raw_text.like(f"%{SEED_MARKER}%")))
    if target_product_id is not None:
        await db.execute(delete(ProductPrice).where(ProductPrice.product_id == target_product_id))
        await db.execute(delete(ProductListing).where(ProductListing.product_id == target_product_id))


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as db:
        user = await get_or_create_user(db)
        target_product_result = await db.execute(select(Product).where(Product.name == TARGET_PRODUCT_NAME))
        target_product = target_product_result.scalar_one_or_none()
        if target_product is None:
            target_product = Product(
                name=TARGET_PRODUCT_NAME,
                description="Шоколадний батончик 54 г",
                category="Бакалія",
                brand="Mars",
                unit="шт",
                thumbnail="jar",
                is_tracked=True,
                has_cashback=False,
            )
            db.add(target_product)
            await db.flush()
        else:
            target_product.description = "Шоколадний батончик 54 г"
            target_product.category = "Бакалія"
            target_product.brand = "Mars"
            target_product.unit = "шт"
            target_product.thumbnail = "jar"
            target_product.is_tracked = True
            target_product.has_cashback = False

        await clear_previous_demo_data(db, target_product.id)

        stores = {store_name: await get_or_create_store(db, store_name) for store_name in {seed.store_name for seed in RECEIPT_SEEDS} | {seed.store_name for seed in PRICE_SEEDS}}

        for receipt in RECEIPT_SEEDS:
            await seed_receipt(db, user, receipt)

        for price_seed in PRICE_SEEDS:
            store = stores[price_seed.store_name]
            await upsert_listing_and_price(db, product=target_product, store=store, price_seed=price_seed)

        await db.commit()

        receipt_count = await db.scalar(
            select(func.count()).select_from(Receipt).where(Receipt.ocr_raw_text.like(f"%{SEED_MARKER}%"))
        )
        price_count = await db.scalar(
            select(func.count()).select_from(ProductPrice).where(ProductPrice.product_id == target_product.id, ProductPrice.source == OFFICIAL_SOURCE)
        )
        listing_count = await db.scalar(
            select(func.count()).select_from(ProductListing).where(ProductListing.product_id == target_product.id, ProductListing.source == OFFICIAL_SOURCE)
        )

        print("Seeded demo pricing data")
        print(f"  target_product_id={target_product.id}")
        print(f"  receipts={receipt_count}")
        print(f"  official_prices={price_count}")
        print(f"  official_listings={listing_count}")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())