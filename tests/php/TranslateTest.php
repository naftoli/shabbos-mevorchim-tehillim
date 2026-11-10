<?php

declare(strict_types=1);

require __DIR__ . '/../../api/translate.php';

function expect(bool $ok, string $message): void
{
    if ($ok) {
        return;
    }
    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

$dir = sys_get_temp_dir() . '/wwtc-translate-test-' . bin2hex(random_bytes(4));
mkdir($dir);
putenv('WWTC_AI_MODEL');
putenv('WWTC_AI_KEY');

expect(wwtcAiKey() === '', 'missing key is empty');
putenv('WWTC_AI_KEY=short');
expect(wwtcAiKey() === '', 'short key is empty');
putenv('WWTC_AI_KEY=1234567890abcdef');
expect(wwtcAiKey() === '1234567890abcdef', 'reads WWTC_AI_KEY');
putenv('WWTC_AI_KEY');
expect(wwtcAiModel() === 'claude-haiku-5-5', 'default model matches /chat');
putenv('WWTC_AI_MODEL=claude-test');
expect(wwtcAiModel() === 'claude-test', 'WWTC_AI_MODEL overrides');
putenv('WWTC_AI_MODEL');

expect(wwtcRedactSecret('error sk-live-key-value tail', 'sk-live-key-value') === 'error [redacted] tail', 'logs redact the key');

$parsed = wwtcParseTranslationList("```json\n[\"א\", \"ב\"]\n```", 2);
expect($parsed === ['א', 'ב'], 'strips a json fence');
expect(wwtcParseTranslationList('{"translations":["Ciao"]}', 1) === ['Ciao'], 'accepts a translations object');
expect(wwtcParseTranslationList('["only"]', 2) === null, 'rejects a short list');
expect(wwtcParseTranslationList('not json', 1) === null, 'rejects prose');

$calls = 0;
$kept = wwtcTranslateBatch('fr', ['Read Tehillim on Shabbos Mevorchim today'], static function (string $lang, array $masked) use (&$calls): array {
    $calls++;
    expect($lang === 'fr', 'language is a parameter');
    expect(!str_contains(implode(' ', $masked), 'Tehillim'), 'model does not see Tehillim');
    expect(!str_contains(implode(' ', $masked), 'Shabbos'), 'model does not see Shabbos Mevorchim');
    return array_map(static fn ($s) => 'TR ' . $s, $masked);
}, $dir);
expect($kept !== null && $kept[0] === 'TR Read Tehillim on Shabbos Mevorchim today', 'terms are restored');
wwtcTranslateBatch('fr', ['Read Tehillim on Shabbos Mevorchim today'], static function () use (&$calls): array {
    $calls++;
    return ['should not run'];
}, $dir);
expect($calls === 1, 'a repeated string is served from the cache');

$alone = 0;
$only = wwtcTranslateBatch('he', ['Tehillim'], static function () use (&$alone): array {
    $alone++;
    return [];
}, $dir);
expect($alone === 0 && $only === ['Tehillim'], 'a protected term is not sent off');

$have = wwtcTranslateBatch('it', ['I have a ladder'], static function (string $lang, array $masked): array {
    return array_map(static fn ($s) => 'TR ' . $s, $masked);
}, $dir);
expect($have !== null && str_contains($have[0], 'have') && str_contains($have[0], 'ladder'), 'ordinary words stay intact');

$chunks = 0;
$chunked = wwtcTranslateBatch('ru', ['One', 'Two', 'Three'], static function (string $lang, array $masked) use (&$chunks): array {
    $chunks++;
    return array_map(static fn ($s) => 'X' . $s, $masked);
}, $dir, 2);
expect($chunks === 2 && $chunked === ['XOne', 'XTwo', 'XThree'], 'one code path chunks the list');

$bad = wwtcTranslateBatch('it', ['One', 'Two'], static function (): array {
    return ['Solo'];
}, $dir);
expect($bad === null, 'a short model reply fails the batch');

expect(wwtcTranslateRequest(['targetLang' => 'es', 'content' => 'Home'], '1234567890abcdef')['status'] === 422, 'rejects other language codes');
expect(wwtcTranslateRequest(['targetLang' => 'he'], '1234567890abcdef')['status'] === 422, 'content is required');
expect(wwtcTranslateRequest(['targetLang' => 'he', 'content' => ['Home', 12]], '1234567890abcdef')['status'] === 422, 'list entries are strings');
expect(wwtcTranslateRequest(['targetLang' => 'HE', 'content' => 'Home'], '')['status'] === 503, 'missing key is 503, same as /chat');

$secretCalls = 0;
$secret = wwtcTranslateRequest(
    ['targetLang' => 'he', 'content' => '2015-05-05'],
    '1234567890abcdef',
    static function () use (&$secretCalls): array {
        $secretCalls++;
        return ['no'];
    },
    $dir
);
expect($secret['status'] === 422 && $secretCalls === 0, 'a date of birth is refused before translation');
expect(wwtcTranslateRequest(['targetLang' => 'ru', 'content' => '123456'], '1234567890abcdef')['status'] === 422, 'a serial is refused');
expect(wwtcTranslateRequest(['targetLang' => 'ru', 'content' => 'Bearer abc.def.ghi'], '1234567890abcdef')['status'] === 422, 'a bearer token is refused');
expect(wwtcTranslateRequest(['targetLang' => 'fr', 'content' => 'sk-abcdefghijklmnop'], '1234567890abcdef')['status'] === 422, 'an API key is refused');

$echo = wwtcTranslateRequest(
    ['targetLang' => 'fr', 'content' => 'Hi'],
    '1234567890abcdef',
    static function (): array {
        return ['1234567890abcdef'];
    },
    $dir
);
expect($echo['status'] === 502, 'a reply that contains the key is dropped');
expect(!str_contains(json_encode($echo), '1234567890abcdef'), 'the error body has no key');

$allowed = wwtcTranslateRequest(
    ['targetLang' => 'he', 'content' => 'Say 150 kapitlach'],
    '1234567890abcdef',
    static function (string $lang, array $masked): array {
        return $masked;
    },
    $dir
);
expect($allowed['status'] === 200 && str_contains($allowed['body']['translation'], 'kapitlach'), 'a sentence that mentions a number is translated');

$list = wwtcTranslateRequest(
    ['targetLang' => 'it', 'content' => ['Home', 'Schools']],
    '',
    'wwtcTranslateStub',
    $dir
);
expect($list['status'] === 200, 'stub list status');
expect(($list['body']['translations'] ?? []) === ['Inizio', 'Scuole'], 'stub list keeps order');

foreach (['he' => 'בית', 'ru' => 'Главная', 'it' => 'Inizio', 'fr' => 'Accueil'] as $lang => $word) {
    $row = wwtcTranslateRequest(['targetLang' => $lang, 'content' => 'Home'], '', 'wwtcTranslateStub', $dir);
    expect($row['status'] === 200 && ($row['body']['translation'] ?? '') === $word, "stub Home {$lang}");
}

$hero = 'Saying the entire Tehillim on Shabbos Mevorchim is important for you, your children, and your children\'s children.';
$heroHe = wwtcTranslateRequest(['targetLang' => 'he', 'content' => $hero], '', 'wwtcTranslateStub', $dir);
expect($heroHe['status'] === 200, 'hero status');
$heroText = (string) ($heroHe['body']['translation'] ?? '');
expect(str_contains($heroText, 'Tehillim') && str_contains($heroText, 'Shabbos Mevorchim'), 'hero keeps the campaign names');
expect(preg_match('/\p{Hebrew}/u', $heroText) === 1, 'hero is Hebrew');

$index = (string) file_get_contents(__DIR__ . '/../../api/index.php');
expect(str_contains($index, "\$path === '/translate'"), 'POST /translate is registered');
expect(str_contains($index, 'wwtcTranslateRequest(wwtcInput(), wwtcAiKey())'), 'the route uses the chat key');
expect(str_contains($index, 'function wwtcGeneralAsk'), 'chat still calls Claude');
expect(!str_contains($index, 'WWTC_TRANSLATE'), 'no new translation key');

foreach (scandir($dir) ?: [] as $item) {
    if ($item === '.' || $item === '..') {
        continue;
    }
    unlink($dir . '/' . $item);
}
rmdir($dir);

echo "Translate checks passed\n";
