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
if (preg_match('#^/shabbos-mevorchim-tehillim/api(?:/|$)#', (string) $uri)) {
    require __DIR__ . '/index.php';
    return true;
}

return false;
