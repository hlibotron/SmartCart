from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from math import ceil, floor

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Product, Receipt, ReceiptItem, Store, User
from app.schemas import ReceiptCreate, ReceiptCreated


app = FastAPI(title="SmartCart API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PERIOD_DAYS = {
    "1w": 7,
    "2w": 14,
    "1m": 30,
    "3m": 90,
}

CURRENCY_SYMBOLS = {
    "UAH": "₴",
    "USD": "$",
    "EUR": "€",
}

CATEGORY_META = {
    "молочні": ("dairy", "#16a34a", "#eaf8ef", "milk"),
    "м'ясні": ("meat", "#bfe8c9", "#edf9f0", "meat"),
    "м’ясні": ("meat", "#bfe8c9", "#edf9f0", "meat"),
    "овочі": ("vegetables", "#f7c948", "#fff6d9", "carrot"),
    "фрукти": ("fruits", "#a678e8", "#f1e9ff", "grapes"),
    "напої": ("drinks", "#6aa5f8", "#e8f2ff", "bottle"),
    "бакалія": ("grocery", "#d1d5db", "#f1f2f4", "jar"),
}


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/db/health")
@app.get("/api/db/health")
async def db_health(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("select current_database() as database_name, current_user as user_name")
    )
    row = result.mappings().one()
    return {
        "status": "ok",
        "database": row["database_name"],
        "user": row["user_name"],
    }


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def money(value, currency: str | None = "UAH") -> str:
    amount = to_decimal(value).quantize(Decimal("0.01"))
    symbol = CURRENCY_SYMBOLS.get(currency or "UAH", currency or "")
    if amount == amount.to_integral_value():
        formatted = f"{int(amount):,}".replace(",", " ")
    else:
        formatted = f"{amount:,.2f}".replace(",", " ")
    return f"{symbol}{formatted}"


def signed_money(value) -> str:
    amount = to_decimal(value).quantize(Decimal("0.01"))
    sign = "+" if amount > 0 else ""
    return f"{sign}{amount}"


def cashback_money(value, currency: str | None = "UAH") -> str | None:
    amount = to_decimal(value)
    if amount <= 0:
        return None
    return f"+{money(amount, currency)}"


def nullable_money(value, currency: str | None = "UAH") -> str | None:
    amount = to_decimal(value)
    if amount <= 0:
        return None
    return money(amount, currency)


def item_gross_total(item: ReceiptItem) -> Decimal:
    return to_decimal(item.price) * to_decimal(item.quantity)


def item_net_total(item: ReceiptItem) -> Decimal:
    return max(Decimal("0"), item_gross_total(item) - to_decimal(item.discount_amount))


def receipt_date(receipt: Receipt) -> datetime:
    return receipt.receipt_datetime or receipt.created_at or datetime.utcnow()


def period_cutoff(period: str) -> datetime:
    return datetime.utcnow() - timedelta(days=PERIOD_DAYS.get(period, 30))


def thumb_for(name: str | None, category: str | None = None) -> str:
    text = f"{name or ''} {category or ''}".lower()
    if "мол" in text:
        return "milk"
    if "йогур" in text:
        return "yogurt"
    if "яй" in text:
        return "eggs"
    if "кав" in text:
        return "coffee"
    if "банан" in text:
        return "banana"
    if "сир" in text:
        return "cheese"
    if "м'яс" in text or "м’яс" in text:
        return "meat"
    if "овоч" in text or "морк" in text:
        return "carrot"
    if "фрукт" in text or "виноград" in text:
        return "grapes"
    if "нап" in text or "вода" in text:
        return "bottle"
    return "jar"


def logo_for(store: str | None) -> tuple[str, str]:
    store_name = store or "Магазин"
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


def item_word(count: int) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return "товар"
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return "товари"
    return "товарів"


async def fetch_item_rows(db: AsyncSession, *, since: datetime | None = None):
    stmt = (
        select(ReceiptItem, Receipt)
        .join(Receipt, ReceiptItem.receipt_id == Receipt.id)
        .order_by(Receipt.receipt_datetime.desc().nullslast(), Receipt.created_at.desc())
    )
    if since:
        stmt = stmt.where(Receipt.receipt_datetime >= since)
    result = await db.execute(stmt)
    return result.all()


async def upsert_store(db: AsyncSession, name: str | None) -> Store | None:
    if not name:
        return None

    result = await db.execute(select(Store).where(func.lower(Store.name) == name.lower()))
    store = result.scalar_one_or_none()
    logo, logo_text = logo_for(name)

    if store is None:
        store = Store(name=name, logo=logo, logo_text=logo_text)
        db.add(store)
        await db.flush()
    else:
        store.logo = store.logo or logo
        store.logo_text = store.logo_text or logo_text

    return store


async def upsert_product(db: AsyncSession, item) -> Product:
    result = await db.execute(
        select(Product).where(func.lower(Product.name) == item.item_name.lower())
    )
    product = result.scalar_one_or_none()
    thumbnail = item.thumbnail or thumb_for(item.item_name, item.category)
    has_cashback = (
        item.store_cashback_amount > 0
        or item.store_cashback_percent > 0
        or item.smartcart_cashback_amount > 0
    )

    if product is None:
        product = Product(
            name=item.item_name,
            description=item.brand or item.category or "Товар з чеків",
            category=item.category,
            brand=item.brand,
            unit=item.unit or "шт",
            thumbnail=thumbnail,
            has_cashback=has_cashback,
        )
        db.add(product)
        await db.flush()
    else:
        product.description = product.description or item.brand or item.category
        product.category = product.category or item.category
        product.brand = product.brand or item.brand
        product.unit = product.unit or item.unit or "шт"
        product.thumbnail = product.thumbnail or thumbnail
        product.has_cashback = product.has_cashback or has_cashback

    return product


@app.post("/receipts", response_model=ReceiptCreated)
@app.post("/api/receipts", response_model=ReceiptCreated)
async def create_receipt(payload: ReceiptCreate, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(
        select(User).where(User.telegram_id == payload.user.telegram_id)
    )
    user = user_result.scalar_one_or_none()

    if user is None:
        user = User(
            telegram_id=payload.user.telegram_id,
            username=payload.user.username,
        )
        db.add(user)
        await db.flush()
    elif payload.user.username and user.username != payload.user.username:
        user.username = payload.user.username

    calculated_discount = sum((item.discount_amount for item in payload.items), Decimal("0"))
    calculated_store_cashback = sum(
        (item.store_cashback_amount for item in payload.items),
        Decimal("0"),
    )
    calculated_smartcart_cashback = sum(
        (item.smartcart_cashback_amount for item in payload.items),
        Decimal("0"),
    )
    calculated_total = sum(
        (
            max(Decimal("0"), item.price * item.quantity - item.discount_amount)
            for item in payload.items
        ),
        Decimal("0"),
    )
    receipt = Receipt(
        user_id=user.id,
        store=payload.store,
        receipt_datetime=payload.receipt_datetime or datetime.utcnow(),
        total=payload.total if payload.total is not None else calculated_total,
        total_discount=payload.total_discount
        if payload.total_discount is not None
        else calculated_discount,
        store_cashback_total=payload.store_cashback_total
        if payload.store_cashback_total is not None
        else calculated_store_cashback,
        smartcart_cashback_total=payload.smartcart_cashback_total
        if payload.smartcart_cashback_total is not None
        else calculated_smartcart_cashback,
        currency=payload.currency,
        image_url=payload.image_url,
        ocr_raw_text=payload.ocr_raw_text,
        processing_status=payload.processing_status,
    )
    db.add(receipt)
    await db.flush()

    await upsert_store(db, payload.store)

    receipt_items = []
    for item in payload.items:
        await upsert_product(db, item)
        receipt_items.append(
            ReceiptItem(
                receipt_id=receipt.id,
                item_name=item.item_name,
                price=item.price,
                quantity=item.quantity,
                unit=item.unit or "шт",
                discount_amount=item.discount_amount,
                store_cashback_amount=item.store_cashback_amount,
                store_cashback_percent=item.store_cashback_percent,
                smartcart_cashback_amount=item.smartcart_cashback_amount,
                category=item.category,
                brand=item.brand,
                thumbnail=item.thumbnail,
                is_promotional=item.is_promotional,
            )
        )

    db.add_all(receipt_items)
    await db.commit()

    return ReceiptCreated(
        id=receipt.id,
        items_count=len(payload.items),
        status=receipt.processing_status,
    )


@app.get("/receipts")
@app.get("/api/receipts")
async def list_receipts(db: AsyncSession = Depends(get_db)):
    receipts_result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items))
        .order_by(Receipt.receipt_datetime.desc().nullslast(), Receipt.created_at.desc())
        .limit(50)
    )
    receipts = receipts_result.scalars().all()

    total = sum((to_decimal(receipt.total) for receipt in receipts), Decimal("0"))
    count = len(receipts)
    average = total / count if count else Decimal("0")

    cards = []
    for receipt in receipts:
        logo, logo_text = logo_for(receipt.store)
        date = receipt_date(receipt)
        item_count = len(receipt.items)
        cards.append(
            {
                "id": receipt.id,
                "store": receipt.store or "Магазин",
                "date": date.strftime("%d.%m.%Y"),
                "items": f"{item_count} {item_word(item_count)}",
                "amount": money(receipt.total, receipt.currency),
                "logo": logo,
                "logoText": logo_text,
            }
        )

    return {
        "receiptSummary": [
            {
                "label": "Чеків",
                "value": str(count),
                "trend": "за весь період",
                "icon": "receiptCheck",
            },
            {
                "label": "Витрачено",
                "value": money(total),
                "trend": "за весь період",
                "icon": "wallet",
            },
            {
                "label": "Середній чек",
                "value": money(average),
                "trend": "за весь період",
                "icon": "shoppingBag",
            },
        ],
        "receipts": cards,
    }


def receipt_detail_payload(receipt: Receipt):
    total = to_decimal(receipt.total)
    item_count = len(receipt.items)
    logo, logo_text = logo_for(receipt.store)
    date = receipt_date(receipt)
    items_total = sum((item_net_total(item) for item in receipt.items), Decimal("0"))
    summary_total = total or items_total
    total_discount = to_decimal(receipt.total_discount) or sum(
        (to_decimal(item.discount_amount) for item in receipt.items),
        Decimal("0"),
    )
    store_cashback_total = to_decimal(receipt.store_cashback_total) or sum(
        (to_decimal(item.store_cashback_amount) for item in receipt.items),
        Decimal("0"),
    )
    smartcart_cashback_total = to_decimal(receipt.smartcart_cashback_total) or sum(
        (to_decimal(item.smartcart_cashback_amount) for item in receipt.items),
        Decimal("0"),
    )
    expected_cashback = store_cashback_total + smartcart_cashback_total

    return {
        "receiptSummary": {
            "store": receipt.store or "Магазин",
            "logo": logo,
            "logoText": logo_text,
            "dateTime": date.strftime("%d.%m.%Y · %H:%M"),
            "status": "Чек успішно розпізнано"
            if receipt.processing_status == "processed"
            else receipt.processing_status,
            "statusBadge": receipt.processing_status or "pending",
            "total": money(summary_total, receipt.currency),
            "stats": [
                {"value": str(item_count), "label": "товари", "icon": "basket"},
                {"label": "Знижки:", "value": money(total_discount, receipt.currency), "icon": "tag"},
                {
                    "label": "Потенційний кешбек:",
                    "value": money(expected_cashback, receipt.currency),
                    "icon": "refresh",
                },
            ],
            "totals": [
                {"label": "Разом", "value": money(summary_total, receipt.currency)},
                {"label": "Загальна знижка", "value": money(total_discount, receipt.currency)},
                {"label": "Кешбек магазину", "value": money(store_cashback_total, receipt.currency)},
                {"label": "Кешбек SmartCart", "value": money(smartcart_cashback_total, receipt.currency)},
            ],
            "expectedCashback": {
                "label": "Очікуваний сумарний кешбек",
                "value": money(expected_cashback, receipt.currency),
            },
        },
        "receiptItems": [
            {
                "name": item.item_name,
                "thumbnail": item.thumbnail or thumb_for(item.item_name, item.category),
                "quantity": f"{to_decimal(item.quantity).normalize()} {item.unit or 'шт'}",
                "unitPrice": f"{money(item.price, receipt.currency)}/{item.unit or 'шт'}",
                "total": money(item_gross_total(item), receipt.currency),
                "discount": nullable_money(item.discount_amount, receipt.currency),
                "storeCashback": nullable_money(item.store_cashback_amount, receipt.currency),
                "storeCashbackLabel": f"{to_decimal(item.store_cashback_percent).normalize()}%"
                if to_decimal(item.store_cashback_percent) > 0
                else None,
                "smartCartCashback": cashback_money(item.smartcart_cashback_amount, receipt.currency),
            }
            for item in receipt.items
        ],
    }


@app.get("/receipts/latest")
@app.get("/api/receipts/latest")
async def latest_receipt(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items))
        .order_by(Receipt.receipt_datetime.desc().nullslast(), Receipt.created_at.desc())
        .limit(1)
    )
    receipt = result.scalar_one_or_none()
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt_detail_payload(receipt)


@app.get("/receipts/{receipt_id}")
@app.get("/api/receipts/{receipt_id}")
async def get_receipt(receipt_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items))
        .where(Receipt.id == receipt_id)
    )
    receipt = result.scalar_one_or_none()
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt_detail_payload(receipt)


@app.get("/products")
@app.get("/api/products")
async def products_overview(db: AsyncSession = Depends(get_db)):
    rows = await fetch_item_rows(db)
    groups: dict[str, list[tuple[ReceiptItem, Receipt]]] = defaultdict(list)
    for item, receipt in rows:
        groups[item.item_name].append((item, receipt))

    product_cards = []
    drop_count = 0
    promo_count = 0
    for name, entries in groups.items():
        entries = sorted(entries, key=lambda row: receipt_date(row[1]), reverse=True)
        latest_item, latest_receipt = entries[0]
        previous_item = entries[1][0] if len(entries) > 1 else None
        latest_price = to_decimal(latest_item.price)
        previous_price = to_decimal(previous_item.price) if previous_item else latest_price
        diff = latest_price - previous_price
        if diff < 0:
            drop_count += 1
        has_cashback = (
            to_decimal(latest_item.store_cashback_amount) > 0
            or to_decimal(latest_item.store_cashback_percent) > 0
            or to_decimal(latest_item.smartcart_cashback_amount) > 0
        )
        if latest_item.is_promotional or to_decimal(latest_item.discount_amount) > 0:
            promo_count += 1

        first_date = receipt_date(entries[-1][1])
        last_date = receipt_date(entries[0][1])
        months = max(1, ceil(max((last_date - first_date).days, 1) / 30))
        frequency = max(1, round(len(entries) / months))
        badge = "+ кешбек" if has_cashback else "знижка" if latest_item.is_promotional else None
        badge_type = "cashback" if has_cashback else "discount" if badge else None

        product_cards.append(
            {
                "name": name,
                "thumb": latest_item.thumbnail or thumb_for(name, latest_item.category),
                "description": latest_item.brand or latest_item.category or "Товар з чеків",
                "frequency": f"купую {frequency} рази/міс",
                "price": money(latest_price, latest_receipt.currency),
                "store": latest_receipt.store or "Магазин",
                "trend": f"{signed_money(diff)} за останню покупку",
                "badge": badge,
                "badgeType": badge_type,
            }
        )

    product_cards.sort(key=lambda product: product["name"].lower())
    frequent = sorted(
        (
            {"name": name, "thumb": entries[0][0].thumbnail or thumb_for(name, entries[0][0].category)}
            for name, entries in groups.items()
        ),
        key=lambda product: len(groups[product["name"]]),
        reverse=True,
    )[:6]
    if frequent:
        frequent[0]["active"] = True

    recommendation = {
        "title": "Рекомендація дня",
        "text": "Додайте більше чеків, щоб отримати персональну рекомендацію",
    }
    falling = [product for product in product_cards if product["trend"].startswith("-")]
    if falling:
        best = falling[0]
        recommendation["text"] = f"{best['name']} дешевше в {best['store']} — {best['trend']}"

    return {
        "frequentProducts": frequent,
        "productStats": [
            {"label": "Відстежуються", "value": str(len(product_cards)), "icon": "trendUp"},
            {"label": "Зниження цін", "value": str(drop_count), "icon": "arrowDown"},
            {"label": "Кешбек/знижки", "value": str(promo_count), "icon": "cashback"},
        ],
        "products": product_cards,
        "dailyRecommendation": recommendation,
    }


@app.get("/analytics/categories")
@app.get("/api/analytics/categories")
async def analytics_categories(period: str = "1m", db: AsyncSession = Depends(get_db)):
    since = period_cutoff(period)
    rows = await fetch_item_rows(db, since=since)
    total = sum(
        (item_net_total(item) for item, _ in rows),
        Decimal("0"),
    )

    by_category = defaultdict(lambda: {"amount": Decimal("0"), "items": 0})
    for item, _ in rows:
        category = item.category or "Інше"
        by_category[category]["amount"] += item_net_total(item)
        by_category[category]["items"] += 1

    breakdown = []
    for index, (category, values) in enumerate(
        sorted(by_category.items(), key=lambda row: row[1]["amount"], reverse=True)
    ):
        key, color, color_soft, icon_name = CATEGORY_META.get(
            category.lower(),
            (f"category-{index}", "#6aa5f8", "#e8f2ff", thumb_for(None, category)),
        )
        percent = int(round((values["amount"] / total) * 100)) if total else 0
        count = values["items"]
        breakdown.append(
            {
                "key": key,
                "name": category,
                "amount": money(values["amount"]),
                "percent": percent,
                "items": f"{count} {item_word(count)}",
                "color": color,
                "colorSoft": color_soft,
                "icon": icon_name,
            }
        )

    start_label = since.strftime("%d.%m.%Y")
    end_label = datetime.utcnow().strftime("%d.%m.%Y")
    top = breakdown[0] if breakdown else None

    return {
        "analyticsSummary": {
            "title": "Покупки за категоріями",
            "subtitle": f"{start_label} – {end_label}",
            "total": money(total),
            "totalLabel": "Витрачено",
            "totalPeriod": "за період",
        },
        "categoryBreakdown": breakdown,
        "topCategory": {
            "name": top["name"] if top else "Недостатньо даних",
            "categoryName": top["name"] if top else "",
            "subtitle": f"{start_label} – {end_label}",
            "description": "Найбільша частка витрат" if top else "Додайте чеки для аналітики",
            "amount": top["amount"] if top else money(0),
            "percentText": f"{top['percent']}% від усіх витрат" if top else "0% від усіх витрат",
            "trend": "розраховано з реальних чеків" if top else "немає даних",
            "icon": top["icon"] if top else "info",
        },
    }


@app.get("/products/{product_name}/prices")
@app.get("/api/products/{product_name}/prices")
async def product_prices(
    product_name: str,
    period: str = "1m",
    db: AsyncSession = Depends(get_db),
):
    since = period_cutoff(period)
    stmt = (
        select(ReceiptItem, Receipt)
        .join(Receipt, ReceiptItem.receipt_id == Receipt.id)
        .where(func.lower(ReceiptItem.item_name) == product_name.lower())
        .where(Receipt.receipt_datetime >= since)
        .order_by(Receipt.receipt_datetime.asc().nullslast(), Receipt.created_at.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        return {
            "selectedProduct": {
                "name": product_name,
                "description": "Немає даних за обраний період",
                "price": money(0),
                "badge": "Додайте чек",
                "thumb": thumb_for(product_name),
            },
            "priceChart": {
                "title": "Динаміка ціни за 1 шт, ₴",
                "yTicks": [0, 1, 2, 3, 4],
                "xLabels": [],
            },
            "priceSeries": [],
            "storePrices": [],
            "productPriceInsight": {
                "title": "Недостатньо даних",
                "text": "Додайте чеки з цим товаром, щоб побачити динаміку.",
            },
        }

    latest_item, latest_receipt = max(rows, key=lambda row: receipt_date(row[1]))
    prices = [to_decimal(item.price) for item, _ in rows]
    min_price = min(prices)
    max_price = max(prices)
    chart_min = max(Decimal("0"), Decimal(floor(float(min_price))) - Decimal("2"))
    chart_max = Decimal(ceil(float(max_price))) + Decimal("2")
    step = max(Decimal("1"), ((chart_max - chart_min) / Decimal("6")).quantize(Decimal("0.01")))
    y_ticks = [float((chart_min + step * i).quantize(Decimal("0.01"))) for i in range(7)]

    grouped = defaultdict(list)
    for item, receipt in rows:
        grouped[receipt.store or "Магазин"].append((item, receipt))

    colors = ["#f97316", "#0f4c92", "#16a34a", "#ef1212", "#a678e8", "#6aa5f8"]
    price_series = []
    store_prices = []
    for index, (store, entries) in enumerate(grouped.items()):
        entries = sorted(entries, key=lambda row: receipt_date(row[1]))
        values = [float(to_decimal(item.price)) for item, _ in entries]
        latest_store_item = entries[-1][0]
        previous_store_item = entries[-2][0] if len(entries) > 1 else latest_store_item
        change = to_decimal(latest_store_item.price) - to_decimal(previous_store_item.price)
        logo, logo_text = logo_for(store)
        price_series.append(
            {
                "store": store,
                "color": colors[index % len(colors)],
                "values": values,
            }
        )
        store_prices.append(
            {
                "name": store,
                "logo": logo,
                "logoText": logo_text,
                "price": money(latest_store_item.price),
                "change": signed_money(change),
                "changeDirection": "down" if change < 0 else "up",
            }
        )

    best_store = min(
        grouped.items(),
        key=lambda row: to_decimal(sorted(row[1], key=lambda entry: receipt_date(entry[1]))[-1][0].price),
    )[0]
    dates = sorted({receipt_date(receipt).strftime("%d.%m") for _, receipt in rows})

    return {
        "selectedProduct": {
            "name": latest_item.item_name,
            "description": latest_item.brand or latest_item.category or "Товар з чеків",
            "price": money(latest_item.price, latest_receipt.currency),
            "badge": "Краща ціна сьогодні",
            "thumb": thumb_for(latest_item.item_name, latest_item.category),
        },
        "priceChart": {
            "title": "Динаміка ціни за 1 шт, ₴",
            "yTicks": y_ticks,
            "xLabels": dates[-5:],
        },
        "priceSeries": price_series,
        "storePrices": store_prices,
        "productPriceInsight": {
            "title": f"Найнижча остання ціна — {best_store}",
            "text": "Розраховано на основі збережених чеків за обраний період.",
        },
    }
