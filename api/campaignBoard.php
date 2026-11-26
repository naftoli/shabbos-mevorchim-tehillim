<?php

declare(strict_types=1);

/**
 * School rows, Race ranking, one-school reports, army aggregate overlays,
 * and holiday board shapers. Loaded by the API router.
 */

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
 * Top Base / schoolRank keys. Same order as src/lib/baseRank.js baseRankScore:
 * % of soldiers who finished, then kapitlach said, then % of the kapitlach
 * quota, then % of minutes. Name orders a list and does not split a tie.
 */
function wwtcBaseRankKeys(): array
{
    return ['pctMet', 'saidMonth', 'pct', 'minutesPct'];
}

/**
 * Nationwide school order for The Race list and Top Base. pctMet first, then
 * the same tie-breakers as wwtcBaseRankKeys, then the school name.
 */
function wwtcCmpSchoolRace(array $a, array $b): int
{
    foreach (wwtcBaseRankKeys() as $key) {
        $cmp = ((float) ($b[$key] ?? 0)) <=> ((float) ($a[$key] ?? 0));
        if ($cmp !== 0) {
            return $cmp;
        }
    }
    return strcmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
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
