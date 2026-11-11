<?php

declare(strict_types=1);

/**
 * Over-entry limits. Pure functions: the grade table is api/over-entry.json,
 * the one file HQ edits. No database. POST /me/report calls wwtcPlanReport
 * before it writes, so a client cannot skip the line by calling the API.
 *
 * Counting decision: a flagged report does not count in public totals, ranks,
 * Perfect Platoon, or medals until it is accepted. Removed is void. The
 * default is recorded as flaggedCountsBeforeReview=false in the JSON file.
 */

function wwtcOverEntryConfig(): array
{
    static $cfg;
    if ($cfg !== null) {
        return $cfg;
    }
    $raw = @file_get_contents(__DIR__ . '/over-entry.json');
    $parsed = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($parsed) || empty($parsed['grades']) || !is_array($parsed['grades'])) {
        // A broken file must not let a nonsense amount count. Pre-1A is the
        // strictest line in the shipped table.
        $parsed = [
            'kapitlachMultiple' => 2,
            'flaggedCountsBeforeReview' => false,
            'confirm' => 'Are you sure this is correct? It will be flagged to your base commander and to HQ, and it\'s being sent in a duch to the Rebbe.',
            'grades' => [
                'pre1a' => ['ladderTopKapitlach' => 46, 'minutes' => 170],
            ],
        ];
    }
    return $cfg = $parsed;
}

/** SPA grade key. "Pre-1A", "pre1a", and "1st" all map. '' when unknown. */
function wwtcNormalizeGradeKey(string $grade): string
{
    $g = strtolower(trim($grade));
    $g = str_replace([' ', '_', '-'], '', $g);
    if ($g === '') {
        return '';
    }
    if (strpos($g, 'pre') === 0) {
        return 'pre1a';
    }
    if (preg_match('/^(\d{1,2})/', $g, $m)) {
        $n = (int) $m[1];
        if ($n >= 1 && $n <= 12) {
            return (string) $n;
        }
    }
    return '';
}

function wwtcOverEntryLine(string $grade, int $quotaKap, int $quotaMin): array
{
    $cfg = wwtcOverEntryConfig();
    $key = wwtcNormalizeGradeKey($grade);
    $grades = $cfg['grades'];
    if ($key === '' || !isset($grades[$key])) {
        $key = 'pre1a';
    }
    $row = isset($grades[$key]) ? $grades[$key] : ['ladderTopKapitlach' => 46, 'minutes' => 170];
    $multiple = (float) ($cfg['kapitlachMultiple'] ?? 2);
    if ($multiple <= 0) {
        $multiple = 2;
    }
    $ladderTop = (float) ($row['ladderTopKapitlach'] ?? 46);
    $kapLine = max($multiple * $quotaKap, $ladderTop);
    return [
        'grade' => isset($grades[$key]) ? $key : 'pre1a',
        'kapitlach' => $kapLine,
        'minutes' => (float) ($row['minutes'] ?? 170),
        'ladderTopKapitlach' => $ladderTop,
        'quotaKapitlach' => $quotaKap,
        'quotaMinutes' => $quotaMin,
    ];
}

function wwtcOverEntryReasons(int $kapitlach, int $minutes, array $line): array
{
    $reasons = [];
    if ($kapitlach > $line['kapitlach']) {
        $reasons[] = 'kapitlach';
    }
    if ($minutes > $line['minutes']) {
        $reasons[] = 'minutes';
    }
    return $reasons;
}

/**
 * null / '' is an ordinary mark. 'accepted' counts. 'removed' is void.
 * 'flagged' counts only when the config explicitly says so (it does not).
 */
function wwtcCountsInPublicTotals($status): bool
{
    if ($status === null || $status === '' || $status === 'accepted') {
        return true;
    }
    if ($status === 'removed') {
        return false;
    }
    if ($status === 'flagged') {
        return !empty(wwtcOverEntryConfig()['flaggedCountsBeforeReview']);
    }
    return false;
}

/**
 * What to do with one self-report. 'confirm' writes nothing. 'flag' saves a
 * flagged row and, by default, does not write the counting mark. 'save'
 * writes the mark. flagConfirmed cannot force a normal amount into the queue,
 * and omitting it cannot make an over-entry count.
 */
function wwtcPlanReport(int $kapitlach, int $minutes, int $quotaKap, int $quotaMin, string $grade, bool $flagConfirmed): array
{
    $kapitlach = max(0, min(150, $kapitlach));
    $minutes = max(0, min(770, $minutes));
    $line = wwtcOverEntryLine($grade, $quotaKap, $quotaMin);
    $reasons = wwtcOverEntryReasons($kapitlach, $minutes, $line);
    if (!$reasons) {
        return [
            'action' => 'save',
            'reasons' => [],
            'line' => $line,
            'kapitlach' => $kapitlach,
            'minutes' => $minutes,
            'writeMark' => true,
            'counts' => true,
        ];
    }
    if (!$flagConfirmed) {
        return [
            'action' => 'confirm',
            'reasons' => $reasons,
            'line' => $line,
            'kapitlach' => $kapitlach,
            'minutes' => $minutes,
            'writeMark' => false,
            'counts' => false,
        ];
    }
    $counts = wwtcCountsInPublicTotals('flagged');
    return [
        'action' => 'flag',
        'reasons' => $reasons,
        'line' => $line,
        'kapitlach' => $kapitlach,
        'minutes' => $minutes,
        'writeMark' => $counts,
        'counts' => $counts,
    ];
}

function wwtcDecisionRecord(string $action, array $actor, string $at, $note = null): array
{
    return [
        'action' => $action,
        'actor_type' => (string) ($actor['type'] ?? ''),
        'actor_id' => (int) ($actor['id'] ?? 0),
        'actor_name' => (string) ($actor['name'] ?? ''),
        'created_at' => $at,
        'note' => $note,
    ];
}

/**
 * Accept copies the flagged numbers into the counting mark.
 * Remove restores the prior mark, or clears it when there was none
 * (the soldier is not counted for the month).
 */
function wwtcPlanReview(array $entry, string $action, array $actor, string $at): array
{
    if (($entry['status'] ?? '') !== 'flagged') {
        return ['ok' => false, 'error' => 'This entry is not waiting for review.'];
    }
    if ($action === 'accept') {
        return [
            'ok' => true,
            'status' => 'accepted',
            'applyKapitlach' => (int) $entry['kapitlach'],
            'applyMinutes' => (int) $entry['minutes'],
            'counts' => true,
            'publicKapitlach' => (int) $entry['kapitlach'],
            'notCounted' => false,
            'decision' => wwtcDecisionRecord('accepted', $actor, $at),
        ];
    }
    if ($action === 'remove') {
        $priorReported = !empty($entry['prior_reported']);
        $kap = $priorReported ? (int) ($entry['prior_kapitlach'] ?? 0) : 0;
        $min = $priorReported ? (int) ($entry['prior_minutes'] ?? 0) : 0;
        return [
            'ok' => true,
            'status' => 'removed',
            'applyKapitlach' => $kap,
            'applyMinutes' => $min,
            'counts' => false,
            'publicKapitlach' => $kap,
            'notCounted' => !$priorReported,
            'decision' => wwtcDecisionRecord('removed', $actor, $at),
        ];
    }
    return ['ok' => false, 'error' => 'Choose accept or remove.'];
}

/**
 * Kapitlach that may enter a total, a rank, a Perfect Platoon check, or a
 * medal. A flagged amount is withheld; the live (prior) mark is what counts.
 * An accepted amount is the reviewed number.
 */
function wwtcCountedKapitlach(int $liveMark, int $flaggedAmount, $status): int
{
    if ($status === 'flagged' && !wwtcCountsInPublicTotals('flagged')) {
        return $liveMark;
    }
    if ($status === 'removed') {
        return $liveMark;
    }
    if ($status === 'accepted') {
        return $flaggedAmount;
    }
    return $liveMark;
}

function wwtcMissionEarned(int $liveMark, int $quota, int $flaggedAmount, $status): bool
{
    $said = wwtcCountedKapitlach($liveMark, $flaggedAmount, $status);
    return $quota > 0 && $said >= $quota;
}

function wwtcPlatoonIsPerfect(array $soldiers): bool
{
    if (!$soldiers) {
        return false;
    }
    foreach ($soldiers as $s) {
        $said = wwtcCountedKapitlach(
            (int) ($s['counted'] ?? 0),
            (int) ($s['flagged'] ?? 0),
            $s['status'] ?? null
        );
        $quota = (int) ($s['quota'] ?? 0);
        if ($quota <= 0 || $said < $quota) {
            return false;
        }
    }
    return true;
}
