# Render deploy

## Backend Web Service

Create a Render Web Service from the repository root.

```text
Runtime: Python 3
Root Directory: leave empty
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

The repository pins Python in `.python-version` to avoid Render's default
runtime selecting a newer Python version before all pinned wheels support it.

Environment variables:

```text
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@INTERNAL_HOST:5432/DATABASE
OPENAI_API_KEY=<new OpenAI API key>
OPENAI_RECEIPT_MODEL=gpt-4.1-mini
SMARTCART_AUTH_SECRET=<long random secret>
CORS_ORIGINS=https://YOUR_FRONTEND.onrender.com
DATABASE_ECHO=false
```

Use the Render Postgres Internal Database URL and replace `postgresql://` with
`postgresql+asyncpg://`.

## Frontend Static Site

Create a Render Static Site from the same repository.

```text
Root Directory: frontend
Build Command: npm ci && npm run build
Publish Directory: dist
```

Environment variables:

```text
VITE_API_ORIGIN=https://YOUR_BACKEND.onrender.com
VITE_BASE_PATH=/
```

Add this rewrite for SPA routes:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```
