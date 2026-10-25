# Worldwide Tehillim Club API

Served from `/shabbos-mevorchim-tehillim/api`. Modeled on the Mivtza Lulav API
(`../../mivtzoim/lulav/api`): short, signed bearer tokens over the existing
Mashpia roster and admin accounts. Campaign numbers come from
`class.shabbosMevorchim.php` — the same class every WWTC report page uses
(`shabbos_mevorchim_hq.php`, `shabbos_mevorchim_by_class.php`,
`shabbos_mevorchim_by_student.php`, `battlefront/api/getWWTC.php`) — so the API
returns the figures those reports show.

## Status: read-only first cut

Implemented and verified against live data:

- `POST /soldier/login` — `{ serial, dob: "YYYY-MM-DD" }` → `{ token, expiresIn, soldier }`
- `POST /admin/login` — `{ username, password }` → `{ token, expiresIn, admin }`
- `GET /campaign` — `{ year, currentMonth, currentMonthIndex, months[], monthDates }`
- `GET /stats` — nationwide totals for the current Shabbos Mevorchim:
  `{ monthLabel, year, accomplished, quota, pct, minutes, minutesQuota, minutesPct, soldiers, schools, classes }`

Send the token as `Authorization: Bearer <token>`.

Scaffolded, returning **501** until the next pass (shapes will match
`src/services/api.js`): `GET /schools`, `GET /schools/:id`,
`GET /schools/:id/leaderboard`, `GET /schools/:id/class-leaderboard`,
`GET /perfect-platoons`, `GET /reports/army`, `GET /reports/base/:schoolId`,
`GET /reports/platoon/:classId`, `GET /me/progress`, `GET /me/social`.

Writes return **405** by design for now — soldier self-report
(`POST /me/report`), ladder self-select (`PUT /me/ladder`) and dedications
(`PATCH /schools/:id/dedication`). Recording and ladder assignment stay with the
teacher/HQ tools (`admin_users_track.php`, `mark_tehillim.php`, the teacher
grid) until those writes are designed and signed off. No endpoint here writes to
the database.

## Setup

1. **Token secret.** Set `WWTC_TOKEN_SECRET` in `mashpia.com/includes/globals.php`
   (gitignored) to a random string of at least 32 characters. Do not reuse the
   Lulav or legacy mobile-token secret. Public reads (`/campaign`, `/stats`) do
   not need it; login and `/me/*` return 503 until it is set. The local
   `dev:api` router supplies a development-only fallback.
2. **Origins.** Same-origin requests work unconfigured. For another origin, set
   `WWTC_ALLOWED_ORIGINS` to a comma-separated allowlist.
3. **Token TTL.** Optional `WWTC_TOKEN_TTL` in seconds (default 43,200 = 12h).

## Local testing

```bash
npm run dev:api   # php -S localhost:8080 -t ../../ api/dev-router.php
npm run dev       # Vite proxies /shabbos-mevorchim-tehillim/api to :8080
```

The dev server reads the **real** database, so `/stats` and `/campaign` return
live figures. Compare them against the WWTC "Tehillim Stats" report
(`shabbos_mevorchim_hq.php`) before pointing the SPA at the API.

## How it bootstraps

`bootstrap.php` includes `api/header/db.php` (ActiveRecord + the `$MASHPIA_DB`
PDO, for `Auth::login()` and soldier lookups) and the legacy `db.php` (for
`calculateSM()` and the campaign helpers `ShabbosMevorchim` needs;
`unixtojd()`/`jewishtojd()`/`jdtounix()` are PHP calendar built-ins). It does
**not** include `header.php`, so there is no cookie-session admin gate or HTML
output — this is a JSON API with its own bearer tokens, the Lulav model.

The current Shabbos-Mevorchim date and the English month spellings (matching the
SPA's `ladders.js`) are computed in `wwtcMonthDates()` / `wwtcCurrentDate()`.
Note a leap year (like 5787) splits Adar into `Adar I` / `Adar II`, which the
SPA's 12-month list does not yet model.
