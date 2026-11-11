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
- `POST /parent/handoff` — `{ parent, child }` → `{ code, expiresIn }` (parent mobile session; one of that parent's registered children)
- `POST /soldier/handoff` — `{ code }` → the same kid session as `/soldier/login`. The parent site opens `/shabbos-mevorchim-tehillim/?handoff=<code>`, and the SPA lands on the personal page.
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
  `GET /reports/army`, `GET /reports/base/:schoolId`,
  `GET /reports/platoon/:classId` (class summary is public; the student roll is staff-only — see below).
  Reports take `?monthIdx=` for an elapsed month, or `?year=&month=`; default is the current month.
- `GET /me/progress`, `GET /me/social`.

Per-school "soldiers who completed" on the home race still comes from the
mission-mark signal (`date_tasks_mission_marks`) via `wwtcCompletionCounts()`.
A perfect platoon does not. Home (`GET /perfect-platoons` and the stats count),
the school classes view, the base and platoon reports, the holiday board, and
the Wednesday follow-up PDF (`api/notify-wednesday.php`) share one roster: every
soldier on that class has live kapitlach said (`date_tasks_marks.done_qty`) at
least their own quota (`date_tasks.quantity`, on the ladder they were on for
that Shabbos Mevorchim). An unaccepted over-entry flag is put back to the prior
mark. A base-commander quota override replaces that month's quota with what the
soldier entered. The report engine still supplies kapitlach totals; it does not
decide the star. Mission marks are the medal signal and can be missing after a
class has already finished, which used to hide perfect classes from the home list.
The list is one row per class id — the teacher and the class-name spelling are
labels, not keys — and it never includes student names. The "3 / 16" on a home
card is perfect classes out of the classes on that roster.

Send the token as `Authorization: Bearer <token>`.

## Class roll (not public)

`GET /reports/platoon/:classId` stays on the reports screen without a login, but
the public JSON is only the class summary:

```json
{ "month": "Cheshvan", "school": "…", "className": "5-B", "completed": 3, "size": 5, "perfect": false, "roll": false }
```

There is no `rows` array. Student names, ladders, quotas, and "said X of Y" are
not in the body. `roll: true` plus `rows` is added only for a staff bearer.
A missing token, a soldier token, or a token for a different school is still
**200** with the summary (not 401), so the public page keeps working.

Who sees the roll (`WWTC_PLATOON_ROLL_AUDIENCE` in `api/platoonRoll.php`, same
default as `PLATOON_ROLL_AUDIENCE` in `src/lib/decisions.js`): **`staff`**.

- HQ — `admins.auth = super` — every class
- School admin — `admin_auths.auth = 'school'` and `id = school_id` — every class in that school
- Class teacher — `admin_auths.auth = 'class'` and `id = class_id` — that class only
- A future token `type: "teacher"` with `classId` — that class only (nothing issues this yet; the SPA sends the admin token)

There is no separate teacher login. This API does not read the mashpia.com
cookie session (`header.php` is not included). `classes.class_teacher` is the
name printed on the perfect-platoon chip, not an account.

### What Naftoli does on mashpia.com

1. Deploy `api/platoonRoll.php` and the updated `api/index.php` with the app.
   The new SPA will not paint a roll unless the response says `roll: true`, so
   the public page hides names as soon as the SPA is deployed. Staff see the
   roll only after this PHP is on the server too. Until then, `curl` of the
   old endpoint still returns names — deploy the PHP before treating the API
   as closed.
2. Teachers sign in on the existing School Admin page (`POST /admin/login`,
   Mashpia username and password). HQ and a school admin need no new rows.
3. A teacher who should see only their own class needs an `admin_auths` row:
   `auth = 'class'`, `id = class_id`. If the live table uses a different
   `auth` string for a class, change `WWTC_CLASS_AUTH` in `api/platoonRoll.php`.
4. No new secret. The existing `WWTC_TOKEN_SECRET` signs the admin token.

Writes — the signed-in soldier's own, scoped by the bearer token to their
`user_id`:

- `POST /me/report` — `{ kapitlach, minutes }` for the **current** Shabbos
  Mevorchim → fresh `/me/progress`. Writes `date_tasks_marks` (grids 8001/8002)
  and keeps the kapitelach mission mark (`date_tasks_mission_marks`) in sync with
  the quota, exactly as `mark_tehillim2.php` does, in one transaction, then bumps
  `Cache::bumpVersion('shabbos_mevorchim:v')` so the reports refresh.
  A report past the grade line in `api/over-entry.json` is not written there.
  The API returns 409 `over_entry` unless the body includes `flagConfirmed: true`,
  and then it stores a `flagged` row (`api/sql/wwtc_flagged_entries.sql`, run once
  on mashpia — the API does not run it). **Flagged amounts are excluded from
  public totals, ranks, Perfect Platoon, and medals until accepted.**
- `GET /admin/flags` — the review queue for HQ (every base) or that school's
  base commander. Each row has the soldier, class, amount, threshold, and date.
- `POST /admin/flags/:id/accept` — the amount counts, like a normal mark.
- `POST /admin/flags/:id/remove` — the entry is void. The soldier goes back to
  the value they had before, or to not counted for the month.
  Every flag, accept, and remove is a row in `wwtc_flag_decisions` (who and when).
- `PUT /me/ladder` — `{ ladder }` (5..12) → writes `user_tracks.track_id` for the
  Tehillim subject. Ladder ↔ track mapping: `track_id = 15 - ladder` (ladder 12 =
  track 3 … 7 = track 8; only tracks 3..8 exist today).

Writes — admin (bearer from `POST /admin/login`):

- `PUT /admin/ladder` — `{ schoolId, classId?, kidId?, ladder }` (ladder 5..12) →
  sets `user_tracks.track_id` for every registered soldier with a Tehillim track
  (`subject_id = 1`) in the chosen scope — no `enrolled = 1` filter, matching the
  mobile `changeLevel.php` write — returning `{ ok, matched, updated, ladder }`
  (`matched` = soldiers in scope, `updated` = rows actually changed). Scope:
  whole school (`classId`/`kidId` omitted), one class (`classId`), or one soldier
  (`kidId` — the platoon roll's row id, i.e. the soldier's `user_id`). Authority
  is the same staff rule as the roll: HQ sets any school, a school admin only
  their own school, a class teacher only their own class. A whole-school write
  needs HQ or that school's admin (a class-only teacher is limited to their
  class). Same column as `/me/ladder`.

- `GET /dedication?scope=army|school[&schoolId=&year=&month=]` and
  `PUT /dedication` — `{ scope, schoolId?, text, year?, month? }` → the monthly
  dedication, stored per `(scope, school_id, campaign_year, month_name)` in
  `wwtc_dedications` (run `api/sql/wwtc_dedications.sql` once; the PUT returns
  **503** until it exists). Empty `text` deletes the row. Army scope is HQ only;
  school scope needs HQ or that school's admin. The army dedication shows on the
  home page; the school dedication shows on that school's campaign page
  (`GET /schools/:id` returns it for the current month).

- `POST /admin/quota-override` — `{ kidId, year, month, reason? }` and
  `POST /admin/quota-override/undo` — `{ kidId, year, month }`. A base
  commander (school admin) or HQ sets one soldier's quota for that one month
  to the kapitlach they entered, so the month counts as met. The ladder and
  every other month stay as they are. Stored in `wwtc_quota_overrides`
  (run `api/sql/wwtc_quota_overrides.sql` once; both routes return **503**
  until it exists). The same file creates `wwtc_audit_log`. A commander of
  another school gets **403**. Cheshvan is often repriced from today's ladder;
  an active override replaces that number wherever this API computes a quota,
  a completion, a class or school total, a perfect platoon, a streak, a medal,
  a rank, or the monthly report. The platoon roll (staff only) shows
  "quota adjusted by base commander".

### What Naftoli does for quota overrides

1. Run `api/sql/wwtc_quota_overrides.sql` once on the mashpia database.
   It creates `wwtc_quota_overrides` and `wwtc_audit_log`. Do not run it from
   the app. Until both tables exist, Override returns **503**.
2. Deploy `api/quotaOverride.php`, `api/bootstrap.php`, and `api/index.php`
   with the app. No new secret. HQ and a school admin sign in with the
   existing admin login. A base commander can override only soldiers in a
   school on their `admin_auths` row (`auth = 'school'`). HQ (`admins.auth =
   super`) can override any school.
3. Nothing else to configure. The override is read on each request, so the
   report cache does not have to be flushed. The soldier's ladder row is not
   changed.

### Custom ladder

- `GET /admin/custom-ladders?schoolId=` — soldiers in that school (names are
  admin-only) with the quota they are on now and any custom ladder.
- `POST /admin/custom-ladder` — `{ kidId, targetKapitlach, finishGrade, reason? }`.
  The server builds the grade × month grid: "finish N kapitlach by that grade",
  continuing from the soldier's current quota so it does not drop. Stored in
  `wwtc_custom_ladders` (run `api/sql/wwtc_custom_ladders.sql` once; the route
  returns **503** until that table and `wwtc_audit_log` exist).
- `POST /admin/custom-ladder/remove` — `{ kidId }` puts them back on the normal ladder.

  Same permission as a quota override: HQ any school, a base commander only
  their own school. A class teacher is refused. Set and remove are rows in
  `wwtc_audit_log` (`custom_ladder_set`, `custom_ladder_remove`).

  Precedence for one month: the one-month quota override wins for the kapitel
  quota (that month counts as met). Otherwise the custom ladder supplies
  kapitel and minutes. Otherwise the normal ladder. The stored grid is what
  reports use, so the numbers stay put if the generator changes later.

  A monthly quota above 150 is not capped. It is shown as
  `KAPITEL_ABOVE_TEHILLIM_DISPLAY = 'tehillim-plus-count'`
  (see `src/lib/customLadder.js`): 190 is "1 Tehillim + 40 kapitlach" with the
  plain number beside it, 300 is "2 Tehillim". Sholem is confirming whether a
  target above 150 means that many kapitlach in the month.

### What Naftoli does for custom ladders

1. Run `api/sql/wwtc_custom_ladders.sql` once on the mashpia database.
   It creates `wwtc_custom_ladders` only. It does not alter Mashpia tables.
   Set/remove also write `wwtc_audit_log`. If that table is missing, run
   `api/sql/wwtc_quota_overrides.sql` once too. Do not run either file from
   the app. Until both exist, Save returns **503**.
2. Deploy `api/customLadder.php`, `api/bootstrap.php`, `api/index.php`, and
   `api/perfectPlatoon.php` with the app. No new secret. HQ and a school admin
   sign in with the existing admin login.

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
A leap year (5784, 5787, …) splits Adar into `Adar I` and `Adar II`. A plain
year (5785, …) has one `Adar`. The two leap-year months are separate keys in
month lists, mission history, and dedications, so they do not overwrite. Both
reuse the ladder sheet's single Adar quota. Marks stay on their own
Shabbos-Mevorchim julian day; no schema change is required.

## Caching the heavy aggregates

The report engine rebuilds the whole army (~9k soldiers) for `/stats`,
`/schools`, `/me/social` and the reports — ~60s each. Its built-in cache is
Redis-backed and Redis is not enabled on this host (`$global_redis_enabled` is
never set), so every request recomputed from scratch, and the SPA's 30s poll
kept re-triggering it.

`bootstrap.php` adds a small Redis-free file cache (`wwtcCached()`): the
expensive, deterministic-per-SM-date building blocks — `wwtcArmyAggregates()`,
`wwtcSchoolData()`, `wwtcCompletionCounts()`, and the `/running-totals`
response — are stored on disk and served **stale-while-revalidate**. A visitor
always gets an instant answer (a cached copy, at most TTL seconds stale); when a
copy is stale the slow rebuild runs in the background after the response is
flushed (`fastcgi_finish_request`), guarded by a per-key lock so concurrent
requests never stampede. Only the signed-in soldier's own figures
(`/me/progress`) stay uncached, so a kid's own marks always show immediately;
the nationwide/aggregate numbers may lag up to the TTL.

- Cache dir: `logs/wwtc-cache/` (outside the web root). Delete it to flush.
- TTL: `WWTC_CACHE_TTL` seconds (default 120, floor 10).
- Cold start (a brand-new SM month, or a flushed cache) still costs one ~60s
  rebuild for the first request of each key. `scripts/warm-cache.sh` pre-warms
  the public endpoints; run it from cron if that first hit matters, e.g.
  `*/5 * * * * WWTC_BASE_URL=https://mashpia.com/shabbos-mevorchim-tehillim/api /path/to/scripts/warm-cache.sh`.

## Monthly follow-up (WhatsApp, then SMS)

Once a month, every base commander gets a full-base report and every teacher
gets their own class. The job is `api/notify-wednesday.php`. It does not use a
teacher login, `/my-class`, or `/reports`.

### When it sends

The crontab fires every Wednesday at 08:00 America/New_York. The script exits
immediately unless that calendar day is the first Wednesday after the latest
Shabbos Mevorchim. Dates come from `wwtcMonthDatesForYear()` / `calculateSM()`,
the same list the reports use. A leap year (5784, 5787, …) keeps Adar I and
Adar II as two Shabbosim, so each has its own Wednesday. A plain year has one
Adar.

Both the crontab and the script use `America/New_York`, so 08:00 stays 08:00
local time when daylight saving starts or ends. Do not schedule this in UTC.

```cron
CRON_TZ=America/New_York
0 8 * * 3 cd /path/to/shabbos-mevorchim-tehillim && TZ=America/New_York php api/notify-wednesday.php >> /path/outside/web/wwtc-notify.log 2>&1
```

One successful send per recipient per campaign month is recorded in
`wwtc_notify_sends`. Running the script again the same day does not send a
second copy. `--force` runs on a day that is not that Wednesday (still
idempotent). `--only=123` limits the run to admin id 123. `--dry-run` prints
who would get what and does not send, write a PDF, or insert a log row.

```bash
php api/notify-wednesday.php --dry-run
php api/notify-wednesday.php --dry-run --only=123
php api/notify-wednesday.php --force --only=123
```

"Filled out" means a kapitlach mark greater than zero for that Shabbos
Mevorchim (the same participation signal as the reports). A mark of zero and a
missing mark both count as not submitted ("Who still needs to submit"). A mark
above zero that is still short of that soldier's quota is "Who still needs to
finish". The same rule is `wwtcNotifyKidStatus`: said <= 0 is submit, said >=
quota is done, otherwise finish. Quota totals in the PDF use each soldier's
own quota from `wwtcSchoolData()`.

### Who is texted, and which columns

Certain, already used by this API:

- Base commander: `admin_auths.auth = 'school'` and `admin_auths.id = school_id`.
- Teacher: `admin_auths.auth = 'class'` and `admin_auths.id = class_id`
  (`WWTC_CLASS_AUTH` in `api/platoonRoll.php`).
- `admin_auths` has no email and no phone. `role_id = 1` with `auth = 'user'`
  is a parent. Those rows are not recipients.
- Names: `admins.first`, `admins.last`.
- Class label: `classes.class_grade` and `classes.class_sub`.
  `classes.class_teacher` is the name printed on the platoon chip, not an
  account and not a phone.
- School: `schools.school_id`, `schools.school_name`, and the usual eligible-
  school roster (chayolei, not a test school).
- Soldier names in the PDF come from the report engine (`users.first`,
  `users.last` via `wwtcSchoolData()`). This job never messages a soldier and
  does not read a phone or email from `users`.

**GUESS for Naftoli.** These columns are not named anywhere else in this repo.
Confirm them on the live `admins` table before relying on the first real send.
The job prints the columns it actually found. It uses the first phone column
that exists and is non-empty, in this order:

1. `admins.admin_phone_mobile` (preferred: WhatsApp and SMS need a cell)
2. `admins.admin_phone_home`
3. `admins.admin_phone_work`
4. `admins.admin_email` is stored on the log row only. Nothing is emailed.

A school office number (`schools.school_phone` / `school_email`, if those
columns exist) is not used. Phones are normalized to E.164 with the US as the
default country. A number that cannot be normalized is skipped and logged as
`skipped_invalid_phone`.

`wwtc_notify_opt_outs.phone_e164` is the opt-out flag. Insert `+17185550100`
(the E.164 form) and that number is skipped. The SMS body ends with
`Reply STOP to opt out.` Twilio's own STOP handling is separate; when a STOP
arrives, add the number to this table too.

### The short message

Teacher, WhatsApp template body (four variables: filled, total, submit count, link).
`{{3}}` is only the kids who still need to submit (said <= 0). It is not the
kids who reported something and are still short. The approved wording still
says "but {{3}} didn't." A template wording change is needed before the
WhatsApp bubble itself can say both counts. The variable count stays four
either way — do not add a fifth variable. Until Meta approves new wording,
the sender keeps passing a number in `{{3}}` so the approved sentence stays
grammatical. Suggested replacement, still four variables, with `{{3}}` set to
the phrase `1 still needs to finish, 1 still needs to submit`:

```text
{{1}} out of {{2}} kids in your class filled out their Shabbos Mevorchim Tehillim. {{3}}. See the full report here: {{4}}. Please follow up with them today and see why they didn't.
```

What is sent today, against the already approved template:

```text
{{1}} out of {{2}} kids in your class filled out their Shabbos Mevorchim Tehillim, but {{3}} didn't. See the full report here: {{4}}. Please follow up with them today and see why they didn't.
```

Example of what WhatsApp shows until that wording is approved: `2 out of 3 kids in your class filled out their Shabbos Mevorchim Tehillim, but 1 didn't. See the full report here: https://mashpia.com/shabbos-mevorchim-tehillim/api/notify-report?t=…. Please follow up with them today and see why they didn't.`

Base commander, WhatsApp template body (the same four variables). The per-class
lines are not a fifth variable: a template cannot grow with the number of
classes, and the body cap is about 1024 characters. Those lines are in the PDF
and in the SMS. The class sentence stays on this template only, after the
report link, because the bubble itself does not list classes. SMS already
prints each class, so it does not repeat the sentence.

```text
{{1}} out of {{2}} kids in your base filled out their Shabbos Mevorchim Tehillim, but {{3}} didn't. See the full report here: {{4}}. Each class is in the attached report. Please follow up with them today and see why they didn't.
```

`{{4}}` is that recipient's signed PDF, the same file as the Document header.
It is not the page where a soldier enters Tehillim. Sample values for Meta:
`25`, `30`, `5`, and an `https://` URL on your domain.

SMS is free text, so it already uses both counts. Nothing is emailed;
`admins.admin_email` is stored on the log row only. The fill-out URL is the
public soldier sign-in page, `{WWTC_PUBLIC_BASE}/login`. There is no per-class
public fill-out page.
Teacher:

```text
2 out of 3 kids in your class filled out their Shabbos Mevorchim Tehillim. 1 still needs to finish, 1 still needs to submit.
Class: 5-B
1 still needs to finish, 1 still needs to submit
See the full report here: https://mashpia.com/shabbos-mevorchim-tehillim/api/notify-report?t=…
Link to fill it out: https://mashpia.com/shabbos-mevorchim-tehillim/login
Please follow up with them today and see why they didn't.
Reply STOP to opt out.
```

Base commander (a class where everyone finished is left off the incomplete lines):

```text
4 out of 5 kids in your base filled out their Shabbos Mevorchim Tehillim. 1 still needs to finish, 1 still needs to submit.
Class: 5-B
1 still needs to finish, 1 still needs to submit
Class 5-B: 2 of 3
Class 6-A: 2 of 2
See the full report here: https://mashpia.com/shabbos-mevorchim-tehillim/api/notify-report?t=…
Link to fill it out: https://mashpia.com/shabbos-mevorchim-tehillim/login
Please follow up with them today and see why they didn't.
Reply STOP to opt out.
```

Soldier names are not in either body. They are only in that recipient's PDF:
a teacher sees their class, a base commander sees every class in their base.
The PDF groups soldiers into "Did full quota", then "Who still needs to
finish", then "Who still needs to submit". Each incomplete class is labeled
`Class: {name}` on its own line, with `N still need to finish` or `N still
need to submit` before the names. A child who reported something short of
quota also gets `X of Y kapitlach`. Totals at the top use the same two
phrases. The by-class participation lines stay `Class X: filled of total`.
The site has no public deep link to one soldier (only `/me` after a
serial-number sign-in, or a two-minute parent handoff). Each soldier who
still needs to submit is given the public sign-in URL
`{WWTC_PUBLIC_BASE}/login`. That is not a teacher login and it is not
`/reports`. The same two sections, in that order, are what the admin
dashboard shows under "Not done yet".

### The PDF

The file is written outside the web root (`WWTC_NOTIFY_DIR`, or
`MASHPIA_LOG_DIR/wwtc-notify`, otherwise the system temp directory). Set
`WWTC_NOTIFY_DIR` to a directory that both the cron user and the web PHP user
can read, and that is not under the site document root. The public URL is
`GET /api/notify-report?t=<hmac>`. The token expires after
`WWTC_NOTIFY_LINK_DAYS` (default 30, max 180). A bad or expired token is a 404
with no names. WhatsApp sends the same URL as a DOCUMENT header on the
template and again as `{{4}}`. SMS has no attachment, so the same URL is the
link in the text.

A row left at outcome `pending` means a run stopped mid-send. Delete that row
before a rerun if you know the message did not go out. Outcome `sent` is final
for that recipient and campaign month.

### WhatsApp: Sholem's Business app number

Use Sholem's existing WhatsApp Business app number through Meta coexistence,
onboarded by a Solution Partner / Tech Provider. A brand-new WhatsApp Business
number on the Cloud API also works. Do not use a personal WhatsApp account.

This job has two senders, chosen with `WHATSAPP_PROVIDER`:

- `meta` (default): WhatsApp Cloud API. `POST https://graph.facebook.com/{version}/{WHATSAPP_PHONE_NUMBER_ID}/messages` with `Authorization: Bearer WHATSAPP_TOKEN`.
- `360dialog`: `POST https://waba-v2.360dialog.io/messages` with header `D360-API-KEY`. Telnyx or YCloud can be used with the `meta` adapter when they give you Cloud API credentials. Only 360dialog has its own adapter here.

Coexistence limits and onboarding:

1. The number must already be on the WhatsApp Business app (the green business app), version **2.24.17 or newer**. Check the app version before starting. A personal WhatsApp app cannot be connected this way.
2. In the partner hub (360dialog, or Telnyx / YCloud if you use the Cloud API adapter), start Embedded Signup and choose the existing WhatsApp Business app number (coexistence), not only a fresh API-only number.
3. On the phone, open the WhatsApp Business app and scan the QR code the partner shows. Finish until the number shows as connected. The Business app keeps working, and the Cloud API is turned on for the same number.
4. Create two **Utility** templates, language `en`, each with a **Document** header (the PDF is supplied at send time, not stored in the template) and the body text above. Names: `wwtc_class_followup` and `wwtc_base_followup`, or whatever you set in the env vars. Wait until Meta approves them. A template error does not fall back to SMS, so a rejected template will not text the whole army.
5. Coexistence throughput is **20 messages per second**. The sender defaults to 10 and will not go above 19 (`WHATSAPP_MAX_PER_SECOND`).
6. If WhatsApp is not configured, or the Cloud API returns error **131026** (message undeliverable because that number is not on WhatsApp; the older on-premises code **1013** is treated the same), the job sends the SMS instead. Any other WhatsApp error is logged as `failed` and is not turned into a text.

### Env vars

Put these in the PHP environment (or `mashpia.com/includes/globals.php` via
`putenv`). No secrets belong in git.

```bash
WHATSAPP_PROVIDER=meta          # or 360dialog
WHATSAPP_TOKEN=                 # Cloud API bearer token
WHATSAPP_PHONE_NUMBER_ID=       # Cloud API only
WHATSAPP_360_API_KEY=           # 360dialog only (falls back to WHATSAPP_TOKEN)
WHATSAPP_TEMPLATE_CLASS=wwtc_class_followup
WHATSAPP_TEMPLATE_BASE=wwtc_base_followup
WHATSAPP_TEMPLATE_LANG=en
WHATSAPP_GRAPH_VERSION=v21.0
WHATSAPP_MAX_PER_SECOND=10
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=                    # Twilio number, E.164. TWILIO_SID and TWILIO_TOKEN are accepted aliases.
WWTC_NOTIFY_SIGNING_SECRET=     # falls back to WWTC_TOKEN_SECRET
WWTC_NOTIFY_DIR=                # outside the web root, shared by cron and Apache
WWTC_NOTIFY_LINK_DAYS=30
WWTC_PUBLIC_BASE=https://mashpia.com/shabbos-mevorchim-tehillim
```

### What Naftoli does on mashpia.com

1. Run `api/sql/wwtc_notify.sql` once. The job will not send until
   `wwtc_notify_sends` and `wwtc_notify_opt_outs` exist.
2. Confirm the `admins` phone and email columns above. If the live names
   differ, say so before the first Wednesday: the job only selects
   `admin_phone_mobile`, `admin_phone_home`, `admin_phone_work`, and
   `admin_email`.
3. Connect Sholem's WhatsApp Business app number (2.24.17+) through the
   partner, or register a new Business number. Submit the two Document
   templates and wait for approval.
4. Open the SMS account (Twilio by default) and set the env vars. Leave the
   WhatsApp vars empty to send only SMS until the templates are approved.
5. Set `WWTC_NOTIFY_SIGNING_SECRET` and `WWTC_NOTIFY_DIR`.
6. Dry-run, then install the crontab above.
7. Deploy `api/notify.php`, `api/notify-wednesday.php`, and the `api/index.php`
   route that serves `GET /api/notify-report`. Meta's servers must be able to
   fetch that URL when the document header is sent.
