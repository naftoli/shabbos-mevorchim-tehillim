<?php

declare(strict_types=1);

// Built-in PHP server router for local `npm run dev:api` testing.
// Do not use this file under Apache (the submodule .htaccess routes there).
//
//   npm run dev:api   # php -S localhost:8080 -t ../../ api/dev-router.php
//   npm run dev       # Vite proxies /shabbos-mevorchim-tehillim/api here

if (!getenv('WWTC_TOKEN_SECRET') && !defined('WWTC_TOKEN_SECRET')) {
    putenv('WWTC_TOKEN_SECRET=local-dev-only-tehillim-token-secret-min-32-chars');
}
set_time_limit(0);
ini_set('max_execution_time', '0');

// Mashpia's DB picker treats Host: localhost as the public database.
$_SERVER['HTTP_HOST'] = 'localhost';

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
// Translation does not need the Mashpia database. Answer it here so
// `npm run dev:api` can try the buttons without class.shabbosMevorchim.php.
// With no WWTC_AI_KEY this uses the built-in stub. Apache never loads this
// file: production POST /translate goes through index.php and returns 503
// until WWTC_AI_KEY is set, the same as POST /chat.
if (preg_match('#/api/translate/?$#', (string) $uri)) {
    wwtcDevServeTranslate();
    return true;
}
if (preg_match('#^/shabbos-mevorchim-tehillim/api(?:/|$)#', (string) $uri)) {
    require __DIR__ . '/index.php';
    return true;
}

return false;

/**
 * Local-only POST /translate. Production routing stays in index.php.
 */
function wwtcDevServeTranslate(): void
{
    require_once __DIR__ . '/translate.php';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    header('Content-Type: application/json; charset=utf-8');
    if ($method === 'OPTIONS') {
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        http_response_code(204);
        return;
    }
    if ($method !== 'POST') {
        http_response_code(405);
        echo '{"error":"Use POST."}';
        return;
    }
    $input = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo '{"error":"The request body must contain valid JSON."}';
        return;
    }
    $key = wwtcAiKey();
    // No key: the stub stands in so the language buttons can be tried.
    // A real WWTC_AI_KEY uses Claude, the same caller index.php uses.
    $caller = $key === '' ? 'wwtcTranslateStub' : null;
    $result = wwtcTranslateRequest($input, $key, $caller);
    http_response_code($result['status']);
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
    if ($result['status'] === 200) {
        echo json_encode($result['body'], $flags);
        return;
    }
    echo json_encode(['error' => $result['error'] ?? 'Translation failed.'], $flags);
}
