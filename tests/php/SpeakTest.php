<?php

declare(strict_types=1);

require __DIR__ . '/../../api/speak.php';

function expect(bool $ok, string $message): void
{
    if ($ok) {
        echo "ok   - $message\n";
        return;
    }
    fwrite(STDERR, "FAIL - $message\n");
    exit(1);
}

expect(wwtcSpeakReject('') === 'empty', 'an empty script is refused');
expect(wwtcSpeakReject(str_repeat('a', 8001)) === 'empty', 'an overlong script is refused');
expect(wwtcSpeakReject("[[x'ESvn]]\xC2\xA0") === 'bad', 'a non-ascii script is refused');
expect(wwtcSpeakReject("[[x'ESvn]]") === null, 'a ches phoneme script is accepted');
expect(wwtcSpeakWav('not a script' . "\xC2\xA0") === null, 'a refused script does not call the voice');

$index = (string) file_get_contents(__DIR__ . '/../../api/index.php');
$route = (string) file_get_contents(__DIR__ . '/../../api/routes/speak.php');
$dev = (string) file_get_contents(__DIR__ . '/../../api/dev-router.php');
expect(strpos($index, '/routes/speak.php') !== false, 'the router loads the speak route');
expect(strpos($index, '/routes/admin.php') !== false, 'the router still loads the split admin routes');
expect(strpos($route, "\$path === '/speak'") !== false, 'POST /speak is the speak route');
expect(strpos($dev, 'wwtcSpeakHttp()') !== false, 'the dev router speaks before bootstrap');

$bin = trim((string) (getenv('WWTC_ESPEAK') ?: 'espeak-ng'));
$resolved = $bin;
if ($bin !== '' && !str_contains($bin, '/')) {
    $found = shell_exec('command -v ' . escapeshellarg($bin) . ' 2>/dev/null');
    $resolved = is_string($found) ? trim($found) : '';
}
if ($resolved !== '' && is_executable($resolved)) {
    $wav = wwtcSpeakWav("[[x'ESvn]]");
    expect(is_string($wav) && str_starts_with($wav, 'RIFF') && strlen($wav) >= 44, 'eSpeak returns a wav for the ches phoneme');
} else {
    expect(true, 'espeak-ng is not installed; wav generation skipped');
}

echo "ok\n";
