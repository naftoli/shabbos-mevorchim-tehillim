<?php

declare(strict_types=1);

/**
 * POST /api/realtime-session
 *
 * Mints a short-lived OpenAI Realtime ephemeral token for a logged-in soldier.
 * OPENAI_API_KEY is read on the server and is never returned.
 *
 * Routed by api/index.php (the app's /api/* rewrite). This file can also run
 * directly if the rewrite is bypassed.
 */

require_once __DIR__ . '/commander-prompt.php';

function wwtcHandleRealtimeSession(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'POST') {
        wwtcError('Use POST.', 405);
    }

    $actor = wwtcRequireActor(['kid']);
    $key = wwtcOpenAiKey();
    if ($key === '') {
        wwtcError('Your Virtual Commander’s realtime voice is not configured yet.', 503);
    }

    $in = wwtcInput();
    $ctx = is_array($in['context'] ?? null) ? $in['context'] : [];
    $model = wwtcRealtimeModel();
    $payload = json_encode(
        wwtcRealtimeSessionPayload($ctx, $model, wwtcRealtimeVoice()),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    if (!is_string($payload)) {
        wwtcError('Could not start the voice call.', 500);
    }

    $ch = curl_init('https://api.openai.com/v1/realtime/client_secrets');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
            'OpenAI-Safety-Identifier: ' . hash('sha256', 'wwtc-soldier-' . (string) $actor['id']),
        ],
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    $logBody = is_string($raw) ? str_replace($key, '[redacted]', wwtcCut($raw, 400)) : '';
    if (!is_string($raw) || $status < 200 || $status >= 300) {
        error_log('WWTC realtime session error: status ' . $status . ' ' . $err . ' ' . $logBody);
        wwtcError('Could not start the voice call. Please try again.', 502);
    }

    $data = json_decode($raw, true);
    $value = '';
    if (is_array($data)) {
        $value = (string) ($data['value'] ?? ($data['client_secret']['value'] ?? ''));
    }
    if ($value === '' || $value === $key || str_starts_with($value, 'sk-')) {
        error_log('WWTC realtime session returned no ephemeral token.');
        wwtcError('Could not start the voice call. Please try again.', 502);
    }

    $expires = null;
    if (is_array($data)) {
        $expires = $data['expires_at'] ?? ($data['client_secret']['expires_at'] ?? null);
    }
    wwtcJson([
        'value' => $value,
        'expires_at' => $expires,
        'model' => $model,
    ]);
}

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && @realpath((string) $_SERVER['SCRIPT_FILENAME']) === @realpath(__FILE__)) {
    require __DIR__ . '/bootstrap.php';
    wwtcHandleRealtimeSession();
}
