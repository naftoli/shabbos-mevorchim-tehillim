<?php

/**
 * Who may see one class's student roll (names, ladder, "said X of Y").
 *
 * The public reports screen keeps the class summary: platoon name, how many
 * soldiers met the kapitlach quota, and the perfect-platoon star. It must not
 * receive the roll. Keep WWTC_PLATOON_ROLL_AUDIENCE in step with
 * PLATOON_ROLL_AUDIENCE in src/lib/decisions.js.
 *
 * 'staff' (the default) — HQ, that school's mashpia admin, and the class teacher.
 * 'hq' — HQ only.
 * 'off' — nobody.
 *
 * There is no teacher login in this API, and it does not read the mashpia.com
 * cookie session (bootstrap does not include header.php). The bearer from
 * POST /admin/login is the session that unlocks the roll:
 *
 *   - HQ: token type admin, auth super — every class
 *   - School admin: admin_auths auth 'school', id = school_id — that school's classes
 *   - Class teacher: admin_auths auth WWTC_CLASS_AUTH ('class'), id = class_id
 *     — that class only. classes.class_teacher is a display name, not a login.
 *   - A future token type 'teacher' with classId — that class only. Nothing
 *     issues this token yet; the SPA sends the admin token.
 */

const WWTC_PLATOON_ROLL_AUDIENCE = 'staff';

/** admin_auths.auth value whose id is a class_id. Parallel to auth 'school'. */
const WWTC_CLASS_AUTH = 'class';

function wwtcSameId($a, $b): bool
{
    if ($a === null || $b === null || $a === '' || $b === '') {
        return false;
    }
    if ((string) $a === '0' || (string) $b === '0') {
        return false;
    }
    return (string) $a === (string) $b;
}

/**
 * @param array|null $actor Bearer payload, or null for a public / soldier request.
 * @param int[] $adminSchoolIds school ids from admin_auths auth=school
 * @param int[] $adminClassIds class ids from admin_auths auth=class
 */
function wwtcCanSeePlatoonRoll($actor, int $classId, int $schoolId, array $adminSchoolIds = [], array $adminClassIds = []): bool
{
    if (WWTC_PLATOON_ROLL_AUDIENCE === 'off' || !is_array($actor)) {
        return false;
    }
    $type = (string) ($actor['type'] ?? '');
    $auth = (string) ($actor['auth'] ?? '');
    if ($type === 'admin' && $auth === 'super') {
        return true;
    }
    if (WWTC_PLATOON_ROLL_AUDIENCE === 'hq') {
        return false;
    }
    if ($type === 'admin') {
        foreach ($adminSchoolIds as $id) {
            if (wwtcSameId($id, $schoolId)) {
                return true;
            }
        }
        foreach ($adminClassIds as $id) {
            if (wwtcSameId($id, $classId)) {
                return true;
            }
        }
        return false;
    }
    if ($type === 'teacher') {
        if (!wwtcSameId($actor['classId'] ?? null, $classId)) {
            return false;
        }
        $ownSchool = $actor['schoolId'] ?? null;
        if ($ownSchool === null || $ownSchool === '') {
            return true;
        }
        return wwtcSameId($ownSchool, $schoolId);
    }
    return false;
}

/**
 * Who may set ladders for a WHOLE school: HQ (super) or that school's mashpia
 * admin (admin_auths auth 'school', id = school_id). A class-only teacher
 * (auth 'class') manages one class, not the school, so they go through
 * wwtcCanSeePlatoonRoll with the class id instead.
 *
 * @param array|null $actor Bearer payload.
 * @param int[] $adminSchoolIds school ids from admin_auths auth=school
 */
function wwtcCanManageSchool($actor, int $schoolId, array $adminSchoolIds = []): bool
{
    if (!is_array($actor) || ($actor['type'] ?? '') !== 'admin') {
        return false;
    }
    if (($actor['auth'] ?? '') === 'super') {
        return true;
    }
    foreach ($adminSchoolIds as $id) {
        if (wwtcSameId($id, $schoolId)) {
            return true;
        }
    }
    return false;
}

/** @return int[] */
function wwtcAdminAuthIds(int $adminId, string $auth): array
{
    global $MASHPIA_DB;
    if ($adminId <= 0 || !isset($MASHPIA_DB)) {
        return [];
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT id FROM admin_auths WHERE admin_id = :id AND auth = :auth'
        );
        $stmt->execute([':id' => $adminId, ':auth' => $auth]);
        $ids = [];
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $id) {
            $ids[] = (int) $id;
        }
        return $ids;
    } catch (Exception $e) {
        error_log('WWTC admin auth lookup failed: ' . $e->getMessage());
        return [];
    }
}

function wwtcRequireSchoolAdmin(int $schoolId): array
{
    $actor = wwtcRequireActor(['admin']);
    $ids = (($actor['auth'] ?? '') === 'super') ? [] : wwtcAdminAuthIds((int) $actor['id'], 'school');
    if (!wwtcCanManageSchool($actor, $schoolId, $ids)) {
        wwtcError('You do not have permission to perform this action.', 403);
    }
    return $actor;
}

/**
 * Public payload never includes the roll. Staff payload sets roll=true and rows.
 * Summary keys are class-level only (name, counts, perfect). Rows are the only
 * place student names and amounts go.
 */
function wwtcPlatoonResponse(array $summary, array $rows, bool $allowed): array
{
    unset($summary['rows'], $summary['roll']);
    $summary['roll'] = false;
    if ($allowed) {
        $summary['roll'] = true;
        $summary['rows'] = array_values($rows);
    }
    return $summary;
}
