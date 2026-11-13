<?php

declare(strict_types=1);

// Custom ladder: 150 by an existing finish grade reproduces that ladder.
// A target or monthly cell above 150 is refused. A one-month override still
// wins for kapitlach. Run: php tests/php/CustomLadderTest.php

require __DIR__ . '/../../api/customLadder.php';
require __DIR__ . '/../../api/quotaOverride.php';
require __DIR__ . '/../../api/platoonRoll.php';

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

$quota = wwtcParsedLadderQuota();
check('the shared quota table has 13 grades', count($quota) === 13);
check('Pre-1A has 12 months', isset($quota['pre1a']) && count($quota['pre1a']) === 12);
$mismatch = 0;
foreach ([5, 6, 7, 8, 9, 10, 11, 12] as $ladder) {
    $grid = wwtcGenerateCustomLadder(150, (string) $ladder);
    check('ladder ' . $ladder . ' does not drop along the climb', wwtcLadderProblems($grid) === []);
    foreach ($quota as $grade => $months) {
        $index = $grade === 'pre1a' ? 0 : (int) $grade;
        if ($index > $ladder) {
            continue;
        }
        foreach ($months as $month => $cells) {
            if (!isset($cells[$ladder])) {
                continue;
            }
            $expected = $cells[$ladder];
            $got = $grid['cells'][$grade][$month];
            $hExpected = !empty($expected['h']) ? 1 : 0;
            $hGot = !empty($got['h']) ? 1 : 0;
            if ((float) $got['v'] !== (float) $expected['v'] || (int) $got['m'] !== (int) $expected['m'] || $hGot !== $hExpected) {
                $mismatch++;
            }
        }
    }
}
check('every 150-by-grade target matches that ladder', $mismatch === 0);

$same = wwtcGenerateCustomLadder(150, '8', [
    'grade' => '7', 'month' => 'Teves', 'kapitlach' => 118.5, 'minutes' => 120,
]);
check('a matching half-kapitel anchor does not lift the cell', (float) $same['cells']['7']['Teves']['v'] === 118.5);
check('that anchor leaves the ladder unanchored', $same['anchored'] === false);

$threw300 = false;
try {
    wwtcGenerateCustomLadder(300, '8');
} catch (InvalidArgumentException $e) {
    $threw300 = strpos($e->getMessage(), '150') !== false;
}
check('a target of 300 is refused', $threw300);

check('minutes at 150 stay 120', wwtcMinutesForKapitlach(150) === 120);
check('minutes keep climbing past one Tehillim', wwtcMinutesForKapitlach(190) === 187 && wwtcMinutesForKapitlach(300) === 370);
$fmt190 = wwtcFormatKapitlachQuota(190);
$fmt300 = wwtcFormatKapitlachQuota(300);
$fmt40 = wwtcFormatKapitlachQuota(40);
check('190 is shown as 1 Tehillim + 40 kapitlach', $fmt190['label'] === '1 Tehillim + 40 kapitlach' && $fmt190['plain'] === '190');
check('300 is shown as 2 Tehillim', $fmt300['label'] === '2 Tehillim' && $fmt300['overTehillim'] === true);
check('40 stays Aleph-Beis', $fmt40['label'] === 'א-מ' && $fmt40['overTehillim'] === false);
check('display mode is named for Sholem', WWTC_KAPITEL_ABOVE_TEHILLIM_DISPLAY === 'tehillim-plus-count');

$later = wwtcGenerateCustomLadder(150, '13');
$shifted = $quota['11']['Tishrei'][12];
check('one year after 12th shifts ladder 12', (float) $later['cells']['12']['Tishrei']['v'] === (float) $shifted['v']);
check('the year after 12th reaches 150', (float) $later['cells']['13']['Elul']['v'] === 150.0);
check('the year before the slowest start stays at 1', (float) $later['cells']['pre1a']['Nissan']['v'] === 1.0);

$plain = wwtcGenerateCustomLadder(150, '12');
$lifted = wwtcGenerateCustomLadder(150, '12', [
    'grade' => '6', 'month' => 'Cheshvan', 'kapitlach' => 200, 'minutes' => 130,
]);
check('a current quota past one Tehillim is clamped to 150', (float) $lifted['cells']['6']['Cheshvan']['v'] === 150.0);
check('the finish does not go above one Tehillim', (float) $lifted['cells']['12']['Elul']['v'] === 150.0);
check('months before the anchor stay on the curve', (float) $lifted['cells']['5']['Elul']['v'] === (float) $plain['cells']['5']['Elul']['v']);
$overCell = 0;
foreach ($lifted['cells'] as $months) {
    foreach ($months as $cell) {
        if ((float) ($cell['v'] ?? 0) > 150) {
            $overCell++;
        }
    }
}
check('no generated month is above 150', $overCell === 0);

$hq = ['type' => 'admin', 'auth' => 'super', 'id' => 1, 'name' => 'HQ Command'];
$own = ['type' => 'admin', 'auth' => 'school', 'id' => 9, 'name' => 'Base Commander'];
$other = ['type' => 'admin', 'auth' => 'school', 'id' => 4, 'name' => 'Other Base'];
check('HQ may set a custom ladder at any school', wwtcOverrideStatus($hq, 90) === 200);
check('a base commander may set one in their school', wwtcOverrideStatus($own, 89, [89]) === 200);
check('another school is 403', wwtcOverrideStatus($other, 90, [89]) === 403);
check('a class teacher is 403', wwtcOverrideStatus($other, 89, []) === 403);

final class CustomLadderFakeStmt
{
    private $pdo;
    private $sql;
    public function __construct($pdo, string $sql) { $this->pdo = $pdo; $this->sql = $sql; }
    public function execute($params = []) { $this->pdo->record($this->sql, $params); return true; }
}
final class CustomLadderFakePDO extends PDO
{
    public $queries = [];
    public function __construct() {}
    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = []) { return new CustomLadderFakeStmt($this, (string) $sql); }
    public function record(string $sql, $params) { $this->queries[] = [preg_replace('/\s+/', ' ', trim($sql)), $params]; }
}
function ran(CustomLadderFakePDO $db, string $needle, $key = null, $val = null): bool
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

$kid = ['user_id' => 2, 'school_id' => 90, 'class_grade' => '4'];
$db = new CustomLadderFakePDO();
$denied = wwtcPerformCustomLadder($db, $other, $kid, [
    'targetKapitlach' => 150, 'finishGrade' => '8',
], [89], [
    'ready' => true,
    'anchor' => ['grade' => '4', 'month' => 'Cheshvan', 'kapitlach' => 54, 'minutes' => 90],
    'now' => '2026-11-11 09:00:00',
]);
check('perform returns 403 for another school', $denied['status'] === 403);
check('403 writes nothing', count($db->queries) === 0);

$db = new CustomLadderFakePDO();
$tooHigh = wwtcPerformCustomLadder($db, $hq, $kid, [
    'targetKapitlach' => 300, 'finishGrade' => '8', 'reason' => 'needs longer',
], [], [
    'ready' => true,
    'anchor' => ['grade' => '4', 'month' => 'Cheshvan', 'kapitlach' => 54, 'minutes' => 90],
    'now' => '2026-11-11 09:00:00',
]);
check('perform refuses a target above 150', $tooHigh['status'] === 422);
check('a refused target writes nothing', count($db->queries) === 0);

$db = new CustomLadderFakePDO();
$saved = wwtcPerformCustomLadder($db, $hq, $kid, [
    'targetKapitlach' => 150, 'finishGrade' => '8', 'reason' => 'needs longer',
], [], [
    'ready' => true,
    'anchor' => ['grade' => '4', 'month' => 'Cheshvan', 'kapitlach' => 54, 'minutes' => 90],
    'now' => '2026-11-11 09:00:00',
]);
check('custom ladder saves', $saved['status'] === 200 && $saved['body']['customLadder']['targetKapitlach'] === 150);
check('the row stores the target and the grid', ran($db, 'INSERT INTO wwtc_custom_ladders', ':target', 150) && ran($db, 'INSERT INTO wwtc_custom_ladders', ':finish', '8'));
check('the row stores who and when', ran($db, 'INSERT INTO wwtc_custom_ladders', ':who', 1) && ran($db, 'INSERT INTO wwtc_custom_ladders', ':at', '2026-11-11 09:00:00'));
check('audit log stores set, who, and when', ran($db, 'INSERT INTO wwtc_audit_log', ':action', 'custom_ladder_set') && ran($db, 'INSERT INTO wwtc_audit_log', ':actor', 1));

$db = new CustomLadderFakePDO();
$removed = wwtcPerformRemoveCustomLadder($db, $hq, $kid, [], [
    'ready' => true,
    'active' => true,
    'now' => '2026-11-11 10:00:00',
]);
check('remove succeeds', $removed['status'] === 200 && $removed['body']['customLadder'] === null);
check('remove sets removed_at', ran($db, 'SET removed_at', ':at', '2026-11-11 10:00:00'));
check('remove is audited', ran($db, 'INSERT INTO wwtc_audit_log', ':action', 'custom_ladder_remove'));

$engine = wwtcReportQuotaFromEngine(40, 80, null);
check('no custom cell keeps the engine quota', $engine['kapitlach'] === 40 && $engine['minutes'] === 80 && $engine['customLadder'] === false);
$priced = wwtcReportQuotaFromEngine(40, 80, ['v' => 190, 'm' => 187]);
check('a custom cell replaces kapitel and minutes', $priced['kapitlach'] === 190 && $priced['minutes'] === 187 && $priced['customLadder'] === true);
$half = wwtcReportQuotaFromEngine(118, 120, ['v' => 118.5, 'm' => 120]);
check('a half-kapitel custom cell rounds the report quota', $half['kapitlach'] === 119);
$empty = wwtcReportQuotaFromEngine(40, 80, []);
check('an empty custom cell is ignored', $empty['customLadder'] === false && $empty['kapitlach'] === 40);

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
