<?php

declare(strict_types=1);

// The training ladder counts Done boxes, including Adar II in a leap year.
// A lifetime sum that is larger than the ladder is not this count.
// Run: php tests/php/TrainingCountTest.php

require __DIR__ . '/../../api/trainingCount.php';

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

function markMonths(int $year, array $skip): array
{
    $row = [];
    foreach (wwtcCampaignMonthNames($year) as $month) {
        if (in_array($month, $skip, true)) {
            continue;
        }
        $row[$month] = 10;
    }
    return $row;
}

function gradeNum(string $g): int
{
    return $g === 'pre1a' ? 0 : (int) $g;
}

// Same soldier as the web test: grade 6 in 5787, ladder 5, misses on the way.
$year = 5787;
$skips = [
    'pre1a' => ['Iyar'],
    '1' => ['Teves', 'Sivan', 'Av'],
    '2' => ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat'],
    '3' => ['Tammuz'],
    '4' => ['Cheshvan', 'Tammuz'],
    '5' => ['Tishrei', 'Teves'],
];
$history = [];
foreach (['pre1a', '1', '2', '3', '4', '5'] as $g) {
    $history[$g] = markMonths($year - (6 - gradeNum($g)), $skips[$g]);
}
$history['6'] = markMonths(5787, []);
$history['8'] = markMonths(5789, []);
$count = wwtcCountTrainingLadder('6', 5, $year, $history, [
    ['month' => 'Tishrei', 'met' => false, 'reported' => true],
    ['month' => 'Cheshvan', 'met' => true, 'reported' => true],
    ['month' => 'Kislev', 'met' => true, 'reported' => true],
]);

$expect = [
    'pre1a' => [11, 12],
    '1' => [10, 13],
    '2' => [7, 12],
    '3' => [12, 13],
    '4' => [10, 12],
    '5' => [10, 12],
    '6' => [2, 13],
];
$doneSum = 0;
$totalSum = 0;
foreach ($count['sections'] as $section) {
    $pair = $expect[$section['grade']];
    check($section['grade'] . ' is ' . $pair[0] . ' out of ' . $pair[1], $section['done'] === $pair[0] && $section['total'] === $pair[1]);
    $doneSum += $section['done'];
    $totalSum += $section['total'];
}
check('earned matches the section dones', $count['earned'] === $doneSum && $count['earned'] === 62);
check('total matches the section boxes', $count['total'] === $totalSum && $count['total'] === 87);
check('earned is not more than the ladder', $count['earned'] <= $count['total']);
check('the lifetime 88 is not the ladder earned count', $count['earned'] !== 88);

// Grade 2 in 5783, so 1st grade was leap year 5782. Past grades read history.
$adar = wwtcCountTrainingLadder('2', 2, 5783, ['1' => ['Adar' => 8]], []);
$grade1 = null;
foreach ($adar['sections'] as $section) {
    if ($section['grade'] === '1') {
        $grade1 = $section;
    }
}
check('a leap grade has 13 boxes', $grade1 !== null && $grade1['total'] === 13);
check('one stored Adar counts once', $grade1 !== null && $grade1['done'] === 1);
check('Adar-only earned stays within the total', $adar['earned'] <= $adar['total'] && $adar['earned'] === 1);

$miss = wwtcCountTrainingLadder('3', 3, 5787, [], [
    ['month' => 'Adar I', 'met' => true, 'reported' => true],
    ['month' => 'Adar II', 'met' => false, 'reported' => true],
    ['month' => 'Nissan', 'met' => true, 'reported' => true],
]);
$grade3 = null;
foreach ($miss['sections'] as $section) {
    if ($section['grade'] === '3') {
        $grade3 = $section;
    }
}
check('Adar II is a box and a miss is not earned', $grade3 !== null && $grade3['total'] === 13 && $grade3['done'] === 2);
check('miss case earned stays within the total', $miss['earned'] <= $miss['total']);

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all training-count checks passed\n";
