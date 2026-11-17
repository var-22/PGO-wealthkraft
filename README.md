# PGO Wealth — customer app

A phone-first app where a customer signs in and sees their mutual fund portfolio: what it is worth,
and whether each fund is **On track**, a **Promising start**, on **Watch** or **Off track**.

No AI model is used anywhere. Every figure is calculated, and every verdict comes from fixed rules.

## How it fits together

```
frontend (React, Vite)  ──/api──>  backend (Node, Express)  ──/analyze──>  calc-service (Python)
     phone-style UI                 login, storage, verdicts                 NAVs, XIRR, benchmarks, risk
```

- **frontend/** — the app: Home, Funds, fund details, Transactions, Insights, Profile.
  - Home shows the portfolio value against money invested, the on-track verdict, funds that need a
    look, upcoming SIPs and the category mix. The eye button hides every rupee figure.
  - Profile holds the account (change name, change password, delete account), the customer's data
    (view transactions, download holdings as CSV, replace transactions) and app settings (hide
    amounts, light/dark appearance). The two settings are kept in the browser, per device.
- **backend/** — sign-up and sign-in, each customer's transactions, and the on-track verdicts.
  - `src/services/sipPlan.js` reads each running SIP's monthly amount and next expected date off the
    customer's own instalments (monthly SIPs only; anything else is left out, not guessed).
  - Changing the password signs out every other device. Every answer carries browser safety headers
    (set in `src/server.js`).
  - `npm test` runs the tests.
  - `src/classifier/verificationJson.js` and `fundSummary.js` are **unmodified copies** from the stock
    project (`backend/src/pipeline/`). They hold the badge rules. If the rules change there, copy the
    two files across again.
  - `src/classifier/classify.js` feeds each fund's figures to those rules (the same steps as the
    stock project's `classifyScheme`) and maps the seven badges to the four words customers see.
- **calc-service** — not in this folder. The backend calls the stock project's calc-service at
  `CALC_SERVICE_URL` (default `http://localhost:8000`). It must be running.

## Run it locally

```
cd backend   && npm install && npm run dev      # http://localhost:4100
cd frontend  && npm install && npm run dev      # http://localhost:5573
```

Open http://localhost:5573 on a phone-width window. After `npm run build` in `frontend/`, the backend
also serves the built app itself at http://localhost:4100.

## Run it with Docker

One image holds the built app and the backend; it serves both on port 4100.

```
docker compose up -d --build      # then open http://localhost:4100
docker compose logs -f            # watch it
docker compose down               # stop (data is kept)
```

- **Calc-service** is not in the image. By default the container calls the one on this computer's
  port 8000 (`http://host.docker.internal:8000`); it must listen on `0.0.0.0`. To use another
  address, set `CALC_SERVICE_URL`.
- **Data** (users, transactions, the day's analysis, the cookie secret) is kept in the Docker volume
  `pgo-data`, mounted at `/data`. `docker compose down -v` deletes it.
- **Settings** go in a `.env` file next to `docker-compose.yml`; copy `.env.docker.example`.
- Behind HTTPS (a reverse proxy in front), the login cookie is marked secure by itself.

## Put it on a server (HTTPS, installable as an app)

The app is a PWA: on a phone it can be installed to the home screen and opens full-screen like any
app. Phones only allow that from an **HTTPS** address, so the server setup includes Caddy, which
gets and renews a free certificate by itself.

On the server (any Linux machine with Docker; ports 80 and 443 open to the internet):

```
git clone <this repository>  &&  cd pgo        # or copy the folder across
cp .env.server.example .env                    # then fill in PGO_DOMAIN and JWT_SECRET
docker compose -f docker-compose.server.yml up -d --build
```

Then open `https://<PGO_DOMAIN>`. The first visit can take up to a minute while the certificate is issued.

- **Address.** `PGO_DOMAIN` must resolve to the server. Without a domain of your own, use the
  server's IP with dashes plus `.sslip.io` (for example `203-0-113-10.sslip.io`); it needs no setup.
- **Calc-service.** It must run on the same server on port 8000 (start the stock project's Docker
  setup there), or set `CALC_SERVICE_URL` to wherever it is. Keep port 8000 closed to the internet.
- **Data** lives in the `pgo-data` volume. Back it up with
  `docker run --rm -v pgo_pgo-data:/data -v "$PWD":/out alpine tar czf /out/pgo-data.tgz -C /data .`
- **Updating.** Pull the new code and run the same `up -d --build` command. Phones pick up the new
  version the next time the app is opened.
- **Installing on a phone.** Android (Chrome): open the address, then tap **Install** on the home
  screen banner or in Profile → App settings. iPhone (Safari): Share → **Add to Home Screen**.

What the app keeps on the phone is only its own screens (`frontend/public/sw.js`); sign-in and
portfolio figures always come from the server, so the app needs a connection to show data.

## Where a customer's data comes from

A customer adds their transactions as a CSV with these columns:

```
scheme_code,scheme_name,transaction_type,units,nav,transaction_date
```

`scheme_code` is the AMFI code; `transaction_type` is BUY, SIP, SELL or DIVIDEND. A new customer can
also explore with a sample portfolio of six real funds (`backend/src/sample/sample-portfolio.csv`,
rebuilt from published NAVs with `node scripts/build-sample.mjs`).

The calc-service result is kept for the day in `backend/data/analysis/`, so the app opens instantly
after the first calculation. The first one each day can take minutes; the app shows a "preparing"
screen and checks back by itself.

## Data on disk

Everything is under `backend/data/` (not in git): `users.json` (passwords are bcrypt hashes),
`portfolios/` (transactions), `analysis/` (the day's results) and `jwt-secret`.
