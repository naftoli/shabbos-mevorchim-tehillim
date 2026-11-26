<?php

declare(strict_types=1);

// Quota override: one month becomes the kapitlach the soldier entered.
// Cheshvan may already be priced from today's ladder; the override still wins.
// Run: php tests/php/QuotaOverrideTest.php

require __DIR__ . '/../../api/quotaOverride.php';
require __DIR__ . '/../../api/overEntry.php';
require __DIR__ . '/../../api/perfectPlatoon.php';

$failures = 0;
$tests = 0;
function check(string $label, bool $cond): void
{
    global $tests, $failures;
    $tests++;
    if ($cond) {
        echo "ok   - $label\n";
        return;
    }
    $failures++;
    echo "FAIL - $label\n";
}

$cheshvanToday = 18; // today's ladder, not the 10 they were on
$entered = 5;
$override = [
    'original_quota' => 10,
    'overridden_quota' => $entered,
    'reason' => 'entered short',
    'undone_at' => null,
];

$months = [
    ['month' => 'Cheshvan', 'quota' => $cheshvanToday, 'said' => $entered, 'reported' => true, 'met' => false],
    ['month' => 'Kislev', 'quota' => 12, 'said' => 4, 'reported' => true, 'met' => false],
];
$adjusted = wwtcOverlayKidMonthList($months, ['Cheshvan' => $override]);
$byName = [];
foreach ($adjusted as $month) {
    $byName[$month['month']] = $month;
}

check('Cheshvan override replaces today\'s ladder quota', $byName['Cheshvan']['quota'] === 5);
check('Cheshvan counts as met', $byName['Cheshvan']['met'] === true);
check('Cheshvan keeps the original quota', $byName['Cheshvan']['originalQuota'] === 10);
check('Cheshvan is marked adjusted', $byName['Cheshvan']['quotaAdjusted'] === true);
check('Kislev quota is unchanged', $byName['Kislev']['quota'] === 12);
check('Kislev is still not met', $byName['Kislev']['met'] === false);
check('Kislev is not adjusted', empty($byName['Kislev']['quotaAdjusted']));

$undone = $override;
$undone['undone_at'] = '2026-11-11 12:00:00';
$restored = wwtcOverlayKidMonthList($months, ['Cheshvan' => $undone]);
check('undo restores Cheshvan to today\'s ladder quota', $restored[0]['quota'] === $cheshvanToday);
check('undo clears the met flag', $restored[0]['met'] === false);
check('undo clears the adjusted flag', $restored[0]['quotaAdjusted'] === false);

$students = [
    ['id' => 1, 'classId' => 7, 'quota' => 10, 'said' => 10, 'met' => true],
    ['id' => 2, 'classId' => 7, 'quota' => $cheshvanToday, 'said' => $entered, 'met' => false],
];
$class = ['id' => 7, 'size' => 2, 'quota' => 28, 'said' => 15, 'met' => 1, 'perfect' => false];
$agg = wwtcClassAfterOverrides($class, $students, [2 => $override]);
check('class quota drops by the Cheshvan gap', $agg['class']['quota'] === 15);
check('both soldiers now count as met', $agg['class']['met'] === 2);
check('the platoon is perfect', $agg['class']['perfect'] === true);
check('pct met is 100', $agg['class']['pctMet'] === 100);
check('the other soldier is untouched', $agg['students'][0]['quota'] === 10 && $agg['students'][0]['met'] === true);
check('overridden soldier quota is what they entered', $agg['students'][1]['quota'] === 5 && $agg['students'][1]['met'] === true);

$counts = [
    'metBySchool' => [89 => 1],
    'metByClass' => [89 => [7 => 1]],
    'sizeBySchool' => [89 => 2],
    'sizeByClass' => [89 => [7 => 2]],
];
$withMark = wwtcOverlayCompletionCounts($counts, [
    ['user_id' => 2, 'school_id' => 89, 'class_id' => 7],
], []);
check('completion count adds the overridden soldier', $withMark['metBySchool'][89] === 2);
check('class completion count adds them', $withMark['metByClass'][89][7] === 2);
$already = wwtcOverlayCompletionCounts($counts, [
    ['user_id' => 2, 'school_id' => 89, 'class_id' => 7],
], [2 => true]);
check('an existing mission mark is not counted twice', $already['metBySchool'][89] === 1);

$hq = ['type' => 'admin', 'auth' => 'super', 'id' => 1, 'name' => 'HQ Command'];
$own = ['type' => 'admin', 'auth' => 'school', 'id' => 9, 'name' => 'Base Commander'];
$other = ['type' => 'admin', 'auth' => 'school', 'id' => 4, 'name' => 'Other Base'];
check('HQ may override any school', wwtcOverrideStatus($hq, 90) === 200);
check('base commander may override their own school', wwtcOverrideStatus($own, 89, [89]) === 200);
check('another school is 403', wwtcOverrideStatus($other, 90, [89]) === 403);
check('a soldier is 403', wwtcOverrideStatus(['type' => 'kid', 'id' => 2], 89, [89]) === 403);
check('a class teacher is 403', wwtcOverrideStatus($other, 89, []) === 403);

final class OverrideFakeStmt
{
    private $pdo;
    private $sql;
    public function __construct($pdo, string $sql) { $this->pdo = $pdo; $this->sql = $sql; }
    public function execute($params = []) { $this->pdo->record($this->sql, $params); return true; }
}
final class OverrideFakePDO extends PDO
{
    public $queries = [];
    public function __construct() {}
    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = []) { return new OverrideFakeStmt($this, (string) $sql); }
    public function record(string $sql, $params) { $this->queries[] = [preg_replace('/\s+/', ' ', trim($sql)), $params]; }
}
function ran(OverrideFakePDO $db, string $needle, $key = null, $val = null): bool
{
    foreach ($db->queries as [$sql, $params]) {
        if (strpos($sql, $needle) === false) {
            continue;
        }
        if ($key === null) {
            return true;
        }
        if (array_key_exists($key, $params) && $params[$key] == $val) {
            return true;
        }
    }
    return false;
}

$kid = ['user_id' => 2, 'school_id' => 90];
$db = new OverrideFakePDO();
$denied = wwtcPerformOverride($db, $other, $kid, ['reason' => 'no'], [89], [
    'ready' => true,
    'engineQuota' => 18,
    'said' => 5,
    'reported' => true,
    'year' => 5787,
    'month' => 'Cheshvan',
    'already' => false,
    'now' => '2026-11-11 09:00:00',
]);
check('perform returns 403 for another school', $denied['status'] === 403);
check('403 writes nothing', count($db->queries) === 0);

$db = new OverrideFakePDO();
$saved = wwtcPerformOverride($db, $hq, $kid, ['reason' => 'mis-entered'], [], [
    'ready' => true,
    'engineQuota' => 18,
    'said' => 5,
    'reported' => true,
    'year' => 5787,
    'month' => 'Cheshvan',
    'already' => false,
    'now' => '2026-11-11 09:00:00',
]);
check('override saves', $saved['status'] === 200 && $saved['body']['quota'] === 5 && $saved['body']['met'] === true);
check('override row stores original and new quota', ran($db, 'INSERT INTO wwtc_quota_overrides', ':original', 18) && ran($db, 'INSERT INTO wwtc_quota_overrides', ':overridden', 5));
check('override row stores who', ran($db, 'INSERT INTO wwtc_quota_overrides', ':who', 1));
check('override row stores when', ran($db, 'INSERT INTO wwtc_quota_overrides', ':at', '2026-11-11 09:00:00'));
check('audit log stores the action, who, and when', ran($db, 'INSERT INTO wwtc_audit_log', ':action', 'quota_override') && ran($db, 'INSERT INTO wwtc_audit_log', ':actor', 1) && ran($db, 'INSERT INTO wwtc_audit_log', ':at', '2026-11-11 09:00:00'));

$db = new OverrideFakePDO();
$undo = wwtcPerformUndo($db, $hq, $kid, [], [
    'ready' => true,
    'year' => 5787,
    'month' => 'Cheshvan',
    'active' => true,
    'now' => '2026-11-11 10:00:00',
]);
check('undo succeeds', $undo['status'] === 200 && $undo['body']['quotaAdjusted'] === false);
check('undo sets undone_at', ran($db, 'SET undone_at', ':at', '2026-11-11 10:00:00'));
check('undo audit names who and when', ran($db, 'INSERT INTO wwtc_audit_log', ':action', 'quota_override_undo') && ran($db, 'INSERT INTO wwtc_audit_log', ':actor', 1) && ran($db, 'INSERT INTO wwtc_audit_log', ':at', '2026-11-11 10:00:00'));

$counted = wwtcCountedKapitlach(5, 200, 'flagged');
$nothing = wwtcCountedKapitlach(0, 200, 'flagged');
check('a flagged 200 does not count; the prior 5 does', $counted === 5);
check('a flag with no prior mark counts as nothing entered', $nothing === 0);
$flaggedStudent = wwtcApplyOverrideToStudent(
    ['id' => 2, 'quota' => 10, 'said' => $counted],
    ['original_quota' => 10, 'overridden_quota' => $counted, 'undone_at' => null]
);
check('override adopts the counted 5, not the flagged 200', $flaggedStudent['quota'] === 5 && $flaggedStudent['met'] === true);
check('the flagged amount does not meet the original quota', wwtcCountedKapitlach(5, 200, 'flagged') < 10);
check('the counted 5 meets the overridden quota', wwtcCountedKapitlach(5, 200, 'flagged') >= 5);
$withOverride = [
    ['counted' => 5, 'flagged' => 200, 'status' => 'flagged', 'quota' => 5],
    ['counted' => 8, 'flagged' => 0, 'status' => null, 'quota' => 8],
];
$withoutOverride = [
    ['counted' => 5, 'flagged' => 200, 'status' => 'flagged', 'quota' => 10],
    ['counted' => 8, 'flagged' => 0, 'status' => null, 'quota' => 8],
];
$withOverrideMet = true;
foreach ($withOverride as $s) {
    $said = wwtcCountedKapitlach((int) $s['counted'], (int) $s['flagged'], $s['status']);
    if ((int) $s['quota'] <= 0 || $said < (int) $s['quota']) {
        $withOverrideMet = false;
    }
}
$withoutOverrideMet = true;
foreach ($withoutOverride as $s) {
    $said = wwtcCountedKapitlach((int) $s['counted'], (int) $s['flagged'], $s['status']);
    if ((int) $s['quota'] <= 0 || $said < (int) $s['quota']) {
        $withoutOverrideMet = false;
    }
}
check('perfect platoon uses the overridden quota and ignores the withheld flag', $withOverrideMet === true);
check('without the override that platoon is not perfect', $withoutOverrideMet === false);

$shared = wwtcPerfectPlatoonsFromSoldiers([
    ['schoolId' => 1, 'school' => 'A', 'classId' => 7, 'grade' => '1', 'sub' => '', 'teacher' => '', 'quota' => 5, 'said' => 5, 'userId' => 2],
    ['schoolId' => 1, 'school' => 'A', 'classId' => 7, 'grade' => '1', 'sub' => '', 'teacher' => '', 'quota' => 8, 'said' => 8, 'userId' => 3],
]);
$short = wwtcPerfectPlatoonsFromSoldiers([
    ['schoolId' => 1, 'school' => 'A', 'classId' => 7, 'grade' => '1', 'sub' => '', 'teacher' => '', 'quota' => 10, 'said' => 5, 'userId' => 2],
    ['schoolId' => 1, 'school' => 'A', 'classId' => 7, 'grade' => '1', 'sub' => '', 'teacher' => '', 'quota' => 8, 'said' => 8, 'userId' => 3],
]);
check('the shared perfect-platoon rule lists the class once the override quota is met', count($shared) === 1 && $shared[0]['classId'] === 7);
check('the same class is absent at the original quota', count($short) === 0);
check('the public platoon row has no soldier id', !isset($shared[0]['userId']));

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
