<?php

declare(strict_types=1);

require_once __DIR__ . '/schoolYear.php';

/**
 * wwtc_school_settings. Missing table or missing row → Tishrei, today's year.
 * Never writes Mashpia's schools table.
 */

function wwtcSchoolSettingsReady(): bool
{
    return function_exists('wwtcColumnExists') && wwtcColumnExists('wwtc_school_settings', 'first_month');
}

/** @return array<int,string> school_id => first month, Tishrei rows included */
function wwtcAllSchoolFirstMonths(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $cache = [];
    if (!wwtcSchoolSettingsReady()) {
        return $cache;
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return $cache;
    }
    try {
        $rows = $MASHPIA_DB->query('SELECT school_id, first_month FROM wwtc_school_settings')->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $cache[(int) $row['school_id']] = wwtcNormalizeFirstMonth((string) $row['first_month']);
        }
    } catch (Throwable $e) {
        error_log('WWTC school-year settings read failed: ' . $e->getMessage());
        $cache = [];
    }
    return $cache;
}

function wwtcSchoolFirstMonth(int $schoolId): string
{
    if ($schoolId <= 0) {
        return WWTC_DEFAULT_FIRST_MONTH;
    }
    $all = wwtcAllSchoolFirstMonths();
    return $all[$schoolId] ?? WWTC_DEFAULT_FIRST_MONTH;
}

/** @return array<int,string> schools whose year does not start in Tishrei */
function wwtcNonDefaultFirstMonths(): array
{
    $out = [];
    foreach (wwtcAllSchoolFirstMonths() as $id => $month) {
        if (!wwtcIsDefaultSchoolYear($month)) {
            $out[(int) $id] = $month;
        }
    }
    return $out;
}

function wwtcSaveSchoolFirstMonth(int $schoolId, string $firstMonth): void
{
    global $MASHPIA_DB;
    $month = wwtcNormalizeFirstMonth($firstMonth);
    $stmt = $MASHPIA_DB->prepare(
        'INSERT INTO wwtc_school_settings (school_id, first_month)
         VALUES (:id, :month)
         ON DUPLICATE KEY UPDATE first_month = VALUES(first_month), updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([':id' => $schoolId, ':month' => $month]);
    // The in-request cache would keep the old month. The save response returns
    // the new value; the next request reads the row.
}

/** Julian day of a campaign month in a Hebrew year. Plain Adar uses Adar I in a leap year. */
function wwtcCampaignJd(int $year, string $month): int
{
    if ($year <= 0 || $month === '' || !function_exists('wwtcMonthDatesForYear')) {
        return 0;
    }
    $dates = wwtcMonthDatesForYear($year);
    if (isset($dates[$month])) {
        return (int) $dates[$month];
    }
    if ($month === 'Adar') {
        if (isset($dates['Adar I'])) {
            return (int) $dates['Adar I'];
        }
        if (isset($dates['Adar II'])) {
            return (int) $dates['Adar II'];
        }
    }
    return 0;
}

/**
 * Elapsed school-year months for a soldier. Tishrei schools are the current
 * Hebrew year's elapsed Shabbos Mevorchim, quota dated on that same day.
 * Any other start includes the months of the grade year so far, which can
 * begin in the previous Hebrew year, and prices quota on the sheet month.
 *
 * @return list<array{month:string,jd:int,quotaJd:int,year:int}>
 */
function wwtcKidMonthSlots(string $firstMonth): array
{
    $first = wwtcNormalizeFirstMonth($firstMonth);
    if (wwtcIsDefaultSchoolYear($first) || !function_exists('wwtcElapsedMonths')) {
        $year = function_exists('wwtcYear') ? wwtcYear() : 0;
        $out = [];
        foreach (wwtcElapsedMonths() as $m) {
            $out[] = [
                'month' => (string) $m['month'],
                'jd' => (int) $m['jd'],
                'quotaJd' => (int) $m['jd'],
                'year' => $year,
            ];
        }
        return $out;
    }
    $currentJd = wwtcCurrentDate();
    $currentMonth = function_exists('wwtcMonthForDate') ? wwtcMonthForDate($currentJd) : '';
    if ($currentMonth === '') {
        $currentMonth = WWTC_DEFAULT_FIRST_MONTH;
    }
    $hebrewYear = wwtcYear();
    $start = wwtcSchoolYearStartYear($first, $hebrewYear, $currentMonth);
    $now = unixtojd();
    $out = [];
    foreach (wwtcSchoolYearSlots($first, $start) as $slot) {
        $jd = wwtcCampaignJd((int) $slot['year'], (string) $slot['month']);
        if ($jd <= 0 || $jd > $now) {
            continue;
        }
        $quotaJd = wwtcCampaignJd($hebrewYear, (string) $slot['sheetMonth']);
        if ($quotaJd <= 0) {
            $quotaJd = wwtcCampaignJd($hebrewYear - 1, (string) $slot['sheetMonth']);
        }
        if ($quotaJd <= 0) {
            $quotaJd = $jd;
        }
        $out[] = [
            'month' => (string) $slot['month'],
            'jd' => $jd,
            'quotaJd' => $quotaJd,
            'year' => (int) $slot['year'],
        ];
    }
    return $out;
}

/**
 * jd → [gradeKey, occasion] for every grade of a rotated school year.
 * Tishrei schools keep the Hebrew-year map in index.php.
 *
 * @return array<int,array{0:string,1:string}>
 */
function wwtcSchoolYearHistoryMap(string $firstMonth, int $currentGrade, int $currentYear, string $currentMonth): array
{
    $start = wwtcSchoolYearStartYear($firstMonth, $currentYear, $currentMonth);
    $map = [];
    for ($gn = 0; $gn <= $currentGrade; $gn++) {
        $gradeKey = $gn === 0 ? 'pre1a' : (string) $gn;
        $origin = $start - ($currentGrade - $gn);
        foreach (wwtcSchoolYearSlots($firstMonth, $origin) as $slot) {
            $jd = wwtcCampaignJd((int) $slot['year'], (string) $slot['month']);
            if ($jd > 0) {
                $map[$jd] = [$gradeKey, (string) $slot['month']];
            }
            if ($slot['month'] !== 'Tishrei' || !function_exists('wwtcHolidayDates')) {
                continue;
            }
            foreach (wwtcHolidayDates((int) $slot['year']) as $name => $jds) {
                foreach ($jds as $hjd) {
                    $map[(int) $hjd] = [$gradeKey, (string) $name];
                }
            }
        }
    }
    return $map;
}

/**
 * Kapitlach and minutes task quantities for one school's soldiers on a
 * Shabbos Mevorchim date, on the ladder in effect at $boundary.
 *
 * @return array<int,array{kap:int,min:int}>
 */
function wwtcSchoolTaskQuantities(int $schoolId, int $taskJd, string $boundary): array
{
    global $MASHPIA_DB;
    if ($schoolId <= 0 || $taskJd <= 0 || !isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    if (!defined('WWTC_SUBJECT_ID') || !defined('WWTC_GRID_KAPITELACH') || !defined('WWTC_GRID_MINUTES')) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT u.user_id, dt.grid_id, MAX(dt.quantity) qty
               FROM users u
               JOIN user_tracks ut ON ut.user_id = u.user_id
                    AND ut.subject_id = ' . (int) WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
               JOIN date_tasks_missions m ON m.subject_id = ' . (int) WWTC_SUBJECT_ID . '
                    AND m.start_date = :d AND m.end_date = :d
                    AND m.school_type_id = u.school_type_id
                    AND m.level = ut.level AND m.lang_id = u.lang_id
                    AND m.track_id = COALESCE((SELECT h.track_id FROM user_track_history h
                          WHERE h.user_id = ut.user_id AND h.changed_at < :boundary
                          ORDER BY h.changed_at DESC, h.id DESC LIMIT 1), ut.track_id)
               JOIN date_tasks dt ON dt.date_tasks_mission_id = m.date_tasks_mission_id
                    AND dt.grid_id IN (' . (int) WWTC_GRID_KAPITELACH . ', ' . (int) WWTC_GRID_MINUTES . ')
              WHERE u.school_id = :sid AND u.user_registered > 0
              GROUP BY u.user_id, dt.grid_id'
        );
        $stmt->execute([':d' => $taskJd, ':boundary' => $boundary, ':sid' => $schoolId]);
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $uid = (int) $row['user_id'];
            if (!isset($out[$uid])) {
                $out[$uid] = ['kap' => 0, 'min' => 0];
            }
            if ((int) $row['grid_id'] === (int) WWTC_GRID_KAPITELACH) {
                $out[$uid]['kap'] = (int) $row['qty'];
            }
            if ((int) $row['grid_id'] === (int) WWTC_GRID_MINUTES) {
                $out[$uid]['min'] = (int) $row['qty'];
            }
        }
        return $out;
    } catch (Throwable $e) {
        error_log('WWTC school-year quota lookup failed: ' . $e->getMessage());
        return [];
    }
}

/**
 * Sheet-month quantities for one school and calendar month.
 * Empty when the school starts in Tishrei or the sheet month is that month.
 *
 * @return array{kap:array<int,int>,min:array<int,int>,qty:array<int,array{kap:int,min:int}>}
 */
function wwtcSchoolSheetQuantities(int $schoolId, int $date, int $year, string $month): array
{
    $empty = ['kap' => [], 'min' => [], 'qty' => []];
    $first = wwtcSchoolFirstMonth($schoolId);
    if (wwtcIsDefaultSchoolYear($first) || $month === '') {
        return $empty;
    }
    $sheet = wwtcQuotaSheetMonth($month, $first);
    if ($sheet === wwtcPlainMonthName($month)) {
        return $empty;
    }
    $jd = wwtcCampaignJd($year, $sheet);
    if ($jd <= 0) {
        $jd = wwtcCampaignJd($year - 1, $sheet);
    }
    if ($jd <= 0) {
        return $empty;
    }
    $boundary = function_exists('wwtcAsOfBoundary') ? wwtcAsOfBoundary($date) : '1970-01-01 00:00:00';
    $qty = wwtcSchoolTaskQuantities($schoolId, $jd, $boundary);
    return ['kap' => [], 'min' => [], 'qty' => $qty];
}

/**
 * Replace a rotated school's class and soldier quotas with the sheet-month
 * cells. Soldiers with a base-commander override are left for that overlay.
 * Perfect Platoon then copies the same sheet quota onto the soldier rows.
 */
function wwtcRepriceSchoolYearData(array $data, int $schoolId, int $date, int $year): array
{
    if (!function_exists('wwtcMonthNameForJd')) {
        return $data;
    }
    $month = wwtcMonthNameForJd($date, $year);
    $sheet = wwtcSchoolSheetQuantities($schoolId, $date, $year, $month);
    if (!$sheet['qty']) {
        return $data;
    }
    $overs = [];
    if (function_exists('wwtcActiveOverridesForMonth') && $month !== '') {
        $overs = wwtcActiveOverridesForMonth($year, $month);
    }
    $boundary = function_exists('wwtcAsOfBoundary') ? wwtcAsOfBoundary($date) : '1970-01-01 00:00:00';
    $cal = wwtcSchoolTaskQuantities($schoolId, $date, $boundary);
    $kapDeltaByClass = [];
    $minDeltaByClass = [];
    $minDelta = 0;
    foreach ($data['students'] as $i => $student) {
        $uid = (int) ($student['id'] ?? 0);
        if ($uid <= 0 || isset($overs[$uid]) || !isset($sheet['qty'][$uid])) {
            continue;
        }
        $old = (int) ($student['quota'] ?? 0);
        $new = (int) $sheet['qty'][$uid]['kap'];
        $data['students'][$i]['quota'] = $new;
        $said = (int) ($student['said'] ?? 0);
        $data['students'][$i]['met'] = function_exists('wwtcSoldierMetQuota')
            ? wwtcSoldierMetQuota($new, $said)
            : ($new > 0 && $said >= $new);
        $cid = (int) ($student['classId'] ?? 0);
        $kapDeltaByClass[$cid] = ($kapDeltaByClass[$cid] ?? 0) + ($new - $old);
        if (isset($cal[$uid])) {
            $dMin = (int) $sheet['qty'][$uid]['min'] - (int) $cal[$uid]['min'];
            $minDelta += $dMin;
            $minDeltaByClass[$cid] = ($minDeltaByClass[$cid] ?? 0) + $dMin;
        }
    }
    foreach ($data['classes'] as $i => $class) {
        $cid = (int) ($class['id'] ?? 0);
        $quota = (int) ($class['quota'] ?? 0) + (int) ($kapDeltaByClass[$cid] ?? 0);
        $minutesQuota = (int) ($class['minutesQuota'] ?? 0) + (int) ($minDeltaByClass[$cid] ?? 0);
        $data['classes'][$i]['quota'] = $quota;
        $data['classes'][$i]['minutesQuota'] = $minutesQuota;
        if (function_exists('wwtcPct')) {
            $data['classes'][$i]['pct'] = wwtcPct((int) ($class['said'] ?? 0), $quota);
            $data['classes'][$i]['minutesPct'] = wwtcPct((int) ($class['minutesSaid'] ?? 0), $minutesQuota);
        }
    }
    if (isset($data['minutesQuota'])) {
        $data['minutesQuota'] = (int) $data['minutesQuota'] + $minDelta;
    }
    return $data;
}

/**
 * Point each rotated school's Perfect Platoon quota at the sheet month.
 * The ladder is still the one in effect on the reporting Shabbos.
 * Overrides are applied by the caller after this.
 *
 * @param array<int,array<string,mixed>> $soldiers
 * @return array<int,array<string,mixed>>
 */
function wwtcApplySchoolYearToPlatoonSoldiers(array $soldiers, int $date, int $year): array
{
    $starts = wwtcNonDefaultFirstMonths();
    if (!$starts || !$soldiers || !function_exists('wwtcMonthNameForJd') || !function_exists('wwtcPerfectPlatoonQuotaSql')) {
        return $soldiers;
    }
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $soldiers;
    }
    $plain = wwtcPlainMonthName($month);
    $groups = [];
    foreach ($starts as $sid => $first) {
        $sheet = wwtcQuotaSheetMonth($month, $first);
        if ($sheet === '' || $sheet === $plain) {
            continue;
        }
        $groups[$sheet][(int) $sid] = true;
    }
    if (!$groups) {
        return $soldiers;
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return $soldiers;
    }
    $boundary = function_exists('wwtcAsOfBoundary') ? wwtcAsOfBoundary($date) : '1970-01-01 00:00:00';
    $byUser = [];
    foreach ($groups as $sheet => $sids) {
        $jd = wwtcCampaignJd($year, (string) $sheet);
        if ($jd <= 0) {
            $jd = wwtcCampaignJd($year - 1, (string) $sheet);
        }
        if ($jd <= 0) {
            continue;
        }
        try {
            $stmt = $MASHPIA_DB->prepare(wwtcPerfectPlatoonQuotaSql());
            $stmt->execute([':d' => $jd, ':boundary' => $boundary]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $sid = (int) $row['school_id'];
                if (!isset($sids[$sid])) {
                    continue;
                }
                $byUser[(int) $row['user_id']] = (int) $row['quota'];
            }
        } catch (Throwable $e) {
            error_log('WWTC school-year platoon quota failed: ' . $e->getMessage());
        }
    }
    if (!$byUser) {
        return $soldiers;
    }
    foreach ($soldiers as $i => $soldier) {
        $uid = (int) ($soldier['userId'] ?? 0);
        if ($uid > 0 && isset($byUser[$uid])) {
            $soldiers[$i]['quota'] = $byUser[$uid];
        }
    }
    return $soldiers;
}

/**
 * Holiday boards price quota off calendar Tishrei. A rotated school uses the
 * quota cell of its Tishrei position instead. No custom starts → unchanged.
 */
function wwtcRepriceHolidayBoard(array $board, int $year, int $tishreiJd): array
{
    $starts = wwtcNonDefaultFirstMonths();
    if (!$starts) {
        return $board;
    }
    $boundary = function_exists('wwtcAsOfBoundary') ? wwtcAsOfBoundary($tishreiJd) : '1970-01-01 00:00:00';
    $changed = false;
    $studentsBySchool = $board['studentsBySchool'] ?? [];
    foreach ($studentsBySchool as $sid => $students) {
        $sid = (int) $sid;
        if (!isset($starts[$sid])) {
            continue;
        }
        $sheet = wwtcQuotaSheetMonth('Tishrei', $starts[$sid]);
        if ($sheet === 'Tishrei') {
            continue;
        }
        $jd = wwtcCampaignJd($year, $sheet);
        if ($jd <= 0) {
            $jd = wwtcCampaignJd($year - 1, $sheet);
        }
        if ($jd <= 0) {
            continue;
        }
        $qty = wwtcSchoolTaskQuantities($sid, $jd, $boundary);
        if (!$qty) {
            continue;
        }
        foreach ($students as $i => $student) {
            $uid = (int) ($student['id'] ?? 0);
            if (!isset($qty[$uid])) {
                continue;
            }
            $students[$i]['quota'] = (int) $qty[$uid]['kap'];
            $students[$i]['minutesQuota'] = (int) $qty[$uid]['min'];
            $said = (int) ($student['said'] ?? 0);
            $students[$i]['met'] = function_exists('wwtcSoldierMetQuota')
                ? wwtcSoldierMetQuota((int) $qty[$uid]['kap'], $said)
                : ((int) $qty[$uid]['kap'] > 0 && $said >= (int) $qty[$uid]['kap']);
            $changed = true;
        }
        $studentsBySchool[$sid] = $students;
    }
    if (!$changed) {
        return $board;
    }
    $board['studentsBySchool'] = $studentsBySchool;
    return wwtcRebuildHolidayBoardTotals($board);
}

/** Rebuild holiday sums from studentsBySchool after a quota rotation. */
function wwtcRebuildHolidayBoardTotals(array $board): array
{
    $kapGoal = [];
    $kapDone = [];
    $minGoal = [];
    $minDone = [];
    $metBySchool = [];
    $sizeBySchool = [];
    $metByClass = [];
    $sizeByClass = [];
    $participated = [];
    $armySaid = 0;
    $armyQuota = 0;
    $armyMin = 0;
    $armyMinQuota = 0;
    $soldiers = 0;
    $met = 0;
    $part = 0;
    foreach ($board['studentsBySchool'] as $sid => $students) {
        $sid = (int) $sid;
        foreach ($students as $student) {
            $cid = (int) ($student['classId'] ?? 0);
            $qk = (int) ($student['quota'] ?? 0);
            $qm = (int) ($student['minutesQuota'] ?? 0);
            $dk = (int) ($student['said'] ?? 0);
            $dm = (int) ($student['minutesSaid'] ?? 0);
            $isMet = !empty($student['met']);
            $didPart = $dk > 0;
            $kapGoal[$sid] = ($kapGoal[$sid] ?? 0) + $qk;
            $kapDone[$sid] = ($kapDone[$sid] ?? 0) + $dk;
            $minGoal[$sid] = ($minGoal[$sid] ?? 0) + $qm;
            $minDone[$sid] = ($minDone[$sid] ?? 0) + $dm;
            $sizeBySchool[$sid] = ($sizeBySchool[$sid] ?? 0) + 1;
            $metBySchool[$sid] = ($metBySchool[$sid] ?? 0) + ($isMet ? 1 : 0);
            $sizeByClass[$sid][$cid] = ($sizeByClass[$sid][$cid] ?? 0) + 1;
            $metByClass[$sid][$cid] = ($metByClass[$sid][$cid] ?? 0) + ($isMet ? 1 : 0);
            if ($didPart) {
                $participated[$sid] = ($participated[$sid] ?? 0) + 1;
            }
            $armyQuota += $qk;
            $armySaid += $dk;
            $armyMinQuota += $qm;
            $armyMin += $dm;
            $soldiers++;
            if ($isMet) {
                $met++;
            }
            if ($didPart) {
                $part++;
            }
        }
    }
    $perfectPlatoons = 0;
    $classesCount = 0;
    foreach ($sizeByClass as $sid => $byClass) {
        $classesCount += count($byClass);
        foreach ($byClass as $cid => $size) {
            $metN = (int) ($metByClass[$sid][$cid] ?? 0);
            if (function_exists('wwtcClassIsPerfect') && wwtcClassIsPerfect($metN, (int) $size)) {
                $perfectPlatoons++;
            }
        }
    }
    $board['kapGoal'] = $kapGoal;
    $board['kapDone'] = $kapDone;
    $board['minGoal'] = $minGoal;
    $board['minDone'] = $minDone;
    $board['counts'] = [
        'metBySchool' => $metBySchool,
        'sizeBySchool' => $sizeBySchool,
        'metByClass' => $metByClass,
        'sizeByClass' => $sizeByClass,
    ];
    $board['participated'] = $participated;
    $army = $board['army'] ?? [];
    $army['accomplished'] = $armySaid;
    $army['quota'] = $armyQuota;
    $army['minutes'] = $armyMin;
    $army['minutesQuota'] = $armyMinQuota;
    $army['soldiers'] = $soldiers;
    $army['metSoldiers'] = $met;
    $army['participatedSoldiers'] = $part;
    $army['classes'] = $classesCount;
    $army['perfectPlatoons'] = $perfectPlatoons;
    $board['army'] = $army;
    return $board;
}
