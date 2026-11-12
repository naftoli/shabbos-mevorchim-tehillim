<?php

declare(strict_types=1);

/**
 * Army / base / platoon reports, platoon-roll staff check, and not-completed.
 * Loaded by index.php with $method / $path set.
 */

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
    wwtcJson(['month' => wwtcMonthForDate($date, $reportYear), 'year' => $reportYear, 'rows' => $rows]);
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
            $monthLabel = wwtcMonthForDate((int) $period['jd'], (int) $period['year']);
        }
    } else {
        $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
        $classes = wwtcSchoolData($id, $date, $reportYear)['classes'];
        $monthLabel = wwtcMonthForDate($date, $reportYear);
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
            $monthLabel = wwtcMonthForDate((int) $period['jd'], (int) $period['year']);
        }
    } else {
        $date = wwtcDateForMonthIdx($_GET['monthIdx'] ?? null);
        $data = wwtcSchoolData($schoolId, $date, $reportYear);
        $monthLabel = wwtcMonthForDate($date, $reportYear);
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
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    wwtcRequireSchoolAdmin($id);
    $data = wwtcSchoolData($id, wwtcDateForMonthIdx($_GET['monthIdx'] ?? null));
    wwtcJson([
        'schoolId' => $id,
        'classes' => wwtcNotCompletedClasses($data['students'] ?? [], $data['classes'] ?? []),
    ]);
}
