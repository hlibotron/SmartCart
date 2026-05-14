import argparse
import asyncio
import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.categories import normalize_category
from app.db.database import AsyncSessionLocal
from app.db.models import Product, ProductAlias, ProductListing, ProductPrice, Store
from app.db.schema import ensure_schema
from app.db.database import engine


OFFICIAL_SOURCE_TYPE = "official_store_site"
OFFICIAL_PRICE_SCOPE = "official_online_reference"


class ProductJsonItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    price: Decimal = Field(ge=0)
    currency: str = Field(default="UAH", max_length=10)
    unit: str | None = Field(default=None, max_length=30)
    quantity: Decimal | None = Field(default=None, ge=0)
    price_per_unit: Decimal | None = Field(default=None, ge=0)
    availability: bool = True
    shop: str = Field(min_length=1, max_length=255)
    product_url: str | None = None
    image_url: str | None = None

    @field_validator("brand", "category", "unit", "product_url", "image_url", mode="before")
    @classmethod
    def empty_string_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("brand", mode="after")
    @classmethod
    def normalize_unknown_brand(cls, value):
        if value and value.strip().lower() == "unknown":
            return None
        return value.strip() if value else None

    @field_validator("currency", mode="after")
    @classmethod
    def normalize_currency(cls, value):
        return value.strip().upper() or "UAH"


@dataclass
class ImportStats:
    files: int = 0
    records: int = 0
    invalid: int = 0
    duplicates: int = 0
    created_stores: int = 0
    created_products: int = 0
    updated_products: int = 0
    created_listings: int = 0
    updated_listings: int = 0
    created_prices: int = 0
    skipped_prices: int = 0
    created_aliases: int = 0
    skipped_unavailable_without_price: int = 0
    errors: list[str] = field(default_factory=list)
    dry_run_stores: set[str] = field(default_factory=set, repr=False)
    dry_run_products: set[str] = field(default_factory=set, repr=False)
    dry_run_listings: set[tuple[str, str, str, str]] = field(default_factory=set, repr=False)
    dry_run_aliases: set[tuple[str, str, str]] = field(default_factory=set, repr=False)


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.lower().replace("’", "'")
    normalized = re.sub(r"[^0-9a-zа-яіїєґ%.' ]+", " ", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def normalize_unit(value: str | None) -> str | None:
    if not value:
        return None
    unit = value.strip().lower()
    unit = unit.replace("liter", "l").replace("litre", "l")
    unit = unit.replace("kilogram", "kg").replace("gram", "g")
    mapping = {
        "l": "л",
        "л": "л",
        "lt": "л",
        "ml": "мл",
        "мл": "мл",
        "kg": "кг",
        "кг": "кг",
        "g": "г",
        "гр": "г",
        "г": "г",
        "шт": "шт",
        "pcs": "шт",
        "piece": "шт",
        "unit": "шт",
    }
    return mapping.get(unit, unit[:30])


PACKAGE_RE = re.compile(
    r"(?P<quantity>\d+(?:[,.]\d+)?)\s*(?P<unit>мл|ml|л|l|кг|kg|гр|г|g|шт|pcs)\b",
    flags=re.IGNORECASE,
)


def decimal_from_text(value: str) -> Decimal | None:
    try:
        return Decimal(value.replace(",", "."))
    except (InvalidOperation, AttributeError):
        return None


def package_from_item(item: ProductJsonItem) -> tuple[Decimal | None, str | None]:
    match = PACKAGE_RE.search(item.name)
    if match:
        quantity = decimal_from_text(match.group("quantity"))
        unit = normalize_unit(match.group("unit"))
        if quantity is not None and unit:
            return quantity, unit

    unit = normalize_unit(item.unit)
    if item.quantity is not None and unit:
        return item.quantity, unit

    return None, unit


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
    if "varus" in normalized or "варус" in normalized:
        return "default", "Varus"
    if "novus" in normalized:
        return "novus", "NOVUS"
    if "ашан" in normalized or "auchan" in normalized:
        return "auchan", "Ашан"
    return "default", store_name[:8]


def safe_zip_names(zip_path: Path) -> list[str]:
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
    unsafe = [
        name
        for name in names
        if name.startswith("/")
        or "\\" in name
        or any(part == ".." for part in Path(name).parts)
        or (not name.endswith("/") and not name.lower().endswith(".json"))
    ]
    if unsafe:
        raise ValueError(f"Unsafe or unsupported ZIP entries in {zip_path}: {unsafe[:5]}")
    return [name for name in names if name.lower().endswith(".json")]


def load_json_payload(label: str, raw: str) -> list[dict[str, Any]]:
    payload = json.loads(raw)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return [payload]
    raise ValueError(f"{label}: expected JSON object or array")


def iter_json_payloads(path: Path):
    if path.is_dir():
        for json_path in sorted(path.rglob("*.json")):
            yield str(json_path), load_json_payload(str(json_path), json_path.read_text(encoding="utf-8-sig"))
        return

    if path.suffix.lower() == ".json":
        yield str(path), load_json_payload(str(path), path.read_text(encoding="utf-8-sig"))
        return

    if path.suffix.lower() == ".zip":
        names = safe_zip_names(path)
        with zipfile.ZipFile(path) as archive:
            for name in sorted(names):
                with archive.open(name) as handle:
                    raw = handle.read().decode("utf-8-sig")
                yield f"{path}:{name}", load_json_payload(f"{path}:{name}", raw)
        return

    raise ValueError(f"Unsupported import path: {path}")


async def get_or_create_store(
    db: AsyncSession,
    *,
    name: str,
    dry_run: bool,
    stats: ImportStats,
) -> Store:
    if dry_run:
        store_key = name.lower()
        if store_key not in stats.dry_run_stores:
            stats.created_stores += 1
            stats.dry_run_stores.add(store_key)
        logo, logo_text = logo_for(name)
        return Store(name=name, logo=logo, logo_text=logo_text)

    result = await db.execute(select(Store).where(func.lower(Store.name) == name.lower()))
    store = result.scalar_one_or_none()
    logo, logo_text = logo_for(name)
    if store:
        store.logo = store.logo or logo
        store.logo_text = store.logo_text or logo_text
        return store

    stats.created_stores += 1
    store = Store(name=name, logo=logo, logo_text=logo_text)
    if not dry_run:
        db.add(store)
        await db.flush()
    return store


async def find_or_create_product(
    db: AsyncSession,
    *,
    item: ProductJsonItem,
    normalized_name: str,
    category_name: str,
    package_quantity: Decimal | None,
    package_unit: str | None,
    dry_run: bool,
    stats: ImportStats,
) -> Product:
    product_key = normalized_name
    if dry_run:
        if product_key not in stats.dry_run_products:
            stats.created_products += 1
            stats.dry_run_products.add(product_key)
        return Product(
            name=item.name,
            category=category_name,
            brand=item.brand,
            unit=package_unit or normalize_unit(item.unit) or "шт",
            thumbnail=thumb_for(item.name, category_name),
            is_tracked=True,
        )

    alias_result = await db.execute(
        select(ProductAlias).where(ProductAlias.normalized_name == normalized_name)
    )
    alias = alias_result.scalars().first()
    if alias:
        product_result = await db.execute(select(Product).where(Product.id == alias.product_id))
        product = product_result.scalar_one_or_none()
        if product:
            return product

    product_result = await db.execute(select(Product).where(func.lower(Product.name) == item.name.lower()))
    product = product_result.scalar_one_or_none()
    if product:
        changed = False
        if not product.brand and item.brand:
            product.brand = item.brand
            changed = True
        if not product.category or product.category == "Інше":
            product.category = category_name
            changed = True
        if not product.unit and package_unit:
            product.unit = package_unit
            changed = True
        if changed:
            stats.updated_products += 1
        return product

    stats.created_products += 1
    description_parts = [part for part in (item.brand, category_name) if part]
    if package_quantity is not None and package_unit:
        description_parts.append(f"{package_quantity.normalize()} {package_unit}")
    product = Product(
        name=item.name,
        description=" · ".join(description_parts) or "Товар з офіційного сайту магазину",
        category=category_name,
        brand=item.brand,
        unit=package_unit or normalize_unit(item.unit) or "шт",
        thumbnail=thumb_for(item.name, category_name),
        is_tracked=True,
    )
    if not dry_run:
        db.add(product)
        await db.flush()
    return product


async def upsert_alias(
    db: AsyncSession,
    *,
    product: Product,
    store: Store,
    raw_name: str,
    normalized_name: str,
    dry_run: bool,
    stats: ImportStats,
):
    if dry_run:
        alias_key = (store.name.lower(), normalized_name, raw_name)
        if alias_key not in stats.dry_run_aliases:
            stats.created_aliases += 1
            stats.dry_run_aliases.add(alias_key)
        return
    if not product.id or not store.id:
        stats.created_aliases += 1
        return

    result = await db.execute(
        select(ProductAlias).where(
            ProductAlias.product_id == product.id,
            ProductAlias.store_id == store.id,
            ProductAlias.normalized_name == normalized_name,
        )
    )
    if result.scalar_one_or_none():
        return

    db.add(
        ProductAlias(
            product_id=product.id,
            store_id=store.id,
            raw_name=raw_name,
            normalized_name=normalized_name,
            confidence=Decimal("1"),
        )
    )
    stats.created_aliases += 1


async def upsert_listing(
    db: AsyncSession,
    *,
    product: Product,
    store: Store,
    item: ProductJsonItem,
    normalized_name: str,
    category_name: str,
    package_quantity: Decimal | None,
    package_unit: str | None,
    source: str,
    observed_at: datetime,
    dry_run: bool,
    stats: ImportStats,
) -> ProductListing:
    listing = None
    if product.id and store.id:
        stmt = select(ProductListing).where(
            ProductListing.store_id == store.id,
            ProductListing.normalized_name == normalized_name,
        )
        if package_quantity is not None:
            stmt = stmt.where(ProductListing.package_quantity == package_quantity)
        if package_unit:
            stmt = stmt.where(ProductListing.package_unit == package_unit)
        result = await db.execute(stmt)
        listing = result.scalars().first()

    if listing is None:
        dry_listing_key = (
            store.name.lower(),
            normalized_name,
            str(package_quantity or ""),
            package_unit or "",
        )
        if dry_run and dry_listing_key in stats.dry_run_listings:
            return ProductListing(
                product_id=product.id,
                store_id=store.id,
                raw_name=item.name,
                normalized_name=normalized_name,
                brand=item.brand,
                category=category_name,
                product_url=item.product_url,
                image_url=item.image_url,
                availability=item.availability,
                package_quantity=package_quantity,
                package_unit=package_unit,
                source=source,
                source_type=OFFICIAL_SOURCE_TYPE,
                price_scope=OFFICIAL_PRICE_SCOPE,
                first_seen_at=observed_at,
                last_seen_at=observed_at,
            )
        if dry_run:
            stats.dry_run_listings.add(dry_listing_key)
        stats.created_listings += 1
        listing = ProductListing(
            product_id=product.id,
            store_id=store.id,
            raw_name=item.name,
            normalized_name=normalized_name,
            brand=item.brand,
            category=category_name,
            product_url=item.product_url,
            image_url=item.image_url,
            availability=item.availability,
            package_quantity=package_quantity,
            package_unit=package_unit,
            source=source,
            source_type=OFFICIAL_SOURCE_TYPE,
            price_scope=OFFICIAL_PRICE_SCOPE,
            first_seen_at=observed_at,
            last_seen_at=observed_at,
        )
        if not dry_run:
            db.add(listing)
            await db.flush()
        return listing

    listing.product_id = product.id
    listing.raw_name = item.name
    listing.brand = listing.brand or item.brand
    listing.category = category_name
    listing.product_url = item.product_url or listing.product_url
    if item.image_url and (not listing.image_url or "/420/420/" in item.image_url):
        listing.image_url = item.image_url
    listing.availability = item.availability
    listing.package_quantity = package_quantity
    listing.package_unit = package_unit
    listing.source = source
    listing.source_type = OFFICIAL_SOURCE_TYPE
    listing.price_scope = OFFICIAL_PRICE_SCOPE
    listing.last_seen_at = observed_at
    stats.updated_listings += 1
    return listing


async def add_price_if_needed(
    db: AsyncSession,
    *,
    product: Product,
    store: Store,
    listing: ProductListing,
    item: ProductJsonItem,
    package_quantity: Decimal | None,
    package_unit: str | None,
    source: str,
    observed_at: datetime,
    dry_run: bool,
    stats: ImportStats,
):
    if not item.availability and item.price <= 0:
        stats.skipped_unavailable_without_price += 1
        return

    latest_price = None
    if product.id and store.id and listing.id:
        result = await db.execute(
            select(ProductPrice)
            .where(
                ProductPrice.product_id == product.id,
                ProductPrice.store_id == store.id,
                ProductPrice.listing_id == listing.id,
                ProductPrice.source == source,
                ProductPrice.price_scope == OFFICIAL_PRICE_SCOPE,
            )
            .order_by(ProductPrice.observed_at.desc())
            .limit(1)
        )
        latest_price = result.scalar_one_or_none()

    if (
        latest_price
        and latest_price.observed_at
        and latest_price.observed_at.date() == observed_at.date()
        and latest_price.price == item.price
        and latest_price.price_per_unit == item.price_per_unit
    ):
        stats.skipped_prices += 1
        return

    stats.created_prices += 1
    if dry_run:
        return

    db.add(
        ProductPrice(
            product_id=product.id,
            store_id=store.id,
            listing_id=listing.id,
            price=item.price,
            currency=item.currency,
            observed_at=observed_at,
            price_per_unit=item.price_per_unit,
            package_quantity=package_quantity,
            package_unit=package_unit,
            source=source,
            source_type=OFFICIAL_SOURCE_TYPE,
            price_scope=OFFICIAL_PRICE_SCOPE,
        )
    )


async def import_products_json(
    path: Path,
    *,
    source: str,
    observed_at: datetime,
    dry_run: bool = False,
) -> ImportStats:
    stats = ImportStats()
    seen: set[tuple[str, str, str, str, str, str]] = set()

    if not dry_run:
        await ensure_schema(engine)

    async with AsyncSessionLocal() as db:
        for label, records in iter_json_payloads(path):
            stats.files += 1
            for index, raw_record in enumerate(records):
                stats.records += 1
                try:
                    item = ProductJsonItem.model_validate(raw_record)
                except ValidationError as error:
                    stats.invalid += 1
                    stats.errors.append(f"{label}[{index}]: {error.errors()[0]['msg']}")
                    continue

                normalized_name = normalize_name(item.name)
                package_quantity, package_unit = package_from_item(item)
                category = normalize_category(item.category, raw_name=item.name, item_name=item.name)
                dedupe_key = (
                    item.shop.lower(),
                    normalized_name,
                    (item.brand or "").lower(),
                    str(package_quantity or ""),
                    package_unit or "",
                    str(item.price),
                )
                if dedupe_key in seen:
                    stats.duplicates += 1
                    continue
                seen.add(dedupe_key)

                store = await get_or_create_store(
                    db,
                    name=item.shop,
                    dry_run=dry_run,
                    stats=stats,
                )
                product = await find_or_create_product(
                    db,
                    item=item,
                    normalized_name=normalized_name,
                    category_name=category.name,
                    package_quantity=package_quantity,
                    package_unit=package_unit,
                    dry_run=dry_run,
                    stats=stats,
                )
                listing = await upsert_listing(
                    db,
                    product=product,
                    store=store,
                    item=item,
                    normalized_name=normalized_name,
                    category_name=category.name,
                    package_quantity=package_quantity,
                    package_unit=package_unit,
                    source=source,
                    observed_at=observed_at,
                    dry_run=dry_run,
                    stats=stats,
                )
                await upsert_alias(
                    db,
                    product=product,
                    store=store,
                    raw_name=item.name,
                    normalized_name=normalized_name,
                    dry_run=dry_run,
                    stats=stats,
                )
                await add_price_if_needed(
                    db,
                    product=product,
                    store=store,
                    listing=listing,
                    item=item,
                    package_quantity=package_quantity,
                    package_unit=package_unit,
                    source=source,
                    observed_at=observed_at,
                    dry_run=dry_run,
                    stats=stats,
                )

        if dry_run:
            await db.rollback()
        else:
            await db.commit()

    return stats


def print_stats(stats: ImportStats):
    for key in (
        "files",
        "records",
        "invalid",
        "duplicates",
        "created_stores",
        "created_products",
        "updated_products",
        "created_listings",
        "updated_listings",
        "created_prices",
        "skipped_prices",
        "created_aliases",
        "skipped_unavailable_without_price",
    ):
        print(f"{key}={getattr(stats, key)}")

    if stats.errors:
        print("errors:")
        for error in stats.errors[:20]:
            print(f"- {error}")
        if len(stats.errors) > 20:
            print(f"- ... {len(stats.errors) - 20} more")


def parse_args():
    parser = argparse.ArgumentParser(description="Import official store product JSON into SmartCart DB.")
    parser.add_argument("path", type=Path, help="JSON file, ZIP file, or folder with JSON files.")
    parser.add_argument("--source", default="official-site-json")
    parser.add_argument("--observed-at", default=None, help="ISO datetime. Defaults to current UTC time.")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


async def main():
    args = parse_args()
    observed_at = (
        datetime.fromisoformat(args.observed_at)
        if args.observed_at
        else datetime.now(timezone.utc).replace(tzinfo=None)
    )
    stats = await import_products_json(
        args.path,
        source=args.source,
        observed_at=observed_at,
        dry_run=args.dry_run,
    )
    print_stats(stats)


if __name__ == "__main__":
    asyncio.run(main())
