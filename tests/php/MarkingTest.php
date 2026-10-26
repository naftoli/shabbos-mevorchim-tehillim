<?php

declare(strict_types=1);

// Unit test for the Tehillim marking write path (api/marking.php), driven by a
// fake PDO that records every statement and returns canned lookup rows. Verifies
// the insert / update / delete branches and the kapitelach mission-mark
// reconciliation against quota — the logic that writes children's records and
// that the read-only prod account can't exercise directly.
//
// Run: php tests/php/MarkingTest.php   (any PHP 7.2+)

define('WWTC_SUBJECT_ID', 1);
require __DIR__ . '/../../api/marking.php';

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
    public $queries = [];              // [ [normalizedSql, params], ... ]
    public $existingMarkTaskId = false; // what the "find existing mark" SELECT returns
    public $mission = null;             // reconcile lookup row
    public $missionMarkExists = false;  // does a mission mark already exist
    public function __construct() {}    // no real connection
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
    if ($cond) {
        echo "ok   - $label\n";
    } else {
        $failures++;
        echo "FAIL - $label\n";
    }
}
/** Does any recorded query match $needle (and optionally carry $param)? */
function ran(FakePDO $db, string $needle, $paramKey = null, $paramVal = null): bool
{
    foreach ($db->queries as [$sql, $params]) {
        if (strpos($sql, $needle) !== false) {
            if ($paramKey === null) { return true; }
            if (array_key_exists($paramKey, $params) && $params[$paramKey] == $paramVal) { return true; }
        }
    }
    return false;
}

$KAP = ['grid_id' => 8001, 'date_task_id' => 111, 'description' => 'א-מ', 'points' => 0.5];
$MIN = ['grid_id' => 8002, 'date_task_id' => 222, 'description' => '36', 'points' => 0.5];
$DATE = 2461646;

// 1) New kapitlach mark that reaches quota -> INSERT mark + INSERT mission mark.
$db = new FakePDO();
$db->existingMarkTaskId = false;
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 10];
$db->missionMarkExists = false;
wwtcApplyMark($db, 777, $DATE, $KAP, 40, true);
check('new kapitlach: inserts the mark with done_qty', ran($db, 'INSERT INTO date_tasks_marks', ':v', 40));
check('new kapitlach: records the mark on the right task', ran($db, 'INSERT INTO date_tasks_marks', ':tid', 111));
check('quota reached: inserts the mission mark', ran($db, 'INSERT IGNORE INTO date_tasks_mission_marks'));

// 2) New kapitlach mark BELOW quota -> INSERT mark, NO mission mark.
$db = new FakePDO();
$db->existingMarkTaskId = false;
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 10];
wwtcApplyMark($db, 777, $DATE, $KAP, 5, true);
check('below quota: inserts the mark', ran($db, 'INSERT INTO date_tasks_marks'));
check('below quota: does NOT insert a mission mark', !ran($db, 'INSERT IGNORE INTO date_tasks_mission_marks'));

// 3) Existing mark, new value -> UPDATE; value drops below quota and a mission
//    mark exists -> DELETE the mission mark.
$db = new FakePDO();
$db->existingMarkTaskId = 111;
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 10];
$db->missionMarkExists = true;
wwtcApplyMark($db, 777, $DATE, $KAP, 5, true);
check('existing mark: updates done_qty', ran($db, 'UPDATE date_tasks_marks SET done_qty', ':v', 5));
check('dropped below quota: deletes the mission mark', ran($db, 'DELETE FROM date_tasks_mission_marks'));
check('update path: never inserts a second mark', !ran($db, 'INSERT INTO date_tasks_marks'));

// 4) Existing mark cleared to 0 -> DELETE mark + force-delete mission mark.
$db = new FakePDO();
$db->existingMarkTaskId = 111;
$db->mission = ['date_tasks_mission_id' => 5, 'mission_name' => 'Tehillim', 'quantity' => 10];
wwtcApplyMark($db, 777, $DATE, $KAP, 0, true);
check('cleared to 0: deletes the mark', ran($db, 'DELETE FROM date_tasks_marks WHERE date_task_id'));
check('cleared to 0: deletes the mission mark', ran($db, 'DELETE FROM date_tasks_mission_marks'));

// 5) Minutes (grid 8002) never touches mission marks, whatever the value.
$db = new FakePDO();
$db->existingMarkTaskId = false;
wwtcApplyMark($db, 777, $DATE, $MIN, 90, false);
check('minutes: inserts the minutes mark', ran($db, 'INSERT INTO date_tasks_marks', ':tid', 222));
check('minutes: never writes a mission mark', !ran($db, 'date_tasks_mission_marks'));

// 6) Zero value with no existing mark -> no write at all.
$db = new FakePDO();
$db->existingMarkTaskId = false;
wwtcApplyMark($db, 777, $DATE, $KAP, 0, true);
check('zero + no existing mark: writes nothing', count($db->queries) === 1); // only the lookup SELECT

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
