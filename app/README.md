📦 AI Receipts Backend — документація запуску
🧱 1. Вимоги

Перед стартом має бути встановлено:

Python 3.10+
Docker Desktop
Git (опційно)
DBeaver (для перевірки БД)
🐳 2. Піднімаємо PostgreSQL (Docker)
docker run --name ai-receipts-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=receipts_db -p 5432:5432 -d postgres
✔ Перевірка
docker ps

має бути:

ai-receipts-db
status: Up
📁 3. Створення проєкту
mkdir ai_receipts_backend
cd ai_receipts_backend
🐍 4. Створення virtual environment
python -m venv venv
▶️ 5. Активація venv
.\venv\Scripts\Activate.ps1
📦 6. Встановлення залежностей
pip install -r requirements.txt
pip install fastapi uvicorn sqlalchemy asyncpg psycopg2-binary
🧱 7. Структура проєкту
ai_receipts_backend/
│
├── app/
│   ├── main.py
│   ├── init_db.py
│   ├── schemas.py
│   │
│   ├── db/
│       ├── database.py
│       ├── models.py
│
├── venv/
🗄️ 8. Підключення до БД
app/db/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/receipts_db"

engine = create_async_engine(DATABASE_URL, echo=True)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()
🧠 9. Створення таблиць
app/init_db.py
import asyncio
from app.db.database import engine, Base
from app.db import models

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    asyncio.run(init_db())
запуск:
python -m app.init_db
📊 10. Моделі (таблиці)
app/db/models.py

(твій файл уже готовий з users, receipts, receipt_items)

🚀 11. FastAPI сервер
app/main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"status": "ok"}
▶️ 12. Запуск сервера
python -m uvicorn app.main:app --reload
🌐 13. Перевірка

В браузері:

http://127.0.0.1:8000

Swagger:

http://127.0.0.1:8000/docs
🧪 14. Перевірка БД

Через DBeaver:

host: localhost
port: 5432
db: receipts_db
user: postgres
pass: postgres
🔥 Що ти отримуєш після цього

✔ працюючий backend
✔ PostgreSQL schema
✔ FastAPI сервер
✔ готову базу під AI pipeline
✔ основу для n8n / OCR / GPT