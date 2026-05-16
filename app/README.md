# SmartCart Backend

This folder contains the FastAPI backend for SmartCart: API routes, database
models, schema initialization, seed scripts, receipt scanning, product matching,
price comparison, cashback, and analytics endpoints.

Run backend commands from the repository root so `app` is imported as a Python
package.

## Requirements

- Python 3.10+
- PostgreSQL exposed on host port `5433`
- Backend dependencies from `app/requirements.txt`

## Database

Local Docker PostgreSQL. PostgreSQL uses port `5432` inside the container and
is exposed as `5433` on the host machine:

```bash
docker run --name ai-receipts-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=receipts_db \
  -p 5433:5432 \
  -d postgres
```

If the container already exists:

```bash
docker start ai-receipts-db
```

Expected local database URL:

```text
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/receipts_db
```

## Environment

Copy the root template:

```bash
cp .env.example .env
```

Important variables:

```text
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/receipts_db
DATABASE_ECHO=false
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
SMARTCART_AUTH_SECRET=change-me
OPENAI_API_KEY=
OPENAI_RECEIPT_MODEL=gpt-4.1-mini
RECEIPT_UPLOAD_DIR=uploads/receipt-scans
PRODUCT_IMAGE_DIR=uploads/product-images
CATEGORY_IMAGE_DIR=uploads/category-images
STORE_LOGO_DIR=uploads/store-logos
RECEIPT_MAX_IMAGE_BYTES=10485760
```

`OPENAI_API_KEY` is required only for real receipt image extraction.

## Run Locally

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload
```

Backend URLs:

- API root: `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`
- DB health: `http://127.0.0.1:8000/api/db/health`

## Database Maintenance

Create or update the schema without deleting existing data:

```bash
python -m app.init_db
```

Check the active database and schema:

```bash
python -m app.check_db
```

## Demo Data

Seed a realistic demo receipt for receipt and analytics pages:

```bash
python -m app.seed_mock_receipt
```

Seed product price history and demo price dynamics:

```bash
python -m app.seed_demo_price_data
```

Seed retail store locations and administrative geography data:

```bash
python -m app.seed_retail_store_locations
python -m app.seed_admin_geo_units
```

## Receipt Scanning

The frontend sends camera photos to:

```text
POST /api/receipt-scans/upload
```

The backend stores the image, sends it to OpenAI for structured receipt
extraction, writes the receipt to PostgreSQL, and returns a `receipt_id` for the
receipt summary page.

Manual OCR pipeline endpoints are also available:

- `POST /api/receipt-scans`
- `POST /api/receipt-scans/{scan_id}/parsed`
- `GET /api/product-match-candidates`
- `POST /api/product-match-candidates/{candidate_id}/resolve`

## Assets

Image folders live under `app/uploads/`:

- `receipt-scans/` for uploaded receipt photos.
- `product-images/` for product photos.
- `category-images/` for fallback category images.
- `store-logos/` for retail chain logos.

The repository keeps placeholder and default assets, while generated uploads are
ignored by git.

## Import Official Store Prices

Validate an official store JSON export without modifying the database:

```bash
python -m app.import_products_json /path/to/json-or-zip-or-folder \
  --source official-site-json \
  --dry-run
```

Import after validation:

```bash
python -m app.import_products_json /path/to/json-or-zip-or-folder \
  --source official-site-json
```

The importer accepts a JSON file, a folder with JSON files, or a ZIP containing
only JSON files.
