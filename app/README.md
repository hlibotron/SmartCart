📦 AI Receipts Backend — документація запуску
🧱 1. Вимоги

Перед стартом має бути встановлено:

Python 3.10+
Docker Desktop
Git (опційно)
DBeaver (для перевірки БД)
🐳 2. Піднімаємо PostgreSQL (Docker)
docker run --name ai-receipts-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=receipts_db -p 5432:5432 -d postgres

Важливо: для SmartCart використовується саме Docker-БД `ai-receipts-db`
з базою `receipts_db`. Якщо порт `5432` вже зайнятий локальним PostgreSQL
або іншою БД, Docker-контейнер не зможе коректно зайняти цей порт.

Перевірити, хто слухає `5432`:

sudo ss -ltnp 'sport = :5432'

Якщо там не `ai-receipts-db`, а локальний процес `postgres`, зупини локальний
PostgreSQL перед запуском Docker-БД для цього проєкту:

sudo systemctl stop postgresql

Після цього запусти команду `docker run` вище.

✔ Перевірка
docker ps

має бути:

ai-receipts-db
status: Up

Перевірка підключення до проєктної БД:

PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d receipts_db -c 'select current_database(), current_user;'

Очікувано:

receipts_db | postgres
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
🧠 9. Створення/оновлення таблиць

Команда нижче створює таблиці й безпечно додає нові nullable/default-колонки,
якщо вони потрібні фронтенду. Вона не очищає існуючі дані.

python -m app.init_db

Перевірка схеми без змін у БД:

python -m app.check_db

Очікувано:

database=receipts_db
user=postgres
schema=ok

У цьому репозиторії `DATABASE_URL` можна тримати в локальному `.env`:

DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/receipts_db

Файл `.env` не додається в git. Для команди є приклад `.env.example`.
📊 10. Моделі (таблиці)
app/db/models.py

Основні таблиці:

users
receipts
receipt_items

Додаткові таблиці для frontend-аналітики та майбутніх реальних даних:

products
stores
product_prices
cashback_offers

Таблиці для OCR/AI сканування чеків:

receipt_ocr_jobs
product_aliases
product_match_candidates

OCR pipeline:

1. Зовнішній OCR/AI сервіс читає фото чеку.
2. Backend отримує `image_url` і створює scan job:

curl -X POST http://127.0.0.1:8000/api/receipt-scans \
  -H 'Content-Type: application/json' \
  -d '{"user":{"telegram_id":1001,"username":"demo"},"image_url":"https://example.com/receipt.jpg","provider":"manual"}'

3. OCR/AI повертає структурований JSON у backend:

curl -X POST http://127.0.0.1:8000/api/receipt-scans/1/parsed \
  -H 'Content-Type: application/json' \
  -d '{
    "store":"АТБ",
    "receipt_datetime":"2026-05-11T12:35:00",
    "currency":"UAH",
    "items":[{
      "raw_name":"МОЛОКО ГАЛИЧИНА 2.5% 900Г",
      "item_name":"Молоко 2.5%",
      "price":24.90,
      "quantity":2,
      "unit":"шт",
      "discount_amount":4.00,
      "category":"Молочні",
      "brand":"Галичина",
      "thumbnail":"milk",
      "is_promotional":true
    }]
  }'

4. Backend match-ить `raw_name` з `products` і `product_aliases`.
5. Якщо збіг впевнений, чек записується як matched.
6. Якщо збіг невпевнений, створюється `product_match_candidates` для ручного підтвердження.

Перегляд pending-кандидатів:

curl -s http://127.0.0.1:8000/api/product-match-candidates

Підтвердження кандидата і створення alias для майбутніх чеків:

curl -X POST http://127.0.0.1:8000/api/product-match-candidates/1/resolve \
  -H 'Content-Type: application/json' \
  -d '{"product_id":12,"create_alias":true}'

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

Health endpoints:

curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/api/db/health
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
