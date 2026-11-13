<?php

declare(strict_types=1);

// School-year rotation. Tishrei stays today's sequence. Shvat starts at
// Mevorchim Shvat (quota position 1) and ends the grade in Teves.
// Run: php tests/php/SchoolYearTest.php

require __DIR__ . '/../../api/schoolYear.php';

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

$plain = ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];
$shvat = ['Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Teves'];

check('plain months match the campaign calendar', wwtcPlainMonthNames() === wwtcCampaignMonthNames(5785));
check('Tishrei is the default', wwtcNormalizeFirstMonth('') === 'Tishrei');
check('an unknown month stays Tishrei', wwtcNormalizeFirstMonth('Foo') === 'Tishrei');
check('Shvat is kept', wwtcNormalizeFirstMonth('Shvat') === 'Shvat');

$sql = (string) file_get_contents(__DIR__ . '/../../api/sql/wwtc_school_settings.sql');
check(
    'first_month is NOT NULL DEFAULT Tishrei',
    strpos($sql, "first_month VARCHAR(32) NOT NULL DEFAULT 'Tishrei'") !== false
);
check('no settings row is Tishrei', wwtcFirstMonthFromRow(null) === 'Tishrei' && wwtcFirstMonthFromRow(false) === 'Tishrei');
check('a row with no month is Tishrei', wwtcFirstMonthFromRow([]) === 'Tishrei' && wwtcFirstMonthFromRow(['first_month' => '']) === 'Tishrei');
check('a blank yearStart is Tishrei', wwtcFirstMonthFromRow(['yearStart' => null]) === 'Tishrei');
$none = wwtcFirstMonthFromRow(null);
check(
    'a school with no row keeps today\'s Tishrei year',
    $none === 'Tishrei'
    && array_column(wwtcSchoolYearSlots($none, 5785), 'month') === wwtcCampaignMonthNames(5785)
    && array_column(wwtcSchoolYearSlots($none, 5787), 'month') === wwtcCampaignMonthNames(5787)
    && wwtcGradeEndMonth($none) === 'Elul'
);
check('a saved Shvat row is not the default', wwtcFirstMonthFromRow(['first_month' => 'Shvat']) === 'Shvat');

$tishreiPlain = array_column(wwtcSchoolYearSlots('Tishrei', 5785), 'month');
$tishreiLeap = array_column(wwtcSchoolYearSlots('Tishrei', 5787), 'month');
check('Tishrei plain year matches campaign months', $tishreiPlain === wwtcCampaignMonthNames(5785));
check('Tishrei leap year matches campaign months', $tishreiLeap === wwtcCampaignMonthNames(5787));
check('Tishrei grade ends in Elul', wwtcGradeEndMonth('Tishrei') === 'Elul');
check('Tishrei end cell is Elul', wwtcQuotaSheetMonth(wwtcGradeEndMonth('Tishrei'), 'Tishrei') === 'Elul');

$same = true;
foreach ($plain as $month) {
    if (wwtcQuotaSheetMonth($month, 'Tishrei') !== $month) {
        $same = false;
    }
}
check('Tishrei sheet month is the calendar month', $same);
check('Adar I and Adar II share the Adar cell for a Tishrei school', wwtcQuotaSheetMonth('Adar I', 'Tishrei') === 'Adar' && wwtcQuotaSheetMonth('Adar II', 'Tishrei') === 'Adar');

$slots = wwtcSchoolYearSlots('Shvat', 5786);
check('Shvat year starts at Shvat', $slots[0]['month'] === 'Shvat' && $slots[0]['position'] === 1 && $slots[0]['sheetMonth'] === 'Tishrei');
check('Shvat sequence is Shvat through Teves', array_column($slots, 'month') === $shvat);
check('Shvat grade ends in Teves on the Elul cell', wwtcGradeEndMonth('Shvat') === 'Teves' && $slots[count($slots) - 1]['sheetMonth'] === 'Elul');
check('Shvat uses the Tishrei cell and Teves uses the Elul cell', wwtcQuotaSheetMonth('Shvat', 'Shvat') === 'Tishrei' && wwtcQuotaSheetMonth('Teves', 'Shvat') === 'Elul');
check('Shvat Adar uses the Cheshvan cell', wwtcQuotaSheetMonth('Adar', 'Shvat') === 'Cheshvan' && wwtcQuotaSheetMonth('Adar I', 'Shvat') === 'Cheshvan');

check('Cheshvan 5787 belongs to the Shvat 5786 grade year', wwtcSchoolYearStartYear('Shvat', 5787, 'Cheshvan') === 5786);
check('Shvat 5787 starts a new grade year', wwtcSchoolYearStartYear('Shvat', 5787, 'Shvat') === 5787);
check('Tishrei schools stay in the current Hebrew year', wwtcSchoolYearStartYear('Tishrei', 5787, 'Cheshvan') === 5787);
check('Shvat 5786 runs into 5787 at Tishrei', $slots[0]['year'] === 5786 && $slots[count($slots) - 1]['year'] === 5787);
check('5786 Shvat year has one Adar', !in_array('Adar I', array_column($slots, 'month'), true));

$leap = wwtcSchoolYearSlots('Shvat', 5787);
$names = array_column($leap, 'month');
check('leap Shvat year lists Adar I then Adar II', $names[1] === 'Adar I' && $names[2] === 'Adar II' && $names[3] === 'Nissan');
$shared = true;
foreach ($leap as $slot) {
    if (strpos($slot['month'], 'Adar') === 0 && ($slot['sheetMonth'] !== 'Cheshvan' || $slot['position'] !== 2 || $slot['year'] !== 5787)) {
        $shared = false;
    }
}
check('leap Adars share the Cheshvan cell and position 2', $shared);

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all school-year checks passed\n";
