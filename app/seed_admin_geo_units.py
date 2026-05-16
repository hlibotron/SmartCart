import argparse
import asyncio
import csv
import io
import urllib.request
import zipfile

from sqlalchemy import delete, select

from app.db.database import AsyncSessionLocal, engine
from app.db.models import AdminGeoUnit
from app.db.schema import ensure_schema


DEFAULT_KATOTTG_URL = (
    "https://github.com/mykhailoklimnyk/ua-administrative-codes/"
    "releases/download/0.1.0/katottg.csv"
)

READY_ZIP_FILES = {
    "region": "ua_admin_ready_data/csv/ukraine_regions.csv",
    "community": "ua_admin_ready_data/csv/ukraine_hromadas.csv",
    "city": "ua_admin_ready_data/csv/ukraine_cities.csv",
}


def normalized_text(*values: str | None) -> str:
    return " ".join(value.strip().lower() for value in values if value and value.strip())


def display_ready_region_name(name: str, category_name: str | None = None) -> str:
    value = (name or "").strip()
    if not value:
        return value

    normalized = value.lower()
    category = (category_name or "").lower()
    if (
        "область" in category
        and "автономна" not in normalized
        and normalized not in {"київ", "севастополь"}
        and "область" not in normalized
    ):
        return f"{value} область"
    return value


def display_region_name(name: str, type_name: str) -> str:
    value = name.strip()
    type_value = type_name.strip().lower()
    if type_value == "область" and "область" not in value.lower():
        return f"{value} область"
    return value


def read_csv_rows(source: str) -> list[dict[str, str]]:
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=60) as response:
            text = response.read().decode("utf-8-sig")
    else:
        with open(source, encoding="utf-8-sig") as file:
            text = file.read()

    return list(csv.DictReader(io.StringIO(text)))


def read_ready_zip_rows(source: str, member_name: str) -> list[dict[str, str]]:
    with zipfile.ZipFile(source) as archive:
        with archive.open(member_name) as file:
            text = file.read().decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def row_level(row: dict[str, str]) -> int:
    try:
        return int(row.get("level") or 0)
    except ValueError:
        return 0


def build_units(rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    units: dict[str, dict[str, str]] = {}
    regions_by_name: dict[str, dict[str, str]] = {}
    communities_by_region_name: dict[tuple[str, str], dict[str, str]] = {}

    for row in rows:
        if row_level(row) != 1:
            continue

        code = (row.get("code") or "").strip()
        name = display_region_name(row.get("name") or "", row.get("category_name") or "")
        if not code or not name:
            continue

        unit = {
            "code": code,
            "name": name,
            "level": "region",
            "type_name": row.get("category_name") or "область",
            "parent_code": row.get("parent_code") or "",
            "region_code": code,
            "region_name": name,
            "community_code": "",
            "community_name": "",
            "search_text": normalized_text(name, row.get("name"), row.get("full_address")),
            "source": "katottg",
        }
        units[code] = unit
        regions_by_name[(row.get("region") or row.get("name") or "").strip()] = unit
        regions_by_name[name] = unit

    for row in rows:
        if row_level(row) != 3:
            continue

        code = (row.get("code") or "").strip()
        name = (row.get("name") or row.get("council") or "").strip()
        region_source_name = (row.get("region") or "").strip()
        region = regions_by_name.get(region_source_name)
        if not code or not name or not region:
            continue

        unit = {
            "code": code,
            "name": name,
            "level": "community",
            "type_name": row.get("category_name") or "громада",
            "parent_code": row.get("parent_code") or "",
            "region_code": region["code"],
            "region_name": region["name"],
            "community_code": code,
            "community_name": name,
            "search_text": normalized_text(name, region["name"], row.get("full_address")),
            "source": "katottg",
        }
        units[code] = unit
        communities_by_region_name[(region["code"], name)] = unit

    for row in rows:
        if row_level(row) != 4:
            continue

        category = (row.get("category") or "").strip().upper()
        category_name = (row.get("category_name") or "").strip().lower()
        if category != "М" and category_name != "місто":
            continue

        code = (row.get("code") or "").strip()
        name = (row.get("name") or row.get("settlement") or "").strip()
        region_source_name = (row.get("region") or "").strip()
        community_name = (row.get("council") or "").strip()
        region = regions_by_name.get(region_source_name)
        community = communities_by_region_name.get((region["code"], community_name)) if region else None
        if not code or not name or not region:
            continue

        unit = {
            "code": code,
            "name": name,
            "level": "city",
            "type_name": row.get("category_name") or "місто",
            "parent_code": row.get("parent_code") or "",
            "region_code": region["code"],
            "region_name": region["name"],
            "community_code": community["code"] if community else "",
            "community_name": community["name"] if community else community_name,
            "search_text": normalized_text(name, community_name, region["name"], row.get("full_address")),
            "source": "katottg",
        }
        units[code] = unit

    return units


def build_ready_units_from_rows(
    regions: list[dict[str, str]],
    hromadas: list[dict[str, str]],
    cities: list[dict[str, str]],
) -> dict[str, dict[str, str]]:
    units: dict[str, dict[str, str]] = {}
    region_names: dict[str, str] = {}
    community_names: dict[str, str] = {}

    for row in regions:
        code = (row.get("katottg_code") or row.get("region_code") or "").strip()
        raw_name = (row.get("name_uk") or row.get("region_name_uk") or "").strip()
        name = display_ready_region_name(raw_name, row.get("category_name_uk"))
        if not code or not name:
            continue

        region_names[code] = name
        units[code] = {
            "code": code,
            "name": name,
            "level": "region",
            "type_name": row.get("category_name_uk") or "область",
            "parent_code": row.get("parent_code") or "",
            "region_code": code,
            "region_name": name,
            "community_code": "",
            "community_name": "",
            "search_text": normalized_text(name, raw_name, row.get("full_path_uk")),
            "source": row.get("source") or "ua_admin_ready_data",
        }

    for row in hromadas:
        code = (row.get("katottg_code") or row.get("hromada_code") or "").strip()
        name = (row.get("name_uk") or row.get("hromada_name_uk") or "").strip()
        region_code = (row.get("region_code") or "").strip()
        region_name = region_names.get(region_code) or display_ready_region_name(
            row.get("region_name_uk") or "",
            "область",
        )
        if not code or not name:
            continue

        community_names[code] = name
        units[code] = {
            "code": code,
            "name": name,
            "level": "community",
            "type_name": row.get("category_name_uk") or "територіальна громада",
            "parent_code": row.get("parent_code") or "",
            "region_code": region_code,
            "region_name": region_name,
            "community_code": code,
            "community_name": name,
            "search_text": normalized_text(
                name,
                f"{name} громада",
                row.get("raion_name_uk"),
                region_name,
                row.get("full_path_uk"),
            ),
            "source": row.get("source") or "ua_admin_ready_data",
        }

    for row in cities:
        code = (row.get("katottg_code") or row.get("settlement_code") or "").strip()
        name = (row.get("name_uk") or row.get("settlement_name_uk") or "").strip()
        region_code = (row.get("region_code") or "").strip()
        community_code = (row.get("hromada_code") or "").strip()
        region_name = region_names.get(region_code) or display_ready_region_name(
            row.get("region_name_uk") or "",
            "область",
        )
        community_name = community_names.get(community_code) or (row.get("hromada_name_uk") or "").strip()
        if not code or not name:
            continue

        units[code] = {
            "code": code,
            "name": name,
            "level": "city",
            "type_name": row.get("category_name_uk") or "місто",
            "parent_code": row.get("parent_code") or "",
            "region_code": region_code,
            "region_name": region_name,
            "community_code": community_code,
            "community_name": community_name,
            "search_text": normalized_text(
                name,
                f"місто {name}",
                community_name,
                f"{community_name} громада" if community_name else "",
                row.get("raion_name_uk"),
                region_name,
                row.get("full_path_uk"),
            ),
            "source": row.get("source") or "ua_admin_ready_data",
        }

    return units


def build_ready_units(source: str) -> dict[str, dict[str, str]]:
    return build_ready_units_from_rows(
        read_ready_zip_rows(source, READY_ZIP_FILES["region"]),
        read_ready_zip_rows(source, READY_ZIP_FILES["community"]),
        read_ready_zip_rows(source, READY_ZIP_FILES["city"]),
    )


def build_seed_units(source: str) -> dict[str, dict[str, str]]:
    if zipfile.is_zipfile(source):
        return build_ready_units(source)
    return build_units(read_csv_rows(source))


async def seed_admin_geo_units(source: str, replace: bool = True) -> None:
    await ensure_schema(engine)
    units = build_seed_units(source)

    async with AsyncSessionLocal() as db:
        if replace:
            await db.execute(delete(AdminGeoUnit))
            existing = {}
        else:
            result = await db.execute(select(AdminGeoUnit))
            existing = {unit.code: unit for unit in result.scalars().all()}

        for payload in units.values():
            unit = existing.get(payload["code"])
            if unit is None:
                db.add(AdminGeoUnit(**payload))
                continue

            for key, value in payload.items():
                setattr(unit, key, value)

        await db.commit()

    counts = {"region": 0, "community": 0, "city": 0}
    for unit in units.values():
        counts[unit["level"]] += 1

    mode = "Replaced" if replace else "Seeded"
    print(
        f"{mode} admin_geo_units: "
        f"{counts['region']} regions, {counts['community']} communities, {counts['city']} cities"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed Ukrainian KATOTTG geography lookup data.")
    parser.add_argument(
        "--source",
        default=DEFAULT_KATOTTG_URL,
        help="KATOTTG CSV file path/URL or ua_admin_ready_data ZIP path.",
    )
    parser.add_argument(
        "--no-replace",
        action="store_true",
        help="Upsert records without clearing existing admin_geo_units first.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(seed_admin_geo_units(args.source, replace=not args.no_replace))
