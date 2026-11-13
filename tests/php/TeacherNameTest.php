<?php

declare(strict_types=1);

// Placeholder class teachers. Run: php tests/php/TeacherNameTest.php

require __DIR__ . '/../../api/teacherName.php';
require __DIR__ . '/../../api/perfectPlatoon.php';

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

check('a real teacher is trimmed', wwtcTeacherName('  Rabbi Adler  ') === 'Rabbi Adler');
check('Naomi is a name', wwtcTeacherName('Naomi Fox') === 'Naomi Fox');
check('10 is a name', wwtcTeacherName('10') === '10');

foreach (['Na', 'na', 'NA', ' N/A ', 'n/a', 'None', 'NONE', ' none ', '-', ' - ', '0', ' 0 ', '', '   ', null] as $value) {
    $shown = $value === null ? 'null' : json_encode($value);
    check("placeholder $shown is no teacher", wwtcTeacherName($value) === '');
}

$roster = wwtcPlatoonRoster([
    [
        'schoolId' => 1,
        'school' => 'Sample',
        'classId' => 4,
        'grade' => '4',
        'sub' => 'Boys',
        'teacher' => ' Na ',
        'quota' => 8,
        'said' => 8,
    ],
    [
        'schoolId' => 1,
        'school' => 'Sample',
        'classId' => 6,
        'grade' => '6',
        'sub' => 'Girls',
        'teacher' => 'N/A',
        'quota' => 8,
        'said' => 8,
    ],
]);
check('4-Boys placeholder is stored as no teacher', $roster['classes'][4]['teacher'] === '');
check('6-Girls placeholder is stored as no teacher', $roster['classes'][6]['teacher'] === '');

$platoons = wwtcPerfectPlatoonsFromSoldiers([
    [
        'schoolId' => 1,
        'school' => 'Sample',
        'classId' => 4,
        'grade' => '4',
        'sub' => 'Boys',
        'teacher' => 'none',
        'quota' => 8,
        'said' => 8,
    ],
]);
check('a public platoon does not publish a placeholder teacher', $platoons[0]['teacher'] === '');

$board = file_get_contents(__DIR__ . '/../../api/campaignBoard.php');
$bootstrap = file_get_contents(__DIR__ . '/../../api/bootstrap.php');
check('school class meta trims the teacher', is_string($board) && strpos($board, 'wwtcTeacherName($m[\'teacher\']') !== false);
check('holiday class meta trims the teacher', is_string($board) && strpos($board, 'wwtcTeacherName($meta[\'teacher\']') !== false);
check('board class meta trims the teacher', is_string($bootstrap) && strpos($bootstrap, 'wwtcTeacherName($row[\'class_teacher\']') !== false);

echo "\n" . ($failed === 0 ? 'ok' : "$failed failed") . "\n";
exit($failed === 0 ? 0 : 1);
