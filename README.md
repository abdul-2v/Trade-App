# TradeHub

TradeHub is a React Native + Expo mobile app for finding nearby tradespeople.

## Current app

The repository contains the working customer and tradesperson prototype:

- Customer home with trade categories
- Nearby tradespeople map-style view
- Tradesperson profiles
- Call and in-app message actions
- Booking flow
- "Need someone now?" urgent matching flow
- Requests and messages
- Customer profile
- TradeHub Pro mode for tradespeople
- Go Available control
- Travel radius and availability duration
- Nearby work opportunities

The current people and locations are demo data. Supabase, live GPS, a production map provider, push notifications and payments are the next backend layers.

## Run locally

```bash
npm install
npx expo login
npx expo start --tunnel
```

Open Expo Go on your iPhone using the same Expo account and scan the QR code.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Never commit secret backend keys.

Public mobile values may use `EXPO_PUBLIC_`. Secret keys such as Supabase service-role, Stripe secret keys and webhook secrets must remain server-side.

## Repository layout

The Expo app is stored at the repository root. In Expo's GitHub settings, leave **Base directory blank**.
