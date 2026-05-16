from sqlalchemy import text

from app.db import models  # noqa: F401 - registers SQLAlchemy models on Base
from app.db.database import Base


ADDITIVE_COLUMNS = {
    "users": [
        ("email", "VARCHAR(255) UNIQUE"),
        ("password_hash", "VARCHAR(255)"),
        ("city", "VARCHAR(120)"),
        ("level", "VARCHAR(80) DEFAULT 'Базовий рівень'"),
        ("avatar_url", "TEXT"),
        ("cashback_auto_activation_enabled", "BOOLEAN DEFAULT TRUE"),
        ("payout_method_label", "VARCHAR(120)"),
    ],
    "receipts": [
        ("total_discount", "NUMERIC(10, 2) DEFAULT 0"),
        ("store_cashback_total", "NUMERIC(10, 2) DEFAULT 0"),
        ("smartcart_cashback_total", "NUMERIC(10, 2) DEFAULT 0"),
    ],
    "receipt_items": [
        ("product_id", "INTEGER REFERENCES products(id) ON DELETE SET NULL"),
        ("raw_name", "VARCHAR(255)"),
        ("unit", "VARCHAR(30) DEFAULT 'шт'"),
        ("discount_amount", "NUMERIC(10, 2) DEFAULT 0"),
        ("store_cashback_amount", "NUMERIC(10, 2) DEFAULT 0"),
        ("store_cashback_percent", "NUMERIC(5, 2) DEFAULT 0"),
        ("smartcart_cashback_amount", "NUMERIC(10, 2) DEFAULT 0"),
        ("thumbnail", "VARCHAR(50)"),
        ("match_confidence", "NUMERIC(5, 2) DEFAULT 0"),
        ("match_status", "VARCHAR(50) DEFAULT 'unmatched'"),
    ],
    "product_prices": [
        ("listing_id", "INTEGER REFERENCES product_listings(id) ON DELETE SET NULL"),
        ("price_per_unit", "NUMERIC(10, 2)"),
        ("package_quantity", "NUMERIC(10, 3)"),
        ("package_unit", "VARCHAR(30)"),
        ("source_type", "VARCHAR(50) DEFAULT 'manual'"),
        ("price_scope", "VARCHAR(50) DEFAULT 'manual'"),
    ],
    "retail_store_locations": [
        ("store_name", "VARCHAR(255)"),
        ("address_query", "TEXT"),
        ("lat", "DOUBLE PRECISION"),
        ("lon", "DOUBLE PRECISION"),
        ("coordinate_status", "VARCHAR(80) DEFAULT 'needs_geocode'"),
        ("source_type", "VARCHAR(120)"),
        ("source_name", "TEXT"),
        ("source_url", "TEXT"),
        ("coverage_note", "TEXT"),
        ("chain_completeness", "VARCHAR(120)"),
        ("fetched_at", "DATE"),
    ],
}


async def ensure_schema(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        for table_name, columns in ADDITIVE_COLUMNS.items():
            for column_name, column_definition in columns:
                await conn.execute(
                    text(
                        f"ALTER TABLE {table_name} "
                        f"ADD COLUMN IF NOT EXISTS {column_name} {column_definition}"
                    )
                )
