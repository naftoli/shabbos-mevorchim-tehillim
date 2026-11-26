<?php

declare(strict_types=1);

/**
 * Admin writes: ladders, school year, dedications, HQ verify, custom ladders,
 * quota overrides, and flag review. Loaded by index.php with $method / $path set.
 */

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

    // The closest switch wins: one child, else the class, else the school.
    // A whole-class assignment uses the class switch and does not look at
    // each child's own row. The child's picker still hides a ladder that is
    // off for that child.
    if (function_exists('wwtcLadderOpenForScope') && !wwtcLadderOpenForScope($ladder, $schoolId, $classId, $kidId)) {
        if ($kidId) {
            wwtcError('That ladder is turned off for this child.', 422);
        }
        if ($classId) {
            wwtcError('That ladder is turned off for this class.', 422);
        }
        wwtcError('That ladder is turned off for this school.', 422);
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

    wwtcAfterWrite();

    wwtcJson(['ok' => true, 'matched' => $matched, 'updated' => $changed, 'ladder' => $ladder]);
}

// School year start. The picked month is that school's first Shabbos Mevorchim
// (Mevorchim of the month) and quota position 1. No student names.
// HQ (auth super) may set the month for any school, and may turn on
// allowSchoolPick so that school's admin can pick. The switch is off until
// HQ turns it on. A school admin who sends firstMonth while it is off is
// rejected. Missing first_month table → 503. Missing allow_school_pick
// column → the switch stays off and only a request that tries to change it
// returns 503 (existing months still save for HQ).
if (($method === 'PUT' || $method === 'POST') && $path === '/admin/school-year') {
    $input = wwtcInput();
    $schoolId = (int) ($input['schoolId'] ?? 0);
    $hasMonth = array_key_exists('firstMonth', $input);
    $hasPick = array_key_exists('allowSchoolPick', $input);
    $firstMonth = $hasMonth ? trim((string) $input['firstMonth']) : '';
    if ($hasMonth && !in_array($firstMonth, wwtcPlainMonthNames(), true)) {
        wwtcError('Choose the month the school year starts in.', 422);
    }
    if (!$hasMonth && !$hasPick) {
        wwtcError('Choose the month the school year starts in.', 422);
    }
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    $actor = wwtcRequireSchoolAdmin($schoolId);
    if ($hasPick && (($actor['auth'] ?? '') !== 'super')) {
        wwtcError('Only HQ can let a school pick its start month.', 403);
    }
    if ($hasMonth && !wwtcActorMaySetSchoolYear($actor, wwtcSchoolAllowsOwnStart($schoolId))) {
        wwtcError('Only HQ can change the start month for this school.', 403);
    }
    if ($hasMonth && !wwtcSchoolSettingsReady()) {
        wwtcError('School-year storage is not installed yet. Run api/sql/wwtc_school_settings.sql on mashpia.', 503);
    }
    if ($hasPick && !wwtcSchoolPickReady()) {
        wwtcError('The school start-month switch is not installed yet. Run api/sql/wwtc_school_year_pick.sql on mashpia.', 503);
    }
    if ($hasMonth) {
        wwtcSaveSchoolFirstMonth($schoolId, $firstMonth);
    }
    $allow = $hasPick
        ? wwtcAllowSchoolPickFromRow(['allowSchoolPick' => $input['allowSchoolPick']])
        : wwtcSchoolAllowsOwnStart($schoolId);
    if ($hasPick) {
        wwtcSaveSchoolAllowsOwnStart($schoolId, $allow);
    }
    $savedMonth = $hasMonth ? $firstMonth : wwtcSchoolFirstMonth($schoolId);
    wwtcAfterWrite();
    wwtcJson([
        'ok' => true,
        'schoolId' => $schoolId,
        'firstMonth' => $savedMonth,
        'gradeEnds' => wwtcGradeEndMonth($savedMonth),
        'allowSchoolPick' => $allow,
    ]);
}

// Which ladders this school offers, including class and child overrides.
// HQ or that school's admin. Class names only. Child rows are ids — names
// stay on the staff platoon roll and are not in this payload.
if ($method === 'GET' && $path === '/admin/school-ladders') {
    $schoolId = (int) ($_GET['schoolId'] ?? 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    wwtcRequireSchoolAdmin($schoolId);
    wwtcJson(wwtcSchoolLadderAdminPayload($schoolId));
}

// Which ladders this school offers. HQ or that school's admin. Missing table
// is a 503, same as the school-year setting. No student names.
// `hidden` is the whole-school off list (unchanged). `classes` and `children`,
// when present, replace that school's explicit overrides. Omit them to leave
// class and child rows alone.
if (($method === 'PUT' || $method === 'POST') && $path === '/admin/school-ladders') {
    $input = wwtcInput();
    $schoolId = (int) ($input['schoolId'] ?? 0);
    if (!$schoolId || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    wwtcRequireSchoolAdmin($schoolId);
    if (!wwtcSchoolLaddersReady()) {
        wwtcError('Ladder switches are not installed yet. Run api/sql/wwtc_school_ladders.sql on mashpia.', 503);
    }
    $hasScopes = array_key_exists('classes', $input) || array_key_exists('children', $input);
    if ($hasScopes && !wwtcLadderScopesReady()) {
        wwtcError('Ladder switches for a class or a child are not installed yet. Run api/sql/wwtc_ladder_scopes.sql on mashpia.', 503);
    }
    $hidden = wwtcNormalizeHiddenLadders($input['hidden'] ?? $input['ladders'] ?? []);
    $classRows = null;
    $childRows = null;
    $classByUser = [];
    if (array_key_exists('classes', $input)) {
        $classRows = wwtcNormalizeScopeRows($input['classes'], 'classId');
        wwtcAssertClassesInSchool($schoolId, array_column($classRows, 'id'));
    }
    if (array_key_exists('children', $input)) {
        $childRows = wwtcNormalizeScopeRows($input['children'], 'userId');
        $classByUser = wwtcAssertChildrenInSchool($schoolId, array_column($childRows, 'id'));
    }
    $MASHPIA_DB->beginTransaction();
    try {
        wwtcSaveHiddenLadders($schoolId, $hidden);
        if ($hasScopes) {
            wwtcSaveLadderScopes($schoolId, $classRows, $childRows, $classByUser);
        }
        $MASHPIA_DB->commit();
    } catch (Throwable $e) {
        if ($MASHPIA_DB->inTransaction()) {
            $MASHPIA_DB->rollBack();
        }
        throw $e;
    }
    wwtcAfterWrite();
    wwtcJson(wwtcSchoolLadderAdminPayload($schoolId));
}

/**
 * @param list<int> $classIds
 */
function wwtcAssertClassesInSchool(int $schoolId, array $classIds): void
{
    $unique = [];
    foreach ($classIds as $id) {
        $id = (int) $id;
        if ($id > 0) {
            $unique[$id] = $id;
        }
    }
    if (!$unique) {
        return;
    }
    global $MASHPIA_DB;
    $ids = array_values($unique);
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $MASHPIA_DB->prepare(
        'SELECT class_id FROM classes WHERE school_id = ? AND class_id IN (' . $marks . ')'
    );
    $stmt->execute(array_merge([$schoolId], $ids));
    $found = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $found[(int) $id] = true;
    }
    if (count($found) !== count($ids)) {
        wwtcError('That class is not in this school.', 422);
    }
}

/**
 * @param list<int> $userIds
 * @return array<int,int> user_id => class_id
 */
function wwtcAssertChildrenInSchool(int $schoolId, array $userIds): array
{
    $unique = [];
    foreach ($userIds as $id) {
        $id = (int) $id;
        if ($id > 0) {
            $unique[$id] = $id;
        }
    }
    if (!$unique) {
        return [];
    }
    global $MASHPIA_DB;
    $ids = array_values($unique);
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $MASHPIA_DB->prepare(
        'SELECT user_id, class_id FROM users WHERE school_id = ? AND user_id IN (' . $marks . ')'
    );
    $stmt->execute(array_merge([$schoolId], $ids));
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $classId = (int) $row['class_id'];
        if ($classId <= 0) {
            wwtcError('That soldier is not in this school.', 422);
        }
        $out[(int) $row['user_id']] = $classId;
    }
    if (count($out) !== count($ids)) {
        wwtcError('That soldier is not in this school.', 422);
    }
    return $out;
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
    wwtcAfterWrite();
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
    wwtcAfterWrite();
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
    wwtcAfterWrite();
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
    wwtcAfterWrite();
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
    return function_exists('wwtcAdminLabel') ? wwtcAdminLabel($adminId) : 'Admin';
}

if ($method === 'GET' && $path === '/admin/flags') {
    $actor = wwtcRequireActor(['admin']);
    if (!wwtcFlagsReady()) {
        wwtcError('Flag review is not installed yet. Run api/sql/wwtc_flagged_entries.sql on mashpia.', 503);
    }
    wwtcJson(wwtcListFlags(wwtcFlagReviewSchools($actor)));
}

// Accept and remove also reverse each other. An accepted row can be removed
// (prior mark, or a cleared month) and a removed row can be accepted (the
// flagged kapitlach and minutes). wwtcReviewStoredFlag applies that in one
// transaction, writes the decision, and flushes the file cache.
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
