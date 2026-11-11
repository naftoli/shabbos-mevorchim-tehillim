# Perfect Platoon graphics

A Perfect Platoon is a class where every soldier finished their Tehillim quota
this month. This folder is the daily job that draws one 1080×1080 PNG per new
platoon, the ledger of graphics already made, and the notes for replacing the
placeholder picture with Sholem's renderer.

Student names are not read and not stored. School WhatsApp numbers live in
`wwtc_school_contacts` and are returned only by the staff office routes.

## What Naftoli runs on the server

Do this once, by hand. The app does not run the SQL.

1. On the mashpia database, run `api/sql/wwtc_platoon_graphics.sql`.
2. Create a directory outside the web root and point PHP at it:

   ```
   WWTC_PLATOON_GRAPHICS_DIR=/var/lib/wwtc/platoon-graphics
   ```

   If that variable is unset, files go to `MASHPIA_LOG_DIR/wwtc-platoon-graphics`
   when that constant exists, otherwise `var/platoon-graphics` inside this app.
3. Put each month's background where `backgrounds.php` points (see
   `backgrounds/README.md`). Adar, Adar I, and Adar II are three files. The job
   exits with an error that names the missing file rather than drawing without it.
4. Cron, after morning marks. Replace the path:

   ```
   15 6 * * * php /ABSOLUTE/PATH/shabbos-mevorchim-tehillim/api/bin/make-platoon-graphics.php >> /var/log/wwtc-platoon-graphics.log 2>&1
   ```

5. Import the existing ledger of already-made graphics (about 45) **before**
   the first cron run, or those classes will be drawn again:

   ```
   php api/bin/import-platoon-graphics-ledger.php --file=/path/to/ledger.csv --dry-run
   php api/bin/import-platoon-graphics-ledger.php --file=/path/to/ledger.csv
   ```

   JSON works the same way (`--file=ledger.json`).

Optional: `WWTC_SCHOOL_LOGOS_DIR` if the school shields are not under the web
root at `/schoolLogos/`. `WWTC_PUBLIC_BASE` is not required; the office builds
the public link from the site the staff member is using.

## Daily job

`php api/bin/make-platoon-graphics.php` reads this month's perfect platoons
with `wwtcPerfectPlatoonRows()`, the same mission-mark query as
`GET /perfect-platoons`. It does not open a browser.

A class already in the ledger for that month and year is skipped. A second run
the same day prints `0 new` and draws nothing.

```
php api/bin/make-platoon-graphics.php --month="Adar I" --year=5787
php api/bin/make-platoon-graphics.php --dry-run
php api/bin/make-platoon-graphics.php --rerender
```

`--rerender` draws the files again and keeps sent / not-sent marks. Use it
when the real renderer replaces the placeholder. `--month` accepts `Adar I`,
`Adar II`, `Adar 1`, and `Adar 2`. A non-leap year has `Adar` only; asking for
Adar I then fails with a calendar message instead of guessing.

## Ledger import

The exact spreadsheet is not fixed yet. The reader takes CSV or JSON, skips
blank lines and `#` comments, and accepts several header names. A header row
is best. Without one, columns are read in this order: school id, school name,
class, grade, month, year, file path.

| Meaning | Accepted headers |
| --- | --- |
| School id | `school_id`, `school id`, `schoolId` |
| School name | `school`, `school_name`, `school name` |
| Class | `class`, `class_name`, `platoon` |
| Grade | `grade`, `kitah`, `kita` |
| Month | `month`, `month_name`, `hebrew month` |
| Year | `year`, `campaign_year` (Hebrew year, e.g. 5786) |
| File | `file`, `file_path`, `path`, `graphic` |
| When it was made | `made_at`, `made`, `created` |

JSON may be a list, or `{ "ledger": [ ... ] }` / `graphics` / `rows` / `platoons`.

Grades accept `1`, `Grade 1`, `1st`, `Kitah Alef`, `Alef`, and the same for
Beis, Gimmel, Daled, Hei, Vov, Zayin, Ches. `Kitah Hei-B` and `5-B` are the
same class, so an import and a later cron run do not both draw it. `Adar 1`
is stored as `Adar I` and `Adar 2` as `Adar II`. A missing file path is still
recorded, with a warning, so the job will not make that graphic again. A
school name is matched to the Tehillim roster when the id is missing. A row
that cannot be read is reported and skipped; the rest are imported.

Example:

```csv
school_name,class,grade,month,year,file_path
Cheder Menachem (Sample),1-A,1,Cheshvan,5786,/tmp/existing.png
Bais Chaya Mushka (Sample),Kitah Hei,Hei,Adar 1,5787,
```

## Renderer

`wwtcRenderPlatoonGraphic($job)` writes one 1080×1080 PNG. `$job` has
`schoolName`, `classLabel`, `logoPath` (or empty), `month`, `year`,
`backgroundPath`, and `outPath`. `classLabel` is `Kitah Alef` or
`Kitah Alef-A` for grades 1–8. Other grades keep the class name.

Until `WWTC_PLATOON_RENDER_CMD` is set, the function is a **placeholder**. It
paints the month background and stamps `PLACEHOLDER` and `NOT THE FINAL ART`.
It is not a poster design.

When Sholem's `platoon_render.py` is on the server:

```
WWTC_PLATOON_RENDER_CMD="python3 /ABSOLUTE/PATH/platoon_render.py"
```

The command receives one argument, a JSON file:

```json
{
  "schoolName": "Cheder Menachem",
  "classLabel": "Kitah Alef-A",
  "logoPath": "/schoolLogos/cheder.png",
  "month": "Cheshvan",
  "year": 5786,
  "backgroundPath": "/path/to/cheshvan.png",
  "outPath": "/var/lib/wwtc/platoon-graphics/5786-cheshvan-61-1-a.png",
  "width": 1080,
  "height": 1080
}
```

Exit 0 only after `outPath` is a 1080×1080 PNG. Then run
`php api/bin/make-platoon-graphics.php --rerender` for the current month so
the placeholder files are replaced. Sent marks stay.

## Pages

- Public: `/platoon-graphics` and `/platoon-graphics/:schoolId`. A school
  searches for itself, then downloads or shares (Web Share, or a download if
  the browser has no share sheet). No phone numbers.
- Office: `/office/platoon-graphics`, HQ or a school admin (the same
  `POST /admin/login` token). Tabs are To send, Sent, and All. "WhatsApp
  school" opens `wa.me` with the public link and marks that school's unsent
  graphics sent. Each graphic can be marked sent or not sent. A new platoon
  for a school that was already sent shows as NEW. School admins only see
  their own school. Numbers are edited on this page and stored in
  `wwtc_school_contacts`.
