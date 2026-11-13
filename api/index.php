<?php

declare(strict_types=1);

/**
 * Worldwide Tehillim Club API — router.
 *
 * Campaign numbers come from class.shabbosMevorchim.php (the same class the WWTC
 * report pages use), so this returns what those reports show. Reads cover the
 * whole SPA; writes (POST /me/report, PUT /me/ladder) are scoped by the bearer
 * token to the signed-in soldier and mirror mark_tehillim2.php (see marking.php).
 *
 * Helpers live in sibling files. HTTP handlers live in routes/, loaded after
 * $method and $path are set so they share this script's scope.
 */

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/marking.php';
require __DIR__ . '/overEntry.php';
require __DIR__ . '/flags.php';
require __DIR__ . '/schoolLogo.php';
require __DIR__ . '/platoonRoll.php';
require __DIR__ . '/soldierBoard.php';
require __DIR__ . '/soldierRank.php';
require __DIR__ . '/platoonGraphics.php';
require __DIR__ . '/notify.php';
require __DIR__ . '/campaignBoard.php';
require __DIR__ . '/kidProgress.php';
require __DIR__ . '/dedications.php';

function wwtcRoutePath(): string
{
    $uri = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    // Strip the mount prefix, however the app is hosted.
    $uri = preg_replace('#^.*/api#', '', $uri, 1);
    $uri = '/' . ltrim((string) $uri, '/');
    return rtrim($uri, '/') ?: '/';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = wwtcRoutePath();

// Signed, expiring PDF for one commander or teacher. No login. The token is
// the secret; a bad or expired token is a 404 with no names in the body.
if ($method === 'GET' && $path === '/notify-report') {
    $notifyToken = $_GET['t'] ?? '';
    wwtcNotifyServeReport(is_string($notifyToken) ? $notifyToken : '');
}

require __DIR__ . '/routes/auth.php';
require __DIR__ . '/routes/public.php';
require __DIR__ . '/routes/reports.php';
require __DIR__ . '/routes/soldier.php';
require __DIR__ . '/routes/admin.php';

// Perfect Platoon graphics (public download + staff office). Own routes only.
if (wwtcDispatchPlatoonGraphics($method, $path)) {
    exit;
}

wwtcError('Not found: ' . $method . ' ' . $path, 404);
