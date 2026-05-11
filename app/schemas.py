from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal


class ReceiptItemCreate(BaseModel):
    item_name: str
    price: Decimal

    quantity: Optional[Decimal] = 1

    category: Optional[str] = None
    brand: Optional[str] = None

    is_promotional: Optional[bool] = False


class ReceiptCreate(BaseModel):
    telegram_id: int

    store: str
    total: Decimal
    currency: str

    receipt_datetime: Optional[str] = None

    image_url: Optional[str] = None
    ocr_raw_text: Optional[str] = None

    items: List[ReceiptItemCreate]