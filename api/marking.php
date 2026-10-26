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
 * the single-soldier path of mark_tehillim2.php: update an existing mark, insert a
 * new one, or delete it when the value is cleared to 0, keeping the kapitelach
 * mission mark in sync. Runs inside the caller's transaction.
 */
function wwtcApplyMark(PDO $db, int $userId, int $date, array $task, int $val, bool $isKapitlach): void
{
    $gridId = (int) $task['grid_id'];

    // An existing mark on this grid for the date (any ladder's task row, as the
    // teacher tool looks it up) — the soldier may have a mark from another ladder.
    $find = $db->prepare(
        'SELECT dtm.date_task_id FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
          WHERE dtm.user_id = :uid AND dtm.mark_date = :d AND dt.grid_id = :grid
          LIMIT 1'
    );
    $find->execute([':uid' => $userId, ':d' => $date, ':grid' => $gridId]);
    $existing = $find->fetchColumn();

    if ($existing !== false) {
        $existingTaskId = (int) $existing;
        if ($val === 0) {
            $db->prepare('DELETE FROM date_tasks_marks WHERE date_task_id = :tid AND user_id = :uid AND mark_date = :d')
               ->execute([':tid' => $existingTaskId, ':uid' => $userId, ':d' => $date]);
            if ($isKapitlach) {
                wwtcReconcileMissionMark($db, $userId, $date, $existingTaskId, 0, true);
            }
        } else {
            $db->prepare('UPDATE date_tasks_marks SET done_qty = :v WHERE date_task_id = :tid AND user_id = :uid AND mark_date = :d')
               ->execute([':v' => $val, ':tid' => $existingTaskId, ':uid' => $userId, ':d' => $date]);
            if ($isKapitlach) {
                wwtcReconcileMissionMark($db, $userId, $date, $existingTaskId, $val, false);
            }
        }
        return;
    }

    if ($val > 0) {
        $db->prepare(
            'INSERT INTO date_tasks_marks
                SET date_task_id = :tid, user_id = :uid, mark_date = :d,
                    done_qty = :v, mark_description = :desc, mark_points = :points'
        )->execute([
            ':tid' => (int) $task['date_task_id'], ':uid' => $userId, ':d' => $date, ':v' => $val,
            ':desc' => (string) ($task['description'] ?? ''), ':points' => (float) ($task['points'] ?? 0),
        ]);
        if ($isKapitlach) {
            wwtcReconcileMissionMark($db, $userId, $date, (int) $task['date_task_id'], $val, false);
        }
    }
}
