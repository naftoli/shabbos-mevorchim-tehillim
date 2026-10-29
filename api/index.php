<?php

declare(strict_types=1);

/**
 * Worldwide Tehillim Club API — router.
 *
 * Campaign numbers come from class.shabbosMevorchim.php (the same class the WWTC
 * report pages use), so this returns what those reports show. Reads cover the
 * whole SPA; writes (POST /me/report, PUT /me/ladder) are scoped by the bearer
 * token to the signed-in soldier and mirror mark_tehillim2.php (see marking.php).
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/marking.php';
require __DIR__ . '/schoolLogo.php';

function wwtcRoutePath(): string
{
    $uri = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    // Strip the mount prefix, however the app is hosted.
    $uri = preg_replace('#^.*/api#', '', $uri, 1);
    $uri = '/' . ltrim((string) $uri, '/');
    return rtrim($uri, '/') ?: '/';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = wwtcRoutePath();

/** round(done/quota*100), uncapped (can exceed 100); 0 when there is no quota. */
function wwtcPct($done, $quota): int
{
    $quota = (float) $quota;
    if ($quota <= 0) {
        return 0;
    }
    return (int) round(((float) $done / $quota) * 100);
}

/**
 * One eligible school's aggregate row for a month, from the army arrays (setASR
 * with live marks — WWTC always uses setUseLiveData) and the mission-mark
 * completion counts. The single source for a school's headline numbers, used by
 * both /schools (the list) and /schools/:id (the detail), so the two never disagree.
 */
function wwtcSchoolRow(int $id, string $name, array $kapGoal, array $kapDone, array $minGoal, array $minDone, array $counts): array
{
    $said = (int) ($kapDone[$id] ?? 0);
    $q = (int) ($kapGoal[$id] ?? 0);
    $minSaid = (int) ($minDone[$id] ?? 0);
    $minQ = (int) ($minGoal[$id] ?? 0);
    $kids = (int) ($counts['sizeBySchool'][$id] ?? 0);
    $met = (int) ($counts['metBySchool'][$id] ?? 0);
    return [
        'id' => $id,
        'name' => $name,
        'city' => null,  // Mashpia has no school city; the SPA hides it when null
        'color' => null, // SchoolLogo falls back to initials + a default colour
        // Uploaded school logo (same URL Lulav sends). Null keeps the initials tile.
        'logo' => wwtcSchoolLogos()[$id] ?? null,
        'kids' => $kids,
        'saidMonth' => $said,
        'quotaMonth' => $q,
        'pct' => wwtcPct($said, $q),
        'metMonth' => $met,
        'pctMet' => $kids > 0 ? (int) round($met / $kids * 100) : 0,
        'minutesSaidMonth' => $minSaid,
        'minutesQuotaMonth' => $minQ,
        'minutesPct' => wwtcPct($minSaid, $minQ),
    ];
}

/**
 * Home "The Race" default order: % soldiers who met, then % kapitlach, % minutes,
 * raw kapitlach, name. Personal-page schoolRank must use this same order.
 */
function wwtcCmpSchoolRace(array $a, array $b): int
{
    return $b['pctMet'] <=> $a['pctMet']
        ?: $b['pct'] <=> $a['pct']
        ?: $b['minutesPct'] <=> $a['minutesPct']
        ?: $b['saidMonth'] <=> $a['saidMonth']
        ?: strcmp($a['name'], $b['name']);
}

/**
 * [school_id => logo URL|null] for the WWTC roster. One query, cached for the
 * request: /schools, /schools/:id and the army report all read it.
 */
function wwtcSchoolLogos(): array
{
    global $MASHPIA_DB;
    static $logos;
    if ($logos !== null) {
        return $logos;
    }
    $ids = array_map('intval', array_keys(wwtcEligibleSchools()));
    $logos = [];
    if (!$ids) {
        return $logos;
    }
    $in = implode(',', $ids);
    $rows = $MASHPIA_DB->query(
        "SELECT school_id, logo, school_logo_id, school_logo_kiosk_id
           FROM schools
          WHERE school_id IN ($in)"
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        $logos[(int) $row['school_id']] = wwtcSchoolLogoUrl(
            $row['logo'] ?? '',
            $row['school_logo_id'] ?? 0,
            $row['school_logo_kiosk_id'] ?? 0
        );
    }
    return $logos;
}

/** Nationwide school rows for the current (or given) SM date, Race-sorted. */
function wwtcNationwideSchools(?int $date = null): array
{
    $date = $date ?? wwtcCurrentDate();
    $agg = wwtcArmyAggregates($date);
    $names = $agg['schools'];
    $counts = wwtcCompletionCounts($date);

    $rows = [];
    foreach ($names as $id => $name) {
        $rows[] = wwtcSchoolRow(
            (int) $id,
            (string) $name,
            $agg['kapGoal'],
            $agg['kapDone'],
            $agg['minGoal'],
            $agg['minDone'],
            $counts
        );
    }
    usort($rows, 'wwtcCmpSchoolRace');
    return $rows;
}

/**
 * One school's current-month picture, following shabbos_mevorchim_by_class2.php:
 * setSchoolResults() + setClassResults() + setStudentResults(). Per-class goal/
 * done come from classResults/classDoneResults (what generateSummary renders);
 * the per-soldier rows come from studentResults/studentDoneResults (what
 * generateStudentReport renders). Returns ['classes' => [...], 'students' => [...]]
 * for the current Shabbos Mevorchim, Kapitelach. "met"/"perfect" (every soldier
 * met their own quota) are derived from the per-soldier rows — the class reports
 * do not compute them, but the SPA shows them.
 */
function wwtcSchoolData(int $schoolId, ?int $date = null): array
{
    $date = $date ?? wwtcCurrentDate();
    return wwtcCached("school_data.$schoolId.$date", static function () use ($schoolId, $date) {
    $report = wwtcReport($date);
    $report->setSchool($schoolId);
    $report->setSchoolResults($schoolId);
    $report->setClassResults();
    $report->setStudentResults($schoolId, $date);

    $meta = (array) $report->getClasses();                 // [class_id => ['grade','teacher']]
    $classQuota = $report->getClassResults()['Kapitelach'][$date] ?? [];      // [class_id => goal]
    $classDone = $report->getClassDoneResults()['Kapitelach'][$date] ?? [];   // [class_id => done]
    $quotaRows = (array) $report->getStudentResults();     // [date][class][uid][key] = quota
    $doneRows = (array) $report->getStudentDoneResults();  // [date][class][uid][key] = done
    $names = (array) $report->getUsers();                  // [uid => "First Last"]

    // Per-soldier rows + per-class size/met counts (student level). Minutes are
    // summed here too (setStudentResults populates the 'Minutes' key alongside
    // 'Kapitelach' unless forScreen is set, which it is not), so the school's
    // minute totals come from the same rows as its kapitlach totals.
    $students = [];
    $sizeBy = [];
    $metBy = [];
    $minQuotaBy = [];
    $minDoneBy = [];
    $minQuota = 0;
    $minDone = 0;
    foreach (($quotaRows[$date] ?? []) as $classId => $usersByKey) {
        $m = $meta[$classId] ?? ['grade' => '', 'teacher' => ''];
        foreach ($usersByKey as $uid => $byKey) {
            $q = (int) ($byKey['Kapitelach'] ?? 0);
            $d = (int) ($doneRows[$date][$classId][$uid]['Kapitelach'] ?? 0);
            $isMet = $q > 0 && $d >= $q;
            $mq = (int) ($byKey['Minutes'] ?? 0);
            $md = (int) ($doneRows[$date][$classId][$uid]['Minutes'] ?? 0);
            $minQuota += $mq;
            $minDone += $md;
            $minQuotaBy[$classId] = ($minQuotaBy[$classId] ?? 0) + $mq;
            $minDoneBy[$classId] = ($minDoneBy[$classId] ?? 0) + $md;
            $sizeBy[$classId] = ($sizeBy[$classId] ?? 0) + 1;
            $metBy[$classId] = ($metBy[$classId] ?? 0) + ($isMet ? 1 : 0);
            $students[] = [
                'id' => (int) $uid,
                'name' => (string) ($names[$uid] ?? ''),
                'classId' => (int) $classId,
                'className' => (string) $m['grade'],
                'quota' => $q,
                'said' => $d,
                'met' => $isMet,
            ];
        }
    }

    // Per-class rows: goal/done from the class aggregate (generateSummary).
    $classes = [];
    foreach ($meta as $classId => $m) {
        $quota = (int) ($classQuota[$classId] ?? 0);
        $said = (int) ($classDone[$classId] ?? 0);
        $size = (int) ($sizeBy[$classId] ?? 0);
        $met = (int) ($metBy[$classId] ?? 0);
        $minQ = (int) ($minQuotaBy[$classId] ?? 0);
        $minD = (int) ($minDoneBy[$classId] ?? 0);
        $classes[] = [
            'id' => (int) $classId,
            'name' => (string) $m['grade'],
            'teacher' => (string) $m['teacher'],
            'grade' => (string) $m['grade'],
            'size' => $size,
            'said' => $said,
            'quota' => $quota,
            'pct' => wwtcPct($said, $quota),
            'met' => $met,
            'pctMet' => $size > 0 ? (int) round($met / $size * 100) : 0,
            'minutesSaid' => $minD,
            'minutesQuota' => $minQ,
            'minutesPct' => wwtcPct($minD, $minQ),
            'perfect' => $size > 0 && $met === $size,
        ];
    }
    return [
        'classes' => $classes,
        'students' => $students,
        'minutes' => $minDone,
        'minutesQuota' => $minQuota,
    ];
    });
}

/**
 * A soldier's elapsed-month progress (quota/said/minutes per month, met), by
 * direct per-month queries mirroring ShabbosMevorchim::setStudentResults(): the
 * quota is the soldier's own date_tasks row for their track/level, the done is
 * MAX(done_qty) from live date_tasks_marks (no tehillim_backups — same as
 * setUseLiveData on the report class).
 */
function wwtcKidMonths(array $kid): array
{
    global $MASHPIA_DB;
    $kapitel = WWTC_GRID_KAPITELACH;
    $minutes = WWTC_GRID_MINUTES;

    $quotaStmt = $MASHPIA_DB->prepare(
        'SELECT dt.quantity FROM date_tasks dt
          WHERE dt.grid_id = :grid AND dt.date_tasks_mission_id IN (
                SELECT date_tasks_mission_id FROM date_tasks_missions
                 WHERE subject_id = ' . WWTC_SUBJECT_ID . '
                   AND start_date = :d AND end_date = :d AND school_type_id = :st
                   AND track_id = :track AND level = :lvl AND lang_id = :lang)
          LIMIT 1'
    );
    $doneStmt = $MASHPIA_DB->prepare(
        'SELECT MAX(dtm.done_qty) FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
          WHERE dtm.user_id = :uid AND dtmm.start_date = :d AND dtmm.end_date = :d
            AND dt.grid_id = :grid AND dtmm.subject_id = ' . WWTC_SUBJECT_ID
    );

    $qFor = function (int $grid, int $d) use ($quotaStmt, $kid): int {
        $quotaStmt->execute([
            ':grid' => $grid, ':d' => $d, ':st' => (int) $kid['school_type_id'],
            ':track' => (int) $kid['track_id'], ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
        ]);
        return (int) ($quotaStmt->fetchColumn() ?: 0);
    };
    $dFor = function (int $grid, int $d) use ($doneStmt, $kid): int {
        $doneStmt->execute([':uid' => (int) $kid['user_id'], ':d' => $d, ':grid' => $grid]);
        return (int) ($doneStmt->fetchColumn() ?: 0);
    };

    $current = wwtcCurrentDate();
    $months = [];
    foreach (wwtcElapsedMonths() as $m) {
        $d = (int) $m['jd'];
        $q = $qFor($kapitel, $d);
        $said = $dFor($kapitel, $d);
        $months[] = [
            'month' => $m['month'],
            'quota' => $q,
            'said' => $said,
            'minutes' => $qFor($minutes, $d),       // the target minutes for the month
            'saidMinutes' => $dFor($minutes, $d),   // minutes the soldier reported
            'met' => $q > 0 && $said >= $q,
            'isCurrent' => $d === $current,
        ];
    }
    return $months;
}

/**
 * Lifetime Tehillim missions earned (medal board / training count), from the
 * first mark the child has — not just this campaign year. Same source as
 * Soldier::medalBoard(): SUM(mission_count) on date_tasks_mission_marks.
 */
function wwtcKidMissionsLifetime(int $userId): int
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        'SELECT IFNULL(SUM(mission_count), 0) FROM date_tasks_mission_marks
          WHERE user_id = :uid AND subject_id = ' . WWTC_SUBJECT_ID
    );
    $stmt->execute([':uid' => $userId]);
    return (int) $stmt->fetchColumn();
}

/**
 * The signed-in soldier's progress payload (GET /me/progress, and the fresh
 * state POST /me/report returns). medal stays null — medal logic is client-side.
 */
function wwtcKidProgress(array $kid): array
{
    $months = wwtcKidMonths($kid);
    $metThisYear = 0;
    $current = null;
    foreach ($months as $mo) {
        $metThisYear += $mo['met'] ? 1 : 0;
        if ($mo['isCurrent']) {
            $current = $mo;
        }
    }
    $missionsTotal = wwtcKidMissionsLifetime((int) $kid['user_id']);
    // Prefer lifetime − this-year SM months; never go negative if marks include
    // RH/YK or other occasions beyond the elapsed-month list.
    $priorMissions = max(0, $missionsTotal - $metThisYear);
    return array_merge(wwtcSafeKid($kid), [
        'months' => $months,
        'metThisYear' => $metThisYear,
        'missionsTotal' => $missionsTotal,
        'priorMissions' => $priorMissions,
        'medal' => null,
        'current' => $current,
    ]);
}


// ---- authentication --------------------------------------------------------

if ($method === 'POST' && $path === '/soldier/login') {
    $input = wwtcInput();
    $serial = trim((string) ($input['serial'] ?? $input['id'] ?? ''));
    $dob = trim((string) ($input['dob'] ?? ''));
    if (!preg_match('/^\d+$/', $serial) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
        wwtcError('Enter a serial number and date of birth.', 422);
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT user_id FROM users WHERE user_serial = :serial AND dob = :dob AND user_registered > 0 LIMIT 1'
    );
    $stmt->execute([':serial' => $serial, ':dob' => $dob]);
    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        wwtcError('No soldier matches that serial number and date of birth.', 401);
    }
    $kid = wwtcKidBySerial($serial);
    if (!$kid) {
        wwtcError('No soldier matches that serial number and date of birth.', 401);
    }
    $token = wwtcIssueToken('kid', (int) $kid['user_id'], ['serial' => (string) $kid['user_serial']]);
    wwtcJson([
        'token' => $token,
        'expiresIn' => (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200),
        'soldier' => wwtcSafeKid($kid),
    ]);
}

if ($method === 'POST' && $path === '/admin/login') {
    $input = wwtcInput();
    $username = trim((string) ($input['username'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    if (!$username || !$password) {
        wwtcError('Username and password are required.', 422);
    }
    $login = \mashpia\api\auth\Auth::login($username, $password);
    if (!$login) {
        wwtcError('That username or password is not correct.', 401);
    }
    // Auth::login returns the admin's session keys; adapt to the SPA's admin shape.
    $adminId = (int) ($login['admin_id'] ?? $login['id'] ?? 0);
    $stmt = $MASHPIA_DB->prepare('SELECT admin_id, auth, first, last, username FROM admins WHERE admin_id = :id LIMIT 1');
    $stmt->execute([':id' => $adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    // A school admin's school isn't a column on `admins` — it's an admin_auths row
    // of type 'school' (the mapping Admin::getAuthIds('school') reads). Take the
    // first, matching the SPA's single-school admin shape; HQ ('super') has none.
    $schoolStmt = $MASHPIA_DB->prepare(
        "SELECT id FROM admin_auths WHERE admin_id = :id AND auth = 'school' ORDER BY id LIMIT 1"
    );
    $schoolStmt->execute([':id' => $adminId]);
    $schoolId = $schoolStmt->fetchColumn();
    $token = wwtcIssueToken('admin', $adminId, ['auth' => $admin['auth'] ?? '']);
    wwtcJson([
        'token' => $token,
        'expiresIn' => (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200),
        'admin' => [
            'kind' => ($admin['auth'] ?? '') === 'super' ? 'super' : 'school',
            'name' => trim(($admin['first'] ?? '') . ' ' . ($admin['last'] ?? '')),
            'username' => $admin['username'] ?? $username,
            'schoolId' => $schoolId !== false ? (int) $schoolId : null,
        ],
    ]);
}

// ---- campaign calendar -----------------------------------------------------

if ($method === 'GET' && $path === '/campaign') {
    $current = wwtcCurrentDate();
    $elapsed = wwtcElapsedMonths();
    wwtcJson([
        'year' => wwtcYear(),
        'currentMonth' => wwtcMonthForDate($current),
        'currentMonthIndex' => max(0, count($elapsed) - 1),
        'months' => array_column($elapsed, 'month'),
        'monthDates' => wwtcMonthDates(),
    ]);
}

// ---- nationwide stats ------------------------------------------------------

if ($method === 'GET' && $path === '/stats') {
    $current = wwtcCurrentDate();
    $agg = wwtcArmyAggregates($current);
    $quota = (int) ($agg['army']['Kapitelach'][$current] ?? 0);
    $done = (int) ($agg['armyDone']['Kapitelach'][$current] ?? 0);

    // Minutes: the army result covers Kapitelach only, so the Minutes totals come
    // from the per-school figures (setASR) — the same the summary's Minutes chart uses.
    $minutesQuota = (int) array_sum($agg['minGoal']);
    $minutes = (int) array_sum($agg['minDone']);

    // Counts, with the same roster filters the army query uses.
    $soldiers = (int) $MASHPIA_DB->query(
        'SELECT COUNT(DISTINCT u.user_id)
           FROM users u
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s USING (school_id)
           JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
          WHERE u.user_registered > 0 AND ' . WWTC_ROSTER_WHERE
    )->fetchColumn();
    $schools = count($agg['schools']); // setASR()'s school roster
    $classes = (int) $MASHPIA_DB->query(
        'SELECT COUNT(DISTINCT c.class_id)
           FROM classes c
           JOIN users u ON u.class_id = c.class_id AND u.school_id = c.school_id AND u.user_registered > 0
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s ON s.school_id = c.school_id
          WHERE ' . WWTC_ROSTER_WHERE
    )->fetchColumn();

    // Soldiers who completed + perfect platoons, from the mission-mark signal.
    $counts = wwtcCompletionCounts($current);
    $metSoldiers = (int) array_sum($counts['metBySchool']);
    $perfectPlatoons = 0;
    foreach ($counts['sizeByClass'] as $sid => $classesBySize) {
        foreach ($classesBySize as $cid => $size) {
            if ($size > 0 && ($counts['metByClass'][$sid][$cid] ?? 0) >= $size) {
                $perfectPlatoons++;
            }
        }
    }

    wwtcJson([
        'monthLabel' => wwtcMonthForDate($current),
        'year' => wwtcYear(),
        'accomplished' => $done,
        'quota' => $quota,
        'pct' => wwtcPct($done, $quota),
        'minutes' => $minutes,
        'minutesQuota' => $minutesQuota,
        'minutesPct' => wwtcPct($minutes, $minutesQuota),
        'soldiers' => $soldiers,
        'metSoldiers' => $metSoldiers,
        'pctSoldiersMet' => $soldiers > 0 ? (int) round($metSoldiers / $soldiers * 100) : 0,
        'schools' => $schools,
        'classes' => $classes,
        'perfectPlatoons' => $perfectPlatoons,
    ]);
}

// ---- running totals (home headline) ----------------------------------------
// This month / this year: live army done across elapsed SM months (setUseLiveData).
// All-time: sealed kapitlach from tehillim_backups for every prior SM date, plus
// this year's live total (so post-backup marks still count), plus optional
// WWTC_ALLTIME_BASE for any pre-backup history HQ wants to include.
if ($method === 'GET' && $path === '/running-totals') {
    $current = wwtcCurrentDate();
    wwtcJson(wwtcCached("running_totals.$current", static function () use ($current) {
    global $MASHPIA_DB;
    $thisMonth = 0;
    $thisYear = 0;
    $elapsedJds = [];
    foreach (wwtcElapsedMonths() as $mo) {
        $jd = (int) $mo['jd'];
        $elapsedJds[] = $jd;
        $r = wwtcReport($jd);
        $r->setArmyResults();
        $v = (int) ($r->getArmyDoneResults()['Kapitelach'][$jd] ?? 0);
        $thisYear += $v;
        if ($jd === $current) {
            $thisMonth = $v;
        }
    }

    // Prior years (and any sealed months outside this year's elapsed set).
    $priorSql = 'SELECT IFNULL(SUM(done_qty), 0) FROM tehillim_backups
                  WHERE grid_id = ' . WWTC_GRID_KAPITELACH;
    if ($elapsedJds) {
        $in = implode(',', array_map('intval', $elapsedJds));
        $priorSql .= " AND sm_date NOT IN ($in)";
    }
    $priorYears = (int) $MASHPIA_DB->query($priorSql)->fetchColumn();
    $base = (int) (wwtcEnv('WWTC_ALLTIME_BASE') ?: 0);
    $allTime = $priorYears + $thisYear + $base;

    return [
        'thisMonth' => $thisMonth,
        'thisYear' => $thisYear,
        'allTime' => $allTime,
    ];
    }));
}

// ---- nationwide school list ------------------------------------------------

if ($method === 'GET' && $path === '/schools') {
    $current = wwtcCurrentDate();
    // Same Race order as Home (pctMet-first) and /me/social schoolRank.
    $rows = wwtcNationwideSchools($current);
    wwtcJson(['month' => wwtcMonthForDate($current), 'schools' => $rows]);
}

// ---- one school -------------------------------------------------------------

if ($method === 'GET' && preg_match('#^/schools/(\d+)$#', $path, $m)) {
    $id = (int) $m[1];
    $names = wwtcEligibleSchools();
    if (!isset($names[$id])) {
        wwtcError('School not found.', 404);
    }
    // Header totals from the same source as the /schools list (so they match);
    // the class breakdown from the per-student report.
    $current = wwtcCurrentDate();
    $agg = wwtcArmyAggregates($current);
    $row = wwtcSchoolRow(
        $id,
        (string) $names[$id],
        $agg['kapGoal'],
        $agg['kapDone'],
        $agg['minGoal'],
        $agg['minDone'],
        wwtcCompletionCounts($current)
    );
    $data = wwtcSchoolData($id);
    wwtcJson($row + [
        'classes' => $data['classes'],
        'dedication' => null, // static/hidden in live mode for now
    ]);
}

if ($method === 'GET' && preg_match('#^/schools/(\d+)/class-leaderboard$#', $path, $m)) {
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    $classes = wwtcSchoolData($id)['classes'];
    usort($classes, static function ($a, $b) {
        return $b['pct'] <=> $a['pct'] ?: $b['said'] <=> $a['said'];
    });
    wwtcJson(['schoolId' => $id, 'classes' => $classes]);
}

if ($method === 'GET' && preg_match('#^/schools/(\d+)/leaderboard$#', $path, $m)) {
    // Public: the SPA shows a school's Top Soldiers with full names (signed off).
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    $limit = max(1, min(50, (int) ($_GET['n'] ?? 10)));
    $dates = array_map(static function ($x) { return (int) $x['jd']; }, wwtcElapsedMonths());
    $in = implode(',', array_map('intval', $dates)) ?: '0';
    // Per-month MAX(done), summed across elapsed months — the year total.
    $stmt = $MASHPIA_DB->prepare(
        'SELECT t.user_id, u.first, u.last, c.class_grade, SUM(t.m) said
           FROM (
                SELECT dtm.user_id, dtmm.start_date, MAX(dtm.done_qty) m
                  FROM date_tasks_marks dtm
                  JOIN date_tasks dt USING (date_task_id)
                  JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
                  JOIN users u2 ON u2.user_id = dtm.user_id
                 WHERE u2.school_id = :id AND dt.grid_id = ' . WWTC_GRID_KAPITELACH . '
                   AND dtmm.subject_id = ' . WWTC_SUBJECT_ID . " AND dtmm.start_date IN ($in)
                 GROUP BY dtm.user_id, dtmm.start_date
           ) t
           JOIN users u ON u.user_id = t.user_id
           JOIN classes c ON c.class_id = u.class_id
          GROUP BY t.user_id
          ORDER BY said DESC
          LIMIT " . $limit
    );
    $stmt->execute([':id' => $id]);
    $rows = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $rows[] = [
            'id' => (int) $r['user_id'],
            'name' => trim($r['first'] . ' ' . $r['last']),
            'grade' => (string) $r['class_grade'],
            'saidYear' => (int) $r['said'],
        ];
    }
    wwtcJson(['schoolId' => $id, 'soldiers' => $rows]);
}

// ---- perfect platoons (nationwide) -----------------------------------------

if ($method === 'GET' && $path === '/perfect-platoons') {
    // A perfect platoon = a class where every enrolled soldier earned the mission
    // this month (met count === class size), the SPA's definition. Cheap: from the
    // same mission-mark/headcount counts the home stats use, then one class-meta
    // lookup — no per-school report loop.
    $current = wwtcCurrentDate();
    $counts = wwtcCompletionCounts($current);
    $perfect = []; // class_id => ['sid'=>, 'size'=>]
    foreach ($counts['sizeByClass'] as $sid => $byClass) {
        foreach ($byClass as $cid => $size) {
            if ($size > 0 && ($counts['metByClass'][$sid][$cid] ?? 0) >= $size) {
                $perfect[(int) $cid] = ['sid' => (int) $sid, 'size' => (int) $size];
            }
        }
    }

    $out = [];
    if ($perfect) {
        $schools = wwtcEligibleSchools();
        $ids = implode(',', array_map('intval', array_keys($perfect)));
        $meta = $MASHPIA_DB->query(
            "SELECT class_id, class_grade, class_sub, class_teacher FROM classes WHERE class_id IN ($ids)"
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($meta as $c) {
            $cid = (int) $c['class_id'];
            $sid = $perfect[$cid]['sid'];
            if (!isset($schools[$sid])) {
                continue; // not an eligible WWTC school
            }
            $grade = (string) $c['class_grade'];
            $sub = (string) ($c['class_sub'] ?? '');
            $out[] = [
                'schoolId' => $sid,
                'school' => $schools[$sid],
                'className' => $grade . ($sub !== '' ? '-' . $sub : ''),
                'teacher' => (string) ($c['class_teacher'] ?? ''),
                'grade' => $grade,
                'size' => $perfect[$cid]['size'],
            ];
        }
    }
    wwtcJson(['month' => wwtcMonthForDate($current), 'platoons' => $out]);
}

// ---- reports ----------------------------------------------------------------

if ($method === 'GET' && $path === '/reports/army') {
    // The army accomplishment report (generateArmyAccomplishedReport): one row
    // per school, Goal / Accomplished, from setASR() — identical to
    // shabbos_mevorchim_summary.php — plus registered + % met (mission marks).
    $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
    $agg = wwtcArmyAggregates($date);
    $names = $agg['schools'];
    $goal = $agg['kapGoal'];
    $done = $agg['kapDone'];
    $counts = wwtcCompletionCounts($date);

    // Participation (soldiers with any kapitlach recorded, per school) is distinct
    // from "met" (the full quota): % participated counts anyone who said something.
    $partStmt = $MASHPIA_DB->prepare(
        'SELECT u.school_id, COUNT(DISTINCT dtm.user_id) n
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
           JOIN users u ON u.user_id = dtm.user_id
          WHERE dt.grid_id = ' . WWTC_GRID_KAPITELACH . ' AND dtmm.subject_id = ' . WWTC_SUBJECT_ID . '
            AND dtmm.start_date = :d AND dtm.done_qty > 0
          GROUP BY u.school_id'
    );
    $partStmt->execute([':d' => $date]);
    $participated = [];
    foreach ($partStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $participated[(int) $r['school_id']] = (int) $r['n'];
    }

    $logos = wwtcSchoolLogos();
    $rows = [];
    foreach ($names as $id => $name) {
        $id = (int) $id;
        $g = (int) ($goal[$id] ?? 0);
        $d = (int) ($done[$id] ?? 0);
        $registered = (int) ($counts['sizeBySchool'][$id] ?? 0);
        $met = (int) ($counts['metBySchool'][$id] ?? 0);
        $part = (int) ($participated[$id] ?? 0);
        $rows[] = [
            'id' => $id,
            'name' => (string) $name,
            'logo' => $logos[$id] ?? null,
            'registered' => $registered,
            'goal' => $g,
            'accomplished' => $d,
            'pct' => wwtcPct($d, $g),
            'pctParticipated' => $registered > 0 ? (int) round($part / $registered * 100) : 0,
            'pctMet' => $registered > 0 ? (int) round($met / $registered * 100) : 0,
            'moreThanGoal' => max(0, $d - $g),
            'lessThanGoal' => max(0, $g - $d),
        ];
    }
    usort($rows, static function ($a, $b) {
        return $b['pct'] <=> $a['pct'] ?: $b['accomplished'] <=> $a['accomplished'];
    });
    wwtcJson(['month' => wwtcMonthForDate($date), 'rows' => $rows]);
}

if ($method === 'GET' && preg_match('#^/reports/base/(\d+)$#', $path, $m)) {
    $id = (int) $m[1];
    $names = wwtcEligibleSchools();
    if (!isset($names[$id])) {
        wwtcError('School not found.', 404);
    }
    $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
    $classes = wwtcSchoolData($id, $date)['classes'];
    $rows = [];
    foreach ($classes as $c) {
        $rows[] = [
            'id' => $c['id'],
            'name' => $c['name'],
            'grade' => $c['grade'],
            'teacher' => $c['teacher'],
            'size' => $c['size'],
            'goal' => $c['quota'],
            'accomplished' => $c['said'],
            'completed' => $c['met'],
            'perfect' => $c['perfect'],
        ];
    }
    wwtcJson(['month' => wwtcMonthForDate($date), 'school' => $names[$id], 'schoolId' => $id, 'rows' => $rows]);
}

if ($method === 'GET' && preg_match('#^/reports/platoon/(\d+)$#', $path, $m)) {
    wwtcRequireActor(['admin']); // per-child rows with real names — admin only
    $classId = (int) $m[1];
    $schoolId = (int) ($MASHPIA_DB->query('SELECT school_id FROM classes WHERE class_id = ' . $classId)->fetchColumn() ?: 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('Class not found.', 404);
    }
    $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
    $data = wwtcSchoolData($schoolId, $date);
    $className = ''; $completed = 0; $rows = [];
    foreach ($data['students'] as $s) {
        if ($s['classId'] !== $classId) {
            continue;
        }
        $className = $s['className'];
        $completed += $s['met'] ? 1 : 0;
        $rows[] = [
            'id' => $s['id'],
            'name' => $s['name'],
            'goal' => $s['quota'],
            // No Hebrew kapitel label server-side; the numeric goal stands in for
            // goalLabel (the SPA renders it where it shows the demo's Hebrew range).
            'goalLabel' => (string) $s['quota'],
            'said' => $s['said'],
            'met' => $s['met'],
        ];
    }
    wwtcJson([
        'month' => wwtcMonthForDate($date),
        'school' => wwtcEligibleSchools()[$schoolId] ?? null,
        'className' => $className,
        'completed' => $completed,
        'size' => count($rows),
        'rows' => $rows,
    ]);
}

// Who hasn't completed this month, per class (drives the teacher deadline list).
if ($method === 'GET' && preg_match('#^/schools/(\d+)/not-completed$#', $path, $m)) {
    wwtcRequireActor(['admin']); // per-child names — admin only
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    $data = wwtcSchoolData($id, wwtcDateForMonthIdx($_GET['monthIdx'] ?? null));
    $byClass = [];
    foreach ($data['students'] as $s) {
        if (!$s['met']) {
            $cid = (int) $s['classId'];
            if (!isset($byClass[$cid])) {
                $byClass[$cid] = ['classId' => $cid, 'className' => $s['className'], 'size' => 0, 'missing' => []];
            }
            $byClass[$cid]['missing'][] = $s['name'];
        }
    }
    foreach ($data['classes'] as $c) {
        if (isset($byClass[$c['id']])) {
            $byClass[$c['id']]['size'] = $c['size'];
        }
    }
    wwtcJson(['schoolId' => $id, 'classes' => array_values($byClass)]);
}

// ---- the signed-in soldier --------------------------------------------------

if ($method === 'GET' && $path === '/me/progress') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    wwtcJson(wwtcKidProgress($kid));
}

if ($method === 'GET' && $path === '/me/social') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    $schoolId = (int) $kid['school_id'];
    $data = wwtcSchoolData($schoolId);

    // Class standings within the school, by % of soldiers who met.
    $classes = $data['classes'];
    usort($classes, static function ($a, $b) {
        return $b['pctMet'] <=> $a['pctMet'] ?: $b['met'] <=> $a['met'];
    });
    $myClassId = (int) $kid['class_id'];
    $classRank = 0; $className = ''; $classSize = 0; $aheadName = null;
    foreach ($classes as $i => $c) {
        if ($c['id'] === $myClassId) {
            $classRank = $i + 1;
            $className = $c['name'];
            $classSize = $c['size'];
            $aheadName = $i > 0 ? $classes[$i - 1]['name'] : null;
            break;
        }
    }

    // This soldier's rank within their class, by said this month.
    $mates = array_values(array_filter($data['students'], static function ($s) use ($myClassId) {
        return $s['classId'] === $myClassId;
    }));
    usort($mates, static function ($a, $b) {
        return $b['said'] <=> $a['said'];
    });
    $myRank = 0;
    foreach ($mates as $i => $s) {
        if ($s['id'] === (int) $kid['user_id']) {
            $myRank = $i + 1;
            break;
        }
    }

    // School standing nationwide — same Race order as Home (% soldiers met first).
    // Previously ranked by raw kapitlach said, which disagreed with the main page.
    $ranked = wwtcNationwideSchools();
    $schoolRank = 0;
    foreach ($ranked as $i => $row) {
        if ((int) $row['id'] === $schoolId) {
            $schoolRank = $i + 1;
            break;
        }
    }

    // How many more classmates finishing would pass the class ahead (pctMet).
    $needToPass = 0;
    if ($classRank > 1 && $classSize > 0) {
        $mine = null;
        $ahead = null;
        foreach ($classes as $i => $c) {
            if ($c['id'] === $myClassId) {
                $mine = $c;
                $ahead = $i > 0 ? $classes[$i - 1] : null;
                break;
            }
        }
        if ($mine && $ahead && $mine['met'] < $mine['size']) {
            $targetMet = (int) floor(($ahead['pctMet'] / 100) * $mine['size']) + 1;
            $needToPass = max(1, min($mine['size'] - $mine['met'], $targetMet - $mine['met']));
        }
    }

    wwtcJson([
        'className' => $className,
        'classRank' => $classRank,
        'totalClasses' => count($classes),
        'classAheadName' => $aheadName,
        'needToPass' => $needToPass,
        'myRankInClass' => $myRank,
        'classSize' => $classSize,
        'schoolName' => $kid['school_name'] ?? null,
        'schoolRank' => $schoolRank,
        'totalSchools' => count($ranked),
    ]);
}

// ---- General 613: a scoped talking general ----------------------------------

/** System prompt: General 613 stays warm, on-topic, and easy to hear out loud. */
function wwtcGeneralSystem(string $ctxJson): string
{
    return <<<SYS
You are the child's virtual commander. In every sentence you call yourself "your virtual commander", never "General 613". You are the friendly general of the Worldwide Tehillim Club — a Tzivos Hashem campaign where Jewish children say Tehillim every Shabbos Mevorchim and train, grade by grade, toward saying the whole Sefer Tehillim. You talk to one child at a time. You are a kind general: warm, encouraging, and never harsh or scary.

Your words are spoken out loud. Write the way you talk to a child: one or two short sentences, everyday words, no lists, no markdown, no links, no stage directions. A little emoji is fine in the written chat, but the sentence must still make complete sense if the emoji is taken out.

Your ONLY job is to help this child with the Tehillim Club, and to explain how it works in simple words: how to pick a ladder, what their quota is (the kapitlach and minutes to say), and how to mark it done (on their page, type the kapitlach and minutes and tap Save). Also help with their progress, missions and medals, class and school rank, the next Shabbos Mevorchim, and warm chizuk to say Tehillim.

Rules:
- Stay strictly on those topics. If the child asks about anything else (homework, games, other subjects, personal troubles, the news, etc.), kindly say you're just here to help with their Tehillim and gently steer back. Do not answer off-topic questions.
- Use ONLY the facts in the child's data below. Never invent numbers, names, Hebrew dates, or ranks. If something isn't in the data, say you don't have it and suggest they check their page.
- The ladder is training, not the goal. Saying the whole Tehillim every Shabbos Mevorchim is the goal. A lower ladder number is more challenging and a bigger quota. Ladder 12 is the gentlest. Use only ladderChoices for kapitlach and minutes. Never invent a quota. If minutes are missing, don't make them up.
- If "answerSheet" is in the data, those are the approved answers. When the child's question matches one, use that answer word for word. If an answer says to ask a counselor or a grown-up, say that and do not invent a fact. Never type the child's kapitlach or minutes for them. Guide them to the "Kapitlach I said" and "Minutes I said" boxes, then Save.
- If "greeting" is in the data, that is what you just said out loud when they arrived. Continue that conversation; don't repeat the whole greeting. If they have not picked a ladder, walk the ladders in ladderChoices, one at a time, and ask if that quota works or if they want a more challenging ladder. The app saves the ladder when they say yes. If they ask to change to a ladder, confirm that ladder's kapitlach and minutes and wait for yes. Only a ladder in ladderChoices can be saved. If a save fails, they can tap "Switch my ladder" on their page.
- Never give medical, legal, or safety advice, and never discuss anything inappropriate or frightening. If a child seems upset or in trouble, gently encourage them to talk to a parent, teacher, or Rabbi.

The child's data (JSON):
$ctxJson
SYS;
}

/** Call the Claude Messages API. Returns the reply text, or null on any failure. */
function wwtcGeneralAsk(string $key, string $model, string $system, array $messages): ?string
{
    $payload = json_encode(
        ['model' => $model, 'max_tokens' => 300, 'system' => $system, 'messages' => $messages],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . $key],
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 25,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if (!is_string($raw) || $status < 200 || $status >= 300) {
        error_log('WWTC General 613 AI error: status ' . $status . ' ' . $err . ' ' . (is_string($raw) ? mb_substr($raw, 0, 500) : ''));
        return null;
    }
    $data = json_decode($raw, true);
    $text = '';
    foreach ((array) ($data['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'text') {
            $text .= (string) ($block['text'] ?? '');
        }
    }
    $text = trim($text);
    return $text === '' ? null : $text;
}

if ($method === 'POST' && $path === '/chat') {
    $in = wwtcInput();
    $message = trim((string) ($in['message'] ?? ''));
    if ($message === '') {
        wwtcError('Please include a message.', 422);
    }
    $message = mb_substr($message, 0, 600);

    // Server-side only. Set WWTC_AI_KEY in globals.php (gitignored) or the env.
    $key = defined('WWTC_AI_KEY') ? (string) WWTC_AI_KEY : '';
    if (strlen($key) < 10) {
        $key = wwtcEnv('WWTC_AI_KEY');
    }
    if (strlen($key) < 10) {
        wwtcError('Your Virtual Commander’s AI is not configured yet.', 503);
    }
    $model = wwtcEnv('WWTC_AI_MODEL') ?: 'claude-haiku-5-5';

    // The child's own, non-sensitive progress snapshot, as the SPA computed it.
    $ctx = is_array($in['context'] ?? null) ? $in['context'] : [];
    $system = wwtcGeneralSystem((string) json_encode($ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

    // Short rolling history for continuity (child = user, General 613 = assistant).
    $messages = [];
    foreach ((array) ($in['history'] ?? []) as $h) {
        $text = trim((string) ($h['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $messages[] = ['role' => ($h['from'] ?? '') === 'kid' ? 'user' : 'assistant', 'content' => mb_substr($text, 0, 600)];
    }
    $messages = array_slice($messages, -8);
    // The Messages API requires the first turn to be from the user.
    while ($messages && $messages[0]['role'] !== 'user') {
        array_shift($messages);
    }
    if (!$messages || end($messages)['content'] !== $message) {
        $messages[] = ['role' => 'user', 'content' => $message];
    }

    $reply = wwtcGeneralAsk($key, $model, $system, $messages);
    if ($reply === null) {
        wwtcError('Your Virtual Commander is taking a quick break — please try again in a moment.', 502);
    }
    wwtcJson(['reply' => $reply]);
}

// ---- writes: the signed-in soldier's own self-report -----------------------

// A soldier records their own kapitlach + minutes for the current Shabbos
// Mevorchim. Writes the same tables the teacher tool (mark_tehillim2.php) writes,
// scoped by the bearer token to the soldier's own user_id, current month only.
if ($method === 'POST' && $path === '/me/report') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    if (empty($kid['track_id']) || empty($kid['level'])) {
        wwtcError('You are not enrolled in the Tehillim Club yet — ask your teacher.', 409);
    }

    $date = wwtcCurrentDate(); // current Shabbos Mevorchim only

    $input = wwtcInput();
    $hasKap = array_key_exists('kapitlach', $input) || array_key_exists('kapitelach', $input);
    $hasMin = array_key_exists('minutes', $input);
    if (!$hasKap && !$hasMin) {
        wwtcError('Nothing to report.', 422);
    }
    // Kapitlach 0..150, minutes 0..770 (the teacher tool's cap).
    $kapitlach = max(0, min(150, (int) round((float) ($input['kapitlach'] ?? $input['kapitelach'] ?? 0))));
    $minutes = max(0, min(770, (int) round((float) ($input['minutes'] ?? 0))));

    // The soldier's mission for this Shabbos Mevorchim, matched exactly as the
    // read side (wwtcKidMonths) and mark_tehillim2 do.
    $missionStmt = $MASHPIA_DB->prepare(
        'SELECT date_tasks_mission_id FROM date_tasks_missions
          WHERE subject_id = ' . WWTC_SUBJECT_ID . '
            AND start_date = :d AND end_date = :d AND school_type_id = :st
            AND track_id = :track AND level = :lvl AND lang_id = :lang
          LIMIT 1'
    );
    $missionStmt->execute([
        ':d' => $date, ':st' => (int) $kid['school_type_id'],
        ':track' => (int) $kid['track_id'], ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
    ]);
    $missionId = (int) ($missionStmt->fetchColumn() ?: 0);
    if (!$missionId) {
        wwtcError('There is no Tehillim mission set for this Shabbos Mevorchim yet.', 409);
    }

    // The mission's kapitelach + minutes task rows.
    $taskStmt = $MASHPIA_DB->prepare(
        'SELECT date_task_id, grid_id, quantity, description, points
           FROM date_tasks WHERE date_tasks_mission_id = :mid
            AND grid_id IN (' . WWTC_GRID_KAPITELACH . ', ' . WWTC_GRID_MINUTES . ')'
    );
    $taskStmt->execute([':mid' => $missionId]);
    $tasksByGrid = [];
    foreach ($taskStmt->fetchAll(PDO::FETCH_ASSOC) as $t) {
        $tasksByGrid[(int) $t['grid_id']] = $t;
    }

    $userId = (int) $kid['user_id'];
    try {
        $MASHPIA_DB->beginTransaction();
        if ($hasKap && isset($tasksByGrid[WWTC_GRID_KAPITELACH])) {
            wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_KAPITELACH], $kapitlach, true);
        }
        if ($hasMin && isset($tasksByGrid[WWTC_GRID_MINUTES])) {
            wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_MINUTES], $minutes, false);
        }
        $MASHPIA_DB->commit();
    } catch (\Throwable $e) {
        if ($MASHPIA_DB->inTransaction()) {
            $MASHPIA_DB->rollBack();
        }
        error_log('WWTC /me/report failed for user ' . $userId . ': ' . $e->getMessage());
        wwtcError('Could not save your report. Please try again.', 500);
    }

    // The marks feed the cached ShabbosMevorchim reports — bump so they refresh.
    if (class_exists('Cache')) {
        Cache::bumpVersion('shabbos_mevorchim:v');
    }

    wwtcJson(wwtcKidProgress(wwtcKidByUserId($userId) ?: $kid));
}

// A soldier chooses their own ladder (training plan). Writes user_tracks.track_id
// for the Tehillim subject; the mapping is ladder 5..12 -> track_id 8..1.
if (($method === 'PUT' || $method === 'POST') && $path === '/me/ladder') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    if (empty($kid['track_id'])) {
        wwtcError('You are not enrolled in the Tehillim Club yet — ask your teacher.', 409);
    }

    $input = wwtcInput();
    $ladder = (int) ($input['ladder'] ?? 0);
    // A ladder is the grade a soldier finishes training by, so it can't be below
    // their current grade (max(5, grade)..12 — the SPA's availableLadders).
    $gradeNum = is_numeric($kid['class_grade']) ? (int) $kid['class_grade'] : 0;
    $minLadder = max(5, $gradeNum);
    if ($ladder < $minLadder || $ladder > 12) {
        wwtcError("Choose a ladder between $minLadder and 12.", 422);
    }
    $track = wwtcTrackFromLadder($ladder);

    // The target track must actually have a mission this month, or the soldier
    // would land on a ladder with no quota (e.g. tracks that aren't set up yet).
    $check = $MASHPIA_DB->prepare(
        'SELECT 1 FROM date_tasks_missions
          WHERE subject_id = ' . WWTC_SUBJECT_ID . '
            AND start_date = :d AND end_date = :d AND school_type_id = :st
            AND track_id = :track AND level = :lvl AND lang_id = :lang
          LIMIT 1'
    );
    $check->execute([
        ':d' => wwtcCurrentDate(), ':st' => (int) $kid['school_type_id'],
        ':track' => $track, ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
    ]);
    if (!$check->fetchColumn()) {
        wwtcError('That ladder isn’t available for you yet.', 422);
    }

    $stmt = $MASHPIA_DB->prepare(
        'UPDATE user_tracks SET track_id = :track
          WHERE user_id = :uid AND subject_id = ' . WWTC_SUBJECT_ID . ' AND enrolled = 1'
    );
    $stmt->execute([':track' => $track, ':uid' => (int) $kid['user_id']]);

    // Quota (and so missions met) changes with the ladder — refresh the reports.
    if (class_exists('Cache')) {
        Cache::bumpVersion('shabbos_mevorchim:v');
    }

    wwtcJson(wwtcKidProgress(wwtcKidByUserId((int) $kid['user_id']) ?: $kid));
}

// ---- writes: not available (read-only first cut) ---------------------------

$writeRoutes = [
    ['PATCH', '#^/schools/\d+/dedication$#'],
];
foreach ($writeRoutes as [$verb, $pattern]) {
    if ($method === $verb && preg_match($pattern, $path)) {
        wwtcError('Recording and ladder changes are handled by HQ for now.', 405);
    }
}

wwtcError('Not found: ' . $method . ' ' . $path, 404);
