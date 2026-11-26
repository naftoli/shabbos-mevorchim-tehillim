<?php

declare(strict_types=1);

/**
 * Ladder switches. The closest setting wins: child, then class, then school.
 * No setting at any level leaves the ladder on.
 *
 * School rows live in wwtc_school_ladders (api/sql/wwtc_school_ladders.sql).
 * No school row means the ladder is on. A row with enabled = 0 hides it for
 * the whole school. A missing table reads as every ladder on, so the site
 * keeps working before that migration is run.
 *
 * Class and child rows live in wwtc_class_ladders and wwtc_child_ladders
 * (api/sql/wwtc_ladder_scopes.sql). No row there means "inherit". enabled = 1
 * is an explicit on, enabled = 0 is an explicit off, so a class can turn a
 * school-off ladder back on and a child can turn a class-off ladder back on.
 * A missing pair of tables reads as no overrides. Saving a class or child
 * switch then asks HQ to run that file. The custom ladder is not stored here.
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

/**
 * Explicit enabled flag. null means "inherit" (do not store a row).
 *
 * @param mixed $value
 */
function wwtcOverrideBool($value): ?bool
{
    if ($value === true || $value === 1 || $value === '1' || $value === 'true') {
        return true;
    }
    if ($value === false || $value === 0 || $value === '0' || $value === 'false') {
        return false;
    }
    return null;
}

/**
 * Explicit class or child rows. The last row for the same id and ladder wins.
 * An inherit (null enabled) is dropped. Unknown ladders and empty ids are dropped.
 *
 * @param mixed $raw
 * @return list<array{id:int,ladder:int,enabled:bool}>
 */
function wwtcNormalizeScopeRows($raw, string $idKey): array
{
    $allowed = array_flip(wwtcLadderChoices());
    $byKey = [];
    foreach ((array) $raw as $row) {
        if (!is_array($row)) {
            continue;
        }
        $id = $row[$idKey] ?? $row['id'] ?? null;
        if ($id === null || $id === '' || !is_numeric($id)) {
            continue;
        }
        $id = (int) $id;
        $ladder = (int) ($row['ladder'] ?? 0);
        if ($id <= 0 || !isset($allowed[$ladder])) {
            continue;
        }
        $enabled = wwtcOverrideBool($row['enabled'] ?? null);
        if ($enabled === null) {
            continue;
        }
        $byKey[$id . ':' . $ladder] = ['id' => $id, 'ladder' => $ladder, 'enabled' => $enabled];
    }
    $out = array_values($byKey);
    usort($out, static function (array $a, array $b): int {
        return $a['id'] <=> $b['id'] ?: $a['ladder'] <=> $b['ladder'];
    });
    return $out;
}

/**
 * @param array<int,bool> $classSet ladder => explicit enabled
 * @param array<int,bool> $childSet
 * @param list<int> $schoolHidden
 */
function wwtcLadderOnForScope(int $ladder, array $schoolHidden, array $classSet = [], array $childSet = []): bool
{
    if (!in_array($ladder, wwtcLadderChoices(), true)) {
        return false;
    }
    if (array_key_exists($ladder, $childSet)) {
        return (bool) $childSet[$ladder];
    }
    if (array_key_exists($ladder, $classSet)) {
        return (bool) $classSet[$ladder];
    }
    return !wwtcLadderIsHidden($ladder, $schoolHidden);
}

/**
 * Ladders that are off for this scope, in picker order (12 down to 5).
 *
 * @param list<int> $schoolHidden
 * @param array<int,bool> $classSet
 * @param array<int,bool> $childSet
 * @return list<int>
 */
function wwtcHiddenForScope(array $schoolHidden, array $classSet = [], array $childSet = []): array
{
    $out = [];
    foreach (wwtcLadderChoices() as $ladder) {
        if (!wwtcLadderOnForScope($ladder, $schoolHidden, $classSet, $childSet)) {
            $out[] = $ladder;
        }
    }
    return $out;
}

function wwtcLadderScopesReady(): bool
{
    return function_exists('wwtcColumnExists')
        && wwtcColumnExists('wwtc_class_ladders', 'ladder')
        && wwtcColumnExists('wwtc_child_ladders', 'ladder');
}

/**
 * @return array<int,bool> ladder => enabled. No table and no rows mean none.
 */
function wwtcClassLadderMap(int $schoolId, int $classId): array
{
    if ($schoolId <= 0 || $classId <= 0 || !wwtcLadderScopesReady()) {
        return [];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT ladder, enabled FROM wwtc_class_ladders WHERE school_id = :school AND class_id = :class'
        );
        $stmt->execute([':school' => $schoolId, ':class' => $classId]);
        return wwtcOverrideMapFromRows($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Throwable $e) {
        error_log('WWTC class ladder read failed: ' . $e->getMessage());
        return [];
    }
}

/**
 * @return array<int,bool>
 */
function wwtcChildLadderMap(int $schoolId, int $userId): array
{
    if ($schoolId <= 0 || $userId <= 0 || !wwtcLadderScopesReady()) {
        return [];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT ladder, enabled FROM wwtc_child_ladders WHERE school_id = :school AND user_id = :user'
        );
        $stmt->execute([':school' => $schoolId, ':user' => $userId]);
        return wwtcOverrideMapFromRows($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (Throwable $e) {
        error_log('WWTC child ladder read failed: ' . $e->getMessage());
        return [];
    }
}

/**
 * @param list<array<string,mixed>> $rows
 * @return array<int,bool>
 */
function wwtcOverrideMapFromRows(array $rows): array
{
    $allowed = array_flip(wwtcLadderChoices());
    $out = [];
    foreach ($rows as $row) {
        $ladder = (int) ($row['ladder'] ?? 0);
        if (!isset($allowed[$ladder])) {
            continue;
        }
        $out[$ladder] = (int) ($row['enabled'] ?? 0) === 1;
    }
    return $out;
}

/**
 * Ladders that are off for one soldier. A missing scope table inherits.
 * Pass 0 for a class or user id to stop at the broader scope (a class
 * assignment ignores child rows; a school assignment ignores both).
 *
 * @return list<int>
 */
function wwtcHiddenLaddersForSoldier(int $schoolId, int $classId = 0, int $userId = 0): array
{
    return wwtcHiddenForScope(
        wwtcHiddenLaddersForSchool($schoolId),
        wwtcClassLadderMap($schoolId, $classId),
        wwtcChildLadderMap($schoolId, $userId)
    );
}

function wwtcLadderOpenForScope(int $ladder, int $schoolId, int $classId = 0, int $userId = 0): bool
{
    return !wwtcLadderIsHidden($ladder, wwtcHiddenLaddersForSoldier($schoolId, $classId, $userId));
}

/**
 * @return list<array{id:int,name:string,grade:string}>
 */
function wwtcSchoolClassRows(int $schoolId): array
{
    if ($schoolId <= 0) {
        return [];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT class_id, class_grade, class_sub FROM classes WHERE school_id = :id ORDER BY class_grade, class_sub, class_id'
        );
        $stmt->execute([':id' => $schoolId]);
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $grade = (string) ($row['class_grade'] ?? '');
            $sub = trim((string) ($row['class_sub'] ?? ''));
            $raw = $sub !== '' ? ($grade . '-' . $sub) : $grade;
            $name = function_exists('wwtcFormatClassName') ? wwtcFormatClassName($raw) : $raw;
            $out[] = [
                'id' => (int) $row['class_id'],
                'name' => $name,
                'grade' => $grade,
            ];
        }
        return $out;
    } catch (Throwable $e) {
        error_log('WWTC class list read failed: ' . $e->getMessage());
        return [];
    }
}

/**
 * @return list<array{classId:int,ladder:int,enabled:bool}>
 */
function wwtcClassOverrideRows(int $schoolId): array
{
    if ($schoolId <= 0 || !wwtcLadderScopesReady()) {
        return [];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT class_id, ladder, enabled FROM wwtc_class_ladders WHERE school_id = :id'
        );
        $stmt->execute([':id' => $schoolId]);
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $ladder = (int) $row['ladder'];
            if (!in_array($ladder, wwtcLadderChoices(), true)) {
                continue;
            }
            $out[] = [
                'classId' => (int) $row['class_id'],
                'ladder' => $ladder,
                'enabled' => (int) $row['enabled'] === 1,
            ];
        }
        return $out;
    } catch (Throwable $e) {
        error_log('WWTC class ladder list failed: ' . $e->getMessage());
        return [];
    }
}

/**
 * Explicit child rows for one school. Ids only — never a name.
 *
 * @return list<array{userId:int,classId:int,ladder:int,enabled:bool}>
 */
function wwtcChildOverrideRows(int $schoolId): array
{
    if ($schoolId <= 0 || !wwtcLadderScopesReady()) {
        return [];
    }
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT o.user_id, u.class_id, o.ladder, o.enabled
               FROM wwtc_child_ladders o
               JOIN users u ON u.user_id = o.user_id AND u.school_id = o.school_id
              WHERE o.school_id = :id'
        );
        $stmt->execute([':id' => $schoolId]);
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $ladder = (int) $row['ladder'];
            if (!in_array($ladder, wwtcLadderChoices(), true)) {
                continue;
            }
            $out[] = [
                'userId' => (int) $row['user_id'],
                'classId' => (int) $row['class_id'],
                'ladder' => $ladder,
                'enabled' => (int) $row['enabled'] === 1,
            ];
        }
        return $out;
    } catch (Throwable $e) {
        error_log('WWTC child ladder list failed: ' . $e->getMessage());
        return [];
    }
}

/**
 * Admin payload. Class names are the same labels the school page already
 * shows. Child rows are ids and switches only — names stay on the staff
 * platoon roll.
 *
 * @return array<string,mixed>
 */
function wwtcSchoolLadderAdminPayload(int $schoolId): array
{
    $hidden = wwtcHiddenLaddersForSchool($schoolId);
    $byClass = [];
    foreach (wwtcClassOverrideRows($schoolId) as $row) {
        $byClass[$row['classId']][] = ['ladder' => $row['ladder'], 'enabled' => $row['enabled']];
    }
    $classes = [];
    foreach (wwtcSchoolClassRows($schoolId) as $class) {
        $classes[] = [
            'id' => $class['id'],
            'name' => $class['name'],
            'grade' => $class['grade'],
            'overrides' => $byClass[$class['id']] ?? [],
        ];
    }
    $byChild = [];
    foreach (wwtcChildOverrideRows($schoolId) as $row) {
        $uid = $row['userId'];
        if (!isset($byChild[$uid])) {
            $byChild[$uid] = [
                'id' => $uid,
                'classId' => $row['classId'],
                'overrides' => [],
            ];
        }
        $byChild[$uid]['overrides'][] = ['ladder' => $row['ladder'], 'enabled' => $row['enabled']];
    }
    return [
        'ok' => true,
        'schoolId' => $schoolId,
        'hiddenLadders' => $hidden,
        'ladders' => wwtcLadderSwitchList($hidden),
        'classes' => $classes,
        'children' => array_values($byChild),
    ];
}

/**
 * Replace class and child rows for one school. null leaves that table alone
 * so a school-only save keeps working before the scope tables exist.
 *
 * @param list<array{id:int,ladder:int,enabled:bool}>|null $classRows
 * @param list<array{id:int,ladder:int,enabled:bool}>|null $childRows
 * @param array<int,int> $classByUser user_id => current class_id
 */
function wwtcSaveLadderScopes(int $schoolId, ?array $classRows, ?array $childRows, array $classByUser = []): void
{
    global $MASHPIA_DB;
    if ($classRows !== null) {
        $del = $MASHPIA_DB->prepare('DELETE FROM wwtc_class_ladders WHERE school_id = :id');
        $del->execute([':id' => $schoolId]);
        if ($classRows) {
            $ins = $MASHPIA_DB->prepare(
                'INSERT INTO wwtc_class_ladders (school_id, class_id, ladder, enabled)
                 VALUES (:school, :class, :ladder, :enabled)'
            );
            foreach ($classRows as $row) {
                $ins->execute([
                    ':school' => $schoolId,
                    ':class' => $row['id'],
                    ':ladder' => $row['ladder'],
                    ':enabled' => $row['enabled'] ? 1 : 0,
                ]);
            }
        }
    }
    if ($childRows !== null) {
        $del = $MASHPIA_DB->prepare('DELETE FROM wwtc_child_ladders WHERE school_id = :id');
        $del->execute([':id' => $schoolId]);
        if ($childRows) {
            $ins = $MASHPIA_DB->prepare(
                'INSERT INTO wwtc_child_ladders (school_id, class_id, user_id, ladder, enabled)
                 VALUES (:school, :class, :user, :ladder, :enabled)'
            );
            foreach ($childRows as $row) {
                $classId = (int) ($classByUser[$row['id']] ?? 0);
                if ($classId <= 0) {
                    continue;
                }
                $ins->execute([
                    ':school' => $schoolId,
                    ':class' => $classId,
                    ':user' => $row['id'],
                    ':ladder' => $row['ladder'],
                    ':enabled' => $row['enabled'] ? 1 : 0,
                ]);
            }
        }
    }
}
