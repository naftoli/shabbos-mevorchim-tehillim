<?php

declare(strict_types=1);

// Per-school ladder switches. No row means every ladder is on.
// Run: php tests/php/SchoolLaddersTest.php

require __DIR__ . '/../../api/schoolLadders.php';

$failed = 0;
function check(string $name, bool $ok): void
{
    global $failed;
    if ($ok) {
        echo "ok  $name\n";
        return;
    }
    $failed++;
    echo "FAIL $name\n";
}

check('the eight ladders are 12 down to 5', wwtcLadderChoices() === [12, 11, 10, 9, 8, 7, 6, 5]);
check('nothing hidden leaves every ladder on', wwtcVisibleLadders([]) === wwtcLadderChoices());
check('unknown numbers are ignored', wwtcNormalizeHiddenLadders([4, 5, 5, 13, '6']) === [5, 6]);

$hidden = wwtcNormalizeHiddenLadders([
    ['ladder' => 5, 'enabled' => false],
    ['ladder' => 12, 'enabled' => true],
    ['ladder' => 7, 'enabled' => 0],
]);
check('an off switch is stored and an on switch is not', $hidden === [5, 7]);
check('visible ladders skip the ones that are off', wwtcVisibleLadders($hidden) === [12, 11, 10, 9, 8, 6]);
check('a hidden ladder is hidden', wwtcLadderIsHidden(5, $hidden) && !wwtcLadderIsHidden(8, $hidden));

$switches = wwtcLadderSwitchList([6]);
$six = null;
$five = null;
foreach ($switches as $row) {
    if ($row['ladder'] === 6) {
        $six = $row;
    }
    if ($row['ladder'] === 5) {
        $five = $row;
    }
}
check('the admin list has every ladder', count($switches) === 8 && $six['enabled'] === false && $five['enabled'] === true);

$sql = (string) file_get_contents(__DIR__ . '/../../api/sql/wwtc_school_ladders.sql');
check('the table defaults enabled to on', strpos($sql, 'enabled TINYINT(1) NOT NULL DEFAULT 1') !== false);
check('the table is keyed by school and ladder', strpos($sql, 'PRIMARY KEY (school_id, ladder)') !== false);

$schoolOff = [5];
$classOn = [5 => true, 6 => false];
$childOn = [6 => true];
check('no setting leaves the ladder on', wwtcLadderOnForScope(8, [], [], []) === true);
check('the school switch applies when nothing is more specific', wwtcLadderOnForScope(5, $schoolOff, [], []) === false);
check('a class on beats a school off', wwtcLadderOnForScope(5, $schoolOff, $classOn, []) === true);
check('a class off beats a school on', wwtcLadderOnForScope(6, [], $classOn, []) === false);
check('a child on beats a class off', wwtcLadderOnForScope(6, $schoolOff, $classOn, $childOn) === true);
check('a child off beats a class on', wwtcLadderOnForScope(5, [], [5 => true], [5 => false]) === false);
check(
    'the resolved list is the ladders that are off, in picker order',
    wwtcHiddenForScope($schoolOff, $classOn, $childOn) === []
    && wwtcHiddenForScope($schoolOff, $classOn, []) === [6]
    && wwtcHiddenForScope([6, 12], [12 => true], []) === [6]
);

$rows = wwtcNormalizeScopeRows([
    ['classId' => 3, 'ladder' => 5, 'enabled' => false],
    ['classId' => 3, 'ladder' => 5, 'enabled' => true],
    ['classId' => 3, 'ladder' => 4, 'enabled' => false],
    ['classId' => 9, 'ladder' => 8, 'enabled' => null],
    ['classId' => '4', 'ladder' => '7', 'enabled' => '0'],
], 'classId');
check('scope rows keep an explicit on or off and drop inherit', $rows === [
    ['id' => 3, 'ladder' => 5, 'enabled' => true],
    ['id' => 4, 'ladder' => 7, 'enabled' => false],
]);

$scopeSql = (string) file_get_contents(__DIR__ . '/../../api/sql/wwtc_ladder_scopes.sql');
check('class overrides have their own table', strpos($scopeSql, 'CREATE TABLE IF NOT EXISTS wwtc_class_ladders') !== false);
check('child overrides have their own table', strpos($scopeSql, 'CREATE TABLE IF NOT EXISTS wwtc_child_ladders') !== false);
check('a class row is keyed by class and ladder', strpos($scopeSql, 'PRIMARY KEY (class_id, ladder)') !== false);
check('a child row is keyed by soldier and ladder', strpos($scopeSql, 'PRIMARY KEY (user_id, ladder)') !== false);
check('an override row must say on or off', strpos($scopeSql, 'enabled TINYINT(1) NOT NULL,') !== false);
check('the scope file does not drop the school table', strpos($scopeSql, 'DROP TABLE') === false);
check('the scope file leaves the school table alone', strpos($scopeSql, 'wwtc_school_ladders') !== false && strpos($scopeSql, 'ALTER TABLE wwtc_school_ladders') === false);

$src = (string) file_get_contents(__DIR__ . '/../../api/schoolLadders.php');
check('the child ladder read does not select a name', strpos($src, 'u.first') === false && strpos($src, 'u.last') === false);
$public = (string) file_get_contents(__DIR__ . '/../../api/routes/public.php');
check('the public school payload stays on the school switch', strpos($public, 'wwtcHiddenLaddersForSchool') !== false);
check('the public school payload does not read child ladder rows', strpos($public, 'wwtc_child_ladders') === false);

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all school-ladder checks passed\n";
