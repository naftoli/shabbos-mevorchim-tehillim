<?php

declare(strict_types=1);

/**
 * Speak one line for the virtual commander.
 *
 * The browser voice cannot say ches/chaf. The SPA sends an eSpeak phoneme
 * script (ches and chaf are the phoneme x) and this returns a WAV from
 * eSpeak NG, the engine that actually produces that guttural.
 *
 * No shell is involved: the script is written to a file and passed as an
 * argument. Requires the espeak-ng binary on the API host.
 */

function wwtcSpeakReject(string $script): ?string
{
    if ($script === '' || strlen($script) > 8000) {
        return 'empty';
    }
    if (preg_match('/[^\x09\x0a\x0d\x20-\x7e]/', $script)) {
        return 'bad';
    }
    return null;
}

function wwtcSpeakWav(string $script): ?string
{
    if (wwtcSpeakReject($script) !== null) {
        return null;
    }
    $bin = trim((string) (getenv('WWTC_ESPEAK') ?: 'espeak-ng'));
    if ($bin === '' || !preg_match('#^[A-Za-z0-9_./+-]+$#', $bin)) {
        return null;
    }
    $dir = sys_get_temp_dir() . '/wwtc-speak-' . bin2hex(random_bytes(6));
    if (!mkdir($dir, 0700, true) && !is_dir($dir)) {
        return null;
    }
    $txt = $dir . '/line.txt';
    $wav = $dir . '/line.wav';
    file_put_contents($txt, $script);
    $proc = proc_open(
        [$bin, '-v', 'en-us', '-s', '142', '-p', '44', '-w', $wav, '-f', $txt],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
        $pipes,
        $dir
    );
    if (!is_resource($proc)) {
        @unlink($txt);
        @rmdir($dir);
        return null;
    }
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($proc);
    $bytes = ($code === 0 && is_file($wav)) ? file_get_contents($wav) : false;
    @unlink($wav);
    @unlink($txt);
    @rmdir($dir);
    if (!is_string($bytes) || strlen($bytes) < 44) {
        return null;
    }
    return $bytes;
}

function wwtcSpeakHttp(): void
{
    $raw = file_get_contents('php://input') ?: '';
    $in = json_decode($raw, true);
    $script = trim((string) (is_array($in) ? ($in['script'] ?? '') : ''));
    $why = wwtcSpeakReject($script);
    if ($why !== null) {
        http_response_code(422);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Nothing to speak.']);
        return;
    }
    $wav = wwtcSpeakWav($script);
    if ($wav === null) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'The speaking voice is not available on this server.']);
        return;
    }
    http_response_code(200);
    header('Content-Type: audio/wav');
    header('Content-Length: ' . strlen($wav));
    header('Cache-Control: no-store');
    echo $wav;
}
