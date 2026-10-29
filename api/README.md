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
- `GET /running-totals` — `{ thisMonth, thisYear, allTime }` (all-time = prior-year
  sealed totals from `tehillim_backups` + this year's live done + optional
  `WWTC_ALLTIME_BASE`).
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

## Your Virtual Commander (talking general)

`POST /chat` — `{ message, history?, context? }` → `{ reply }`. Proxies to the
Claude Messages API with a tightly scoped system prompt: Your Virtual Commander only answers
about the child's Tehillim Club participation (progress, ladder, this month's
kapitlach, missions, medals, rank, next Shabbos Mevorchim, how it works —
including picking a ladder, the quota, and marking it done) and politely refuses
anything off-topic. Ordinary replies are one or two short spoken sentences.
With no ladder yet, the page itself speaks the ladder walk (real grade, month,
and quota) and saves the ladder when the child says yes. The child's data is
passed in `context` (the same snapshot the
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

## Your Virtual Commander — realtime phone call

`POST /realtime-session` turns the commander into a real speech-to-speech call
(OpenAI Realtime over WebRTC, default model `gpt-realtime-2.1`). The browser
never sees the API key. It only receives a short-lived ephemeral token (`ek_…`,
about 10 minutes, used only to open the call). The mic stays open, server VAD
lets the child interrupt, and the model can call `change_ladder` (only after it
asks out loud and the child says yes, and only a ladder that child can pick)
and `get_my_progress`.

Until this endpoint is deployed and the key is set, or on a static host with no
PHP (the Netlify preview), the page keeps the scripted hands-free voice. A
missing key returns **503** and does not log the soldier out.

### What Naftoli does on mashpia.com

1. Deploy these files with the app (the existing `/api/*` rewrite already sends
   them through `api/index.php`):
   - `api/realtime-session.php`
   - `api/commander-prompt.php`
   - `api/index.php` (the new route)
   - `src/data/kidQuestions.js` (the question sheet the prompt reads)
   - the built SPA
2. Put the OpenAI key where PHP can read **`OPENAI_API_KEY`**. Do not commit it,
   and do not put it in the JS bundle, Netlify, or any browser env.
   - Preferred: a real environment variable on the PHP process (Apache
     `SetEnv OPENAI_API_KEY "sk-..."` or the host's env config).
   - The API bootstrap already loads `mashpia.com/includes/globals.php`
     (gitignored). Either of these works there:

     ```php
     putenv('OPENAI_API_KEY=sk-...');
     // or
     define('OPENAI_API_KEY', 'sk-...');
     ```
3. Optional: `OPENAI_REALTIME_MODEL` (default `gpt-realtime-2.1`; `gpt-realtime`
   still works) and `OPENAI_REALTIME_VOICE` (default `marin`).
4. Check with a soldier token, not from a browser page source:

   ```bash
   curl -s -X POST -H "Authorization: Bearer $SOLDIER_TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"context":{"name":"Test"}}' \
     https://mashpia.com/shabbos-mevorchim-tehillim/api/realtime-session
   ```

   A good response is `{"value":"ek_...","expires_at":...,"model":"gpt-realtime-2.1"}`.
   It must not contain `sk-`. No token, or an admin token, is rejected.
   No key is **503**.

Rough cost on `gpt-realtime-2.1` (audio tokens, not a per-minute plan): about
**$0.02 per minute of the child speaking** and **$0.08 per minute of the
commander speaking**. A normal back-and-forth minute is about **5–10 cents**.
Silence with the mic open is not billed as a full minute of speech. Input
transcription adds a small extra. `gpt-realtime-2.1-mini` is roughly a third of
that if you set `OPENAI_REALTIME_MODEL`.

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
