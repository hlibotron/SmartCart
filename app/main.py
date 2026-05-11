from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.routes.receipts import router as receipts_router


from app.db.database import AsyncSessionLocal
from app.db.models import User, Receipt, ReceiptItem

from app.schemas import ReceiptCreate
from app.services.gpt_parser import enrich_items
app = FastAPI()
app.include_router(receipts_router)

# -------------------------
# DB SESSION
# -------------------------

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# -------------------------
# HEALTH CHECK
# -------------------------

@app.get("/")
async def root():
    return {"status": "ok"}


# -------------------------
# RECEIPT UPLOAD
# -------------------------

@app.post("/receipts/process")
async def process_receipt(
    data: ReceiptCreate,
    db: AsyncSession = Depends(get_db)
):

    # -------------------------
    # FIND OR CREATE USER
    # -------------------------

    result = await db.execute(
        select(User).where(User.telegram_id == data.telegram_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        user = User(
            telegram_id=data.telegram_id
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

    # -------------------------
    # CREATE RECEIPT
    # -------------------------

    receipt = Receipt(
        user_id=user.id,

        store=data.store,
        total=data.total,
        currency=data.currency,

        image_url=data.image_url,
        ocr_raw_text=data.ocr_raw_text,

        processing_status="processed"
    )

    db.add(receipt)

    await db.commit()
    await db.refresh(receipt)

    # -------------------------
    # CREATE RECEIPT ITEMS
    # -------------------------

    raw_items = [
        {
            "item_name": item.item_name,
            "price": float(item.price)
        }
        for item in data.items
    ]

    try:
        enriched_items = await enrich_items(raw_items)

    except Exception as e:

        print("AI ERROR:", e)

        enriched_items = raw_items

    for item in enriched_items:
        receipt_item = ReceiptItem(
            receipt_id=receipt.id,

            item_name=item.get("item_name", "Unknown"),
            price=item.get("price", 0),

            quantity=item.get("quantity", 1),

            category=item.get("category", "Unknown"),
            brand=item.get("brand", "Unknown"),

            is_promotional=item.get("is_promotional", False)
        )

        db.add(receipt_item)

    await db.commit()

    # -------------------------
    # RESPONSE
    # -------------------------

    return {
        "status": "success",
        "receipt_id": receipt.id,
        "items_saved": len(data.items)
    }