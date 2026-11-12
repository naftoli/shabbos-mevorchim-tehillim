<?php

declare(strict_types=1);

/**
 * Login and parent-site handoff. Loaded by index.php with $method / $path set.
 */

// ---- authentication --------------------------------------------------------

if ($method === 'POST' && $path === '/soldier/login') {
    $input = wwtcInput();
    $serial = trim((string) ($input['serial'] ?? $input['id'] ?? ''));
    $dob = trim((string) ($input['dob'] ?? ''));
    if (!preg_match('/^\d+$/', $serial) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
        wwtcError('Enter a serial number and date of birth.', 422);
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT user_id FROM users WHERE user_serial = :serial AND dob = :dob AND user_registered > 0 LIMIT 1'
    );
    $stmt->execute([':serial' => $serial, ':dob' => $dob]);
    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        wwtcError('No soldier matches that serial number and date of birth.', 401);
    }
    $kid = wwtcKidBySerial($serial);
    if (!$kid) {
        wwtcError('No soldier matches that serial number and date of birth.', 401);
    }
    $token = wwtcIssueToken('kid', (int) $kid['user_id'], ['serial' => (string) $kid['user_serial']]);
    wwtcJson([
        'token' => $token,
        'expiresIn' => (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200),
        'soldier' => wwtcSafeKid($kid),
    ]);
}

/**
 * Parent site → SPA handoff, step one. The parent site holds the family's
 * mobile session, not the child's serial and date of birth, and asks for a
 * code that signs one of its own children in.
 *
 * The parent token arrives in the body rather than as a cookie on purpose:
 * the app's webview does not reliably carry cookies into a fresh page load.
 */
if ($method === 'POST' && $path === '/parent/handoff') {
    wwtcRateLimit('parent-handoff', 60, 900);
    $input = wwtcInput();
    $parentToken = trim((string) ($input['parent'] ?? ''));
    $childId = (string) ($input['child'] ?? '');
    if ($parentToken === '' || !preg_match('/^\d+$/', $childId)) {
        wwtcError('A parent session and a child are required.', 422);
    }
    $adminId = wwtcParentAdminId($parentToken);
    if (!wwtcParentOwnsChild($adminId, (int) $childId)) {
        wwtcError('That child is not on this parent account.', 404);
    }
    $kid = wwtcKidByUserId((int) $childId);
    if (!$kid) {
        wwtcError('That child is not registered for Tehillim.', 404);
    }
    wwtcJson([
        'code' => wwtcIssueHandoffCode((int) $kid['user_id']),
        'expiresIn' => WWTC_HANDOFF_TTL,
    ]);
}

/**
 * Parent site → SPA handoff, step two. The SPA trades the code from its URL
 * for the same kid session POST /soldier/login issues.
 */
if ($method === 'POST' && $path === '/soldier/handoff') {
    wwtcRateLimit('kid-handoff', 30, 900);
    $input = wwtcInput();
    $code = trim((string) ($input['code'] ?? ''));
    $payload = $code !== '' ? wwtcVerifySignedPayload($code) : null;
    if (!$payload || ($payload['type'] ?? '') !== 'handoff') {
        wwtcError('This sign-in link has expired. Please tap the button again.', 401);
    }
    $kid = wwtcKidByUserId((int) $payload['id']);
    if (!$kid) {
        wwtcError('That child is not registered for Tehillim.', 404);
    }
    $token = wwtcIssueToken('kid', (int) $kid['user_id'], ['serial' => (string) $kid['user_serial']]);
    wwtcJson([
        'token' => $token,
        'expiresIn' => (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200),
        'soldier' => wwtcSafeKid($kid),
    ]);
}

if ($method === 'POST' && $path === '/admin/login') {
    $input = wwtcInput();
    $username = trim((string) ($input['username'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    if (!$username || !$password) {
        wwtcError('Username and password are required.', 422);
    }
    $login = \mashpia\api\auth\Auth::login($username, $password);
    if (!$login) {
        wwtcError('That username or password is not correct.', 401);
    }
    // Auth::login returns the admin's session keys; adapt to the SPA's admin shape.
    $adminId = (int) ($login['admin_id'] ?? $login['id'] ?? 0);
    $stmt = $MASHPIA_DB->prepare('SELECT admin_id, auth, first, last, username FROM admins WHERE admin_id = :id LIMIT 1');
    $stmt->execute([':id' => $adminId]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    // A school admin's school isn't a column on `admins` — it's an admin_auths row
    // of type 'school' (the mapping Admin::getAuthIds('school') reads). Take the
    // first, matching the SPA's single-school admin shape; HQ ('super') has none.
    $schoolStmt = $MASHPIA_DB->prepare(
        "SELECT id FROM admin_auths WHERE admin_id = :id AND auth = 'school' ORDER BY id LIMIT 1"
    );
    $schoolStmt->execute([':id' => $adminId]);
    $schoolId = $schoolStmt->fetchColumn();
    $token = wwtcIssueToken('admin', $adminId, ['auth' => $admin['auth'] ?? '']);
    wwtcJson([
        'token' => $token,
        'expiresIn' => (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200),
        'admin' => [
            'kind' => ($admin['auth'] ?? '') === 'super' ? 'super' : 'school',
            'name' => trim(($admin['first'] ?? '') . ' ' . ($admin['last'] ?? '')),
            'username' => $admin['username'] ?? $username,
            'schoolId' => $schoolId !== false ? (int) $schoolId : null,
        ],
    ]);
}
