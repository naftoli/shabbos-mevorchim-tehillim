<?php

declare(strict_types=1);

/**
 * POST /speak — WAV from eSpeak NG for the virtual commander.
 * Ches (ח) and chaf (כ) are the phoneme x. No login.
 * Loaded by index.php with $method / $path set.
 * dev-router.php calls wwtcSpeakHttp() directly, before bootstrap,
 * because speaking does not need the database.
 */

if ($method === 'POST' && $path === '/speak') {
    require_once __DIR__ . '/../speak.php';
    wwtcSpeakHttp();
    exit;
}
