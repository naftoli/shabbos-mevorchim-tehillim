<?php

declare(strict_types=1);

require_once __DIR__ . '/hebrewYear.php';

/**
 * FIRST_SHABBOS_MEVORCHIM
 *
 * The month a school picks is its first Shabbos Mevorchim: Mevorchim M,
 * the Shabbos held in the month before M that blesses M. That month is
 * quota and ladder position 1.
 *
 * Tishrei → Mevorchim Tishrei (held in Elul) → today's sequence. The grade
 * ends in Elul. Shvat → Mevorchim Shvat (held in Teves) → Shvat, Adar, …,
 * Teves. The grade ends in Teves. Shvat uses the Tishrei quota cell.
 *
 * Adar I and Adar II stay two reporting months and share the single quota
 * cell of whichever position Adar occupies. Matches src/lib/schoolYear.js.
 */

const WWTC_DEFAULT_FIRST_MONTH = 'Tishrei';

function wwtcPlainMonthNames(): array
{
    return ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];
}

function wwtcNormalizeFirstMonth(string $month): string
{
    $name = trim($month);
    return in_array($name, wwtcPlainMonthNames(), true) ? $name : WWTC_DEFAULT_FIRST_MONTH;
}

/**
 * First month for one school. No settings row — null, false, a missing
 * field, or a blank month — is Tishrei, the first month of the campaign
 * year. A saved month stays. HQ sets it. A school admin sets it only after
 * HQ turns allow_school_pick on for that school.
 *
 * @param array<string,mixed>|string|null|false $row
 */
function wwtcFirstMonthFromRow($row): string
{
    if ($row === null || $row === false || $row === '') {
        return WWTC_DEFAULT_FIRST_MONTH;
    }
    if (is_array($row)) {
        if (array_key_exists('first_month', $row)) {
            $stored = $row['first_month'];
        } elseif (array_key_exists('firstMonth', $row)) {
            $stored = $row['firstMonth'];
        } elseif (array_key_exists('yearStart', $row)) {
            $stored = $row['yearStart'];
        } else {
            $stored = null;
        }
        if ($stored === null || $stored === '') {
            return WWTC_DEFAULT_FIRST_MONTH;
        }
        return wwtcNormalizeFirstMonth((string) $stored);
    }
    return wwtcNormalizeFirstMonth((string) $row);
}

function wwtcIsDefaultSchoolYear(string $month): bool
{
    return wwtcNormalizeFirstMonth($month) === WWTC_DEFAULT_FIRST_MONTH;
}

/**
 * Whether HQ has let this school pick its own start month.
 * A missing column, a missing key, 0, false, or anything other than an
 * explicit on value is off.
 *
 * @param array<string,mixed>|null|false $row
 */
function wwtcAllowSchoolPickFromRow($row): bool
{
    if (!is_array($row)) {
        return false;
    }
    if (array_key_exists('allow_school_pick', $row)) {
        $raw = $row['allow_school_pick'];
    } elseif (array_key_exists('allowSchoolPick', $row)) {
        $raw = $row['allowSchoolPick'];
    } else {
        return false;
    }
    return $raw === true || $raw === 1 || $raw === '1' || $raw === 'true';
}

/**
 * Who may write the start month. HQ (auth super, or the demo kind super)
 * always may. A school admin may only when HQ has turned the switch on.
 * Anyone who is not an admin may not.
 *
 * @param array<string,mixed>|null $actor
 */
function wwtcActorMaySetSchoolYear($actor, bool $allowSchoolPick): bool
{
    if (!is_array($actor)) {
        return false;
    }
    $type = (string) ($actor['type'] ?? '');
    if ($type !== '' && $type !== 'admin') {
        return false;
    }
    $auth = (string) ($actor['auth'] ?? '');
    $kind = (string) ($actor['kind'] ?? '');
    if ($auth === 'super' || $kind === 'super') {
        return true;
    }
    if ($type !== 'admin' && $kind !== 'school') {
        return false;
    }
    return $allowSchoolPick;
}

/** Adar I and Adar II occupy Adar's one slot. */
function wwtcPlainMonthName(string $month): string
{
    if ($month === 'Adar I' || $month === 'Adar II') {
        return 'Adar';
    }
    return $month;
}

/** @return list<string> */
function wwtcRotatedPlainMonths(string $firstMonth): array
{
    $plain = wwtcPlainMonthNames();
    $start = array_search(wwtcNormalizeFirstMonth($firstMonth), $plain, true);
    if ($start === false || $start === 0) {
        return $plain;
    }
    return array_merge(array_slice($plain, (int) $start), array_slice($plain, 0, (int) $start));
}

/**
 * Quota-sheet month for a calendar month. Position k reads the cell position
 * k uses when the year starts in Tishrei.
 */
function wwtcQuotaSheetMonth(string $calendarMonth, string $firstMonth): string
{
    $plain = wwtcPlainMonthName($calendarMonth);
    $names = wwtcPlainMonthNames();
    $index = array_search($plain, wwtcRotatedPlainMonths($firstMonth), true);
    if ($index === false) {
        return $calendarMonth;
    }
    return $names[(int) $index];
}

function wwtcGradeEndMonth(string $firstMonth): string
{
    $months = wwtcRotatedPlainMonths($firstMonth);
    return (string) $months[count($months) - 1];
}

function wwtcSchoolYearStartYear(string $firstMonth, int $hebrewYear, string $hebrewMonth): int
{
    $plain = wwtcPlainMonthNames();
    $startIdx = array_search(wwtcNormalizeFirstMonth($firstMonth), $plain, true);
    $monthIdx = array_search(wwtcPlainMonthName($hebrewMonth), $plain, true);
    if ($startIdx === false || $monthIdx === false) {
        return $hebrewYear;
    }
    return $monthIdx >= $startIdx ? $hebrewYear : $hebrewYear - 1;
}

/**
 * One school year in order. Each slot: month, year, sheetMonth, position.
 * Adar I and Adar II share position and sheetMonth.
 *
 * @return list<array{month:string,year:int,sheetMonth:string,position:int}>
 */
function wwtcSchoolYearSlots(string $firstMonth, int $startYear): array
{
    $names = wwtcPlainMonthNames();
    $plain = wwtcRotatedPlainMonths($firstMonth);
    $year = $startYear;
    $slots = [];
    foreach ($plain as $index => $month) {
        if ($month === 'Tishrei' && $index > 0) {
            $year++;
        }
        $sheet = $names[$index];
        $position = $index + 1;
        if ($month === 'Adar' && wwtcIsHebrewLeapYear($year)) {
            $slots[] = ['month' => 'Adar I', 'year' => $year, 'sheetMonth' => $sheet, 'position' => $position];
            $slots[] = ['month' => 'Adar II', 'year' => $year, 'sheetMonth' => $sheet, 'position' => $position];
            continue;
        }
        $slots[] = ['month' => $month, 'year' => $year, 'sheetMonth' => $sheet, 'position' => $position];
    }
    return $slots;
}
