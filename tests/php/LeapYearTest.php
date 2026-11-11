<?php

declare(strict_types=1);

// Leap years (13 months) keep Adar I and Adar II as separate months. A plain
// year has one Adar. Run: php tests/php/LeapYearTest.php

require __DIR__ . '/../../api/hebrewYear.php';

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

check('5784 is a leap year', wwtcIsHebrewLeapYear(5784));
check('5787 is a leap year', wwtcIsHebrewLeapYear(5787));
check('5782 is a leap year', wwtcIsHebrewLeapYear(5782));
check('5785 is not a leap year', !wwtcIsHebrewLeapYear(5785));
check('5786 is not a leap year', !wwtcIsHebrewLeapYear(5786));

$leap = wwtcCampaignMonthNames(5784);
$plain = wwtcCampaignMonthNames(5785);
check('leap year has 13 months', count($leap) === 13);
check('plain year has 12 months', count($plain) === 12);
check('leap year lists Adar I then Adar II', $leap[5] === 'Adar I' && $leap[6] === 'Adar II');
check('plain year lists a single Adar', $plain[5] === 'Adar' && !in_array('Adar I', $plain, true) && !in_array('Adar II', $plain, true));
check('5787 matches 5784', wwtcCampaignMonthNames(5787) === $leap);

// The two Adars must not share an occasion key. A later mark used to overwrite
// the earlier one because both were stored as "Adar".
$history = [];
foreach (['Adar I' => 8, 'Adar II' => 6] as $month => $ladder) {
    $history[wwtcHistoryOccasion($month)] = $ladder;
}
check('Adar I and Adar II do not overwrite', ($history['Adar I'] ?? null) === 8 && ($history['Adar II'] ?? null) === 6 && count($history) === 2);
check('a plain Adar key is left as Adar', wwtcHistoryOccasion('Adar') === 'Adar');

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all leap-year checks passed\n";
