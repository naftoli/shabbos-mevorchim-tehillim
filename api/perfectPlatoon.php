<?php

declare(strict_types=1);

/**
 * One definition of a Perfect Platoon. GET /perfect-platoons (home list, home
 * count, /stats), the school classes view, the base and platoon reports, the
 * holiday board, and the Wednesday follow-up PDF all read this roster.
 *
 * A class is perfect when it has at least one soldier and every soldier on
 * that month's roster has said at least their own kapitlach quota. "Said" is
 * MAX(done_qty) on live date_tasks_marks, with an unaccepted over-entry flag
 * put back to the prior mark. "Quota" is that soldier's kapitlach task
 * (date_tasks.quantity) for the ladder they were on for that Shabbos
 * Mevorchim, unless a base commander overrode that month — then the quota is
 * the kapitlach the soldier entered. $quota > 0 && $said >= $quota, then
 * met === size.
 *
 * The school and report pages used to ask the report engine
 * (setStudentResults) instead. That roster is a different set of soldiers,
 * quotas, and class labels — Cheshvan often priced from today's ladder, a
 * class the engine never returned, or a class the engine starred because it
 * left someone out — so the same month showed different Perfect Platoons.
 * Those pages still use the engine for kapitlach totals. The star, the
 * met/size fraction, and the class label come from this roster.
 *
 * It is not the mission-mark shortcut. date_tasks_mission_marks is the medal
 * signal. A class can be 11 of 11 on the report — every child finished the
 * kapitlach — and still have no mission-mark row for some of them. The old
 * /perfect-platoons query counted those marks against every enrolled soldier
 * (including children with no quota task) and used met >= size, so the class
 * dropped off the home list while the classes view still showed the star.
 * The "1 / 16" on a school card is perfect classes / classes on that roster,
 * not a rank and not a page.
 *
 * Rows are one per class id. The teacher and the class name are labels.
 * "4-boys" and "4-Boys" stay two platoons. No student name is selected.
 *
 * PR 28 (unmerged, cursor/perfect-platoon-graphics-2a8a) copies the old
 * mission-mark query as its own wwtcPerfectPlatoonRows() in
 * api/platoonGraphics.php and the daily job calls that. On merge, delete
 * that copy and keep this function — index.php on that branch already calls
 * wwtcPerfectPlatoonRows().
 */

require_once __DIR__ . '/teacherName.php';

function wwtcSoldierMetQuota(int $quota, int $said): bool
{
    return $quota > 0 && $said >= $quota;
}

function wwtcClassIsPerfect(int $met, int $size): bool
{
    return $size > 0 && $met === $size;
}

/** class_grade + class_sub, stored case kept. "4" + "boys" => "4-boys". */
function wwtcPlatoonClassName(string $grade, string $sub): string
{
    return $sub !== '' ? $grade . '-' . $sub : $grade;
}

/**
 * Group soldiers into classes. Includes classes that are not perfect, so a
 * school page can clear a star the report engine drew. A name on the input
 * is ignored. userId is kept only on the soldier map, never on a class row.
 *
 * @param array<int,array<string,mixed>> $soldiers
 * @return array{classes:array<int,array<string,mixed>>,soldiers:array<int,array<string,mixed>>}
 */
function wwtcPlatoonRoster(array $soldiers): array
{
    $classes = [];
    $byUser = [];
    foreach ($soldiers as $s) {
        $cid = (int) ($s['classId'] ?? 0);
        $sid = (int) ($s['schoolId'] ?? 0);
        if ($cid <= 0 || $sid <= 0) {
            continue;
        }
        if (!isset($classes[$cid])) {
            $grade = (string) ($s['grade'] ?? '');
            $sub = (string) ($s['sub'] ?? '');
            $classes[$cid] = [
                'schoolId' => $sid,
                'school' => (string) ($s['school'] ?? ''),
                'classId' => $cid,
                'grade' => $grade,
                'sub' => $sub,
                'className' => wwtcPlatoonClassName($grade, $sub),
                'teacher' => wwtcTeacherName($s['teacher'] ?? ''),
                'size' => 0,
                'met' => 0,
                'said' => 0,
                'quota' => 0,
            ];
        }
        $quota = (int) ($s['quota'] ?? 0);
        $said = (int) ($s['said'] ?? 0);
        $met = wwtcSoldierMetQuota($quota, $said);
        $classes[$cid]['size']++;
        if ($met) {
            $classes[$cid]['met']++;
        }
        $classes[$cid]['said'] += $said;
        $classes[$cid]['quota'] += $quota;
        $uid = (int) ($s['userId'] ?? 0);
        if ($uid > 0) {
            $byUser[$uid] = [
                'classId' => $cid,
                'schoolId' => $sid,
                'quota' => $quota,
                'said' => $said,
                'met' => $met,
            ];
        }
    }
    foreach ($classes as $cid => $c) {
        $classes[$cid]['perfect'] = wwtcClassIsPerfect($c['met'], $c['size']);
        $classes[$cid]['pctMet'] = $c['size'] > 0 ? (int) round($c['met'] / $c['size'] * 100) : 0;
        $quota = (int) $c['quota'];
        $classes[$cid]['pct'] = function_exists('wwtcPct')
            ? wwtcPct($c['said'], $quota)
            : ($quota > 0 ? (int) round($c['said'] / $quota * 100) : 0);
    }
    return ['classes' => $classes, 'soldiers' => $byUser];
}

/**
 * @param array<int,array<string,mixed>> $soldiers
 *   schoolId, school, classId, grade, sub, teacher, quota, said.
 *   A name or user id on the input is ignored.
 * @return array<int,array<string,mixed>>
 */
function wwtcPerfectPlatoonsFromSoldiers(array $soldiers): array
{
    $roster = wwtcPlatoonRoster($soldiers);
    $classesBySchool = [];
    foreach ($roster['classes'] as $c) {
        $classesBySchool[$c['schoolId']] = ($classesBySchool[$c['schoolId']] ?? 0) + 1;
    }

    $platoons = [];
    foreach ($roster['classes'] as $c) {
        if (empty($c['perfect'])) {
            continue;
        }
        $platoons[] = [
            'schoolId' => $c['schoolId'],
            'school' => $c['school'],
            'classId' => $c['classId'],
            'className' => $c['className'],
            'teacher' => wwtcTeacherName($c['teacher']),
            'grade' => $c['grade'],
            'size' => $c['size'],
            'schoolClasses' => $classesBySchool[$c['schoolId']] ?? 0,
        ];
    }
    usort($platoons, static function ($a, $b) {
        return [$a['school'], $a['className'], $a['classId']]
            <=> [$b['school'], $b['className'], $b['classId']];
    });
    return $platoons;
}

/**
 * Kapitlach that count toward a Perfect Platoon when this soldier has a flag
 * row. An unaccepted flag does not count: the prior mark does, or zero when
 * there was no prior mark. An accepted flag counts as the reviewed amount.
 *
 * @param array<string,mixed> $flag
 */
function wwtcPlatoonCountedSaid(int $liveSaid, array $flag): int
{
    if (!function_exists('wwtcCountsInPublicTotals')) {
        require_once __DIR__ . '/overEntry.php';
    }
    $status = (string) ($flag['status'] ?? '');
    if ($status === 'accepted') {
        return (int) ($flag['kapitlach'] ?? $liveSaid);
    }
    if ($status === 'flagged' && !wwtcCountsInPublicTotals('flagged')) {
        $priorReported = $flag['prior_reported'] ?? false;
        $hadPrior = $priorReported === true || $priorReported === 1 || $priorReported === '1';
        return $hadPrior ? (int) ($flag['prior_kapitlach'] ?? 0) : 0;
    }
    if (function_exists('wwtcCountedKapitlach')) {
        return wwtcCountedKapitlach($liveSaid, (int) ($flag['kapitlach'] ?? 0), $status !== '' ? $status : null);
    }
    return $liveSaid;
}

/**
 * @param array<int,array<string,mixed>> $soldiers
 * @param array<int,array<string,mixed>> $flagsByUser user_id => flag row
 * @return array<int,array<string,mixed>>
 */
function wwtcApplyFlagsToPlatoonSoldiers(array $soldiers, array $flagsByUser): array
{
    if (!$flagsByUser) {
        return $soldiers;
    }
    foreach ($soldiers as $i => $soldier) {
        $uid = (int) ($soldier['userId'] ?? 0);
        if ($uid <= 0 || !isset($flagsByUser[$uid])) {
            continue;
        }
        $soldiers[$i]['said'] = wwtcPlatoonCountedSaid((int) ($soldier['said'] ?? 0), $flagsByUser[$uid]);
    }
    return $soldiers;
}

/**
 * Open (unaccepted) flags for one Shabbos Mevorchim, keyed by user_id.
 * No soldier name is selected. Empty when the table is not installed.
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcPlatoonFlagsForDate(int $date): array
{
    static $memo = [];
    if (isset($memo[$date])) {
        return $memo[$date];
    }
    $memo[$date] = [];
    if ($date <= 0) {
        return $memo[$date];
    }
    if (function_exists('wwtcFlagsReady')) {
        if (!wwtcFlagsReady()) {
            return $memo[$date];
        }
    } elseif (function_exists('wwtcColumnExists')) {
        if (!wwtcColumnExists('wwtc_flagged_entries', 'status')) {
            return $memo[$date];
        }
    } else {
        return $memo[$date];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return $memo[$date];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT user_id, status, kapitlach, prior_kapitlach, prior_reported
               FROM wwtc_flagged_entries
              WHERE mark_date = :d AND status = \'flagged\''
        );
        $stmt->execute([':d' => $date]);
        $byUser = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $byUser[(int) $row['user_id']] = $row;
        }
        return $memo[$date] = $byUser;
    } catch (\Throwable $e) {
        error_log('WWTC perfect platoon flags failed: ' . $e->getMessage());
        return $memo[$date];
    }
}

/**
 * Kapitlach quota for each enrolled soldier on one Shabbos Mevorchim, priced
 * on the ladder in effect that day (same as-of rule as wwtcTrackAsOf).
 * No student name columns.
 */
function wwtcPerfectPlatoonQuotaSql(): string
{
    $subject = defined('WWTC_SUBJECT_ID') ? (int) WWTC_SUBJECT_ID : 1;
    $kap = defined('WWTC_GRID_KAPITELACH') ? (int) WWTC_GRID_KAPITELACH : 8001;
    $where = defined('WWTC_ROSTER_WHERE')
        ? WWTC_ROSTER_WHERE
        : 's.school_era IS NULL AND c.class_era = 0 AND u.school_id NOT IN (82, 612)';
    return 'SELECT u.user_id, u.school_id, u.class_id,
                   s.school_name, c.class_grade, c.class_sub, c.class_teacher,
                   MAX(dt.quantity) quota
              FROM users u
              JOIN user_tracks ut ON ut.user_id = u.user_id
                   AND ut.subject_id = ' . $subject . ' AND ut.enrolled = 1
              JOIN schools s ON s.school_id = u.school_id
              JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
              JOIN date_tasks_missions m ON m.subject_id = ' . $subject . '
                   AND m.start_date = :d AND m.end_date = :d
                   AND m.school_type_id = u.school_type_id
                   AND m.track_id = COALESCE((SELECT h.track_id FROM user_track_history h
                         WHERE h.user_id = ut.user_id AND h.changed_at < :boundary
                         ORDER BY h.changed_at DESC, h.id DESC LIMIT 1), ut.track_id)
                   AND m.level = ut.level AND m.lang_id = u.lang_id
              JOIN date_tasks dt ON dt.date_tasks_mission_id = m.date_tasks_mission_id
                   AND dt.grid_id = ' . $kap . '
             WHERE u.user_registered > 0 AND ' . $where . '
             GROUP BY u.user_id, u.school_id, u.class_id, s.school_name,
                      c.class_grade, c.class_sub, c.class_teacher';
}

/** Live kapitlach said for that same Shabbos Mevorchim. No student names. */
function wwtcPerfectPlatoonDoneSql(): string
{
    $subject = defined('WWTC_SUBJECT_ID') ? (int) WWTC_SUBJECT_ID : 1;
    $kap = defined('WWTC_GRID_KAPITELACH') ? (int) WWTC_GRID_KAPITELACH : 8001;
    return 'SELECT dtm.user_id, MAX(dtm.done_qty) said
              FROM date_tasks_marks dtm
              JOIN date_tasks dt USING (date_task_id)
              JOIN date_tasks_missions m USING (date_tasks_mission_id)
             WHERE m.subject_id = ' . $subject . '
               AND m.start_date = :d AND m.end_date = :d
               AND dt.grid_id = ' . $kap . '
             GROUP BY dtm.user_id';
}

/**
 * Soldiers for one Shabbos Mevorchim, shaped for wwtcPerfectPlatoonsFromSoldiers.
 * Schools outside wwtcEligibleSchools() are left out. A missing mark is said 0.
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcLoadPerfectPlatoonSoldiers(int $date): array
{
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    $boundary = function_exists('wwtcAsOfBoundary') ? wwtcAsOfBoundary($date) : '1970-01-01 00:00:00';
    $quota = $MASHPIA_DB->prepare(wwtcPerfectPlatoonQuotaSql());
    $quota->execute([':d' => $date, ':boundary' => $boundary]);

    $done = $MASHPIA_DB->prepare(wwtcPerfectPlatoonDoneSql());
    $done->execute([':d' => $date]);
    $doneByUser = [];
    foreach ($done->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $doneByUser[(int) $row['user_id']] = (int) $row['said'];
    }

    $eligible = function_exists('wwtcEligibleSchools') ? wwtcEligibleSchools() : null;
    $soldiers = [];
    foreach ($quota->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $sid = (int) $row['school_id'];
        if ($eligible !== null && !isset($eligible[$sid])) {
            continue;
        }
        $soldiers[] = [
            'schoolId' => $sid,
            'school' => ($eligible !== null && isset($eligible[$sid]))
                ? (string) $eligible[$sid]
                : (string) ($row['school_name'] ?? ''),
            'classId' => (int) $row['class_id'],
            'grade' => (string) ($row['class_grade'] ?? ''),
            'sub' => (string) ($row['class_sub'] ?? ''),
            'teacher' => wwtcTeacherName($row['class_teacher'] ?? ''),
            'userId' => (int) $row['user_id'],
            'quota' => (int) ($row['quota'] ?? 0),
            'said' => $doneByUser[(int) $row['user_id']] ?? 0,
        ];
    }
    return $soldiers;
}

/**
 * Perfect platoons for one Shabbos Mevorchim julian day.
 * Cached per date (new key, so a stale mission-mark cache is not reused).
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcPerfectPlatoonSoldiers(int $date): array
{
    static $memo = [];
    if (isset($memo[$date])) {
        return $memo[$date];
    }
    $produce = static function () use ($date) {
        return wwtcLoadPerfectPlatoonSoldiers($date);
    };
    if (function_exists('wwtcCached')) {
        $memo[$date] = wwtcCached('perfect_platoon_soldiers.' . $date, $produce);
    } else {
        $memo[$date] = $produce();
    }
    return $memo[$date];
}

/**
 * Replace a soldier's engine quota with an active override before the shared
 * said >= quota test. Cheshvan's as-of (or today's ladder) figure loses.
 * The soldier list cache stays the engine numbers; the override is applied
 * on the way out. userId is not copied into the public platoon rows.
 *
 * @param array<int,array<string,mixed>> $soldiers
 */
function wwtcApplyOverridesToPlatoonSoldiers(array $soldiers, int $date, int $year): array
{
    if ($year <= 0 || !function_exists('wwtcMonthNameForJd') || !function_exists('wwtcActiveOverridesForMonth')) {
        return $soldiers;
    }
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $soldiers;
    }
    $overs = wwtcActiveOverridesForMonth($year, $month);
    if (!$overs) {
        return $soldiers;
    }
    foreach ($soldiers as $i => $soldier) {
        $uid = (int) ($soldier['userId'] ?? 0);
        if ($uid <= 0 || !isset($overs[$uid])) {
            continue;
        }
        $eff = wwtcEffectiveQuota((int) ($soldier['quota'] ?? 0), $overs[$uid]);
        $soldiers[$i]['quota'] = $eff['quota'];
    }
    return $soldiers;
}

/**
 * Soldiers for one Shabbos Mevorchim after quota overrides and unaccepted
 * flags. This is the roster every Perfect Platoon surface reads.
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcCanonicalPlatoonSoldiers(int $date, ?int $year = null): array
{
    static $memo = [];
    if ($year === null && function_exists('wwtcYear')) {
        $year = wwtcYear();
    }
    $year = (int) $year;
    $key = $date . ':' . $year;
    if (isset($memo[$key])) {
        return $memo[$key];
    }
    $soldiers = wwtcApplyOverridesToPlatoonSoldiers(wwtcPerfectPlatoonSoldiers($date), $date, $year);
    return $memo[$key] = wwtcApplyFlagsToPlatoonSoldiers($soldiers, wwtcPlatoonFlagsForDate($date));
}

function wwtcPerfectPlatoonRows(int $date, ?int $year = null): array
{
    return wwtcPerfectPlatoonsFromSoldiers(wwtcCanonicalPlatoonSoldiers($date, $year));
}

/**
 * Holiday board soldiers, same shape as the regular roster. The board has
 * already applied quota overrides.
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcBoardPlatoonSoldiers(array $board): array
{
    $soldiers = [];
    foreach ($board['studentsBySchool'] ?? [] as $sid => $students) {
        foreach ($students as $s) {
            $cid = (int) ($s['classId'] ?? 0);
            $meta = $board['classMeta'][$cid] ?? [];
            $soldiers[] = [
                'schoolId' => (int) $sid,
                'school' => (string) ($board['schools'][$sid] ?? ''),
                'classId' => $cid,
                'grade' => (string) ($meta['grade'] ?? ''),
                'sub' => (string) ($meta['sub'] ?? ''),
                'teacher' => wwtcTeacherName($meta['teacher'] ?? ''),
                'quota' => (int) ($s['quota'] ?? 0),
                'said' => (int) ($s['said'] ?? 0),
                'userId' => (int) ($s['id'] ?? 0),
            ];
        }
    }
    return $soldiers;
}

/**
 * Stamp class rows with this roster. A class the report engine starred but
 * this roster does not is not perfect. A class the engine left out is added,
 * so the school page and the base report list the same platoons as home.
 * Kapitlach goal/done on a class the engine already returned are left alone.
 *
 * @param array<int,array<string,mixed>> $classes
 * @param array{classes?:array,soldiers?:array} $roster
 * @return array<int,array<string,mixed>>
 */
function wwtcAlignSchoolClasses(array $classes, array $roster, int $schoolId): array
{
    $index = [];
    foreach ($roster['classes'] ?? [] as $cid => $c) {
        if ((int) ($c['schoolId'] ?? 0) === $schoolId) {
            $index[(int) $cid] = $c;
        }
    }
    $seen = [];
    $out = [];
    foreach ($classes as $class) {
        $cid = (int) ($class['id'] ?? 0);
        $seen[$cid] = true;
        if (!isset($index[$cid])) {
            $class['perfect'] = false;
            $class['teacher'] = wwtcTeacherName($class['teacher'] ?? '');
            $out[] = $class;
            continue;
        }
        $c = $index[$cid];
        $class['name'] = $c['className'];
        $class['grade'] = $c['grade'];
        $rosterTeacher = wwtcTeacherName($c['teacher'] ?? '');
        if ($rosterTeacher !== '') {
            $class['teacher'] = $rosterTeacher;
        } else {
            $class['teacher'] = wwtcTeacherName($class['teacher'] ?? '');
        }
        $class['size'] = $c['size'];
        $class['met'] = $c['met'];
        $class['pctMet'] = $c['pctMet'];
        $class['perfect'] = $c['perfect'];
        $out[] = $class;
    }
    foreach ($index as $cid => $c) {
        if (isset($seen[$cid])) {
            continue;
        }
        $out[] = [
            'id' => $cid,
            'name' => $c['className'],
            'teacher' => wwtcTeacherName($c['teacher'] ?? ''),
            'grade' => $c['grade'],
            'size' => $c['size'],
            'said' => $c['said'],
            'quota' => $c['quota'],
            'pct' => $c['pct'],
            'met' => $c['met'],
            'pctMet' => $c['pctMet'],
            'participated' => 0,
            'pctParticipated' => 0,
            'minutesSaid' => 0,
            'minutesQuota' => 0,
            'minutesPct' => 0,
            'perfect' => $c['perfect'],
        ];
    }
    return $out;
}

/**
 * Per-soldier met/quota/said on a school payload follow the same roster, so a
 * platoon roll's check marks agree with the star. Soldiers the roster does
 * not include are left as the report returned them.
 *
 * @param array<int,array<string,mixed>> $students
 * @param array{classes?:array,soldiers?:array} $roster
 * @return array<int,array<string,mixed>>
 */
function wwtcApplyRosterToStudents(array $students, array $roster, int $schoolId): array
{
    $byUser = $roster['soldiers'] ?? [];
    if (!$byUser) {
        return $students;
    }
    foreach ($students as $i => $student) {
        $uid = (int) ($student['id'] ?? 0);
        if ($uid <= 0 || !isset($byUser[$uid])) {
            continue;
        }
        if ((int) ($byUser[$uid]['schoolId'] ?? 0) !== $schoolId) {
            continue;
        }
        $students[$i]['quota'] = $byUser[$uid]['quota'];
        $students[$i]['said'] = $byUser[$uid]['said'];
        $students[$i]['met'] = $byUser[$uid]['met'];
    }
    return $students;
}

/**
 * School classes view, base report, platoon report, and the Wednesday PDF
 * read wwtcSchoolData(). The engine totals stay. Perfect Platoon does not.
 */
function wwtcApplyPerfectRosterToSchool(array $data, int $schoolId, int $date, int $year): array
{
    $roster = wwtcPlatoonRoster(wwtcCanonicalPlatoonSoldiers($date, $year));
    $data['classes'] = wwtcAlignSchoolClasses($data['classes'] ?? [], $roster, $schoolId);
    $data['students'] = wwtcApplyRosterToStudents($data['students'] ?? [], $roster, $schoolId);
    return $data;
}
