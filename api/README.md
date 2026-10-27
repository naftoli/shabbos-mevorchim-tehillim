# Worldwide Tehillim Club API

Served from `/shabbos-mevorchim-tehillim/api`. Modeled on the Mivtza Lulav API
(`../../mivtzoim/lulav/api`): short, signed bearer tokens over the existing
Mashpia roster and admin accounts. Campaign numbers come from
`class.shabbosMevorchim.php` — the same class every WWTC report page uses
(`shabbos_mevorchim_hq.php`, `shabbos_mevorchim_by_class.php`,
`shabbos_mevorchim_by_student.php`, `battlefront/api/getWWTC.php`) — so the API
returns the figures those reports show.

## Status

Reads — all implemented (same figures as the WWTC report pages):

- `POST /soldier/login` — `{ serial, dob: "YYYY-MM-DD" }` → `{ token, expiresIn, soldier }`
- `POST /admin/login` — `{ username, password }` → `{ token, expiresIn, admin }`
- `GET /campaign` — `{ year, currentMonth, currentMonthIndex, months[], monthDates }`
- `GET /stats` — nationwide totals:
  `{ monthLabel, year, accomplished, quota, pct, minutes, minutesQuota, minutesPct, soldiers, schools, classes }`
- `GET /running-totals` — `{ thisMonth, thisYear, allTime }` (all-time = this year +
  `WWTC_ALLTIME_BASE`, since there is no historical kapitlach store).
- `GET /schools` (full per-school aggregate: kapitlach/minutes/pct + kids/met/pctMet),
  `GET /schools/:id`, `GET /schools/:id/class-leaderboard`,
  `GET /schools/:id/leaderboard` (public — full soldier names),
  `GET /schools/:id/not-completed` (admin), `GET /perfect-platoons`,
  `GET /reports/army`, `GET /reports/base/:schoolId`, `GET /reports/platoon/:classId`
  (all take `?monthIdx=` for an elapsed month; default current),
  `GET /me/progress`, `GET /me/social`.

Per-school / per-class "soldiers who completed" and "perfect platoons" come from
the mission-mark signal (`date_tasks_mission_marks`) via cheap grouped queries
(`wwtcCompletionCounts()`), not a per-student loop — so the home page and stats
scale to the whole army. "Perfect platoon" here means every enrolled soldier in a
class earned the mission this month (met === size), matching the SPA.

Send the token as `Authorization: Bearer <token>`.

Writes — the signed-in soldier's own, scoped by the bearer token to their
`user_id`:

- `POST /me/report` — `{ kapitlach, minutes }` for the **current** Shabbos
  Mevorchim → fresh `/me/progress`. Writes `date_tasks_marks` (grids 8001/8002)
  and keeps the kapitelach mission mark (`date_tasks_mission_marks`) in sync with
  the quota, exactly as `mark_tehillim2.php` does, in one transaction, then bumps
  `Cache::bumpVersion('shabbos_mevorchim:v')` so the reports refresh.
- `PUT /me/ladder` — `{ ladder }` (5..12) → writes `user_tracks.track_id` for the
  Tehillim subject. Ladder ↔ track mapping: `track_id = 13 - ladder` (ladder 12 =
  track 1 … 5 = track 8; only tracks 3..8 exist today).

Still **405** by design: dedications (`PATCH /schools/:id/dedication`) — the SPA
keeps dedications client-side until that write is designed.

> Writes have been verified read-only (the mission/task lookups resolve correctly
> against live data) but the INSERT/UPDATE/DELETE path has NOT been exercised
> against a database yet — test on `test.mashpia.com` before master.

## General 613 (talking general)

`POST /chat` — `{ message, history?, context? }` → `{ reply }`. Proxies to the
Claude Messages API with a tightly scoped system prompt: General 613 only answers
about the child's Tehillim Club participation (progress, ladder, this month's
kapitlach, missions, medals, rank, next Shabbos Mevorchim, how it works —
including picking a ladder, the quota, and marking it done) and politely refuses
anything off-topic. Replies are written to be spoken aloud: one or two short,
simple sentences. The child's data is passed in `context` (the same snapshot the
SPA already shows, plus the greeting they just heard); no DB read is required.
The SPA falls back to its built-in scripted answers whenever this endpoint is
unavailable, so the static Netlify build keeps working. The browser speaks with
`speechSynthesis` and can listen with `SpeechRecognition`; neither needs this key.

Setup: set **`WWTC_AI_KEY`** (an Anthropic API key) in
`mashpia.com/includes/globals.php` (gitignored) or the environment — the key is
server-side only, never shipped to the browser. Optional `WWTC_AI_MODEL`
(default `claude-haiku-5-5`). Until the key is set, `/chat` returns 503 and the
SPA uses the scripted helper. Note: this bills per message and is used by
children — consider adding rate-limiting/abuse protection before heavy use.

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
