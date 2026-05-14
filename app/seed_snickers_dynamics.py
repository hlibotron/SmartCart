import asyncio
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select

from app.db.database import AsyncSessionLocal
from app.db.models import Product, ProductPrice, Receipt, ReceiptItem, Store, User

SEED_TAG = "seed:snickers-dynamics:v1"
OFFICIAL_SOURCE = "Офіційні сайти"
SNICKERS_NAME = "БАТОНЧИК SNICKERS CREAMY MARS 54 Г"

RECEIPTS = [
    {
        "store": "АТБ",
        "receipt_datetime": datetime(2026, 5, 4, 18, 42),
        "items": [
            {
                "name": SNICKERS_NAME,
                "raw_name": "БАТОНЧИК SNICKERS CREAMY MARS 54 Г",
                "price": Decimal("36.90"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Бакалія",
                "brand": "Mars",
                "thumbnail": "jar",
            },
            {
                "name": "МОЛОКО ЯГОТИНСЬКЕ 2.6% 870Г",
                "raw_name": "МОЛОКО ЯГОТИНСЬКЕ 2.6% 870Г",
                "price": Decimal("46.50"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Молочні",
                "brand": "Яготинське",
                "thumbnail": "milk",
            },
            {
                "name": "БАНАНИ ВАГОВІ",
                "raw_name": "БАНАНИ ВАГОВІ",
                "price": Decimal("29.40"),
                "quantity": Decimal("0.6"),
                "unit": "кг",
                "category": "Фрукти",
                "brand": None,
                "thumbnail": "banana",
            },
        ],
    },
    {
        "store": "Сільпо",
        "receipt_datetime": datetime(2026, 5, 6, 13, 18),
        "items": [
            {
                "name": SNICKERS_NAME,
                "raw_name": "БАТОНЧИК SNICKERS CREAMY MARS 54 Г",
                "price": Decimal("38.40"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Бакалія",
                "brand": "Mars",
                "thumbnail": "jar",
            },
            {
                "name": "ВОДА МОРШИНСЬКА НЕГАЗ 1.5Л",
                "raw_name": "ВОДА МОРШИНСЬКА НЕГАЗ 1.5Л",
                "price": Decimal("28.90"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Напої",
                "brand": "Моршинська",
                "thumbnail": "bottle",
            },
        ],
    },
    {
        "store": "Novus",
        "receipt_datetime": datetime(2026, 5, 8, 20, 7),
        "items": [
            {
                "name": SNICKERS_NAME,
                "raw_name": "БАТОНЧИК SNICKERS CREAMY MARS 54 Г",
                "price": Decimal("37.80"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Бакалія",
                "brand": "Mars",
                "thumbnail": "jar",
            },
            {
                "name": "КЕФІР ПРОСТОКВАШИНО 2.5% 900Г",
                "raw_name": "КЕФІР ПРОСТОКВАШИНО 2.5% 900Г",
                "price": Decimal("49.90"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Молочні",
                "brand": "Простоквашино",
                "thumbnail": "yogurt",
            },
            {
                "name": "ФІЛЕ КУРЯЧЕ ОХОЛОДЖЕНЕ",
                "raw_name": "ФІЛЕ КУРЯЧЕ ОХОЛОДЖЕНЕ",
                "price": Decimal("189.00"),
                "quantity": Decimal("0.45"),
                "unit": "кг",
                "category": "М'ясні",
                "brand": None,
                "thumbnail": "meat",
            },
        ],
    },
    {
        "store": "Ашан",
        "receipt_datetime": datetime(2026, 5, 10, 11, 51),
        "items": [
            {
                "name": SNICKERS_NAME,
                "raw_name": "БАТОНЧИК SNICKERS CREAMY MARS 54 Г",
                "price": Decimal("39.10"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Бакалія",
                "brand": "Mars",
                "thumbnail": "jar",
            },
            {
                "name": "ЯЙЦЯ КУРЯЧІ С1 10ШТ",
                "raw_name": "ЯЙЦЯ КУРЯЧІ С1 10ШТ",
                "price": Decimal("72.30"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Інше",
                "brand": None,
                "thumbnail": "eggs",
            },
        ],
    },
    {
        "store": "VARUS",
        "receipt_datetime": datetime(2026, 5, 12, 19, 34),
        "items": [
            {
                "name": SNICKERS_NAME,
                "raw_name": "БАТОНЧИК SNICKERS CREAMY MARS 54 Г",
                "price": Decimal("37.20"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Бакалія",
                "brand": "Mars",
                "thumbnail": "jar",
            },
            {
                "name": "СИР ГАУДА 45%",
                "raw_name": "СИР ГАУДА 45%",
                "price": Decimal("229.00"),
                "quantity": Decimal("0.22"),
                "unit": "кг",
                "category": "Молочні",
                "brand": None,
                "thumbnail": "cheese",
            },
            {
                "name": "КАВА JACOBS MONARCH 190Г",
                "raw_name": "КАВА JACOBS MONARCH 190Г",
                "price": Decimal("179.90"),
                "quantity": Decimal("1"),
                "unit": "шт",
                "category": "Напої",
                "brand": "Jacobs",
                "thumbnail": "coffee",
            },
        ],
    },
]

OFFICIAL_PRICES = [
    {"store": "АТБ", "price": Decimal("36.50"), "observed_at": datetime(2026, 5, 13, 9, 10)},
    {"store": "Сільпо", "price": Decimal("38.90"), "observed_at": datetime(2026, 5, 13, 9, 15)},
    {"store": "Novus", "price": Decimal("37.60"), "observed_at": datetime(2026, 5, 13, 9, 20)},
]


async def get_or_create_user(session):
    result = await session.execute(select(User).where(User.telegram_id == 9001001))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(telegram_id=9001001, username="seed_bot")
        session.add(user)
        await session.flush()
    return user


async def get_or_create_store(session, name: str):
    result = await session.execute(select(Store).where(func.lower(Store.name) == name.lower()))
    store = result.scalar_one_or_none()
    if store is None:
        store = Store(name=name)
        session.add(store)
        await session.flush()
    return store


async def get_or_create_product(session, *, name: str, category: str | None, brand: str | None, unit: str, thumbnail: str):
    result = await session.execute(select(Product).where(func.lower(Product.name) == name.lower()))
    product = result.scalar_one_or_none()
    if product is None:
        product = Product(
            name=name,
            description=brand or category or "Товар з чеків",
            category=category,
            brand=brand,
            unit=unit,
            thumbnail=thumbnail,
        )
        session.add(product)
        await session.flush()
    return product


def line_total(item: dict) -> Decimal:
    return (item["price"] * item["quantity"]).quantize(Decimal("0.01"))


async def seed_receipts(session, user_id: int):
    created = 0
    for payload in RECEIPTS:
        existing_result = await session.execute(
            select(Receipt).where(
                Receipt.user_id == user_id,
                Receipt.store == payload["store"],
                Receipt.receipt_datetime == payload["receipt_datetime"],
                Receipt.ocr_raw_text == SEED_TAG,
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            continue

        receipt_total = sum((line_total(item) for item in payload["items"]), Decimal("0")).quantize(Decimal("0.01"))
        receipt = Receipt(
            user_id=user_id,
            store=payload["store"],
            receipt_datetime=payload["receipt_datetime"],
            total=receipt_total,
            currency="UAH",
            total_discount=Decimal("0"),
            store_cashback_total=Decimal("0"),
            smartcart_cashback_total=Decimal("0"),
            ocr_raw_text=SEED_TAG,
            processing_status="processed",
        )
        session.add(receipt)
        await session.flush()

        for item in payload["items"]:
            product = await get_or_create_product(
                session,
                name=item["name"],
                category=item["category"],
                brand=item["brand"],
                unit=item["unit"],
                thumbnail=item["thumbnail"],
            )
            session.add(
                ReceiptItem(
                    receipt_id=receipt.id,
                    product_id=product.id,
                    raw_name=item["raw_name"],
                    item_name=item["name"],
                    price=item["price"],
                    quantity=item["quantity"],
                    unit=item["unit"],
                    discount_amount=Decimal("0"),
                    store_cashback_amount=Decimal("0"),
                    store_cashback_percent=Decimal("0"),
                    smartcart_cashback_amount=Decimal("0"),
                    category=item["category"],
                    brand=item["brand"],
                    thumbnail=item["thumbnail"],
                    is_promotional=False,
                    match_confidence=Decimal("1"),
                    match_status="manual",
                )
            )
        created += 1

    return created


async def seed_official_prices(session):
    snickers = await get_or_create_product(
        session,
        name=SNICKERS_NAME,
        category="Бакалія",
        brand="Mars",
        unit="шт",
        thumbnail="jar",
    )

    created = 0
    for row in OFFICIAL_PRICES:
        store = await get_or_create_store(session, row["store"])
        existing_result = await session.execute(
            select(ProductPrice).where(
                ProductPrice.product_id == snickers.id,
                ProductPrice.store_id == store.id,
                ProductPrice.source == OFFICIAL_SOURCE,
                ProductPrice.observed_at == row["observed_at"],
            )
        )
        if existing_result.scalar_one_or_none() is not None:
            continue

        session.add(
            ProductPrice(
                product_id=snickers.id,
                store_id=store.id,
                price=row["price"],
                currency="UAH",
                observed_at=row["observed_at"],
                is_promotional=False,
                source=OFFICIAL_SOURCE,
            )
        )
        created += 1

    return created


async def seed():
    async with AsyncSessionLocal() as session:
        user = await get_or_create_user(session)
        created_receipts = await seed_receipts(session, user.id)
        created_prices = await seed_official_prices(session)
        await session.commit()

    print(f"seed_tag={SEED_TAG}")
    print(f"receipts_created={created_receipts}")
    print(f"official_prices_created={created_prices}")


if __name__ == "__main__":
    asyncio.run(seed())
