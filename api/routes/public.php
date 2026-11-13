<?php

declare(strict_types=1);

/**
 * Public campaign reads: calendar, stats, running totals, schools, boards.
 * Loaded by index.php with $method / $path set.
 */

// ---- campaign calendar -----------------------------------------------------

if ($method === 'GET' && $path === '/campaign') {
    $span = 4;
    $years = [];
    for ($i = 0; $i < $span; $i++) {
        $years[] = wwtcYear() - $i;
    }
    $asked = isset($_GET['year']) && $_GET['year'] !== '' ? (int) $_GET['year'] : wwtcYear();
    if ($asked !== wwtcYear()) {
        $dates = wwtcMonthDatesForYear($asked);
        wwtcJson([
            'year' => $asked,
            'currentMonth' => null,
            'months' => array_keys($dates),
            'monthDates' => $dates,
            'years' => $years,
            'holidayMonths' => array_keys(wwtcHolidayDates($asked)),
        ]);
    }
    $current = wwtcCurrentDate();
    $elapsed = wwtcElapsedMonths();
    wwtcJson([
        'year' => wwtcYear(),
        'currentMonth' => wwtcMonthForDate($current),
        'currentMonthIndex' => max(0, count($elapsed) - 1),
        'months' => array_column($elapsed, 'month'),
        'monthDates' => wwtcMonthDates(),
        'years' => $years,
        'holidayMonths' => array_keys(wwtcHolidayDates(wwtcYear())),
    ]);
}

// ---- nationwide stats ------------------------------------------------------

if ($method === 'GET' && $path === '/stats') {
    $year = wwtcYear();
    $period = null;
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            $a = $board['army'];
            wwtcJson([
                'monthLabel' => $period['month'],
                'year' => (int) $period['year'],
                'holiday' => true,
                'accomplished' => $a['accomplished'],
                'quota' => $a['quota'],
                'pct' => wwtcPct($a['accomplished'], $a['quota']),
                'minutes' => $a['minutes'],
                'minutesQuota' => $a['minutesQuota'],
                'minutesPct' => wwtcPct($a['minutes'], $a['minutesQuota']),
                'soldiers' => $a['soldiers'],
                'metSoldiers' => $a['metSoldiers'],
                'participatedSoldiers' => $a['participatedSoldiers'],
                'pctSoldiersParticipated' => $a['soldiers'] > 0 ? (int) round($a['participatedSoldiers'] / $a['soldiers'] * 100) : 0,
                'pctSoldiersMet' => $a['soldiers'] > 0 ? (int) round($a['metSoldiers'] / $a['soldiers'] * 100) : 0,
                'schools' => $a['schools'],
                'classes' => $a['classes'],
                'perfectPlatoons' => $a['perfectPlatoons'],
            ]);
        }
        $current = (int) $period['jd'];
        $year = (int) $period['year'];
    } else {
        $current = wwtcCurrentDate();
    }
    $agg = wwtcArmyAggregates($current, $year);
    $quota = (int) ($agg['army']['Kapitelach'][$current] ?? 0);
    $done = (int) ($agg['armyDone']['Kapitelach'][$current] ?? 0);

    // Minutes: the army result covers Kapitelach only, so the Minutes totals come
    // from the per-school figures (setASR) — the same the summary's Minutes chart uses.
    $minutesQuota = (int) array_sum($agg['minGoal']);
    $minutes = (int) array_sum($agg['minDone']);

    // Counts, with the same roster filters the army query uses.
    $soldiers = (int) $MASHPIA_DB->query(
        'SELECT COUNT(DISTINCT u.user_id)
           FROM users u
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s USING (school_id)
           JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
          WHERE u.user_registered > 0 AND ' . WWTC_ROSTER_WHERE
    )->fetchColumn();
    $schools = count($agg['schools']); // setASR()'s school roster
    $classes = (int) $MASHPIA_DB->query(
        'SELECT COUNT(DISTINCT c.class_id)
           FROM classes c
           JOIN users u ON u.class_id = c.class_id AND u.school_id = c.school_id AND u.user_registered > 0
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s ON s.school_id = c.school_id
          WHERE ' . WWTC_ROSTER_WHERE
    )->fetchColumn();

    // Soldiers who completed stay on the mission-mark signal (the home race),
    // with quota overrides folded in. The perfect-platoon count is the shared
    // kapitlach list, so the stat and the Perfect Platoons section cannot disagree.
    $counts = wwtcCompletionCounts($current, $year);
    $metSoldiers = (int) array_sum($counts['metBySchool']);
    $participatedSoldiers = (int) array_sum(wwtcParticipatedBySchool($current));
    $perfectPlatoons = count(wwtcPerfectPlatoonRows($current, $year));

    wwtcJson([
        'monthLabel' => wwtcMonthForDate($current) ?: (is_array($period) ? (string) $period['month'] : ''),
        'year' => $year,
        'accomplished' => $done,
        'quota' => $quota,
        'pct' => wwtcPct($done, $quota),
        'minutes' => $minutes,
        'minutesQuota' => $minutesQuota,
        'minutesPct' => wwtcPct($minutes, $minutesQuota),
        'soldiers' => $soldiers,
        'metSoldiers' => $metSoldiers,
        'participatedSoldiers' => $participatedSoldiers,
        'pctSoldiersParticipated' => $soldiers > 0 ? (int) round($participatedSoldiers / $soldiers * 100) : 0,
        'pctSoldiersMet' => $soldiers > 0 ? (int) round($metSoldiers / $soldiers * 100) : 0,
        'schools' => $schools,
        'classes' => $classes,
        'perfectPlatoons' => $perfectPlatoons,
    ]);
}

// ---- running totals (home headline) ----------------------------------------
// This month / this year: live army done across elapsed SM months (setUseLiveData).
// All-time: sealed kapitlach from tehillim_backups for every prior SM date, plus
// this year's live total (so post-backup marks still count), plus optional
// WWTC_ALLTIME_BASE for any pre-backup history HQ wants to include.
if ($method === 'GET' && $path === '/running-totals') {
    $current = wwtcCurrentDate();
    wwtcJson(wwtcCached("running_totals.$current", static function () use ($current) {
    global $MASHPIA_DB;
    $thisMonth = 0;
    $thisYear = 0;
    $elapsedJds = [];
    foreach (wwtcElapsedMonths() as $mo) {
        $jd = (int) $mo['jd'];
        $elapsedJds[] = $jd;
        // Same cached army pass as /running-totals/breakdown and /stats. armyDone
        // is not touched by the override adjusters, so this is the figure the
        // direct report produced, and the warm-cache cron keeps it hot.
        $v = (int) (wwtcArmyAggregates($jd)['armyDone']['Kapitelach'][$jd] ?? 0);
        $thisYear += $v;
        if ($jd === $current) {
            $thisMonth = $v;
        }
    }

    // Prior years (and any sealed months outside this year's elapsed set).
    $priorSql = 'SELECT IFNULL(SUM(done_qty), 0) FROM tehillim_backups
                  WHERE grid_id = ' . WWTC_GRID_KAPITELACH;
    if ($elapsedJds) {
        $in = implode(',', array_map('intval', $elapsedJds));
        $priorSql .= " AND sm_date NOT IN ($in)";
    }
    $priorYears = (int) $MASHPIA_DB->query($priorSql)->fetchColumn();
    $base = (int) (wwtcEnv('WWTC_ALLTIME_BASE') ?: 0);
    $allTime = $priorYears + $thisYear + $base;

    return [
        'thisMonth' => $thisMonth,
        'thisYear' => $thisYear,
        'allTime' => $allTime,
    ];
    }));
}

// One row per Jewish year (all-time) and one row per elapsed month (this year).
// Kapitlach and minutes. Cheshvan 5778 is the first Shabbos Mevorchim. A leap
// year keeps Adar I and Adar II as two rows. Same month sources as /running-totals.
if ($method === 'GET' && $path === '/running-totals/breakdown') {
    $current = wwtcCurrentDate();
    wwtcJson(wwtcCached('running_breakdown.' . wwtcYear() . '.' . $current, static function () {
        return wwtcRunningBreakdown();
    }));
}

// ---- nationwide school list ------------------------------------------------

if ($method === 'GET' && $path === '/schools') {
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'holiday' => true, 'schools' => wwtcHolidaySchools($board)]);
        }
        $rows = wwtcNationwideSchools((int) $period['jd'], (int) $period['year']);
        wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'schools' => $rows]);
    }
    $current = wwtcCurrentDate();
    // Same Race order as Home (pctMet-first) and /me/social schoolRank.
    $rows = wwtcNationwideSchools($current);
    wwtcJson(['month' => wwtcMonthForDate($current), 'schools' => $rows]);
}

// ---- one school -------------------------------------------------------------

if ($method === 'GET' && preg_match('#^/schools/(\d+)$#', $path, $m)) {
    $id = (int) $m[1];
    $names = wwtcEligibleSchools();
    if (!isset($names[$id])) {
        wwtcError('School not found.', 404);
    }
    // Header totals from the same source as the /schools list (so they match);
    // the class breakdown from the per-student report. Honors ?year=&month=
    // so Home's month chip and this page stay on the same Shabbos Mevorchim.
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        $current = (int) $period['jd'];
        $year = (int) $period['year'];
        $monthName = (string) $period['month'];
        if (!empty($period['holiday'])) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], $year, $monthName);
            $hol = wwtcHolidaySchools($board);
            $row = null;
            foreach ($hol as $s) {
                if ((int) $s['id'] === $id) {
                    $row = $s;
                    break;
                }
            }
            if (!$row) {
                wwtcError('School not found.', 404);
            }
            $data = wwtcHolidaySchoolData($board, $id);
            $dedication = wwtcDedicationRead('school', $year, $monthName, $id);
            wwtcJson($row + [
                'classes' => array_map('wwtcPresentClassLabel', $data['classes'] ?? []),
                'dedication' => $dedication,
                'yearStart' => function_exists('wwtcSchoolFirstMonth') ? wwtcSchoolFirstMonth($id) : 'Tishrei',
                'allowSchoolPick' => function_exists('wwtcSchoolAllowsOwnStart') ? wwtcSchoolAllowsOwnStart($id) : false,
                'hiddenLadders' => function_exists('wwtcHiddenLaddersForSchool') ? wwtcHiddenLaddersForSchool($id) : [],
                'month' => $monthName,
                'year' => $year,
                'holiday' => true,
            ]);
        }
    } else {
        $current = wwtcCurrentDate();
        $year = wwtcYear();
        $monthName = wwtcMonthForDate($current, $year);
    }
    $agg = wwtcArmyAggregates($current, $year);
    $row = wwtcSchoolRow(
        $id,
        (string) $names[$id],
        $agg['kapGoal'],
        $agg['kapDone'],
        $agg['minGoal'],
        $agg['minDone'],
        wwtcCompletionCounts($current, $year),
        (int) (wwtcParticipatedBySchool($current)[$id] ?? 0)
    );
    $data = wwtcSchoolData($id, $current, $year);
    // This month's school dedication (set by HQ or that school's admin via
    // PUT /dedication). Returns null when nothing is set or the table is not
    // installed, so the campaign page simply shows no dedication line.
    $dedication = wwtcDedicationRead('school', $year, $monthName, $id);
    wwtcJson($row + [
        'classes' => array_map('wwtcPresentClassLabel', $data['classes']),
        'dedication' => $dedication,
        'yearStart' => function_exists('wwtcSchoolFirstMonth') ? wwtcSchoolFirstMonth($id) : 'Tishrei',
        'allowSchoolPick' => function_exists('wwtcSchoolAllowsOwnStart') ? wwtcSchoolAllowsOwnStart($id) : false,
        'hiddenLadders' => function_exists('wwtcHiddenLaddersForSchool') ? wwtcHiddenLaddersForSchool($id) : [],
        'month' => $monthName,
        'year' => $year,
    ]);
}

if ($method === 'GET' && preg_match('#^/schools/(\d+)/class-leaderboard$#', $path, $m)) {
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    $classes = wwtcSchoolData($id)['classes'];
    usort($classes, static function ($a, $b) {
        return $b['pct'] <=> $a['pct'] ?: $b['said'] <=> $a['said'];
    });
    wwtcJson(['schoolId' => $id, 'classes' => array_map('wwtcPresentClassLabel', $classes)]);
}

if ($method === 'GET' && preg_match('#^/schools/(\d+)/leaderboard$#', $path, $m)) {
    // Public: the SPA shows a school's Top Soldiers with full names (signed off).
    $id = (int) $m[1];
    if (!isset(wwtcEligibleSchools()[$id])) {
        wwtcError('School not found.', 404);
    }
    // The board pages ten at a time and ranks ties across the whole school.
    // A SQL LIMIT of 10 kept an arbitrary slice of a tie (everyone on 150
    // looked like places 1–10). ?n= still slices, but only after the name sort.
    $cap = 2000;
    $limit = $cap;
    if (isset($_GET['n']) && $_GET['n'] !== '') {
        $limit = max(1, min($cap, (int) $_GET['n']));
    }
    $date = wwtcCurrentDate();
    // This month only. A year total made a chayol look like they said hundreds
    // of kapitlach in the month on the board.
    $stmt = $MASHPIA_DB->prepare(
        'SELECT u.user_id, u.first, u.last, c.class_grade, MAX(dtm.done_qty) said
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
           JOIN users u ON u.user_id = dtm.user_id
           JOIN classes c ON c.class_id = u.class_id
          WHERE u.school_id = :id AND dt.grid_id = ' . WWTC_GRID_KAPITELACH . '
            AND dtmm.subject_id = ' . WWTC_SUBJECT_ID . ' AND dtmm.start_date = :d
          GROUP BY u.user_id
          ORDER BY said DESC, u.last ASC, u.first ASC, u.user_id ASC
          LIMIT ' . $cap
    );
    $stmt->execute([':id' => $id, ':d' => $date]);
    $rows = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $rows[] = [
            'id' => (int) $r['user_id'],
            'name' => trim($r['first'] . ' ' . $r['last']),
            'grade' => (string) $r['class_grade'],
            'saidMonth' => (int) $r['said'],
        ];
    }
    wwtcJson(['schoolId' => $id, 'soldiers' => wwtcOrderSoldiers($rows, $limit)]);
}

// ---- perfect platoons (nationwide) -----------------------------------------

if ($method === 'GET' && $path === '/perfect-platoons') {
    // Same rule as the school classes view (wwtcClassIsPerfect): every soldier
    // said at least their own kapitlach quota. One row per class id. The number
    // after the slash on the home card is schoolClasses — classes on this
    // roster, not a rank and not a page size.
    if (wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if ($period['holiday']) {
            $board = wwtcHolidayBoard($period['jds'], (int) $period['quotaJd'], (int) $period['year'], (string) $period['month']);
            wwtcJson(['month' => $period['month'], 'year' => $period['year'], 'holiday' => true, 'platoons' => array_map('wwtcPresentClassLabel', wwtcHolidayPlatoons($board))]);
        }
        $current = (int) $period['jd'];
        $platoonYear = (int) $period['year'];
    } else {
        $current = wwtcCurrentDate();
        $platoonYear = wwtcYear();
    }
    wwtcJson(['month' => wwtcMonthForDate($current, $platoonYear), 'year' => $platoonYear, 'platoons' => array_map('wwtcPresentClassLabel', wwtcPerfectPlatoonRows($current, $platoonYear))]);
}
