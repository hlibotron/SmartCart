from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from difflib import SequenceMatcher
from math import ceil, floor
from pathlib import Path
import base64
import json
import os
import re
from urllib.parse import quote
import uuid

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

try:
    from openai import AsyncOpenAI, OpenAIError
except ImportError:  # pragma: no cover - handled at runtime with a clear API error.
    AsyncOpenAI = None

    class OpenAIError(Exception):
        pass

from app.db.database import get_db
from app.db.models import (
    Product,
    ProductAlias,
    ProductMatchCandidate,
    Receipt,
    ReceiptItem,
    ReceiptOcrJob,
    Store,
    User,
)
from app.categories import PRODUCT_CATEGORIES, category_payload, get_category, normalize_category
from app.schemas import (
    MatchCandidateResolve,
    OcrReceiptParsed,
    ProductCategoryUpdate,
    ReceiptCreate,
    ReceiptCreated,
    ReceiptScanCreate,
    ReceiptScanCreated,
    ReceiptScanProcessed,
)


app = FastAPI(title="SmartCart API")

from app.routers import forecast as forecast_router
app.include_router(forecast_router.router)

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

AUTO_MATCH_THRESHOLD = Decimal("0.86")
REVIEW_MATCH_THRESHOLD = Decimal("0.65")
APP_DIR = Path(__file__).resolve().parent
RECEIPT_UPLOAD_DIR = Path(
    os.getenv("RECEIPT_UPLOAD_DIR", APP_DIR / "uploads" / "receipt-scans")
)
if not RECEIPT_UPLOAD_DIR.is_absolute():
    RECEIPT_UPLOAD_DIR = APP_DIR / RECEIPT_UPLOAD_DIR
RECEIPT_UPLOAD_PUBLIC_ROOT = RECEIPT_UPLOAD_DIR.parent
PRODUCT_IMAGE_DIR = Path(
    os.getenv("PRODUCT_IMAGE_DIR", RECEIPT_UPLOAD_PUBLIC_ROOT / "product-images")
)
if not PRODUCT_IMAGE_DIR.is_absolute():
    PRODUCT_IMAGE_DIR = APP_DIR / PRODUCT_IMAGE_DIR
CATEGORY_IMAGE_DIR = Path(
    os.getenv("CATEGORY_IMAGE_DIR", RECEIPT_UPLOAD_PUBLIC_ROOT / "category-images")
)
if not CATEGORY_IMAGE_DIR.is_absolute():
    CATEGORY_IMAGE_DIR = APP_DIR / CATEGORY_IMAGE_DIR
STORE_LOGO_DIR = Path(
    os.getenv("STORE_LOGO_DIR", RECEIPT_UPLOAD_PUBLIC_ROOT / "store-logos")
)
if not STORE_LOGO_DIR.is_absolute():
    STORE_LOGO_DIR = APP_DIR / STORE_LOGO_DIR
MAX_RECEIPT_IMAGE_BYTES = int(os.getenv("RECEIPT_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
OPENAI_RECEIPT_MODEL = os.getenv("OPENAI_RECEIPT_MODEL", "gpt-4.1-mini")
SUPPORTED_RECEIPT_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
SUPPORTED_PRODUCT_IMAGE_EXTENSIONS = (".webp", ".jpg", ".jpeg", ".png")
CATEGORY_IMAGE_STEMS = {
    "dairy": ("dairy", "milk"),
    "meat": ("meat",),
    "vegetables": ("vegetables", "carrot"),
    "fruits": ("fruits", "grapes"),
    "drinks": ("drinks", "bottle"),
    "grocery": ("grocery", "jar"),
    "other": ("other", "info"),
}
STORE_LOGO_STEMS = {
    "atb": ("atb", "атб"),
    "silpo": ("silpo", "сільпо", "silpo"),
    "novus": ("novus",),
    "auchan": ("auchan", "ашан"),
    "default": ("default",),
}

RECEIPT_EXTRACTION_PROMPT = """
You extract structured data from Ukrainian retail receipt photos.
Return only data that is visible or safely derived from visible receipt lines.

Rules:
- Use UAH unless the receipt clearly uses another currency.
- receipt_datetime must be ISO 8601 or null when date/time is not visible.
- total is the final paid amount for the whole receipt.
- item.price is unit price before item discount. If only line total is visible,
  derive unit price as line total / quantity. If quantity is not visible, use 1.
- discount_amount is the total discount for that item, not a percent.
- store_cashback_amount, store_cashback_percent, and smartcart_cashback_amount
  must be 0 unless the receipt explicitly shows those values.
- Keep raw_name as close as possible to the receipt text.
- Use item_name as a readable product name in Ukrainian when possible.
- Use thumbnail values from: milk, yogurt, eggs, coffee, banana, cheese, meat,
  carrot, grapes, bottle, jar.
- Use category values from: Молочні, М'ясні, Овочі, Фрукти, Напої, Бакалія, Інше.
- If a product category is not obvious, use Інше.
- Put all readable receipt text into ocr_raw_text, preserving line breaks.
""".strip()

RECEIPT_EXTRACTION_SCHEMA = {
    "type": "json_schema",
    "name": "receipt_extraction",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "store": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "receipt_datetime": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "total": {"anyOf": [{"type": "number"}, {"type": "null"}]},
            "currency": {"type": "string"},
            "ocr_raw_text": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "raw_name": {"type": "string"},
                        "item_name": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "price": {"type": "number"},
                        "quantity": {"type": "number"},
                        "unit": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "discount_amount": {"type": "number"},
                        "store_cashback_amount": {"type": "number"},
                        "store_cashback_percent": {"type": "number"},
                        "smartcart_cashback_amount": {"type": "number"},
                        "category": {
                            "anyOf": [
                                {
                                    "type": "string",
                                    "enum": [
                                        "Молочні",
                                        "М'ясні",
                                        "Овочі",
                                        "Фрукти",
                                        "Напої",
                                        "Бакалія",
                                        "Інше",
                                    ],
                                },
                                {"type": "null"},
                            ]
                        },
                        "brand": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "thumbnail": {
                            "anyOf": [
                                {
                                    "type": "string",
                                    "enum": [
                                        "milk",
                                        "yogurt",
                                        "eggs",
                                        "coffee",
                                        "banana",
                                        "cheese",
                                        "meat",
                                        "carrot",
                                        "grapes",
                                        "bottle",
                                        "jar",
                                    ],
                                },
                                {"type": "null"},
                            ]
                        },
                        "is_promotional": {"type": "boolean"},
                    },
                    "required": [
                        "raw_name",
                        "item_name",
                        "price",
                        "quantity",
                        "unit",
                        "discount_amount",
                        "store_cashback_amount",
                        "store_cashback_percent",
                        "smartcart_cashback_amount",
                        "category",
                        "brand",
                        "thumbnail",
                        "is_promotional",
                    ],
                },
            },
        },
        "required": [
            "store",
            "receipt_datetime",
            "total",
            "currency",
            "ocr_raw_text",
            "items",
        ],
    },
}

app.mount(
    "/uploads",
    StaticFiles(directory=RECEIPT_UPLOAD_PUBLIC_ROOT, check_dir=False),
    name="uploads",
)

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


@app.get("/home")
@app.get("/api/home")
async def home_overview(db: AsyncSession = Depends(get_db)):
    receipts_result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.product))
        .order_by(Receipt.receipt_datetime.desc().nullslast(), Receipt.created_at.desc())
    )
    receipts = receipts_result.scalars().all()
    rows = [(item, receipt) for receipt in receipts for item in receipt.items]

    receipt_count = len(receipts)
    total_spent = sum((to_decimal(receipt.total) for receipt in receipts), Decimal("0"))
    total_discount = sum(
        (
            to_decimal(receipt.total_discount)
            or sum((to_decimal(item.discount_amount) for item in receipt.items), Decimal("0"))
            for receipt in receipts
        ),
        Decimal("0"),
    )
    total_cashback = sum(
        (
            to_decimal(receipt.store_cashback_total)
            + to_decimal(receipt.smartcart_cashback_total)
            for receipt in receipts
        ),
        Decimal("0"),
    )
    if total_cashback <= 0:
        total_cashback = sum(
            (
                to_decimal(item.store_cashback_amount)
                + to_decimal(item.smartcart_cashback_amount)
                for item, _ in rows
            ),
            Decimal("0"),
        )

    metrics_payload = [
        {
            "label": "Чеки",
            "value": str(receipt_count),
            "delta": "за весь час" if receipt_count else "додайте перший чек",
            "icon": "receiptCheck",
        },
        {
            "label": "Витрати",
            "value": money(total_spent),
            "delta": f"{receipt_count} {receipt_word(receipt_count)}" if receipt_count else "немає даних",
            "icon": "wallet",
        },
        {
            "label": "Економія",
            "value": money(total_discount),
            "delta": "знижки з чеків" if total_discount > 0 else "знижок ще немає",
            "icon": "piggy",
        },
        {
            "label": "Кешбек",
            "value": money(total_cashback),
            "delta": "очікуваний кешбек" if total_cashback > 0 else "кешбек ще не знайдено",
            "icon": "refresh",
        },
    ]

    category_totals: dict[str, dict] = defaultdict(lambda: {"amount": Decimal("0"), "category": None})
    for item, _ in rows:
        category = normalize_category(item.category, raw_name=item.raw_name, item_name=item.item_name)
        category_totals[category.key]["amount"] += item_net_total(item)
        category_totals[category.key]["category"] = category

    top_category_row = None
    if category_totals:
        top_category_row = max(category_totals.values(), key=lambda value: value["amount"])

    insights = []
    if top_category_row and total_spent > 0:
        category = top_category_row["category"] or get_category("other")
        percent = int(round((top_category_row["amount"] / total_spent) * 100))
        insights.append(
            {
                "title": f"Топ категорія — {category.name}",
                "value": f"{percent}%",
                "subtitle": "усіх витрат",
                "icon": category.icon,
                "path": "/analytics",
            }
        )

    if receipts:
        latest_receipt = receipts[0]
        insights.append(
            {
                "title": f"Останній чек — {latest_receipt.store or 'Магазин'}",
                "value": money(latest_receipt.total, latest_receipt.currency),
                "subtitle": ui_datetime(receipt_date(latest_receipt)),
                "logoText": logo_for(latest_receipt.store)[1],
                "logoUrl": store_logo_url(latest_receipt.store),
                "path": f"/receipt-summary?receipt={latest_receipt.id}",
            }
        )

    insights.append(
        {
            "title": "Очікує кешбек",
            "value": money(total_cashback),
            "subtitle": "з реальних чеків" if total_cashback > 0 else "поки немає нарахувань",
            "icon": "refresh",
            "path": "/cashback",
        }
    )

    activities = []
    for receipt in receipts[:5]:
        marker = activity_marker_for_receipt(receipt)
        receipt_time = receipt_date(receipt)
        activities.append(
            {
                "title": f"Додано чек із {receipt.store or 'Магазин'}",
                "date": ui_datetime(receipt_time),
                "amount": money(receipt.total, receipt.currency),
                "positive": False,
                "path": f"/receipt-summary?receipt={receipt.id}",
                "sortAt": receipt_time.isoformat(),
                **marker,
            }
        )

    cashback_items = [
        (item, receipt)
        for item, receipt in rows
        if to_decimal(item.store_cashback_amount) + to_decimal(item.smartcart_cashback_amount) > 0
    ]
    cashback_items.sort(key=lambda row: receipt_date(row[1]), reverse=True)
    for item, receipt in cashback_items[:3]:
        amount = to_decimal(item.store_cashback_amount) + to_decimal(item.smartcart_cashback_amount)
        receipt_time = receipt_date(receipt)
        activities.append(
            {
                "title": f"Знайдено кешбек: {item.item_name}",
                "date": ui_datetime(receipt_time),
                "amount": cashback_money(amount, receipt.currency) or money(amount, receipt.currency),
                "positive": True,
                "path": "/cashback",
                "sortAt": receipt_time.isoformat(),
                **icon_marker("refresh"),
            }
        )

    discounted_items = [
        (item, receipt)
        for item, receipt in rows
        if to_decimal(item.discount_amount) > 0
    ]
    discounted_items.sort(key=lambda row: receipt_date(row[1]), reverse=True)
    for item, receipt in discounted_items[:2]:
        receipt_time = receipt_date(receipt)
        activities.append(
            {
                "title": f"Знижка на {item.item_name}",
                "date": ui_datetime(receipt_time),
                "amount": money(item.discount_amount, receipt.currency),
                "positive": True,
                "path": f"/receipt-summary?receipt={receipt.id}",
                "sortAt": receipt_time.isoformat(),
                **icon_marker("tag"),
            }
        )

    activities.sort(key=lambda activity: activity.get("sortAt", ""), reverse=True)
    activities = activities[:8]
    for activity in activities:
        activity.pop("sortAt", None)
    if not activities:
        activities.append(
            {
                "title": "Ще немає активності",
                "date": "Додайте перший чек",
                "amount": "",
                "positive": False,
                "path": "/",
                **icon_marker("info"),
            }
        )

    return {
        "metrics": metrics_payload,
        "insights": insights[:3],
        "activities": activities,
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


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.lower().replace("’", "'")
    normalized = re.sub(r"[^0-9a-zа-яіїєґ%.' ]+", " ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def display_name_from_raw(value: str) -> str:
    normalized = normalize_name(value)
    return normalized[:1].upper() + normalized[1:] if normalized else value.strip()


def receipt_date(receipt: Receipt) -> datetime:
    return receipt.receipt_datetime or receipt.created_at or datetime.utcnow()


def ui_datetime(value: datetime | None) -> str:
    date = value or datetime.utcnow()
    return date.strftime("%d.%m.%Y · %H:%M")


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


def image_slug(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.lower().replace("’", "'").replace("`", "'").replace("ʼ", "'")
    normalized = re.sub(r"[^\w]+", "-", normalized, flags=re.UNICODE)
    normalized = re.sub(r"-+", "-", normalized).strip("-_")
    return normalized


def upload_url_for_file(path: Path) -> str | None:
    try:
        relative_path = path.relative_to(RECEIPT_UPLOAD_PUBLIC_ROOT)
    except ValueError:
        return None
    return "/uploads/" + "/".join(quote(part) for part in relative_path.parts)


def image_url_from_stems(
    stems: list[str] | tuple[str, ...],
    *,
    image_dir: Path,
) -> str | None:
    for stem in stems:
        for extension in SUPPORTED_PRODUCT_IMAGE_EXTENSIONS:
            candidate = image_dir / f"{stem}{extension}"
            if candidate.is_file():
                return upload_url_for_file(candidate)
    return None


def product_image_url(product: Product | None, item: ReceiptItem) -> str | None:
    configured_url = getattr(product, "image_url", None) if product else None
    if configured_url:
        return configured_url

    candidate_stems: list[str] = []
    if product and product.id:
        candidate_stems.extend([f"product-{product.id}", str(product.id)])

    for value in (
        getattr(product, "name", None) if product else None,
        item.item_name,
        item.raw_name,
        normalize_name(item.raw_name),
    ):
        slug = image_slug(value)
        if slug and slug not in candidate_stems:
            candidate_stems.append(slug)

    return image_url_from_stems(candidate_stems, image_dir=PRODUCT_IMAGE_DIR)


def category_image_url(category_key: str) -> str | None:
    return image_url_from_stems(
        CATEGORY_IMAGE_STEMS.get(category_key, ("other", "info")),
        image_dir=CATEGORY_IMAGE_DIR,
    )


def product_visual_payload(item: ReceiptItem) -> dict[str, str | None]:
    product = item.product
    product_category = getattr(product, "category", None) if product else None
    category = normalize_category(
        item.category,
        raw_name=item.raw_name,
        item_name=item.item_name,
        product_category=product_category,
    )
    fallback_thumb = (
        item.thumbnail
        or (getattr(product, "thumbnail", None) if product else None)
        or category.icon
        or thumb_for(item.item_name, category.name)
    )
    image_url = product_image_url(product, item)
    category_url = None if image_url else category_image_url(category.key)
    visual_url = image_url or category_url

    return {
        "type": "product-image" if image_url else "category-image" if category_url else "missing-image",
        "url": visual_url,
        "thumb": fallback_thumb,
        "categoryKey": category.key,
        "alt": item.item_name if image_url else category.name,
    }


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


def store_logo_url(store: str | None) -> str | None:
    logo_key, logo_text = logo_for(store)
    candidate_stems: list[str] = []

    for stem in STORE_LOGO_STEMS.get(logo_key, ()):
        if stem not in candidate_stems:
            candidate_stems.append(stem)

    for value in (store, logo_text):
        slug = image_slug(value)
        if slug and slug not in candidate_stems:
            candidate_stems.append(slug)

    return image_url_from_stems(candidate_stems, image_dir=STORE_LOGO_DIR)


def item_word(count: int) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return "товар"
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return "товари"
    return "товарів"


def receipt_word(count: int) -> str:
    if count % 10 == 1 and count % 100 != 11:
        return "чек"
    if count % 10 in (2, 3, 4) and count % 100 not in (12, 13, 14):
        return "чеки"
    return "чеків"


async def fetch_item_rows(db: AsyncSession, *, since: datetime | None = None):
    stmt = (
        select(ReceiptItem, Receipt)
        .join(Receipt, ReceiptItem.receipt_id == Receipt.id)
        .options(selectinload(ReceiptItem.product))
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


async def upsert_product_values(
    db: AsyncSession,
    *,
    name: str,
    category: str | None = None,
    brand: str | None = None,
    unit: str | None = "шт",
    thumbnail: str | None = None,
    has_cashback: bool = False,
) -> Product:
    normalized_category = normalize_category(category, raw_name=name, item_name=name)
    result = await db.execute(
        select(Product).where(func.lower(Product.name) == name.lower())
    )
    product = result.scalar_one_or_none()
    thumbnail = thumbnail or thumb_for(name, normalized_category.name)

    if product is None:
        product = Product(
            name=name,
            description=brand
            or (normalized_category.name if normalized_category.key != "other" else None)
            or "Товар з чеків",
            category=normalized_category.name,
            brand=brand,
            unit=unit or "шт",
            thumbnail=thumbnail,
            has_cashback=has_cashback,
        )
        db.add(product)
        await db.flush()
    else:
        current_category = normalize_category(
            product.category,
            raw_name=name,
            item_name=name,
        )
        if current_category.key == "other" and normalized_category.key != "other":
            current_category = normalized_category
        product.description = (
            product.description
            or brand
            or (current_category.name if current_category.key != "other" else None)
            or "Товар з чеків"
        )
        product.category = current_category.name
        product.brand = product.brand or brand
        product.unit = product.unit or unit or "шт"
        product.thumbnail = product.thumbnail or thumbnail
        product.has_cashback = product.has_cashback or has_cashback

    return product


async def upsert_product(db: AsyncSession, item) -> Product:
    has_cashback = (
        item.store_cashback_amount > 0
        or item.store_cashback_percent > 0
        or item.smartcart_cashback_amount > 0
    )
    return await upsert_product_values(
        db,
        name=item.item_name,
        category=item.category,
        brand=item.brand,
        unit=item.unit or "шт",
        thumbnail=item.thumbnail,
        has_cashback=has_cashback,
    )


def activity_marker_for_receipt(receipt: Receipt) -> dict[str, str | None]:
    logo, logo_text = logo_for(receipt.store)
    logo_url = store_logo_url(receipt.store)
    if logo_url:
        return {"type": "logo-image", "logo": logo, "logoText": logo_text, "logoUrl": logo_url, "icon": None}
    return {"type": "logo", "logo": logo, "logoText": logo_text, "logoUrl": None, "icon": None}


def icon_marker(icon_name: str) -> dict[str, str | None]:
    return {"type": "icon", "logo": None, "logoText": None, "logoUrl": None, "icon": icon_name}


async def ensure_alias(
    db: AsyncSession,
    *,
    product_id: int,
    store_id: int | None,
    raw_name: str,
    confidence: Decimal = Decimal("1"),
):
    normalized = normalize_name(raw_name)
    if not normalized:
        return

    stmt = select(ProductAlias).where(
        ProductAlias.product_id == product_id,
        ProductAlias.normalized_name == normalized,
    )
    if store_id:
        stmt = stmt.where(ProductAlias.store_id == store_id)

    result = await db.execute(stmt)
    alias = result.scalar_one_or_none()

    if alias is None:
        db.add(
            ProductAlias(
                product_id=product_id,
                store_id=store_id,
                raw_name=raw_name,
                normalized_name=normalized,
                confidence=confidence,
            )
        )


async def find_product_match(
    db: AsyncSession,
    *,
    raw_name: str,
    parsed_name: str | None,
    store_id: int | None,
) -> dict:
    normalized_raw = normalize_name(raw_name)
    normalized_parsed = normalize_name(parsed_name)

    alias_stmt = select(ProductAlias).where(ProductAlias.normalized_name == normalized_raw)
    if store_id:
        alias_stmt = alias_stmt.where(
            (ProductAlias.store_id == store_id) | (ProductAlias.store_id.is_(None))
        )
    alias_result = await db.execute(alias_stmt.options(selectinload(ProductAlias.product)))
    alias = alias_result.scalars().first()
    if alias and alias.product:
        return {
            "product": alias.product,
            "confidence": to_decimal(alias.confidence) or Decimal("1"),
            "match_type": "alias",
            "status": "matched",
        }

    products_result = await db.execute(select(Product))
    products = products_result.scalars().all()

    best_product = None
    best_score = Decimal("0")
    best_type = "unmatched"
    for product in products:
        product_name = normalize_name(product.name)
        candidates = [normalized_raw]
        if normalized_parsed:
            candidates.append(normalized_parsed)

        for candidate in candidates:
            if not candidate:
                continue
            if candidate == product_name:
                return {
                    "product": product,
                    "confidence": Decimal("1"),
                    "match_type": "exact",
                    "status": "matched",
                }

            score = Decimal(str(round(SequenceMatcher(None, candidate, product_name).ratio(), 2)))
            if score > best_score:
                best_product = product
                best_score = score
                best_type = "fuzzy"

    if best_product and best_score >= AUTO_MATCH_THRESHOLD:
        return {
            "product": best_product,
            "confidence": best_score,
            "match_type": best_type,
            "status": "matched",
        }

    if best_product and best_score >= REVIEW_MATCH_THRESHOLD:
        return {
            "product": best_product,
            "confidence": best_score,
            "match_type": best_type,
            "status": "pending",
        }

    return {
        "product": None,
        "confidence": Decimal("0"),
        "match_type": "new_product",
        "status": "pending",
    }


async def get_or_create_user(
    db: AsyncSession,
    *,
    telegram_id: int,
    username: str | None = None,
) -> User:
    user_result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        user = User(telegram_id=telegram_id, username=username)
        db.add(user)
        await db.flush()
    elif username and user.username != username:
        user.username = username

    return user


async def save_receipt_upload(image: UploadFile) -> tuple[str, str, bytes]:
    content_type = (image.content_type or "").split(";")[0].lower()
    if content_type not in SUPPORTED_RECEIPT_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Use JPEG, PNG, WEBP, or GIF.",
        )

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Receipt image is empty")
    if len(image_bytes) > MAX_RECEIPT_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Receipt image is too large. Max size is {MAX_RECEIPT_IMAGE_BYTES} bytes.",
        )

    RECEIPT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    extension = SUPPORTED_RECEIPT_IMAGE_TYPES[content_type]
    filename = f"{uuid.uuid4().hex}{extension}"
    file_path = RECEIPT_UPLOAD_DIR / filename
    file_path.write_bytes(image_bytes)

    public_url = f"/uploads/{RECEIPT_UPLOAD_DIR.name}/{filename}"
    return public_url, content_type, image_bytes


def openai_response_text(response) -> str:
    output_text = getattr(response, "output_text", None)
    if output_text:
        return output_text

    response_data = response.model_dump() if hasattr(response, "model_dump") else {}
    for output in response_data.get("output", []):
        for content in output.get("content", []):
            if content.get("type") in {"output_text", "text"} and content.get("text"):
                return content["text"]

    raise HTTPException(status_code=502, detail="OpenAI response did not contain text output")


async def extract_receipt_from_image(
    *,
    image_bytes: bytes,
    content_type: str,
) -> OcrReceiptParsed:
    if AsyncOpenAI is None:
        raise HTTPException(
            status_code=500,
            detail="OpenAI SDK is not installed. Run: pip install -r app/requirements.txt",
        )
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    client = AsyncOpenAI()

    try:
        response = await client.responses.create(
            model=OPENAI_RECEIPT_MODEL,
            input=[
                {
                    "role": "system",
                    "content": RECEIPT_EXTRACTION_PROMPT,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "Extract the receipt into the required JSON schema.",
                        },
                        {
                            "type": "input_image",
                            "image_url": f"data:{content_type};base64,{image_base64}",
                            "detail": "high",
                        },
                    ],
                },
            ],
            text={"format": RECEIPT_EXTRACTION_SCHEMA},
        )
    except OpenAIError as error:
        raise HTTPException(status_code=502, detail=f"OpenAI receipt extraction failed: {error}") from error

    try:
        return OcrReceiptParsed.model_validate_json(openai_response_text(response))
    except (ValidationError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail=f"Invalid receipt JSON from OpenAI: {error}") from error


async def persist_processed_receipt_scan(
    *,
    db: AsyncSession,
    job: ReceiptOcrJob,
    payload: OcrReceiptParsed,
) -> ReceiptScanProcessed:
    if not payload.items:
        raise HTTPException(status_code=422, detail="Parsed receipt must include at least one item")

    store = await upsert_store(db, payload.store)
    store_id = store.id if store else None

    total_discount = sum((item.discount_amount for item in payload.items), Decimal("0"))
    store_cashback_total = sum(
        (item.store_cashback_amount for item in payload.items),
        Decimal("0"),
    )
    smartcart_cashback_total = sum(
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
        user_id=job.user_id,
        store=payload.store,
        receipt_datetime=payload.receipt_datetime or datetime.utcnow(),
        total=payload.total if payload.total is not None else calculated_total,
        currency=payload.currency,
        total_discount=total_discount,
        store_cashback_total=store_cashback_total,
        smartcart_cashback_total=smartcart_cashback_total,
        image_url=job.image_url,
        ocr_raw_text=payload.ocr_raw_text or job.ocr_raw_text,
        processing_status="processed",
    )
    db.add(receipt)
    await db.flush()

    matched_items = 0
    pending_items = 0
    for item in payload.items:
        parsed_name = item.item_name or display_name_from_raw(item.raw_name)
        payload_category = normalize_category(
            item.category,
            raw_name=item.raw_name,
            item_name=parsed_name,
        )
        match = await find_product_match(
            db,
            raw_name=item.raw_name,
            parsed_name=parsed_name,
            store_id=store_id,
        )
        product = match["product"]
        match_status = match["status"]
        confidence = match["confidence"]
        match_type = match["match_type"]

        if product is None:
            product = await upsert_product_values(
                db,
                name=parsed_name,
                category=payload_category.name,
                brand=item.brand,
                unit=item.unit or "шт",
                thumbnail=item.thumbnail,
                has_cashback=(
                    item.store_cashback_amount > 0
                    or item.store_cashback_percent > 0
                    or item.smartcart_cashback_amount > 0
                ),
            )
            match_type = "new_product"
            match_status = "pending"

        product_category = normalize_category(
            None,
            raw_name=item.raw_name,
            item_name=parsed_name,
            product_category=product.category,
        )
        if product_category.key == "other" and payload_category.key != "other":
            product_category = payload_category
        product.category = product_category.name

        if match_status == "matched":
            matched_items += 1
            await ensure_alias(
                db,
                product_id=product.id,
                store_id=store_id,
                raw_name=item.raw_name,
                confidence=confidence,
            )
        else:
            pending_items += 1

        receipt_item = ReceiptItem(
            receipt_id=receipt.id,
            product_id=product.id,
            raw_name=item.raw_name,
            item_name=product.name if match_status == "matched" else parsed_name,
            price=item.price,
            quantity=item.quantity,
            unit=item.unit or "шт",
            discount_amount=item.discount_amount,
            store_cashback_amount=item.store_cashback_amount,
            store_cashback_percent=item.store_cashback_percent,
            smartcart_cashback_amount=item.smartcart_cashback_amount,
            category=product_category.name,
            brand=item.brand,
            thumbnail=item.thumbnail or product.thumbnail,
            is_promotional=item.is_promotional,
            match_confidence=confidence,
            match_status=match_status,
        )
        db.add(receipt_item)
        await db.flush()

        if match_status != "matched":
            db.add(
                ProductMatchCandidate(
                    receipt_ocr_job_id=job.id,
                    receipt_item_id=receipt_item.id,
                    product_id=product.id,
                    raw_name=item.raw_name,
                    normalized_name=normalize_name(item.raw_name),
                    confidence=confidence,
                    match_type=match_type,
                    status="pending",
                )
            )

    job.receipt_id = receipt.id
    job.ocr_raw_text = payload.ocr_raw_text or job.ocr_raw_text
    job.processing_status = "processed"
    job.processed_at = datetime.utcnow()

    await db.commit()

    return ReceiptScanProcessed(
        scan_id=job.id,
        receipt_id=receipt.id,
        status=job.processing_status,
        matched_items=matched_items,
        pending_items=pending_items,
    )


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
        product = await upsert_product(db, item)
        item_category = normalize_category(
            item.category,
            raw_name=item.raw_name,
            item_name=item.item_name,
            product_category=product.category,
        )
        product.category = item_category.name
        receipt_items.append(
            ReceiptItem(
                receipt_id=receipt.id,
                product_id=product.id,
                raw_name=item.raw_name,
                item_name=item.item_name,
                price=item.price,
                quantity=item.quantity,
                unit=item.unit or "шт",
                discount_amount=item.discount_amount,
                store_cashback_amount=item.store_cashback_amount,
                store_cashback_percent=item.store_cashback_percent,
                smartcart_cashback_amount=item.smartcart_cashback_amount,
                category=item_category.name,
                brand=item.brand,
                thumbnail=item.thumbnail or product.thumbnail,
                is_promotional=item.is_promotional,
                match_confidence=Decimal("1"),
                match_status="manual",
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
        logo_url = store_logo_url(receipt.store)
        cards.append(
            {
                "id": receipt.id,
                "store": receipt.store or "Магазин",
                "date": date.strftime("%d.%m.%Y"),
                "items": f"{item_count} {item_word(item_count)}",
                "amount": money(receipt.total, receipt.currency),
                "logo": logo,
                "logoText": logo_text,
                "logoUrl": logo_url,
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
    logo_url = store_logo_url(receipt.store)
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

    def receipt_item_payload(item: ReceiptItem) -> dict:
        visual = product_visual_payload(item)
        return {
            "productId": item.product_id,
            "name": item.item_name,
            "thumbnail": visual["thumb"],
            "visual": visual,
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

    return {
        "receiptSummary": {
            "store": receipt.store or "Магазин",
            "logo": logo,
            "logoText": logo_text,
            "logoUrl": logo_url,
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
        "receiptItems": [receipt_item_payload(item) for item in receipt.items],
    }


@app.get("/receipts/latest")
@app.get("/api/receipts/latest")
async def latest_receipt(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Receipt)
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.product))
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
        .options(selectinload(Receipt.items).selectinload(ReceiptItem.product))
        .where(Receipt.id == receipt_id)
    )
    receipt = result.scalar_one_or_none()
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt_detail_payload(receipt)


@app.post("/receipt-scans", response_model=ReceiptScanCreated)
@app.post("/api/receipt-scans", response_model=ReceiptScanCreated)
async def create_receipt_scan(payload: ReceiptScanCreate, db: AsyncSession = Depends(get_db)):
    user = await get_or_create_user(
        db,
        telegram_id=payload.user.telegram_id,
        username=payload.user.username,
    )
    job = ReceiptOcrJob(
        user_id=user.id,
        image_url=payload.image_url,
        ocr_raw_text=payload.ocr_raw_text,
        provider=payload.provider,
        processing_status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return ReceiptScanCreated(id=job.id, status=job.processing_status)


@app.post("/receipt-scans/upload", response_model=ReceiptScanProcessed)
@app.post("/api/receipt-scans/upload", response_model=ReceiptScanProcessed)
async def upload_receipt_scan(
    image: UploadFile = File(...),
    telegram_id: int = Form(1001),
    username: str | None = Form("demo"),
    db: AsyncSession = Depends(get_db),
):
    public_url, content_type, image_bytes = await save_receipt_upload(image)
    user = await get_or_create_user(db, telegram_id=telegram_id, username=username)

    job = ReceiptOcrJob(
        user_id=user.id,
        image_url=public_url,
        provider="openai",
        processing_status="processing",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    try:
        parsed_receipt = await extract_receipt_from_image(
            image_bytes=image_bytes,
            content_type=content_type,
        )
        return await persist_processed_receipt_scan(
            db=db,
            job=job,
            payload=parsed_receipt,
        )
    except HTTPException as error:
        job.processing_status = "failed"
        job.error_message = str(error.detail)
        await db.commit()
        raise


@app.post("/receipt-scans/{scan_id}/parsed", response_model=ReceiptScanProcessed)
@app.post("/api/receipt-scans/{scan_id}/parsed", response_model=ReceiptScanProcessed)
async def process_receipt_scan(
    scan_id: int,
    payload: OcrReceiptParsed,
    db: AsyncSession = Depends(get_db),
):
    job_result = await db.execute(select(ReceiptOcrJob).where(ReceiptOcrJob.id == scan_id))
    job = job_result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Receipt scan not found")
    return await persist_processed_receipt_scan(db=db, job=job, payload=payload)


@app.get("/product-match-candidates")
@app.get("/api/product-match-candidates")
async def list_match_candidates(
    status: str = "pending",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductMatchCandidate)
        .where(ProductMatchCandidate.status == status)
        .order_by(ProductMatchCandidate.created_at.desc())
    )
    candidates = result.scalars().all()
    return {
        "candidates": [
            {
                "id": candidate.id,
                "receiptOcrJobId": candidate.receipt_ocr_job_id,
                "receiptItemId": candidate.receipt_item_id,
                "productId": candidate.product_id,
                "rawName": candidate.raw_name,
                "normalizedName": candidate.normalized_name,
                "confidence": float(to_decimal(candidate.confidence)),
                "matchType": candidate.match_type,
                "status": candidate.status,
            }
            for candidate in candidates
        ]
    }


@app.post("/product-match-candidates/{candidate_id}/resolve")
@app.post("/api/product-match-candidates/{candidate_id}/resolve")
async def resolve_match_candidate(
    candidate_id: int,
    payload: MatchCandidateResolve,
    db: AsyncSession = Depends(get_db),
):
    candidate_result = await db.execute(
        select(ProductMatchCandidate).where(ProductMatchCandidate.id == candidate_id)
    )
    candidate = candidate_result.scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Match candidate not found")

    product_result = await db.execute(select(Product).where(Product.id == payload.product_id))
    product = product_result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    item_result = await db.execute(
        select(ReceiptItem).where(ReceiptItem.id == candidate.receipt_item_id)
    )
    receipt_item = item_result.scalar_one_or_none()
    if receipt_item:
        payload_category = normalize_category(
            receipt_item.category,
            raw_name=receipt_item.raw_name,
            item_name=receipt_item.item_name,
        )
        item_category = normalize_category(
            None,
            raw_name=receipt_item.raw_name,
            item_name=receipt_item.item_name,
            product_category=product.category,
        )
        if item_category.key == "other" and payload_category.key != "other":
            item_category = payload_category
        product.category = item_category.name
        receipt_item.product_id = product.id
        receipt_item.item_name = product.name
        receipt_item.category = item_category.name
        receipt_item.thumbnail = receipt_item.thumbnail or product.thumbnail
        receipt_item.match_status = "matched"
        receipt_item.match_confidence = Decimal("1")

    if payload.create_alias:
        await ensure_alias(
            db,
            product_id=product.id,
            store_id=None,
            raw_name=candidate.raw_name,
            confidence=Decimal("1"),
        )

    candidate.product_id = product.id
    candidate.confidence = Decimal("1")
    candidate.status = "resolved"
    candidate.resolved_at = datetime.utcnow()

    await db.commit()
    return {"status": "ok", "candidateId": candidate.id, "productId": product.id}


@app.patch("/products/{product_id}/category")
@app.patch("/api/products/{product_id}/category")
async def update_product_category(
    product_id: int,
    payload: ProductCategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    if payload.categoryKey not in PRODUCT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unknown product category")

    product_result = await db.execute(select(Product).where(Product.id == product_id))
    product = product_result.scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    category = get_category(payload.categoryKey)
    product.category = category.name
    product.thumbnail = product.thumbnail or category.icon

    items_result = await db.execute(
        select(ReceiptItem).where(ReceiptItem.product_id == product.id)
    )
    updated_items = 0
    for receipt_item in items_result.scalars().all():
        receipt_item.category = category.name
        receipt_item.thumbnail = receipt_item.thumbnail or product.thumbnail
        updated_items += 1

    await db.commit()
    return {
        "status": "ok",
        "productId": product.id,
        "category": category_payload(category),
        "updatedItems": updated_items,
    }


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
        visual = product_visual_payload(latest_item)

        product_cards.append(
            {
                "productId": latest_item.product_id,
                "name": name,
                "thumb": visual["thumb"],
                "visual": visual,
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
            {
                "name": name,
                "thumb": product_visual_payload(entries[0][0])["thumb"],
                "visual": product_visual_payload(entries[0][0]),
            }
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

    by_category = defaultdict(lambda: {"amount": Decimal("0"), "items": 0, "category": None})
    for item, _ in rows:
        category = normalize_category(
            item.category,
            raw_name=item.raw_name,
            item_name=item.item_name,
        )
        by_category[category.key]["category"] = category
        by_category[category.key]["amount"] += item_net_total(item)
        by_category[category.key]["items"] += 1

    breakdown = []
    for _, values in sorted(
        by_category.items(), key=lambda row: row[1]["amount"], reverse=True
    ):
        category = values["category"] or get_category("other")
        category_meta = category_payload(category)
        percent = int(round((values["amount"] / total) * 100)) if total else 0
        count = values["items"]
        breakdown.append(
            {
                **category_meta,
                "amount": money(values["amount"]),
                "percent": percent,
                "items": f"{count} {item_word(count)}",
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
            "key": top["key"] if top else "other",
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


@app.get("/analytics/categories/{category_key}")
@app.get("/api/analytics/categories/{category_key}")
async def analytics_category_detail(
    category_key: str,
    period: str = "1m",
    db: AsyncSession = Depends(get_db),
):
    if category_key not in PRODUCT_CATEGORIES:
        raise HTTPException(status_code=404, detail="Category not found")

    selected_category = get_category(category_key)
    since = period_cutoff(period)
    rows = await fetch_item_rows(db, since=since)
    overall_total = sum((item_net_total(item) for item, _ in rows), Decimal("0"))

    category_rows = []
    for item, receipt in rows:
        product_category = getattr(item.product, "category", None) if item.product else None
        item_category = normalize_category(
            item.category,
            raw_name=item.raw_name,
            item_name=item.item_name,
            product_category=product_category,
        )
        if item_category.key == selected_category.key:
            category_rows.append((item, receipt))

    category_total = sum((item_net_total(item) for item, _ in category_rows), Decimal("0"))
    item_count = len(category_rows)
    receipt_ids = {receipt.id for _, receipt in category_rows}
    receipt_count = len(receipt_ids)
    percent = int(round((category_total / overall_total) * 100)) if overall_total else 0
    average_item = category_total / item_count if item_count else Decimal("0")

    products_by_name: dict[str, dict] = defaultdict(
        lambda: {
            "amount": Decimal("0"),
            "items": 0,
            "latestItem": None,
            "latestReceipt": None,
        }
    )
    receipts_by_id: dict[int, dict] = {}

    for item, receipt in category_rows:
        item_total = item_net_total(item)
        product_bucket = products_by_name[item.item_name]
        product_bucket["amount"] += item_total
        product_bucket["items"] += 1
        if (
            product_bucket["latestReceipt"] is None
            or receipt_date(receipt) > receipt_date(product_bucket["latestReceipt"])
        ):
            product_bucket["latestItem"] = item
            product_bucket["latestReceipt"] = receipt

        receipt_bucket = receipts_by_id.setdefault(
            receipt.id,
            {
                "receipt": receipt,
                "amount": Decimal("0"),
                "items": 0,
            },
        )
        receipt_bucket["amount"] += item_total
        receipt_bucket["items"] += 1

    top_products = []
    for name, values in sorted(
        products_by_name.items(), key=lambda row: row[1]["amount"], reverse=True
    )[:8]:
        latest_item = values["latestItem"]
        latest_receipt = values["latestReceipt"]
        top_products.append(
            {
                "name": name,
                "amount": money(values["amount"], getattr(latest_receipt, "currency", None)),
                "items": f"{values['items']} {item_word(values['items'])}",
                "latestPrice": money(
                    getattr(latest_item, "price", Decimal("0")),
                    getattr(latest_receipt, "currency", None),
                ),
                "store": getattr(latest_receipt, "store", None) or "Магазин",
                "visual": product_visual_payload(latest_item) if latest_item else None,
            }
        )

    recent_receipts = []
    for values in sorted(
        receipts_by_id.values(),
        key=lambda row: receipt_date(row["receipt"]),
        reverse=True,
    )[:6]:
        receipt = values["receipt"]
        logo, logo_text = logo_for(receipt.store)
        recent_receipts.append(
            {
                "id": receipt.id,
                "store": receipt.store or "Магазин",
                "date": receipt_date(receipt).strftime("%d.%m.%Y"),
                "amount": money(values["amount"], receipt.currency),
                "items": f"{values['items']} {item_word(values['items'])}",
                "logo": logo,
                "logoText": logo_text,
                "logoUrl": store_logo_url(receipt.store),
            }
        )

    start_label = since.strftime("%d.%m.%Y")
    end_label = datetime.utcnow().strftime("%d.%m.%Y")

    return {
        "category": category_payload(selected_category),
        "summary": {
            "title": selected_category.name,
            "subtitle": f"{start_label} – {end_label}",
            "total": money(category_total),
            "percentText": f"{percent}% від усіх витрат",
            "items": f"{item_count} {item_word(item_count)}",
            "receipts": f"{receipt_count} {receipt_word(receipt_count)}",
            "averageItem": money(average_item),
        },
        "stats": [
            {"label": "Витрачено", "value": money(category_total), "icon": "wallet"},
            {"label": "Частка", "value": f"{percent}%", "icon": "analytics"},
            {"label": "Товарів", "value": str(item_count), "icon": "basket"},
            {"label": "Середній товар", "value": money(average_item), "icon": "tag"},
        ],
        "topProducts": top_products,
        "recentReceipts": recent_receipts,
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
        .options(selectinload(ReceiptItem.product))
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
    visual = product_visual_payload(latest_item)
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
        logo_url = store_logo_url(store)
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
                "logoUrl": logo_url,
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
            "thumb": visual["thumb"],
            "visual": visual,
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
