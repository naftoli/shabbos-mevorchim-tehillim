<?php

declare(strict_types=1);

// Grade order for class lists. Pre-1A has no leading number, so the old label
// sort left it after 12th grade. Run: php tests/php/ClassOrderTest.php

require __DIR__ . '/../../api/perfectPlatoon.php';
require __DIR__ . '/../../api/notify.php';

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

$labels = [
    '12-A', '2nd Grade', 'Pre-1A', '10th Grade', '1-Boys', 'pre1a', 'P1A',
    '1st Grade A', '1st Grade', 'Pre1a-Boys', '4-boys', '4-Boys', '3-Boys', 'Nursery',
];
usort($labels, 'wwtcCmpClassLabels');
check('Pre-1A leads and numbered grades stay in grade order', $labels === [
    'P1A', 'Pre-1A', 'pre1a', 'Pre1a-Boys', '1-Boys', '1st Grade', '1st Grade A',
    '2nd Grade', '3-Boys', '4-Boys', '4-boys', '10th Grade', '12-A', 'Nursery',
]);

$engine = [
    ['id' => 30, 'name' => '12-A', 'grade' => '12', 'teacher' => '', 'perfect' => true, 'size' => 1, 'met' => 1],
    ['id' => 20, 'name' => '1-B', 'grade' => '1', 'teacher' => '', 'perfect' => false, 'size' => 1, 'met' => 0],
    ['id' => 10, 'name' => 'Pre-1A', 'grade' => 'Pre1a', 'teacher' => '', 'perfect' => false, 'size' => 1, 'met' => 0],
    ['id' => 21, 'name' => '1-A', 'grade' => '1', 'teacher' => '', 'perfect' => false, 'size' => 1, 'met' => 0],
];
$aligned = wwtcAlignSchoolClasses($engine, ['classes' => []], 61);
$names = [];
foreach ($aligned as $class) {
    $names[] = $class['name'];
}
check('the school class list lifts Pre-1A ahead of 1st grade', $names === ['Pre-1A', '1-A', '1-B', '12-A']);

$hebrew = wwtcSortClasses([
    ['id' => 4, 'name' => '3-Boys', 'grade' => '3'],
    ['id' => 3, 'name' => 'כיתה א', 'grade' => '2'],
    ['id' => 2, 'name' => '1', 'grade' => '1'],
    ['id' => 1, 'name' => 'Pre-1A', 'grade' => 'pre1a'],
]);
$hebrewNames = [];
foreach ($hebrew as $class) {
    $hebrewNames[] = $class['name'];
}
check('a Hebrew class name follows its grade, after Pre-1A', $hebrewNames === ['Pre-1A', '1', 'כיתה א', '3-Boys']);

$platoons = wwtcPerfectPlatoonsFromSoldiers([
    ['schoolId' => 2, 'school' => 'Sample Cheder', 'classId' => 3, 'grade' => '12', 'sub' => 'A', 'teacher' => '', 'quota' => 1, 'said' => 1, 'userId' => 3],
    ['schoolId' => 1, 'school' => 'Other Base', 'classId' => 1, 'grade' => '1', 'sub' => 'A', 'teacher' => '', 'quota' => 1, 'said' => 1, 'userId' => 4],
    ['schoolId' => 2, 'school' => 'Sample Cheder', 'classId' => 11, 'grade' => 'Pre-1A', 'sub' => '', 'teacher' => '', 'quota' => 1, 'said' => 1, 'userId' => 1],
    ['schoolId' => 2, 'school' => 'Sample Cheder', 'classId' => 2, 'grade' => '2', 'sub' => 'Boys', 'teacher' => '', 'quota' => 1, 'said' => 1, 'userId' => 2],
]);
$shown = [];
foreach ($platoons as $row) {
    $shown[] = $row['school'] . ' ' . $row['className'];
}
check('perfect platoons keep school order and put Pre-1A first in the school', $shown === [
    'Other Base 1-A',
    'Sample Cheder Pre-1A',
    'Sample Cheder 2-Boys',
    'Sample Cheder 12-A',
]);

$report = wwtcNotifyComposeReport(
    wwtcNotifyRecipient(9, 'Rivka', 'base', 61, 'Sample Cheder', 0, '', '7185550100', 'rivka@example.com'),
    [61 => [
        'name' => 'Sample Cheder',
        'classes' => [
            ['id' => 30, 'name' => '12-A', 'students' => [['name' => 'Alef', 'quota' => 1, 'said' => 1]]],
            ['id' => 20, 'name' => '1-A', 'students' => [['name' => 'Beis', 'quota' => 1, 'said' => 1]]],
            ['id' => 10, 'name' => 'Pre-1A', 'students' => [['name' => 'Gimmel', 'quota' => 1, 'said' => 0]]],
        ],
    ]],
    'Cheshvan',
    5787,
    'https://example.test/login',
    'December 1'
);
check('the Wednesday By class lines put Pre-1A first', $report['classLines'] === [
    'Class Pre-1A: 0 of 1',
    'Class 1-A: 1 of 1',
    'Class 12-A: 1 of 1',
]);
$pdf = '';
foreach ($report['pdfLines'] as $line) {
    $pdf .= $line['text'] . "\n";
}
$preAt = strpos($pdf, 'Class Pre-1A: 0 of 1');
$oneAt = strpos($pdf, 'Class 1-A: 1 of 1');
$twelveAt = strpos($pdf, 'Class 12-A: 1 of 1');
check('the PDF By class block lists Pre-1A before 1st grade before 12th', $preAt !== false && $oneAt !== false && $twelveAt !== false && $preAt < $oneAt && $oneAt < $twelveAt);

if ($failed > 0) {
    fwrite(STDERR, "$failed failed\n");
    exit(1);
}
echo "ok   - class order\n";
