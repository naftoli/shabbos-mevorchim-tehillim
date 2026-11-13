<?php

declare(strict_types=1);

/**
 * Per-school ladder switches. No row means the ladder is on. A row with
 * enabled = 0 hides that ladder from the soldier's picker and from the
 * virtual commander's suggestions. The custom ladder is not stored here.
 *
 * The table is wwtc_school_ladders (api/sql/wwtc_school_ladders.sql). A missing
 * table reads as every ladder on, so the site keeps working before the
 * migration is run. Saving then asks HQ to run the file.
 */

/** @return list<int> Highest ladder first, matching the picker. */
function wwtcLadderChoices(): array
{
    return [12, 11, 10, 9, 8, 7, 6, 5];
}

/** @param mixed $raw @return list<int> */
function wwtcNormalizeHiddenLadders($raw): array
{
    $allowed = array_flip(wwtcLadderChoices());
    $out = [];
    foreach ((array) $raw as $value) {
        if (is_array($value)) {
            $enabled = $value['enabled'] ?? true;
            $off = $enabled === false || $enabled === 0 || $enabled === '0' || $enabled === 'false';
            if (!$off) {
                continue;
            }
            $value = $value['ladder'] ?? null;
        }
        $n = (int) $value;
        if (!isset($allowed[$n]) || in_array($n, $out, true)) {
            continue;
        }
        $out[] = $n;
    }
    sort($out);
    return $out;
}

/** @param list<int> $hidden @return list<int> */
function wwtcVisibleLadders(array $hidden): array
{
    $off = array_flip(wwtcNormalizeHiddenLadders($hidden));
    $out = [];
    foreach (wwtcLadderChoices() as $ladder) {
        if (!isset($off[$ladder])) {
            $out[] = $ladder;
        }
    }
    return $out;
}

function wwtcLadderIsHidden(int $ladder, array $hidden): bool
{
    return !in_array($ladder, wwtcVisibleLadders($hidden), true);
}

/**
 * Switch list for the admin screen. Every ladder is present. enabled is true
 * unless that ladder is in $hidden.
 *
 * @param list<int> $hidden
 * @return list<array{ladder:int,enabled:bool}>
 */
function wwtcLadderSwitchList(array $hidden): array
{
    $off = array_flip(wwtcNormalizeHiddenLadders($hidden));
    $out = [];
    foreach (wwtcLadderChoices() as $ladder) {
        $out[] = ['ladder' => $ladder, 'enabled' => !isset($off[$ladder])];
    }
    return $out;
}

function wwtcSchoolLaddersReady(): bool
{
    return function_exists('wwtcColumnExists') && wwtcColumnExists('wwtc_school_ladders', 'ladder');
}

/** @return list<int> Hidden ladder numbers. No table and no rows mean none. */
function wwtcHiddenLaddersForSchool(int $schoolId): array
{
    if ($schoolId <= 0 || !wwtcSchoolLaddersReady()) {
        return [];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT ladder FROM wwtc_school_ladders WHERE school_id = :id AND enabled = 0'
        );
        $stmt->execute([':id' => $schoolId]);
        $raw = [];
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $ladder) {
            $raw[] = (int) $ladder;
        }
        return wwtcNormalizeHiddenLadders($raw);
    } catch (Throwable $e) {
        error_log('WWTC school ladder read failed: ' . $e->getMessage());
        return [];
    }
}

/** @param list<int> $hidden */
function wwtcSaveHiddenLadders(int $schoolId, array $hidden): void
{
    global $MASHPIA_DB;
    $hidden = wwtcNormalizeHiddenLadders($hidden);
    $del = $MASHPIA_DB->prepare('DELETE FROM wwtc_school_ladders WHERE school_id = :id');
    $del->execute([':id' => $schoolId]);
    if (!$hidden) {
        return;
    }
    $ins = $MASHPIA_DB->prepare(
        'INSERT INTO wwtc_school_ladders (school_id, ladder, enabled)
         VALUES (:id, :ladder, 0)'
    );
    foreach ($hidden as $ladder) {
        $ins->execute([':id' => $schoolId, ':ladder' => $ladder]);
    }
}
