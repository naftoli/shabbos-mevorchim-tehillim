<?php

declare(strict_types=1);

/**
 * Hebrew leap years follow the 19-year cycle. A year is leap when (year % 19)
 * is 0, 3, 6, 8, 11, 14, or 17.
 *
 * 5784 and 5787 are leap years (Adar I and Adar II). 5785 is not (one Adar).
 * The ladder sheet has one Adar quota; both leap-year Adars reuse it. Month
 * keys stay distinct ("Adar" vs "Adar I" / "Adar II") so the two Adars do not
 * overwrite each other and plain-year rows stay valid. No schema change: marks
 * are stored by Shabbos-Mevorchim julian day, and dedication month_name is
 * already VARCHAR(32).
 */

function wwtcIsHebrewLeapYear(int $year): bool
{
    $r = $year % 19;
    if ($r < 0) {
        $r += 19;
    }
    return in_array($r, [0, 3, 6, 8, 11, 14, 17], true);
}

/** @return list<string> Twelve months, or thirteen in a leap year. */
function wwtcCampaignMonthNames(int $year): array
{
    $months = ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];
    if (!wwtcIsHebrewLeapYear($year)) {
        return $months;
    }
    $out = [];
    foreach ($months as $month) {
        if ($month === 'Adar') {
            $out[] = 'Adar I';
            $out[] = 'Adar II';
        } else {
            $out[] = $month;
        }
    }
    return $out;
}

/**
 * Mission-history occasion for a campaign month. Adar I and Adar II stay
 * distinct so a leap year's two marks do not collapse onto one cell.
 */
function wwtcHistoryOccasion(string $month): string
{
    return $month;
}
