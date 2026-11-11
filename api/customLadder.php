<?php

/**
 * Custom ladder for one soldier.
 *
 * The eight ladders are one climb shifted by a grade. "150 by 8th grade"
 * reproduces ladder 8. Any other kapitlach target scales that climb. A finish
 * before 5th grade or after 12th shifts the same curve; years past ladder 12
 * at Pre-1A are extrapolated and never go below 1 kapitel.
 *
 * From the soldier's current month forward, the quota does not drop below
 * what they have now. The target is still reached when it is higher.
 *
 * Precedence for one month:
 *   1. An active one-month quota override wins for the kapitel quota. That
 *      month counts as met at the amount they entered. Minutes stay put.
 *   2. Otherwise an active custom ladder supplies kapitel and minutes.
 *   3. Otherwise the normal ladder.
 *
 * How a monthly quota above one Tehillim (150) is shown — Sholem is confirming
 * this. The stored number is not capped. Display mode is tehillim-plus-count:
 *   190 → "1 Tehillim + 40 kapitlach" (plain number 190 beside it)
 *   300 → "2 Tehillim" (plain number 300 beside it)
 * Letters are not used above 150.
 *
 * Storage: api/sql/wwtc_custom_ladders.sql. This file does not run it.
 */

const WWTC_TEHILLIM_KAPITLACH = 150;
const WWTC_KAPITEL_ABOVE_TEHILLIM_DISPLAY = 'tehillim-plus-count';
const WWTC_MAX_TARGET_KAPITLACH = 9999;
const WWTC_MAX_FINISH_OFFSET = 4;

/** @return list<string> */
function wwtcLadderMonths(): array
{
    return ['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'];
}

function wwtcCustomMonthName(string $month): string
{
    if ($month === 'Adar I' || $month === 'Adar II') {
        return 'Adar';
    }
    if ($month === 'Rosh Hashana' || $month === 'Yom Kippur') {
        return 'Tishrei';
    }
    return $month;
}

function wwtcGradeKeyFrom(string $grade): string
{
    $g = strtolower(trim($grade));
    if ($g === '') {
        return '';
    }
    if (strpos($g, 'pre') === 0) {
        return 'pre1a';
    }
    if (!preg_match('/(\d+)/', $g, $m)) {
        return '';
    }
    $n = (int) $m[1];
    if ($n < 1 || $n > 12 + WWTC_MAX_FINISH_OFFSET) {
        return '';
    }
    return (string) $n;
}

function wwtcGradeIndexFrom(string $grade): int
{
    $key = wwtcGradeKeyFrom($grade);
    if ($key === '') {
        return -1;
    }
    return $key === 'pre1a' ? 0 : (int) $key;
}

function wwtcGradeKeyFromIndex(int $index): string
{
    if ($index < 0) {
        return '';
    }
    return $index === 0 ? 'pre1a' : (string) $index;
}

function wwtcFinishGradeLabel(string $grade): string
{
    $n = wwtcGradeIndexFrom($grade);
    if ($n < 0) {
        return '';
    }
    if ($n === 0) {
        return 'Pre-1A';
    }
    if ($n <= 12) {
        $ord = [1 => '1st', 2 => '2nd', 3 => '3rd'];
        $suffix = $ord[$n] ?? ($n . 'th');
        return $suffix . ' grade';
    }
    $after = $n - 12;
    return $after === 1 ? '1 year after 12th' : ($after . ' years after 12th');
}

/** @return list<string> */
function wwtcGradesThrough(string $finishGrade, string $alsoGrade = ''): array
{
    $cap = max(wwtcGradeIndexFrom($finishGrade), wwtcGradeIndexFrom($alsoGrade), 0);
    $out = ['pre1a'];
    for ($n = 1; $n <= $cap; $n++) {
        $out[] = (string) $n;
    }
    return $out;
}

/**
 * Parsed ladders.js quota: [grade][month][ladder 5-12] => ['v'=>float,'m'=>int,'h'=>?int]
 *
 * @return array<string,array<string,array<int,array{v:float,m:int,h:?int}>>>
 */
function wwtcParsedLadderQuota(): array
{
    static $parsed = null;
    if ($parsed !== null) {
        return $parsed;
    }
    $path = dirname(__DIR__) . '/src/data/ladders.js';
    $text = is_file($path) ? (string) file_get_contents($path) : '';
    $parsed = [];
    $grade = null;
    $months = array_fill_keys(wwtcLadderMonths(), true);
    foreach (preg_split("/\r\n|\n|\r/", $text) as $line) {
        if (preg_match("/^\\s*'(pre1a|\\d+)': \\{\\s*$/", $line, $gm)) {
            $grade = $gm[1];
            continue;
        }
        if ($grade === null || !preg_match('/^\\s*([A-Za-z]+): \\{/', $line, $mm)) {
            continue;
        }
        $month = $mm[1];
        if (!isset($months[$month])) {
            continue;
        }
        if (!preg_match_all('/(\\d+):\\{k:"[^"]*",v:(\\d+(?:\\.\\d+)?)(?:,m:(\\d+))?(?:,h:(\\d+))?\\}/', $line, $cells, PREG_SET_ORDER)) {
            continue;
        }
        foreach ($cells as $cell) {
            $ladder = (int) $cell[1] + 4;
            $parsed[$grade][$month][$ladder] = [
                'v' => (float) $cell[2],
                'm' => isset($cell[3]) && $cell[3] !== '' ? (int) $cell[3] : 0,
                'h' => isset($cell[4]) && $cell[4] !== '' ? (int) $cell[4] : null,
            ];
        }
    }
    return $parsed;
}

/** @return array{v:float,m:int,h:?int} */
function wwtcLadderCell(float $v, int $m, ?int $h = null): array
{
    return ['v' => $v, 'm' => $m, 'h' => $h ?: null];
}

/** @return array<int,array<string,array{v:float,m:int,h:?int}>> */
function wwtcSlowestCurve(): array
{
    static $curve = null;
    if ($curve !== null) {
        return $curve;
    }
    $quota = wwtcParsedLadderQuota();
    $curve = [];
    for ($years = 0; $years <= 12; $years++) {
        $grade = $years === 12 ? 'pre1a' : (string) (12 - $years);
        $row = [];
        foreach (wwtcLadderMonths() as $month) {
            if (isset($quota[$grade][$month][12])) {
                $row[$month] = $quota[$grade][$month][12];
            }
        }
        $curve[$years] = $row;
    }
    return $curve;
}

/** @return list<array{v:float,m:int}> */
function wwtcMinutePoints(): array
{
    static $points = null;
    if ($points !== null) {
        return $points;
    }
    $counts = [];
    foreach (wwtcParsedLadderQuota() as $months) {
        foreach ($months as $cells) {
            foreach ($cells as $cell) {
                $key = (string) $cell['v'];
                $m = (int) $cell['m'];
                if (!isset($counts[$key])) {
                    $counts[$key] = [];
                }
                $counts[$key][$m] = ($counts[$key][$m] ?? 0) + 1;
            }
        }
    }
    $points = [];
    foreach ($counts as $key => $bag) {
        $bestM = null;
        $bestN = -1;
        foreach ($bag as $m => $n) {
            $m = (int) $m;
            if ($n > $bestN || ($n === $bestN && ($bestM === null || $m < $bestM))) {
                $bestM = $m;
                $bestN = $n;
            }
        }
        $points[] = ['v' => (float) $key, 'm' => (int) $bestM];
    }
    usort($points, static function ($a, $b) {
        return $a['v'] <=> $b['v'];
    });
    return $points;
}

function wwtcMinutesForKapitlach(float $kapitlach): int
{
    $points = wwtcMinutePoints();
    if (!$points) {
        return 0;
    }
    foreach ($points as $point) {
        if (abs($point['v'] - $kapitlach) < 1e-9) {
            return (int) $point['m'];
        }
    }
    if ($kapitlach <= $points[0]['v']) {
        return (int) $points[0]['m'];
    }
    $last = $points[count($points) - 1];
    if ($kapitlach > $last['v']) {
        $slope = 0.0;
        for ($i = count($points) - 1; $i > 0; $i--) {
            $rise = $points[$i]['m'] - $points[$i - 1]['m'];
            $run = $points[$i]['v'] - $points[$i - 1]['v'];
            if ($rise > 0 && $run > 0) {
                $slope = $rise / $run;
                break;
            }
        }
        return max(0, (int) round($last['m'] + ($kapitlach - $last['v']) * $slope));
    }
    for ($i = 1, $n = count($points); $i < $n; $i++) {
        if ($points[$i]['v'] < $kapitlach) {
            continue;
        }
        $a = $points[$i - 1];
        $b = $points[$i];
        $t = ($kapitlach - $a['v']) / ($b['v'] - $a['v']);
        return (int) round($a['m'] + $t * ($b['m'] - $a['m']));
    }
    return (int) $last['m'];
}

/** @return array{v:float,m:int,h:?int}|null */
function wwtcStandardCell(string $finishGrade, string $grade, string $month): ?array
{
    $finish = wwtcGradeIndexFrom($finishGrade);
    $g = wwtcGradeIndexFrom($grade);
    $mo = wwtcCustomMonthName($month);
    if ($finish < 0 || $g < 0 || !in_array($mo, wwtcLadderMonths(), true)) {
        return null;
    }
    $yearsBefore = $finish - $g;
    if ($yearsBefore <= 0) {
        return wwtcLadderCell((float) WWTC_TEHILLIM_KAPITLACH, 120);
    }
    if ($finish >= 5 && $finish <= 12 && $g <= $finish) {
        $copied = wwtcParsedLadderQuota()[wwtcGradeKeyFromIndex($g)][$mo][$finish] ?? null;
        if ($copied) {
            return wwtcLadderCell((float) $copied['v'], (int) $copied['m'], $copied['h'] ?? null);
        }
    }
    if ($yearsBefore <= 12) {
        $row = wwtcSlowestCurve()[$yearsBefore][$mo] ?? null;
        return $row ? wwtcLadderCell((float) $row['v'], (int) $row['m'], $row['h'] ?? null) : null;
    }
    $far = wwtcSlowestCurve()[12][$mo] ?? null;
    $near = wwtcSlowestCurve()[11][$mo] ?? null;
    if (!$far) {
        return null;
    }
    $step = $near ? ((float) $near['v'] - (float) $far['v']) : 0.0;
    $extra = $yearsBefore - 12;
    $v = max(1.0, (float) $far['v'] - $extra * ($step > 0 ? $step : 0));
    return wwtcLadderCell($v, wwtcMinutesForKapitlach($v));
}

/** @return array{v:float,m:int,h:?int}|null */
function wwtcScaledCell(?array $base, int $target): ?array
{
    if (!$base) {
        return null;
    }
    if ($target === WWTC_TEHILLIM_KAPITLACH) {
        return wwtcLadderCell((float) $base['v'], (int) $base['m'], $base['h'] ?? null);
    }
    $v = (int) round(((float) $base['v'] * $target) / WWTC_TEHILLIM_KAPITLACH);
    $v = max(1, $v);
    return wwtcLadderCell((float) $v, wwtcMinutesForKapitlach((float) $v));
}

/**
 * @param array{grade?:string,month?:string,kapitlach?:float|int,minutes?:int}|null $anchor
 * @return array{targetKapitlach:int,finishGrade:string,finishLabel:string,basedOnLadder:int,anchored:bool,cells:array}
 */
function wwtcGenerateCustomLadder(int $targetKapitlach, string $finishGrade, ?array $anchor = null): array
{
    $target = (int) round($targetKapitlach);
    if ($target < 1 || $target > WWTC_MAX_TARGET_KAPITLACH) {
        throw new InvalidArgumentException('Kapitlach target must be a whole number from 1 to ' . WWTC_MAX_TARGET_KAPITLACH . '.');
    }
    $finish = wwtcGradeKeyFrom($finishGrade);
    if ($finish === '' || wwtcGradeIndexFrom($finish) > 12 + WWTC_MAX_FINISH_OFFSET) {
        throw new InvalidArgumentException('Choose a finish grade from Pre-1A through 4 years after 12th.');
    }
    $anchorGrade = ($anchor && isset($anchor['grade'])) ? wwtcGradeKeyFrom((string) $anchor['grade']) : '';
    $cells = [];
    foreach (wwtcGradesThrough($finish, $anchorGrade) as $grade) {
        $cells[$grade] = [];
        foreach (wwtcLadderMonths() as $month) {
            $cells[$grade][$month] = wwtcScaledCell(wwtcStandardCell($finish, $grade, $month), $target);
        }
    }
    $finishN = wwtcGradeIndexFrom($finish);
    $basedOn = ($finishN >= 5 && $finishN <= 12) ? $finishN : 12;
    $grid = [
        'targetKapitlach' => $target,
        'finishGrade' => $finish,
        'finishLabel' => wwtcFinishGradeLabel($finish),
        'basedOnLadder' => $basedOn,
        'anchored' => false,
        'cells' => $cells,
    ];
    if (!$anchor || !isset($anchor['kapitlach']) || $anchor['kapitlach'] === '') {
        return $grid;
    }
    $aGrade = wwtcGradeKeyFrom((string) ($anchor['grade'] ?? ''));
    $aMonth = wwtcCustomMonthName((string) ($anchor['month'] ?? ''));
    if ($aGrade === '' || !isset($cells[$aGrade][$aMonth])) {
        return $grid;
    }
    $aV = (float) $anchor['kapitlach'];
    $aM = (int) round((float) ($anchor['minutes'] ?? 0));
    $slots = [];
    foreach (wwtcGradesThrough($finish, $aGrade) as $grade) {
        foreach (wwtcLadderMonths() as $month) {
            $slots[] = ['grade' => $grade, 'month' => $month];
        }
    }
    $idx = -1;
    foreach ($slots as $i => $slot) {
        if ($slot['grade'] === $aGrade && $slot['month'] === $aMonth) {
            $idx = $i;
            break;
        }
    }
    if ($idx < 0) {
        return $grid;
    }
    $pure = $cells[$aGrade][$aMonth];
    $next = $cells;
    if ($aV > (float) $pure['v']) {
        $goal = max((float) $target, $aV);
        $c0 = (float) $pure['v'];
        $endGrade = wwtcGradeKeyFromIndex(max($finishN, wwtcGradeIndexFrom($aGrade)));
        $c1 = (float) $next[$endGrade]['Elul']['v'];
        $prevV = $aV;
        $prevM = $aM;
        for ($j = $idx, $n = count($slots); $j < $n; $j++) {
            $slot = $slots[$j];
            $c = (float) $next[$slot['grade']][$slot['month']]['v'];
            if ($c1 === $c0) {
                $t = ($n - 1 === $idx) ? 1.0 : (($j - $idx) / ($n - 1 - $idx));
            } else {
                $t = ($c - $c0) / ($c1 - $c0);
            }
            if (!is_finite($t)) {
                $t = 1.0;
            }
            $t = min(1.0, max(0.0, $t));
            $v = (float) (int) round($aV + $t * ($goal - $aV));
            if ($v < $prevV) {
                $v = $prevV;
            }
            $m = wwtcMinutesForKapitlach($v);
            if ($m < $prevM) {
                $m = $prevM;
            }
            $next[$slot['grade']][$slot['month']] = wwtcLadderCell($v, $m);
            $prevV = $v;
            $prevM = $m;
        }
        $grid['cells'] = $next;
        $grid['anchored'] = true;
    } elseif (wwtcEnforceFloorForward($next, $slots, $idx, $aV, $aM)) {
        $grid['cells'] = $next;
        $grid['anchored'] = true;
    }
    return $grid;
}

/** @param array<int,array{grade:string,month:string}> $slots */
function wwtcEnforceFloorForward(array &$cells, array $slots, int $from, float $floorV, int $floorM): bool
{
    $prevV = $floorV;
    $prevM = $floorM;
    $changed = false;
    for ($i = $from, $n = count($slots); $i < $n; $i++) {
        $slot = $slots[$i];
        $cell = $cells[$slot['grade']][$slot['month']];
        $v = (float) $cell['v'];
        $m = (int) $cell['m'];
        if ($v < $prevV) {
            $v = $prevV;
            $m = wwtcMinutesForKapitlach($v);
        }
        if ($m < $prevM) {
            $m = $prevM;
        }
        if ($v !== (float) $cell['v'] || $m !== (int) $cell['m']) {
            $keepH = ($v === (float) $cell['v']) ? ($cell['h'] ?? null) : null;
            $cells[$slot['grade']][$slot['month']] = wwtcLadderCell($v, $m, $keepH);
            $changed = true;
        }
        $prevV = $v;
        $prevM = $m;
    }
    return $changed;
}

function wwtcHebTwo(int $n): string
{
    $ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    $tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
    if ($n === 15) {
        return 'טו';
    }
    if ($n === 16) {
        return 'טז';
    }
    return ($tens[intdiv($n, 10)] ?? '') . ($ones[$n % 10] ?? '');
}

function wwtcToHebrewNumeral($num): string
{
    if ($num === null || $num === '') {
        return '';
    }
    $value = (float) $num;
    $half = floor($value) !== $value;
    $n = (int) floor($value);
    $hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
    $out = '';
    $h = intdiv($n, 100);
    while ($h > 0) {
        $take = min($h, 4);
        $out .= $hundreds[$take];
        $h -= $take;
    }
    $out .= wwtcHebTwo($n % 100);
    return $half ? ('½' . $out) : $out;
}

/** @return array{label:string,short:string,plain:string,overTehillim:bool,crown:bool} */
function wwtcFormatKapitlachQuota($value): array
{
    if (!is_numeric($value)) {
        return ['label' => '', 'short' => '', 'plain' => '', 'overTehillim' => false, 'crown' => false];
    }
    $v = (float) $value;
    $plain = (floor($v) === $v) ? (string) (int) $v : (string) $v;
    if ($v > WWTC_TEHILLIM_KAPITLACH) {
        $books = (int) floor($v / WWTC_TEHILLIM_KAPITLACH);
        $rem = round(($v - $books * WWTC_TEHILLIM_KAPITLACH) * 10) / 10;
        $booksLabel = $books . ' Tehillim';
        if ($rem == 0.0) {
            $label = $booksLabel;
        } elseif ($rem == 1.0) {
            $label = $booksLabel . ' + 1 kapitel';
        } else {
            $remText = (floor($rem) === $rem) ? (string) (int) $rem : (string) $rem;
            $label = $booksLabel . ' + ' . $remText . ' kapitlach';
        }
        return ['label' => $label, 'short' => $plain, 'plain' => $plain, 'overTehillim' => true, 'crown' => false];
    }
    $letters = $v <= 1 ? 'א' : ('א-' . wwtcToHebrewNumeral($v));
    return [
        'label' => $letters,
        'short' => $letters,
        'plain' => $plain,
        'overTehillim' => false,
        'crown' => $v === (float) WWTC_TEHILLIM_KAPITLACH,
    ];
}

/** @return list<string> */
function wwtcLadderProblems(array $grid): array
{
    if (empty($grid['cells']) || !is_array($grid['cells'])) {
        return ['A ladder is required.'];
    }
    $problems = [];
    $prev = null;
    foreach (wwtcGradesThrough((string) ($grid['finishGrade'] ?? '')) as $grade) {
        foreach (wwtcLadderMonths() as $month) {
            $cell = $grid['cells'][$grade][$month] ?? null;
            if (!is_array($cell)) {
                $problems[] = "Missing $grade $month.";
                continue;
            }
            if (!((float) $cell['v'] >= 1)) {
                $problems[] = "$grade $month kapitlach must be at least 1.";
            }
            if (!((int) $cell['m'] >= 0)) {
                $problems[] = "$grade $month minutes must be at least 0.";
            }
            if ($prev !== null && (float) $cell['v'] + 1e-9 < (float) $prev['v']) {
                $problems[] = "$grade $month drops below the month before it.";
            }
            $prev = $cell;
        }
    }
    return $problems;
}

// ---- storage and overlays ---------------------------------------------------

function &wwtcCustomLadderCacheBag(): array
{
    static $bag = ['all' => null];
    return $bag;
}

function wwtcForgetCustomLadderCache(): void
{
    $bag = &wwtcCustomLadderCacheBag();
    $bag['all'] = null;
}

function wwtcCustomLaddersReady(): bool
{
    return function_exists('wwtcColumnExists') && wwtcColumnExists('wwtc_custom_ladders', 'ladder_json');
}

/** @return array<string,mixed>|null */
function wwtcDecodeCustomLadderRow(array $row): ?array
{
    $grid = json_decode((string) ($row['ladder_json'] ?? ''), true);
    if (!is_array($grid) || empty($grid['cells']) || !is_array($grid['cells'])) {
        return null;
    }
    $row['grid'] = $grid;
    return $row;
}

/**
 * Active custom ladders keyed by user_id. Empty when the table is missing.
 *
 * @return array<int,array>
 */
function wwtcActiveCustomLadderMap(): array
{
    $bag = &wwtcCustomLadderCacheBag();
    if ($bag['all'] !== null) {
        return $bag['all'];
    }
    if (!wwtcCustomLaddersReady() || !isset($GLOBALS['MASHPIA_DB'])) {
        return $bag['all'] = [];
    }
    global $MASHPIA_DB;
    try {
        $rows = $MASHPIA_DB->query(
            'SELECT o.user_id, o.target_kapitlach, o.finish_grade, o.based_on_ladder, o.ladder_json,
                    o.anchor_grade, o.anchor_month, o.anchor_kapitlach, o.anchor_minutes,
                    o.reason, o.created_by, o.created_at, o.removed_at,
                    u.school_id, u.class_id, c.class_grade
               FROM wwtc_custom_ladders o
               JOIN users u ON u.user_id = o.user_id
               LEFT JOIN classes c ON c.class_id = u.class_id
              WHERE o.removed_at IS NULL'
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log('WWTC custom ladder read failed: ' . $e->getMessage());
        return $bag['all'] = [];
    }
    $byUser = [];
    foreach ($rows as $row) {
        $decoded = wwtcDecodeCustomLadderRow($row);
        if ($decoded) {
            $byUser[(int) $decoded['user_id']] = $decoded;
        }
    }
    return $bag['all'] = $byUser;
}

function wwtcActiveCustomLadderForUser(int $userId): ?array
{
    if ($userId <= 0) {
        return null;
    }
    $map = wwtcActiveCustomLadderMap();
    return $map[$userId] ?? null;
}

/** @return array{v:float,m:int}|null */
function wwtcCustomLadderCell(?array $row, string $grade, string $month): ?array
{
    if (!$row) {
        return null;
    }
    $grid = $row['grid'] ?? null;
    if (!is_array($grid)) {
        return null;
    }
    $g = wwtcGradeKeyFrom($grade);
    $mo = wwtcCustomMonthName($month);
    $cell = ($g !== '' && isset($grid['cells'][$g][$mo]) && is_array($grid['cells'][$g][$mo]))
        ? $grid['cells'][$g][$mo]
        : null;
    if (!$cell || !isset($cell['v'])) {
        return null;
    }
    return ['v' => (float) $cell['v'], 'm' => (int) round((float) ($cell['m'] ?? 0))];
}

/** Integer quota used by report sums. Half kapitlach round half up (118.5 → 119). */
function wwtcCustomQuotaInt(float $v): int
{
    return (int) round($v);
}

/**
 * Replace one school's soldier quotas from active custom ladders.
 * Class kapitel and minutes goals move by the same amount. Call this before
 * the one-month override overlay so the override still wins.
 */
function wwtcOverlayCustomLaddersOnSchool(array $data, int $date, int $year): array
{
    if (!function_exists('wwtcMonthNameForJd')) {
        return $data;
    }
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $data;
    }
    $ladders = wwtcActiveCustomLadderMap();
    if (!$ladders) {
        return $data;
    }
    $gradeByClass = [];
    foreach ($data['classes'] ?? [] as $class) {
        $gradeByClass[(int) ($class['id'] ?? 0)] = wwtcGradeKeyFrom((string) ($class['grade'] ?? ''));
    }
    $kapDelta = [];
    $minDelta = [];
    $metDelta = [];
    $students = [];
    foreach ($data['students'] ?? [] as $student) {
        $uid = (int) ($student['id'] ?? 0);
        $cid = (int) ($student['classId'] ?? 0);
        $row = $ladders[$uid] ?? null;
        $grade = $row ? (string) ($row['class_grade'] ?? '') : '';
        if ($grade === '') {
            $grade = $gradeByClass[$cid] ?? '';
        }
        $cell = $row ? wwtcCustomLadderCell($row, $grade, $month) : null;
        if (!$cell) {
            $students[] = $student;
            continue;
        }
        $beforeK = (int) ($student['quota'] ?? 0);
        $beforeM = (int) ($student['minutesQuota'] ?? 0);
        $nextK = wwtcCustomQuotaInt($cell['v']);
        $nextM = (int) $cell['m'];
        $said = (int) ($student['said'] ?? 0);
        $wasMet = !empty($student['met']);
        $nowMet = $nextK > 0 && $said >= $nextK;
        $student['engineQuota'] = $beforeK;
        $student['quota'] = $nextK;
        $student['minutesQuota'] = $nextM;
        $student['met'] = $nowMet;
        $student['customLadder'] = true;
        $kapDelta[$cid] = ($kapDelta[$cid] ?? 0) + ($nextK - $beforeK);
        $minDelta[$cid] = ($minDelta[$cid] ?? 0) + ($nextM - $beforeM);
        $metDelta[$cid] = ($metDelta[$cid] ?? 0) + (($nowMet ? 1 : 0) - ($wasMet ? 1 : 0));
        $students[] = $student;
    }
    if (!$kapDelta && !$minDelta) {
        return $data;
    }
    $classes = [];
    foreach ($data['classes'] ?? [] as $class) {
        $cid = (int) ($class['id'] ?? 0);
        if (!isset($kapDelta[$cid]) && !isset($minDelta[$cid])) {
            $classes[] = $class;
            continue;
        }
        $quota = (int) ($class['quota'] ?? 0) + (int) ($kapDelta[$cid] ?? 0);
        $minQ = (int) ($class['minutesQuota'] ?? 0) + (int) ($minDelta[$cid] ?? 0);
        $met = (int) ($class['met'] ?? 0) + (int) ($metDelta[$cid] ?? 0);
        $size = (int) ($class['size'] ?? 0);
        $said = (int) ($class['said'] ?? 0);
        $class['quota'] = $quota;
        $class['minutesQuota'] = $minQ;
        $class['met'] = $met;
        $class['pct'] = function_exists('wwtcPct') ? wwtcPct($said, $quota) : ($quota > 0 ? (int) round($said / $quota * 100) : 0);
        $class['minutesPct'] = function_exists('wwtcPct') ? wwtcPct((int) ($class['minutesSaid'] ?? 0), $minQ) : 0;
        $class['pctMet'] = $size > 0 ? (int) round($met / $size * 100) : 0;
        $class['perfect'] = function_exists('wwtcClassIsPerfect')
            ? wwtcClassIsPerfect($met, $size)
            : ($size > 0 && $met === $size);
        $classes[] = $class;
    }
    $data['students'] = $students;
    $data['classes'] = $classes;
    $data['minutesQuota'] = (int) ($data['minutesQuota'] ?? 0) + array_sum($minDelta);
    return $data;
}

/** @param array<int,array<string,mixed>> $soldiers */
function wwtcApplyCustomLaddersToPlatoonSoldiers(array $soldiers, int $date, int $year): array
{
    if ($year <= 0 || !function_exists('wwtcMonthNameForJd')) {
        return $soldiers;
    }
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return $soldiers;
    }
    $ladders = wwtcActiveCustomLadderMap();
    if (!$ladders) {
        return $soldiers;
    }
    foreach ($soldiers as $i => $soldier) {
        $uid = (int) ($soldier['userId'] ?? 0);
        $row = $ladders[$uid] ?? null;
        if (!$row) {
            continue;
        }
        $cell = wwtcCustomLadderCell($row, (string) ($soldier['grade'] ?? ''), $month);
        if (!$cell) {
            continue;
        }
        $soldiers[$i]['quota'] = wwtcCustomQuotaInt($cell['v']);
    }
    return $soldiers;
}

/** Kid month list: custom ladder, then the caller applies the one-month override. */
function wwtcApplyCustomLadderToKidMonths(array $kid, array $months): array
{
    $row = wwtcActiveCustomLadderForUser((int) ($kid['user_id'] ?? 0));
    if (!$row) {
        return $months;
    }
    $grade = wwtcGradeKeyFrom((string) ($kid['class_grade'] ?? ''));
    foreach ($months as $i => $month) {
        $name = (string) ($month['month'] ?? '');
        $cell = wwtcCustomLadderCell($row, $grade, $name);
        if (!$cell) {
            continue;
        }
        $said = (int) ($month['said'] ?? 0);
        $reported = !empty($month['reported']);
        $quota = wwtcCustomQuotaInt($cell['v']);
        $months[$i]['engineQuota'] = (int) ($month['quota'] ?? 0);
        $months[$i]['quota'] = $quota;
        $months[$i]['minutes'] = (int) $cell['m'];
        $months[$i]['quotaLabel'] = wwtcFormatKapitlachQuota($cell['v'])['label'];
        $months[$i]['customLadder'] = true;
        $months[$i]['met'] = $reported && $quota > 0 && $said >= $quota;
    }
    return $months;
}

/**
 * Months the custom ladder newly counts as met, with no mission mark and no
 * one-month override (that override adds its own count).
 *
 * @param array<int,array> $months
 */
function wwtcUnmarkedCustomLadderMissions(int $userId, array $months, int $year): int
{
    $extra = 0;
    $dates = function_exists('wwtcMonthDatesForYear') ? wwtcMonthDatesForYear($year) : [];
    foreach ($months as $month) {
        if (empty($month['customLadder']) || !empty($month['quotaAdjusted']) || empty($month['met'])) {
            continue;
        }
        if (!empty($month['holiday'])) {
            continue;
        }
        $engine = (int) ($month['engineQuota'] ?? 0);
        $said = (int) ($month['said'] ?? 0);
        if ($engine > 0 && $said >= $engine) {
            continue;
        }
        $jd = (int) ($dates[(string) ($month['month'] ?? '')] ?? 0);
        if ($jd && function_exists('wwtcHasMissionMark') && wwtcHasMissionMark($userId, $jd)) {
            continue;
        }
        $extra++;
    }
    return $extra;
}

/** @return array<string,mixed>|null */
function wwtcPublicCustomLadder(?array $row): ?array
{
    if (!$row || empty($row['grid']) || !is_array($row['grid'])) {
        return null;
    }
    $grid = $row['grid'];
    return [
        'targetKapitlach' => (int) ($grid['targetKapitlach'] ?? $row['target_kapitlach'] ?? 0),
        'finishGrade' => (string) ($grid['finishGrade'] ?? $row['finish_grade'] ?? ''),
        'finishLabel' => (string) ($grid['finishLabel'] ?? wwtcFinishGradeLabel((string) ($row['finish_grade'] ?? ''))),
        'basedOnLadder' => isset($grid['basedOnLadder']) ? (int) $grid['basedOnLadder'] : null,
        'anchored' => !empty($grid['anchored']),
        'cells' => $grid['cells'],
    ];
}

/**
 * Holiday board quotas are the Tishrei quota. Apply the custom ladder for
 * Tishrei, then the caller runs the one-month override on top.
 */
function wwtcApplyCustomLaddersToBoard(array $board, string $monthName): array
{
    $ladders = wwtcActiveCustomLadderMap();
    if (!$ladders) {
        return $board;
    }
    $lookupMonth = wwtcCustomMonthName($monthName);
    $studentsBySchool = [];
    $kapDelta = [];
    $minDelta = [];
    $metDeltaSchool = [];
    $metDeltaClass = [];
    foreach ($board['studentsBySchool'] ?? [] as $sid => $students) {
        $adjusted = [];
        foreach ($students as $student) {
            $uid = (int) ($student['id'] ?? 0);
            $cid = (int) ($student['classId'] ?? 0);
            $meta = $board['classMeta'][$cid] ?? [];
            $row = $ladders[$uid] ?? null;
            $cell = $row ? wwtcCustomLadderCell($row, (string) ($meta['grade'] ?? ''), $lookupMonth) : null;
            if (!$cell) {
                $adjusted[] = $student;
                continue;
            }
            $beforeK = (int) ($student['quota'] ?? 0);
            $beforeM = (int) ($student['minutesQuota'] ?? 0);
            $nextK = wwtcCustomQuotaInt($cell['v']);
            $nextM = (int) $cell['m'];
            $said = (int) ($student['said'] ?? 0);
            $was = !empty($student['met']);
            $now = $nextK > 0 && $said >= $nextK;
            $student['quota'] = $nextK;
            $student['minutesQuota'] = $nextM;
            $student['met'] = $now;
            $student['customLadder'] = true;
            $kapDelta[(int) $sid] = ($kapDelta[(int) $sid] ?? 0) + ($nextK - $beforeK);
            $minDelta[(int) $sid] = ($minDelta[(int) $sid] ?? 0) + ($nextM - $beforeM);
            $flip = ($now ? 1 : 0) - ($was ? 1 : 0);
            $metDeltaSchool[(int) $sid] = ($metDeltaSchool[(int) $sid] ?? 0) + $flip;
            $classRow = $metDeltaClass[(int) $sid] ?? [];
            $classRow[$cid] = ($classRow[$cid] ?? 0) + $flip;
            $metDeltaClass[(int) $sid] = $classRow;
            $adjusted[] = $student;
        }
        $studentsBySchool[$sid] = $adjusted;
    }
    if (!$kapDelta && !$minDelta) {
        return $board;
    }
    $board['studentsBySchool'] = $studentsBySchool;
    foreach ($kapDelta as $sid => $delta) {
        $board['kapGoal'][$sid] = (int) ($board['kapGoal'][$sid] ?? 0) + (int) $delta;
    }
    foreach ($minDelta as $sid => $delta) {
        $board['minGoal'][$sid] = (int) ($board['minGoal'][$sid] ?? 0) + (int) $delta;
    }
    $counts = $board['counts'] ?? [];
    $metBySchool = $counts['metBySchool'] ?? [];
    $metByClass = $counts['metByClass'] ?? [];
    foreach ($metDeltaSchool as $sid => $delta) {
        $metBySchool[$sid] = (int) ($metBySchool[$sid] ?? 0) + (int) $delta;
    }
    foreach ($metDeltaClass as $sid => $byClass) {
        foreach ($byClass as $cid => $delta) {
            $row = $metByClass[$sid] ?? [];
            $row[$cid] = (int) ($row[$cid] ?? 0) + (int) $delta;
            $metByClass[$sid] = $row;
        }
    }
    $counts['metBySchool'] = $metBySchool;
    $counts['metByClass'] = $metByClass;
    $board['counts'] = $counts;
    $army = $board['army'] ?? [];
    $army['quota'] = (int) ($army['quota'] ?? 0) + array_sum($kapDelta);
    $army['minutesQuota'] = (int) ($army['minutesQuota'] ?? 0) + array_sum($minDelta);
    $army['metSoldiers'] = (int) ($army['metSoldiers'] ?? 0) + array_sum($metDeltaSchool);
    if (function_exists('wwtcPerfectPlatoonsFromSoldiers') && function_exists('wwtcBoardPlatoonSoldiers')) {
        $army['perfectPlatoons'] = count(wwtcPerfectPlatoonsFromSoldiers(wwtcBoardPlatoonSoldiers($board)));
    }
    $board['army'] = $army;
    return $board;
}

/**
 * Army kapitel goals: an override replaces the engine quota (its delta is
 * already final). A custom ladder with no override adds its own delta.
 * Minutes are not touched by the override, so every custom ladder adjusts them.
 *
 * @param array<int,int> $kapDeltas
 * @param array<int,int> $minDeltas
 * @return array{0:array<int,int>,1:array<int,int>}
 */
function wwtcCustomLadderArmyDeltas(int $date, int $year, array $overrideByUser): array
{
    $ladders = wwtcActiveCustomLadderMap();
    if (!$ladders || !function_exists('wwtcMonthNameForJd') || !function_exists('wwtcSchoolDataRaw')) {
        return [[], []];
    }
    $month = wwtcMonthNameForJd($date, $year);
    if ($month === '') {
        return [[], []];
    }
    $kap = [];
    $min = [];
    $seen = [];
    $schools = [];
    foreach ($ladders as $row) {
        $sid = (int) ($row['school_id'] ?? 0);
        if ($sid > 0) {
            $schools[$sid] = true;
        }
    }
    foreach (array_keys($schools) as $sid) {
        $raw = wwtcSchoolDataRaw((int) $sid, $date, $year);
        $gradeByClass = [];
        foreach ($raw['classes'] ?? [] as $class) {
            $gradeByClass[(int) ($class['id'] ?? 0)] = wwtcGradeKeyFrom((string) ($class['grade'] ?? ''));
        }
        foreach ($raw['students'] ?? [] as $student) {
            $uid = (int) ($student['id'] ?? 0);
            if ($uid <= 0 || empty($ladders[$uid]) || isset($seen[$uid])) {
                continue;
            }
            $seen[$uid] = true;
            $grade = (string) ($ladders[$uid]['class_grade'] ?? '');
            if ($grade === '') {
                $grade = $gradeByClass[(int) ($student['classId'] ?? 0)] ?? '';
            }
            $cell = wwtcCustomLadderCell($ladders[$uid], $grade, $month);
            if (!$cell) {
                continue;
            }
            $engineK = (int) ($student['quota'] ?? 0);
            $engineM = (int) ($student['minutesQuota'] ?? 0);
            $customK = wwtcCustomQuotaInt($cell['v']);
            $customM = (int) $cell['m'];
            $min[(int) $sid] = ($min[(int) $sid] ?? 0) + ($customM - $engineM);
            if (isset($overrideByUser[$uid])) {
                continue;
            }
            $kap[(int) $sid] = ($kap[(int) $sid] ?? 0) + ($customK - $engineK);
        }
    }
    return [$kap, $min];
}

function wwtcInsertCustomLadder(PDO $db, array $row): void
{
    $stmt = $db->prepare(
        'INSERT INTO wwtc_custom_ladders
            (user_id, target_kapitlach, finish_grade, based_on_ladder, ladder_json,
             anchor_grade, anchor_month, anchor_kapitlach, anchor_minutes,
             reason, created_by, created_at)
         VALUES
            (:uid, :target, :finish, :based, :json, :agrade, :amonth, :akap, :amin, :reason, :who, :at)'
    );
    $stmt->execute([
        ':uid' => (int) $row['user_id'],
        ':target' => (int) $row['target_kapitlach'],
        ':finish' => (string) $row['finish_grade'],
        ':based' => $row['based_on_ladder'],
        ':json' => (string) $row['ladder_json'],
        ':agrade' => $row['anchor_grade'],
        ':amonth' => $row['anchor_month'],
        ':akap' => $row['anchor_kapitlach'],
        ':amin' => $row['anchor_minutes'],
        ':reason' => $row['reason'],
        ':who' => (int) $row['created_by'],
        ':at' => (string) $row['created_at'],
    ]);
}

function wwtcMarkCustomLadderRemoved(PDO $db, int $userId, int $actorId, string $when): void
{
    $stmt = $db->prepare(
        'UPDATE wwtc_custom_ladders
            SET removed_at = :at, removed_by = :by
          WHERE user_id = :uid AND removed_at IS NULL'
    );
    $stmt->execute([':at' => $when, ':by' => $actorId, ':uid' => $userId]);
}

/**
 * @param array $context keys: ready, anchor {grade,month,kapitlach,minutes}, now
 * @return array{status:int,error?:string,body?:array}
 */
function wwtcPerformCustomLadder(PDO $db, array $actor, array $kid, array $input, array $adminSchoolIds, array $context): array
{
    if (empty($context['ready'])) {
        return [
            'status' => 503,
            'error' => 'Custom ladder storage is not installed yet. Run api/sql/wwtc_custom_ladders.sql on mashpia. The audit log comes from api/sql/wwtc_quota_overrides.sql.',
        ];
    }
    $kidSchool = (int) ($kid['school_id'] ?? 0);
    if (!function_exists('wwtcOverrideStatus')) {
        require_once __DIR__ . '/quotaOverride.php';
    }
    if (wwtcOverrideStatus($actor, $kidSchool, $adminSchoolIds) !== 200) {
        return ['status' => 403, 'error' => 'You can only set a custom ladder for soldiers in your own school.'];
    }
    try {
        $grid = wwtcGenerateCustomLadder(
            (int) ($input['targetKapitlach'] ?? 0),
            (string) ($input['finishGrade'] ?? ''),
            $context['anchor'] ?? null
        );
    } catch (InvalidArgumentException $e) {
        return ['status' => 422, 'error' => $e->getMessage()];
    }
    $problems = wwtcLadderProblems($grid);
    if ($problems) {
        return ['status' => 422, 'error' => $problems[0]];
    }
    $reason = trim((string) ($input['reason'] ?? ''));
    if (strlen($reason) > 500) {
        $reason = substr($reason, 0, 500);
    }
    $when = (string) ($context['now'] ?? date('Y-m-d H:i:s'));
    $actorId = (int) ($actor['id'] ?? 0);
    $actorName = trim((string) ($actor['name'] ?? ''));
    if ($actorName === '' && function_exists('wwtcAdminLabel')) {
        $actorName = wwtcAdminLabel($actorId);
    }
    $userId = (int) ($kid['user_id'] ?? $kid['id'] ?? 0);
    $anchor = $context['anchor'] ?? [];
    wwtcMarkCustomLadderRemoved($db, $userId, $actorId, $when);
    wwtcInsertCustomLadder($db, [
        'user_id' => $userId,
        'target_kapitlach' => $grid['targetKapitlach'],
        'finish_grade' => $grid['finishGrade'],
        'based_on_ladder' => $grid['basedOnLadder'],
        'ladder_json' => json_encode($grid, JSON_UNESCAPED_UNICODE),
        'anchor_grade' => $anchor['grade'] ?? null,
        'anchor_month' => $anchor['month'] ?? null,
        'anchor_kapitlach' => isset($anchor['kapitlach']) ? $anchor['kapitlach'] : null,
        'anchor_minutes' => isset($anchor['minutes']) ? (int) $anchor['minutes'] : null,
        'reason' => $reason === '' ? null : $reason,
        'created_by' => $actorId,
        'created_at' => $when,
    ]);
    if (function_exists('wwtcInsertAudit')) {
        wwtcInsertAudit($db, [
            'action' => 'custom_ladder_set',
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'user_id' => $userId,
            'campaign_year' => function_exists('wwtcYear') ? wwtcYear() : null,
            'month_name' => (string) ($anchor['month'] ?? ''),
            'detail' => 'Custom ladder: finish ' . $grid['targetKapitlach'] . ' kapitlach by ' . $grid['finishLabel'],
            'created_at' => $when,
        ]);
    }
    wwtcForgetCustomLadderCache();
    return [
        'status' => 200,
        'body' => [
            'ok' => true,
            'userId' => $userId,
            'customLadder' => [
                'targetKapitlach' => $grid['targetKapitlach'],
                'finishGrade' => $grid['finishGrade'],
                'finishLabel' => $grid['finishLabel'],
                'basedOnLadder' => $grid['basedOnLadder'],
                'anchored' => $grid['anchored'],
                'cells' => $grid['cells'],
            ],
        ],
    ];
}

/**
 * @param array $context keys: ready, active, now
 * @return array{status:int,error?:string,body?:array}
 */
function wwtcPerformRemoveCustomLadder(PDO $db, array $actor, array $kid, array $adminSchoolIds, array $context): array
{
    if (empty($context['ready'])) {
        return [
            'status' => 503,
            'error' => 'Custom ladder storage is not installed yet. Run api/sql/wwtc_custom_ladders.sql on mashpia.',
        ];
    }
    $kidSchool = (int) ($kid['school_id'] ?? 0);
    if (!function_exists('wwtcOverrideStatus')) {
        require_once __DIR__ . '/quotaOverride.php';
    }
    if (wwtcOverrideStatus($actor, $kidSchool, $adminSchoolIds) !== 200) {
        return ['status' => 403, 'error' => 'You can only set a custom ladder for soldiers in your own school.'];
    }
    if (empty($context['active'])) {
        return ['status' => 404, 'error' => 'That soldier does not have a custom ladder.'];
    }
    $when = (string) ($context['now'] ?? date('Y-m-d H:i:s'));
    $actorId = (int) ($actor['id'] ?? 0);
    $actorName = trim((string) ($actor['name'] ?? ''));
    if ($actorName === '' && function_exists('wwtcAdminLabel')) {
        $actorName = wwtcAdminLabel($actorId);
    }
    $userId = (int) ($kid['user_id'] ?? $kid['id'] ?? 0);
    wwtcMarkCustomLadderRemoved($db, $userId, $actorId, $when);
    if (function_exists('wwtcInsertAudit')) {
        wwtcInsertAudit($db, [
            'action' => 'custom_ladder_remove',
            'actor_id' => $actorId,
            'actor_name' => $actorName,
            'user_id' => $userId,
            'campaign_year' => function_exists('wwtcYear') ? wwtcYear() : null,
            'month_name' => '',
            'detail' => 'Custom ladder removed',
            'created_at' => $when,
        ]);
    }
    wwtcForgetCustomLadderCache();
    return [
        'status' => 200,
        'body' => ['ok' => true, 'userId' => $userId, 'customLadder' => null],
    ];
}

/**
 * Soldiers in one school for the admin picker. Names stay on this admin route.
 *
 * @return list<array<string,mixed>>
 */
function wwtcCustomLadderRoster(int $schoolId): array
{
    if ($schoolId <= 0 || !isset($GLOBALS['MASHPIA_DB'])) {
        return [];
    }
    global $MASHPIA_DB;
    $subject = defined('WWTC_SUBJECT_ID') ? (int) WWTC_SUBJECT_ID : 1;
    $stmt = $MASHPIA_DB->prepare(
        'SELECT u.user_id, u.first, u.last, c.class_id, c.class_grade, c.class_sub, ut.track_id
           FROM users u
           JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
           LEFT JOIN user_tracks ut
             ON ut.user_id = u.user_id AND ut.subject_id = ' . $subject . ' AND ut.enrolled = 1
          WHERE u.school_id = :sid AND u.user_registered > 0
          ORDER BY c.class_grade, c.class_sub, u.last, u.first'
    );
    $stmt->execute([':sid' => $schoolId]);
    $ladders = wwtcActiveCustomLadderMap();
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $uid = (int) $row['user_id'];
        $grade = (string) ($row['class_grade'] ?? '');
        $sub = trim((string) ($row['class_sub'] ?? ''));
        $ladder = function_exists('wwtcLadderFromTrack') ? wwtcLadderFromTrack($row['track_id'] ?? null) : null;
        $custom = isset($ladders[$uid]) ? wwtcPublicCustomLadder($ladders[$uid]) : null;
        $out[] = [
            'id' => $uid,
            'name' => trim(((string) ($row['first'] ?? '')) . ' ' . ((string) ($row['last'] ?? ''))),
            'classId' => (int) $row['class_id'],
            'className' => $sub !== '' ? ($grade . '-' . $sub) : $grade,
            'grade' => wwtcGradeKeyFrom($grade),
            'ladder' => $ladder,
            'customLadder' => $custom,
        ];
    }
    return $out;
}
