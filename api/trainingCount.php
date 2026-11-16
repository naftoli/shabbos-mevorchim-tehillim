<?php

declare(strict_types=1);

/**
 * Ladder cheshbon for My Tehillim Training.
 *
 * Earned is the Done boxes on the grade sections. Total is every box those
 * sections show. A leap year has 13 (Adar I and Adar II). A plain year has
 * one Adar. A stored "Adar" on a leap year fills Adar II only, so one mark
 * is not two. Marks for a grade the ladder does not show are left out.
 * The current grade reads the live month list; a history row for that same
 * grade is not added on top.
 *
 * Same rules as buildTraining / trainingCheshbon in src/lib/trainingBoard.js.
 */

require_once __DIR__ . '/schoolYear.php';

function wwtcTrainingGradeNum(string $grade): int
{
    $g = strtolower(trim($grade));
    if ($g === '' || strpos($g, 'pre') === 0) {
        return 0;
    }
    return (int) $g;
}

function wwtcTrainingGradeIndex(string $grade): int
{
    $g = strtolower(trim($grade));
    if ($g === '') {
        return -1;
    }
    if (strpos($g, 'pre') === 0) {
        return 0;
    }
    $digits = preg_replace('/[^0-9]/', '', $g);
    if ($digits === null || $digits === '') {
        return -1;
    }
    return (int) $digits;
}

/** @return list<string> */
function wwtcTrainingGrades(string $grade, $ladder, string $finishGrade): array
{
    $order = ['pre1a', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    if ($finishGrade !== '') {
        $cap = max(wwtcTrainingGradeIndex($finishGrade), wwtcTrainingGradeIndex($grade), 0);
        $out = ['pre1a'];
        for ($n = 1; $n <= $cap; $n++) {
            $out[] = (string) $n;
        }
        return $out;
    }
    $cap = max((int) $ladder, wwtcTrainingGradeNum($grade));
    if ($cap === 0) {
        return $order;
    }
    $out = [];
    foreach ($order as $g) {
        if (wwtcTrainingGradeNum($g) <= $cap) {
            $out[] = $g;
        }
    }
    return $out;
}

/**
 * @param array<string,mixed> $past
 * @return mixed|null
 */
function wwtcTrainingHistoryValue(array $past, string $key)
{
    if (array_key_exists($key, $past) && $past[$key] !== null) {
        return $past[$key];
    }
    $adarIMissing = !array_key_exists('Adar I', $past) || $past['Adar I'] === null;
    $hasAdar = array_key_exists('Adar', $past) && $past['Adar'] !== null;
    if ($key === 'Adar II' && $adarIMissing && $hasAdar) {
        return $past['Adar'];
    }
    return null;
}

/** @param mixed $value */
function wwtcTrainingHistoryMet($value): bool
{
    return $value !== null && $value !== false;
}

/**
 * @param array<string,array<string,mixed>> $byMonth
 * @return array<string,mixed>|null
 */
function wwtcTrainingMonthRecord(array $byMonth, string $key): ?array
{
    if (isset($byMonth[$key]) && is_array($byMonth[$key])) {
        return $byMonth[$key];
    }
    $hasAdar = isset($byMonth['Adar']) && is_array($byMonth['Adar']);
    $hasAdarI = isset($byMonth['Adar I']) && is_array($byMonth['Adar I']);
    if ($key === 'Adar II' && $hasAdar && !$hasAdarI) {
        return $byMonth['Adar'];
    }
    return null;
}

/** @param array<string,array<string,mixed>> $byMonth */
function wwtcTrainingMonthMet(array $byMonth, string $key): bool
{
    $rec = wwtcTrainingMonthRecord($byMonth, $key);
    if ($rec === null) {
        return false;
    }
    $reported = !array_key_exists('reported', $rec) || $rec['reported'] !== false;
    return $reported && !empty($rec['met']);
}

/**
 * @param array<string,bool> $activeHolidays
 * @return list<string>
 */
function wwtcTrainingOccasions(?int $year, array $activeHolidays, string $first): array
{
    $y = $year === null ? 5785 : $year;
    if ($first === WWTC_DEFAULT_FIRST_MONTH) {
        $keys = wwtcCampaignMonthNames($y);
    } else {
        $keys = [];
        foreach (wwtcSchoolYearSlots($first, $y) as $slot) {
            $keys[] = (string) $slot['month'];
        }
    }
    $out = [];
    foreach ($keys as $key) {
        $out[] = $key;
        if ($key !== 'Tishrei') {
            continue;
        }
        foreach (['Rosh Hashana', 'Yom Kippur'] as $holiday) {
            if (!empty($activeHolidays[$holiday])) {
                $out[] = $holiday;
            }
        }
    }
    return $out;
}

/**
 * @param array<string,array<string,mixed>> $history
 * @param array<int,array<string,mixed>> $months
 * @return array{earned:int,total:int,sections:list<array{grade:string,done:int,total:int}>}
 */
function wwtcCountTrainingLadder(
    string $grade,
    $ladder,
    ?int $year,
    array $history,
    array $months,
    string $firstMonth = 'Tishrei',
    string $anchorMonth = '',
    string $finishGrade = ''
): array {
    $first = wwtcNormalizeFirstMonth($firstMonth);
    $anchor = $anchorMonth !== '' ? $anchorMonth : 'Tishrei';
    $currentStart = null;
    if ($year !== null) {
        $currentStart = $first === WWTC_DEFAULT_FIRST_MONTH
            ? $year
            : wwtcSchoolYearStartYear($first, $year, $anchor);
    }
    $byMonth = [];
    foreach ($months as $month) {
        if (!is_array($month) || empty($month['month'])) {
            continue;
        }
        $byMonth[(string) $month['month']] = $month;
    }
    $active = [];
    foreach ($months as $month) {
        if (is_array($month) && !empty($month['holiday']) && !empty($month['month'])) {
            $active[(string) $month['month']] = true;
        }
    }
    $currentNum = wwtcTrainingGradeNum($grade);
    $sections = [];
    $earned = 0;
    $total = 0;
    foreach (wwtcTrainingGrades($grade, $ladder, $finishGrade) as $g) {
        $isCurrent = (string) $g === (string) $grade;
        $past = [];
        if (isset($history[$g]) && is_array($history[$g])) {
            $past = $history[$g];
        }
        $gradeYear = $currentStart === null
            ? null
            : $currentStart - ($currentNum - wwtcTrainingGradeNum($g));
        $done = 0;
        $occasions = wwtcTrainingOccasions($gradeYear, $active, $first);
        foreach ($occasions as $key) {
            $met = $isCurrent
                ? wwtcTrainingMonthMet($byMonth, $key)
                : wwtcTrainingHistoryMet(wwtcTrainingHistoryValue($past, $key));
            if ($met) {
                $done++;
            }
        }
        $sectionTotal = count($occasions);
        $sections[] = ['grade' => $g, 'done' => $done, 'total' => $sectionTotal];
        $earned += $done;
        $total += $sectionTotal;
    }
    return [
        'earned' => min($earned, $total),
        'total' => $total,
        'sections' => $sections,
    ];
}
