# Varaaha FastAPI Backend Template

This directory hosts the FastAPI-based rewrite of the Varaaha backend. The goal is to provide a drop-in replacement for the existing Node/Express service while keeping the database schema, business rules, and third-party integrations (Razorpay, SMTP, coupons) aligned.

## Features

- Modular FastAPI application (`app/`) with versioned routers under `api/routes/v1`.
- Centralised Pydantic settings (`core/config.py`) loading values from environment variables. All URLs, domains, and third-party credentials are dynamic and environment driven.
- Async SQLAlchemy session factory (`db/session.py`) ready for MySQL via `asyncmy`.
- Placeholder service layers for authentication and Razorpay payments to be fleshed out during migration.
- Poetry project (`pyproject.toml`) declaring runtime and development dependencies.

## Getting Started

1. **Install dependencies**
   ```bash
   cd backend-python
   poetry install
   ```

2. **Configure environment variables**
   Duplicate your existing backend `.env`, adjust keys as needed, and place it at `backend-python/.env`. Key variables include:
   - `APP_NAME`, `APP_DOMAIN`, `APP_URL`
   - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

3. **Run the server**
   ```bash
   poetry run uvicorn app.main:app --reload --port 4000
   ```

   The root endpoint responds at `/`, while versioned routes live under `/api/v1` (e.g. `/api/v1/health`).

4. **Next steps for migration**

   - Port each Express controller into the corresponding FastAPI router (auth, addresses, products, orders, coupons, payments).
   - Translate Zod schemas into Pydantic models inside `app/schemas`.
   - Move pricing, coupon, and Razorpay logic into `app/services`, sharing code with routers via dependency injection.
   - Implement database models with SQLAlchemy that map to the current MySQL tables (see `backend/database/schema.sql`).
   - Replace placeholder authentication logic with real password hashing, JWT issuance, and refresh token storage.
   - Add pytest/coverage to ensure behavioural parity with the Node implementation.

## Folder Overview

```
app/
├── api/
│   ├── deps.py              # Shared FastAPI dependencies (auth, DB session)
│   └── routes/
│       └── v1/              # Versioned API routers (start with health, auth, etc.)
├── core/
│   ├── config.py            # Environment-driven configuration
│   └── security.py          # JWT creation & decoding helpers
├── db/
│   └── session.py           # Async SQLAlchemy session generator
├── models/                  # SQLAlchemy models (to be implemented)
├── schemas/                 # Pydantic schemas (Zod equivalents)
├── services/                # Business logic modules
└── main.py                  # FastAPI app factory and router registration
```

This template is intentionally lightweight so you can migrate one feature at a time. Replace placeholder logic with the real implementations as you port the existing backend.
