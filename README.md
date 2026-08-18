# SMART SILO MONITORING SYSTEM

Production-ready public dashboard for viewing live Smart Silo telemetry from Blynk, built with Next.js + TypeScript + Tailwind CSS.

## Features

- Public dashboard (no Blynk login required)
- Secure server-side Blynk API access via `/api/silo`
- Live polling every 5 seconds
- Silo level gauge (V1 authoritative)
- Exact firmware datastream mapping:
  - V0 = weight (kg)
  - V1 = percentage
  - V2 = minimum threshold (kg)
  - V3 = maximum threshold (kg)
  - V4 = consumption rate (kg/day)
  - V5 = days of supply
- Silo status logic: LOW LEVEL / NORMAL / HIGH LEVEL / OFFLINE
- Live session weight history (rolling latest 50 readings)
- Responsive dashboard for desktop, tablet, and mobile

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment variables

Create a local `.env` file in the project root (never commit it):

```env
BLYNK_AUTH_TOKEN=your_device_token_here
BLYNK_SERVER=blynk.cloud
```

Notes:

- `BLYNK_AUTH_TOKEN` is required and must stay server-side only.
- `BLYNK_SERVER` defaults to `blynk.cloud` if omitted.

## 3) Run locally

```bash
npm run dev
```

Open:

- `http://localhost:3000`

## 4) Test `/api/silo`

In a second terminal:

```bash
curl http://localhost:3000/api/silo
```

Expected successful response format:

```json
{
  "weight": 7.6,
  "percentage": 38,
  "minThreshold": 5,
  "maxThreshold": 15,
  "consumptionRate": 0.63,
  "daysOfSupply": 12,
  "status": "NORMAL",
  "timestamp": "2026-08-18T00:00:00.000Z"
}
```

## 5) Deploy to Vercel

1. Push repository changes.
2. Import this project into Vercel.
3. Framework preset: **Next.js**.
4. Keep default build command (`next build`).

## 6) Add environment variables to Vercel

In Vercel Project Settings → Environment Variables, add:

- `BLYNK_AUTH_TOKEN`
- `BLYNK_SERVER` (example: `blynk.cloud`)

## 7) Redeploy

After adding/changing environment variables, redeploy the project from Vercel so serverless functions use the new values.

## 8) Open the public URL

After deployment, open your Vercel URL (example):

- `https://smart-silo-monitor.vercel.app`

## 9) Test in Incognito

1. Open an Incognito/Private window.
2. Paste the public URL.
3. Confirm the dashboard loads without Blynk login.
4. Verify live values update every 5 seconds.
5. Verify OFFLINE state appears if the device/cloud cannot be reached.

## Security

- Blynk token is never exposed to client components or `NEXT_PUBLIC_*` vars.
- Browser only calls `/api/silo`.
- Server route calls Blynk HTTPS API (`/external/api/get` and `/external/api/isHardwareConnected`).
