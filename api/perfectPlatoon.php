<?php

declare(strict_types=1);

/**
 * One definition of a Perfect Platoon, shared by the school classes view and
 * GET /perfect-platoons (home list, home count, /stats).
 *
 * A class is perfect when it has at least one soldier and every soldier on
 * that month's roster has said at least their own kapitlach quota. "Said" is
 * MAX(done_qty) on live date_tasks_marks. "Quota" is that soldier's kapitlach
 * task (date_tasks.quantity) for the ladder they were on for that Shabbos
 * Mevorchim. That is the same test the class report uses (setStudentResults
 * with setUseLiveData): $quota > 0 && $said >= $quota, then met === size.
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
 * @param array<int,array<string,mixed>> $soldiers
 *   schoolId, school, classId, grade, sub, teacher, quota, said.
 *   A name or user id on the input is ignored.
 * @return array<int,array<string,mixed>>
 */
function wwtcPerfectPlatoonsFromSoldiers(array $soldiers): array
{
    $byClass = [];
    foreach ($soldiers as $s) {
        $cid = (int) ($s['classId'] ?? 0);
        $sid = (int) ($s['schoolId'] ?? 0);
        if ($cid <= 0 || $sid <= 0) {
            continue;
        }
        if (!isset($byClass[$cid])) {
            $byClass[$cid] = [
                'schoolId' => $sid,
                'school' => (string) ($s['school'] ?? ''),
                'classId' => $cid,
                'grade' => (string) ($s['grade'] ?? ''),
                'sub' => (string) ($s['sub'] ?? ''),
                'teacher' => (string) ($s['teacher'] ?? ''),
                'size' => 0,
                'met' => 0,
            ];
        }
        $byClass[$cid]['size']++;
        if (wwtcSoldierMetQuota((int) ($s['quota'] ?? 0), (int) ($s['said'] ?? 0))) {
            $byClass[$cid]['met']++;
        }
    }

    $classesBySchool = [];
    foreach ($byClass as $c) {
        $classesBySchool[$c['schoolId']] = ($classesBySchool[$c['schoolId']] ?? 0) + 1;
    }

    $platoons = [];
    foreach ($byClass as $c) {
        if (!wwtcClassIsPerfect($c['met'], $c['size'])) {
            continue;
        }
        $platoons[] = [
            'schoolId' => $c['schoolId'],
            'school' => $c['school'],
            'classId' => $c['classId'],
            'className' => wwtcPlatoonClassName($c['grade'], $c['sub']),
            'teacher' => $c['teacher'],
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
            'teacher' => (string) ($row['class_teacher'] ?? ''),
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
function wwtcPerfectPlatoonRows(int $date): array
{
    static $memo = [];
    if (isset($memo[$date])) {
        return $memo[$date];
    }
    $produce = static function () use ($date) {
        return wwtcPerfectPlatoonsFromSoldiers(wwtcLoadPerfectPlatoonSoldiers($date));
    };
    if (function_exists('wwtcCached')) {
        $memo[$date] = wwtcCached('perfect_platoons.' . $date, $produce);
    } else {
        $memo[$date] = $produce();
    }
    return $memo[$date];
}
