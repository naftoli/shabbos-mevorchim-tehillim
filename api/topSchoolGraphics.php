<?php

declare(strict_types=1);

/**
 * Top 10 school graphics for one Shabbos Mevorchim month.
 *
 * The place is the same competition rank as The Race and Schools, Ranked
 * (src/lib/schoolRace.js rankRace with the finished view): percent of soldiers
 * who met, then how many met, then the school name. Ties share a rank and the
 * next place skips. A shared place of 1–10 is the Top Base badge number.
 *
 * This is not wwtcCmpSchoolRace(). That order uses kapitlach and minutes
 * after the percent, and the badge on The Race does not.
 *
 * Student names are never read and never stored. The daily job draws with
 * wwtcRenderPlatoonGraphic(), the same renderer as a Perfect Platoon.
 */

function wwtcTopSchoolGraphicsTableReady(): bool
{
    if (!function_exists('wwtcColumnExists')) {
        return false;
    }
    return wwtcColumnExists('wwtc_top_school_graphics', 'rank_place');
}

function wwtcTopSchoolGraphicKey(array $row, int $year, string $month): string
{
    $schoolId = (string) ($row['schoolId'] ?? $row['school_id'] ?? $row['id'] ?? '');
    $y = (string) ($row['year'] ?? $row['campaign_year'] ?? $year);
    $m = wwtcNormalizeCampaignMonth((string) ($row['month'] ?? $row['month_name'] ?? $month));
    return strtolower($schoolId . "\n" . $y . "\n" . $m);
}

/**
 * Finished-view place, matching rankRace(..., 'finished').
 * Rows need pctMet, metMonth (or met), and name. Rank 11+ is dropped.
 * A tie on both numbers shares one rank, and every school on that rank
 * stays when the rank is 1–10.
 *
 * @param array<int,array<string,mixed>> $schools
 * @return array<int,array<string,mixed>>
 */
function wwtcTopTenFromRace(array $schools): array
{
    $rows = array_values($schools);
    usort($rows, static function ($a, $b) {
        $pct = ((float) ($b['pctMet'] ?? 0)) <=> ((float) ($a['pctMet'] ?? 0));
        if ($pct !== 0) {
            return $pct;
        }
        $met = ((float) ($b['metMonth'] ?? $b['met'] ?? 0)) <=> ((float) ($a['metMonth'] ?? $a['met'] ?? 0));
        if ($met !== 0) {
            return $met;
        }
        return strcmp(
            (string) ($a['name'] ?? $a['school_name'] ?? ''),
            (string) ($b['name'] ?? $b['school_name'] ?? '')
        );
    });
    $placed = [];
    $i = 0;
    $n = count($rows);
    while ($i < $n) {
        $j = $i + 1;
        while ($j < $n && wwtcRaceFinishedTie($rows[$i], $rows[$j])) {
            $j++;
        }
        $rank = $i + 1;
        if ($rank <= 10) {
            for ($k = $i; $k < $j; $k++) {
                $row = $rows[$k];
                $row['rank'] = $rank;
                $placed[] = $row;
            }
        }
        $i = $j;
    }
    return $placed;
}

function wwtcRaceFinishedTie(array $a, array $b): bool
{
    return (float) ($a['pctMet'] ?? 0) == (float) ($b['pctMet'] ?? 0)
        && (float) ($a['metMonth'] ?? $a['met'] ?? 0) == (float) ($b['metMonth'] ?? $b['met'] ?? 0);
}

/**
 * make: not in the ledger. redraw: rank changed, the file is missing, or
 * --rerender. skip: same rank and the file is already there.
 */
function wwtcTopSchoolAction(int $rank, ?array $ledger, bool $rerender, bool $fileExists): string
{
    if ($ledger === null) {
        return 'make';
    }
    $old = (int) ($ledger['rank_place'] ?? $ledger['rank'] ?? 0);
    if ($rerender || $old !== $rank || !$fileExists) {
        return 'redraw';
    }
    return 'skip';
}

/** A rank change means the badge number is different, so the sent mark is cleared. */
function wwtcTopSchoolClearsSent(string $action, int $oldRank, int $newRank): bool
{
    return $action === 'redraw' && $oldRank !== $newRank;
}

/**
 * @param array<int,array<string,mixed>> $topSchools
 * @param array<int,array<string,mixed>> $ledgerRows
 * @return array{targets:array<int,array<string,mixed>>,skipped:int}
 */
function wwtcTopSchoolWork(array $topSchools, array $ledgerRows, int $year, string $month, bool $rerender): array
{
    $byKey = [];
    foreach ($ledgerRows as $row) {
        $byKey[wwtcTopSchoolGraphicKey($row, $year, $month)] = $row;
    }
    $targets = [];
    $skipped = 0;
    foreach ($topSchools as $school) {
        $schoolId = (int) ($school['schoolId'] ?? $school['school_id'] ?? $school['id'] ?? 0);
        $rank = (int) ($school['rank'] ?? 0);
        if ($schoolId <= 0 || $rank < 1 || $rank > 10) {
            continue;
        }
        $key = wwtcTopSchoolGraphicKey([
            'school_id' => $schoolId,
            'year' => $year,
            'month' => $month,
        ], $year, $month);
        $ledger = isset($byKey[$key]) ? $byKey[$key] : null;
        $file = $ledger ? (string) ($ledger['file_path'] ?? '') : '';
        $fileExists = $file !== '' && is_file($file);
        $action = wwtcTopSchoolAction($rank, $ledger, $rerender, $fileExists);
        if ($action === 'skip') {
            $skipped++;
            continue;
        }
        $oldRank = $ledger ? (int) ($ledger['rank_place'] ?? $ledger['rank'] ?? 0) : 0;
        $targets[] = [
            'action' => $action,
            'schoolId' => $schoolId,
            'schoolName' => (string) ($school['name'] ?? $school['school_name'] ?? $school['school'] ?? ''),
            'rank' => $rank,
            'id' => $ledger ? (int) ($ledger['id'] ?? 0) : 0,
            'clearSent' => $ledger ? wwtcTopSchoolClearsSent($action, $oldRank, $rank) : false,
            'logo' => $school['logo'] ?? null,
        ];
    }
    return ['targets' => $targets, 'skipped' => $skipped];
}

function wwtcTopBaseBadgePath(int $rank): ?string
{
    if ($rank < 1 || $rank > 10) {
        return null;
    }
    $path = dirname(__DIR__) . '/public/design/top-base-' . $rank . '.webp';
    return is_file($path) ? $path : null;
}

function wwtcTopSchoolGraphicFilename(array $job): string
{
    $month = strtolower(str_replace(' ', '-', wwtcNormalizeCampaignMonth((string) ($job['month'] ?? ''))));
    $school = preg_replace('/\D+/', '', (string) ($job['schoolId'] ?? '0'));
    $rank = (int) ($job['rank'] ?? 0);
    return ($job['year'] ?? '0') . '-' . $month . '-' . $school . '-top-' . $rank . '.png';
}

/**
 * @param int[]|null $schoolIds
 * @return array<int,array<string,mixed>>
 */
function wwtcLoadTopSchoolGraphicRows(int $year, string $month, ?array $schoolIds): array
{
    if (!wwtcTopSchoolGraphicsTableReady()) {
        return [];
    }
    $month = wwtcNormalizeCampaignMonth($month);
    $db = wwtcPlatoonGraphicsPdo();
    $sql = 'SELECT id, school_id, school_name, campaign_year, month_name, rank_place, file_path, made_at, sent_at, sent_by
              FROM wwtc_top_school_graphics
             WHERE campaign_year = :y AND month_name = :m';
    $params = [':y' => $year, ':m' => $month];
    if ($schoolIds !== null) {
        if (!$schoolIds) {
            return [];
        }
        $in = [];
        foreach (array_values($schoolIds) as $i => $id) {
            $key = ':t' . $i;
            $in[] = $key;
            $params[$key] = (int) $id;
        }
        $sql .= ' AND school_id IN (' . implode(',', $in) . ')';
    }
    $sql .= ' ORDER BY rank_place, school_name, id';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/** @return array<int,array<string,mixed>> */
function wwtcLoadTaggedTopRows(int $year, string $month, ?array $schoolIds): array
{
    $rows = wwtcLoadTopSchoolGraphicRows($year, $month, $schoolIds);
    foreach ($rows as $i => $row) {
        $rows[$i]['kind'] = 'top10';
        $rows[$i]['class_name'] = '';
        $rows[$i]['grade'] = '';
        $rows[$i]['grade_label'] = '';
    }
    return $rows;
}

/** @return 'inserted'|'exists' */
function wwtcInsertTopSchoolGraphic(array $row): string
{
    $db = wwtcPlatoonGraphicsPdo();
    $stmt = $db->prepare(
        'INSERT INTO wwtc_top_school_graphics
            (school_id, school_name, campaign_year, month_name, rank_place, file_path)
         VALUES (:school, :name, :year, :month, :rank, :path)'
    );
    try {
        $stmt->execute([
            ':school' => (int) $row['school_id'],
            ':name' => (string) $row['school_name'],
            ':year' => (int) $row['year'],
            ':month' => (string) $row['month'],
            ':rank' => (int) $row['rank_place'],
            ':path' => (string) ($row['file_path'] ?? ''),
        ]);
    } catch (PDOException $e) {
        $mysql = (int) ($e->errorInfo[1] ?? 0);
        if ($mysql === 1062 || $e->getCode() === '23000') {
            return 'exists';
        }
        throw $e;
    }
    return 'inserted';
}

function wwtcUpdateTopSchoolGraphic(int $id, string $path, int $rank, bool $clearSent): void
{
    $db = wwtcPlatoonGraphicsPdo();
    $flag = $clearSent ? 1 : 0;
    $stmt = $db->prepare(
        'UPDATE wwtc_top_school_graphics
            SET file_path = :path,
                rank_place = :rank,
                sent_at = CASE WHEN :clear = 1 THEN NULL ELSE sent_at END,
                sent_by = CASE WHEN :clear2 = 1 THEN NULL ELSE sent_by END
          WHERE id = :id'
    );
    $stmt->execute([
        ':path' => $path,
        ':rank' => $rank,
        ':clear' => $flag,
        ':clear2' => $flag,
        ':id' => $id,
    ]);
}

function wwtcMarkSchoolTopGraphicsSent(int $schoolId, string $who, int $year, string $month): int
{
    if (!wwtcTopSchoolGraphicsTableReady()) {
        return 0;
    }
    $db = wwtcPlatoonGraphicsPdo();
    $stmt = $db->prepare(
        'UPDATE wwtc_top_school_graphics
            SET sent_at = CURRENT_TIMESTAMP, sent_by = :who
          WHERE school_id = :school AND campaign_year = :y AND month_name = :m AND sent_at IS NULL'
    );
    $stmt->execute([
        ':who' => $who,
        ':school' => $schoolId,
        ':y' => $year,
        ':m' => wwtcNormalizeCampaignMonth($month),
    ]);
    return $stmt->rowCount();
}

/**
 * @param int[] $ids
 * @param int[]|null $schoolIds
 */
function wwtcSetTopSchoolGraphicsSent(array $ids, bool $sent, string $who, int $year, string $month, ?array $schoolIds): int
{
    if (!wwtcTopSchoolGraphicsTableReady()) {
        return 0;
    }
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (!$ids) {
        return 0;
    }
    $db = wwtcPlatoonGraphicsPdo();
    $flag = $sent ? 1 : 0;
    $params = [':sent' => $flag, ':sent2' => $flag, ':who' => $who, ':y' => $year, ':m' => wwtcNormalizeCampaignMonth($month)];
    $in = [];
    foreach ($ids as $i => $id) {
        $key = ':id' . $i;
        $in[] = $key;
        $params[$key] = $id;
    }
    $sql = 'UPDATE wwtc_top_school_graphics
               SET sent_at = CASE WHEN :sent = 1 THEN COALESCE(sent_at, CURRENT_TIMESTAMP) ELSE NULL END,
                   sent_by = CASE WHEN :sent2 = 1 THEN :who ELSE NULL END
             WHERE id IN (' . implode(',', $in) . ')
               AND campaign_year = :y AND month_name = :m';
    if ($schoolIds !== null) {
        if (!$schoolIds) {
            return 0;
        }
        $scope = [];
        foreach (array_values($schoolIds) as $i => $sid) {
            $key = ':sc' . $i;
            $scope[] = $key;
            $params[$key] = (int) $sid;
        }
        $sql .= ' AND school_id IN (' . implode(',', $scope) . ')';
    }
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

/**
 * @param mixed $ids
 * @return array{0:array<int,int>,1:array<int,int>}
 */
function wwtcSplitGraphicIds($ids): array
{
    $platoon = [];
    $top = [];
    if (!is_array($ids)) {
        return [$platoon, $top];
    }
    foreach ($ids as $id) {
        $text = trim((string) $id);
        if (preg_match('/^top-(\d+)$/', $text, $m)) {
            $top[] = (int) $m[1];
            continue;
        }
        $n = (int) $text;
        if ($n > 0 && (string) $n === $text) {
            $platoon[] = $n;
        }
    }
    return [$platoon, $top];
}

function wwtcTopGraphicPublicUrl(int $id): string
{
    return wwtcGraphicsApiBase() . '/platoon-graphics/file/top-' . $id;
}

function wwtcServeTopSchoolGraphic(int $id): void
{
    if (!wwtcTopSchoolGraphicsTableReady()) {
        wwtcError('No Top 10 graphics have been posted yet.', 404);
    }
    $db = wwtcPlatoonGraphicsPdo();
    $stmt = $db->prepare(
        'SELECT file_path, school_name, rank_place, month_name, campaign_year
           FROM wwtc_top_school_graphics WHERE id = :id LIMIT 1'
    );
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $file = $row ? wwtcContainGraphicPath((string) $row['file_path']) : null;
    if (!$row || !$file) {
        wwtcError('That graphic is not on the server.', 404);
    }
    $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', (string) $row['month_name'] . '-' . $row['campaign_year'] . '-top-' . $row['rank_place']);
    header('Content-Type: image/png');
    header('Content-Length: ' . (string) filesize($file));
    header('Content-Disposition: inline; filename="' . trim((string) $name, '-') . '.png"');
    header('Cache-Control: private, max-age=300');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

/**
 * @return array{targets:array<int,array<string,mixed>>,note:string,error:bool,summary:string}
 */
function wwtcPlanTopSchoolGraphics(int $year, string $month, int $jd, array $opts): array
{
    $plan = ['targets' => [], 'note' => '', 'error' => false, 'summary' => ''];
    if (!wwtcTopSchoolGraphicsTableReady()) {
        $plan['note'] = 'Top 10 school graphics are not installed. Run api/sql/wwtc_top_school_graphics.sql once on the mashpia database. Perfect Platoon graphics still run.';
        return $plan;
    }
    if (!function_exists('wwtcNationwideSchools')) {
        require_once __DIR__ . '/campaignBoard.php';
    }
    try {
        $schools = wwtcNationwideSchools($jd, $year);
    } catch (Throwable $e) {
        $plan['note'] = 'Top 10 graphics were not made: ' . $e->getMessage();
        $plan['error'] = true;
        return $plan;
    }
    $top = wwtcTopTenFromRace($schools);
    $existing = wwtcLoadTopSchoolGraphicRows($year, $month, null);
    $work = wwtcTopSchoolWork($top, $existing, $year, $month, !empty($opts['rerender']));
    $plan['targets'] = $work['targets'];
    $plan['summary'] = 'Top 10 schools ' . $month . ' ' . $year . ': ' . count($top)
        . ' in the top 10, ' . $work['skipped'] . ' unchanged, ' . count($work['targets']) . ' to draw.';
    return $plan;
}

/**
 * @param array<int,array<string,mixed>> $targets
 */
function wwtcDrawTopSchoolGraphics(array $targets, string $dir, string $month, int $year, string $background): int
{
    $failed = 0;
    $made = 0;
    foreach ($targets as $target) {
        $schoolId = (int) $target['schoolId'];
        $schoolName = (string) $target['schoolName'];
        $rank = (int) $target['rank'];
        $job = [
            'schoolId' => $schoolId,
            'schoolName' => $schoolName,
            'className' => '',
            'grade' => '',
            'classLabel' => 'Top 10 #' . $rank,
            'logoPath' => wwtcLocalLogoPath(isset($target['logo']) ? (string) $target['logo'] : null),
            'month' => $month,
            'year' => $year,
            'backgroundPath' => $background,
            'outPath' => $dir . '/' . wwtcTopSchoolGraphicFilename([
                'schoolId' => $schoolId,
                'month' => $month,
                'year' => $year,
                'rank' => $rank,
            ]),
            'kind' => 'top10',
            'rank' => $rank,
            'badgePath' => (string) (wwtcTopBaseBadgePath($rank) ?? ''),
            'width' => 1080,
            'height' => 1080,
        ];
        try {
            $written = wwtcRenderPlatoonGraphic($job);
            if ($target['action'] === 'redraw' && !empty($target['id'])) {
                wwtcUpdateTopSchoolGraphic((int) $target['id'], $written, $rank, !empty($target['clearSent']));
            } else {
                $status = wwtcInsertTopSchoolGraphic([
                    'school_id' => $schoolId,
                    'school_name' => $schoolName,
                    'year' => $year,
                    'month' => $month,
                    'rank_place' => $rank,
                    'file_path' => $written,
                ]);
                if ($status === 'exists') {
                    echo "already in the ledger {$schoolName} Top 10 #{$rank}\n";
                    continue;
                }
            }
            $made++;
            $verb = $target['action'] === 'redraw' ? 'redrew' : 'made';
            echo "{$verb} {$schoolName} Top 10 #{$rank} -> {$written} (" . wwtcPlatoonRendererId() . ")\n";
        } catch (Throwable $e) {
            $failed++;
            fwrite(STDERR, "FAILED {$schoolName} Top 10 #{$rank}: " . $e->getMessage() . "\n");
        }
    }
    if ($targets) {
        echo "Top 10 drew {$made}." . ($failed ? " {$failed} failed." : '') . "\n";
    }
    return $failed;
}
