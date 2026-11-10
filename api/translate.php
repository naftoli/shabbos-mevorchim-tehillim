<?php

declare(strict_types=1);

/**
 * POST /translate — page copy into Hebrew, Russian, Italian, or French.
 *
 * One code path for all four languages. The language is only a parameter.
 * Uses the same Claude key and model as POST /chat (WWTC_AI_KEY,
 * WWTC_AI_MODEL). The key stays on the server. Results are cached per
 * string so a repeat view does not call Claude again.
 *
 * Religious terms and campaign names are masked before the model sees them
 * and restored afterwards, so "Tehillim" and "Shabbos Mevorchim" are not
 * reworded.
 */

const WWTC_TRANSLATE_LANGS = ['he', 'ru', 'it', 'fr'];
const WWTC_TRANSLATE_CACHE_VERSION = '1';
const WWTC_TRANSLATE_MAX_STRINGS = 80;
const WWTC_TRANSLATE_MAX_CHARS = 1200;
const WWTC_TRANSLATE_CHUNK = 20;

function wwtcTranslateLangName(string $lang): string
{
    return [
        'he' => 'Hebrew',
        'ru' => 'Russian',
        'it' => 'Italian',
        'fr' => 'French',
    ][$lang] ?? $lang;
}

/** Same key as POST /chat. Empty when it is missing or too short to be real. */
function wwtcAiKey(): string
{
    $key = defined('WWTC_AI_KEY') ? (string) constant('WWTC_AI_KEY') : '';
    if (strlen($key) < 10) {
        if (function_exists('wwtcEnv')) {
            $key = wwtcEnv('WWTC_AI_KEY');
        } else {
            $env = getenv('WWTC_AI_KEY');
            $key = ($env === false) ? '' : (string) $env;
        }
    }
    return strlen($key) >= 10 ? $key : '';
}

/** Same model as POST /chat. */
function wwtcAiModel(): string
{
    $model = function_exists('wwtcEnv') ? wwtcEnv('WWTC_AI_MODEL') : '';
    if ($model === '') {
        $env = getenv('WWTC_AI_MODEL');
        $model = ($env === false) ? '' : (string) $env;
    }
    return $model !== '' ? $model : 'claude-haiku-5-5';
}

function wwtcRedactSecret(string $text, string $secret): string
{
    if ($secret === '') {
        return $text;
    }
    return str_replace($secret, '[redacted]', $text);
}

/**
 * Claude Messages call shared with POST /chat. Returns the text block, or
 * null on any failure. The key is never written to the log.
 */
function wwtcClaudeMessages(string $key, string $model, string $system, array $messages, int $maxTokens = 300, int $timeout = 25): ?string
{
    $payload = json_encode(
        ['model' => $model, 'max_tokens' => $maxTokens, 'system' => $system, 'messages' => $messages],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    if (!is_string($payload)) {
        return null;
    }
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . $key],
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => $timeout,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if (!is_string($raw) || $status < 200 || $status >= 300) {
        $logBody = is_string($raw) ? wwtcRedactSecret(mb_substr($raw, 0, 500), $key) : '';
        error_log('WWTC Claude error: status ' . $status . ' ' . $err . ' ' . $logBody);
        return null;
    }
    $data = json_decode($raw, true);
    $text = '';
    foreach ((array) ($data['content'] ?? []) as $block) {
        if (is_array($block) && ($block['type'] ?? '') === 'text') {
            $text .= (string) ($block['text'] ?? '');
        }
    }
    $text = trim($text);
    return $text === '' ? null : $text;
}

/** @return list<string> */
function wwtcTranslateProtectedTerms(): array
{
    static $terms;
    if ($terms !== null) {
        return $terms;
    }
    $terms = [
        'Worldwide Tehillim Campaign',
        'Worldwide Tehillim Club',
        'Tzivos Hashem',
        'Shabbos Mevorchim',
        'Sefer Tehillim',
        'Rosh Hashanah',
        'Rosh Hashana',
        'Yom Kippur',
        'Kapitelach',
        'kapitlach',
        'Kapitel',
        'kapitel',
        'chayolim',
        'chayol',
        'Tehillim',
        'Mevorchim',
        'Moshiach',
        'Hatzlacha',
        'Chassidus',
        'Chodesh',
        'Shabbos',
        'Tishrei',
        'Cheshvan',
        'Kislev',
        'Teves',
        'Shvat',
        'Adar II',
        'Adar I',
        'Nissan',
        'Iyar',
        'Sivan',
        'Tammuz',
        'Elul',
        'Adar',
        'Av',
    ];
    usort($terms, static function ($a, $b) {
        $len = mb_strlen($b) <=> mb_strlen($a);
        return $len !== 0 ? $len : strcmp($a, $b);
    });
    return $terms;
}

/**
 * Replace protected terms with stable placeholders. The matched spelling is
 * what gets restored, so a capital "Kapitel" stays "Kapitel".
 *
 * @return array{0:string,1:array<string,string>}
 */
function wwtcMaskTerms(string $text): array
{
    $map = [];
    $i = 0;
    foreach (wwtcTranslateProtectedTerms() as $term) {
        $pattern = '/(?<![\p{L}\p{N}])' . preg_quote($term, '/') . '(?![\p{L}\p{N}])/iu';
        $text = (string) preg_replace_callback($pattern, static function (array $m) use (&$map, &$i): string {
            $token = '⟦' . $i . '⟧';
            $map[$token] = $m[0];
            $i++;
            return $token;
        }, $text);
    }
    return [$text, $map];
}

/** Restore placeholders. Null when the model dropped or invented one. */
function wwtcUnmaskTerms(string $text, array $map): ?string
{
    foreach ($map as $token => $original) {
        if (!str_contains($text, $token)) {
            return null;
        }
        $text = str_replace($token, $original, $text);
    }
    if (preg_match('/⟦\d+⟧/u', $text)) {
        return null;
    }
    return $text;
}

function wwtcTranslateLooksLikeSecret(string $text): bool
{
    $t = trim($text);
    if ($t === '') {
        return false;
    }
    if (preg_match('/^\d{5,}$/', $t)) {
        return true;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $t)) {
        return true;
    }
    if (preg_match('/^sk-[A-Za-z0-9_\-]{8,}$/', $t)) {
        return true;
    }
    if (preg_match('/^Bearer\s+\S+$/i', $t)) {
        return true;
    }
    if (preg_match('/^eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/', $t)) {
        return true;
    }
    if (preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $t)) {
        return true;
    }
    return false;
}

function wwtcTranslateCacheDir(): string
{
    $base = sys_get_temp_dir();
    if (defined('MASHPIA_LOG_DIR') && (string) MASHPIA_LOG_DIR !== '') {
        $base = (string) MASHPIA_LOG_DIR;
    } elseif (function_exists('wwtcCacheDir')) {
        $parent = dirname(wwtcCacheDir());
        if ($parent !== '' && $parent !== '.' && $parent !== DIRECTORY_SEPARATOR) {
            $base = $parent;
        }
    }
    $dir = rtrim($base, '/') . '/wwtc-translate-cache';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function wwtcTranslateCachePath(string $dir, string $lang, string $masked): string
{
    $stamp = WWTC_TRANSLATE_CACHE_VERSION . "\n" . implode("\n", wwtcTranslateProtectedTerms());
    $hash = hash('sha256', $stamp . "\n" . wwtcAiModel() . "\n" . $lang . "\n" . $masked);
    return rtrim($dir, '/') . '/' . $hash . '.txt';
}

function wwtcTranslateCacheGet(string $dir, string $lang, string $masked): ?string
{
    $raw = @file_get_contents(wwtcTranslateCachePath($dir, $lang, $masked));
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    return $raw;
}

function wwtcTranslateCachePut(string $dir, string $lang, string $masked, string $translation): void
{
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $path = wwtcTranslateCachePath($dir, $lang, $masked);
    $tmp = $path . '.' . getmypid() . '.tmp';
    if (@file_put_contents($tmp, $translation) === false) {
        @unlink($tmp);
        return;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
    }
}

/** A string that is only placeholders, numbers, and punctuation needs no model. */
function wwtcTranslateNeedsModel(string $masked): bool
{
    $left = preg_replace('/⟦\d+⟧/u', '', $masked);
    $left = trim((string) $left);
    if ($left === '') {
        return false;
    }
    return preg_match('/\p{L}/u', $left) === 1;
}

/**
 * @param list<string> $strings
 * @return list<string>|null
 */
function wwtcTranslateBatch(string $lang, array $strings, callable $caller, ?string $cacheDir = null, int $chunkSize = WWTC_TRANSLATE_CHUNK): ?array
{
    $dir = $cacheDir ?: wwtcTranslateCacheDir();
    $result = array_fill(0, count($strings), '');
    $misses = [];
    $maps = [];
    foreach ($strings as $i => $original) {
        [$masked, $map] = wwtcMaskTerms($original);
        $maps[$i] = $map;
        if (!wwtcTranslateNeedsModel($masked)) {
            $result[$i] = $original;
            continue;
        }
        $cached = wwtcTranslateCacheGet($dir, $lang, $masked);
        if ($cached !== null) {
            $restored = wwtcUnmaskTerms($cached, $map);
            $result[$i] = $restored === null ? $original : $restored;
            continue;
        }
        $misses[$i] = $masked;
    }
    if (!$misses) {
        return $result;
    }
    $size = max(1, $chunkSize);
    $indexes = array_keys($misses);
    foreach (array_chunk($indexes, $size) as $chunk) {
        $part = [];
        foreach ($chunk as $i) {
            $part[] = $misses[$i];
        }
        $translated = $caller($lang, $part);
        if (!is_array($translated) || count($translated) !== count($part)) {
            return null;
        }
        foreach ($chunk as $n => $i) {
            $piece = $translated[$n];
            if (!is_string($piece)) {
                return null;
            }
            $restored = wwtcUnmaskTerms($piece, $maps[$i]);
            if ($restored === null) {
                $result[$i] = $strings[$i];
                continue;
            }
            wwtcTranslateCachePut($dir, $lang, $misses[$i], $piece);
            $result[$i] = $restored;
        }
    }
    return $result;
}

function wwtcTranslateSystem(string $lang): string
{
    $name = wwtcTranslateLangName($lang);
    return <<<SYS
You translate short pieces of a children's website, the Worldwide Tehillim Club, a Tzivos Hashem campaign. Target language: {$name}.

Reply with ONLY a JSON array of strings. One translation per input string, same order, same count. No markdown and no commentary.

Rules:
- Keep the meaning of campaign, ladder, and rank wording. Do not add or drop facts.
- Leave every placeholder of the form ⟦0⟧ exactly as written, including the brackets and the number. Those stand for names that must not change.
- Keep numbers, percentages, and punctuation that carry meaning.
- Do not translate personal names, school names, or place names.
- Write naturally for a family reading the page. For Hebrew, use everyday Hebrew.
SYS;
}

/**
 * @param list<string> $masked
 * @return list<string>|null
 */
function wwtcClaudeTranslate(string $key, string $model, string $lang, array $masked): ?array
{
    $user = json_encode(array_values($masked), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($user)) {
        return null;
    }
    $text = wwtcClaudeMessages(
        $key,
        $model,
        wwtcTranslateSystem($lang),
        [['role' => 'user', 'content' => $user]],
        4096,
        45
    );
    if ($text === null) {
        return null;
    }
    return wwtcParseTranslationList($text, count($masked));
}

/** @return list<string>|null */
function wwtcParseTranslationList(string $text, int $expect): ?array
{
    $text = trim($text);
    if (preg_match('/^```(?:json)?\s*(.*?)\s*```$/su', $text, $m)) {
        $text = trim($m[1]);
    }
    $data = json_decode($text, true);
    if (!is_array($data)) {
        return null;
    }
    if (array_key_exists('translations', $data) && is_array($data['translations'])) {
        $data = $data['translations'];
    }
    $values = array_values($data);
    if (count($values) !== $expect) {
        return null;
    }
    $out = [];
    foreach ($values as $item) {
        if (!is_string($item)) {
            return null;
        }
        $out[] = $item;
    }
    return $out;
}

/**
 * Validate the body and translate. $caller is the stand-in for Claude in
 * tests and in the local dev router. Production passes null and uses Claude.
 * A missing key with no caller is a 503, the same idea as POST /chat.
 *
 * @return array{status:int,error?:string,body?:array}
 */
function wwtcTranslateRequest(array $input, string $key, ?callable $caller = null, ?string $cacheDir = null): array
{
    $lang = strtolower(trim((string) ($input['targetLang'] ?? '')));
    if (!in_array($lang, WWTC_TRANSLATE_LANGS, true)) {
        return ['status' => 422, 'error' => 'targetLang must be one of: he, ru, it, fr.'];
    }
    if (!array_key_exists('content', $input)) {
        return ['status' => 422, 'error' => 'Include content to translate.'];
    }
    $content = $input['content'];
    $single = is_string($content);
    if (!$single && !is_array($content)) {
        return ['status' => 422, 'error' => 'content must be a string or a list of strings.'];
    }
    $strings = $single ? [$content] : array_values($content);
    if (count($strings) > WWTC_TRANSLATE_MAX_STRINGS) {
        return ['status' => 422, 'error' => 'Send at most 80 strings at a time.'];
    }
    foreach ($strings as $item) {
        if (!is_string($item)) {
            return ['status' => 422, 'error' => 'Each entry in content must be a string.'];
        }
        if (mb_strlen($item) > WWTC_TRANSLATE_MAX_CHARS) {
            return ['status' => 422, 'error' => 'A string is too long to translate.'];
        }
        if (wwtcTranslateLooksLikeSecret($item)) {
            return ['status' => 422, 'error' => 'content must not include secrets.'];
        }
    }
    if ($caller === null && strlen($key) < 10) {
        return ['status' => 503, 'error' => 'Translation is not configured yet.'];
    }
    if ($caller === null) {
        $boundKey = $key;
        $caller = static function (string $target, array $masked) use ($boundKey): array {
            $parsed = wwtcClaudeTranslate($boundKey, wwtcAiModel(), $target, $masked);
            return $parsed ?? [];
        };
    }
    $out = wwtcTranslateBatch($lang, $strings, $caller, $cacheDir);
    if ($out === null) {
        return ['status' => 502, 'error' => 'Translation failed. Please try again.'];
    }
    if ($key !== '' && strlen($key) >= 10) {
        $encoded = json_encode($out, JSON_UNESCAPED_UNICODE);
        if (is_string($encoded) && str_contains($encoded, $key)) {
            return ['status' => 502, 'error' => 'Translation failed. Please try again.'];
        }
    }
    if ($single) {
        return ['status' => 200, 'body' => ['targetLang' => $lang, 'translation' => $out[0]]];
    }
    return ['status' => 200, 'body' => ['targetLang' => $lang, 'translations' => $out]];
}

/**
 * Local stand-in used when the dev router has no WWTC_AI_KEY. Production
 * never calls this. Phrases are real translations; anything else is filled
 * word by word so the buttons can be tried without Claude.
 *
 * @param list<string> $maskedStrings
 * @return list<string>
 */
function wwtcTranslateStub(string $lang, array $maskedStrings): array
{
    $phrases = wwtcStubPhraseMap($lang);
    $words = wwtcStubWordMap($lang);
    $out = [];
    foreach ($maskedStrings as $masked) {
        $out[] = wwtcStubOne($masked, $phrases, $words);
    }
    return $out;
}

function wwtcStubOne(string $masked, array $phrases, array $words): string
{
    if (!preg_match('/^(\s*)(.*?)(\s*)$/su', $masked, $m)) {
        return $masked;
    }
    $core = $m[2];
    $key = mb_strtolower($core);
    if (isset($phrases[$key])) {
        return $m[1] . $phrases[$key] . $m[3];
    }
    $worded = (string) preg_replace_callback("/[A-Za-z]+(?:['’][A-Za-z]+)?/u", static function (array $hit) use ($words): string {
        $word = $hit[0];
        $lookup = mb_strtolower($word);
        if (!isset($words[$lookup])) {
            return $word;
        }
        $rep = $words[$lookup];
        $first = mb_substr($word, 0, 1);
        if ($first !== '' && $first === mb_strtoupper($first) && $first !== mb_strtolower($first)) {
            return mb_strtoupper(mb_substr($rep, 0, 1)) . mb_substr($rep, 1);
        }
        return $rep;
    }, $core);
    return $m[1] . $worded . $m[3];
}

/** Put the source placeholders back into a translation that still shows the terms. */
function wwtcRetoken(string $translated, array $map): string
{
    $groups = [];
    foreach ($map as $token => $original) {
        $groups[$original][] = $token;
    }
    $originals = array_keys($groups);
    usort($originals, static function ($a, $b) {
        return mb_strlen($b) <=> mb_strlen($a);
    });
    foreach ($originals as $original) {
        if ($original === '') {
            continue;
        }
        $tokens = $groups[$original];
        $parts = explode($original, $translated);
        if (count($parts) === 1) {
            continue;
        }
        $built = (string) array_shift($parts);
        $i = 0;
        foreach ($parts as $part) {
            $token = $tokens[min($i, count($tokens) - 1)];
            $i++;
            $built .= $token . $part;
        }
        $translated = $built;
    }
    return $translated;
}

/** @return array<string,string> masked-english (lower) => masked translation */
function wwtcStubPhraseMap(string $lang): array
{
    static $cache = [];
    if (isset($cache[$lang])) {
        return $cache[$lang];
    }
    $idx = ['he' => 0, 'ru' => 1, 'it' => 2, 'fr' => 3][$lang] ?? 0;
    $map = [];
    foreach (wwtcStubPhrases() as $english => $byLang) {
        [$masked, $tokens] = wwtcMaskTerms($english);
        $map[mb_strtolower($masked)] = wwtcRetoken($byLang[$idx], $tokens);
    }
    return $cache[$lang] = $map;
}

/** @return array<string,string> */
function wwtcStubWordMap(string $lang): array
{
    static $cache = [];
    if (isset($cache[$lang])) {
        return $cache[$lang];
    }
    $idx = ['he' => 0, 'ru' => 1, 'it' => 2, 'fr' => 3][$lang] ?? 0;
    $map = [];
    foreach (wwtcStubWords() as $english => $byLang) {
        $map[mb_strtolower($english)] = $byLang[$idx];
    }
    return $cache[$lang] = $map;
}

/** @return array<string,array{0:string,1:string,2:string,3:string}> */
function wwtcStubPhrases(): array
{
    $hero1 = 'Saying the entire Tehillim on Shabbos Mevorchim is important for you, your children, and your children\'s children.';
    $hero2 = 'Train at your own pace, saying more Tehillim from month to month, until you can say the entire Tehillim every Shabbos Mevorchim.';
    $platoonLead = "A “platoon” is a class — and it’s";
    $platoonTail = 'when every single soldier in it finished their full quota of kapitlach this month.';
    $classHint = 'Classes where every single soldier finished their full quota of kapitlach';
    $chayolim = 'chayolim completed their kapitlach quota';
    return [
        'Home' => ['בית', 'Главная', 'Inizio', 'Accueil'],
        'How It Works' => ['איך זה עובד', 'Как это работает', 'Come funziona', 'Comment ça marche'],
        'My Tehillim' => ['Tehillim שלי', 'Мой Tehillim', 'Il mio Tehillim', 'Mon Tehillim'],
        'Soldier Login' => ['כניסת חייל', 'Вход солдата', 'Accesso soldato', 'Connexion soldat'],
        'School Admin' => ['ניהול בית ספר', 'Админ школы', 'Admin della scuola', 'Admin de l\'école'],
        'Admin' => ['ניהול', 'Админ', 'Admin', 'Admin'],
        'Resources' => ['חומרים', 'Материалы', 'Risorse', 'Ressources'],
        'Menu' => ['תפריט', 'Меню', 'Menu', 'Menu'],
        'Site menu' => ['תפריט האתר', 'Меню сайта', 'Menu del sito', 'Menu du site'],
        'I\'m a Soldier' => ['אני חייל', 'Я солдат', 'Sono un soldato', 'Je suis un soldat'],
        'See the Schools' => ['לראות את בתי הספר', 'Смотреть школы', 'Vedi le scuole', 'Voir les écoles'],
        'Every soldier.' => ['כל חייל.', 'Каждый солдат.', 'Ogni soldato.', 'Chaque soldat.'],
        'Every Kapitel.' => ['כל Kapitel.', 'Каждый Kapitel.', 'Ogni Kapitel.', 'Chaque Kapitel.'],
        'Shabbos Mevorchim Tehillim Campaign' => [
            'מבצע Shabbos Mevorchim Tehillim',
            'Кампания Shabbos Mevorchim Tehillim',
            'Campagna Shabbos Mevorchim Tehillim',
            'Campagne Shabbos Mevorchim Tehillim',
        ],
        $hero1 => [
            'לומר את כל Tehillim ב-Shabbos Mevorchim חשוב בשבילכם, בשביל הילדים שלכם, ובשביל הילדים של הילדים שלכם.',
            'Читать весь Tehillim в Shabbos Mevorchim важно для вас, ваших детей и детей ваших детей.',
            'Dire tutto il Tehillim di Shabbos Mevorchim è importante per voi, per i vostri figli e per i figli dei vostri figli.',
            'Dire tout le Tehillim de Shabbos Mevorchim est important pour vous, pour vos enfants et pour les enfants de vos enfants.',
        ],
        $hero2 => [
            'מתאמנים בקצב שלכם, אומרים יותר Tehillim מחודש לחודש, עד שאפשר לומר את כל Tehillim בכל Shabbos Mevorchim.',
            'Тренируйтесь в своём темпе и говорите больше Tehillim от месяца к месяцу, пока не сможете сказать весь Tehillim каждый Shabbos Mevorchim.',
            'Allenatevi al vostro ritmo, dicendo più Tehillim di mese in mese, finché potete dire tutto il Tehillim ogni Shabbos Mevorchim.',
            'Entraînez-vous à votre rythme, en disant plus de Tehillim de mois en mois, jusqu\'à pouvoir dire tout le Tehillim à chaque Shabbos Mevorchim.',
        ],
        'Army Report:' => ['דוח הצבא:', 'Отчёт армии:', 'Rapporto dell\'esercito:', 'Rapport de l\'armée :'],
        'Schools' => ['בתי ספר', 'Школы', 'Scuole', 'Écoles'],
        'Perfect Platoons' => ['פלוגות מושלמות', 'Идеальные взводы', 'Plotoni perfetti', 'Pelotons parfaits'],
        'Perfect Platoons ·' => ['פלוגות מושלמות ·', 'Идеальные взводы ·', 'Plotoni perfetti ·', 'Pelotons parfaits ·'],
        'Perfect Platoon' => ['פלוגה מושלמת', 'Идеальный взвод', 'Plotone perfetto', 'Peloton parfait'],
        $classHint => [
            'כיתות שבהן כל חייל סיים את כל מכסת ה-kapitlach',
            'Классы, где каждый солдат закончил всю свою норму kapitlach',
            'Classi in cui ogni soldato ha finito tutta la sua quota di kapitlach',
            'Des classes où chaque soldat a fini tout son quota de kapitlach',
        ],
        'Kapitlach Said' => ['kapitlach שנאמרו', 'Сказано kapitlach', 'Kapitlach detti', 'Kapitlach dits'],
        'Kapitlach Quota' => ['מכסת kapitlach', 'Норма kapitlach', 'Quota di kapitlach', 'Quota de kapitlach'],
        '— Kapitlach Said' => ['— kapitlach שנאמרו', '— сказано kapitlach', '— Kapitlach detti', '— Kapitlach dits'],
        'Minutes Quota' => ['מכסת דקות', 'Норма минут', 'Quota di minuti', 'Quota de minutes'],
        'Minutes Said' => ['דקות שנאמרו', 'Минут сказано', 'Minuti detti', 'Minutes dites'],
        'Soldiers' => ['חיילים', 'Солдаты', 'Soldati', 'Soldats'],
        'Participated' => ['השתתפו', 'Участвовали', 'Hanno partecipato', 'Ont participé'],
        'Completed Kapitlach Quota' => [
            'השלימו מכסת kapitlach',
            'Выполнили норму kapitlach',
            'Quota di kapitlach completata',
            'Quota de kapitlach terminée',
        ],
        'this year' => ['השנה', 'в этом году', 'quest\'anno', 'cette année'],
        'every year' => ['כל שנה', 'каждый год', 'ogni anno', 'chaque année'],
        'All-Time' => ['כל הזמנים', 'За всё время', 'Di sempre', 'Depuis toujours'],
        'The Race' => ['המרוץ', 'Гонка', 'La gara', 'La course'],
        'Schools going head to head' => ['בתי ספר ראש בראש', 'Школы идут ноздря в ноздрю', 'Scuole una contro l\'altra', 'Écoles au coude à coude'],
        'View more' => ['להציג עוד', 'Показать ещё', 'Vedi altro', 'Voir plus'],
        'this month' => ['החודש', 'в этом месяце', 'questo mese', 'ce mois-ci'],
        'Close' => ['סגירה', 'Закрыть', 'Chiudi', 'Fermer'],
        'Expand all' => ['לפתוח הכל', 'Развернуть всё', 'Espandi tutto', 'Tout ouvrir'],
        $platoonLead => [
            '“פלוגה” היא כיתה — והיא',
            '“Взвод” — это класс, и он',
            'Un “plotone” è una classe — ed è',
            'Un “peloton” est une classe — et il est',
        ],
        'perfect' => ['מושלמת', 'идеальный', 'perfetto', 'parfait'],
        $platoonTail => [
            'כשכל חייל בה סיים את כל מכסת ה-kapitlach החודש.',
            'когда каждый солдат в нём закончил всю свою норму kapitlach в этом месяце.',
            'quando ogni soldato ha finito tutta la sua quota di kapitlach questo mese.',
            'quand chaque soldat a fini tout son quota de kapitlach ce mois-ci.',
        ],
        'Bases In Action' => ['בסיסים בפעולה', 'Базы в деле', 'Basi in azione', 'Bases en action'],
        'Search schools by name…' => ['חיפוש בתי ספר לפי שם…', 'Поиск школ по имени…', 'Cerca scuole per nome…', 'Chercher une école par nom…'],
        'Search schools by name' => ['חיפוש בתי ספר לפי שם', 'Поиск школ по имени', 'Cerca scuole per nome', 'Chercher une école par nom'],
        $chayolim => [
            'chayolim השלימו את מכסת ה-kapitlach',
            'chayolim выполнили свою норму kapitlach',
            'chayolim hanno completato la loro quota di kapitlach',
            'chayolim ont fini leur quota de kapitlach',
        ],
        'Getting the army report' => ['מביאים את דוח הצבא', 'Загружаем отчёт армии', 'Caricamento del rapporto', 'Chargement du rapport'],
        'Army report' => ['דוח הצבא', 'Отчёт армии', 'Rapporto dell\'esercito', 'Rapport de l\'armée'],
        'Getting the school race' => ['מביאים את מרוץ בתי הספר', 'Загружаем гонку школ', 'Caricamento della gara', 'Chargement de la course'],
        'Getting perfect platoons' => ['מביאים פלוגות מושלמות', 'Загружаем идеальные взводы', 'Caricamento dei plotoni', 'Chargement des pelotons'],
        'Getting the bases' => ['מביאים את הבסיסים', 'Загружаем базы', 'Caricamento delle basi', 'Chargement des bases'],
        'Quota reached!' => ['המכסה הושגה!', 'Норма достигнута!', 'Quota raggiunta!', 'Quota atteinte !'],
        '% Soldiers' => ['% חיילים', '% солдат', '% soldati', '% soldats'],
        '% Kapitlach' => ['% kapitlach', '% kapitlach', '% kapitlach', '% kapitlach'],
        '% Time' => ['% זמן', '% времени', '% tempo', '% temps'],
        'participated' => ['השתתפו', 'участвовали', 'hanno partecipato', 'ont participé'],
        'completed quota' => ['השלימו מכסה', 'выполнили норму', 'quota completata', 'quota terminée'],
        'goal completed' => ['היעד הושלם', 'цель выполнена', 'obiettivo completato', 'objectif atteint'],
        'Demo data — anonymized sample. Add' => [
            'נתוני הדגמה — דוגמה אנונימית. הוסיפו',
            'Демо-данные — обезличенный образец. Добавьте',
            'Dati demo — esempio anonimo. Aggiungi',
            'Données de démo — exemple anonymisé. Ajoutez',
        ],
        'for live data.' => ['לנתונים חיים.', 'для живых данных.', 'per i dati dal vivo.', 'pour les données en direct.'],
        'This site was built by' => ['האתר הזה נבנה על ידי', 'Этот сайт сделал', 'Questo sito è stato costruito da', 'Ce site a été construit par'],
        'of' => ['של', 'из', 'di', 'de'],
    ];
}

/** @return array<string,array{0:string,1:string,2:string,3:string}> */
function wwtcStubWords(): array
{
    return [
        'schools' => ['בתי ספר', 'школы', 'scuole', 'écoles'],
        'school' => ['בית ספר', 'школа', 'scuola', 'école'],
        'soldiers' => ['חיילים', 'солдаты', 'soldati', 'soldats'],
        'soldier' => ['חייל', 'солдат', 'soldato', 'soldat'],
        'quota' => ['מכסה', 'норма', 'quota', 'quota'],
        'said' => ['נאמרו', 'сказано', 'detti', 'dits'],
        'completed' => ['השלימו', 'выполнили', 'completato', 'terminé'],
        'participated' => ['השתתפו', 'участвовали', 'partecipato', 'participé'],
        'minutes' => ['דקות', 'минуты', 'minuti', 'minutes'],
        'perfect' => ['מושלם', 'идеальный', 'perfetto', 'parfait'],
        'platoons' => ['פלוגות', 'взводы', 'plotoni', 'pelotons'],
        'platoon' => ['פלוגה', 'взвод', 'plotone', 'peloton'],
        'classes' => ['כיתות', 'классы', 'classi', 'classes'],
        'class' => ['כיתה', 'класс', 'classe', 'classe'],
        'every' => ['כל', 'каждый', 'ogni', 'chaque'],
        'month' => ['חודש', 'месяц', 'mese', 'mois'],
        'year' => ['שנה', 'год', 'anno', 'année'],
        'more' => ['עוד', 'ещё', 'altro', 'plus'],
        'view' => ['הצג', 'показать', 'vedi', 'voir'],
        'search' => ['חיפוש', 'поиск', 'cerca', 'chercher'],
        'goal' => ['יעד', 'цель', 'obiettivo', 'objectif'],
        'report' => ['דוח', 'отчёт', 'rapporto', 'rapport'],
        'army' => ['צבא', 'армия', 'esercito', 'armée'],
        'bases' => ['בסיסים', 'базы', 'basi', 'bases'],
        'action' => ['פעולה', 'деле', 'azione', 'action'],
        'important' => ['חשוב', 'важно', 'importante', 'important'],
        'children' => ['ילדים', 'дети', 'figli', 'enfants'],
        'finished' => ['סיים', 'закончил', 'finito', 'fini'],
        'their' => ['שלהם', 'их', 'loro', 'leur'],
        'this' => ['זה', 'этот', 'questo', 'ce'],
        'when' => ['כאשר', 'когда', 'quando', 'quand'],
        'your' => ['שלכם', 'ваш', 'vostro', 'votre'],
        'you' => ['אתם', 'вы', 'voi', 'vous'],
        'and' => ['ו', 'и', 'e', 'et'],
        'for' => ['בשביל', 'для', 'per', 'pour'],
        'with' => ['עם', 'с', 'con', 'avec'],
        'all' => ['כל', 'все', 'tutto', 'tout'],
        'time' => ['זמן', 'время', 'tempo', 'temps'],
        'match' => ['התאמה', 'совпадает', 'corrisponde', 'correspond'],
        'name' => ['שם', 'имени', 'nome', 'nom'],
        'live' => ['חיים', 'живые', 'vivo', 'direct'],
        'sample' => ['דוגמה', 'образец', 'esempio', 'exemple'],
        'data' => ['נתונים', 'данные', 'dati', 'données'],
        'site' => ['אתר', 'сайт', 'sito', 'site'],
        'built' => ['נבנה', 'создан', 'costruito', 'construit'],
        'login' => ['כניסה', 'вход', 'accesso', 'connexion'],
        'works' => ['עובד', 'работает', 'funziona', 'fonctionne'],
        'how' => ['איך', 'как', 'come', 'comment'],
        'race' => ['מרוץ', 'гонка', 'gara', 'course'],
        'close' => ['סגירה', 'закрыть', 'chiudi', 'fermer'],
        'expand' => ['פתיחה', 'развернуть', 'espandi', 'ouvrir'],
        'getting' => ['מביאים', 'загрузка', 'caricamento', 'chargement'],
        'admin' => ['ניהול', 'админ', 'admin', 'admin'],
        'resources' => ['חומרים', 'материалы', 'risorse', 'ressources'],
        'menu' => ['תפריט', 'меню', 'menu', 'menu'],
        'home' => ['בית', 'главная', 'inizio', 'accueil'],
        'single' => ['יחיד', 'каждый', 'singolo', 'seul'],
        'full' => ['מלא', 'полную', 'piena', 'plein'],
        'from' => ['מ', 'от', 'da', 'de'],
        'into' => ['אל', 'в', 'in', 'dans'],
        'where' => ['היכן', 'где', 'dove', 'où'],
        'until' => ['עד', 'пока', 'finché', 'jusqu\'à'],
        'pace' => ['קצב', 'темпе', 'ritmo', 'rythme'],
        'train' => ['התאמנו', 'тренируйтесь', 'allenatevi', 'entraînez'],
        'saying' => ['אומרים', 'говоря', 'dicendo', 'disant'],
        'entire' => ['כל', 'весь', 'tutto', 'tout'],
        'campaign' => ['מבצע', 'кампания', 'campagna', 'campagne'],
        'dedication' => ['הקדשה', 'посвящение', 'dedica', 'dédicace'],
        'reached' => ['הושגה', 'достигнута', 'raggiunta', 'atteinte'],
        'anonymized' => ['אנונימי', 'обезличенный', 'anonimo', 'anonymisé'],
        'demo' => ['הדגמה', 'демо', 'demo', 'démo'],
    ];
}
