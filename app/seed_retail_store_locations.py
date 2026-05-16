import argparse
import asyncio
import csv
import io
import zipfile
from datetime import date

from sqlalchemy import delete, select

from app.db.database import AsyncSessionLocal, engine
from app.db.models import RetailStoreLocation
from app.db.schema import ensure_schema


DEFAULT_ZIP_MEMBER = "kyiv_supermarkets_seed_needs_geocode.csv"


def clean(value: str | None) -> str:
    return (value or "").strip()


def parse_float(value: str | None) -> float | None:
    value = clean(value).replace(",", ".")
    if not value:
        return None
    return float(value)


def parse_date(value: str | None) -> date | None:
    value = clean(value)
    if not value:
        return None
    return date.fromisoformat(value)


def read_rows(source: str, member: str = DEFAULT_ZIP_MEMBER) -> list[dict[str, str]]:
    if zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            with archive.open(member) as file:
                text = file.read().decode("utf-8-sig")
    else:
        with open(source, encoding="utf-8-sig") as file:
            text = file.read()

    return list(csv.DictReader(io.StringIO(text)))


def row_payload(row: dict[str, str]) -> dict:
    return {
        "chain_key": clean(row.get("chain_key")),
        "chain_name": clean(row.get("chain_name")),
        "store_name": clean(row.get("store_name")) or None,
        "city": clean(row.get("city")) or "Київ",
        "address_raw": clean(row.get("address_raw")),
        "address_query": clean(row.get("address_query")),
        "lat": parse_float(row.get("lat")),
        "lon": parse_float(row.get("lon")),
        "coordinate_status": clean(row.get("coordinate_status")) or "needs_geocode",
        "source_type": clean(row.get("source_type")) or None,
        "source_name": clean(row.get("source_name")) or None,
        "source_url": clean(row.get("source_url")) or None,
        "coverage_note": clean(row.get("coverage_note")) or None,
        "chain_completeness": clean(row.get("chain_completeness")) or None,
        "fetched_at": parse_date(row.get("fetched_at")),
    }


async def seed_retail_store_locations(source: str, replace: bool = True) -> None:
    await ensure_schema(engine)
    payloads = [
        payload
        for payload in (row_payload(row) for row in read_rows(source))
        if payload["chain_key"] and payload["chain_name"] and payload["address_raw"]
    ]

    async with AsyncSessionLocal() as db:
        if replace:
            await db.execute(delete(RetailStoreLocation))
            existing = {}
        else:
            result = await db.execute(select(RetailStoreLocation))
            existing = {
                (item.chain_key, item.city, item.address_raw): item
                for item in result.scalars().all()
            }

        for payload in payloads:
            key = (payload["chain_key"], payload["city"], payload["address_raw"])
            existing_item = existing.get(key)
            if existing_item is None:
                db.add(RetailStoreLocation(**payload))
                continue

            for field, value in payload.items():
                setattr(existing_item, field, value)

        await db.commit()

    with_coordinates = sum(1 for payload in payloads if payload["lat"] is not None and payload["lon"] is not None)
    print(
        f"{'Replaced' if replace else 'Seeded'} retail_store_locations: "
        f"{len(payloads)} stores, {with_coordinates} with coordinates"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed Kyiv supermarket locations into DB.")
    parser.add_argument("source", help="CSV file or ZIP containing kyiv_supermarkets_seed_needs_geocode.csv")
    parser.add_argument("--no-replace", action="store_true", help="Upsert without clearing existing rows first.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(seed_retail_store_locations(args.source, replace=not args.no_replace))
