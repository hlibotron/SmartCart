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
