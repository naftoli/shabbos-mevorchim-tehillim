<?php

declare(strict_types=1);

// Running-totals breakdown. Cheshvan 5778 is the first Shabbos Mevorchim.
// A leap year keeps Adar I and Adar II. Run: php tests/php/RunningTotalsTest.php

require __DIR__ . '/../../api/runningTotals.php';

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

$first = wwtcBreakdownMonthNames(5778);
check('5778 starts at Cheshvan', $first[0] === 'Cheshvan');
check('5778 has no Tishrei row', !in_array('Tishrei', $first, true));
check('5778 ends at Elul', $first[count($first) - 1] === 'Elul' && count($first) === 11);

$leap = wwtcBreakdownMonthNames(5784);
$plain = wwtcBreakdownMonthNames(5785);
check('5784 lists Adar I then Adar II', $leap[5] === 'Adar I' && $leap[6] === 'Adar II');
check('5785 lists one Adar', $plain[5] === 'Adar' && !in_array('Adar I', $plain, true));

$dates = [
    5784 => ['Tishrei' => 10, 'Adar I' => 11, 'Adar II' => 12, 'Nissan' => 13],
    5785 => ['Tishrei' => 20, 'Adar' => 21, 'Nissan' => 22],
];
$live = [
    20 => ['kapitlach' => 100, 'minutes' => 40],
    21 => ['kapitlach' => 80, 'minutes' => 30],
    22 => ['kapitlach' => 50, 'minutes' => 20],
];
$sealed = [
    11 => ['kapitlach' => 9, 'minutes' => 4],
    12 => ['kapitlach' => 8, 'minutes' => 3],
    1 => ['kapitlach' => 5, 'minutes' => 2],
];
$out = wwtcFoldRunningBreakdown(5785, $dates, $live, $sealed, 7, 1);
$byYear = [];
foreach ($out['years'] as $row) {
    $byYear[$row['year']] = $row;
}
check('years start at 5778', $out['firstYear'] === 5778 && $out['years'][0]['year'] === 5778);
check('this year is one row per elapsed month', array_column($out['months'], 'month') === ['Tishrei', 'Adar', 'Nissan']);
check('this year months carry kapitlach and minutes', $out['months'][0]['kapitlach'] === 100 && $out['months'][0]['minutes'] === 40);
check('Adar I and Adar II stay on their leap year', $byYear[5784]['kapitlach'] === 17 && $byYear[5784]['minutes'] === 7);
check('unplaced sealed totals and the base sit on 5778', $byYear[5778]['kapitlach'] === 12 && $byYear[5778]['minutes'] === 3);
check('this year is the live total', $byYear[5785]['kapitlach'] === 230 && $byYear[5785]['minutes'] === 90);

$leapNow = wwtcFoldRunningBreakdown(5784, $dates, [
    11 => ['kapitlach' => 3, 'minutes' => 1],
    12 => ['kapitlach' => 4, 'minutes' => 1],
], [], 0, 0);
check(
    'a leap year in progress shows Adar I and Adar II',
    array_column($leapNow['months'], 'month') === ['Adar I', 'Adar II']
);

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all running-totals checks passed\n";
