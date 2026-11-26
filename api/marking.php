<?php

declare(strict_types=1);

/**
 * Tehillim marking — the single-soldier write path, extracted so it can be unit
 * tested with a fake PDO (tests/php/MarkingTest). Pure functions: no DB
 * connection, no side effects at include time. Mirrors mark_tehillim2.php, the
 * production teacher tool, for grids 8001 (kapitelach) and 8002 (minutes).
 *
 * Requires the WWTC_SUBJECT_ID constant (defined in bootstrap.php, or by a test).
 */

if (!defined('WWTC_SUBJECT_ID')) {
    define('WWTC_SUBJECT_ID', 1);
}

/**
 * Reconcile a soldier's mission mark (date_tasks_mission_marks) for the kapitelach
 * task behind $taskId against a new done value — the medal/mission credit earned
 * when the month's quota is reached. Mirrors mark_tehillim2.php exactly:
 *  - $forceDelete (value cleared to 0): drop the mission mark outright.
 *  - otherwise: add it when value reaches quota and it is missing; remove it when
 *    value falls below quota and it is present.
 */
function wwtcReconcileMissionMark(PDO $db, int $userId, int $date, int $taskId, int $val, bool $forceDelete): void
{
    $stmt = $db->prepare(
        'SELECT dtmm.date_tasks_mission_id, dtmm.mission_name, dt.quantity
           FROM date_tasks_missions dtmm
           JOIN date_tasks dt USING (date_tasks_mission_id)
          WHERE dt.date_task_id = :tid LIMIT 1'
    );
    $stmt->execute([':tid' => $taskId]);
    $m = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$m) {
        return;
    }
    $missionId = (int) $m['date_tasks_mission_id'];
    $quota = (int) $m['quantity'];

    if ($forceDelete) {
        $db->prepare('DELETE FROM date_tasks_mission_marks WHERE user_id = :uid AND date_tasks_mission_id = :mid')
           ->execute([':uid' => $userId, ':mid' => $missionId]);
        return;
    }

    $has = $db->prepare('SELECT 1 FROM date_tasks_mission_marks WHERE user_id = :uid AND date_tasks_mission_id = :mid LIMIT 1');
    $has->execute([':uid' => $userId, ':mid' => $missionId]);
    $exists = (bool) $has->fetchColumn();

    if ($val >= $quota && !$exists) {
        $db->prepare(
            'INSERT IGNORE INTO date_tasks_mission_marks
                SET user_id = :uid, date_tasks_mission_id = :mid, mission_value = 1.0,
                    subject_id = ' . WWTC_SUBJECT_ID . ', mission_name = :name, mark_date = :d
                ON DUPLICATE KEY UPDATE mark_date = :d2'
        )->execute([':uid' => $userId, ':mid' => $missionId, ':name' => (string) $m['mission_name'], ':d' => $date, ':d2' => $date]);
    } elseif ($val < $quota && $exists) {
        $db->prepare('DELETE FROM date_tasks_mission_marks WHERE user_id = :uid AND date_tasks_mission_id = :mid')
           ->execute([':uid' => $userId, ':mid' => $missionId]);
    }
}

/**
 * Apply one grid's mark (kapitelach 8001 / minutes 8002) for a soldier on a date,
 * the single-soldier path of mark_tehillim2.php. Delete-by-grid then insert: it
 * clears any existing mark on this grid for the date (any ladder) and writes the
 * one new mark, keeping the kapitelach mission mark in sync. Runs inside the
 * caller's transaction.
 */
function wwtcApplyMark(PDO $db, int $userId, int $date, array $task, int $val, bool $isKapitlach): void
{
    $gridId = (int) $task['grid_id'];

    // Delete-by-grid, then insert. Clear ANY existing mark(s) on this grid for the
    // date (any ladder) before writing the one mark, so a re-mark, a second ladder's
    // row, or a concurrent double-submit can never leave two rows on the grid. This
    // replaces the old find-one-then-update/insert, which raced and left cross-ladder
    // duplicates.
    $db->prepare(
        'DELETE dtm FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
          WHERE dtm.user_id = :uid AND dtm.mark_date = :d AND dt.grid_id = :grid'
    )->execute([':uid' => $userId, ':d' => $date, ':grid' => $gridId]);

    if ($val > 0) {
        // Sets the same columns mark_tehillim2.php does; the other NOT NULL columns
        // (mark_quantity, mark_inactive, …) rely on their table defaults, so the DB
        // must not run in strict SQL mode — which it doesn't, as the teacher tool
        // inserts the same way in production.
        $db->prepare(
            'INSERT INTO date_tasks_marks
                SET date_task_id = :tid, user_id = :uid, mark_date = :d,
                    done_qty = :v, mark_description = :desc, mark_points = :points'
        )->execute([
            ':tid' => (int) $task['date_task_id'], ':uid' => $userId, ':d' => $date, ':v' => $val,
            ':desc' => (string) ($task['description'] ?? ''), ':points' => (float) ($task['points'] ?? 0),
        ]);
    }

    if ($isKapitlach) {
        // Reconcile this grid's mission mark against the new value; clearing to 0
        // force-deletes it. A mark left on a ladder the soldier moved off is cleaned
        // up by the reconcile cron (reconcile_tehillim_missions.php).
        wwtcReconcileMissionMark($db, $userId, $date, (int) $task['date_task_id'], $val, $val === 0);
    }
}
