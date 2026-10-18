# Deezy Easy Data Web

The Next.js 16 customer dashboard and admin console for Deezy Easy Data.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The application runs on `http://localhost:3000` and expects the Django API at the URL configured by `NEXT_PUBLIC_API_URL`.

## Included flows

- Registration and login
- Wallet funding through PayVessel
- PayVessel virtual bank accounts
- Data, airtime and bill vending through NewDataSub
- Transaction history, notifications and profile settings
- Administrative users, products, providers and wallet controls
