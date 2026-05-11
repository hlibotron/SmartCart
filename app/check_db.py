import asyncio
import sys

from sqlalchemy import text

from app.db.database import engine


REQUIRED_COLUMNS = {
    "users": {"id", "telegram_id", "username", "created_at"},
    "receipts": {
        "id",
        "user_id",
        "store",
        "receipt_datetime",
        "total",
        "currency",
        "total_discount",
        "store_cashback_total",
        "smartcart_cashback_total",
        "image_url",
        "ocr_raw_text",
        "processing_status",
        "created_at",
    },
    "receipt_items": {
        "id",
        "receipt_id",
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
        "created_at",
    },
    "products": {
        "id",
        "name",
        "description",
        "category",
        "brand",
        "unit",
        "thumbnail",
        "is_tracked",
        "has_cashback",
        "created_at",
        "updated_at",
    },
    "stores": {"id", "name", "logo", "logo_text", "created_at"},
    "product_prices": {
        "id",
        "product_id",
        "store_id",
        "price",
        "currency",
        "observed_at",
        "is_promotional",
        "source",
        "created_at",
    },
    "cashback_offers": {
        "id",
        "product_id",
        "store_id",
        "title",
        "cashback_percent",
        "cashback_amount",
        "starts_at",
        "ends_at",
        "is_active",
        "created_at",
    },
}


async def check_db():
    async with engine.connect() as conn:
        identity = await conn.execute(
            text("select current_database() as database_name, current_user as user_name")
        )
        identity_row = identity.mappings().one()

        table_rows = await conn.execute(
            text(
                """
                select table_name, column_name
                from information_schema.columns
                where table_schema = 'public'
                """
            )
        )

        actual_columns = {}
        for row in table_rows.mappings():
            actual_columns.setdefault(row["table_name"], set()).add(row["column_name"])

    missing_tables = sorted(set(REQUIRED_COLUMNS) - set(actual_columns))
    missing_columns = {
        table: sorted(columns - actual_columns.get(table, set()))
        for table, columns in REQUIRED_COLUMNS.items()
        if table in actual_columns and columns - actual_columns.get(table, set())
    }

    print(f"database={identity_row['database_name']}")
    print(f"user={identity_row['user_name']}")

    if missing_tables or missing_columns:
        if missing_tables:
            print(f"missing_tables={', '.join(missing_tables)}")
        for table, columns in missing_columns.items():
            print(f"missing_columns.{table}={', '.join(columns)}")
        return 1

    print("schema=ok")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(check_db()))
