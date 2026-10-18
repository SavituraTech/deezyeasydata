# Deezy Easy Data

A Django + Next.js monorepo for data, airtime and bill payments.

- `backend/` — Django REST API, PayVessel wallet funding, NewDataSub vending
- `frontend/` — Next.js customer dashboard and admin console

## Local setup

```bash
cd backend
cp .env.example .env
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The web app runs on `http://localhost:3000` and the API on `http://localhost:8000`.

## Provider setup

Add the PayVessel and NewDataSub credentials from `backend/.env.example`. Configure PayVessel's webhook URL as:

```text
https://your-api-domain.com/api/integrations/payvessel/webhook/
```

Sync the NewDataSub catalogue with:

```bash
cd backend
.venv/bin/python manage.py sync_newdatasub_products
```
