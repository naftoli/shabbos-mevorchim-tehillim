<?php

declare(strict_types=1);

/**
 * Flagged-entry storage. Requires bootstrap (PDO, wwtcColumnExists) and
 * marking.php (wwtcApplyMark). The SQL file is api/sql/wwtc_flagged_entries.sql;
 * this code never runs it.
 */

function wwtcFlagsReady(): bool
{
    return function_exists('wwtcColumnExists') && wwtcColumnExists('wwtc_flagged_entries', 'status');
}

function wwtcPriorMark(PDO $db, int $userId, int $date): array
{
    $out = ['kapitlach' => 0, 'minutes' => 0, 'reported' => false];
    $stmt = $db->prepare(
        'SELECT dt.grid_id, MAX(dtm.done_qty) qty
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions m USING (date_tasks_mission_id)
          WHERE dtm.user_id = :uid AND m.start_date = :d AND m.end_date = :d
            AND m.subject_id = ' . WWTC_SUBJECT_ID . '
            AND dt.grid_id IN (' . WWTC_GRID_KAPITELACH . ', ' . WWTC_GRID_MINUTES . ')
          GROUP BY dt.grid_id'
    );
    $stmt->execute([':uid' => $userId, ':d' => $date]);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $out['reported'] = true;
        if ((int) $row['grid_id'] === WWTC_GRID_KAPITELACH) {
            $out['kapitlach'] = (int) $row['qty'];
        } else {
            $out['minutes'] = (int) $row['qty'];
        }
    }
    return $out;
}

function wwtcInsertFlagDecision(PDO $db, int $entryId, array $record): void
{
    $stmt = $db->prepare(
        'INSERT INTO wwtc_flag_decisions
            (entry_id, action, actor_type, actor_id, actor_name, note)
         VALUES (:id, :action, :type, :actor, :name, :note)'
    );
    $stmt->execute([
        ':id' => $entryId,
        ':action' => $record['action'],
        ':type' => substr((string) $record['actor_type'], 0, 16),
        ':actor' => (int) $record['actor_id'],
        ':name' => substr((string) $record['actor_name'], 0, 255),
        ':note' => $record['note'] !== null ? substr((string) $record['note'], 0, 255) : null,
    ]);
}

/**
 * Insert or replace the open flag for this soldier and Shabbos Mevorchim.
 * Does not write date_tasks_marks. Returns the entry id.
 */
function wwtcSaveFlaggedEntry(PDO $db, array $fields, array $actor): int
{
    $find = $db->prepare(
        'SELECT id FROM wwtc_flagged_entries
          WHERE user_id = :uid AND mark_date = :d AND status = \'flagged\'
          ORDER BY id DESC LIMIT 1'
    );
    $find->execute([':uid' => (int) $fields['user_id'], ':d' => (int) $fields['mark_date']]);
    $existing = $find->fetchColumn();
    $reasons = implode(',', $fields['reasons']);

    if ($existing) {
        $id = (int) $existing;
        $db->prepare(
            'UPDATE wwtc_flagged_entries
                SET kapitlach = :kap, minutes = :min, quota_kapitlach = :qk, quota_minutes = :qm,
                    threshold_kapitlach = :tk, threshold_minutes = :tm, reasons = :reasons,
                    grade = :grade, created_at = CURRENT_TIMESTAMP
              WHERE id = :id AND status = \'flagged\''
        )->execute([
            ':kap' => (int) $fields['kapitlach'],
            ':min' => (int) $fields['minutes'],
            ':qk' => (int) $fields['quota_kapitlach'],
            ':qm' => (int) $fields['quota_minutes'],
            ':tk' => (int) $fields['threshold_kapitlach'],
            ':tm' => (int) $fields['threshold_minutes'],
            ':reasons' => $reasons,
            ':grade' => substr((string) $fields['grade'], 0, 16),
            ':id' => $id,
        ]);
    } else {
        $db->prepare(
            'INSERT INTO wwtc_flagged_entries
                (user_id, school_id, class_id, mark_date, campaign_year, month_name, grade,
                 school_name, class_name, kid_name, kapitlach, minutes, quota_kapitlach, quota_minutes,
                 threshold_kapitlach, threshold_minutes, reasons, status,
                 prior_kapitlach, prior_minutes, prior_reported)
             VALUES
                (:uid, :school, :class, :date, :year, :month, :grade,
                 :schoolName, :className, :kid, :kap, :min, :qk, :qm,
                 :tk, :tm, :reasons, \'flagged\',
                 :priorKap, :priorMin, :priorReported)'
        )->execute([
            ':uid' => (int) $fields['user_id'],
            ':school' => (int) $fields['school_id'],
            ':class' => (int) $fields['class_id'],
            ':date' => (int) $fields['mark_date'],
            ':year' => (int) $fields['campaign_year'],
            ':month' => substr((string) $fields['month_name'], 0, 32),
            ':grade' => substr((string) $fields['grade'], 0, 16),
            ':schoolName' => substr((string) $fields['school_name'], 0, 255),
            ':className' => substr((string) $fields['class_name'], 0, 255),
            ':kid' => substr((string) $fields['kid_name'], 0, 255),
            ':kap' => (int) $fields['kapitlach'],
            ':min' => (int) $fields['minutes'],
            ':qk' => (int) $fields['quota_kapitlach'],
            ':qm' => (int) $fields['quota_minutes'],
            ':tk' => (int) $fields['threshold_kapitlach'],
            ':tm' => (int) $fields['threshold_minutes'],
            ':reasons' => $reasons,
            ':priorKap' => (int) $fields['prior_kapitlach'],
            ':priorMin' => (int) $fields['prior_minutes'],
            ':priorReported' => !empty($fields['prior_reported']) ? 1 : 0,
        ]);
        $id = (int) $db->lastInsertId();
    }

    wwtcInsertFlagDecision($db, $id, wwtcDecisionRecord('flagged', $actor, gmdate('c')));
    return $id;
}

/** A corrected, inside-the-line report voids an open flag for that month. */
function wwtcSupersedeOpenFlag(PDO $db, int $userId, int $date, array $actor): void
{
    if (!wwtcFlagsReady()) {
        return;
    }
    $find = $db->prepare(
        'SELECT id FROM wwtc_flagged_entries
          WHERE user_id = :uid AND mark_date = :d AND status = \'flagged\''
    );
    $find->execute([':uid' => $userId, ':d' => $date]);
    $ids = $find->fetchAll(PDO::FETCH_COLUMN);
    if (!$ids) {
        return;
    }
    $upd = $db->prepare('UPDATE wwtc_flagged_entries SET status = \'removed\' WHERE id = :id AND status = \'flagged\'');
    foreach ($ids as $id) {
        $upd->execute([':id' => (int) $id]);
        wwtcInsertFlagDecision(
            $db,
            (int) $id,
            wwtcDecisionRecord('removed', $actor, gmdate('c'), 'Corrected with a report inside the limit.')
        );
    }
}

function wwtcFlagDecisions(PDO $db, array $ids): array
{
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (!$ids) {
        return [];
    }
    $in = implode(',', $ids);
    $rows = $db->query(
        'SELECT entry_id, action, actor_type, actor_id, actor_name, note, created_at
           FROM wwtc_flag_decisions WHERE entry_id IN (' . $in . ') ORDER BY id ASC'
    )->fetchAll(PDO::FETCH_ASSOC);
    $by = [];
    foreach ($rows as $row) {
        $by[(int) $row['entry_id']][] = [
            'action' => $row['action'],
            'actorType' => $row['actor_type'],
            'actorId' => (int) $row['actor_id'],
            'actorName' => $row['actor_name'],
            'note' => $row['note'],
            'at' => $row['created_at'],
        ];
    }
    return $by;
}

function wwtcPublicFlag(array $row, array $decisions = []): array
{
    $reasons = array_values(array_filter(explode(',', (string) ($row['reasons'] ?? ''))));
    return [
        'id' => (int) $row['id'],
        'status' => $row['status'],
        'userId' => (int) $row['user_id'],
        'schoolId' => (int) $row['school_id'],
        'classId' => (int) $row['class_id'],
        'markDate' => (int) $row['mark_date'],
        'year' => (int) $row['campaign_year'],
        'month' => $row['month_name'],
        'grade' => $row['grade'],
        'schoolName' => $row['school_name'],
        'className' => $row['class_name'],
        'kidName' => $row['kid_name'],
        'kapitlach' => (int) $row['kapitlach'],
        'minutes' => (int) $row['minutes'],
        'quotaKapitlach' => (int) $row['quota_kapitlach'],
        'quotaMinutes' => (int) $row['quota_minutes'],
        'thresholdKapitlach' => (int) $row['threshold_kapitlach'],
        'thresholdMinutes' => (int) $row['threshold_minutes'],
        'reasons' => $reasons,
        'priorKapitlach' => (int) $row['prior_kapitlach'],
        'priorMinutes' => (int) $row['prior_minutes'],
        'priorReported' => !empty($row['prior_reported']),
        'counts' => wwtcCountsInPublicTotals($row['status']),
        'createdAt' => $row['created_at'],
        'decisions' => $decisions,
    ];
}

function wwtcFlagById(int $id): ?array
{
    global $MASHPIA_DB;
    if (!wwtcFlagsReady() || $id <= 0) {
        return null;
    }
    $stmt = $MASHPIA_DB->prepare('SELECT * FROM wwtc_flagged_entries WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function wwtcOpenFlag(int $userId, int $date): ?array
{
    global $MASHPIA_DB;
    if (!wwtcFlagsReady() || $userId <= 0) {
        return null;
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT * FROM wwtc_flagged_entries
          WHERE user_id = :uid AND mark_date = :d AND status = \'flagged\'
          ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([':uid' => $userId, ':d' => $date]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }
    $decisions = wwtcFlagDecisions($MASHPIA_DB, [(int) $row['id']]);
    return wwtcPublicFlag($row, $decisions[(int) $row['id']] ?? []);
}

/**
 * @param int[]|null $schoolIds null = every school (HQ). Empty = nothing.
 */
function wwtcListFlags(?array $schoolIds): array
{
    global $MASHPIA_DB;
    if (!wwtcFlagsReady()) {
        return ['ready' => false, 'pending' => [], 'recent' => []];
    }
    $where = '';
    if ($schoolIds !== null) {
        $ids = array_values(array_filter(array_map('intval', $schoolIds)));
        if (!$ids) {
            return ['ready' => true, 'pending' => [], 'recent' => []];
        }
        $where = ' AND school_id IN (' . implode(',', $ids) . ')';
    }
    $pendingRows = $MASHPIA_DB->query(
        'SELECT * FROM wwtc_flagged_entries WHERE status = \'flagged\'' . $where . ' ORDER BY created_at ASC, id ASC'
    )->fetchAll(PDO::FETCH_ASSOC);
    $recentRows = $MASHPIA_DB->query(
        'SELECT * FROM wwtc_flagged_entries WHERE status IN (\'accepted\', \'removed\')' . $where . ' ORDER BY updated_at DESC, id DESC LIMIT 20'
    )->fetchAll(PDO::FETCH_ASSOC);
    $ids = [];
    foreach (array_merge($pendingRows, $recentRows) as $row) {
        $ids[] = (int) $row['id'];
    }
    $decisions = wwtcFlagDecisions($MASHPIA_DB, $ids);
    $map = static function ($row) use ($decisions) {
        return wwtcPublicFlag($row, $decisions[(int) $row['id']] ?? []);
    };
    return [
        'ready' => true,
        'pending' => array_map($map, $pendingRows),
        'recent' => array_map($map, $recentRows),
    ];
}

function wwtcFlagTasks(PDO $db, array $kid, int $date): array
{
    $missionStmt = $db->prepare(
        'SELECT date_tasks_mission_id FROM date_tasks_missions
          WHERE subject_id = ' . WWTC_SUBJECT_ID . '
            AND start_date = :d AND end_date = :d AND school_type_id = :st
            AND track_id = :track AND level = :lvl AND lang_id = :lang
          LIMIT 1'
    );
    $missionStmt->execute([
        ':d' => $date,
        ':st' => (int) $kid['school_type_id'],
        ':track' => (int) $kid['track_id'],
        ':lvl' => (int) $kid['level'],
        ':lang' => (int) $kid['lang_id'],
    ]);
    $missionId = (int) ($missionStmt->fetchColumn() ?: 0);
    if (!$missionId) {
        return [];
    }
    $taskStmt = $db->prepare(
        'SELECT date_task_id, grid_id, quantity, description, points
           FROM date_tasks WHERE date_tasks_mission_id = :mid
            AND grid_id IN (' . WWTC_GRID_KAPITELACH . ', ' . WWTC_GRID_MINUTES . ')'
    );
    $taskStmt->execute([':mid' => $missionId]);
    $by = [];
    foreach ($taskStmt->fetchAll(PDO::FETCH_ASSOC) as $t) {
        $by[(int) $t['grid_id']] = $t;
    }
    return $by;
}

/**
 * Accept or remove one flagged row and apply the counting mark that follows
 * (the reviewed numbers, or the prior value / a cleared month).
 */
function wwtcReviewStoredFlag(int $entryId, string $action, array $actor): array
{
    global $MASHPIA_DB;
    $entry = wwtcFlagById($entryId);
    if (!$entry) {
        return ['ok' => false, 'status' => 404, 'error' => 'Flagged entry not found.'];
    }
    $plan = wwtcPlanReview($entry, $action, $actor, gmdate('c'));
    if (!$plan['ok']) {
        return ['ok' => false, 'status' => 409, 'error' => $plan['error']];
    }
    $kid = wwtcKidByUserId((int) $entry['user_id']);
    if (!$kid || empty($kid['track_id'])) {
        return ['ok' => false, 'status' => 404, 'error' => 'Soldier not found.'];
    }
    $date = (int) $entry['mark_date'];
    $tasks = wwtcFlagTasks($MASHPIA_DB, $kid, $date);
    if (!$tasks) {
        return ['ok' => false, 'status' => 409, 'error' => 'There is no Tehillim mission for that month anymore.'];
    }

    try {
        $MASHPIA_DB->beginTransaction();
        $fresh = wwtcFlagById($entryId);
        if (!$fresh || $fresh['status'] !== 'flagged') {
            $MASHPIA_DB->rollBack();
            return ['ok' => false, 'status' => 409, 'error' => 'This entry is not waiting for review.'];
        }
        if (isset($tasks[WWTC_GRID_KAPITELACH])) {
            wwtcApplyMark($MASHPIA_DB, (int) $kid['user_id'], $date, $tasks[WWTC_GRID_KAPITELACH], (int) $plan['applyKapitlach'], true);
        }
        if (isset($tasks[WWTC_GRID_MINUTES])) {
            wwtcApplyMark($MASHPIA_DB, (int) $kid['user_id'], $date, $tasks[WWTC_GRID_MINUTES], (int) $plan['applyMinutes'], false);
        }
        $MASHPIA_DB->prepare('UPDATE wwtc_flagged_entries SET status = :status WHERE id = :id')
            ->execute([':status' => $plan['status'], ':id' => $entryId]);
        wwtcInsertFlagDecision($MASHPIA_DB, $entryId, $plan['decision']);
        $MASHPIA_DB->commit();
    } catch (Throwable $e) {
        if ($MASHPIA_DB->inTransaction()) {
            $MASHPIA_DB->rollBack();
        }
        error_log('WWTC flag review failed for entry ' . $entryId . ': ' . $e->getMessage());
        return ['ok' => false, 'status' => 500, 'error' => 'Could not save that decision. Please try again.'];
    }

    if (class_exists('Cache')) {
        Cache::bumpVersion('shabbos_mevorchim:v');
    }
    $saved = wwtcFlagById($entryId);
    $decisions = $saved ? wwtcFlagDecisions($MASHPIA_DB, [$entryId]) : [];
    return [
        'ok' => true,
        'status' => 200,
        'entry' => $saved ? wwtcPublicFlag($saved, $decisions[$entryId] ?? []) : null,
    ];
}
