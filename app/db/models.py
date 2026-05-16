from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    telegram_id = Column(BigInteger, unique=True, nullable=False)
    username = Column(String(255))
    email = Column(String(255), unique=True)
    password_hash = Column(String(255))
    city = Column(String(120))
    level = Column(String(80), default="Базовий рівень")
    avatar_url = Column(Text)
    cashback_auto_activation_enabled = Column(Boolean, default=True)
    payout_method_label = Column(String(120))

    created_at = Column(TIMESTAMP, server_default=func.now())

    receipts = relationship("Receipt", back_populates="user")





class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))

    store = Column(String(255))
    receipt_datetime = Column(TIMESTAMP)

    total = Column(Numeric(10, 2))
    currency = Column(String(10))
    total_discount = Column(Numeric(10, 2), default=0)
    store_cashback_total = Column(Numeric(10, 2), default=0)
    smartcart_cashback_total = Column(Numeric(10, 2), default=0)

    image_url = Column(Text)
    ocr_raw_text = Column(Text)

    processing_status = Column(String(50), default="pending")

    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="receipts")
    items = relationship("ReceiptItem", back_populates="receipt")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True)

    receipt_id = Column(
        Integer,
        ForeignKey("receipts.id", ondelete="CASCADE"),
        nullable=False
    )
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))

    raw_name = Column(String(255))
    item_name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)

    quantity = Column(Numeric(10, 2), default=1)
    unit = Column(String(30), default="шт")
    discount_amount = Column(Numeric(10, 2), default=0)
    store_cashback_amount = Column(Numeric(10, 2), default=0)
    store_cashback_percent = Column(Numeric(5, 2), default=0)
    smartcart_cashback_amount = Column(Numeric(10, 2), default=0)

    category = Column(String(100))

    brand = Column(String(255))
    thumbnail = Column(String(50))
    is_promotional = Column(Boolean, default=False)
    match_confidence = Column(Numeric(5, 2), default=0)
    match_status = Column(String(50), default="unmatched")

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    receipt = relationship("Receipt", back_populates="items")
    product = relationship("Product")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    category = Column(String(100))
    brand = Column(String(255))
    unit = Column(String(30), default="шт")
    thumbnail = Column(String(50))
    is_tracked = Column(Boolean, default=True)
    has_cashback = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    prices = relationship("ProductPrice", back_populates="product")
    cashback_offers = relationship("CashbackOffer", back_populates="product")
    aliases = relationship("ProductAlias", back_populates="product")
    listings = relationship("ProductListing", back_populates="product")


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    logo = Column(String(50))
    logo_text = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())

    prices = relationship("ProductPrice", back_populates="store")
    cashback_offers = relationship("CashbackOffer", back_populates="store")
    aliases = relationship("ProductAlias", back_populates="store")
    listings = relationship("ProductListing", back_populates="store")


class RetailStoreLocation(Base):
    __tablename__ = "retail_store_locations"
    __table_args__ = (
        UniqueConstraint(
            "chain_key",
            "city",
            "address_raw",
            name="uq_retail_store_locations_chain_city_address",
        ),
    )

    id = Column(Integer, primary_key=True)
    chain_key = Column(String(80), nullable=False)
    chain_name = Column(String(255), nullable=False)
    store_name = Column(String(255))
    city = Column(String(120), nullable=False, default="Київ")
    address_raw = Column(Text, nullable=False)
    address_query = Column(Text, nullable=False)
    lat = Column(Float)
    lon = Column(Float)
    coordinate_status = Column(String(80), nullable=False, default="needs_geocode")
    source_type = Column(String(120))
    source_name = Column(Text)
    source_url = Column(Text)
    coverage_note = Column(Text)
    chain_completeness = Column(String(120))
    fetched_at = Column(Date)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


Index("ix_retail_store_locations_chain", RetailStoreLocation.chain_key)
Index("ix_retail_store_locations_city", RetailStoreLocation.city)
Index("ix_retail_store_locations_coordinates", RetailStoreLocation.lat, RetailStoreLocation.lon)


class AdminGeoUnit(Base):
    __tablename__ = "admin_geo_units"

    id = Column(Integer, primary_key=True)
    code = Column(String(32), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    level = Column(String(30), nullable=False)
    type_name = Column(String(100))
    parent_code = Column(String(32))
    region_code = Column(String(32))
    region_name = Column(String(255))
    community_code = Column(String(32))
    community_name = Column(String(255))
    search_text = Column(Text, nullable=False)
    source = Column(String(100), default="katottg")
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


Index("ix_admin_geo_units_level_name", AdminGeoUnit.level, AdminGeoUnit.name)
Index("ix_admin_geo_units_region", AdminGeoUnit.region_code)
Index("ix_admin_geo_units_community", AdminGeoUnit.community_code)


class ProductListing(Base):
    __tablename__ = "product_listings"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    raw_name = Column(String(255), nullable=False)
    normalized_name = Column(String(255), nullable=False)
    brand = Column(String(255))
    category = Column(String(100))
    product_url = Column(Text)
    image_url = Column(Text)
    availability = Column(Boolean, default=True)
    package_quantity = Column(Numeric(10, 3))
    package_unit = Column(String(30))
    source = Column(String(100), default="official-site-json")
    source_type = Column(String(50), default="official_store_site")
    price_scope = Column(String(50), default="official_online_reference")
    first_seen_at = Column(TIMESTAMP, server_default=func.now())
    last_seen_at = Column(TIMESTAMP, server_default=func.now())
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="listings")
    store = relationship("Store", back_populates="listings")
    prices = relationship("ProductPrice", back_populates="listing")


class ProductPrice(Base):
    __tablename__ = "product_prices"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(Integer, ForeignKey("product_listings.id", ondelete="SET NULL"))
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="UAH")
    observed_at = Column(TIMESTAMP, nullable=False)
    price_per_unit = Column(Numeric(10, 2))
    package_quantity = Column(Numeric(10, 3))
    package_unit = Column(String(30))
    is_promotional = Column(Boolean, default=False)
    source = Column(String(50), default="manual")
    source_type = Column(String(50), default="manual")
    price_scope = Column(String(50), default="manual")
    created_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product", back_populates="prices")
    store = relationship("Store", back_populates="prices")
    listing = relationship("ProductListing", back_populates="prices")


class CashbackOffer(Base):
    __tablename__ = "cashback_offers"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"))
    title = Column(String(255))
    cashback_percent = Column(Numeric(5, 2), default=0)
    cashback_amount = Column(Numeric(10, 2), default=0)
    starts_at = Column(TIMESTAMP)
    ends_at = Column(TIMESTAMP)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product", back_populates="cashback_offers")
    store = relationship("Store", back_populates="cashback_offers")


class ReceiptOcrJob(Base):
    __tablename__ = "receipt_ocr_jobs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="SET NULL"))
    image_url = Column(Text)
    ocr_raw_text = Column(Text)
    provider = Column(String(100))
    processing_status = Column(String(50), default="pending")
    error_message = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    processed_at = Column(TIMESTAMP)


class ProductAlias(Base):
    __tablename__ = "product_aliases"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"))
    raw_name = Column(String(255), nullable=False)
    normalized_name = Column(String(255), nullable=False)
    confidence = Column(Numeric(5, 2), default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product", back_populates="aliases")
    store = relationship("Store", back_populates="aliases")


class ProductMatchCandidate(Base):
    __tablename__ = "product_match_candidates"

    id = Column(Integer, primary_key=True)
    receipt_ocr_job_id = Column(Integer, ForeignKey("receipt_ocr_jobs.id", ondelete="CASCADE"))
    receipt_item_id = Column(Integer, ForeignKey("receipt_items.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    raw_name = Column(String(255), nullable=False)
    normalized_name = Column(String(255))
    confidence = Column(Numeric(5, 2), default=0)
    match_type = Column(String(50), default="unmatched")
    status = Column(String(50), default="pending")
    created_at = Column(TIMESTAMP, server_default=func.now())
    resolved_at = Column(TIMESTAMP)
