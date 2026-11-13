<?php

declare(strict_types=1);

// Mock test for the child's personal-page report (POST /me/report). It drives the
// real production write path — wwtcApplyMark() in api/marking.php, the same code
// the route calls — with a fake PDO, and asserts what the user asked us to prove:
//
//   1. A child's entry is saved correctly: the kapitelach count and the minutes
//      the child typed land in the mark with exactly those values.
//   2. They go to the correct tables: date_tasks_marks for the two grids, and
//      date_tasks_mission_marks for the earned mission credit — and NOTHING else.
//   3. Every write is keyed to the current Shabbos Mevorchim date (a Saturday —
//      see ShabbosMevorchimSaturdayTest), so the report is attributed to the
//      right month. The SM date is the mark_date on both grids and on the credit.
//
// Run: php tests/php/ReportSaveTest.php   (any PHP 7.2+, no DB)

define('WWTC_SUBJECT_ID', 1);
require __DIR__ . '/../../api/marking.php';

// The two grids the route writes (api/bootstrap.php: WWTC_GRID_KAPITELACH / _MINUTES).
const GRID_KAP = 8001;
const GRID_MIN = 8002;

// A real Shabbos Mevorchim jd (Kislev 5786 = Saturday 2025-11-15 through the
// app's jdtounix lens). Using the real value ties this test to the Saturday the
// month starts on, which ShabbosMevorchimSaturdayTest proves is a Saturday.
const SM_DATE = 2460996;

final class FakeStmt
{
    private $pdo;
    private $sql;
    public function __construct($pdo, string $sql) { $this->pdo = $pdo; $this->sql = $sql; }
    public function execute($params = []) { $this->pdo->record($this->sql, $params); return true; }
    public function fetch($how = 0) { return $this->pdo->lookup($this->sql); }
    public function fetchColumn($i = 0)
    {
        $r = $this->pdo->lookup($this->sql);
        if ($r === false || $r === null) { return false; }
        return is_array($r) ? reset($r) : $r;
    }
}

final class FakePDO extends PDO
{
    public $queries = [];               // [ [normalizedSql, params], ... ]
    public $existingMarkTaskId = false; // what the "find existing mark" SELECT returns
    public $mission = null;             // reconcile lookup row
    public $missionMarkExists = false;  // does a mission mark already exist
    public function __construct() {}
    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = []) { return new FakeStmt($this, (string) $sql); }
    public function record(string $sql, $params) { $this->queries[] = [preg_replace('/\s+/', ' ', trim($sql)), $params]; }
    public function lookup(string $sql)
    {
        if (strpos($sql, 'FROM date_tasks_marks dtm') !== false && strpos($sql, 'dt.grid_id') !== false) {
            return $this->existingMarkTaskId;
        }
        if (strpos($sql, 'date_tasks_missions dtmm') !== false) {
            return $this->mission;
        }
        if (strpos($sql, 'SELECT 1 FROM date_tasks_mission_marks') !== false) {
            return $this->missionMarkExists ? 1 : false;
        }
        return false;
    }
}

$tests = 0;
$failures = 0;
function check(string $label, bool $cond): void
{
    global $tests, $failures;
    $tests++;
    echo ($cond ? "ok   - " : "FAIL - ") . $label . "\n";
    if (!$cond) { $failures++; }
}

/** The recorded write (non-SELECT) statements, in order. */
function writes(FakePDO $db): array
{
    return array_values(array_filter($db->queries, function ($q) {
        return stripos($q[0], 'SELECT') !== 0;
    }));
}

/** Find a recorded statement whose SQL contains $needle; return [sql, params] or null. */
function findWrite(FakePDO $db, string $needle): ?array
{
    foreach ($db->queries as $q) {
        if (strpos($q[0], $needle) !== false) { return $q; }
    }
    return null;
}

$KAP_TASK = ['grid_id' => GRID_KAP, 'date_task_id' => 111, 'description' => 'א-מ', 'points' => 0.5];
$MIN_TASK = ['grid_id' => GRID_MIN, 'date_task_id' => 222, 'description' => '36', 'points' => 0.5];
$USER = 777;

echo "# 1. A child reports 40 kapitelach and 60 minutes for this Shabbos Mevorchim\n";
echo "#    (fresh entry; 40 reaches the quota of 40 so a mission credit is earned)\n";
$db = new FakePDO();
$db->existingMarkTaskId = false; // no prior mark this month
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 40];
$db->missionMarkExists = false;

// This is exactly what POST /me/report does for the two grids.
wwtcApplyMark($db, $USER, SM_DATE, $KAP_TASK, 40, true);
wwtcApplyMark($db, $USER, SM_DATE, $MIN_TASK, 60, false);

// --- correct values (1) ---
$kapIns = findWrite($db, 'INSERT INTO date_tasks_marks');
check('kapitelach: the typed count (40) is saved as done_qty', $kapIns !== null && ($kapIns[1][':v'] ?? null) == 40);
check('kapitelach: saved against the kapitelach task row (grid 8001)', $kapIns !== null && ($kapIns[1][':tid'] ?? null) == 111);
check('kapitelach: saved for this soldier', $kapIns !== null && ($kapIns[1][':uid'] ?? null) == $USER);

// Both grids insert into date_tasks_marks, so grab the minutes one by its task id.
$minIns = null;
foreach ($db->queries as $q) {
    if (strpos($q[0], 'INSERT INTO date_tasks_marks') !== false && ($q[1][':tid'] ?? null) == 222) { $minIns = $q; }
}
check('minutes: the typed count (60) is saved as done_qty', $minIns !== null && ($minIns[1][':v'] ?? null) == 60);
check('minutes: saved against the minutes task row (grid 8002)', $minIns !== null && ($minIns[1][':tid'] ?? null) == 222);

// --- correct tables (2) ---
check('the mark goes to the date_tasks_marks table', findWrite($db, 'INSERT INTO date_tasks_marks') !== null);
check('the earned credit goes to the date_tasks_mission_marks table', findWrite($db, 'INSERT IGNORE INTO date_tasks_mission_marks') !== null);
$credit = findWrite($db, 'INSERT IGNORE INTO date_tasks_mission_marks');
check('mission credit carries the Tehillim subject_id', $credit !== null && strpos($credit[0], 'subject_id = ' . WWTC_SUBJECT_ID) !== false);
// Guard: the write path must touch ONLY these two tables, nothing stray.
$strayTable = false;
foreach (writes($db) as [$sql]) {
    if (strpos($sql, 'date_tasks_marks') === false && strpos($sql, 'date_tasks_mission_marks') === false) {
        $strayTable = true;
        echo "     unexpected write: $sql\n";
    }
}
check('no other table is ever written', !$strayTable);

// --- keyed to the Shabbos Mevorchim (Saturday) date (3) ---
check('kapitelach mark_date is the current Shabbos Mevorchim date', ($kapIns[1][':d'] ?? null) == SM_DATE);
check('minutes mark_date is the current Shabbos Mevorchim date', ($minIns[1][':d'] ?? null) == SM_DATE);
check('mission credit mark_date is the current Shabbos Mevorchim date',
    $credit !== null && (($credit[1][':d'] ?? null) == SM_DATE));

echo "\n# 2. Below quota: the count is still saved, but no mission credit is given\n";
$db = new FakePDO();
$db->existingMarkTaskId = false;
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 40];
wwtcApplyMark($db, $USER, SM_DATE, $KAP_TASK, 12, true);
check('below quota: the typed count (12) is still saved', (findWrite($db, 'INSERT INTO date_tasks_marks')[1][':v'] ?? null) == 12);
check('below quota: no mission credit written', findWrite($db, 'INSERT IGNORE INTO date_tasks_mission_marks') === null);

echo "\n# 3. A child fixes an earlier entry: it is UPDATED in place, not duplicated\n";
$db = new FakePDO();
$db->existingMarkTaskId = 111; // a mark for this month already exists
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 40];
$db->missionMarkExists = false;
wwtcApplyMark($db, $USER, SM_DATE, $KAP_TASK, 45, true);
$upd = findWrite($db, 'UPDATE date_tasks_marks SET done_qty');
check('correction updates the existing mark to the new count (45)', $upd !== null && ($upd[1][':v'] ?? null) == 45);
check('correction does NOT insert a second mark', findWrite($db, 'INSERT INTO date_tasks_marks') === null);
check('correction stays on the same Shabbos Mevorchim date', $upd !== null && ($upd[1][':d'] ?? null) == SM_DATE);

echo "\n# 4. A child clears their entry to 0: the mark and its credit are removed\n";
$db = new FakePDO();
$db->existingMarkTaskId = 111;
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 40];
wwtcApplyMark($db, $USER, SM_DATE, $KAP_TASK, 0, true);
check('cleared to 0: the mark is deleted from date_tasks_marks', findWrite($db, 'DELETE FROM date_tasks_marks WHERE date_task_id') !== null);
check('cleared to 0: the mission credit is deleted from date_tasks_mission_marks', findWrite($db, 'DELETE FROM date_tasks_mission_marks') !== null);

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
