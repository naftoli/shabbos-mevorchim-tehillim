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
require __DIR__ . '/overEntry.php';
require __DIR__ . '/flags.php';
require __DIR__ . '/schoolLogo.php';
require __DIR__ . '/platoonRoll.php';
require __DIR__ . '/soldierBoard.php';
require __DIR__ . '/soldierRank.php';
require __DIR__ . '/notify.php';

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

// Signed, expiring PDF for one commander or teacher. No login. The token is
// the secret; a bad or expired token is a 404 with no names in the body.
if ($method === 'GET' && $path === '/notify-report') {
    $notifyToken = $_GET['t'] ?? '';
    wwtcNotifyServeReport(is_string($notifyToken) ? $notifyToken : '');
}

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
function wwtcSchoolRow(int $id, string $name, array $kapGoal, array $kapDone, array $minGoal, array $minDone, array $counts, int $participated = 0): array
{
    $said = (int) ($kapDone[$id] ?? 0);
    $q = (int) ($kapGoal[$id] ?? 0);
    $minSaid = (int) ($minDone[$id] ?? 0);
    $minQ = (int) ($minGoal[$id] ?? 0);
    $kids = (int) ($counts['sizeBySchool'][$id] ?? 0);
    $met = (int) ($counts['metBySchool'][$id] ?? 0);
    $part = max(0, $participated);
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
        'participatedMonth' => $part,
        'pctParticipated' => $kids > 0 ? (int) round($part / $kids * 100) : 0,
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
        ?: $b['saidMonth'] <=> $a['saidMonth']
        ?: $b['pct'] <=> $a['pct']
        ?: $b['minutesPct'] <=> $a['minutesPct']
        ?: strcmp($a['name'], $b['name']);
}

/** True when two already-sorted rows share every ranking metric (not the name). */
function wwtcScoreTie(array $a, array $b, array $keys): bool
{
    foreach ($keys as $key) {
        if ((float) ($a[$key] ?? 0) != (float) ($b[$key] ?? 0)) {
            return false;
        }
    }
    return true;
}

/**
 * Competition place in a list that is already best-first.
 * Ties share a rank and the next place skips. 0 means the id was not found.
 */
function wwtcCompetitionRank(array $rows, $id, callable $idOf, array $keys): int
{
    $n = count($rows);
    $i = 0;
    while ($i < $n) {
        $j = $i + 1;
        while ($j < $n && wwtcScoreTie($rows[$i], $rows[$j], $keys)) {
            $j++;
        }
        for ($k = $i; $k < $j; $k++) {
            if ($idOf($rows[$k]) === $id) {
                return $i + 1;
            }
        }
        $i = $j;
    }
    return 0;
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
function wwtcNationwideSchools(?int $date = null, ?int $year = null): array
{
    $year = $year ?: wwtcYear();
    $date = $date ?? wwtcCurrentDate();
    $agg = wwtcArmyAggregates($date, $year);
    $names = $agg['schools'];
    $counts = wwtcCompletionCounts($date, $year);
    $part = wwtcParticipatedBySchool($date);

    $rows = [];
    foreach ($names as $id => $name) {
        $rows[] = wwtcSchoolRow(
            (int) $id,
            (string) $name,
            $agg['kapGoal'],
            $agg['kapDone'],
            $agg['minGoal'],
            $agg['minDone'],
            $counts,
            (int) ($part[(int) $id] ?? 0)
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
function wwtcSchoolDataRaw(int $schoolId, ?int $date = null, ?int $year = null): array
{
    $year = $year ?: wwtcYear();
    $date = $date ?? wwtcCurrentDate();
    return wwtcCached("school_data.$year.$schoolId.$date", static function () use ($schoolId, $date, $year) {
    $report = wwtcReport($date, $year);
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
    $partBy = [];
    $minQuotaBy = [];
    $minDoneBy = [];
    $minQuota = 0;
    $minDone = 0;
    foreach (($quotaRows[$date] ?? []) as $classId => $usersByKey) {
        $m = $meta[$classId] ?? ['grade' => '', 'teacher' => ''];
        foreach ($usersByKey as $uid => $byKey) {
            $q = (int) ($byKey['Kapitelach'] ?? 0);
            $d = (int) ($doneRows[$date][$classId][$uid]['Kapitelach'] ?? 0);
            // Same met test as GET /perfect-platoons (wwtcSoldierMetQuota).
            $isMet = wwtcSoldierMetQuota($q, $d);
            $mq = (int) ($byKey['Minutes'] ?? 0);
            $md = (int) ($doneRows[$date][$classId][$uid]['Minutes'] ?? 0);
            $minQuota += $mq;
            $minDone += $md;
            $minQuotaBy[$classId] = ($minQuotaBy[$classId] ?? 0) + $mq;
            $minDoneBy[$classId] = ($minDoneBy[$classId] ?? 0) + $md;
            $sizeBy[$classId] = ($sizeBy[$classId] ?? 0) + 1;
            $metBy[$classId] = ($metBy[$classId] ?? 0) + ($isMet ? 1 : 0);
            // Participated = a kapitlach mark with done_qty > 0, matching
            // wwtcParticipatedBySchool (the % Soldiers participated metric).
            $partBy[$classId] = ($partBy[$classId] ?? 0) + ($d > 0 ? 1 : 0);
            $students[] = [
                'id' => (int) $uid,
                'name' => (string) ($names[$uid] ?? ''),
                'classId' => (int) $classId,
                'className' => (string) $m['grade'],
                'quota' => $q,
                'minutesQuota' => $mq,
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
            'teacher' => wwtcTeacherName($m['teacher'] ?? ''),
            'grade' => (string) $m['grade'],
            'size' => $size,
            'said' => $said,
            'quota' => $quota,
            'pct' => wwtcPct($said, $quota),
            'met' => $met,
            'pctMet' => $size > 0 ? (int) round($met / $size * 100) : 0,
            'participated' => (int) ($partBy[$classId] ?? 0),
            'pctParticipated' => $size > 0 ? (int) round(($partBy[$classId] ?? 0) / $size * 100) : 0,
            'minutesSaid' => $minD,
            'minutesQuota' => $minQ,
            'minutesPct' => wwtcPct($minD, $minQ),
            'perfect' => wwtcClassIsPerfect($met, $size),
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
 * Engine school report, then quota overrides, then the shared Perfect Platoon
 * roster. Kapitlach totals stay the engine's. The star, met/size, and the
 * class label come from wwtcCanonicalPlatoonSoldiers(), the same rows as
 * GET /perfect-platoons.
 */
function wwtcSchoolData(int $schoolId, ?int $date = null, ?int $year = null): array
{
    $year = $year ?: wwtcYear();
    $date = $date ?? wwtcCurrentDate();
    $data = wwtcSchoolDataRaw($schoolId, $date, $year);
    // A rotated school year reprices the engine quota onto the sheet month.
    // A custom ladder then replaces that figure. The one-month override
    // replaces that month's kapitel quota. See api/customLadder.php.
    if (function_exists('wwtcRepriceSchoolYearData')) {
        $data = wwtcRepriceSchoolYearData($data, $schoolId, $date, $year);
    }
    if (function_exists('wwtcOverlayCustomLaddersOnSchool')) {
        $data = wwtcOverlayCustomLaddersOnSchool($data, $date, $year);
    }
    $data = wwtcOverlaySchoolData($data, $date, $year);
    return wwtcApplyPerfectRosterToSchool($data, $schoolId, $date, $year);
}

/**
 * Army goals after a custom ladder and a one-month override.
 * The override's delta is final-minus-engine for kapitel (it wins). A custom
 * ladder with no override adds its own kapitel delta. Minutes move only for
 * the custom ladder; the override does not change them.
 */
function wwtcAdjustArmyAggregates(array $agg, int $date, int $year): array
{
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $agg;
    }
    $overs = wwtcActiveOverridesForMonth($year, $month);
    $bySchool = [];
    foreach ($overs as $uid => $row) {
        $bySchool[(int) $row['school_id']][(int) $uid] = $row;
    }
    $deltas = [];
    foreach ($bySchool as $sid => $map) {
        $raw = wwtcSchoolDataRaw($sid, $date, $year);
        $seen = [];
        foreach ($raw['students'] ?? [] as $student) {
            $uid = (int) ($student['id'] ?? 0);
            if (!isset($map[$uid])) {
                continue;
            }
            $seen[$uid] = true;
            $deltas[$sid] = ($deltas[$sid] ?? 0) + ((int) $map[$uid]['overridden_quota'] - (int) $student['quota']);
        }
        foreach ($map as $uid => $row) {
            if (isset($seen[$uid])) {
                continue;
            }
            $deltas[$sid] = ($deltas[$sid] ?? 0) + ((int) $row['overridden_quota'] - (int) $row['original_quota']);
        }
    }
    $customKap = [];
    $customMin = [];
    if (function_exists('wwtcCustomLadderArmyDeltas')) {
        [$customKap, $customMin] = wwtcCustomLadderArmyDeltas($date, $year, $overs);
    }
    foreach ($customKap as $sid => $delta) {
        $deltas[$sid] = ($deltas[$sid] ?? 0) + (int) $delta;
    }
    if (!$deltas && !$customMin) {
        return $agg;
    }
    // School-year deltas are applied afterwards, in wwtcAdjustSchoolYearAggregates,
    // so a base-commander override still replaces the sheet quota.
    $out = $agg;
    if ($deltas) {
        $out['kapGoal'] = wwtcOverlayKapGoals($agg['kapGoal'] ?? [], $deltas);
        $army = $out['army'] ?? [];
        $kap = $army['Kapitelach'] ?? [];
        $kap[$date] = (int) ($kap[$date] ?? 0) + array_sum($deltas);
        $army['Kapitelach'] = $kap;
        $out['army'] = $army;
    }
    if ($customMin) {
        $out['minGoal'] = wwtcOverlayKapGoals($out['minGoal'] ?? [], $customMin);
        $army = $out['army'] ?? [];
        if (isset($army['Minutes']) && is_array($army['Minutes'])) {
            $army['Minutes'][$date] = (int) ($army['Minutes'][$date] ?? 0) + array_sum($customMin);
            $out['army'] = $army;
        }
    }
    return $out;
}

/**
 * Army kapitlach and minutes goals follow each school's own year. A school
 * that starts in Tishrei contributes the engine total. A school that starts
 * in another month contributes the sheet-month cell instead. Soldiers with a
 * quota override are left to wwtcAdjustArmyAggregates, which already replaced
 * their engine quota with the override.
 */
function wwtcAdjustSchoolYearAggregates(array $agg, int $date, int $year): array
{
    if (!function_exists('wwtcNonDefaultFirstMonths') || !wwtcNonDefaultFirstMonths()) {
        return $agg;
    }
    if (!function_exists('wwtcMonthNameForJd')) {
        return $agg;
    }
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '' || (function_exists('wwtcIsHolidayMonth') && wwtcIsHolidayMonth($month))) {
        return $agg;
    }
    $overs = function_exists('wwtcActiveOverridesForMonth') ? wwtcActiveOverridesForMonth($year, $month) : [];
    $kapDeltas = [];
    $minDeltas = [];
    foreach (wwtcNonDefaultFirstMonths() as $sid => $first) {
        $sheet = wwtcSchoolSheetQuantities((int) $sid, $date, $year, $month);
        if (!$sheet['qty']) {
            continue;
        }
        $boundary = wwtcAsOfBoundary($date);
        $cal = wwtcSchoolTaskQuantities((int) $sid, $date, $boundary);
        $raw = wwtcSchoolDataRaw((int) $sid, $date, $year);
        foreach ($raw['students'] ?? [] as $student) {
            $uid = (int) ($student['id'] ?? 0);
            if ($uid <= 0 || isset($overs[$uid]) || !isset($sheet['qty'][$uid])) {
                continue;
            }
            $kapDeltas[$sid] = ($kapDeltas[$sid] ?? 0) + ((int) $sheet['qty'][$uid]['kap'] - (int) ($student['quota'] ?? 0));
            if (isset($cal[$uid])) {
                $minDeltas[$sid] = ($minDeltas[$sid] ?? 0) + ((int) $sheet['qty'][$uid]['min'] - (int) $cal[$uid]['min']);
            }
        }
    }
    if (!$kapDeltas && !$minDeltas) {
        return $agg;
    }
    $out = $agg;
    if ($kapDeltas && function_exists('wwtcOverlayKapGoals')) {
        $out['kapGoal'] = wwtcOverlayKapGoals($agg['kapGoal'] ?? [], $kapDeltas);
        $army = $out['army'] ?? [];
        $kap = $army['Kapitelach'] ?? [];
        $kap[$date] = (int) ($kap[$date] ?? 0) + array_sum($kapDeltas);
        $army['Kapitelach'] = $kap;
        $out['army'] = $army;
    }
    if ($minDeltas) {
        $minGoal = $agg['minGoal'] ?? [];
        foreach ($minDeltas as $sid => $delta) {
            $minGoal[(int) $sid] = (int) ($minGoal[(int) $sid] ?? 0) + (int) $delta;
        }
        $out['minGoal'] = $minGoal;
    }
    return $out;
}

// ---- holiday board shapers --------------------------------------------------
// wwtcHolidayBoard() (bootstrap) builds the per-soldier holiday data once; these
// turn it into the exact response shapes the engine-backed endpoints return, so
// Rosh Hashana / Yom Kippur render through the same UI with no special-casing.

/** Nationwide school rows for a holiday, Race-sorted — matches wwtcNationwideSchools. */
function wwtcHolidaySchools(array $board): array
{
    $rows = [];
    foreach ($board['schools'] as $id => $name) {
        $id = (int) $id;
        $rows[] = wwtcSchoolRow(
            $id, (string) $name,
            $board['kapGoal'], $board['kapDone'], $board['minGoal'], $board['minDone'],
            $board['counts'], (int) ($board['participated'][$id] ?? 0)
        );
    }
    usort($rows, 'wwtcCmpSchoolRace');
    return $rows;
}

/** Army accomplishment rows for a holiday — matches the /reports/army shape. */
function wwtcHolidayArmyRows(array $board): array
{
    $logos = wwtcSchoolLogos();
    $counts = $board['counts'];
    $rows = [];
    foreach ($board['schools'] as $id => $name) {
        $id = (int) $id;
        $g = (int) ($board['kapGoal'][$id] ?? 0);
        $d = (int) ($board['kapDone'][$id] ?? 0);
        $registered = (int) ($counts['sizeBySchool'][$id] ?? 0);
        $met = (int) ($counts['metBySchool'][$id] ?? 0);
        $part = (int) ($board['participated'][$id] ?? 0);
        $mg = (int) ($board['minGoal'][$id] ?? 0);
        $md = (int) ($board['minDone'][$id] ?? 0);
        $rows[] = [
            'id' => $id,
            'name' => (string) $name,
            'logo' => $logos[$id] ?? null,
            'registered' => $registered,
            'goal' => $g,
            'accomplished' => $d,
            'pct' => wwtcPct($d, $g),
            'minutes' => $md,
            'minutesGoal' => $mg,
            'minutesPct' => wwtcPct($md, $mg),
            'participated' => $part,
            'met' => $met,
            'pctParticipated' => $registered > 0 ? (int) round($part / $registered * 100) : 0,
            'pctMet' => $registered > 0 ? (int) round($met / $registered * 100) : 0,
            'moreThanGoal' => max(0, $d - $g),
            'lessThanGoal' => max(0, $g - $d),
        ];
    }
    usort($rows, static function ($a, $b) {
        return $b['pct'] <=> $a['pct'] ?: $b['accomplished'] <=> $a['accomplished'];
    });
    return $rows;
}

/** Perfect-platoon rows for a holiday — same rule as GET /perfect-platoons. */
function wwtcHolidayPlatoons(array $board): array
{
    return wwtcPerfectPlatoonsFromSoldiers(wwtcBoardPlatoonSoldiers($board));
}

/** One school's class + student breakdown for a holiday — matches wwtcSchoolData. */
function wwtcHolidaySchoolData(array $board, int $schoolId): array
{
    $students = $board['studentsBySchool'][$schoolId] ?? [];
    $byClass = [];
    foreach ($students as $s) {
        $cid = $s['classId'];
        $g = $byClass[$cid] ?? ['size' => 0, 'met' => 0, 'said' => 0, 'quota' => 0, 'minD' => 0, 'minQ' => 0];
        $g['size']++;
        $g['met'] += $s['met'] ? 1 : 0;
        $g['said'] += $s['said'];
        $g['quota'] += $s['quota'];
        $g['minD'] += $s['minutesSaid'];
        $g['minQ'] += $s['minutesQuota'];
        $byClass[$cid] = $g;
    }
    $classes = [];
    $minDone = 0;
    $minQuota = 0;
    foreach ($byClass as $cid => $g) {
        $meta = $board['classMeta'][$cid] ?? ['grade' => '', 'teacher' => ''];
        $classes[] = [
            'id' => (int) $cid,
            'name' => (string) $meta['grade'],
            'teacher' => wwtcTeacherName($meta['teacher'] ?? ''),
            'grade' => (string) $meta['grade'],
            'size' => $g['size'],
            'said' => $g['said'],
            'quota' => $g['quota'],
            'pct' => wwtcPct($g['said'], $g['quota']),
            'met' => $g['met'],
            'pctMet' => $g['size'] > 0 ? (int) round($g['met'] / $g['size'] * 100) : 0,
            'minutesSaid' => $g['minD'],
            'minutesQuota' => $g['minQ'],
            'minutesPct' => wwtcPct($g['minD'], $g['minQ']),
            'perfect' => wwtcClassIsPerfect($g['met'], $g['size']),
        ];
        $minDone += $g['minD'];
        $minQuota += $g['minQ'];
    }
    $srows = array_map(static function ($s) {
        return [
            'id' => $s['id'], 'name' => $s['name'], 'classId' => $s['classId'],
            'className' => $s['className'], 'quota' => $s['quota'], 'said' => $s['said'], 'met' => $s['met'],
        ];
    }, $students);
    $roster = wwtcPlatoonRoster(wwtcBoardPlatoonSoldiers($board));
    $classes = wwtcAlignSchoolClasses($classes, $roster, $schoolId);
    $srows = wwtcApplyRosterToStudents($srows, $roster, $schoolId);
    return ['classes' => $classes, 'students' => $srows, 'minutes' => $minDone, 'minutesQuota' => $minQuota];
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

    // Quota for grid $grid on Shabbos-Mevorchim $d, priced on the ladder the soldier
    // was on THEN (wwtcTrackAsOf), not their current ladder — so an earlier month
    // doesn't move when they change ladders. Level stays live.
    $qFor = function (int $grid, int $d) use ($quotaStmt, $kid): int {
        $track = wwtcTrackAsOf((int) $kid['user_id'], $d, (int) $kid['track_id']);
        $quotaStmt->execute([
            ':grid' => $grid, ':d' => $d, ':st' => (int) $kid['school_type_id'],
            ':track' => $track, ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
        ]);
        return (int) ($quotaStmt->fetchColumn() ?: 0);
    };
    $dFor = function (int $grid, int $d) use ($doneStmt, $kid): array {
        $doneStmt->execute([':uid' => (int) $kid['user_id'], ':d' => $d, ':grid' => $grid]);
        $raw = $doneStmt->fetchColumn();
        $reported = $raw !== null && $raw !== false;
        return [$reported ? (int) $raw : 0, $reported];
    };

    $current = wwtcCurrentDate();
    // Whether the current month is still open to the soldier's own report (closes
    // a week after Shabbos Mevorchim). Only the current month can be self-reported,
    // so a past month is never open.
    $reportOpen = wwtcReportWindowOpen();
    $firstMonth = function_exists('wwtcSchoolFirstMonth')
        ? wwtcSchoolFirstMonth((int) ($kid['school_id'] ?? 0))
        : 'Tishrei';
    // Tishrei schools keep today's elapsed Hebrew-year months, quota dated on
    // that same Shabbos. Another start walks the school's own grade year
    // (which can begin last Hebrew year) and prices quota on the sheet month.
    $monthRows = function_exists('wwtcKidMonthSlots')
        ? wwtcKidMonthSlots($firstMonth)
        : array_map(static function ($m) {
            return ['month' => $m['month'], 'jd' => (int) $m['jd'], 'quotaJd' => (int) $m['jd']];
        }, wwtcElapsedMonths());
    // Keyed by jd so the holiday rows (below) interleave chronologically — streaks
    // read this list in order, so Rosh Hashana / Yom Kippur must sit after Tishrei.
    $byDate = [];
    foreach ($monthRows as $m) {
        $d = (int) $m['jd'];
        $q = $qFor($kapitel, (int) ($m['quotaJd'] ?? $d));
        [$said, $reported] = $dFor($kapitel, $d);
        [$saidMinutes] = $dFor($minutes, $d);
        $byDate[$d] = [
            'month' => $m['month'],
            'quota' => $q,
            'said' => $said,
            'minutes' => $qFor($minutes, (int) ($m['quotaJd'] ?? $d)),
            'saidMinutes' => $saidMinutes,
            'met' => $reported && $q > 0 && $said >= $q,
            'reported' => $reported,
            'isCurrent' => $d === $current,
            'reportOpen' => $d === $current ? $reportOpen : false,
        ];
    }

    // Holiday training missions: quota = this soldier's SM-Tishrei quota, said =
    // MAX(done_qty) across the holiday's day(s) so Rosh Hashana's two days count
    // once. Only holidays that have mission data appear (wwtcHolidayDates filters).
    // A rotated school uses the quota cell of its Tishrei position, and only
    // when Tishrei is part of the grade year already under way.
    $quotaJd = (int) (wwtcMonthDatesForYear(wwtcYear())['Tishrei'] ?? 0);
    $holidayYear = wwtcYear();
    if (!wwtcIsDefaultSchoolYear($firstMonth)) {
        $quotaJd = 0;
        foreach ($monthRows as $slot) {
            if (($slot['month'] ?? '') !== 'Tishrei') {
                continue;
            }
            $holidayYear = (int) ($slot['year'] ?? wwtcYear());
            $sheet = wwtcQuotaSheetMonth('Tishrei', $firstMonth);
            $quotaJd = wwtcCampaignJd(wwtcYear(), $sheet);
            if ($quotaJd <= 0) {
                $quotaJd = wwtcCampaignJd(wwtcYear() - 1, $sheet);
            }
            break;
        }
    }
    if ($quotaJd > 0) {
        foreach (wwtcHolidayDates($holidayYear) as $name => $jds) {
            [$said, $reported] = wwtcKidHolidayDone($kid, $jds, $kapitel);
            [$saidMinutes] = wwtcKidHolidayDone($kid, $jds, $minutes);
            $q = $qFor($kapitel, $quotaJd);
            $byDate[(int) $jds[0]] = [
                'month' => $name,
                'quota' => $q,
                'said' => $said,
                'minutes' => $qFor($minutes, $quotaJd),
                'saidMinutes' => $saidMinutes,
                'met' => $reported && $q > 0 && $said >= $q,
                'reported' => $reported,
                'isCurrent' => false,
                'reportOpen' => false,
                'holiday' => true,
            ];
        }
    }

    ksort($byDate);
    // Custom ladder replaces the ladder quota. A one-month override then
    // replaces that month's kapitel quota. A rotated school year can include
    // last Hebrew year's months, so those keep last year's override.
    $months = array_values($byDate);
    if (function_exists('wwtcApplyCustomLadderToKidMonths')) {
        $months = wwtcApplyCustomLadderToKidMonths($kid, $months);
    }
    $overrideByMonth = wwtcActiveOverridesForUserYear((int) $kid['user_id'], wwtcYear());
    if (!wwtcIsDefaultSchoolYear($firstMonth)) {
        $priorOverrides = wwtcActiveOverridesForUserYear((int) $kid['user_id'], wwtcYear() - 1);
        $picked = [];
        foreach ($monthRows as $slot) {
            $name = (string) ($slot['month'] ?? '');
            $slotYear = (int) ($slot['year'] ?? wwtcYear());
            $src = $slotYear === wwtcYear() ? $overrideByMonth : $priorOverrides;
            if ($name !== '' && isset($src[$name])) {
                $picked[$name] = $src[$name];
            }
        }
        $overrideByMonth = $picked;
    }
    return wwtcOverlayKidMonthList($months, $overrideByMonth);
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
    return (int) $stmt->fetchColumn() + wwtcUnmarkedOverrideCount($userId);
}

/** SPA grade key ('pre1a', '1'..'12') → number for math; -1 if unknown. */
function wwtcGradeNum(string $grade): int
{
    $g = strtolower(trim($grade));
    if ($g === '') {
        return -1;
    }
    return strpos($g, 'pre') === 0 ? 0 : (int) $g;
}

/**
 * Which missions the soldier actually earned, across every grade of the journey,
 * keyed by SPA grade and occasion so the training board checks the real cells
 * (not just this year). Source is date_tasks_mission_marks — the same marks the
 * medal board counts — joined to the mission so we also know the ladder the child
 * was on at that time (track_id → ladder = 15 − track_id). Each mark's mark_date
 * is a Shabbos-Mevorchim jd, which maps to a campaign year (grades advance one per
 * year, so grade G sat in year currentYear − (currentGrade − G)) and an occasion.
 * The cell value is the ladder number then, or true when the track is unknown.
 * Shape: ['3' => ['Tishrei' => 7, ...], 'pre1a' => [...], ...].
 */
function wwtcKidMissionHistoryByGrade(array $kid): array
{
    global $MASHPIA_DB;
    $currentGrade = wwtcGradeNum((string) ($kid['class_grade'] ?? ''));
    if ($currentGrade < 0) {
        return [];
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT mm.mark_date, m.track_id
           FROM date_tasks_mission_marks mm
           JOIN date_tasks_missions m ON m.date_tasks_mission_id = mm.date_tasks_mission_id
          WHERE mm.user_id = :uid AND mm.subject_id = ' . WWTC_SUBJECT_ID
    );
    $stmt->execute([':uid' => (int) $kid['user_id']]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        return [];
    }
    // Build jd → [gradeKey, occasion] for every grade the board shows (pre1a..current).
    $currentYear = wwtcYear();
    $firstMonth = function_exists('wwtcSchoolFirstMonth')
        ? wwtcSchoolFirstMonth((int) ($kid['school_id'] ?? 0))
        : 'Tishrei';
    $jdMap = [];
    // A rotated school year is not one Hebrew year. Map each grade onto the
    // school year that started (current start − how many grades back).
    if (!wwtcIsDefaultSchoolYear($firstMonth) && function_exists('wwtcSchoolYearHistoryMap')) {
        $currentMonth = wwtcMonthForDate(wwtcCurrentDate());
        $jdMap = wwtcSchoolYearHistoryMap(
            $firstMonth,
            $currentGrade,
            $currentYear,
            $currentMonth !== '' ? $currentMonth : 'Tishrei'
        );
    }
    for ($gn = 0; $gn <= $currentGrade && wwtcIsDefaultSchoolYear($firstMonth); $gn++) {
        $year = $currentYear - ($currentGrade - $gn);
        $gradeKey = $gn === 0 ? 'pre1a' : (string) $gn;
        foreach (wwtcMonthDatesForYear($year) as $month => $jd) {
            // Adar I and Adar II stay distinct so a leap year's two marks do not
            // overwrite each other. A plain year still keys its one month "Adar".
            $jdMap[(int) $jd] = [$gradeKey, wwtcHistoryOccasion($month)];
        }
        foreach (wwtcHolidayDates($year) as $name => $jds) {
            foreach ($jds as $hjd) {
                $jdMap[(int) $hjd] = [$gradeKey, $name];
            }
        }
    }
    $out = [];
    foreach ($rows as $r) {
        $jd = (int) $r['mark_date'];
        if (!isset($jdMap[$jd])) {
            continue; // a mark outside the shown grade span (e.g. before pre1a)
        }
        [$gradeKey, $occ] = $jdMap[$jd];
        $ladder = wwtcLadderFromTrack($r['track_id']);
        $out[$gradeKey][$occ] = $ladder ?: true;
    }
    return $out;
}

/**
 * The signed-in soldier's progress payload (GET /me/progress, and the fresh
 * state POST /me/report returns). medal stays null — medal logic is client-side.
 */
function wwtcKidProgress(array $kid): array
{
    global $MASHPIA_DB;
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
    if (function_exists('wwtcUnmarkedCustomLadderMissions')) {
        $missionsTotal += wwtcUnmarkedCustomLadderMissions((int) $kid['user_id'], $months, wwtcYear());
    }
    // Prefer lifetime − this-year SM months; never go negative if marks include
    // RH/YK or other occasions beyond the elapsed-month list.
    $priorMissions = max(0, $missionsTotal - $metThisYear);
    $out = array_merge(wwtcSafeKid($kid), [
        'yearStart' => function_exists('wwtcSchoolFirstMonth')
            ? wwtcSchoolFirstMonth((int) ($kid['school_id'] ?? 0))
            : 'Tishrei',
        'months' => $months,
        'metThisYear' => $metThisYear,
        'missionsTotal' => $missionsTotal,
        'priorMissions' => $priorMissions,
        'missionHistory' => wwtcKidMissionHistoryByGrade($kid),
        'medal' => null,
        // Tzivos Hashem rank (all campaigns), not a label from Tehillim medals.
        'rank' => wwtcCurrentRank($MASHPIA_DB, (int) $kid['user_id']),
        'current' => $current,
    ]);
    if (function_exists('wwtcActiveCustomLadderForUser')) {
        $custom = wwtcPublicCustomLadder(wwtcActiveCustomLadderForUser((int) $kid['user_id']));
        if ($custom) {
            $out['customLadder'] = $custom;
        }
    }
    // An open flag is waiting for review and is not part of the counted mark.
    $openFlag = wwtcOpenFlag((int) $kid['user_id'], (int) wwtcCurrentDate());
    if ($openFlag) {
        $out['flagged'] = $openFlag;
    }
    return $out;
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

/**
 * Parent site → SPA handoff, step one. The parent site holds the family's
 * mobile session, not the child's serial and date of birth, and asks for a
 * code that signs one of its own children in.
 *
 * The parent token arrives in the body rather than as a cookie on purpose:
 * the app's webview does not reliably carry cookies into a fresh page load.
 */
if ($method === 'POST' && $path === '/parent/handoff') {
    wwtcRateLimit('parent-handoff', 60, 900);
    $input = wwtcInput();
    $parentToken = trim((string) ($input['parent'] ?? ''));
    $childId = (string) ($input['child'] ?? '');
    if ($parentToken === '' || !preg_match('/^\d+$/', $childId)) {
        wwtcError('A parent session and a child are required.', 422);
    }
    $adminId = wwtcParentAdminId($parentToken);
    if (!wwtcParentOwnsChild($adminId, (int) $childId)) {
        wwtcError('That child is not on this parent account.', 404);
    }
    $kid = wwtcKidByUserId((int) $childId);
    if (!$kid) {
        wwtcError('That child is not registered for Tehillim.', 404);
    }
    wwtcJson([
        'code' => wwtcIssueHandoffCode((int) $kid['user_id']),
        'expiresIn' => WWTC_HANDOFF_TTL,
    ]);
}

/**
 * Parent site → SPA handoff, step two. The SPA trades the code from its URL
 * for the same kid session POST /soldier/login issues.
 */
if ($method === 'POST' && $path === '/soldier/handoff') {
    wwtcRateLimit('kid-handoff', 30, 900);
    $input = wwtcInput();
    $code = trim((string) ($input['code'] ?? ''));
    $payload = $code !== '' ? wwtcVerifySignedPayload($code) : null;
    if (!$payload || ($payload['type'] ?? '') !== 'handoff') {
        wwtcError('This sign-in link has expired. Please tap the button again.', 401);
    }
    $kid = wwtcKidByUserId((int) $payload['id']);
    if (!$kid) {
        wwtcError('That child is not registered for Tehillim.', 404);
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
    $span = 4;
    $years = [];
    for ($i = 0; $i < $span; $i++) {
        $years[] = wwtcYear() - $i;
    }
    $asked = isset($_GET['year']) && $_GET['year'] !== '' ? (int) $_GET['year'] : wwtcYear();
    if ($asked !== wwtcYear()) {
        $dates = wwtcMonthDatesForYear($asked);
        wwtcJson([
            'year' => $asked,
            'currentMonth' => null,
            'months' => array_keys($dates),
            'monthDates' => $dates,
            'years' => $years,
            'holidayMonths' => array_keys(wwtcHolidayDates($asked)),
        ]);
    }
    $current = wwtcCurrentDate();
    $elapsed = wwtcElapsedMonths();
    wwtcJson([
        'year' => wwtcYear(),
        'currentMonth' => wwtcMonthForDate($current),
        'currentMonthIndex' => max(0, count($elapsed) - 1),
        'months' => array_column($elapsed, 'month'),
        'monthDates' => wwtcMonthDates(),
        'years' => $years,
        'holidayMonths' => array_keys(wwtcHolidayDates(wwtcYear())),
    ]);
}

// ---- nationwide stats ------------------------------------------------------

if ($method === 'GET' && $path === '/stats') {
    $year = wwtcYear();
    $period = null;
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            $a = $board['army'];
            wwtcJson([
                'monthLabel' => $period['month'],
                'year' => (int) $period['year'],
                'holiday' => true,
                'accomplished' => $a['accomplished'],
                'quota' => $a['quota'],
                'pct' => wwtcPct($a['accomplished'], $a['quota']),
                'minutes' => $a['minutes'],
                'minutesQuota' => $a['minutesQuota'],
                'minutesPct' => wwtcPct($a['minutes'], $a['minutesQuota']),
                'soldiers' => $a['soldiers'],
                'metSoldiers' => $a['metSoldiers'],
                'participatedSoldiers' => $a['participatedSoldiers'],
                'pctSoldiersParticipated' => $a['soldiers'] > 0 ? (int) round($a['participatedSoldiers'] / $a['soldiers'] * 100) : 0,
                'pctSoldiersMet' => $a['soldiers'] > 0 ? (int) round($a['metSoldiers'] / $a['soldiers'] * 100) : 0,
                'schools' => $a['schools'],
                'classes' => $a['classes'],
                'perfectPlatoons' => $a['perfectPlatoons'],
            ]);
        }
        $current = (int) $period['jd'];
        $year = (int) $period['year'];
    } else {
        $current = wwtcCurrentDate();
    }
    $agg = wwtcArmyAggregates($current, $year);
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

    // Soldiers who completed stay on the mission-mark signal (the home race),
    // with quota overrides folded in. The perfect-platoon count is the shared
    // kapitlach list, so the stat and the Perfect Platoons section cannot disagree.
    $counts = wwtcCompletionCounts($current, $year);
    $metSoldiers = (int) array_sum($counts['metBySchool']);
    $participatedSoldiers = (int) array_sum(wwtcParticipatedBySchool($current));
    $perfectPlatoons = count(wwtcPerfectPlatoonRows($current, $year));

    wwtcJson([
        'monthLabel' => wwtcMonthForDate($current) ?: (is_array($period) ? (string) $period['month'] : ''),
        'year' => $year,
        'accomplished' => $done,
        'quota' => $quota,
        'pct' => wwtcPct($done, $quota),
        'minutes' => $minutes,
        'minutesQuota' => $minutesQuota,
        'minutesPct' => wwtcPct($minutes, $minutesQuota),
        'soldiers' => $soldiers,
        'metSoldiers' => $metSoldiers,
        'participatedSoldiers' => $participatedSoldiers,
        'pctSoldiersParticipated' => $soldiers > 0 ? (int) round($participatedSoldiers / $soldiers * 100) : 0,
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

// One row per Jewish year (all-time) and one row per elapsed month (this year).
// Kapitlach and minutes. Cheshvan 5778 is the first Shabbos Mevorchim. A leap
// year keeps Adar I and Adar II as two rows. Same month sources as /running-totals.
if ($method === 'GET' && $path === '/running-totals/breakdown') {
    $current = wwtcCurrentDate();
    wwtcJson(wwtcCached('running_breakdown.' . wwtcYear() . '.' . $current, static function () {
        return wwtcRunningBreakdown();
    }));
}

// ---- nationwide school list ------------------------------------------------

if ($method === 'GET' && $path === '/schools') {
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'holiday' => true, 'schools' => wwtcHolidaySchools($board)]);
        }
        $rows = wwtcNationwideSchools((int) $period['jd'], (int) $period['year']);
        wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'schools' => $rows]);
    }
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
        wwtcCompletionCounts($current),
        (int) (wwtcParticipatedBySchool($current)[$id] ?? 0)
    );
    $data = wwtcSchoolData($id);
    // This month's school dedication (set by HQ or that school's admin via
    // PUT /dedication). Returns null when nothing is set or the table is not
    // installed, so the campaign page simply shows no dedication line.
    $dedication = wwtcDedicationRead('school', wwtcYear(), wwtcMonthForDate($current), $id);
    wwtcJson($row + [
        'classes' => array_map('wwtcPresentClassLabel', $data['classes']),
        'dedication' => $dedication,
        'yearStart' => function_exists('wwtcSchoolFirstMonth') ? wwtcSchoolFirstMonth($id) : 'Tishrei',
        'hiddenLadders' => function_exists('wwtcHiddenLaddersForSchool') ? wwtcHiddenLaddersForSchool($id) : [],
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
    wwtcJson(['schoolId' => $id, 'classes' => array_map('wwtcPresentClassLabel', $classes)]);
}

if ($method === 'GET' && preg_match('#^/schools/(\d+)/leaderboard$#', $path, $m)) {
    // Public: the SPA shows a school's Top Soldiers with full names (signed off).
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    // The board pages ten at a time and ranks ties across the whole school.
    // A SQL LIMIT of 10 kept an arbitrary slice of a tie (everyone on 150
    // looked like places 1–10). ?n= still slices, but only after the name sort.
    $cap = 2000;
    $limit = $cap;
    if (isset($_GET['n']) && $_GET['n'] !== '') {
        $limit = max(1, min($cap, (int) $_GET['n']));
    }
    $date = wwtcCurrentDate();
    // This month only. A year total made a chayol look like they said hundreds
    // of kapitlach in the month on the board.
    $stmt = $MASHPIA_DB->prepare(
        'SELECT u.user_id, u.first, u.last, c.class_grade, MAX(dtm.done_qty) said
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
           JOIN users u ON u.user_id = dtm.user_id
           JOIN classes c ON c.class_id = u.class_id
          WHERE u.school_id = :id AND dt.grid_id = ' . WWTC_GRID_KAPITELACH . '
            AND dtmm.subject_id = ' . WWTC_SUBJECT_ID . ' AND dtmm.start_date = :d
          GROUP BY u.user_id
          ORDER BY said DESC, u.last ASC, u.first ASC, u.user_id ASC
          LIMIT ' . $cap
    );
    $stmt->execute([':id' => $id, ':d' => $date]);
    $rows = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $rows[] = [
            'id' => (int) $r['user_id'],
            'name' => trim($r['first'] . ' ' . $r['last']),
            'grade' => (string) $r['class_grade'],
            'saidMonth' => (int) $r['said'],
        ];
    }
    wwtcJson(['schoolId' => $id, 'soldiers' => wwtcOrderSoldiers($rows, $limit)]);
}

// ---- perfect platoons (nationwide) -----------------------------------------

if ($method === 'GET' && $path === '/perfect-platoons') {
    // Same rule as the school classes view (wwtcClassIsPerfect): every soldier
    // said at least their own kapitlach quota. One row per class id. The number
    // after the slash on the home card is schoolClasses — classes on this
    // roster, not a rank and not a page size.
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'holiday' => true, 'platoons' => array_map('wwtcPresentClassLabel', wwtcHolidayPlatoons($board))]);
        }
        $current = (int) $period['jd'];
        $platoonYear = (int) $period['year'];
    } else {
        $current = wwtcCurrentDate();
        $platoonYear = wwtcYear();
    }
    wwtcJson(['month' => wwtcMonthForDate($current), 'year' => $platoonYear, 'platoons' => array_map('wwtcPresentClassLabel', wwtcPerfectPlatoonRows($current, $platoonYear))]);
}

// ---- reports ----------------------------------------------------------------

if ($method === 'GET' && $path === '/reports/army') {
    // The army accomplishment report (generateArmyAccomplishedReport): one row
    // per school, Goal / Accomplished, from setASR() — identical to
    // shabbos_mevorchim_summary.php — plus registered + % met (mission marks).
    $reportYear = wwtcYear();
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'holiday' => true, 'rows' => wwtcHolidayArmyRows($board)]);
        }
        $date = (int) $period['jd'];
        $reportYear = (int) $period['year'];
    } else {
        $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
    }
    $agg = wwtcArmyAggregates($date, $reportYear);
    $names = $agg['schools'];
    $goal = $agg['kapGoal'];
    $done = $agg['kapDone'];
    $counts = wwtcCompletionCounts($date, $reportYear);

    $participated = wwtcParticipatedBySchool($date);
    $minGoal = $agg['minGoal'];
    $minDone = $agg['minDone'];

    $logos = wwtcSchoolLogos();
    $rows = [];
    foreach ($names as $id => $name) {
        $id = (int) $id;
        $g = (int) ($goal[$id] ?? 0);
        $d = (int) ($done[$id] ?? 0);
        $registered = (int) ($counts['sizeBySchool'][$id] ?? 0);
        $met = (int) ($counts['metBySchool'][$id] ?? 0);
        $part = (int) ($participated[$id] ?? 0);
        $mg = (int) ($minGoal[$id] ?? 0);
        $md = (int) ($minDone[$id] ?? 0);
        $rows[] = [
            'id' => $id,
            'name' => (string) $name,
            'logo' => $logos[$id] ?? null,
            'registered' => $registered,
            'goal' => $g,
            'accomplished' => $d,
            'pct' => wwtcPct($d, $g),
            'minutes' => $md,
            'minutesGoal' => $mg,
            'minutesPct' => wwtcPct($md, $mg),
            'participated' => $part,
            'met' => $met,
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
    $reportYear = wwtcYear();
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            $classes = wwtcHolidaySchoolData($board, $id)['classes'];
            $monthLabel = $period['month'];
        } else {
            $classes = wwtcSchoolData($id, (int) $period['jd'], (int) $period['year'])['classes'];
            $monthLabel = wwtcMonthForDate((int) $period['jd']);
        }
    } else {
        $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
        $classes = wwtcSchoolData($id, $date, $reportYear)['classes'];
        $monthLabel = wwtcMonthForDate($date);
    }
    $rows = [];
    foreach ($classes as $c) {
        $rows[] = [
            'id' => $c['id'],
            'name' => wwtcFormatClassName((string) $c['name']),
            'grade' => $c['grade'],
            'teacher' => $c['teacher'],
            'size' => $c['size'],
            'goal' => $c['quota'],
            'accomplished' => $c['said'],
            'completed' => $c['met'],
            'perfect' => $c['perfect'],
        ];
    }
    wwtcJson(['month' => $monthLabel, 'school' => $names[$id], 'schoolId' => $id, 'rows' => wwtcSortClasses($rows)]);
}

/**
 * Staff bearer on the platoon route, or null. A missing token, a soldier
 * token, or a bad token stays null — the class summary is still public, so
 * this must not 401.
 */
function wwtcOptionalStaffActor(): ?array
{
    $token = wwtcBearerToken();
    if (!$token) {
        return null;
    }
    $payload = wwtcVerifySignedPayload($token);
    if (!$payload || empty($payload['type'])) {
        return null;
    }
    if ($payload['type'] !== 'admin' && $payload['type'] !== 'teacher') {
        return null;
    }
    return $payload;
}

/** @return int[] */
function wwtcAdminAuthIds(int $adminId, string $auth): array
{
    global $MASHPIA_DB;
    if ($adminId <= 0 || !isset($MASHPIA_DB)) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT id FROM admin_auths WHERE admin_id = :id AND auth = :auth'
        );
        $stmt->execute([':id' => $adminId, ':auth' => $auth]);
        $ids = [];
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
            $ids[] = (int) $id;
        }
        return $ids;
    } catch (Exception $e) {
        error_log('WWTC platoon roll auth lookup failed: ' . $e->getMessage());
        return [];
    }
}

function wwtcPlatoonRollAllowed(int $classId, int $schoolId): bool
{
    $actor = wwtcOptionalStaffActor();
    if (!$actor) {
        return false;
    }
    $schoolIds = [];
    $classIds = [];
    if (($actor['type'] ?? '') === 'admin' && ($actor['auth'] ?? '') !== 'super') {
        $schoolIds = wwtcAdminAuthIds((int) $actor['id'], 'school');
        $classIds = wwtcAdminAuthIds((int) $actor['id'], WWTC_CLASS_AUTH);
    }
    return wwtcCanSeePlatoonRoll($actor, $classId, $schoolId, $schoolIds, $classIds);
}

if ($method === 'GET' && preg_match('#^/reports/platoon/(\d+)$#', $path, $m)) {
    // Class summary is public. The student roll is not — wwtcPlatoonResponse
    // omits names and amounts unless wwtcPlatoonRollAllowed says this caller
    // is HQ, this school's admin, or this class's teacher.
    $classId = (int) $m[1];
    $schoolId = (int) ($MASHPIA_DB->query('SELECT school_id FROM classes WHERE class_id = ' . $classId)->fetchColumn() ?: 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('Class not found.', 404);
    }
    $reportYear = wwtcYear();
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            $data = wwtcHolidaySchoolData($board, $schoolId);
            $monthLabel = $period['month'];
        } else {
            $data = wwtcSchoolData($schoolId, (int) $period['jd'], (int) $period['year']);
            $monthLabel = wwtcMonthForDate((int) $period['jd']);
        }
    } else {
        $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
        $data = wwtcSchoolData($schoolId, $date, $reportYear);
        $monthLabel = wwtcMonthForDate($date);
    }
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
            'originalGoal' => (int) ($s['originalQuota'] ?? $s['quota']),
            // No Hebrew kapitel label server-side; the numeric goal stands in for
            // goalLabel (the SPA renders it where it shows the demo's Hebrew range).
            'goalLabel' => (string) $s['quota'],
            'said' => $s['said'],
            'met' => $s['met'],
            'quotaAdjusted' => !empty($s['quotaAdjusted']),
        ];
    }
    $classRow = null;
    foreach ($data['classes'] as $c) {
        if ((int) $c['id'] === $classId) {
            $classRow = $c;
            break;
        }
    }
    if ($classRow) {
        if ((string) ($classRow['name'] ?? '') !== '') {
            $className = (string) $classRow['name'];
        }
        $completed = (int) ($classRow['met'] ?? 0);
        $size = (int) ($classRow['size'] ?? 0);
        $perfect = !empty($classRow['perfect']);
    } else {
        $size = count($rows);
        $perfect = wwtcClassIsPerfect($completed, $size);
    }
    $summary = [
        'month' => $monthLabel,
        'school' => wwtcEligibleSchools()[$schoolId] ?? null,
        'schoolId' => $schoolId,
        'className' => wwtcFormatClassName($className),
        'completed' => $completed,
        'size' => $size,
        'perfect' => $perfect,
    ];
    wwtcJson(wwtcPlatoonResponse($summary, $rows, wwtcPlatoonRollAllowed($classId, $schoolId)));
}

// Who hasn't completed this month, per class (drives the teacher deadline list).
if ($method === 'GET' && preg_match('#^/schools/(\d+)/not-completed$#', $path, $m)) {
    wwtcRequireActor(['admin']); // per-child names — admin only
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    $data = wwtcSchoolData($id, wwtcDateForMonthIdx($_GET['monthIdx'] ?? null));
    wwtcJson([
        'schoolId' => $id,
        'classes' => wwtcNotCompletedClasses($data['students'] ?? [], $data['classes'] ?? []),
    ]);
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
    $classRank = wwtcCompetitionRank($classes, $myClassId, static function ($row) {
        return (int) $row['id'];
    }, ['pctMet', 'met']);
    $className = ''; $classSize = 0; $aheadName = null;
    foreach ($classes as $i => $c) {
        if ($c['id'] === $myClassId) {
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
    $myRank = wwtcCompetitionRank($mates, (int) $kid['user_id'], static function ($row) {
        return (int) $row['id'];
    }, ['said']);
    $schoolmates = $data['students'];
    usort($schoolmates, static function ($a, $b) {
        return $b['said'] <=> $a['said'];
    });
    $myRankInSchool = wwtcCompetitionRank($schoolmates, (int) $kid['user_id'], static function ($row) {
        return (int) $row['id'];
    }, ['said']);
    $classPerfect = false;
    foreach ($data['classes'] as $c) {
        if ($c['id'] === $myClassId) {
            $classPerfect = !empty($c['perfect']);
            break;
        }
    }

    // School standing nationwide — same Race order as Home (% soldiers met first).
    // Previously ranked by raw kapitlach said, which disagreed with the main page.
    $ranked = wwtcNationwideSchools();
    $schoolRank = wwtcCompetitionRank($ranked, $schoolId, static function ($row) {
        return (int) $row['id'];
    }, ['pctMet', 'saidMonth', 'pct', 'minutesPct']);

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
        'className' => wwtcFormatClassName($className),
        'classRank' => $classRank,
        'totalClasses' => count($classes),
        'classAheadName' => $aheadName === null ? null : wwtcFormatClassName($aheadName),
        'needToPass' => $needToPass,
        'myRankInClass' => $myRank,
        'classSize' => $classSize,
        'myRankInSchool' => $myRankInSchool,
        'schoolSize' => count($schoolmates),
        'classPerfect' => $classPerfect,
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
- Stay strictly on those topics: the Worldwide Tehillim Club, Tehillim, Tzivos Hashem, this website, this child's ladder, quota, progress, medals, and encouragement about those. If the child says anything that is not connected, do not answer it at all. Do not explain it, play along, or give a hint. Say only: "I can only help with the Tehillim Club. What would you like to know about your Tehillim?"
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

if ($method === 'POST' && ($path === '/realtime-session' || $path === '/realtime-session.php')) {
    require_once __DIR__ . '/realtime-session.php';
    wwtcHandleRealtimeSession();
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

    // Self-reporting closes one week after Shabbos Mevorchim (WWTC_REPORT_GRACE_DAYS).
    // After that the month is locked to the soldier; a teacher can still backfill it
    // with mark_tehillim2.php.
    if (!wwtcReportWindowOpen()) {
        $month = wwtcMonthForDate($date);
        wwtcError(
            'The time to enter your Tehillim' . ($month !== '' ? ' for ' . $month : '')
            . ' has closed — it was due a week after Shabbos Mevorchim. Ask your teacher to add it for you.',
            409
        );
    }

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
    // The grade line is enforced here, not in the browser. A direct call with
    // no flagConfirmed is refused. flagConfirmed saves a FLAGGED row and, unless
    // the config says flagged amounts count, does not write the counting mark.
    $quotaKap = isset($tasksByGrid[WWTC_GRID_KAPITELACH]) ? (int) $tasksByGrid[WWTC_GRID_KAPITELACH]['quantity'] : 0;
    $quotaMin = isset($tasksByGrid[WWTC_GRID_MINUTES]) ? (int) $tasksByGrid[WWTC_GRID_MINUTES]['quantity'] : 0;
    $prior = wwtcPriorMark($MASHPIA_DB, $userId, (int) $date);
    $effectiveKap = $hasKap ? $kapitlach : $prior['kapitlach'];
    $effectiveMin = $hasMin ? $minutes : $prior['minutes'];
    $plan = wwtcPlanReport(
        $effectiveKap,
        $effectiveMin,
        $quotaKap,
        $quotaMin,
        (string) ($kid['class_grade'] ?? ''),
        !empty($input['flagConfirmed'])
    );
    if ($plan['action'] === 'confirm') {
        $overCfg = wwtcOverEntryConfig();
        wwtcError((string) $overCfg['confirm'], 409, [
            'code' => 'over_entry',
            'threshold' => [
                'kapitlach' => $plan['line']['kapitlach'],
                'minutes' => $plan['line']['minutes'],
            ],
            'reasons' => $plan['reasons'],
        ]);
    }
    if ($plan['action'] === 'flag' && !$plan['writeMark'] && !wwtcFlagsReady()) {
        wwtcError('Flag review is not installed yet. Run api/sql/wwtc_flagged_entries.sql on mashpia.', 503);
    }

    $kidActor = [
        'type' => 'kid',
        'id' => $userId,
        'name' => trim(($kid['first'] ?? '') . ' ' . ($kid['last'] ?? '')),
    ];
    try {
        $MASHPIA_DB->beginTransaction();
        if ($plan['action'] === 'flag') {
            wwtcSaveFlaggedEntry($MASHPIA_DB, [
                'user_id' => $userId,
                'school_id' => (int) ($kid['school_id'] ?? 0),
                'class_id' => (int) ($kid['class_id'] ?? 0),
                'mark_date' => (int) $date,
                'campaign_year' => wwtcYear(),
                'month_name' => wwtcMonthForDate((int) $date),
                'grade' => $plan['line']['grade'],
                'school_name' => (string) ($kid['school_name'] ?? ''),
                'class_name' => trim((string) ($kid['class_grade'] ?? '') . (string) ($kid['class_sub'] ?? '')),
                'kid_name' => $kidActor['name'],
                'kapitlach' => $plan['kapitlach'],
                'minutes' => $plan['minutes'],
                'quota_kapitlach' => $quotaKap,
                'quota_minutes' => $quotaMin,
                'threshold_kapitlach' => (int) round((float) $plan['line']['kapitlach']),
                'threshold_minutes' => (int) round((float) $plan['line']['minutes']),
                'reasons' => $plan['reasons'],
                'prior_kapitlach' => $prior['kapitlach'],
                'prior_minutes' => $prior['minutes'],
                'prior_reported' => !empty($prior['reported']),
            ], $kidActor);
            if ($plan['writeMark']) {
                if (isset($tasksByGrid[WWTC_GRID_KAPITELACH])) {
                    wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_KAPITELACH], $plan['kapitlach'], true);
                }
                if (isset($tasksByGrid[WWTC_GRID_MINUTES])) {
                    wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_MINUTES], $plan['minutes'], false);
                }
            }
        } else {
            wwtcSupersedeOpenFlag($MASHPIA_DB, $userId, (int) $date, $kidActor);
            if ($hasKap && isset($tasksByGrid[WWTC_GRID_KAPITELACH])) {
                wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_KAPITELACH], $kapitlach, true);
            }
            if ($hasMin && isset($tasksByGrid[WWTC_GRID_MINUTES])) {
                wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_MINUTES], $minutes, false);
            }
        }
        $MASHPIA_DB->commit();
    } catch (\Throwable $e) {
        if ($MASHPIA_DB->inTransaction()) {
            $MASHPIA_DB->rollBack();
        }
        error_log('WWTC /me/report failed for user ' . $userId . ': ' . $e->getMessage());
        wwtcError('Could not save your report. Please try again.', 500);
    }

    // Counting marks feed the cached reports. A withheld flag does not.
    if ($plan['writeMark'] && class_exists('Cache')) {
        Cache::bumpVersion('shabbos_mevorchim:v');
    }

    $progress = wwtcKidProgress(wwtcKidByUserId($userId) ?: $kid);
    $exceptional = null;
    // The grade-line flag replaces the mashpia email. Inside the line, a
    // confirmed exceptional report still sends that note and still counts.
    if ($plan['action'] === 'save' && !empty($input['exceptionalConfirmed'])) {
        $progressQuotaKap = (int) ($progress['current']['quota'] ?? $quotaKap);
        $progressQuotaMin = (int) ($progress['current']['minutes'] ?? $quotaMin);
        $kapHigh = $progressQuotaKap > 0 && $kapitlach >= $progressQuotaKap * 3;
        $minHigh = $minutes >= 180 && ($progressQuotaMin <= 0 || $minutes > $progressQuotaMin);
        if ($kapHigh || $minHigh) {
            $exceptional = wwtcEmailExceptional($kid, $kapitlach, $minutes, $progressQuotaKap, $progressQuotaMin);
        }
    }
    if ($exceptional) {
        $progress['exceptional'] = $exceptional;
    }
    wwtcJson($progress);
}

function wwtcEmailExceptional(array $kid, int $kapitlach, int $minutes, int $quotaKap, int $quotaMin): array
{
    $to = function_exists('wwtcEnv') ? trim(wwtcEnv('WWTC_MASHPIA_EMAIL')) : '';
    $name = trim(($kid['first'] ?? '') . ' ' . ($kid['last'] ?? ''));
    $school = (string) ($kid['school_name'] ?? '');
    $body = "A chayol confirmed an unusually large Tehillim report.\n\n"
        . "Soldier: {$name}\nSchool: {$school}\n"
        . "Kapitlach entered: {$kapitlach} (quota {$quotaKap})\n"
        . "Minutes entered: {$minutes} (quota {$quotaMin})\n\n"
        . "The chayol said this is 100% correct. Please confirm with them.\n"
        . "If it is correct, celebrate. If not, the parents speak with the child and the entry is corrected in the system.\n"
        . "This note does not reject the report. The numbers are already saved.";
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        error_log('WWTC exceptional report (no WWTC_MASHPIA_EMAIL): ' . str_replace("\n", ' | ', $body));
        return ['emailed' => false, 'reason' => 'WWTC_MASHPIA_EMAIL is not set'];
    }
    $ok = @mail($to, 'Tehillim report to confirm', $body, 'Content-Type: text/plain; charset=UTF-8');
    if (!$ok) {
        error_log('WWTC exceptional report mail() failed for ' . $to);
        return ['emailed' => false, 'reason' => 'mail failed'];
    }
    return ['emailed' => true, 'reason' => null];
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
    // A ladder change is always allowed; it takes effect from the NEXT Shabbos
    // Mevorchim (a change after this month's SM date is read as-of the next month —
    // wwtcTrackAsOf), so the current month's quota is never disturbed by it.

    $input = wwtcInput();
    $ladder = (int) ($input['ladder'] ?? 0);
    // Any ladder 5..12 is selectable regardless of grade (tracks 3..10 all exist).
    if ($ladder < 5 || $ladder > 12) {
        wwtcError("Choose a ladder between 5 and 12.", 422);
    }
    $schoolHidden = function_exists('wwtcHiddenLaddersForSchool')
        ? wwtcHiddenLaddersForSchool((int) ($kid['school_id'] ?? 0))
        : [];
    if ($schoolHidden && function_exists('wwtcLadderIsHidden') && wwtcLadderIsHidden($ladder, $schoolHidden)) {
        wwtcError('That ladder is turned off for your school.', 422);
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

/**
 * Admin sets a ladder for a whole school, one class, or one soldier. HQ may set
 * any school; a school admin only their own school; a class teacher only their
 * own class (authority is the same staff rule as the platoon roll). Writes
 * user_tracks.track_id for every registered soldier with a Tehillim track in the
 * chosen scope — the same column /me/ladder writes for one kid, and like the
 * mobile changeLevel.php it does not require ut.enrolled = 1.
 */
if (($method === 'PUT' || $method === 'POST') && $path === '/admin/ladder') {
    $actor = wwtcRequireActor(['admin']);
    $input = wwtcInput();

    $ladder = (int) ($input['ladder'] ?? 0);
    // Any ladder 5..12 is selectable regardless of grade (tracks 3..10 exist).
    if ($ladder < 5 || $ladder > 12) {
        wwtcError('Choose a ladder between 5 and 12.', 422);
    }
    $track = wwtcTrackFromLadder($ladder);

    $schoolId = (int) ($input['schoolId'] ?? 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    $schoolHidden = function_exists('wwtcHiddenLaddersForSchool') ? wwtcHiddenLaddersForSchool($schoolId) : [];
    if ($schoolHidden && function_exists('wwtcLadderIsHidden') && wwtcLadderIsHidden($ladder, $schoolHidden)) {
        wwtcError('That ladder is turned off for this school.', 422);
    }

    $classId = (isset($input['classId']) && $input['classId'] !== '' && $input['classId'] !== null)
        ? (int) $input['classId'] : 0;
    // The child dropdown sends the platoon roll's row id, which is the user_id.
    $kidId = (isset($input['kidId']) && $input['kidId'] !== '' && $input['kidId'] !== null)
        ? (int) $input['kidId'] : 0;

    // A single soldier scope with no class named: find the soldier's class so the
    // authority check below runs against the real class, and confirm the school.
    if ($kidId && !$classId) {
        $who = $MASHPIA_DB->prepare('SELECT class_id, school_id FROM users WHERE user_id = :u LIMIT 1');
        $who->execute([':u' => $kidId]);
        $u = $who->fetch(PDO::FETCH_ASSOC);
        if (!$u || (int) $u['school_id'] !== $schoolId) {
            wwtcError('Soldier not found.', 404);
        }
        $classId = (int) $u['class_id'];
    }

    // Authority: a class/soldier scope needs the platoon-roll staff rule for that
    // class; a whole-school scope needs HQ or that school's admin.
    if ($classId) {
        $classSchool = (int) ($MASHPIA_DB->query('SELECT school_id FROM classes WHERE class_id = ' . $classId)->fetchColumn() ?: 0);
        if ($classSchool !== $schoolId) {
            wwtcError('Class not found.', 404);
        }
        if (!wwtcPlatoonRollAllowed($classId, $schoolId)) {
            wwtcError('You do not have permission to perform this action.', 403);
        }
    } else {
        $schoolIds = (($actor['auth'] ?? '') === 'super') ? [] : wwtcAdminAuthIds((int) $actor['id'], 'school');
        if (!wwtcCanManageSchool($actor, $schoolId, $schoolIds)) {
            wwtcError('You do not have permission to perform this action.', 403);
        }
    }

    // Scope: one soldier, one class, or the whole school. Every registered
    // soldier with a Tehillim track is set, enrolled or not — the mobile
    // changeLevel.php writes track_id for subject_id 1 without an enrolled
    // filter, and the child dropdown already lists only registered soldiers
    // (class.shabbosMevorchim.php filters user_registered > 0). The
    // user_registered guard here is belt-and-suspenders for the class/school
    // scope, which does not come from that list.
    $where = 'ut.subject_id = ' . WWTC_SUBJECT_ID . '
              AND u.user_registered > 0 AND u.school_id = :school';
    $params = [':school' => $schoolId];
    if ($kidId) {
        $where .= ' AND u.user_id = :uid';
        $params[':uid'] = $kidId;
    } elseif ($classId) {
        $where .= ' AND u.class_id = :class';
        $params[':class'] = $classId;
    }

    // Count the soldiers in scope first, so the response is stable even when some
    // are already on this ladder (an UPDATE only reports the rows it changed).
    $countStmt = $MASHPIA_DB->prepare(
        'SELECT COUNT(*) FROM user_tracks ut JOIN users u ON u.user_id = ut.user_id WHERE ' . $where
    );
    $countStmt->execute($params);
    $matched = (int) $countStmt->fetchColumn();

    $upStmt = $MASHPIA_DB->prepare(
        'UPDATE user_tracks ut JOIN users u ON u.user_id = ut.user_id SET ut.track_id = :track WHERE ' . $where
    );
    $upStmt->execute([':track' => $track] + $params);
    $changed = $upStmt->rowCount();

    // Quota (and so missions met) changes with the ladder — refresh the reports.
    if (class_exists('Cache')) {
        Cache::bumpVersion('shabbos_mevorchim:v');
    }

    wwtcJson(['ok' => true, 'matched' => $matched, 'updated' => $changed, 'ladder' => $ladder]);
}

// School year start. The picked month is that school's first Shabbos Mevorchim
// (Mevorchim of the month) and quota position 1. HQ or that school's admin only.
// No student names. Missing table → 503, same as dedications.
if (($method === 'PUT' || $method === 'POST') && $path === '/admin/school-year') {
    $actor = wwtcRequireActor(['admin']);
    $input = wwtcInput();
    $schoolId = (int) ($input['schoolId'] ?? 0);
    $firstMonth = trim((string) ($input['firstMonth'] ?? ''));
    if (!in_array($firstMonth, wwtcPlainMonthNames(), true)) {
        wwtcError('Choose the month the school year starts in.', 422);
    }
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    $schoolIds = (($actor['auth'] ?? '') === 'super') ? [] : wwtcAdminAuthIds((int) $actor['id'], 'school');
    if (!wwtcCanManageSchool($actor, $schoolId, $schoolIds)) {
        wwtcError('You do not have permission to perform this action.', 403);
    }
    if (!wwtcSchoolSettingsReady()) {
        wwtcError('School-year storage is not installed yet. Run api/sql/wwtc_school_settings.sql on mashpia.', 503);
    }
    wwtcSaveSchoolFirstMonth($schoolId, $firstMonth);
    wwtcJson([
        'ok' => true,
        'schoolId' => $schoolId,
        'firstMonth' => $firstMonth,
        'gradeEnds' => wwtcGradeEndMonth($firstMonth),
    ]);
}

// Which ladders this school offers. HQ or that school's admin. Missing table
// is a 503, same as the school-year setting. No student names.
if (($method === 'PUT' || $method === 'POST') && $path === '/admin/school-ladders') {
    $actor = wwtcRequireActor(['admin']);
    $input = wwtcInput();
    $schoolId = (int) ($input['schoolId'] ?? 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    $schoolIds = (($actor['auth'] ?? '') === 'super') ? [] : wwtcAdminAuthIds((int) $actor['id'], 'school');
    if (!wwtcCanManageSchool($actor, $schoolId, $schoolIds)) {
        wwtcError('You do not have permission to perform this action.', 403);
    }
    if (!wwtcSchoolLaddersReady()) {
        wwtcError('Ladder switches are not installed yet. Run api/sql/wwtc_school_ladders.sql on mashpia.', 503);
    }
    $hidden = wwtcNormalizeHiddenLadders($input['hidden'] ?? $input['ladders'] ?? []);
    wwtcSaveHiddenLadders($schoolId, $hidden);
    wwtcJson([
        'ok' => true,
        'schoolId' => $schoolId,
        'hiddenLadders' => $hidden,
        'ladders' => wwtcLadderSwitchList($hidden),
    ]);
}

function wwtcDedicationsReady(): bool
{
    return wwtcColumnExists('wwtc_dedications', 'body');
}

function wwtcDedicationRead(string $scope, int $year, string $month, int $schoolId): ?array
{
    if (!wwtcDedicationsReady()) {
        return null;
    }
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        'SELECT body, campaign_year, month_name FROM wwtc_dedications
          WHERE scope = :s AND campaign_year = :y AND month_name = :m AND school_id = :id
          LIMIT 1'
    );
    $stmt->execute([':s' => $scope, ':y' => $year, ':m' => $month, ':id' => $schoolId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }
    return ['text' => (string) $row['body'], 'year' => (int) $row['campaign_year'], 'month' => (string) $row['month_name']];
}

if ($method === 'GET' && $path === '/dedication') {
    $scope = ($_GET['scope'] ?? 'army') === 'school' ? 'school' : 'army';
    $year = isset($_GET['year']) && $_GET['year'] !== '' ? (int) $_GET['year'] : wwtcYear();
    $month = trim((string) ($_GET['month'] ?? wwtcMonthForDate(wwtcCurrentDate())));
    $schoolId = $scope === 'school' ? (int) ($_GET['schoolId'] ?? 0) : 0;
    $row = wwtcDedicationRead($scope, $year, $month, $schoolId);
    wwtcJson([
        'storage' => wwtcDedicationsReady() ? 'ready' : 'missing',
        'dedication' => $row,
    ]);
}

if (($method === 'PUT' || $method === 'POST') && $path === '/dedication') {
    $actor = wwtcRequireActor(['admin']);
    $in = wwtcInput();
    $scope = ($in['scope'] ?? 'army') === 'school' ? 'school' : 'army';
    $year = isset($in['year']) && $in['year'] !== '' ? (int) $in['year'] : wwtcYear();
    $month = trim((string) ($in['month'] ?? wwtcMonthForDate(wwtcCurrentDate())));
    $text = trim((string) ($in['text'] ?? ''));
    $schoolId = $scope === 'school' ? (int) ($in['schoolId'] ?? 0) : 0;
    if ($scope === 'army' && ($actor['auth'] ?? '') !== 'super') {
        wwtcError('Only HQ can set the army dedication.', 403);
    }
    if ($scope === 'school' && ($actor['auth'] ?? '') !== 'super') {
        $own = $MASHPIA_DB->prepare("SELECT id FROM admin_auths WHERE admin_id = :id AND auth = 'school' AND id = :sid LIMIT 1");
        $own->execute([':id' => (int) $actor['id'], ':sid' => $schoolId]);
        if (!$own->fetchColumn()) {
            wwtcError('That school is not yours.', 403);
        }
    }
    if (!wwtcDedicationsReady()) {
        wwtcError('Dedication storage is not installed yet. Run api/sql/wwtc_dedications.sql on mashpia.', 503);
    }
    if ($text === '') {
        $del = $MASHPIA_DB->prepare(
            'DELETE FROM wwtc_dedications WHERE scope = :s AND campaign_year = :y AND month_name = :m AND school_id = :id'
        );
        $del->execute([':s' => $scope, ':y' => $year, ':m' => $month, ':id' => $schoolId]);
        wwtcJson(['dedication' => null]);
    }
    $save = $MASHPIA_DB->prepare(
        'INSERT INTO wwtc_dedications (scope, school_id, campaign_year, month_name, body, updated_by)
         VALUES (:s, :id, :y, :m, :body, :who)
         ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by)'
    );
    $save->execute([
        ':s' => $scope, ':id' => $schoolId, ':y' => $year, ':m' => $month,
        ':body' => $text, ':who' => (string) ($actor['id'] ?? ''),
    ]);
    wwtcJson(['dedication' => ['text' => $text, 'year' => $year, 'month' => $month]]);
}

if ($method === 'GET' && $path === '/hq/verify') {
    $actor = wwtcRequireActor(['admin']);
    if (($actor['auth'] ?? '') !== 'super') {
        wwtcError('Only HQ can check the army numbers.', 403);
    }
    $year = wwtcYear();
    $current = wwtcCurrentDate();
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if (!$period['holiday']) {
            $current = (int) $period['jd'];
            $year = (int) $period['year'];
        }
    }
    $rows = wwtcNationwideSchools($current, $year);
    $soldiers = 0;
    $met = 0;
    $part = 0;
    $said = 0;
    $quota = 0;
    $minutes = 0;
    $minutesQuota = 0;
    $missing = [];
    foreach ($rows as $row) {
        $soldiers += (int) $row['kids'];
        $met += (int) $row['metMonth'];
        $part += (int) $row['participatedMonth'];
        $said += (int) $row['saidMonth'];
        $quota += (int) $row['quotaMonth'];
        $minutes += (int) $row['minutesSaidMonth'];
        $minutesQuota += (int) $row['minutesQuotaMonth'];
        if (empty($row['logo'])) {
            $missing[] = $row['name'];
        }
    }
    wwtcJson([
        'month' => wwtcMonthForDate($current),
        'year' => $year,
        'home' => [
            'soldiers' => $soldiers,
            'metSoldiers' => $met,
            'participatedSoldiers' => $part,
            'accomplished' => $said,
            'quota' => $quota,
            'pct' => wwtcPct($said, $quota),
            'minutes' => $minutes,
            'minutesQuota' => $minutesQuota,
            'minutesPct' => wwtcPct($minutes, $minutesQuota),
            'pctSoldiersMet' => $soldiers > 0 ? (int) round($met / $soldiers * 100) : 0,
            'schools' => count($rows),
        ],
        'schools' => $rows,
        'missingLogos' => $missing,
        'notes' => [
            'Soldiers are enrolled chayolim on the WWTC roster.',
            'Participated means a kapitlach mark greater than zero this month.',
            'Completed kapitlach quota is the mission mark (done at or above the soldier\'s own quota).',
            'Kapitlach and minutes are the army aggregates from live marks.',
            'When two schools share a percentage, the one with more kapitlach said ranks first.',
            'Schools in missingLogos have no shield file yet. Upload it on mashpia (school logos).',
        ],
    ]);
}

/**
 * The quota and kapitlach the monthly report is showing for this soldier.
 * That figure is the quota the report is using before the override: the custom
 * ladder when the soldier has one, otherwise the engine (Cheshvan included,
 * which the engine reprices from today's ladder). A flagged amount that does
 * not count yet is not the number the override adopts. Null month means it
 * is not on the calendar.
 *
 * @return array{engineQuota:int,said:int,reported:bool}|null
 */
function wwtcOverrideEngineFigures(array $kid, int $year, string $month): ?array
{
    $dates = wwtcMonthDatesForYear($year);
    if (!isset($dates[$month])) {
        return null;
    }
    $jd = (int) $dates[$month];
    $raw = wwtcSchoolDataRaw((int) $kid['school_id'], $jd, $year);
    foreach ($raw['students'] ?? [] as $student) {
        if ((int) $student['id'] !== (int) $kid['user_id']) {
            continue;
        }
        $said = (int) $student['said'];
        if (function_exists('wwtcOpenFlag')) {
            $flag = wwtcOpenFlag((int) $kid['user_id'], $jd);
            if ($flag && ($flag['status'] ?? '') === 'flagged') {
                $said = wwtcCountedKapitlach($said, (int) ($flag['kapitlach'] ?? 0), 'flagged');
            }
        }
        $engine = (int) $student['quota'];
        if (function_exists('wwtcActiveCustomLadderForUser')) {
            $cell = wwtcCustomLadderCell(
                wwtcActiveCustomLadderForUser((int) $kid['user_id']),
                (string) ($kid['class_grade'] ?? ''),
                $month
            );
            if ($cell) {
                $engine = wwtcCustomQuotaInt($cell['v']);
            }
        }
        return [
            'engineQuota' => $engine,
            'said' => $said,
            'reported' => $said > 0,
        ];
    }
    return ['engineQuota' => 0, 'said' => 0, 'reported' => false];
}

function wwtcOverrideActorSchools(array $actor): array
{
    if (($actor['auth'] ?? '') === 'super') {
        return [];
    }
    return wwtcAdminAuthIds((int) $actor['id'], 'school');
}

/**
 * Quota the soldier is on right now, before a new custom ladder is saved.
 * An existing custom ladder is that quota, so a new target does not drop it.
 * Otherwise it is the engine (or today's ladder, for Cheshvan).
 *
 * @return array{grade:string,month:string,kapitlach:float,minutes:int}
 */
function wwtcCustomLadderAnchorForKid(array $kid, int $year, string $month): array
{
    $grade = wwtcGradeKeyFrom((string) ($kid['class_grade'] ?? ''));
    $sheetMonth = wwtcCustomMonthName($month);
    $existing = wwtcActiveCustomLadderForUser((int) ($kid['user_id'] ?? 0));
    if ($existing) {
        $cell = wwtcCustomLadderCell($existing, $grade, $month);
        if ($cell) {
            return [
                'grade' => $grade,
                'month' => $sheetMonth,
                'kapitlach' => $cell['v'],
                'minutes' => (int) $cell['m'],
            ];
        }
    }
    $dates = wwtcMonthDatesForYear($year);
    $jd = (int) ($dates[$month] ?? 0);
    $kap = 0;
    $min = 0;
    if ($jd > 0) {
        $raw = wwtcSchoolDataRaw((int) ($kid['school_id'] ?? 0), $jd, $year);
        foreach ($raw['students'] ?? [] as $student) {
            if ((int) $student['id'] !== (int) $kid['user_id']) {
                continue;
            }
            $kap = (int) ($student['quota'] ?? 0);
            $min = (int) ($student['minutesQuota'] ?? 0);
            break;
        }
    }
    return ['grade' => $grade, 'month' => $sheetMonth, 'kapitlach' => $kap, 'minutes' => $min];
}

function wwtcCustomLadderActor(array $actor): array
{
    if (trim((string) ($actor['name'] ?? '')) === '') {
        $actor['name'] = function_exists('wwtcAdminDisplayName')
            ? wwtcAdminDisplayName((int) ($actor['id'] ?? 0))
            : '';
    }
    return $actor;
}

// Admin picks one soldier and a "finish N kapitlach by grade G" target.
// The server builds the grid. HQ: any school. Base commander: their school.
if ($method === 'GET' && $path === '/admin/custom-ladders') {
    $actor = wwtcRequireActor(['admin']);
    $schoolId = (int) ($_GET['schoolId'] ?? 0);
    if ($schoolId <= 0 || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    if (wwtcOverrideStatus($actor, $schoolId, wwtcOverrideActorSchools($actor)) !== 200) {
        wwtcError('You can only set a custom ladder for soldiers in your own school.', 403);
    }
    $year = wwtcYear();
    $date = wwtcCurrentDate();
    $month = wwtcMonthForDate($date);
    $raw = wwtcSchoolDataRaw($schoolId, $date, $year);
    $engineById = [];
    foreach ($raw['students'] ?? [] as $student) {
        $engineById[(int) $student['id']] = $student;
    }
    $soldiers = wwtcCustomLadderRoster($schoolId);
    foreach ($soldiers as $i => $soldier) {
        if (!empty($soldier['customLadder'])) {
            $cell = wwtcCustomLadderCell(
                ['grid' => $soldier['customLadder']],
                (string) $soldier['grade'],
                $month
            );
            $kap = $cell ? $cell['v'] : 0;
            $min = $cell ? (int) $cell['m'] : 0;
        } else {
            $engine = $engineById[(int) $soldier['id']] ?? null;
            $kap = (int) ($engine['quota'] ?? 0);
            $min = (int) ($engine['minutesQuota'] ?? 0);
        }
        $soldiers[$i]['month'] = $month;
        $soldiers[$i]['currentKapitlach'] = $kap;
        $soldiers[$i]['currentMinutes'] = $min;
    }
    wwtcJson(['schoolId' => $schoolId, 'month' => $month, 'year' => $year, 'soldiers' => $soldiers]);
}

if ($method === 'POST' && $path === '/admin/custom-ladder') {
    $actor = wwtcCustomLadderActor(wwtcRequireActor(['admin']));
    $input = wwtcInput();
    $kidId = (int) ($input['kidId'] ?? 0);
    if ($kidId <= 0) {
        wwtcError('A soldier is required.', 422);
    }
    $kid = wwtcKidByUserId($kidId);
    if (!$kid || !isset(wwtcEligibleSchools()[(int) $kid['school_id']])) {
        wwtcError('Soldier not found.', 404);
    }
    $year = wwtcYear();
    $month = wwtcMonthForDate(wwtcCurrentDate());
    $result = wwtcPerformCustomLadder($MASHPIA_DB, $actor, $kid, $input, wwtcOverrideActorSchools($actor), [
        'ready' => wwtcCustomLaddersReady() && wwtcAuditReady(),
        'anchor' => wwtcCustomLadderAnchorForKid($kid, $year, $month),
        'now' => date('Y-m-d H:i:s'),
    ]);
    if ($result['status'] !== 200) {
        wwtcError($result['error'], $result['status']);
    }
    wwtcJson($result['body']);
}

if ($method === 'POST' && $path === '/admin/custom-ladder/remove') {
    $actor = wwtcCustomLadderActor(wwtcRequireActor(['admin']));
    $input = wwtcInput();
    $kidId = (int) ($input['kidId'] ?? 0);
    if ($kidId <= 0) {
        wwtcError('A soldier is required.', 422);
    }
    $kid = wwtcKidByUserId($kidId);
    if (!$kid || !isset(wwtcEligibleSchools()[(int) $kid['school_id']])) {
        wwtcError('Soldier not found.', 404);
    }
    $result = wwtcPerformRemoveCustomLadder($MASHPIA_DB, $actor, $kid, wwtcOverrideActorSchools($actor), [
        'ready' => wwtcCustomLaddersReady() && wwtcAuditReady(),
        'active' => wwtcActiveCustomLadderForUser($kidId) !== null,
    ]);
    if ($result['status'] !== 200) {
        wwtcError($result['error'], $result['status']);
    }
    wwtcJson($result['body']);
}

// Base commander (or HQ) sets one soldier's quota for one month to the
// kapitlach they entered. The ladder and every other month are left alone.
if ($method === 'POST' && $path === '/admin/quota-override') {
    $actor = wwtcRequireActor(['admin']);
    $input = wwtcInput();
    $kidId = (int) ($input['kidId'] ?? 0);
    $year = isset($input['year']) && $input['year'] !== '' ? (int) $input['year'] : wwtcYear();
    $month = trim((string) ($input['month'] ?? ''));
    if ($kidId <= 0 || $month === '') {
        wwtcError('A soldier and a month are required.', 422);
    }
    $kid = wwtcKidByUserId($kidId);
    if (!$kid || !isset(wwtcEligibleSchools()[(int) $kid['school_id']])) {
        wwtcError('Soldier not found.', 404);
    }
    $figures = wwtcOverrideEngineFigures($kid, $year, $month);
    if ($figures === null) {
        wwtcError('That month is not on the campaign calendar.', 422);
    }
    $existing = wwtcActiveOverridesForMonth($year, $month);
    $result = wwtcPerformOverride($MASHPIA_DB, $actor, $kid, $input, wwtcOverrideActorSchools($actor), [
        'ready' => wwtcOverridesReady() && wwtcAuditReady(),
        'engineQuota' => $figures['engineQuota'],
        'said' => $figures['said'],
        'reported' => $figures['reported'],
        'year' => $year,
        'month' => $month,
        'already' => isset($existing[$kidId]),
    ]);
    if ($result['status'] !== 200) {
        wwtcError($result['error'], $result['status']);
    }
    wwtcJson($result['body']);
}

if ($method === 'POST' && $path === '/admin/quota-override/undo') {
    $actor = wwtcRequireActor(['admin']);
    $input = wwtcInput();
    $kidId = (int) ($input['kidId'] ?? 0);
    $year = isset($input['year']) && $input['year'] !== '' ? (int) $input['year'] : wwtcYear();
    $month = trim((string) ($input['month'] ?? ''));
    if ($kidId <= 0 || $month === '') {
        wwtcError('A soldier and a month are required.', 422);
    }
    $kid = wwtcKidByUserId($kidId);
    if (!$kid || !isset(wwtcEligibleSchools()[(int) $kid['school_id']])) {
        wwtcError('Soldier not found.', 404);
    }
    if (!isset(wwtcMonthDatesForYear($year)[$month])) {
        wwtcError('That month is not on the campaign calendar.', 422);
    }
    $existing = wwtcActiveOverridesForMonth($year, $month);
    $result = wwtcPerformUndo($MASHPIA_DB, $actor, $kid, wwtcOverrideActorSchools($actor), [
        'ready' => wwtcOverridesReady() && wwtcAuditReady(),
        'year' => $year,
        'month' => $month,
        'active' => isset($existing[$kidId]),
    ]);
    if ($result['status'] !== 200) {
        wwtcError($result['error'], $result['status']);
    }
    wwtcJson($result['body']);
}

/** null = every school (HQ). An array is the base commander's schools. */
function wwtcFlagReviewSchools(array $actor): ?array
{
    if (($actor['type'] ?? '') !== 'admin') {
        return [];
    }
    if (($actor['auth'] ?? '') === 'super') {
        return null;
    }
    return wwtcAdminAuthIds((int) ($actor['id'] ?? 0), 'school');
}

function wwtcAdminDisplayName(int $adminId): string
{
    global $MASHPIA_DB;
    if ($adminId <= 0) {
        return 'Admin';
    }
    try {
        $stmt = $MASHPIA_DB->prepare('SELECT first, last FROM admins WHERE admin_id = :id LIMIT 1');
        $stmt->execute([':id' => $adminId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    } catch (Throwable $e) {
        return 'Admin';
    }
    $name = trim(($row['first'] ?? '') . ' ' . ($row['last'] ?? ''));
    return $name !== '' ? $name : 'Admin';
}

if ($method === 'GET' && $path === '/admin/flags') {
    $actor = wwtcRequireActor(['admin']);
    if (!wwtcFlagsReady()) {
        wwtcError('Flag review is not installed yet. Run api/sql/wwtc_flagged_entries.sql on mashpia.', 503);
    }
    wwtcJson(wwtcListFlags(wwtcFlagReviewSchools($actor)));
}

if ($method === 'POST' && preg_match('#^/admin/flags/(\d+)/(accept|remove)$#', $path, $m)) {
    $actor = wwtcRequireActor(['admin']);
    if (!wwtcFlagsReady()) {
        wwtcError('Flag review is not installed yet. Run api/sql/wwtc_flagged_entries.sql on mashpia.', 503);
    }
    $entry = wwtcFlagById((int) $m[1]);
    if (!$entry) {
        wwtcError('Flagged entry not found.', 404);
    }
    $schools = wwtcFlagReviewSchools($actor);
    if ($schools !== null && !in_array((int) $entry['school_id'], $schools, true)) {
        wwtcError('You do not have permission to perform this action.', 403);
    }
    $actor['type'] = 'admin';
    $actor['name'] = wwtcAdminDisplayName((int) ($actor['id'] ?? 0));
    $result = wwtcReviewStoredFlag((int) $m[1], $m[2], $actor);
    if (!$result['ok']) {
        wwtcError($result['error'], (int) $result['status']);
    }
    wwtcJson(['ok' => true, 'entry' => $result['entry']]);
}

wwtcError('Not found: ' . $method . ' ' . $path, 404);
