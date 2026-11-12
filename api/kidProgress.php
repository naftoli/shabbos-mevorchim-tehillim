<?php

declare(strict_types=1);

/**
 * Signed-in soldier progress: elapsed months, lifetime missions, and the
 * GET /me/progress payload. Loaded by the API router.
 */

/**
 * A soldier's elapsed-month progress (quota/said/minutes per month, met), by
 * direct per-month queries mirroring ShabbosMevorchim::setStudentResults(): the
 * quota is the soldier's own date_tasks row for their track/level, the done is
 * MAX(done_qty) from live date_tasks_marks (no tehillim_backups — same as
 * setUseLiveData on the report class).
 */
function wwtcKidMonths(array $kid): array
{
    global $MASHPIA_DB;
    $kapitel = WWTC_GRID_KAPITELACH;
    $minutes = WWTC_GRID_MINUTES;

    $quotaStmt = $MASHPIA_DB->prepare(
        'SELECT dt.quantity FROM date_tasks dt
          WHERE dt.grid_id = :grid AND dt.date_tasks_mission_id IN (
                SELECT date_tasks_mission_id FROM date_tasks_missions
                 WHERE subject_id = ' . WWTC_SUBJECT_ID . '
                   AND start_date = :d AND end_date = :d AND school_type_id = :st
                   AND track_id = :track AND level = :lvl AND lang_id = :lang)
          LIMIT 1'
    );
    $doneStmt = $MASHPIA_DB->prepare(
        'SELECT MAX(dtm.done_qty) FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
          WHERE dtm.user_id = :uid AND dtmm.start_date = :d AND dtmm.end_date = :d
            AND dt.grid_id = :grid AND dtmm.subject_id = ' . WWTC_SUBJECT_ID
    );

    // Quota for grid $grid on Shabbos-Mevorchim $d, priced on the ladder the soldier
    // was on THEN (wwtcTrackAsOf), not their current ladder — so an earlier month
    // doesn't move when they change ladders. Level stays live.
    $qFor = function (int $grid, int $d) use ($quotaStmt, $kid): int {
        $track = wwtcTrackAsOf((int) $kid['user_id'], $d, (int) $kid['track_id']);
        $quotaStmt->execute([
            ':grid' => $grid, ':d' => $d, ':st' => (int) $kid['school_type_id'],
            ':track' => $track, ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
        ]);
        return (int) ($quotaStmt->fetchColumn() ?: 0);
    };
    $dFor = function (int $grid, int $d) use ($doneStmt, $kid): array {
        $doneStmt->execute([':uid' => (int) $kid['user_id'], ':d' => $d, ':grid' => $grid]);
        $raw = $doneStmt->fetchColumn();
        $reported = $raw !== null && $raw !== false;
        return [$reported ? (int) $raw : 0, $reported];
    };

    $current = wwtcCurrentDate();
    // Whether the current month is still open to the soldier's own report (closes
    // a week after Shabbos Mevorchim). Only the current month can be self-reported,
    // so a past month is never open.
    $reportOpen = wwtcReportWindowOpen();
    $firstMonth = function_exists('wwtcSchoolFirstMonth')
        ? wwtcSchoolFirstMonth((int) ($kid['school_id'] ?? 0))
        : 'Tishrei';
    // Tishrei schools keep today's elapsed Hebrew-year months, quota dated on
    // that same Shabbos. Another start walks the school's own grade year
    // (which can begin last Hebrew year) and prices quota on the sheet month.
    $monthRows = function_exists('wwtcKidMonthSlots')
        ? wwtcKidMonthSlots($firstMonth)
        : array_map(static function ($m) {
            return ['month' => $m['month'], 'jd' => (int) $m['jd'], 'quotaJd' => (int) $m['jd']];
        }, wwtcElapsedMonths());
    // Keyed by jd so the holiday rows (below) interleave chronologically — streaks
    // read this list in order, so Rosh Hashana / Yom Kippur must sit after Tishrei.
    $byDate = [];
    foreach ($monthRows as $m) {
        $d = (int) $m['jd'];
        $q = $qFor($kapitel, (int) ($m['quotaJd'] ?? $d));
        [$said, $reported] = $dFor($kapitel, $d);
        [$saidMinutes] = $dFor($minutes, $d);
        $byDate[$d] = [
            'month' => $m['month'],
            'quota' => $q,
            'said' => $said,
            'minutes' => $qFor($minutes, (int) ($m['quotaJd'] ?? $d)),
            'saidMinutes' => $saidMinutes,
            'met' => $reported && $q > 0 && $said >= $q,
            'reported' => $reported,
            'isCurrent' => $d === $current,
            'reportOpen' => $d === $current ? $reportOpen : false,
        ];
    }

    // Holiday training missions: quota = this soldier's SM-Tishrei quota, said =
    // MAX(done_qty) across the holiday's day(s) so Rosh Hashana's two days count
    // once. Only holidays that have mission data appear (wwtcHolidayDates filters).
    // A rotated school uses the quota cell of its Tishrei position, and only
    // when Tishrei is part of the grade year already under way.
    $quotaJd = (int) (wwtcMonthDatesForYear(wwtcYear())['Tishrei'] ?? 0);
    $holidayYear = wwtcYear();
    if (!wwtcIsDefaultSchoolYear($firstMonth)) {
        $quotaJd = 0;
        foreach ($monthRows as $slot) {
            if (($slot['month'] ?? '') !== 'Tishrei') {
                continue;
            }
            $holidayYear = (int) ($slot['year'] ?? wwtcYear());
            $sheet = wwtcQuotaSheetMonth('Tishrei', $firstMonth);
            $quotaJd = wwtcCampaignJd(wwtcYear(), $sheet);
            if ($quotaJd <= 0) {
                $quotaJd = wwtcCampaignJd(wwtcYear() - 1, $sheet);
            }
            break;
        }
    }
    if ($quotaJd > 0) {
        foreach (wwtcHolidayDates($holidayYear) as $name => $jds) {
            [$said, $reported] = wwtcKidHolidayDone($kid, $jds, $kapitel);
            [$saidMinutes] = wwtcKidHolidayDone($kid, $jds, $minutes);
            $q = $qFor($kapitel, $quotaJd);
            $byDate[(int) $jds[0]] = [
                'month' => $name,
                'quota' => $q,
                'said' => $said,
                'minutes' => $qFor($minutes, $quotaJd),
                'saidMinutes' => $saidMinutes,
                'met' => $reported && $q > 0 && $said >= $q,
                'reported' => $reported,
                'isCurrent' => false,
                'reportOpen' => false,
                'holiday' => true,
            ];
        }
    }

    ksort($byDate);
    // Custom ladder replaces the ladder quota. A one-month override then
    // replaces that month's kapitel quota. A rotated school year can include
    // last Hebrew year's months, so those keep last year's override.
    $months = array_values($byDate);
    if (function_exists('wwtcApplyCustomLadderToKidMonths')) {
        $months = wwtcApplyCustomLadderToKidMonths($kid, $months);
    }
    $overrideByMonth = wwtcActiveOverridesForUserYear((int) $kid['user_id'], wwtcYear());
    if (!wwtcIsDefaultSchoolYear($firstMonth)) {
        $priorOverrides = wwtcActiveOverridesForUserYear((int) $kid['user_id'], wwtcYear() - 1);
        $picked = [];
        foreach ($monthRows as $slot) {
            $name = (string) ($slot['month'] ?? '');
            $slotYear = (int) ($slot['year'] ?? wwtcYear());
            $src = $slotYear === wwtcYear() ? $overrideByMonth : $priorOverrides;
            if ($name !== '' && isset($src[$name])) {
                $picked[$name] = $src[$name];
            }
        }
        $overrideByMonth = $picked;
    }
    return wwtcOverlayKidMonthList($months, $overrideByMonth);
}

/**
 * Lifetime Tehillim missions earned (medal board / training count), from the
 * first mark the child has — not just this campaign year. Same source as
 * Soldier::medalBoard(): SUM(mission_count) on date_tasks_mission_marks.
 */
function wwtcKidMissionsLifetime(int $userId): int
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        'SELECT IFNULL(SUM(mission_count), 0) FROM date_tasks_mission_marks
          WHERE user_id = :uid AND subject_id = ' . WWTC_SUBJECT_ID
    );
    $stmt->execute([':uid' => $userId]);
    return (int) $stmt->fetchColumn() + wwtcUnmarkedOverrideCount($userId);
}

/** SPA grade key ('pre1a', '1'..'12') → number for math; -1 if unknown. */
function wwtcGradeNum(string $grade): int
{
    $g = strtolower(trim($grade));
    if ($g === '') {
        return -1;
    }
    return strpos($g, 'pre') === 0 ? 0 : (int) $g;
}

/**
 * Which missions the soldier actually earned, across every grade of the journey,
 * keyed by SPA grade and occasion so the training board checks the real cells
 * (not just this year). Source is date_tasks_mission_marks — the same marks the
 * medal board counts — joined to the mission so we also know the ladder the child
 * was on at that time (track_id → ladder = 15 − track_id). Each mark's mark_date
 * is a Shabbos-Mevorchim jd, which maps to a campaign year (grades advance one per
 * year, so grade G sat in year currentYear − (currentGrade − G)) and an occasion.
 * The cell value is the ladder number then, or true when the track is unknown.
 * Shape: ['3' => ['Tishrei' => 7, ...], 'pre1a' => [...], ...].
 */
function wwtcKidMissionHistoryByGrade(array $kid): array
{
    global $MASHPIA_DB;
    $currentGrade = wwtcGradeNum((string) ($kid['class_grade'] ?? ''));
    if ($currentGrade < 0) {
        return [];
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT mm.mark_date, m.track_id
           FROM date_tasks_mission_marks mm
           JOIN date_tasks_missions m ON m.date_tasks_mission_id = mm.date_tasks_mission_id
          WHERE mm.user_id = :uid AND mm.subject_id = ' . WWTC_SUBJECT_ID
    );
    $stmt->execute([':uid' => (int) $kid['user_id']]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        return [];
    }
    // Build jd → [gradeKey, occasion] for every grade the board shows (pre1a..current).
    $currentYear = wwtcYear();
    $firstMonth = function_exists('wwtcSchoolFirstMonth')
        ? wwtcSchoolFirstMonth((int) ($kid['school_id'] ?? 0))
        : 'Tishrei';
    $jdMap = [];
    // A rotated school year is not one Hebrew year. Map each grade onto the
    // school year that started (current start − how many grades back).
    if (!wwtcIsDefaultSchoolYear($firstMonth) && function_exists('wwtcSchoolYearHistoryMap')) {
        $currentMonth = wwtcMonthForDate(wwtcCurrentDate());
        $jdMap = wwtcSchoolYearHistoryMap(
            $firstMonth,
            $currentGrade,
            $currentYear,
            $currentMonth !== '' ? $currentMonth : 'Tishrei'
        );
    }
    for ($gn = 0; $gn <= $currentGrade && wwtcIsDefaultSchoolYear($firstMonth); $gn++) {
        $year = $currentYear - ($currentGrade - $gn);
        $gradeKey = $gn === 0 ? 'pre1a' : (string) $gn;
        foreach (wwtcMonthDatesForYear($year) as $month => $jd) {
            // Adar I and Adar II stay distinct so a leap year's two marks do not
            // overwrite each other. A plain year still keys its one month "Adar".
            $jdMap[(int) $jd] = [$gradeKey, wwtcHistoryOccasion($month)];
        }
        foreach (wwtcHolidayDates($year) as $name => $jds) {
            foreach ($jds as $hjd) {
                $jdMap[(int) $hjd] = [$gradeKey, $name];
            }
        }
    }
    $out = [];
    foreach ($rows as $r) {
        $jd = (int) $r['mark_date'];
        if (!isset($jdMap[$jd])) {
            continue; // a mark outside the shown grade span (e.g. before pre1a)
        }
        [$gradeKey, $occ] = $jdMap[$jd];
        $ladder = wwtcLadderFromTrack($r['track_id']);
        $out[$gradeKey][$occ] = $ladder ?: true;
    }
    return $out;
}

/**
 * The signed-in soldier's progress payload (GET /me/progress, and the fresh
 * state POST /me/report returns). medal stays null — medal logic is client-side.
 */
function wwtcKidProgress(array $kid): array
{
    global $MASHPIA_DB;
    $months = wwtcKidMonths($kid);
    $metThisYear = 0;
    $current = null;
    foreach ($months as $mo) {
        $metThisYear += $mo['met'] ? 1 : 0;
        if ($mo['isCurrent']) {
            $current = $mo;
        }
    }
    $missionsTotal = wwtcKidMissionsLifetime((int) $kid['user_id']);
    if (function_exists('wwtcUnmarkedCustomLadderMissions')) {
        $missionsTotal += wwtcUnmarkedCustomLadderMissions((int) $kid['user_id'], $months, wwtcYear());
    }
    // Prefer lifetime − this-year SM months; never go negative if marks include
    // RH/YK or other occasions beyond the elapsed-month list.
    $priorMissions = max(0, $missionsTotal - $metThisYear);
    $out = array_merge(wwtcSafeKid($kid), [
        'yearStart' => function_exists('wwtcSchoolFirstMonth')
            ? wwtcSchoolFirstMonth((int) ($kid['school_id'] ?? 0))
            : 'Tishrei',
        'months' => $months,
        'metThisYear' => $metThisYear,
        'missionsTotal' => $missionsTotal,
        'priorMissions' => $priorMissions,
        'missionHistory' => wwtcKidMissionHistoryByGrade($kid),
        'medal' => null,
        // Tzivos Hashem rank (all campaigns), not a label from Tehillim medals.
        'rank' => wwtcCurrentRank($MASHPIA_DB, (int) $kid['user_id']),
        'current' => $current,
        'year' => wwtcYear(),
    ]);
    if (function_exists('wwtcActiveCustomLadderForUser')) {
        $custom = wwtcPublicCustomLadder(wwtcActiveCustomLadderForUser((int) $kid['user_id']));
        if ($custom) {
            $out['customLadder'] = $custom;
        }
    }
    // An open flag is waiting for review and is not part of the counted mark.
    $openFlag = wwtcOpenFlag((int) $kid['user_id'], (int) wwtcCurrentDate());
    if ($openFlag) {
        $out['flagged'] = $openFlag;
    }
    return $out;
}
