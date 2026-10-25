<?php

declare(strict_types=1);

/**
 * Worldwide Tehillim Club API — router.
 *
 * Read-only first cut. The campaign numbers come from class.shabbosMevorchim.php
 * (the same class the WWTC report pages use), so this returns what those reports
 * show. Write endpoints return 405 until recording/ladder writes are designed
 * and signed off.
 *
 * Implemented and tested against live data: login (soldier + admin), /campaign,
 * /stats. The remaining read endpoints are scaffolded (501) and filled in next.
 */

require __DIR__ . '/bootstrap.php';

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

/** min(round(done/quota*100), 100), 0 when there is no quota. */
function wwtcPct($done, $quota): int
{
    $quota = (float) $quota;
    if ($quota <= 0) {
        return 0;
    }
    return (int) min(100, round(((float) $done / $quota) * 100));
}

/**
 * One school's current-month picture, built from ShabbosMevorchim::
 * setStudentResults() (the same per-student numbers the by-student report uses).
 * Returns ['classes' => [...], 'students' => [...]] for the current Shabbos
 * Mevorchim, Kapitelach. "perfect" here means every soldier met their own quota
 * (the SPA's definition), derived from the per-student rows.
 */
function wwtcSchoolData(int $schoolId): array
{
    $report = wwtcReport();
    $date = wwtcCurrentDate();
    $report->setSchool($schoolId);
    $report->setStudentResults($schoolId);
    $meta = (array) $report->getClasses();          // [class_id => ['grade','teacher']]
    $quotaRows = (array) $report->getStudentResults();      // [date][class][uid][key] = quota
    $doneRows = (array) $report->getStudentDoneResults();   // [date][class][uid][key] = done
    $names = (array) $report->getUsers();            // [uid => "First Last"]

    $classes = [];
    $students = [];
    foreach (($quotaRows[$date] ?? []) as $classId => $usersByKey) {
        $m = $meta[$classId] ?? ['grade' => '', 'teacher' => ''];
        $said = 0; $quota = 0; $size = 0; $met = 0;
        foreach ($usersByKey as $uid => $byKey) {
            $q = (int) ($byKey['Kapitelach'] ?? 0);
            $d = (int) ($doneRows[$date][$classId][$uid]['Kapitelach'] ?? 0);
            $isMet = $q > 0 && $d >= $q;
            $size++; $quota += $q; $said += $d; $met += $isMet ? 1 : 0;
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
            'perfect' => $size > 0 && $met === $size,
        ];
    }
    return ['classes' => $classes, 'students' => $students];
}

/**
 * A soldier's elapsed-month progress (quota/said/minutes per month, met), by
 * direct per-month queries mirroring ShabbosMevorchim::setStudentResults(): the
 * quota is the soldier's own date_tasks row for their track/level, the done is
 * MAX(done_qty) with the tehillim_backups fallback for sealed months.
 */
function wwtcKidMonths(array $kid): array
{
    global $MASHPIA_DB;
    $tasks = wwtcReport()->getTasks();           // ['Kapitelach'=>8001,'Minutes'=>8002]
    $kapitel = (int) ($tasks['Kapitelach'] ?? 8001);
    $minutes = (int) ($tasks['Minutes'] ?? 8002);

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
    $backupStmt = $MASHPIA_DB->prepare(
        'SELECT IFNULL(SUM(done_qty), 0) FROM tehillim_backups
          WHERE sm_date = :d AND grid_id = :grid AND user_id = :uid'
    );

    $qFor = function (int $grid, int $d) use ($quotaStmt, $kid): int {
        $quotaStmt->execute([
            ':grid' => $grid, ':d' => $d, ':st' => (int) $kid['school_type_id'],
            ':track' => (int) $kid['track_id'], ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
        ]);
        return (int) ($quotaStmt->fetchColumn() ?: 0);
    };
    $dFor = function (int $grid, int $d) use ($doneStmt, $backupStmt, $kid): int {
        $backupStmt->execute([':d' => $d, ':grid' => $grid, ':uid' => (int) $kid['user_id']]);
        $backup = (int) ($backupStmt->fetchColumn() ?: 0);
        if ($backup > 0) {
            return $backup;
        }
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
    $stmt = $MASHPIA_DB->prepare('SELECT admin_id, auth, first, last, username, school_id FROM admins WHERE admin_id = :id LIMIT 1');
    $stmt->execute([':id' => $adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $token = wwtcIssueToken('admin', $adminId, ['auth' => $admin['auth'] ?? '']);
    wwtcJson([
        'token' => $token,
        'expiresIn' => (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200),
        'admin' => [
            'kind' => ($admin['auth'] ?? '') === 'super' ? 'super' : 'school',
            'name' => trim(($admin['first'] ?? '') . ' ' . ($admin['last'] ?? '')),
            'username' => $admin['username'] ?? $username,
            'schoolId' => isset($admin['school_id']) ? (int) $admin['school_id'] : null,
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
    $report = wwtcReport($current);
    $report->setArmyResults();
    $army = $report->getArmyResults();          // [Kapitelach][jd] => quota
    $armyDone = $report->getArmyDoneResults();   // [Kapitelach][jd] => done
    $quota = (int) ($army['Kapitelach'][$current] ?? 0);
    $done = (int) ($armyDone['Kapitelach'][$current] ?? 0);

    // Minutes aren't computed by setArmyResults(); one direct pair of queries,
    // mirroring that method's SQL with the Minutes grid id (8002).
    $tasks = $report->getTasks();
    $minutesGrid = (int) ($tasks['Minutes'] ?? 8002);
    $qStmt = $MASHPIA_DB->prepare(
        'SELECT SUM(dt.quantity) AS total
           FROM date_tasks dt
           JOIN date_tasks_missions dtm USING (date_tasks_mission_id)
           JOIN user_tracks ut USING (track_id, level, subject_id)
           JOIN users u USING (user_id)
           JOIN schools s USING (school_id)
           JOIN classes c USING (class_id)
          WHERE ut.subject_id = :subj AND ut.enrolled = 1
            AND dtm.start_date = :d AND dtm.end_date = :d
            AND dtm.school_type_id = u.school_type_id AND dt.grid_id = :grid
            AND s.school_era IS NULL AND c.class_era = 0
            AND u.user_registered > 0 AND u.school_id != 612
            AND u.lang_id = dtm.lang_id'
    );
    $qStmt->execute([':subj' => WWTC_SUBJECT_ID, ':d' => $current, ':grid' => $minutesGrid]);
    $minutesQuota = (int) ($qStmt->fetchColumn() ?: 0);
    $dStmt = $MASHPIA_DB->prepare(
        'SELECT SUM(dtm.done_qty) AS total
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
          WHERE dtmm.start_date = :d AND dtmm.end_date = :d AND dt.grid_id = :grid'
    );
    $dStmt->execute([':d' => $current, ':grid' => $minutesGrid]);
    $minutes = (int) ($dStmt->fetchColumn() ?: 0);

    // Counts, with the same roster filters the army query uses.
    $soldiers = (int) $MASHPIA_DB->query(
        'SELECT COUNT(DISTINCT u.user_id)
           FROM users u
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s USING (school_id)
           JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
          WHERE u.user_registered > 0 AND s.school_era IS NULL AND c.class_era = 0 AND u.school_id != 612'
    )->fetchColumn();
    $schools = (int) $MASHPIA_DB->query(
        'SELECT COUNT(*) FROM schools s
           JOIN school_subjects ss USING (school_id)
          WHERE s.school_era IS NULL AND ss.subject_id = ' . WWTC_SUBJECT_ID . '
            AND s.chayolei = 1 AND s.test_school = 0 AND s.school_id NOT IN (82, 612)'
    )->fetchColumn();
    $classes = (int) $MASHPIA_DB->query(
        'SELECT COUNT(DISTINCT c.class_id)
           FROM classes c
           JOIN users u ON u.class_id = c.class_id AND u.school_id = c.school_id AND u.user_registered > 0
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s ON s.school_id = c.school_id
          WHERE c.class_era = 0 AND s.school_era IS NULL AND c.school_id != 612'
    )->fetchColumn();

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
        'schools' => $schools,
        'classes' => $classes,
    ]);
}

// ---- nationwide school list ------------------------------------------------

if ($method === 'GET' && $path === '/schools') {
    $current = wwtcCurrentDate();
    $names = wwtcEligibleSchools();

    $quota = $MASHPIA_DB->prepare(
        'SELECT u.school_id, SUM(dt.quantity) total
           FROM date_tasks dt
           JOIN date_tasks_missions dtm USING (date_tasks_mission_id)
           JOIN user_tracks ut USING (track_id, level, subject_id)
           JOIN users u USING (user_id)
           JOIN classes c ON c.class_id = u.class_id
          WHERE ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
            AND dtm.start_date = :d AND dtm.end_date = :d AND dt.grid_id = 8001
            AND dtm.school_type_id = u.school_type_id AND u.user_registered > 0
            AND c.class_era = 0 AND u.lang_id = dtm.lang_id
          GROUP BY u.school_id'
    );
    $quota->execute([':d' => $current]);
    $quotaBy = $quota->fetchAll(PDO::FETCH_KEY_PAIR);

    $done = $MASHPIA_DB->prepare(
        'SELECT u.school_id, SUM(dtm.done_qty) total
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
           JOIN users u USING (user_id)
          WHERE dtmm.start_date = :d AND dtmm.end_date = :d AND dt.grid_id = 8001
          GROUP BY u.school_id'
    );
    $done->execute([':d' => $current]);
    $doneBy = $done->fetchAll(PDO::FETCH_KEY_PAIR);

    $kids = $MASHPIA_DB->query(
        'SELECT u.school_id, COUNT(DISTINCT u.user_id) total
           FROM users u
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
          WHERE u.user_registered > 0
          GROUP BY u.school_id'
    )->fetchAll(PDO::FETCH_KEY_PAIR);

    $rows = [];
    foreach ($names as $id => $name) {
        $said = (int) ($doneBy[$id] ?? 0);
        $q = (int) ($quotaBy[$id] ?? 0);
        $rows[] = [
            'id' => (int) $id,
            'name' => $name,
            'kids' => (int) ($kids[$id] ?? 0),
            'saidMonth' => $said,
            'quotaMonth' => $q,
            'pct' => wwtcPct($said, $q),
        ];
    }
    usort($rows, static function ($a, $b) {
        return $b['saidMonth'] <=> $a['saidMonth'] ?: strcmp($a['name'], $b['name']);
    });
    wwtcJson(['month' => wwtcMonthForDate($current), 'schools' => $rows]);
}

// ---- one school -------------------------------------------------------------

if ($method === 'GET' && preg_match('#^/schools/(\d+)$#', $path, $m)) {
    $id = (int) $m[1];
    $names = wwtcEligibleSchools();
    if (!isset($names[$id])) {
        wwtcError('School not found.', 404);
    }
    $data = wwtcSchoolData($id);
    $kids = 0; $said = 0; $quota = 0; $met = 0;
    foreach ($data['classes'] as $c) {
        $kids += $c['size']; $said += $c['said']; $quota += $c['quota']; $met += $c['met'];
    }
    wwtcJson([
        'id' => $id,
        'name' => $names[$id],
        'kids' => $kids,
        'saidMonth' => $said,
        'quotaMonth' => $quota,
        'pct' => wwtcPct($said, $quota),
        'metMonth' => $met,
        'pctMet' => $kids > 0 ? (int) round($met / $kids * 100) : 0,
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
    wwtcRequireActor(['admin']); // returns real soldiers' names — admin only
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
                 WHERE u2.school_id = :id AND dt.grid_id = 8001
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
// "Perfect platoon" here is the live report's definition: a class whose total
// done reached its total quota (ShabbosMevorchim::setClassResults populates
// ->perfectPlatoons). This loops every eligible school, so it leans on the
// class's 15-minute cache; the first call after expiry is slow.

if ($method === 'GET' && $path === '/perfect-platoons') {
    $report = wwtcReport();
    $out = [];
    foreach (wwtcEligibleSchools() as $id => $name) {
        $report->setSchool((int) $id);
        $report->setClassResults();
        foreach ((array) $report->perfectPlatoons as $grade => $platoons) {
            foreach ($platoons as $p) {
                $out[] = [
                    'schoolId' => (int) $id,
                    'school' => $name,
                    'grade' => (string) $grade,
                    'teacher' => (string) ($p['teacher'] ?? ''),
                ];
            }
        }
    }
    wwtcJson(['month' => wwtcMonthForDate(wwtcCurrentDate()), 'platoons' => $out]);
}

// ---- reports ----------------------------------------------------------------

if ($method === 'GET' && $path === '/reports/army') {
    $current = wwtcCurrentDate();
    $names = wwtcEligibleSchools();

    // One row per user: their quota for the month and their done, then aggregate
    // per school in PHP (avoids a per-school query loop).
    $uQuota = $MASHPIA_DB->prepare(
        'SELECT u.user_id, u.school_id, dt.quantity q
           FROM date_tasks dt
           JOIN date_tasks_missions dtm USING (date_tasks_mission_id)
           JOIN user_tracks ut USING (track_id, level, subject_id)
           JOIN users u USING (user_id)
           JOIN classes c ON c.class_id = u.class_id
          WHERE ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
            AND dtm.start_date = :d AND dtm.end_date = :d AND dt.grid_id = 8001
            AND dtm.school_type_id = u.school_type_id AND u.user_registered > 0
            AND c.class_era = 0 AND u.lang_id = dtm.lang_id'
    );
    $uQuota->execute([':d' => $current]);

    $uDone = $MASHPIA_DB->prepare(
        'SELECT dtm.user_id, MAX(dtm.done_qty) d
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
          WHERE dtmm.start_date = :d AND dtmm.end_date = :d AND dt.grid_id = 8001
          GROUP BY dtm.user_id'
    );
    $uDone->execute([':d' => $current]);
    $doneByUser = $uDone->fetchAll(PDO::FETCH_KEY_PAIR);

    $agg = [];
    foreach ($uQuota->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $sid = (int) $r['school_id'];
        if (!isset($names[$sid])) {
            continue;
        }
        $q = (int) $r['q'];
        $d = (int) ($doneByUser[$r['user_id']] ?? 0);
        $a = &$agg[$sid];
        $a['registered'] = ($a['registered'] ?? 0) + 1;
        $a['goal'] = ($a['goal'] ?? 0) + $q;
        $a['accomplished'] = ($a['accomplished'] ?? 0) + $d;
        $a['participated'] = ($a['participated'] ?? 0) + ($d > 0 ? 1 : 0);
        $a['met'] = ($a['met'] ?? 0) + ($q > 0 && $d >= $q ? 1 : 0);
        unset($a);
    }

    $rows = [];
    foreach ($names as $id => $name) {
        $a = $agg[$id] ?? ['registered' => 0, 'goal' => 0, 'accomplished' => 0, 'participated' => 0, 'met' => 0];
        $reg = (int) $a['registered'];
        $rows[] = [
            'id' => (int) $id,
            'name' => $name,
            'registered' => $reg,
            'goal' => (int) $a['goal'],
            'accomplished' => (int) $a['accomplished'],
            'pctParticipated' => $reg ? (int) round($a['participated'] / $reg * 100) : 0,
            'pctMet' => $reg ? (int) round($a['met'] / $reg * 100) : 0,
        ];
    }
    wwtcJson(['month' => wwtcMonthForDate($current), 'rows' => $rows]);
}

if ($method === 'GET' && preg_match('#^/reports/base/(\d+)$#', $path, $m)) {
    $id = (int) $m[1];
    $names = wwtcEligibleSchools();
    if (!isset($names[$id])) {
        wwtcError('School not found.', 404);
    }
    $classes = wwtcSchoolData($id)['classes'];
    $rows = [];
    foreach ($classes as $c) {
        $rows[] = [
            'id' => $c['id'],
            'name' => $c['name'],
            'grade' => $c['grade'],
            'size' => $c['size'],
            'goal' => $c['quota'],
            'accomplished' => $c['said'],
            'completed' => $c['met'],
            'perfect' => $c['perfect'],
        ];
    }
    wwtcJson(['month' => wwtcMonthForDate(wwtcCurrentDate()), 'school' => $names[$id], 'schoolId' => $id, 'rows' => $rows]);
}

if ($method === 'GET' && preg_match('#^/reports/platoon/(\d+)$#', $path, $m)) {
    wwtcRequireActor(['admin']); // per-child rows with real names — admin only
    $classId = (int) $m[1];
    $schoolId = (int) ($MASHPIA_DB->query('SELECT school_id FROM classes WHERE class_id = ' . $classId)->fetchColumn() ?: 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('Class not found.', 404);
    }
    $data = wwtcSchoolData($schoolId);
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
            'said' => $s['said'],
            'met' => $s['met'],
        ];
    }
    wwtcJson([
        'month' => wwtcMonthForDate(wwtcCurrentDate()),
        'className' => $className,
        'completed' => $completed,
        'size' => count($rows),
        'rows' => $rows,
    ]);
}

// ---- the signed-in soldier --------------------------------------------------

if ($method === 'GET' && $path === '/me/progress') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    $months = wwtcKidMonths($kid);
    $metThisYear = 0;
    foreach ($months as $mo) {
        $metThisYear += $mo['met'] ? 1 : 0;
    }
    $current = null;
    foreach ($months as $mo) {
        if ($mo['isCurrent']) {
            $current = $mo;
            break;
        }
    }
    wwtcJson(array_merge(wwtcSafeKid($kid), [
        'months' => $months,
        'metThisYear' => $metThisYear,
        'missionsTotal' => $metThisYear, // no cross-year history here
        'priorMissions' => 0,
        'medal' => null,                 // medal logic stays client-side / demo for now
        'current' => $current,
    ]));
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

    // School standing nationwide, by kapitlach this month.
    $current = wwtcCurrentDate();
    $done = $MASHPIA_DB->prepare(
        'SELECT u.school_id, SUM(dtm.done_qty) total
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
           JOIN users u USING (user_id)
          WHERE dtmm.start_date = :d AND dtmm.end_date = :d AND dt.grid_id = 8001
          GROUP BY u.school_id'
    );
    $done->execute([':d' => $current]);
    $doneBy = $done->fetchAll(PDO::FETCH_KEY_PAIR);
    $ranked = [];
    foreach (wwtcEligibleSchools() as $sid => $name) {
        $ranked[$sid] = (int) ($doneBy[$sid] ?? 0);
    }
    arsort($ranked);
    $schoolRank = array_search($schoolId, array_keys($ranked), true);
    $schoolRank = $schoolRank === false ? 0 : $schoolRank + 1;

    wwtcJson([
        'className' => $className,
        'classRank' => $classRank,
        'totalClasses' => count($classes),
        'classAheadName' => $aheadName,
        'myRankInClass' => $myRank,
        'classSize' => $classSize,
        'schoolName' => $kid['school_name'] ?? null,
        'schoolRank' => $schoolRank,
        'totalSchools' => count($ranked),
    ]);
}

// ---- writes: not available (read-only first cut) ---------------------------

$writeRoutes = [
    ['POST', '#^/me/report$#'],
    ['PUT', '#^/me/ladder$#'],
    ['POST', '#^/me/ladder$#'],
    ['PATCH', '#^/schools/\d+/dedication$#'],
];
foreach ($writeRoutes as [$verb, $pattern]) {
    if ($method === $verb && preg_match($pattern, $path)) {
        wwtcError('Recording and ladder changes are handled by HQ for now.', 405);
    }
}

wwtcError('Not found: ' . $method . ' ' . $path, 404);
