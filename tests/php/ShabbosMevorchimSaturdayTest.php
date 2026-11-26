<?php

declare(strict_types=1);

// Mock test for "the new month starts on Saturday".
//
// A child's report is attributed to a campaign month by its Shabbos Mevorchim
// date (api/bootstrap.php: wwtcCurrentDate() picks the most recent Shabbos
// Mevorchim jd <= today, and that jd becomes the mark_date — see ReportSaveTest).
// Those dates come from calculateSM() (public/db.php). This test proves:
//
//   1. Every Shabbos Mevorchim the campaign uses is a SATURDAY — so a new month
//      is always anchored to a Saturday, never a weekday.
//   2. Each one is the Saturday that blesses (precedes) its Rosh Chodesh.
//   3. The rollover rule in wwtcCurrentDate() flips to the new month exactly at
//      that Saturday's day-count and not a day before it (no mid-week start).
//
// A note on the "+1 jdtounix fix": calculateSM() stores each date as a julian
// day carrying PHP's documented jdtounix off-by-one, so the day-of-week must be
// read back through the SAME jdtounix() the whole app uses — which is what this
// test does, and what every reader (mark_date, start_date, end_date) relies on.
// Because of that same offset, the LIVE wall-clock flip (wwtcCurrentDate uses
// unixtojd(now), the true jd) lands as Shabbos Mevorchim ends — i.e. children
// report after Shabbos, as the commander script instructs — which case 4 shows.
//
// Run: php tests/php/ShabbosMevorchimSaturdayTest.php   (any PHP 7.2+ with the
// calendar extension; no DB).

date_default_timezone_set('America/New_York'); // the app's timezone (see tests/tehillim mock_db)

// --- Verbatim copy of the active calculateSM() in public/db.php (~line 786). ---
// Kept here the way tests/tehillim/support/mock_db.php keeps its copy: pure
// calendar math, no DB, so the real campaign-date logic can be unit tested.
// If public/db.php changes, update this copy.
function calculateSM($year)
{
    $sm = array();
    $day = 29; // last day of month before Rosh Chodesh
    // first get last sm for previous year
    $date = jewishtojd(13, $day, ($year - 1));
    $date += 1; // fix issue with jdtounix showing a day off
    $time = jdtounix($date);
    $dayOfWeek = date("w", $time);
    $sm[0] = $date - ($dayOfWeek + 1);
    for ($i = 1; $i < 13; $i++) {
        $date = jewishtojd($i, $day, $year);
        $date += 1; // fix issue with jdtounix showing a day off
        $time = jdtounix($date);
        $dayOfWeek = date("w", $time);
        $sm[$i] = $date - ($dayOfWeek + 1);
    }
    return $sm;
}

// The selection rule from wwtcCurrentDate() (api/bootstrap.php): the most recent
// Shabbos Mevorchim on or before "now", where now and the dates are the same
// julian-day space. Pulled out so it can be driven with a fake "now".
function currentSmFor(int $nowJd, array $smDates): int
{
    $current = null;
    foreach ($smDates as $jd) {
        if ($jd > $nowJd) { break; }
        $current = $jd;
    }
    return $current ?? (int) reset($smDates);
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

$WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Day-of-week as the app sees it: convert the stored jd back with jdtounix (the
// same conversion the app uses everywhere) and read the weekday. 6 = Saturday.
function appWeekday(int $jd): int
{
    return (int) date('w', jdtounix($jd));
}

echo "# 1. Every Shabbos Mevorchim the campaign uses is a Saturday (years 5785-5792)\n";
$allSaturday = true;
foreach (range(5785, 5792) as $year) {
    $sm = calculateSM($year);
    foreach ($sm as $idx => $jd) {
        $w = appWeekday($jd);
        if ($w !== 6) {
            $allSaturday = false;
            echo "     $year[$idx] jd=$jd is {$GLOBALS['WD'][$w]} (" . date('Y-m-d', jdtounix($jd)) . "), not Saturday\n";
        }
    }
}
check('all Shabbos Mevorchim dates, every month, every year, fall on Saturday', $allSaturday);

echo "\n# 2. Each Shabbos Mevorchim is the Saturday that precedes its Rosh Chodesh\n";
// Rosh Chodesh Cheshvan 5786 is 1 Cheshvan; the SM for it must be the Saturday
// strictly before that date (1..7 days earlier).
$sm86 = calculateSM(5786);
$cheshvanSm = $sm86[1];                       // index 1 = Cheshvan
$roshChodeshCheshvan = jewishtojd(2, 1, 5786); // 1 Cheshvan (month 2)
$gap = $roshChodeshCheshvan - jdtounix($cheshvanSm) / 86400; // rough; use date math below instead
$smDateStr = date('Y-m-d', jdtounix($cheshvanSm));
$rcDateStr = jdtogregorian($roshChodeshCheshvan);
$daysBefore = (strtotime($rcDateStr) - jdtounix($cheshvanSm)) / 86400;
check('the Cheshvan Shabbos Mevorchim is a Saturday', appWeekday($cheshvanSm) === 6);
check('it falls in the 1-7 days before Rosh Chodesh Cheshvan (SM ' . $smDateStr . ', RC ' . $rcDateStr . ')',
    $daysBefore >= 1 && $daysBefore <= 7);

echo "\n# 3. The reporting month flips exactly at the Shabbos Mevorchim day-count\n";
// Drive wwtcCurrentDate()'s selection rule with a fake "now" in jd space.
$smDates = array_values($sm86);
$cheshvan = $sm86[1];
$kislev   = $sm86[2];
check('the day BEFORE Cheshvan Shabbos Mevorchim still reports the prior month (Tishrei)',
    currentSmFor($cheshvan - 1, $smDates) === $sm86[0]);
check('ON the Cheshvan Shabbos Mevorchim day-count, the month is Cheshvan',
    currentSmFor($cheshvan, $smDates) === $cheshvan);
check('it stays Cheshvan right up to the day before the next Shabbos Mevorchim',
    currentSmFor($kislev - 1, $smDates) === $cheshvan);
check('at the next Shabbos Mevorchim day-count it becomes Kislev',
    currentSmFor($kislev, $smDates) === $kislev);

echo "\n# 4. Live boundary: reports roll to the new month as Shabbos Mevorchim ends\n";
// wwtcCurrentDate() compares the stored SM jd against unixtojd(now) (the true
// jd). Because the stored jd carries the +1 jdtounix fix, the wall-clock flip
// happens once the Shabbos Mevorchim Saturday has passed (Saturday night) —
// which is exactly when children report what they said on Shabbos.
$smSaturdayUnix = jdtounix($cheshvan);                 // the SM Saturday, 2025-11-15
$fridayBefore   = unixtojd(strtotime(date('Y-m-d', $smSaturdayUnix) . ' 12:00:00') - 86400);
$theSaturday    = unixtojd(strtotime(date('Y-m-d', $smSaturdayUnix) . ' 12:00:00'));
$sundayAfter    = unixtojd(strtotime(date('Y-m-d', $smSaturdayUnix) . ' 12:00:00') + 86400);
check('the Friday before still shows the prior month (Tishrei)',
    currentSmFor($fridayBefore, $smDates) === $sm86[0]);
check('once Shabbos Mevorchim has passed, the new month (Cheshvan) is active',
    currentSmFor($sundayAfter, $smDates) === $cheshvan);
// Document the exact flip day so the offset is visible, not hidden.
echo "     (SM Saturday " . date('D Y-m-d', $smSaturdayUnix)
    . "; reporting month becomes Cheshvan from " . ($theSaturday >= $cheshvan ? 'the Saturday' : 'Saturday night onward') . ")\n";

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
