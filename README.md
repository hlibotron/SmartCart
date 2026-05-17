# SmartCart

SmartCart is a web application for personal grocery spend tracking and retail
price analytics. Users can scan receipts, see purchase history, compare product
prices across stores, track cashback, and view category analytics. The business
side of the product provides market, geography, and pricing insights based on
receipt and official-store price data.

## Hackathon Checklist

- GitHub repository: publish this repository with public access.
- README: product description, tech stack, and local run instructions are below.
- Secrets: do not commit local `.env` files or real API keys. Use
  `.env.example` and `frontend/.env.example` as templates.

## License

SmartCart is provided under the [SmartCart Non-Commercial License](LICENSE).
The repository may be viewed, cloned, run, evaluated, and demonstrated for
non-commercial purposes, including hackathon judging and demo review.

Commercial use, resale, sublicensing, paid hosting, monetized services,
integration into commercial products, and business use of the analytics,
pricing, receipt-processing, or data features require prior written permission
from the copyright holders.

Third-party dependencies remain under their own license terms.

## Product Features

- Receipt scanning and structured item extraction.
- Purchase history with receipt details and category fallback images.
- Product catalog with price comparison and store-level price history.
- Personal analytics by category, spend, discounts, and cashback.
- Store logos, category images, and product image fallbacks.
- Business analytics dashboards for geography, categories, and price forecasts.

## Tech Stack

- Backend: Python, FastAPI, SQLAlchemy async, PostgreSQL, Pydantic.
- AI/OCR: OpenAI API for receipt extraction.
- Analytics/ML: pandas, scikit-learn, XGBoost, joblib.
- Frontend: Vite, plain HTML/CSS/JavaScript.
- Database: PostgreSQL, usually run locally through Docker.

## Repository Layout

```text
smartcart/
├── app/                 # FastAPI backend, database models, seed/import scripts
├── frontend/            # Vite frontend application
├── analytics/           # pricing model data and training script
├── docs/                # deployment and technical notes
├── .env.example         # backend environment template
└── requirements.txt     # delegates to app/requirements.txt
```

## Prerequisites

- Python 3.10+
- Node.js 20+; Node.js 22 is recommended
- npm
- Docker Desktop or another local PostgreSQL setup
- Git
  (check app/requirements.txt for detailed list)

## Local Setup

Clone the repository and enter the project root:

```bash
git clone <your-public-github-repo-url>
cd smartcart
```

Create backend environment files:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

For local development the backend `.env` expects PostgreSQL on host port `5433`:

```text
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/receipts_db
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
SMARTCART_AUTH_SECRET=change-me
OPENAI_API_KEY=
OPENAI_RECEIPT_MODEL=gpt-4.1-mini
```

`OPENAI_API_KEY` is only required for real receipt photo extraction. The rest of
the application can run with seeded/demo data without it.

## Database

Start PostgreSQL locally. The database listens on port `5432` inside the
container and is exposed as `5433` on the host machine:

```bash
docker run --name ai-receipts-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=receipts_db \
  -p 5433:5432 \
  -d postgres
```

If the container already exists, start it instead:

```bash
docker start ai-receipts-db
```

If your local machine already has another PostgreSQL on `5432`, keep it as is.
SmartCart connects through `localhost:5433`, so the project database does not
need to take over host port `5432`.

## Backend

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.init_db
python -m uvicorn app.main:app --reload
```

The API runs at:

- `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`
- DB health check: `http://127.0.0.1:8000/api/db/health`

Useful backend commands:

```bash
python -m app.check_db
python -m app.seed_mock_receipt
python -m app.seed_demo_price_data
python -m app.seed_retail_store_locations
python -m app.seed_admin_geo_units
```

## Frontend

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://127.0.0.1:5173`.

During development, Vite proxies:

- `/api/*` to `http://127.0.0.1:8000`
- `/uploads/*` to `http://127.0.0.1:8000`

Useful frontend commands:

```bash
npm run build
npm run preview
```

## Demo Flow

1. Start PostgreSQL.
2. Start the backend.
3. Seed demo data:

   ```bash
   source .venv/bin/activate
   python -m app.seed_mock_receipt
   python -m app.seed_demo_price_data
   ```

4. Start the frontend.
5. Open `http://127.0.0.1:5173` and test receipts, products, analytics, and
   cashback pages.

## Receipt Scan Assets

Uploaded and static images are served from `app/uploads/`:

- `app/uploads/receipt-scans/` for uploaded receipt photos.
- `app/uploads/product-images/` for product photos.
- `app/uploads/category-images/` for category fallback images.
- `app/uploads/store-logos/` for store logos.

Supported product image formats are `.webp`, `.jpg`, `.jpeg`, and `.png`.

## Deployment

Render deployment notes are available in [docs/render-deploy.md](docs/render-deploy.md).

For production, use a managed PostgreSQL database, set a strong
`SMARTCART_AUTH_SECRET`, configure `CORS_ORIGINS` to the deployed frontend URL,
and store API keys only in the hosting provider's environment variables.
