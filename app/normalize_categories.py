import asyncio
from pathlib import Path
import sys

from sqlalchemy import select

if __package__ is None or __package__ == "":
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.categories import normalize_category
from app.db.database import AsyncSessionLocal
from app.db.models import Product, ReceiptItem


async def normalize_existing_categories():
    async with AsyncSessionLocal() as db:
        products_result = await db.execute(select(Product))
        products = products_result.scalars().all()
        updated_products = 0
        product_categories = {}

        for product in products:
            category = normalize_category(
                product.category,
                raw_name=product.name,
                item_name=product.name,
            )
            if product.category != category.name:
                product.category = category.name
                updated_products += 1
            product_categories[product.id] = category.name

        items_result = await db.execute(select(ReceiptItem))
        receipt_items = items_result.scalars().all()
        updated_items = 0

        for item in receipt_items:
            product_category = product_categories.get(item.product_id)
            payload_category = normalize_category(
                item.category,
                raw_name=item.raw_name,
                item_name=item.item_name,
            )
            category = normalize_category(
                None,
                raw_name=item.raw_name,
                item_name=item.item_name,
                product_category=product_category,
            )
            if category.key == "other" and payload_category.key != "other":
                category = payload_category
            if item.category != category.name:
                item.category = category.name
                updated_items += 1

        await db.commit()
        return updated_products, updated_items


async def main():
    updated_products, updated_items = await normalize_existing_categories()
    print(f"Updated products: {updated_products}")
    print(f"Updated receipt items: {updated_items}")


if __name__ == "__main__":
    asyncio.run(main())
