# 13 · Hosting the website for kids to try

**Status: live.** Website: **https://techstars-1crn.onrender.com** (Render static site). Server: `https://techstars-lumi.onrender.com` (mock mode).

## What runs where
| Piece | Where | Notes |
|---|---|---|
| Lumi server (API) | Render web service `techstars-lumi` | Mock mode: no child's words reach an AI. Never add `LUMI_ADMIN` or `LUMI_PHONE_CAMERA`. |
| Website | Render static site (free, doesn't sleep) | Built from `frontend/`; `VITE_BACKEND_URL` points it at the server (`frontend/.env.production`). |
| Android app | APK, installed by hand | Same server; see [09](09-android-app.md). |

## Set up the website on Render (one time)
1. In the Render dashboard: **New → Static Site**, and connect the GitHub repo `ChinhQuy29/techstars`, branch `main`.
2. Settings:
   | Field | Value |
   |---|---|
   | Name | e.g. `lumi-learn` (becomes `https://lumi-learn.onrender.com`) |
   | Root Directory | `frontend` |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |
3. **Environment variables:** `VITE_BACKEND_URL` = `https://techstars-lumi.onrender.com`, and `NODE_VERSION` = `22`.
4. **Create Static Site.** The first build takes a few minutes. Every push to `main` rebuilds it.
5. **Lock the server to the website:** in the `techstars-lumi` web service → Environment, set `CORS_ORIGINS` to the site's address (`https://techstars-1crn.onrender.com`). The Android app keeps working: its addresses are always allowed (`APP_ORIGINS` in `backend/app/main.py`).

## Before kids use it
- **Parent consent:** children are under 13. Use a short consent note for parents; if this is KU research, check whether it needs IRB approval.
- **Keep mock mode on** (explanations are rated by fixed rules; nothing goes to an AI).
- **Wake the server first:** the free server sleeps after about 15 minutes idle, and the first request then takes 30–50 seconds. Open the link a minute before each session, or move the server to Render's Starter plan while testing.
- **Don't deploy during a session:** progress lives in the server's memory, so a restart wipes the current page (kids can start a new one).
- **Share the link privately:** there's no sign-in or rate limit yet ([08](08-status-and-roadmap.md), "Security before real families").
- **Voice works best in Chrome or Edge.** Tapping and typing work in every browser, including iPad Safari.

## Log
- 2026-11-15: website live at https://techstars-1crn.onrender.com; tested end to end (dream picker, astronaut, 13 skill tiles, demo sheet with astronaut questions, full-page lesson; all API calls 200).
- 2026-11-15: `frontend/.env.production` added; production build tested against the Render server (dream picker, 13 skill tiles, a baker demo sheet; all API calls 200).
