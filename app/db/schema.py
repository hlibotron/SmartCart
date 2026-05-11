from sqlalchemy import text

from app.db import models  # noqa: F401 - registers SQLAlchemy models on Base
from app.db.database import Base


ADDITIVE_COLUMNS = {
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
