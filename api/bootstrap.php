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

require_once __DIR__ . '/compat.php';
require_once __DIR__ . '/hebrewYear.php';
require_once __DIR__ . '/quotaOverride.php';
require_once __DIR__ . '/className.php';

define('WWTC_PUBLIC_ROOT', dirname(__DIR__, 2));
// Tehillim subject in user_tracks / date_tasks_missions.
const WWTC_SUBJECT_ID = 1;
// date_tasks.grid_id for the two tracked tasks.
const WWTC_GRID_KAPITELACH = 8001;
// How long a parent's handoff code stays valid, in seconds. Long enough for
// the tap on the parent site to open the personal page, and no longer.
const WWTC_HANDOFF_TTL = 120;
const WWTC_GRID_MINUTES = 8002;
// Master switch for Rosh Hashana / Yom Kippur boards, reports and personal-page
// missions. OFF until further notice, for every year — even where marks exist
// from when those days were untracked "training" (e.g. 5787's Rosh Hashana).
// Flip to true to turn them on; each holiday then still shows only once HQ has
// created its missions for the year (see wwtcHolidayDates).
const WWTC_HOLIDAY_BOARDS_ENABLED = false;
// How many days after a Shabbos Mevorchim a soldier may still enter that month's
// own Tehillim via POST /me/report. Once this grace window closes the self-report
// stays shut until the next Shabbos Mevorchim; a teacher can still backfill the
// month with mark_tehillim2.php.
const WWTC_REPORT_GRACE_DAYS = 7;
// Shared roster predicate for the ancillary PDO counts (soldiers, classes,
// headcounts), so they all count the same population. Needs `schools s`,
// `classes c` and `users u` in scope. Campaign done/goal figures instead follow
// setASR()'s roster, to stay identical to the WWTC report pages.
const WWTC_ROSTER_WHERE = 's.school_era IS NULL AND c.class_era = 0 AND u.school_id NOT IN (82, 612)';

// Perfect-platoon rule shared with the classes view. Pure helpers; no DB at load.
require_once __DIR__ . '/perfectPlatoon.php';

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

// Bootstrap has succeeded, so the shutdown guard above now stands down. From
// here a route handler runs with headers not yet flushed (the includes produced
// no output). An uncaught exception or fatal would otherwise end the request as
// a 200 with an empty body (prod display_errors is off) — which the SPA cannot
// parse as JSON and which surfaces as a cryptic "Cannot destructure ... null".
// Convert any such failure into a JSON 500, logging the detail server-side
// rather than leaking it to the client.
set_exception_handler(static function (\Throwable $e): void {
    error_log('WWTC API uncaught: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo '{"error":"Something went wrong on our end. Please try again."}';
});
register_shutdown_function(static function (): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    error_log('WWTC API fatal: ' . $error['message'] . ' @ ' . $error['file'] . ':' . $error['line']);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo '{"error":"Something went wrong on our end. Please try again."}';
});

function wwtcEnv(string $name, string $default = ''): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        $value = $_SERVER[$name] ?? $_ENV[$name] ?? $default;
    }
    return (string) $value;
}

// ---- file-based report cache -----------------------------------------------
// The ShabbosMevorchim report engine rebuilds the whole army (~9k soldiers) for
// /stats, /schools, /me/social, the reports, etc. — ~60s each. Its own cache is
// Redis-backed and Redis is not enabled here, so every request recomputed. This
// is a small, Redis-free stand-in: results are deterministic for a given SM date
// (they change only as kids mark), so we keep each on disk and serve it with
// stale-while-revalidate. A visitor always gets an instant (possibly up-to-TTL-
// stale) answer; the slow rebuild runs in the background after the response is
// flushed. Aggregate/nationwide numbers lagging a minute or two is fine; the
// signed-in kid's own figures come from the uncached /me/progress.

$GLOBALS['wwtcDeferred'] = $GLOBALS['wwtcDeferred'] ?? [];

function wwtcCacheTtl(): int
{
    return max(10, (int) (wwtcEnv('WWTC_CACHE_TTL') ?: 120));
}

function wwtcCacheDir(): string
{
    $base = defined('MASHPIA_LOG_DIR') ? MASHPIA_LOG_DIR : sys_get_temp_dir();
    $dir = $base . '/wwtc-cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function wwtcCacheFile(string $key): string
{
    return wwtcCacheDir() . '/' . preg_replace('/[^A-Za-z0-9_.-]/', '_', $key) . '.json';
}

function wwtcCacheRead(string $file): ?array
{
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $decoded = json_decode($raw, true);
    return (is_array($decoded) && array_key_exists('data', $decoded)) ? $decoded : null;
}

/** Compute $producer, write it to $file atomically, return it. */
function wwtcCacheWrite(string $file, callable $producer)
{
    $data = $producer();
    $tmp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, json_encode(['at' => time(), 'data' => $data])) !== false) {
        @rename($tmp, $file); // atomic replace so readers never see a half-written file
    } else {
        @unlink($tmp);
    }
    return $data;
}

/** Non-blocking refresh: whoever gets the lock rebuilds; everyone else skips. */
function wwtcTryRefresh(string $file, callable $producer)
{
    $lock = @fopen($file . '.lock', 'c');
    if (!$lock) {
        return null;
    }
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        fclose($lock);
        return null; // another worker is already rebuilding this key
    }
    try {
        return wwtcCacheWrite($file, $producer);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Cold miss: serialize concurrent first-computes so the army is built once. */
function wwtcColdCompute(string $file, callable $producer)
{
    $lock = @fopen($file . '.lock', 'c');
    if (!$lock) {
        return $producer(); // can't lock (unwritable dir) — compute uncached
    }
    flock($lock, LOCK_EX); // block: let the first request build it, others wait
    try {
        $entry = wwtcCacheRead($file); // another worker may have just filled it
        if ($entry !== null && (time() - (int) ($entry['at'] ?? 0)) <= wwtcCacheTtl()) {
            return $entry['data'];
        }
        return wwtcCacheWrite($file, $producer);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/**
 * Cache $producer's result under $key with stale-while-revalidate semantics.
 * Fresh (<= TTL): return it. Stale: return it now and queue a background rebuild
 * (or, where the response can't be flushed early, rebuild inline). Cold: build
 * once, under a lock. $producer must return a JSON-serializable array.
 */
function wwtcCached(string $key, callable $producer)
{
    $file = wwtcCacheFile($key);
    $entry = wwtcCacheRead($file);

    if ($entry !== null) {
        $age = time() - (int) ($entry['at'] ?? 0);
        if ($age <= wwtcCacheTtl()) {
            return $entry['data']; // fresh
        }
        // Stale. Serve the stale copy; refresh in the background if we can flush
        // the response first, otherwise refresh inline (falling back to stale).
        if (function_exists('fastcgi_finish_request')) {
            $GLOBALS['wwtcDeferred'][] = static function () use ($file, $producer) {
                wwtcTryRefresh($file, $producer);
            };
            return $entry['data'];
        }
        $fresh = wwtcTryRefresh($file, $producer);
        return $fresh === null ? $entry['data'] : $fresh;
    }

    return wwtcColdCompute($file, $producer);
}

/**
 * The army-wide aggregates behind /stats, /schools and /reports/army — the
 * setArmyResults()+setASR() pass, which is the ~60s cost. Deterministic per SM
 * date, so cached. Returns plain arrays (JSON-safe) read straight off the report.
 */
function wwtcArmyAggregates(?int $date = null, ?int $year = null): array
{
    $year = $year ?: wwtcYear();
    $date = $date ?? wwtcCurrentDate();
    $raw = wwtcCached("army_aggregates.$year.$date", static function () use ($date, $year) {
        $sm = wwtcReport($date, $year);
        $sm->setArmyResults();
        $sm->setASR($date);
        return [
            'schools'  => $sm->getSchools(),
            'army'     => $sm->getArmyResults(),
            'armyDone' => $sm->getArmyDoneResults(),
            'kapGoal'  => $sm->getArmySchoolsResults()['Kapitelach'] ?? [],
            'kapDone'  => $sm->getArmySchoolsDoneResults()['Kapitelach'] ?? [],
            'minGoal'  => $sm->getArmySchoolsResults()['Minutes'] ?? [],
            'minDone'  => $sm->getArmySchoolsDoneResults()['Minutes'] ?? [],
        ];
    });
    // index.php defines this once the school report is available. Overrides are
    // applied on the way out so the file cache stays the engine's own totals.
    if (function_exists('wwtcAdjustArmyAggregates')) {
        return wwtcAdjustArmyAggregates($raw, $date, $year);
    }
    return $raw;
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
    wwtcRunDeferred();
    exit;
}

/**
 * Run any background work queued during this request (stale cache refreshes).
 * Under FastCGI we flush the response to the client first, so the refresh of a
 * slow report never makes the visitor wait — they already have the stale copy.
 */
function wwtcRunDeferred(): void
{
    $tasks = $GLOBALS['wwtcDeferred'] ?? [];
    $GLOBALS['wwtcDeferred'] = [];
    if (!$tasks) {
        return;
    }
    if (function_exists('fastcgi_finish_request')) {
        @fastcgi_finish_request();
    }
    foreach ($tasks as $task) {
        try {
            $task();
        } catch (\Throwable $e) {
            error_log('WWTC cache refresh failed: ' . $e->getMessage());
        }
    }
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

/**
 * A single-child code the parent site hands to the SPA in a URL
 * (POST /parent/handoff). It only names a child: it carries no parent session
 * and cannot call anything. The SPA trades it for a real kid token.
 */
function wwtcIssueHandoffCode(int $userId): string
{
    return wwtcSignPayload([
        'v' => 1,
        'type' => 'handoff',
        'id' => $userId,
        'iat' => time(),
        'exp' => time() + WWTC_HANDOFF_TTL,
    ]);
}

/**
 * The parent behind a mobile session token (the `admin` value the parent site
 * posts to mobile/reg/ajax/*.php), or a 401.
 *
 * A parent is an ordinary admins row. This token buys exactly one thing here:
 * a handoff code for a child of their own.
 */
function wwtcParentAdminId(string $mobileToken): int
{
    $adminId = \mashpia\api\auth\Auth::authenticate(['key' => $mobileToken], 'mobile');
    if (!$adminId || !ctype_digit((string) $adminId)) {
        wwtcError('Please sign in again on the parent site.', 401);
    }
    return (int) $adminId;
}

/** True when that parent account is linked to this registered child. */
function wwtcParentOwnsChild(int $adminId, int $userId): bool
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        "SELECT 1
           FROM admin_auths aa
           JOIN users u ON u.user_id = aa.id
          WHERE aa.admin_id = :admin
            AND aa.role_id = 1
            AND aa.auth = 'user'
            AND u.user_id = :user
            AND u.user_registered > 0
          LIMIT 1"
    );
    $stmt->execute([':admin' => $adminId, ':user' => $userId]);
    return (bool) $stmt->fetchColumn();
}

/** Per-IP cap for the handoff endpoints. Same idea as the Lulav API. */
function wwtcRateLimit(string $bucket, int $limit, int $windowSeconds): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = wwtcCacheDir() . '/rate-' . hash('sha256', $bucket . '|' . $ip) . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if ($handle) {
            fclose($handle);
        }
        return;
    }
    $raw = stream_get_contents($handle);
    $state = $raw ? json_decode($raw, true) : null;
    $now = time();
    if (!is_array($state) || empty($state['started']) || $now - (int) $state['started'] >= $windowSeconds) {
        $state = ['started' => $now, 'count' => 0];
    }
    $state['count']++;
    $blocked = $state['count'] > $limit;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, (string) json_encode($state));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    if ($blocked) {
        wwtcError('Too many sign-in attempts. Please try again later.', 429);
    }
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
 * in calendar order. A plain year has one "Adar" (the duplicate Adar II slot
 * from calculateSM is skipped). A leap year keeps "Adar I" and "Adar II" as
 * separate keys so their marks never share a month. English spellings match
 * the SPA (ladders.js / hebrewYear.js).
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

/**
 * Last julian day a soldier may self-report the current month: the current
 * Shabbos Mevorchim plus the grace window. Before the year's first Shabbos
 * Mevorchim, wwtcCurrentDate() returns that first (future) SM, so the window is
 * open then too — the grace only caps how late a report can be, never how early.
 */
function wwtcReportDeadline(): int
{
    return wwtcCurrentDate() + WWTC_REPORT_GRACE_DAYS;
}

/** Whether the current month's self-report window is still open (today on/before the deadline). */
function wwtcReportWindowOpen(): bool
{
    return unixtojd() <= wwtcReportDeadline();
}

/** English month name for a Shabbos-Mevorchim jd, '' if unknown. */
function wwtcMonthForDate(int $jd): string
{
    $month = array_search($jd, wwtcMonthDates(), true);
    return $month === false ? '' : (string) $month;
}

/**
 * The as-of boundary for a Shabbos-Mevorchim $jd: the month's OWN Shabbos Mevorchim
 * as a 'Y-m-d 00:00:00' datetime. A ladder change takes effect from the NEXT Shabbos
 * Mevorchim after it (a child may not switch during the reporting week), so a month is
 * priced on the latest change made strictly before its own SM day. jdtogregorian gives
 * "m/d/Y".
 */
function wwtcAsOfBoundary(int $jd): string
{
    [$mo, $day, $yr] = array_map('intval', explode('/', jdtogregorian($jd)));
    return sprintf('%04d-%02d-%02d 00:00:00', $yr, $mo, $day);
}

/**
 * The soldier's Tehillim track_id in effect for the Shabbos-Mevorchim $jd, from
 * user_track_history (the latest change made before that month's own Shabbos
 * Mevorchim). Falls back to $fallbackTrack (their current user_tracks.track_id) when
 * there is no history before that point — a month before the history was seeded
 * (forward-only). See tehillim_user_track_history.sql.
 */
function wwtcTrackAsOf(int $userId, int $jd, int $fallbackTrack): int
{
    $boundary = wwtcAsOfBoundary($jd);
    global $MASHPIA_DB;
    static $stmt = null;
    if ($stmt === null) {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT track_id FROM user_track_history
              WHERE user_id = :uid AND changed_at < :boundary
              ORDER BY changed_at DESC, id DESC LIMIT 1'
        );
    }
    $stmt->execute([':uid' => $userId, ':boundary' => $boundary]);
    $track = $stmt->fetchColumn();
    return $track === false ? $fallbackTrack : (int) $track;
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
function wwtcReport(?int $jd = null, ?int $year = null): ShabbosMevorchim
{
    static $byDate = [];
    $year = $year ?: wwtcYear();
    $jd = $jd ?? wwtcCurrentDate();
    $key = $year . ':' . $jd;
    if (!isset($byDate[$key])) {
        $obj = new ShabbosMevorchim($year);
        $obj->setUseLiveData(true);
        $obj->setReportDates($jd);
        $byDate[$key] = $obj;
    }
    return $byDate[$key];
}

/** English month => jd for one campaign year. Current year reuses wwtcMonthDates(). */
function wwtcMonthDatesForYear(int $year): array
{
    static $cache = [];
    if (isset($cache[$year])) {
        return $cache[$year];
    }
    if ($year === wwtcYear()) {
        return $cache[$year] = wwtcMonthDates();
    }
    $names = [
        0 => 'Tishrei', 1 => 'Cheshvan', 2 => 'Kislev', 3 => 'Teves',
        4 => 'Shvat', 5 => 'Adar', 6 => 'Adar II', 7 => 'Nissan',
        8 => 'Iyar', 9 => 'Sivan', 10 => 'Tammuz', 11 => 'Av', 12 => 'Elul',
    ];
    $sm = calculateSM($year);
    $dates = [];
    foreach ($sm as $index => $jd) {
        if ($sm[6] != $sm[7] && $index == 5) {
            $dates['Adar I'] = $jd;
            continue;
        } elseif ($sm[6] == $sm[7] && $index == 6) {
            continue;
        }
        $dates[$names[$index]] = $jd;
    }
    return $cache[$year] = $dates;
}

function wwtcIsHolidayMonth(string $month): bool
{
    return $month === 'Rosh Hashana' || $month === 'Yom Kippur' || $month === 'Rosh Hashona' || $month === 'Rosh Hashanah';
}

/** year+month query, or the current Shabbos Mevorchim when the query is empty. */
function wwtcQueryPeriod(): array
{
    $year = isset($_GET['year']) && $_GET['year'] !== '' ? (int) $_GET['year'] : wwtcYear();
    $month = isset($_GET['month']) ? trim((string) $_GET['month']) : '';
    $aliases = [
        'Adar 1' => 'Adar I', 'Adar 2' => 'Adar II', 'Shevat' => 'Shvat',
        'Rosh Hashona' => 'Rosh Hashana', 'Rosh Hashanah' => 'Rosh Hashana',
    ];
    if (isset($aliases[$month])) {
        $month = $aliases[$month];
    }
    if (wwtcIsHolidayMonth($month)) {
        $name = ($month === 'Rosh Hashona' || $month === 'Rosh Hashanah') ? 'Rosh Hashana' : $month;
        // A holiday boards off its own day(s) for "said", but the quota is the
        // Shabbos-Mevorchim Tishrei quota of the same year (see wwtcHolidayBoard).
        $jds = wwtcHolidayDates($year)[$name] ?? [];
        $quotaJd = (int) (wwtcMonthDatesForYear($year)['Tishrei'] ?? 0);
        return [
            'year' => $year, 'month' => $name, 'holiday' => true,
            'jd' => $jds[0] ?? null, 'jds' => $jds, 'quotaJd' => $quotaJd,
        ];
    }
    if ($month === '') {
        if ($year === wwtcYear()) {
            $jd = wwtcCurrentDate();
            return ['year' => $year, 'month' => wwtcMonthForDate($jd), 'jd' => $jd, 'holiday' => false];
        }
        $dates = wwtcMonthDatesForYear($year);
        $last = (string) array_key_last($dates);
        return ['year' => $year, 'month' => $last, 'jd' => (int) $dates[$last], 'holiday' => false];
    }
    $dates = wwtcMonthDatesForYear($year);
    if (!isset($dates[$month])) {
        wwtcError('That month is not on the campaign calendar.', 404);
    }
    return ['year' => $year, 'month' => $month, 'jd' => (int) $dates[$month], 'holiday' => false];
}

// ---- holiday (Rosh Hashana / Yom Kippur) board support ---------------------
// These occasions are not Shabbos-Mevorchim months, so they are not in the
// ShabbosMevorchim engine's date set and never reach its single-date, flat-SUM
// aggregation. Rosh Hashana also spans two calendar days with two mission sets,
// and most soldiers mark BOTH with the same number — a plain sum would double
// count. So the whole holiday board is built here from per-soldier rows instead:
// "said" is each soldier's MAX(done_qty) across the holiday's day(s), and the
// quota is their Shabbos-Mevorchim Tishrei quota.

/** True if WWTC Tehillim missions exist on a Julian date (cached per request). */
function wwtcHasHolidayMissions(int $jd): bool
{
    global $MASHPIA_DB;
    static $cache = [];
    if (isset($cache[$jd])) {
        return $cache[$jd];
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT 1 FROM date_tasks_missions
          WHERE subject_id = ' . WWTC_SUBJECT_ID . ' AND start_date = :d AND end_date = :d LIMIT 1'
    );
    $stmt->execute([':d' => $jd]);
    return $cache[$jd] = (bool) $stmt->fetchColumn();
}

/**
 * Holiday => its Julian date(s) for a campaign year, from the Hebrew calendar
 * (Tishrei = month 1): Rosh Hashana = 1 & 2 Tishrei, Yom Kippur = 10 Tishrei.
 * Only holidays that actually have missions that year are returned, so a holiday
 * with no board data (e.g. a year Yom Kippur was never loaded) is hidden rather
 * than shown as an all-zero board. Shape: ['Rosh Hashana' => [jd, jd], ...].
 */
function wwtcHolidayDates(int $year): array
{
    static $cache = [];
    if (isset($cache[$year])) {
        return $cache[$year];
    }
    // Holiday boards are off until the master switch is turned on, regardless of
    // year or stray marks.
    if (!WWTC_HOLIDAY_BOARDS_ENABLED) {
        return $cache[$year] = [];
    }
    $rh1 = (int) jewishtojd(1, 1, $year); // 1 Tishrei opens the year named $year
    $candidates = [
        'Rosh Hashana' => [$rh1, $rh1 + 1],
        'Yom Kippur'   => [(int) jewishtojd(1, 10, $year)],
    ];
    $out = [];
    foreach ($candidates as $name => $jds) {
        $have = array_values(array_filter($jds, 'wwtcHasHolidayMissions'));
        if ($have) {
            $out[$name] = $have;
        }
    }
    return $cache[$year] = $out;
}

/**
 * The full board for one holiday occasion, built from per-soldier rows so every
 * endpoint (army / schools / class / platoon / soldier) agrees — the same
 * discipline the engine-backed helpers keep. "said" = MAX(done_qty) across
 * $doneJds (Rosh Hashana's two days collapse to one per soldier); quota = the
 * soldier's SM-Tishrei quota at $quotaJd. met is per-soldier quota (said >= quota),
 * which also drives perfect platoons — self-consistent across the holiday board.
 * Returns engine-shaped arrays so wwtcSchoolRow() etc. can be reused unchanged.
 */
function wwtcHolidayBoard(array $doneJds, int $quotaJd, ?int $year = null, ?string $monthName = null): array
{
    global $MASHPIA_DB;
    $year = $year ?: wwtcYear();
    sort($doneJds);
    $key = 'holiday_board.' . $year . '.' . $quotaJd . '.' . implode('-', $doneJds);
    // Holiday quota is the SM-Tishrei quota, priced on the ladder each soldier was on
    // for Tishrei (as of Tishrei's own Shabbos Mevorchim), not their current ladder.
    $asofBoundary = wwtcAsOfBoundary($quotaJd);
    $board = wwtcCached($key, static function () use ($doneJds, $quotaJd, $asofBoundary, $MASHPIA_DB) {
        $kap = WWTC_GRID_KAPITELACH;
        $min = WWTC_GRID_MINUTES;

        // Per-soldier SM-Tishrei quota (kapitlach + minutes) with school/class.
        $quotaStmt = $MASHPIA_DB->prepare(
            'SELECT u.user_id, u.school_id, u.class_id, u.first, u.last,
                    c.class_grade, c.class_sub, c.class_teacher,
                    MAX(CASE WHEN dt.grid_id = ' . $kap . ' THEN dt.quantity END) qk,
                    MAX(CASE WHEN dt.grid_id = ' . $min . ' THEN dt.quantity END) qm
               FROM users u
               JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
               JOIN schools s ON s.school_id = u.school_id
               JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
               JOIN date_tasks_missions m ON m.subject_id = ' . WWTC_SUBJECT_ID . '
                    AND m.start_date = :q AND m.end_date = :q
                    AND m.school_type_id = u.school_type_id
                    AND m.track_id = COALESCE((SELECT h.track_id FROM user_track_history h
                          WHERE h.user_id = ut.user_id AND h.changed_at < :boundary
                          ORDER BY h.changed_at DESC, h.id DESC LIMIT 1), ut.track_id)
                    AND m.level = ut.level AND m.lang_id = u.lang_id
               JOIN date_tasks dt ON dt.date_tasks_mission_id = m.date_tasks_mission_id
                    AND dt.grid_id IN (' . $kap . ', ' . $min . ')
              WHERE u.user_registered > 0 AND ' . WWTC_ROSTER_WHERE . '
              GROUP BY u.user_id, u.school_id, u.class_id, u.first, u.last,
                       c.class_grade, c.class_sub, c.class_teacher'
        );
        $quotaStmt->execute([':q' => $quotaJd, ':boundary' => $asofBoundary]);

        // Per-soldier done = MAX across the holiday day(s), so the two Rosh Hashana
        // days count once. Keyed by user_id, pivoted to kapitlach + minutes.
        $doneMap = [];
        $in = implode(',', array_map('intval', $doneJds));
        if ($in !== '') {
            $doneRows = $MASHPIA_DB->query(
                'SELECT dtm.user_id,
                        MAX(CASE WHEN dt.grid_id = ' . $kap . ' THEN dtm.done_qty END) dk,
                        MAX(CASE WHEN dt.grid_id = ' . $min . ' THEN dtm.done_qty END) dm
                   FROM date_tasks_marks dtm
                   JOIN date_tasks dt USING (date_task_id)
                   JOIN date_tasks_missions m USING (date_tasks_mission_id)
                  WHERE m.subject_id = ' . WWTC_SUBJECT_ID . ' AND m.start_date IN (' . $in . ')
                    AND dt.grid_id IN (' . $kap . ', ' . $min . ')
                  GROUP BY dtm.user_id'
            )->fetchAll(PDO::FETCH_ASSOC);
            foreach ($doneRows as $r) {
                $doneMap[(int) $r['user_id']] = [
                    'k' => $r['dk'] === null ? null : (int) $r['dk'],
                    'm' => $r['dm'] === null ? null : (int) $r['dm'],
                ];
            }
        }

        $names = wwtcEligibleSchools();
        $kapGoal = []; $kapDone = []; $minGoal = []; $minDone = [];
        $metBySchool = []; $sizeBySchool = []; $metByClass = []; $sizeByClass = []; $participated = [];
        $studentsBySchool = []; $classMeta = []; $schools = [];
        $armySaid = 0; $armyQuota = 0; $armyMin = 0; $armyMinQuota = 0; $soldiers = 0; $met = 0; $part = 0;

        foreach ($quotaStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $sid = (int) $row['school_id'];
            if (!isset($names[$sid])) {
                continue; // public boards only list eligible WWTC schools
            }
            $cid = (int) $row['class_id'];
            $qk = (int) $row['qk'];
            $qm = (int) $row['qm'];
            $d = $doneMap[(int) $row['user_id']] ?? null;
            $reported = $d !== null;
            $dk = ($reported && $d['k'] !== null) ? $d['k'] : 0;
            $dm = ($reported && $d['m'] !== null) ? $d['m'] : 0;
            $isMet = wwtcSoldierMetQuota($qk, $dk);
            $didPart = $dk > 0;

            $schools[$sid] = $names[$sid];
            $kapGoal[$sid] = ($kapGoal[$sid] ?? 0) + $qk;
            $kapDone[$sid] = ($kapDone[$sid] ?? 0) + $dk;
            $minGoal[$sid] = ($minGoal[$sid] ?? 0) + $qm;
            $minDone[$sid] = ($minDone[$sid] ?? 0) + $dm;
            $sizeBySchool[$sid] = ($sizeBySchool[$sid] ?? 0) + 1;
            $metBySchool[$sid] = ($metBySchool[$sid] ?? 0) + ($isMet ? 1 : 0);
            $sizeByClass[$sid][$cid] = ($sizeByClass[$sid][$cid] ?? 0) + 1;
            $metByClass[$sid][$cid] = ($metByClass[$sid][$cid] ?? 0) + ($isMet ? 1 : 0);
            if ($didPart) {
                $participated[$sid] = ($participated[$sid] ?? 0) + 1;
            }

            $grade = (string) $row['class_grade'];
            if (!isset($classMeta[$cid])) {
                $classMeta[$cid] = [
                    'schoolId' => $sid,
                    'grade' => $grade,
                    'sub' => (string) ($row['class_sub'] ?? ''),
                    'teacher' => (string) ($row['class_teacher'] ?? ''),
                ];
            }
            $studentsBySchool[$sid][] = [
                'id' => (int) $row['user_id'],
                'name' => trim(($row['first'] ?? '') . ' ' . ($row['last'] ?? '')),
                'classId' => $cid,
                'className' => $grade,
                'quota' => $qk,
                'said' => $dk,
                'met' => $isMet,
                'minutesQuota' => $qm,
                'minutesSaid' => $dm,
            ];

            $armyQuota += $qk; $armySaid += $dk; $armyMinQuota += $qm; $armyMin += $dm;
            $soldiers++;
            if ($isMet) { $met++; }
            if ($didPart) { $part++; }
        }

        $perfectPlatoons = 0;
        $classesCount = 0;
        foreach ($sizeByClass as $sid => $byClass) {
            $classesCount += count($byClass);
            foreach ($byClass as $cid => $size) {
                if (wwtcClassIsPerfect((int) ($metByClass[$sid][$cid] ?? 0), (int) $size)) {
                    $perfectPlatoons++;
                }
            }
        }

        return [
            'schools' => $schools,
            'kapGoal' => $kapGoal, 'kapDone' => $kapDone,
            'minGoal' => $minGoal, 'minDone' => $minDone,
            'counts' => [
                'metBySchool' => $metBySchool, 'sizeBySchool' => $sizeBySchool,
                'metByClass' => $metByClass, 'sizeByClass' => $sizeByClass,
            ],
            'participated' => $participated,
            'studentsBySchool' => $studentsBySchool,
            'classMeta' => $classMeta,
            'army' => [
                'accomplished' => $armySaid, 'quota' => $armyQuota,
                'minutes' => $armyMin, 'minutesQuota' => $armyMinQuota,
                'soldiers' => $soldiers, 'metSoldiers' => $met, 'participatedSoldiers' => $part,
                'schools' => count($schools), 'classes' => $classesCount,
                'perfectPlatoons' => $perfectPlatoons,
            ],
        ];
    });
    if ($monthName !== null && $monthName !== '') {
        return wwtcOverlayHolidayBoard($board, $year, (string) $monthName);
    }
    return $board;
}

/** One soldier's MAX(done_qty) across a holiday's day(s) for a grid. [said, reported]. */
function wwtcKidHolidayDone(array $kid, array $jds, int $grid): array
{
    global $MASHPIA_DB;
    if (!$jds) {
        return [0, false];
    }
    $in = implode(',', array_map('intval', $jds));
    $stmt = $MASHPIA_DB->prepare(
        'SELECT MAX(dtm.done_qty) FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions m USING (date_tasks_mission_id)
          WHERE dtm.user_id = :uid AND m.subject_id = ' . WWTC_SUBJECT_ID . '
            AND m.start_date IN (' . $in . ') AND dt.grid_id = :grid'
    );
    $stmt->execute([':uid' => (int) $kid['user_id'], ':grid' => $grid]);
    $raw = $stmt->fetchColumn();
    $reported = $raw !== null && $raw !== false;
    return [$reported ? (int) $raw : 0, $reported];
}

function wwtcHasPeriodQuery(): bool
{
    return (isset($_GET['year']) && $_GET['year'] !== '') || (isset($_GET['month']) && $_GET['month'] !== '');
}

function wwtcColumnExists(string $table, string $column): bool
{
    static $cache = [];
    $key = $table . '.' . $column;
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    global $MASHPIA_DB;
    try {
        $stmt = $MASHPIA_DB->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c'
        );
        $stmt->execute([':t' => $table, ':c' => $column]);
        return $cache[$key] = ((int) $stmt->fetchColumn()) > 0;
    } catch (\Throwable $e) {
        return $cache[$key] = false;
    }
}

function wwtcParticipatedBySchool(int $date): array
{
    global $MASHPIA_DB;
    static $cache = [];
    if (isset($cache[$date])) {
        return $cache[$date];
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT u.school_id, COUNT(DISTINCT dtm.user_id) n
           FROM date_tasks_marks dtm
           JOIN date_tasks dt USING (date_task_id)
           JOIN date_tasks_missions dtmm USING (date_tasks_mission_id)
           JOIN users u ON u.user_id = dtm.user_id
          WHERE dt.grid_id = ' . WWTC_GRID_KAPITELACH . ' AND dtmm.subject_id = ' . WWTC_SUBJECT_ID . '
            AND dtmm.start_date = :d AND dtm.done_qty > 0
          GROUP BY u.school_id'
    );
    $stmt->execute([':d' => $date]);
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $out[(int) $row['school_id']] = (int) $row['n'];
    }
    return $cache[$date] = $out;
}

// ---- soldier lookup --------------------------------------------------------

/**
 * SPA ladder (5..12, the grade a soldier finishes training to say the whole
 * Tehillim by) <-> DB user_tracks.track_id. Ladder 12 = track 3, 11 = track 4,
 * ... 7 = track 8, so track_id = 15 - ladder and ladder = 15 - track_id. (Only
 * tracks 3..8 — ladders 12..7 — exist today.)
 */
function wwtcLadderFromTrack($trackId): ?int
{
    $trackId = (int) $trackId;
    return $trackId > 0 ? 15 - $trackId : null;
}

function wwtcTrackFromLadder(int $ladder): int
{
    return 15 - $ladder;
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
        'className' => wwtcFormatClassName(trim(($u['class_grade'] ?? '') . ($u['class_sub'] ?? ''))),
        'gender' => wwtcGender($u['gender'] ?? null),
        'photoUrl' => wwtcPhotoUrl($u['wwtc_photo'] ?? null),
    ];
}

function wwtcGender($value): ?string
{
    $g = strtolower(trim((string) $value));
    if (in_array($g, ['f', 'female', 'girl', 'g'], true)) {
        return 'girl';
    }
    if (in_array($g, ['m', 'male', 'boy', 'b'], true)) {
        return 'boy';
    }
    return null;
}

function wwtcPhotoUrl($value): ?string
{
    if ($value === null || $value === false || $value === '') {
        return null;
    }
    if (is_numeric($value) && (int) $value > 0) {
        return '/file_view.php?id=' . (int) $value;
    }
    $text = trim((string) $value);
    if ($text === '' || $text === '0') {
        return null;
    }
    if (preg_match('#^https?://#i', $text) || str_starts_with($text, '/')) {
        return $text;
    }
    return null;
}

function wwtcKidSelectSql(): string
{
    $extra = '';
    if (wwtcColumnExists('users', 'gender')) {
        $extra .= ', u.gender';
    }
    foreach (['user_photo', 'photo', 'mobile_pic'] as $col) {
        if (wwtcColumnExists('users', $col)) {
            $extra .= ', u.' . $col . ' AS wwtc_photo';
            break;
        }
    }
    return 'SELECT u.user_id, u.user_serial, u.first, u.last, u.school_id, u.class_id,
            u.school_type_id, u.lang_id,
            s.school_name, c.class_grade, c.class_sub,
            ut.track_id, ut.level' . $extra . '
     FROM users u
     JOIN schools s USING (school_id)
     JOIN classes c ON c.class_id = u.class_id AND c.school_id = u.school_id
     LEFT JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . WWTC_SUBJECT_ID . ' AND ut.enrolled = 1
     WHERE u.user_registered > 0 AND ';
}

/** Find a registered Tehillim soldier by serial, with school/class/ladder. null if none. */
function wwtcKidBySerial(string $serial): ?array
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(wwtcKidSelectSql() . 'u.user_serial = :serial LIMIT 1');
    $stmt->execute([':serial' => $serial]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** Find a registered Tehillim soldier by user_id. null if none. */
function wwtcKidByUserId(int $userId): ?array
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(wwtcKidSelectSql() . 'u.user_id = :id LIMIT 1');
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
 * per-student loop the summary report does.
 *
 * This is the home-race "soldiers who finished" signal. It is not a Perfect
 * Platoon. A class can finish every kapitlach quota and still lack mission
 * marks, so perfect platoons use wwtcPerfectPlatoonRows() instead.
 * Returns:
 *   [ 'metBySchool' => [sid=>n], 'sizeBySchool' => [sid=>n],
 *     'metByClass' => [sid=>[cid=>n]], 'sizeByClass' => [sid=>[cid=>n]] ]
 */
function wwtcCompletionCounts(int $date, ?int $year = null): array
{
    global $MASHPIA_DB;
    $year = $year ?: wwtcYear();
    static $cache = [];
    if (!isset($cache[$date])) {
        $cache[$date] = wwtcCached("completion_counts.$date", static function () use ($date, $MASHPIA_DB) {
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
    return $out;
        });
    }
    return wwtcOverlayCompletionCountsForDate($cache[$date], $date, $year);
}
