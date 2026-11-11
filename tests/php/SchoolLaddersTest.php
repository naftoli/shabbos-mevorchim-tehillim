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

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all school-ladder checks passed\n";
