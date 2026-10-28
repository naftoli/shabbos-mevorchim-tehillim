<?php

declare(strict_types=1);

/**
 * Worldwide Tehillim Club API — bootstrap.
 *
 * Mirrors the Mivtza Lulav API (../../mivtzoim/lulav/api/bootstrap.php): short,
 * signed bearer tokens over the existing Mashpia roster and admin accounts.
 * The campaign data itself comes from class.shabbosMevorchim.php — the same
 * class every WWTC report page uses (shabbos_mevorchim_hq.php, _by_class.php,
 * _by_student.php, battlefront/api/getWWTC.php) — so this API returns the same
 * numbers those reports show.
 *
 * Reads mirror the WWTC report pages. Writes are scoped by the bearer token to
 * the signed-in soldier's own record: POST /me/report (kapitlach/minutes marks,
 * the mark_tehillim2.php logic) and PUT /me/ladder (user_tracks.track_id). Only
 * dedications stay a 405 — the SPA keeps those client-side for now.
 */

define('WWTC_PUBLIC_ROOT', dirname(__DIR__, 2));
// Tehillim subject in user_tracks / date_tasks_missions.
const WWTC_SUBJECT_ID = 1;
// date_tasks.grid_id for the two tracked tasks.
const WWTC_GRID_KAPITELACH = 8001;
const WWTC_GRID_MINUTES = 8002;
// Shared roster predicate for the ancillary PDO counts (soldiers, classes,
// headcounts), so they all count the same population. Needs `schools s`,
// `classes c` and `users u` in scope. Campaign done/goal figures instead follow
// setASR()'s roster, to stay identical to the WWTC report pages.
const WWTC_ROSTER_WHERE = 's.school_era IS NULL AND c.class_era = 0 AND u.school_id NOT IN (82, 612)';

// Buffer the legacy includes: api/header/db.php and db.php print a plain-text
// message and exit() when MySQL is unreachable, which would otherwise reach the
// SPA as a 200 with an unparseable body. Turn any bail-out into a JSON 503.
$wwtcBootstrapped = false;
ob_start();
register_shutdown_function(static function () use (&$wwtcBootstrapped): void {
    if ($wwtcBootstrapped) {
        return;
    }
    $stray = '';
    while (ob_get_level() > 0) {
        $stray .= (string) ob_get_clean();
    }
    if ($stray !== '') {
        error_log('WWTC API bootstrap output: ' . trim($stray));
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(503);
    }
    echo '{"error":"The Tehillim API is temporarily unavailable. Please try again."}';
});

// ActiveRecord + $MASHPIA_DB (PDO) for Auth and soldier lookups.
require_once WWTC_PUBLIC_ROOT . '/api/header/db.php';
// Legacy functions ShabbosMevorchim needs: calculateSM() and the campaign
// helpers. (unixtojd()/jewishtojd()/jdtounix() are PHP calendar built-ins.)
require_once WWTC_PUBLIC_ROOT . '/db.php';
require_once WWTC_PUBLIC_ROOT . '/class.globalSettings.php';
require_once WWTC_PUBLIC_ROOT . '/class.shabbosMevorchim.php';
require_once WWTC_PUBLIC_ROOT . '/api/auth/classes/Auth.php';

$wwtcStrayOutput = (string) ob_get_clean();
if ($wwtcStrayOutput !== '') {
    error_log('WWTC API stray include output: ' . trim($wwtcStrayOutput));
}
$wwtcBootstrapped = true;

if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    exit('{"error":"The Tehillim API is temporarily unavailable. Please try again."}');
}
$MASHPIA_DB->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function wwtcEnv(string $name, string $default = ''): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        $value = $_SERVER[$name] ?? $_ENV[$name] ?? $default;
    }
    return (string) $value;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Vary: Origin');

$wwtcOrigin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
$wwtcHost = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';
$wwtcAllowed = array_filter(array_map('trim', explode(',', wwtcEnv('WWTC_ALLOWED_ORIGINS'))));
$wwtcOriginHost = $wwtcOrigin ? (string) parse_url($wwtcOrigin, PHP_URL_HOST) : '';
if ($wwtcOrigin && ($wwtcOriginHost === $wwtcHost || in_array($wwtcOrigin, $wwtcAllowed, true))) {
    header('Access-Control-Allow-Origin: ' . $wwtcOrigin);
}
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function wwtcJson($data, int $status = 200): void
{
    http_response_code($status);
    $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    $json = json_encode($data, $flags);
    if ($json === false) {
        http_response_code(500);
        echo '{"error":"The request could not be completed."}';
        exit;
    }
    echo $json;
    exit;
}

function wwtcError(string $message, int $status = 400, array $details = []): void
{
    wwtcJson(array_merge(['error' => $message], $details), $status);
}

function wwtcInput(): array
{
    static $input;
    if ($input !== null) {
        return $input;
    }
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? (string) $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($contentType, 'application/json') !== false) {
        $decoded = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($decoded)) {
            wwtcError('The request body must contain valid JSON.');
        }
        return $input = $decoded;
    }
    return $input = $_POST;
}

function wwtcBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (preg_match('/^Bearer\s+(.+)$/i', trim((string) $header), $matches)) {
        return trim($matches[1]);
    }
    return null;
}

function wwtcBase64UrlEncode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function wwtcBase64UrlDecode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding) {
        $value .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

function wwtcSigningSecret(): string
{
    $secret = '';
    if (defined('WWTC_TOKEN_SECRET')) {
        $secret = (string) WWTC_TOKEN_SECRET;
    }
    if (strlen($secret) < 32) {
        $secret = wwtcEnv('WWTC_TOKEN_SECRET');
    }
    if (strlen($secret) < 32) {
        wwtcError('WWTC_TOKEN_SECRET must be configured with at least 32 characters.', 503);
    }
    return $secret;
}

function wwtcSignPayload(array $payload): string
{
    $encoded = wwtcBase64UrlEncode((string) json_encode($payload));
    $signature = hash_hmac('sha256', $encoded, wwtcSigningSecret(), true);
    return $encoded . '.' . wwtcBase64UrlEncode($signature);
}

function wwtcVerifySignedPayload(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return null;
    }
    [$encoded, $providedSignature] = $parts;
    $expected = wwtcBase64UrlEncode(hash_hmac('sha256', $encoded, wwtcSigningSecret(), true));
    if (!hash_equals($expected, $providedSignature)) {
        return null;
    }
    $payload = json_decode(wwtcBase64UrlDecode($encoded), true);
    if (!is_array($payload) || empty($payload['id']) || empty($payload['type']) || empty($payload['exp'])) {
        return null;
    }
    if ((int) $payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

function wwtcIssueToken(string $type, int $id, array $extra = []): string
{
    $ttl = (int) (wwtcEnv('WWTC_TOKEN_TTL') ?: 43200);
    return wwtcSignPayload(array_merge([
        'v' => 1,
        'type' => $type,
        'id' => $id,
        'iat' => time(),
        'exp' => time() + max(300, $ttl),
    ], $extra));
}

function wwtcActor(bool $required = true): ?array
{
    $token = wwtcBearerToken();
    if (!$token) {
        if ($required) {
            wwtcError('Authentication required.', 401);
        }
        return null;
    }
    $payload = wwtcVerifySignedPayload($token);
    if (!$payload || !in_array($payload['type'], ['kid', 'admin'], true)) {
        wwtcError('Invalid authentication token.', 401);
    }
    return $payload;
}

function wwtcRequireActor(array $types): array
{
    $actor = wwtcActor();
    if (!in_array($actor['type'], $types, true)) {
        wwtcError('You do not have permission to perform this action.', 403);
    }
    return $actor;
}

// ---- campaign calendar -----------------------------------------------------

/** Current Tehillim campaign year (GlobalSettings, e.g. 5787). */
function wwtcYear(): int
{
    static $year;
    if ($year === null) {
        $year = (int) GlobalSettings::getCurrentYear();
    }
    return $year;
}

/**
 * The campaign's Shabbos-Mevorchim dates for the year as [englishMonth => jd],
 * in calendar order, with Adar collapsed the way the class does (Adar/Adar II
 * only split in a leap year). English month spellings match the SPA's
 * ladders.js MONTHS, so the app can key straight off them.
 */
function wwtcMonthDates(): array
{
    static $dates;
    if ($dates !== null) {
        return $dates;
    }
    // SPA month spellings (ladders.js). The class uses "Cheshvon/Kisleiv/
    // Shevat/Tamuz"; normalize to the app's forms so JSON keys line up.
    $names = [
        0 => 'Tishrei', 1 => 'Cheshvan', 2 => 'Kislev', 3 => 'Teves',
        4 => 'Shvat', 5 => 'Adar', 6 => 'Adar II', 7 => 'Nissan',
        8 => 'Iyar', 9 => 'Sivan', 10 => 'Tammuz', 11 => 'Av', 12 => 'Elul',
    ];
    $sm = calculateSM(wwtcYear());
    $dates = [];
    foreach ($sm as $index => $jd) {
        if ($sm[6] != $sm[7] && $index == 5) {      // leap year: index 5 is Adar I
            $dates['Adar I'] = $jd;
            continue;
        } elseif ($sm[6] == $sm[7] && $index == 6) { // plain year: skip the duplicate
            continue;
        }
        $dates[$names[$index]] = $jd;
    }
    return $dates;
}

/** The most-recent Shabbos-Mevorchim jd (the month soldiers report now). */
function wwtcCurrentDate(): int
{
    $now = unixtojd();
    $current = null;
    foreach (wwtcMonthDates() as $jd) {
        if ($jd > $now) {
            break;
        }
        $current = $jd;
    }
    // Before the first Shabbos Mevorchim of the year, report on the first one.
    if ($current === null) {
        $all = array_values(wwtcMonthDates());
        $current = $all[0] ?? $now;
    }
    return (int) $current;
}

/** English month name for a Shabbos-Mevorchim jd, '' if unknown. */
function wwtcMonthForDate(int $jd): string
{
    $month = array_search($jd, wwtcMonthDates(), true);
    return $month === false ? '' : (string) $month;
}

/** The elapsed months this year, oldest first: [ ['month'=>, 'jd'=>], ... ]. */
function wwtcElapsedMonths(): array
{
    $now = unixtojd();
    $out = [];
    foreach (wwtcMonthDates() as $month => $jd) {
        if ($jd > $now) {
            break;
        }
        $out[] = ['month' => $month, 'jd' => (int) $jd];
    }
    return $out;
}

/**
 * The Shabbos-Mevorchim jd for an elapsed-month index (the SPA's monthIdx, 0 =
 * first elapsed month). Out of range or null falls back to the current month, so
 * reports default to "now" when no month is given.
 */
function wwtcDateForMonthIdx($idx): int
{
    if ($idx === null || $idx === '') {
        return wwtcCurrentDate();
    }
    $elapsed = wwtcElapsedMonths();
    $idx = (int) $idx;
    return isset($elapsed[$idx]) ? (int) $elapsed[$idx]['jd'] : wwtcCurrentDate();
}

/**
 * A ShabbosMevorchim configured for one report date (default: current month).
 * Shares one instance per date so a request that touches several endpoints does
 * not rebuild it. setArmyResults()/setSchoolResults() etc. are called by the
 * route handler that needs them.
 *
 * Always uses live date_tasks_marks (setUseLiveData) — the SPA needs current
 * numbers even after a tehillim_backups freeze; HQ report pages keep the default.
 */
function wwtcReport(?int $jd = null): ShabbosMevorchim
{
    static $byDate = [];
    $jd = $jd ?? wwtcCurrentDate();
    if (!isset($byDate[$jd])) {
        $obj = new ShabbosMevorchim(wwtcYear());
        $obj->setUseLiveData(true);
        $obj->setReportDates($jd);
        $byDate[$jd] = $obj;
    }
    return $byDate[$jd];
}

// ---- soldier lookup --------------------------------------------------------

/**
 * SPA ladder (5..12, the grade a soldier finishes training to say the whole
 * Tehillim by) <-> DB user_tracks.track_id. Ladder 12 = track 1, 11 = track 2,
 * ... 5 = track 8, so track_id = 13 - ladder and ladder = 13 - track_id. (Only
 * tracks 3..8 — ladders 10..5 — exist today; 11 and 12 come when 1 and 2 are added.)
 */
function wwtcLadderFromTrack($trackId): ?int
{
    $trackId = (int) $trackId;
    return $trackId > 0 ? 13 - $trackId : null;
}

function wwtcTrackFromLadder(int $ladder): int
{
    return 13 - $ladder;
}

/** Public soldier payload (never the dob). Keyed by user_serial as the SPA id. */
function wwtcSafeKid(array $u): array
{
    return [
        'id' => (string) $u['user_serial'],
        'serial' => (string) $u['user_serial'],
        'name' => trim(($u['first'] ?? '') . ' ' . ($u['last'] ?? '')),
        'grade' => isset($u['class_grade']) ? (string) $u['class_grade'] : null,
        'ladder' => isset($u['track_id']) && $u['track_id'] !== null ? wwtcLadderFromTrack($u['track_id']) : null,
        'schoolId' => isset($u['school_id']) ? (int) $u['school_id'] : null,
        'schoolName' => $u['school_name'] ?? null,
        'className' => trim(($u['class_grade'] ?? '') . ($u['class_sub'] ?? '')),
    ];
}

const WWTC_KID_SELECT =
    'SELECT u.user_id, u.user_serial, u.first, u.last, u.school_id, u.class_id,
            u.school_type_id, u.lang_id,
            s.school_name, c.class_grade, c.class_sub,
            ut.track_id, ut.level
     FROM users u
     JOIN schools s USING (school_id)
     JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
     LEFT JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
     WHERE u.user_registered > 0 AND ';

/** Find a registered Tehillim soldier by serial, with school/class/ladder. null if none. */
function wwtcKidBySerial(string $serial): ?array
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(WWTC_KID_SELECT . 'u.user_serial = :serial LIMIT 1');
    $stmt->execute([':serial' => $serial]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** Find a registered Tehillim soldier by user_id. null if none. */
function wwtcKidByUserId(int $userId): ?array
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(WWTC_KID_SELECT . 'u.user_id = :id LIMIT 1');
    $stmt->execute([':id' => $userId]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** Eligible WWTC schools [school_id => school_name], the setASR() roster rule. */
function wwtcEligibleSchools(): array
{
    global $MASHPIA_DB;
    static $schools;
    if ($schools !== null) {
        return $schools;
    }
    $rows = $MASHPIA_DB->query(
        'SELECT s.school_id, s.school_name
           FROM schools s
           JOIN school_subjects ss USING (school_id)
          WHERE s.school_era IS NULL AND ss.subject_id = ' . WWTC_SUBJECT_ID . '
            AND s.chayolei = 1 AND s.test_school = 0 AND s.school_id NOT IN (82, 612)
          ORDER BY s.school_name'
    )->fetchAll(PDO::FETCH_KEY_PAIR);
    return $schools = array_map('strval', $rows);
}

/**
 * Per-school / per-class completion for a Shabbos-Mevorchim date, computed from
 * the mission-mark signal (date_tasks_mission_marks — the "earned this month"
 * row the teacher tool and POST /me/report both maintain) plus eligible enrolled
 * headcounts. Cheap grouped queries, so this scales to the whole army without the
 * per-student loop the summary report does. Returns:
 *   [ 'metBySchool' => [sid=>n], 'sizeBySchool' => [sid=>n],
 *     'metByClass' => [sid=>[cid=>n]], 'sizeByClass' => [sid=>[cid=>n]] ]
 */
function wwtcCompletionCounts(int $date): array
{
    global $MASHPIA_DB;
    static $cache = [];
    if (isset($cache[$date])) {
        return $cache[$date];
    }

    $met = $MASHPIA_DB->prepare(
        'SELECT u.school_id, u.class_id, COUNT(*) n
           FROM date_tasks_mission_marks mm
           JOIN users u ON u.user_id = mm.user_id
          WHERE mm.subject_id = ' . WWTC_SUBJECT_ID . ' AND mm.mark_date = :d
          GROUP BY u.school_id, u.class_id'
    );
    $met->execute([':d' => $date]);

    $size = $MASHPIA_DB->query(
        'SELECT u.school_id, u.class_id, COUNT(DISTINCT u.user_id) n
           FROM users u
           JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
           JOIN schools s ON s.school_id = u.school_id
           JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
          WHERE u.user_registered > 0 AND ' . WWTC_ROSTER_WHERE . '
          GROUP BY u.school_id, u.class_id'
    );

    $out = ['metBySchool' => [], 'sizeBySchool' => [], 'metByClass' => [], 'sizeByClass' => []];
    foreach ($met->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $sid = (int) $r['school_id'];
        $cid = (int) $r['class_id'];
        $n = (int) $r['n'];
        $out['metByClass'][$sid][$cid] = $n;
        $out['metBySchool'][$sid] = ($out['metBySchool'][$sid] ?? 0) + $n;
    }
    foreach ($size->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $sid = (int) $r['school_id'];
        $cid = (int) $r['class_id'];
        $n = (int) $r['n'];
        $out['sizeByClass'][$sid][$cid] = $n;
        $out['sizeBySchool'][$sid] = ($out['sizeBySchool'][$sid] ?? 0) + $n;
    }
    return $cache[$date] = $out;
}
