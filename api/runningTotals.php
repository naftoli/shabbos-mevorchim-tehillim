<?php

declare(strict_types=1);

require_once __DIR__ . '/hebrewYear.php';

/**
 * Home running-totals breakdown.
 *
 * The campaign's first Shabbos Mevorchim is Cheshvan 5778 (14 October 2017).
 * A leap year lists Adar I and Adar II. A plain year has one Adar.
 * This file only names the months and folds totals that the caller already
 * has. It does not query the database.
 */

const WWTC_FIRST_CAMPAIGN_YEAR = 5778;
const WWTC_FIRST_CAMPAIGN_MONTH = 'Cheshvan';

/** @return list<string> */
function wwtcBreakdownMonthNames(int $year): array
{
    if ($year < WWTC_FIRST_CAMPAIGN_YEAR) {
        return [];
    }
    $months = wwtcCampaignMonthNames($year);
    if ($year !== WWTC_FIRST_CAMPAIGN_YEAR) {
        return $months;
    }
    $start = array_search(WWTC_FIRST_CAMPAIGN_MONTH, $months, true);
    if ($start === false) {
        return $months;
    }
    return array_values(array_slice($months, $start));
}

/**
 * Fold already-loaded month totals into one row per Jewish year and one row
 * per elapsed month of the current year.
 *
 * $datesByYear is year => [month => julian day].
 * $liveByJd is the current year's elapsed months (julian day => kapitlach/minutes).
 * $sealedByJd is every other Shabbos Mevorchim from the backups.
 * $baseKapitlach / $baseMinutes is pre-backup history (WWTC_ALLTIME_BASE). It is
 * kept on 5778 so the year rows still add up to the headline.
 *
 * A sealed date that falls in the current year is ignored: this year comes
 * only from $liveByJd. A sealed date that does not match a campaign month is
 * kept on 5778.
 *
 * @param array<int,array<string,int>> $datesByYear
 * @param array<int,array{kapitlach?:int,minutes?:int}> $liveByJd
 * @param array<int,array{kapitlach?:int,minutes?:int}> $sealedByJd
 * @return array{firstYear:int,firstMonth:string,year:int,years:list<array<string,int>>,months:list<array<string,int|string>>}
 */
function wwtcFoldRunningBreakdown(
    int $currentYear,
    array $datesByYear,
    array $liveByJd,
    array $sealedByJd,
    int $baseKapitlach = 0,
    int $baseMinutes = 0
): array {
    $firstYear = WWTC_FIRST_CAMPAIGN_YEAR;
    $years = [];
    $end = max($currentYear, $firstYear);
    for ($y = $firstYear; $y <= $end; $y++) {
        $years[$y] = ['year' => $y, 'kapitlach' => 0, 'minutes' => 0];
    }

    $place = [];
    for ($y = $firstYear; $y <= $end; $y++) {
        $allowed = array_flip(wwtcBreakdownMonthNames($y));
        foreach ($datesByYear[$y] ?? [] as $month => $jd) {
            $month = (string) $month;
            if (!isset($allowed[$month])) {
                continue;
            }
            $place[(int) $jd] = ['year' => $y, 'month' => $month];
        }
    }

    $months = [];
    if (isset($years[$currentYear])) {
        foreach (wwtcBreakdownMonthNames($currentYear) as $month) {
            $jd = (int) ($datesByYear[$currentYear][$month] ?? 0);
            if ($jd <= 0 || !isset($liveByJd[$jd])) {
                continue;
            }
            $kap = (int) ($liveByJd[$jd]['kapitlach'] ?? 0);
            $min = (int) ($liveByJd[$jd]['minutes'] ?? 0);
            $months[] = [
                'year' => $currentYear,
                'month' => $month,
                'kapitlach' => $kap,
                'minutes' => $min,
            ];
            $years[$currentYear]['kapitlach'] += $kap;
            $years[$currentYear]['minutes'] += $min;
        }
    }

    foreach ($sealedByJd as $jd => $row) {
        $jd = (int) $jd;
        if (isset($liveByJd[$jd])) {
            continue;
        }
        $kap = (int) ($row['kapitlach'] ?? 0);
        $min = (int) ($row['minutes'] ?? 0);
        $mapped = $place[$jd] ?? null;
        $year = $mapped['year'] ?? null;
        if ($year === $currentYear) {
            continue;
        }
        if ($year !== null && isset($years[$year]) && $year < $currentYear) {
            $years[$year]['kapitlach'] += $kap;
            $years[$year]['minutes'] += $min;
            continue;
        }
        $years[$firstYear]['kapitlach'] += $kap;
        $years[$firstYear]['minutes'] += $min;
    }

    $years[$firstYear]['kapitlach'] += $baseKapitlach;
    $years[$firstYear]['minutes'] += $baseMinutes;

    return [
        'firstYear' => $firstYear,
        'firstMonth' => WWTC_FIRST_CAMPAIGN_MONTH,
        'year' => $currentYear,
        'years' => array_values($years),
        'months' => $months,
    ];
}

/**
 * Live kapitlach and minutes for each elapsed Shabbos Mevorchim this year,
 * keyed by julian day. Kapitlach use the same army-done figure as
 * /running-totals. Minutes are the per-school minutes total for that date.
 *
 * @return array<int,array{kapitlach:int,minutes:int}>
 */
function wwtcLiveElapsedTotals(): array
{
    $out = [];
    if (!function_exists('wwtcElapsedMonths') || !function_exists('wwtcReport')) {
        return $out;
    }
    foreach (wwtcElapsedMonths() as $mo) {
        $jd = (int) $mo['jd'];
        if (function_exists('wwtcArmyAggregates')) {
            // Take both figures from the cached army pass (army_aggregates.*),
            // which /stats, /schools and /reports already warm. This used to
            // also run wwtcReport()->setArmyResults() directly for kapitlach — a
            // second, uncached ~60s army pass per elapsed month, which is why a
            // cold /running-totals/breakdown ran past Cloudflare's 100s limit
            // and returned 524. armyDone is never touched by the override
            // adjusters, so the kapitlach here is the same figure /running-totals
            // shows.
            $agg = wwtcArmyAggregates($jd);
            $kap = (int) ($agg['armyDone']['Kapitelach'][$jd] ?? 0);
            $minutes = (int) array_sum($agg['minDone'] ?? []);
        } else {
            $report = wwtcReport($jd);
            $report->setArmyResults();
            $kap = (int) ($report->getArmyDoneResults()['Kapitelach'][$jd] ?? 0);
            $minutes = 0;
        }
        $out[$jd] = ['kapitlach' => $kap, 'minutes' => $minutes];
    }
    return $out;
}

/**
 * Sealed kapitlach and minutes from tehillim_backups, keyed by sm_date.
 * Minutes use the minutes grid when the backup has it.
 *
 * @return array<int,array{kapitlach:int,minutes:int}>
 */
function wwtcSealedTotalsByDate(): array
{
    global $MASHPIA_DB;
    $out = [];
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return $out;
    }
    if (!defined('WWTC_GRID_KAPITELACH') || !defined('WWTC_GRID_MINUTES')) {
        return $out;
    }
    $kap = (int) WWTC_GRID_KAPITELACH;
    $min = (int) WWTC_GRID_MINUTES;
    $rows = $MASHPIA_DB->query(
        'SELECT sm_date, grid_id, IFNULL(SUM(done_qty), 0) qty
           FROM tehillim_backups
          WHERE grid_id IN (' . $kap . ', ' . $min . ')
          GROUP BY sm_date, grid_id'
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $row) {
        $jd = (int) $row['sm_date'];
        if (!isset($out[$jd])) {
            $out[$jd] = ['kapitlach' => 0, 'minutes' => 0];
        }
        if ((int) $row['grid_id'] === $min) {
            $out[$jd]['minutes'] = (int) $row['qty'];
        } else {
            $out[$jd]['kapitlach'] = (int) $row['qty'];
        }
    }
    return $out;
}

/**
 * Year => month => julian day, from the first campaign year through $currentYear.
 *
 * @return array<int,array<string,int>>
 */
function wwtcBreakdownDates(int $currentYear): array
{
    $out = [];
    if (!function_exists('wwtcMonthDatesForYear')) {
        return $out;
    }
    $end = max($currentYear, WWTC_FIRST_CAMPAIGN_YEAR);
    for ($y = WWTC_FIRST_CAMPAIGN_YEAR; $y <= $end; $y++) {
        $dates = [];
        foreach (wwtcMonthDatesForYear($y) as $month => $jd) {
            $dates[(string) $month] = (int) $jd;
        }
        $out[$y] = $dates;
    }
    return $out;
}

/** The /running-totals/breakdown body. */
function wwtcRunningBreakdown(): array
{
    $year = function_exists('wwtcYear') ? wwtcYear() : WWTC_FIRST_CAMPAIGN_YEAR;
    $baseKap = function_exists('wwtcEnv') ? (int) (wwtcEnv('WWTC_ALLTIME_BASE') ?: 0) : 0;
    return wwtcFoldRunningBreakdown(
        $year,
        wwtcBreakdownDates($year),
        wwtcLiveElapsedTotals(),
        wwtcSealedTotalsByDate(),
        $baseKap,
        0
    );
}
