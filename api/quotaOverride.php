<?php

/**
 * One-month quota override for a base commander (and HQ).
 *
 * The soldier's ladder and every other month stay as they are. For the chosen
 * month the quota becomes the kapitlach they actually entered, so that month
 * counts as met. Cheshvan is often repriced from today's ladder (the report
 * engine, and wwtcTrackAsOf when no earlier history exists). An active override
 * replaces that number; it is not fed back into the ladder.
 *
 * Storage is api/sql/wwtc_quota_overrides.sql. This file does not run it.
 */

/**
 * 200 when this admin may override a soldier in $kidSchoolId, otherwise 403.
 * HQ (auth super) may override any school. A base commander may override only
 * a school listed in their admin_auths auth=school rows. A class teacher,
 * a soldier, and a commander from another school are refused.
 *
 * @param array|null $actor
 * @param int[] $adminSchoolIds
 */
function wwtcOverrideStatus($actor, int $kidSchoolId, array $adminSchoolIds = []): int
{
    if (!function_exists('wwtcCanManageSchool')) {
        require_once __DIR__ . '/platoonRoll.php';
    }
    return wwtcCanManageSchool($actor, $kidSchoolId, $adminSchoolIds) ? 200 : 403;
}

function wwtcOverrideIsActive(?array $override): bool
{
    return is_array($override) && empty($override['undone_at']);
}

/**
 * Effective kapitlach quota. $engineQuota is whatever the month was priced at,
 * including Cheshvan taken from today's ladder. An active override wins.
 *
 * @return array{quota:int,originalQuota:int,quotaAdjusted:bool,reason:?string}
 */
function wwtcEffectiveQuota(int $engineQuota, ?array $override): array
{
    if (!wwtcOverrideIsActive($override)) {
        return [
            'quota' => $engineQuota,
            'originalQuota' => $engineQuota,
            'quotaAdjusted' => false,
            'reason' => null,
        ];
    }
    $original = array_key_exists('original_quota', $override)
        ? (int) $override['original_quota']
        : $engineQuota;
    return [
        'quota' => (int) $override['overridden_quota'],
        'originalQuota' => $original,
        'quotaAdjusted' => true,
        'reason' => isset($override['reason']) && $override['reason'] !== ''
            ? (string) $override['reason']
            : null,
    ];
}

function wwtcMetKapQuota(int $quota, int $said, bool $reported = true): bool
{
    return $reported && $quota > 0 && $said >= $quota;
}

/**
 * Replace one soldier row's quota and met flag. Adds quotaDelta (new - engine)
 * so a class or school total can shrink by the same amount the engine had added.
 */
function wwtcApplyOverrideToStudent(array $student, ?array $override): array
{
    $engine = (int) ($student['quota'] ?? 0);
    $said = (int) ($student['said'] ?? 0);
    $reported = array_key_exists('reported', $student) ? (bool) $student['reported'] : true;
    $eff = wwtcEffectiveQuota($engine, $override);
    $student['engineQuota'] = $engine;
    $student['quota'] = $eff['quota'];
    $student['originalQuota'] = $eff['originalQuota'];
    $student['quotaAdjusted'] = $eff['quotaAdjusted'];
    $student['overrideReason'] = $eff['reason'];
    $student['met'] = wwtcMetKapQuota($eff['quota'], $said, $reported);
    $student['quotaDelta'] = $eff['quota'] - $engine;
    return $student;
}

/**
 * One class after its soldiers' overrides. $class['quota'] is the engine total
 * (Cheshvan may already be today's ladder). Each overridden soldier replaces
 * their own share of that total.
 *
 * @param array<int,array> $overridesByUser
 * @return array{class:array,students:array}
 */
function wwtcClassAfterOverrides(array $class, array $students, array $overridesByUser): array
{
    $delta = 0;
    $met = 0;
    $adjusted = [];
    foreach ($students as $student) {
        $before = (int) ($student['quota'] ?? 0);
        $uid = (int) ($student['id'] ?? 0);
        $next = wwtcApplyOverrideToStudent($student, $overridesByUser[$uid] ?? null);
        $delta += (int) $next['quota'] - $before;
        $met += !empty($next['met']) ? 1 : 0;
        unset($next['engineQuota'], $next['quotaDelta']);
        $adjusted[] = $next;
    }
    $size = (int) ($class['size'] ?? count($students));
    $quota = (int) ($class['quota'] ?? 0) + $delta;
    $said = (int) ($class['said'] ?? 0);
    $class['quota'] = $quota;
    $class['met'] = $met;
    $class['pct'] = function_exists('wwtcPct') ? wwtcPct($said, $quota) : ($quota > 0 ? (int) round($said / $quota * 100) : 0);
    $class['pctMet'] = $size > 0 ? (int) round($met / $size * 100) : 0;
    $class['perfect'] = $size > 0 && $met === $size;
    return ['class' => $class, 'students' => $adjusted];
}

/**
 * @param array<int,array> $overridesByUser user_id => override row
 */
function wwtcOverlaySchoolData(array $data, int $date, int $year): array
{
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $data;
    }
    $overs = wwtcActiveOverridesForMonth($year, $month);
    if (!$overs) {
        return $data;
    }
    $byClass = [];
    foreach ($data['students'] ?? [] as $student) {
        $byClass[(int) ($student['classId'] ?? 0)][] = $student;
    }
    $students = [];
    $classes = [];
    foreach ($data['classes'] ?? [] as $class) {
        $cid = (int) ($class['id'] ?? 0);
        $kids = $byClass[$cid] ?? [];
        if (!$kids) {
            $classes[] = $class;
            continue;
        }
        $done = wwtcClassAfterOverrides($class, $kids, $overs);
        $classes[] = $done['class'];
        foreach ($done['students'] as $student) {
            $students[] = $student;
        }
        unset($byClass[$cid]);
    }
    foreach ($byClass as $kids) {
        foreach ($kids as $student) {
            $next = wwtcApplyOverrideToStudent($student, $overs[(int) ($student['id'] ?? 0)] ?? null);
            unset($next['engineQuota'], $next['quotaDelta']);
            $students[] = $next;
        }
    }
    $out = $data;
    $out['students'] = $students;
    $out['classes'] = $classes;
    return $out;
}

/**
 * Personal-page months. $months already carry the engine quota — for Cheshvan
 * that may be today's ladder. The override replaces it for that month only.
 *
 * @param array<int,array> $months
 * @param array<string,array> $overridesByMonth month name => override row
 */
function wwtcOverlayKidMonthList(array $months, array $overridesByMonth): array
{
    if (!$overridesByMonth) {
        return $months;
    }
    foreach ($months as $i => $month) {
        $name = (string) ($month['month'] ?? '');
        if ($name === '' || !isset($overridesByMonth[$name])) {
            continue;
        }
        $reported = !empty($month['reported']);
        $next = wwtcApplyOverrideToStudent([
            'quota' => (int) ($month['quota'] ?? 0),
            'said' => (int) ($month['said'] ?? 0),
            'reported' => $reported,
        ], $overridesByMonth[$name]);
        $months[$i]['quota'] = $next['quota'];
        $months[$i]['originalQuota'] = $next['originalQuota'];
        $months[$i]['quotaAdjusted'] = $next['quotaAdjusted'];
        $months[$i]['met'] = $next['met'];
    }
    return $months;
}

/**
 * Mission-mark completion counts do not see an override on their own.
 * Count a soldier as met when an active override covers this month and they
 * do not already have a mission mark (that mark is already in the count).
 *
 * @param array<int,array> $overrides rows with user_id, school_id, class_id
 * @param array<int,true> $markedUserIds
 */
function wwtcOverlayCompletionCounts(array $counts, array $overrides, array $markedUserIds): array
{
    if (!$overrides) {
        return $counts;
    }
    $metBySchool = $counts['metBySchool'] ?? [];
    $metByClass = $counts['metByClass'] ?? [];
    foreach ($overrides as $row) {
        $uid = (int) ($row['user_id'] ?? 0);
        if ($uid && isset($markedUserIds[$uid])) {
            continue;
        }
        $sid = (int) ($row['school_id'] ?? 0);
        $cid = (int) ($row['class_id'] ?? 0);
        $classRow = $metByClass[$sid] ?? [];
        $classRow[$cid] = (int) ($classRow[$cid] ?? 0) + 1;
        $metByClass[$sid] = $classRow;
        $metBySchool[$sid] = (int) ($metBySchool[$sid] ?? 0) + 1;
    }
    $out = $counts;
    $out['metBySchool'] = $metBySchool;
    $out['metByClass'] = $metByClass;
    return $out;
}

/**
 * @param array<int,int> $deltas school_id => quota change (override - engine)
 */
function wwtcOverlayKapGoals(array $kapGoal, array $deltas): array
{
    foreach ($deltas as $sid => $delta) {
        $kapGoal[(int) $sid] = (int) ($kapGoal[(int) $sid] ?? 0) + (int) $delta;
    }
    return $kapGoal;
}

function wwtcMonthNameForJd(int $jd, int $year): string
{
    if (!function_exists('wwtcMonthDatesForYear')) {
        return '';
    }
    $found = array_search($jd, wwtcMonthDatesForYear($year), true);
    return $found === false ? '' : (string) $found;
}

function &wwtcOverrideCacheBag(): array
{
    static $bag = ['month' => [], 'user' => []];
    return $bag;
}

function wwtcForgetOverrideCache(): void
{
    $bag = &wwtcOverrideCacheBag();
    $bag['month'] = [];
    $bag['user'] = [];
}

function wwtcOverridesReady(): bool
{
    return function_exists('wwtcColumnExists') && wwtcColumnExists('wwtc_quota_overrides', 'overridden_quota');
}

function wwtcAuditReady(): bool
{
    return function_exists('wwtcColumnExists') && wwtcColumnExists('wwtc_audit_log', 'action');
}

/**
 * Active overrides for one campaign month, keyed by user_id.
 * Empty when the table has not been installed.
 *
 * @return array<int,array>
 */
function wwtcActiveOverridesForMonth(int $year, string $month): array
{
    $bag = &wwtcOverrideCacheBag();
    $key = $year . '|' . $month;
    if (array_key_exists($key, $bag['month'])) {
        return $bag['month'][$key];
    }
    if ($month === '' || !wwtcOverridesReady()) {
        return $bag['month'][$key] = [];
    }
    global $MASHPIA_DB;
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT o.user_id, o.campaign_year, o.month_name, o.original_quota, o.overridden_quota,
                    o.created_by, o.created_by_name, o.created_at, o.reason, o.undone_at,
                    u.school_id, u.class_id
               FROM wwtc_quota_overrides o
               JOIN users u ON u.user_id = o.user_id
              WHERE o.campaign_year = :y AND o.month_name = :m AND o.undone_at IS NULL'
        );
        $stmt->execute([':y' => $year, ':m' => $month]);
        $byUser = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $byUser[(int) $row['user_id']] = $row;
        }
        return $bag['month'][$key] = $byUser;
    } catch (Exception $e) {
        error_log('WWTC quota override read failed: ' . $e->getMessage());
        return $bag['month'][$key] = [];
    }
}

/**
 * Active overrides for one soldier in one year, keyed by month name.
 *
 * @return array<string,array>
 */
function wwtcActiveOverridesForUserYear(int $userId, int $year): array
{
    $bag = &wwtcOverrideCacheBag();
    $key = $userId . '|' . $year;
    if (array_key_exists($key, $bag['user'])) {
        return $bag['user'][$key];
    }
    if ($userId <= 0 || !wwtcOverridesReady()) {
        return $bag['user'][$key] = [];
    }
    global $MASHPIA_DB;
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT user_id, campaign_year, month_name, original_quota, overridden_quota,
                    created_by, created_by_name, created_at, reason, undone_at
               FROM wwtc_quota_overrides
              WHERE user_id = :uid AND campaign_year = :y AND undone_at IS NULL'
        );
        $stmt->execute([':uid' => $userId, ':y' => $year]);
        $byMonth = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $byMonth[(string) $row['month_name']] = $row;
        }
        return $bag['user'][$key] = $byMonth;
    } catch (Exception $e) {
        error_log('WWTC quota override read failed: ' . $e->getMessage());
        return $bag['user'][$key] = [];
    }
}

/**
 * @return array<int,array> active rows for this soldier, every year
 */
function wwtcActiveOverrideRowsForUser(int $userId): array
{
    if ($userId <= 0 || !wwtcOverridesReady()) {
        return [];
    }
    global $MASHPIA_DB;
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT user_id, campaign_year, month_name, original_quota, overridden_quota, undone_at
               FROM wwtc_quota_overrides
              WHERE user_id = :uid AND undone_at IS NULL'
        );
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    } catch (Exception $e) {
        error_log('WWTC quota override read failed: ' . $e->getMessage());
        return [];
    }
}

function wwtcHasMissionMark(int $userId, int $jd): bool
{
    if ($userId <= 0 || $jd <= 0 || !isset($GLOBALS['MASHPIA_DB'])) {
        return false;
    }
    global $MASHPIA_DB;
    if (!defined('WWTC_SUBJECT_ID')) {
        return false;
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT 1 FROM date_tasks_mission_marks
              WHERE user_id = :uid AND subject_id = ' . WWTC_SUBJECT_ID . ' AND mark_date = :d
              LIMIT 1'
        );
        $stmt->execute([':uid' => $userId, ':d' => $jd]);
        return (bool) $stmt->fetchColumn();
    } catch (Exception $e) {
        return false;
    }
}

/** Completed months the medal count would miss because no mission mark was written. */
function wwtcUnmarkedOverrideCount(int $userId): int
{
    $extra = 0;
    foreach (wwtcActiveOverrideRowsForUser($userId) as $row) {
        $year = (int) $row['campaign_year'];
        $jd = 0;
        if (function_exists('wwtcMonthDatesForYear')) {
            $jd = (int) (wwtcMonthDatesForYear($year)[(string) $row['month_name']] ?? 0);
        }
        if ($jd && wwtcHasMissionMark($userId, $jd)) {
            continue;
        }
        $extra++;
    }
    return $extra;
}

/**
 * user_ids in $userIds that already have a mission mark on $jd.
 *
 * @param int[] $userIds
 * @return array<int,true>
 */
function wwtcMarkedOverrideUsers(array $userIds, int $jd): array
{
    $ids = [];
    foreach ($userIds as $id) {
        $id = (int) $id;
        if ($id > 0) {
            $ids[$id] = $id;
        }
    }
    if (!$ids || $jd <= 0 || !isset($GLOBALS['MASHPIA_DB']) || !defined('WWTC_SUBJECT_ID')) {
        return [];
    }
    global $MASHPIA_DB;
    try {
        $in = implode(',', $ids);
        $rows = $MASHPIA_DB->query(
            'SELECT user_id FROM date_tasks_mission_marks
              WHERE subject_id = ' . WWTC_SUBJECT_ID . ' AND mark_date = ' . (int) $jd . '
                AND user_id IN (' . $in . ')'
        )->fetchAll(PDO::FETCH_COLUMN);
        $out = [];
        foreach ($rows as $uid) {
            $out[(int) $uid] = true;
        }
        return $out;
    } catch (Exception $e) {
        return [];
    }
}

function wwtcOverlayCompletionCountsForDate(array $counts, int $date, int $year): array
{
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $counts;
    }
    $overs = wwtcActiveOverridesForMonth($year, $month);
    if (!$overs) {
        return $counts;
    }
    $marked = wwtcMarkedOverrideUsers(array_keys($overs), $date);
    return wwtcOverlayCompletionCounts($counts, array_values($overs), $marked);
}

/**
 * Holiday board is cached from the engine. Apply the override for $monthName
 * on the way out so a base commander adjustment shows on that occasion too.
 */
function wwtcOverlayHolidayBoard(array $board, int $year, string $monthName): array
{
    $overs = wwtcActiveOverridesForMonth($year, $monthName);
    if (!$overs) {
        return $board;
    }
    $studentsBySchool = [];
    $kapGoal = [];
    $metBySchool = [];
    $metByClass = [];
    $armyQuota = 0;
    $armyMet = 0;
    foreach ($board['studentsBySchool'] ?? [] as $sid => $students) {
        $adjusted = [];
        foreach ($students as $student) {
            $next = wwtcApplyOverrideToStudent($student, $overs[(int) ($student['id'] ?? 0)] ?? null);
            unset($next['engineQuota'], $next['quotaDelta']);
            $adjusted[] = $next;
            $kapGoal[(int) $sid] = ($kapGoal[(int) $sid] ?? 0) + (int) $next['quota'];
            $cid = (int) ($next['classId'] ?? 0);
            $classRow = $metByClass[(int) $sid] ?? [];
            $classRow[$cid] = (int) ($classRow[$cid] ?? 0) + (!empty($next['met']) ? 1 : 0);
            $metByClass[(int) $sid] = $classRow;
            $metBySchool[(int) $sid] = ($metBySchool[(int) $sid] ?? 0) + (!empty($next['met']) ? 1 : 0);
            $armyQuota += (int) $next['quota'];
            if (!empty($next['met'])) {
                $armyMet++;
            }
        }
        $studentsBySchool[$sid] = $adjusted;
    }
    $out = $board;
    $out['studentsBySchool'] = $studentsBySchool;
    $out['kapGoal'] = $kapGoal;
    $counts = $board['counts'] ?? [];
    $counts['metBySchool'] = $metBySchool;
    $counts['metByClass'] = $metByClass;
    $out['counts'] = $counts;
    $army = $board['army'] ?? [];
    $army['quota'] = $armyQuota;
    $army['metSoldiers'] = $armyMet;
    $army['perfectPlatoons'] = count(wwtcPerfectPlatoonsFromSoldiers(wwtcBoardPlatoonSoldiers($out)));
    $out['army'] = $army;
    return $out;
}

function wwtcInsertOverride(PDO $db, array $row): void
{
    $stmt = $db->prepare(
        'INSERT INTO wwtc_quota_overrides
            (user_id, campaign_year, month_name, original_quota, overridden_quota,
             created_by, created_by_name, reason, created_at)
         VALUES
            (:uid, :year, :month, :original, :overridden, :who, :name, :reason, :at)'
    );
    $stmt->execute([
        ':uid' => (int) $row['user_id'],
        ':year' => (int) $row['campaign_year'],
        ':month' => (string) $row['month_name'],
        ':original' => (int) $row['original_quota'],
        ':overridden' => (int) $row['overridden_quota'],
        ':who' => (int) $row['created_by'],
        ':name' => (string) $row['created_by_name'],
        ':reason' => $row['reason'],
        ':at' => (string) $row['created_at'],
    ]);
}

function wwtcMarkOverrideUndone(PDO $db, int $userId, int $year, string $month, int $actorId, string $when): void
{
    $stmt = $db->prepare(
        'UPDATE wwtc_quota_overrides
            SET undone_at = :at, undone_by = :by
          WHERE user_id = :uid AND campaign_year = :year AND month_name = :month
            AND undone_at IS NULL'
    );
    $stmt->execute([
        ':at' => $when,
        ':by' => $actorId,
        ':uid' => $userId,
        ':year' => $year,
        ':month' => $month,
    ]);
}

function wwtcInsertAudit(PDO $db, array $row): void
{
    $stmt = $db->prepare(
        'INSERT INTO wwtc_audit_log
            (action, actor_id, actor_name, user_id, campaign_year, month_name, detail, created_at)
         VALUES
            (:action, :actor, :name, :uid, :year, :month, :detail, :at)'
    );
    $stmt->execute([
        ':action' => (string) $row['action'],
        ':actor' => (int) $row['actor_id'],
        ':name' => (string) $row['actor_name'],
        ':uid' => (int) $row['user_id'],
        ':year' => (int) $row['campaign_year'],
        ':month' => (string) $row['month_name'],
        ':detail' => (string) $row['detail'],
        ':at' => (string) $row['created_at'],
    ]);
}

function wwtcAdminLabel(int $adminId): string
{
    if ($adminId <= 0) {
        return 'HQ';
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB)) {
        return 'admin ' . $adminId;
    }
    try {
        $stmt = $MASHPIA_DB->prepare('SELECT first, last FROM admins WHERE admin_id = :id LIMIT 1');
        $stmt->execute([':id' => $adminId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $name = trim(((string) ($row['first'] ?? '')) . ' ' . ((string) ($row['last'] ?? '')));
        return $name !== '' ? $name : ('admin ' . $adminId);
    } catch (Exception $e) {
        return 'admin ' . $adminId;
    }
}

/**
 * Decide and, when allowed, write one override. Does not exit — the route
 * turns a non-200 status into wwtcError. $context carries the engine quota
 * (already resolved, so Cheshvan's today-ladder figure is what gets stored
 * as original_quota) and what the soldier entered.
 *
 * @param array $context keys: ready, engineQuota, said, reported, year, month, already
 * @return array{status:int,error?:string,body?:array}
 */
function wwtcPerformOverride(PDO $db, array $actor, array $kid, array $input, array $adminSchoolIds, array $context): array
{
    if (empty($context['ready'])) {
        return [
            'status' => 503,
            'error' => 'Quota override storage is not installed yet. Run api/sql/wwtc_quota_overrides.sql on mashpia.',
        ];
    }
    $kidSchool = (int) ($kid['school_id'] ?? 0);
    if (wwtcOverrideStatus($actor, $kidSchool, $adminSchoolIds) !== 200) {
        return ['status' => 403, 'error' => 'You can only override soldiers in your own school.'];
    }
    $said = (int) ($context['said'] ?? 0);
    $engine = (int) ($context['engineQuota'] ?? 0);
    $reported = !empty($context['reported']);
    if (!$reported || $said <= 0 || $engine <= 0 || $said >= $engine) {
        return ['status' => 422, 'error' => 'This soldier is not under quota for that month.'];
    }
    if (!empty($context['already'])) {
        return ['status' => 409, 'error' => 'That month already has an override. Undo it first.'];
    }
    $reason = trim((string) ($input['reason'] ?? ''));
    if (strlen($reason) > 500) {
        $reason = substr($reason, 0, 500);
    }
    $when = (string) ($context['now'] ?? date('Y-m-d H:i:s'));
    $actorId = (int) ($actor['id'] ?? 0);
    $actorName = trim((string) ($actor['name'] ?? ''));
    if ($actorName === '') {
        $actorName = wwtcAdminLabel($actorId);
    }
    $year = (int) $context['year'];
    $month = (string) $context['month'];
    $row = [
        'user_id' => (int) ($kid['user_id'] ?? $kid['id'] ?? 0),
        'campaign_year' => $year,
        'month_name' => $month,
        'original_quota' => $engine,
        'overridden_quota' => $said,
        'created_by' => $actorId,
        'created_by_name' => $actorName,
        'reason' => $reason === '' ? null : $reason,
        'created_at' => $when,
    ];
    wwtcInsertOverride($db, $row);
    wwtcInsertAudit($db, [
        'action' => 'quota_override',
        'actor_id' => $actorId,
        'actor_name' => $actorName,
        'user_id' => $row['user_id'],
        'campaign_year' => $year,
        'month_name' => $month,
        'detail' => 'Quota ' . $engine . ' overridden to ' . $said . ' for ' . $month . ' ' . $year,
        'created_at' => $when,
    ]);
    wwtcForgetOverrideCache();
    return [
        'status' => 200,
        'body' => [
            'ok' => true,
            'userId' => $row['user_id'],
            'year' => $year,
            'month' => $month,
            'originalQuota' => $engine,
            'quota' => $said,
            'met' => true,
            'quotaAdjusted' => true,
            'reason' => $row['reason'],
        ],
    ];
}

/**
 * @param array $context keys: ready, year, month, active (bool)
 * @return array{status:int,error?:string,body?:array}
 */
function wwtcPerformUndo(PDO $db, array $actor, array $kid, array $adminSchoolIds, array $context): array
{
    if (empty($context['ready'])) {
        return [
            'status' => 503,
            'error' => 'Quota override storage is not installed yet. Run api/sql/wwtc_quota_overrides.sql on mashpia.',
        ];
    }
    $kidSchool = (int) ($kid['school_id'] ?? 0);
    if (wwtcOverrideStatus($actor, $kidSchool, $adminSchoolIds) !== 200) {
        return ['status' => 403, 'error' => 'You can only override soldiers in your own school.'];
    }
    if (empty($context['active'])) {
        return ['status' => 404, 'error' => 'That month does not have an override.'];
    }
    $when = (string) ($context['now'] ?? date('Y-m-d H:i:s'));
    $actorId = (int) ($actor['id'] ?? 0);
    $actorName = trim((string) ($actor['name'] ?? ''));
    if ($actorName === '') {
        $actorName = wwtcAdminLabel($actorId);
    }
    $year = (int) $context['year'];
    $month = (string) $context['month'];
    $userId = (int) ($kid['user_id'] ?? $kid['id'] ?? 0);
    wwtcMarkOverrideUndone($db, $userId, $year, $month, $actorId, $when);
    wwtcInsertAudit($db, [
        'action' => 'quota_override_undo',
        'actor_id' => $actorId,
        'actor_name' => $actorName,
        'user_id' => $userId,
        'campaign_year' => $year,
        'month_name' => $month,
        'detail' => 'Override removed for ' . $month . ' ' . $year,
        'created_at' => $when,
    ]);
    wwtcForgetOverrideCache();
    return [
        'status' => 200,
        'body' => [
            'ok' => true,
            'userId' => $userId,
            'year' => $year,
            'month' => $month,
            'quotaAdjusted' => false,
        ],
    ];
}
