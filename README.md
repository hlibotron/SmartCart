# Smartcart

Repository layout:

```text
smartcart/
├── app/          # FastAPI backend
└── frontend/     # Vite HTML/CSS/JS frontend
```

## Backend

```bash
cd app
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The backend runs on `http://127.0.0.1:8000`.

### Receipt camera scan

The frontend sends camera photos to `POST /api/receipt-scans/upload`. The
backend stores the image locally, sends it to OpenAI for structured receipt
extraction, creates the receipt in PostgreSQL, and returns `receipt_id` for the
existing `/receipt-summary?receipt=<id>` page.

Required backend environment:

```bash
OPENAI_API_KEY=sk-...
OPENAI_RECEIPT_MODEL=gpt-4.1-mini
RECEIPT_UPLOAD_DIR=uploads/receipt-scans
PRODUCT_IMAGE_DIR=uploads/product-images
CATEGORY_IMAGE_DIR=uploads/category-images
STORE_LOGO_DIR=uploads/store-logos
RECEIPT_MAX_IMAGE_BYTES=10485760
```

### Product photos

To make receipt summaries use a real product photo, put the image into:

```text
app/uploads/product-images/
```

Supported formats are `.webp`, `.jpg`, `.jpeg`, and `.png`.

Recommended names:

```text
product-{product_id}.webp
{product_id}.webp
normalized-product-name.webp
```

Examples:

```text
app/uploads/product-images/product-12.webp
app/uploads/product-images/12.webp
app/uploads/product-images/молоко-2-5.webp
```

The backend checks this folder when building receipt item `visual` data. If no
matching photo exists, the frontend keeps using the category fallback image.

### Category photos

Default category photos live in:

```text
app/uploads/category-images/
```

Expected names:

```text
dairy.png
meat.png
vegetables.png
fruits.png
drinks.png
grocery.png
other.png
```

The backend uses these files when a specific product photo is missing.

### Store logos

Store logos live in:

```text
app/uploads/store-logos/
```

Recommended names:

```text
atb.png
silpo.png
novus.png
auchan.png
```

You can also use the normalized store name, for example `атб.png` or
`сільпо.png`. The backend uses these logos in receipt lists, receipt summary,
and product price store rows.

### Official store product prices

Official store-site JSON exports are imported with a dedicated script. These
prices are stored as reference online prices, not guaranteed prices for every
physical store location in the same chain.

Validate an export without touching the database:

```bash
cd smartcart
app/.venv/bin/python -m app.import_products_json /path/to/json-or-zip-or-folder \
  --source official-site-json \
  --dry-run
```

Import after validation:

```bash
app/.venv/bin/python -m app.init_db
app/.venv/bin/python -m app.import_products_json /path/to/json-or-zip-or-folder \
  --source official-site-json
```

The importer accepts a JSON file, a folder with JSON files, or a ZIP containing
only JSON files. It writes products, stores, product listings, aliases, and
price history. Price comparison APIs read official prices separately from
receipt-observed prices.

## Frontend

Frontend stack: plain `HTML/CSS/JS` with Vite as a local dev/build tool.

Frontend source layout:

```text
frontend/
├── index.html              # Single app entry point
├── src/
│   ├── app.js              # App shell: status bar, header, bottom nav, route render
│   ├── router.js           # Route registry for all pages
│   ├── data/
│   │   ├── home.js         # Home page content/data
│   │   └── navigation.js   # Bottom navigation items
│   ├── pages/              # One module per app page
│   │   ├── home.js
│   │   ├── products.js
│   │   ├── analytics.js
│   │   ├── profile.js
│   │   ├── receipts.js
│   │   └── cashback.js
│   ├── shared/
│   │   └── icons.js        # Reusable inline SVG icons
│   └── styles/
│       ├── main.css        # CSS imports
│       ├── base.css        # Variables, reset, typography, app frame
│       ├── components.css  # Shared app/header/nav/card components
│       └── home.css        # Home-specific layout and illustration
```

To add a new frontend page:

1. Create `frontend/src/pages/<page>.js` with a `render<Page>Page()` function and optional bind function.
2. Register it in `frontend/src/router.js`.
3. Add a bottom-nav item in `frontend/src/data/navigation.js` only if it belongs in the fixed nav.
4. Put page-specific static content in `frontend/src/data/` when it starts growing.
5. Keep shared UI styles in `components.css`; use a page CSS file only for page-specific layout.

Required on developer machine:

- Node.js `22.x` recommended, `20.x` minimum
- npm, usually installed together with Node.js

Project dependencies are installed locally into `frontend/node_modules/`:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://127.0.0.1:5173`.

During development, frontend API calls to `/api/*` are proxied to the FastAPI server on port `8000`.

Useful frontend commands:

```bash
cd frontend
npm install      # install local frontend dependencies from package-lock.json
npm run dev      # start local dev server
npm run build    # build static files into frontend/dist
npm run preview  # preview the production build locally
```

Do not install frontend packages globally for this project. Use local npm dependencies only.
