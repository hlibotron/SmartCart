from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class UserIn(BaseModel):
    telegram_id: int
    username: str | None = None


class ReceiptItemIn(BaseModel):
    item_name: str = Field(min_length=1, max_length=255)
    price: Decimal = Field(ge=0)
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit: str | None = Field(default="шт", max_length=30)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    store_cashback_amount: Decimal = Field(default=Decimal("0"), ge=0)
    store_cashback_percent: Decimal = Field(default=Decimal("0"), ge=0)
    smartcart_cashback_amount: Decimal = Field(default=Decimal("0"), ge=0)
    category: str | None = Field(default=None, max_length=100)
    brand: str | None = Field(default=None, max_length=255)
    thumbnail: str | None = Field(default=None, max_length=50)
    is_promotional: bool = False


class ReceiptCreate(BaseModel):
    user: UserIn
    store: str | None = Field(default=None, max_length=255)
    receipt_datetime: datetime | None = None
    total: Decimal | None = Field(default=None, ge=0)
    total_discount: Decimal | None = Field(default=None, ge=0)
    store_cashback_total: Decimal | None = Field(default=None, ge=0)
    smartcart_cashback_total: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="UAH", max_length=10)
    image_url: str | None = None
    ocr_raw_text: str | None = None
    processing_status: str = Field(default="processed", max_length=50)
    items: list[ReceiptItemIn] = Field(default_factory=list)


class ReceiptCreated(BaseModel):
    id: int
    items_count: int
    status: str
