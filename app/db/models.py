from sqlalchemy import Column, Integer, BigInteger, String, Text, Numeric, ForeignKey, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    telegram_id = Column(BigInteger, unique=True, nullable=False)
    username = Column(String(255))

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

    item_name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)

    quantity = Column(Numeric(10, 2), default=1)

    category = Column(String(100))

    # 🔥 NEW FIELDS
    brand = Column(String(255))
    is_promotional = Column(Boolean, default=False)

    created_at = Column(
        TIMESTAMP,
        server_default=func.now()
    )

    receipt = relationship("Receipt", back_populates="items")


