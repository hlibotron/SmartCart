from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class UserIn(BaseModel):
    telegram_id: int
    username: str | None = None


class AuthRegister(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    city: str | None = Field(default=None, max_length=120)


class AuthLogin(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class ReceiptItemIn(BaseModel):
    raw_name: str | None = Field(default=None, max_length=255)
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


class ReceiptScanCreate(BaseModel):
    user: UserIn
    image_url: str | None = None
    ocr_raw_text: str | None = None
    provider: str | None = Field(default=None, max_length=100)


class ReceiptScanCreated(BaseModel):
    id: int
    status: str


class OcrReceiptItem(BaseModel):
    raw_name: str = Field(min_length=1, max_length=255)
    item_name: str | None = Field(default=None, max_length=255)
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


class OcrReceiptParsed(BaseModel):
    store: str | None = Field(default=None, max_length=255)
    receipt_datetime: datetime | None = None
    total: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="UAH", max_length=10)
    ocr_raw_text: str | None = None
    items: list[OcrReceiptItem] = Field(default_factory=list)


class ReceiptScanProcessed(BaseModel):
    scan_id: int
    receipt_id: int
    status: str
    matched_items: int
    pending_items: int


class MatchCandidateResolve(BaseModel):
    product_id: int
    create_alias: bool = True


class ProductCategoryUpdate(BaseModel):
    categoryKey: str = Field(min_length=1, max_length=50)
