<?php

declare(strict_types=1);

require_once __DIR__ . '/platoonGrade.php';

/**
 * Perfect Platoon graphics: which classes are new, the ledger, the placeholder
 * renderer, and the public/office payloads.
 *
 * The daily job reads perfect platoons through wwtcPerfectPlatoonRows(), the
 * same mission-mark query as GET /perfect-platoons. It does not open a browser.
 *
 * Student names are never selected. School WhatsApp numbers are read only by
 * the office handlers, from wwtc_school_contacts, and never copied onto a
 * public payload.
 *
 * RENDERER CONTRACT
 * -----------------
 * wwtcRenderPlatoonGraphic($job) writes one 1080×1080 PNG.
 * $job keys: schoolName, classLabel, logoPath, month, year, backgroundPath, outPath.
 * logoPath may be null when the school has no local shield file.
 * backgroundPath must already exist (the month header is in that art).
 *
 * The body of this function is a PLACEHOLDER. It stamps the words PLACEHOLDER
 * and "NOT THE FINAL ART" over the month background. It is not a poster design.
 * When Sholem's platoon_render.py is on the server, set:
 *
 *   WWTC_PLATOON_RENDER_CMD="python3 /ABSOLUTE/PATH/platoon_render.py"
 *
 * The command is executed with one argument: a JSON file of the same $job,
 * plus "width": 1080 and "height": 1080. Exit 0 only after writing outPath
 * as a 1080×1080 PNG. Sent marks are not cleared by a later --rerender.
 */

const WWTC_PLATOON_GRAPHIC_PX = 1080;

function wwtcPlatoonRendererId(): string
{
    $cmd = function_exists('wwtcEnv')
        ? wwtcEnv('WWTC_PLATOON_RENDER_CMD', (string) getenv('WWTC_PLATOON_RENDER_CMD'))
        : (string) getenv('WWTC_PLATOON_RENDER_CMD');
    return trim($cmd) !== '' ? 'command' : 'placeholder';
}

function wwtcPlatoonGraphicsDir(): string
{
    $env = function_exists('wwtcEnv')
        ? wwtcEnv('WWTC_PLATOON_GRAPHICS_DIR', (string) getenv('WWTC_PLATOON_GRAPHICS_DIR'))
        : (string) getenv('WWTC_PLATOON_GRAPHICS_DIR');
    if (trim($env) !== '') {
        return rtrim($env, '/');
    }
    if (defined('MASHPIA_LOG_DIR')) {
        return rtrim((string) MASHPIA_LOG_DIR, '/') . '/wwtc-platoon-graphics';
    }
    return dirname(__DIR__) . '/var/platoon-graphics';
}

function wwtcPlatoonGraphicsUsage(): string
{
    $dir = wwtcPlatoonGraphicsDir();
    return <<<TXT
Perfect Platoon graphics

  php api/bin/make-platoon-graphics.php
      Make this month's NEW graphics only. Classes already in the ledger are skipped.

  php api/bin/make-platoon-graphics.php --month="Adar I" --year=5787
      A named campaign month. Adar I and Adar II are separate. "Adar 1" is Adar I.

  php api/bin/make-platoon-graphics.php --rerender
      Draw again over graphics already in the ledger (for when the real renderer
      replaces this placeholder). Sent / not-sent marks are kept.

  php api/bin/import-platoon-graphics-ledger.php --file=ledger.csv
  php api/bin/import-platoon-graphics-ledger.php --file=ledger.json --dry-run
      Load the existing ledger (the 45 graphics already made) so the daily job
      does not make them again. Header names are flexible. See
      api/platoon-graphics/README.md.

Crontab (daily, after morning marks; replace the path with this app on the server):

  15 6 * * * php /ABSOLUTE/PATH/shabbos-mevorchim-tehillim/api/bin/make-platoon-graphics.php >> /var/log/wwtc-platoon-graphics.log 2>&1

Before the first run, on the server (not from this repo's deploy):

  1. Run api/sql/wwtc_platoon_graphics.sql once on the mashpia database.
  2. Create a durable directory outside the web root and point the job at it:

       WWTC_PLATOON_GRAPHICS_DIR={$dir}

     When that variable is unset, files land in MASHPIA_LOG_DIR/wwtc-platoon-graphics
     if that constant exists, otherwise var/platoon-graphics inside this app.
  3. Put each month's background where api/platoon-graphics/backgrounds.php points.
     The job exits with an error instead of drawing when that file is missing.

TXT;
}

function wwtcGraphicsCliWantsHelp(array $argv): bool
{
    foreach ($argv as $arg) {
        if ($arg === '--help' || $arg === '-h') {
            return true;
        }
    }
    return false;
}

/** @param array<int,string> $argv */
function wwtcGraphicsCliOptions(array $argv): array
{
    $opts = ['month' => '', 'year' => 0, 'rerender' => false, 'dryRun' => false, 'file' => ''];
    foreach (array_slice($argv, 1) as $arg) {
        if ($arg === '--rerender') {
            $opts['rerender'] = true;
        } elseif ($arg === '--dry-run') {
            $opts['dryRun'] = true;
        } elseif (strpos($arg, '--month=') === 0) {
            $opts['month'] = wwtcNormalizeCampaignMonth(substr($arg, 8));
        } elseif (strpos($arg, '--year=') === 0) {
            $opts['year'] = (int) substr($arg, 7);
        } elseif (strpos($arg, '--file=') === 0) {
            $opts['file'] = substr($arg, 7);
        }
    }
    return $opts;
}

function wwtcLoadBackgroundMap(string $configFile): array
{
    static $cache = [];
    $key = realpath($configFile) ?: $configFile;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $map = require $configFile;
    // require returns true when this process already loaded the file.
    if (!is_array($map)) {
        $copy = tempnam(sys_get_temp_dir(), 'wwtc-bg-');
        $php = $copy . '.php';
        @unlink($copy);
        if (!@copy($configFile, $php)) {
            throw new RuntimeException("Could not read the background config {$configFile}.");
        }
        $map = require $php;
        @unlink($php);
    }
    if (!is_array($map)) {
        throw new RuntimeException("Background config did not return a list: {$configFile}");
    }
    return $cache[$key] = $map;
}

function wwtcMissingBackgroundMessage(string $month, string $path): string
{
    $shown = $path !== '' ? $path : '(no path configured)';
    return "Missing Perfect Platoon background for {$month}. "
        . "The month header is part of the background art, so this month needs its own file.\n"
        . "Expected: {$shown}\n"
        . "Add that file (see api/platoon-graphics/backgrounds.php) or set WWTC_PLATOON_BACKGROUNDS_DIR. "
        . "Adar, Adar I, and Adar II are separate files.";
}

function wwtcBackgroundPathForMonth(string $month, ?string $configFile = null): string
{
    $month = wwtcNormalizeCampaignMonth($month);
    $configFile = $configFile ?: (__DIR__ . '/platoon-graphics/backgrounds.php');
    if (!is_file($configFile)) {
        throw new RuntimeException("No Perfect Platoon background config at {$configFile}.");
    }
    $map = wwtcLoadBackgroundMap($configFile);
    if (!isset($map[$month]) || trim((string) $map[$month]) === '') {
        throw new RuntimeException(
            "No Perfect Platoon background is configured for {$month}. "
            . "Add a path in api/platoon-graphics/backgrounds.php. "
            . "Adar, Adar I, and Adar II are separate keys."
        );
    }
    $rel = str_replace('\\', '/', (string) $map[$month]);
    $override = function_exists('wwtcEnv')
        ? wwtcEnv('WWTC_PLATOON_BACKGROUNDS_DIR', (string) getenv('WWTC_PLATOON_BACKGROUNDS_DIR'))
        : (string) getenv('WWTC_PLATOON_BACKGROUNDS_DIR');
    if (trim($override) !== '') {
        $path = rtrim($override, '/') . '/' . basename($rel);
    } elseif (isset($rel[0]) && $rel[0] === '/') {
        $path = $rel;
    } else {
        $path = dirname($configFile) . '/' . $rel;
    }
    if (!is_file($path)) {
        throw new RuntimeException(wwtcMissingBackgroundMessage($month, $path));
    }
    return $path;
}

function wwtcPlatoonGraphicKey(array $row): string
{
    $schoolId = (string) ($row['schoolId'] ?? $row['school_id'] ?? '');
    $parts = wwtcNormalizeClassParts(
        (string) ($row['className'] ?? $row['class_name'] ?? ''),
        (string) ($row['grade'] ?? '')
    );
    $year = (string) ($row['year'] ?? $row['campaign_year'] ?? '');
    $month = wwtcNormalizeCampaignMonth((string) ($row['month'] ?? $row['month_name'] ?? ''));
    return strtolower(implode("\n", [$schoolId, $parts['className'], $parts['grade'], $year, $month]));
}

/**
 * Platoons that are not already in the ledger for this month.
 * $platoons use the /perfect-platoons shape. $ledgerRows may use either
 * camelCase or the SQL column names. Month and year fill in when a platoon
 * row itself has none (the live query is for one date).
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcNewPlatoonJobs(array $platoons, array $ledgerRows, int $year, string $month): array
{
    $have = [];
    foreach ($ledgerRows as $row) {
        if (!isset($row['year']) && !isset($row['campaign_year'])) {
            $row['year'] = $year;
        }
        if (!isset($row['month']) && !isset($row['month_name'])) {
            $row['month'] = $month;
        }
        $have[wwtcPlatoonGraphicKey($row)] = true;
    }
    $new = [];
    foreach ($platoons as $platoon) {
        if (!isset($platoon['year']) && !isset($platoon['campaign_year'])) {
            $platoon['year'] = $year;
        }
        if (!isset($platoon['month']) && !isset($platoon['month_name'])) {
            $platoon['month'] = $month;
        }
        if (!isset($have[wwtcPlatoonGraphicKey($platoon)])) {
            $new[] = $platoon;
        }
    }
    return $new;
}

/**
 * A graphic is NEW when this school was already sent at least one graphic
 * this month and this one is still unsent. The first batch is just "to send".
 *
 * @param array<int,array<string,mixed>> $rows
 * @return array<int,array<string,mixed>>
 */
function wwtcAttachNewFlags(array $rows): array
{
    $sentSchools = [];
    foreach ($rows as $row) {
        $sent = !empty($row['sent']) || !empty($row['sent_at']) || !empty($row['sentAt']);
        if ($sent) {
            $sentSchools[(string) ($row['school_id'] ?? $row['schoolId'] ?? '')] = true;
        }
    }
    foreach ($rows as $i => $row) {
        $sent = !empty($row['sent']) || !empty($row['sent_at']) || !empty($row['sentAt']);
        $sid = (string) ($row['school_id'] ?? $row['schoolId'] ?? '');
        $rows[$i]['sent'] = $sent;
        $rows[$i]['isNew'] = !$sent && !empty($sentSchools[$sid]);
    }
    return $rows;
}

function wwtcSchoolSendState(array $school): string
{
    $graphics = $school['graphics'] ?? [];
    if (!$graphics) {
        return 'none';
    }
    foreach ($graphics as $graphic) {
        if (empty($graphic['sent'])) {
            return 'to-send';
        }
    }
    return 'sent';
}

/** @return array<int,array<string,mixed>> */
function wwtcFilterOfficeTab(array $schools, string $tab): array
{
    $tab = strtolower(trim($tab));
    if ($tab === '' || $tab === 'to-send' || $tab === 'tosend' || $tab === 'pending') {
        $want = 'to-send';
    } elseif ($tab === 'sent') {
        $want = 'sent';
    } else {
        return array_values($schools);
    }
    $out = [];
    foreach ($schools as $school) {
        if (wwtcSchoolSendState($school) === $want) {
            $out[] = $school;
        }
    }
    return $out;
}

/**
 * HQ (admin auth super) sees every school: null.
 * A school admin sees the school ids on their admin_auths rows.
 * Anyone else is refused: false.
 *
 * @param int[] $adminSchoolIds
 * @return array<int,int>|null|false
 */
function wwtcOfficeSchoolScope(?array $actor, array $adminSchoolIds = [])
{
    if (!is_array($actor)) {
        return false;
    }
    $type = (string) ($actor['type'] ?? '');
    if ($type !== 'admin') {
        return false;
    }
    if (($actor['auth'] ?? '') === 'super') {
        return null;
    }
    $ids = [];
    foreach ($adminSchoolIds as $id) {
        $id = (int) $id;
        if ($id > 0) {
            $ids[$id] = $id;
        }
    }
    return array_values($ids);
}

/** @param array<int,int>|null $schoolIds null = every school */
function wwtcScopeGraphicRows(array $rows, ?array $schoolIds): array
{
    if ($schoolIds === null) {
        return array_values($rows);
    }
    $allow = [];
    foreach ($schoolIds as $id) {
        $allow[(string) (int) $id] = true;
    }
    $out = [];
    foreach ($rows as $row) {
        $sid = (string) (int) ($row['school_id'] ?? $row['schoolId'] ?? 0);
        if (isset($allow[$sid])) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * Public schools and graphics. Extra keys (whatsapp, sent, student names)
 * are dropped. Only these fields leave the building.
 *
 * @param array<int,array<string,mixed>> $rows ledger rows
 * @param array<int,string|null> $logos school id => logo url
 * @return array<int,array<string,mixed>>
 */
function wwtcPublicSchoolsFromRows(array $rows, array $logos = []): array
{
    $by = [];
    foreach ($rows as $row) {
        $sid = (int) ($row['school_id'] ?? $row['schoolId'] ?? 0);
        if (!isset($by[$sid])) {
            $by[$sid] = [
                'id' => $sid,
                'name' => (string) ($row['school_name'] ?? $row['school'] ?? $row['name'] ?? ''),
                'logo' => $logos[$sid] ?? ($row['logo'] ?? null),
                'graphics' => [],
            ];
        }
        $file = (string) ($row['file_path'] ?? '');
        $id = (int) ($row['id'] ?? 0);
        $grade = (string) ($row['grade'] ?? '');
        $className = (string) ($row['class_name'] ?? $row['className'] ?? '');
        $fileUrl = null;
        if ($file !== '' && is_file($file)) {
            $fileUrl = wwtcPlatoonGraphicPublicUrl($id);
        }
        $by[$sid]['graphics'][] = [
            'id' => $id,
            'className' => $className,
            'grade' => $grade,
            'gradeLabel' => (string) ($row['grade_label'] ?? $row['gradeLabel'] ?? (wwtcKitahLabel($grade) ?? '')),
            'classLabel' => wwtcPlatoonClassLabel($grade, $className),
            'fileUrl' => $fileUrl,
            'madeAt' => isset($row['made_at']) ? (string) $row['made_at'] : (isset($row['madeAt']) ? (string) $row['madeAt'] : null),
        ];
    }
    $schools = array_values($by);
    usort($schools, static function ($a, $b) {
        return strcasecmp((string) $a['name'], (string) $b['name']);
    });
    return $schools;
}

function wwtcPlatoonGraphicPublicUrl(int $id): string
{
    $base = '/shabbos-mevorchim-tehillim/api';
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    $path = (string) (parse_url($uri, PHP_URL_PATH) ?: '');
    if (preg_match('#^(.*?)/api(?:/|$)#', $path, $m) && $m[1] !== '') {
        $base = rtrim($m[1], '/') . '/api';
    }
    return $base . '/platoon-graphics/file/' . $id;
}

function wwtcJsonHasKey(array $data, string $needle): bool
{
    foreach ($data as $key => $value) {
        if ((string) $key === $needle) {
            return true;
        }
        if (is_array($value) && wwtcJsonHasKey($value, $needle)) {
            return true;
        }
    }
    return false;
}

/**
 * @return array{digits:?string,error:?string}
 */
function wwtcNormalizeWhatsapp(?string $raw): array
{
    $text = trim((string) $raw);
    if ($text === '') {
        return ['digits' => null, 'error' => null];
    }
    if (!preg_match('/^[0-9+\s().-]{8,24}$/', $text)) {
        return ['digits' => null, 'error' => 'Use digits and a country code, for example +1 718 555 0100.'];
    }
    $digits = preg_replace('/\D+/', '', $text);
    $len = strlen((string) $digits);
    if ($len < 8 || $len > 15) {
        return ['digits' => null, 'error' => 'That number does not look like a full WhatsApp number with a country code.'];
    }
    return ['digits' => (string) $digits, 'error' => null];
}

function wwtcPlatoonGraphicFilename(array $job): string
{
    $parts = wwtcNormalizeClassParts((string) ($job['className'] ?? ''), (string) ($job['grade'] ?? ''));
    $month = strtolower(str_replace(' ', '-', wwtcNormalizeCampaignMonth((string) ($job['month'] ?? ''))));
    $class = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $parts['className']));
    $class = trim($class, '-');
    $school = preg_replace('/\D+/', '', (string) ($job['schoolId'] ?? '0'));
    return ($job['year'] ?? '0') . '-' . $month . '-' . $school . '-' . ($class !== '' ? $class : 'platoon') . '.png';
}

function wwtcLocalLogoPath(?string $url): ?string
{
    $url = trim((string) $url);
    if ($url === '' || strpos($url, 'file_view.php') !== false) {
        return null;
    }
    if (isset($url[0]) && $url[0] === '/') {
        $root = (string) ($_SERVER['DOCUMENT_ROOT'] ?? '');
        if ($root !== '') {
            $candidate = rtrim($root, '/') . $url;
            if (is_file($candidate)) {
                return $candidate;
            }
        }
    }
    $dir = function_exists('wwtcEnv')
        ? wwtcEnv('WWTC_SCHOOL_LOGOS_DIR', (string) getenv('WWTC_SCHOOL_LOGOS_DIR'))
        : (string) getenv('WWTC_SCHOOL_LOGOS_DIR');
    if ($dir !== '' && preg_match('#/schoolLogos/([^?]+)$#', $url, $m)) {
        $candidate = rtrim($dir, '/') . '/' . rawurldecode($m[1]);
        if (is_file($candidate)) {
            return $candidate;
        }
    }
    if (is_file($url)) {
        return $url;
    }
    return null;
}

/**
 * PLACEHOLDER. Draws a 1080×1080 PNG that says it is not the final art.
 * The month background is scaled underneath so a missing file still errors
 * and a present file is actually used. This is not a graphic design.
 */
function wwtcRenderPlatoonGraphicPlaceholder(array $job): string
{
    if (!extension_loaded('gd')) {
        throw new RuntimeException(
            'The placeholder Perfect Platoon renderer needs the php-gd extension. '
            . 'Install it, or set WWTC_PLATOON_RENDER_CMD to Sholem\'s platoon_render.py.'
        );
    }
    $background = (string) ($job['backgroundPath'] ?? '');
    if ($background === '' || !is_file($background)) {
        throw new RuntimeException(wwtcMissingBackgroundMessage((string) ($job['month'] ?? ''), $background));
    }
    $raw = file_get_contents($background);
    $src = $raw !== false ? @imagecreatefromstring($raw) : false;
    if (!$src) {
        throw new RuntimeException(
            "The background for " . ($job['month'] ?? '') . " is not a readable image: {$background}"
        );
    }
    $canvas = imagecreatetruecolor(WWTC_PLATOON_GRAPHIC_PX, WWTC_PLATOON_GRAPHIC_PX);
    imagealphablending($canvas, true);
    imagecopyresampled(
        $canvas,
        $src,
        0,
        0,
        0,
        0,
        WWTC_PLATOON_GRAPHIC_PX,
        WWTC_PLATOON_GRAPHIC_PX,
        imagesx($src),
        imagesy($src)
    );
    imagedestroy($src);

    $navy = imagecolorallocate($canvas, 23, 53, 111);
    imagefilledrectangle($canvas, 0, 0, WWTC_PLATOON_GRAPHIC_PX, 280, $navy);
    imagefilledrectangle($canvas, 0, 760, WWTC_PLATOON_GRAPHIC_PX, WWTC_PLATOON_GRAPHIC_PX, $navy);
    wwtcBlitPlaceholderText($canvas, 'PLACEHOLDER', 36, 8);
    wwtcBlitPlaceholderText($canvas, 'NOT THE FINAL ART', 150, 4);
    wwtcBlitPlaceholderText($canvas, (string) ($job['schoolName'] ?? ''), 800, 3);
    wwtcBlitPlaceholderText($canvas, (string) ($job['classLabel'] ?? ''), 900, 3);
    $when = trim((string) ($job['month'] ?? '') . ' ' . (string) ($job['year'] ?? ''));
    wwtcBlitPlaceholderText($canvas, $when, 990, 3);

    $out = (string) ($job['outPath'] ?? '');
    if ($out === '') {
        imagedestroy($canvas);
        throw new RuntimeException('The renderer was not given an outPath.');
    }
    $dir = dirname($out);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        imagedestroy($canvas);
        throw new RuntimeException("Could not create {$dir} for the Perfect Platoon graphic.");
    }
    imagepng($canvas, $out, 6);
    imagedestroy($canvas);
    $info = @getimagesize($out);
    if (!$info || (int) $info[0] !== WWTC_PLATOON_GRAPHIC_PX || (int) $info[1] !== WWTC_PLATOON_GRAPHIC_PX) {
        throw new RuntimeException('The placeholder renderer did not write a 1080×1080 PNG.');
    }
    return $out;
}

function wwtcBlitPlaceholderText($image, string $text, int $y, int $scale): void
{
    $text = trim((string) preg_replace('/\s+/', ' ', (string) preg_replace('/[^\x20-\x7E]/', '', $text)));
    if ($text === '') {
        return;
    }
    $font = 5;
    $w = imagefontwidth($font) * strlen($text);
    $h = imagefontheight($font);
    while ($scale > 1 && $w * $scale > 1000) {
        $scale--;
    }
    $tmp = imagecreatetruecolor(max(1, $w), max(1, $h));
    $clear = imagecolorallocate($tmp, 23, 53, 111);
    imagefilledrectangle($tmp, 0, 0, max(1, $w), max(1, $h), $clear);
    $white = imagecolorallocate($tmp, 255, 255, 255);
    imagestring($tmp, $font, 0, 0, $text, $white);
    $dw = $w * $scale;
    $dh = $h * $scale;
    $x = (int) ((WWTC_PLATOON_GRAPHIC_PX - $dw) / 2);
    imagecopyresampled($image, $tmp, max(0, $x), $y, 0, 0, $dw, $dh, max(1, $w), max(1, $h));
    imagedestroy($tmp);
}

/**
 * @return string written path
 */
function wwtcRenderPlatoonGraphic(array $job): string
{
    $background = (string) ($job['backgroundPath'] ?? '');
    if ($background === '' || !is_file($background)) {
        throw new RuntimeException(wwtcMissingBackgroundMessage((string) ($job['month'] ?? ''), $background));
    }
    $cmd = function_exists('wwtcEnv')
        ? wwtcEnv('WWTC_PLATOON_RENDER_CMD', (string) getenv('WWTC_PLATOON_RENDER_CMD'))
        : (string) getenv('WWTC_PLATOON_RENDER_CMD');
    $cmd = trim($cmd);
    if ($cmd !== '') {
        return wwtcRenderPlatoonGraphicCommand($cmd, $job);
    }
    return wwtcRenderPlatoonGraphicPlaceholder($job);
}

function wwtcSplitCommand(string $cmd): array
{
    preg_match_all('/"([^"]*)"|\'([^\']*)\'|(\S+)/', $cmd, $matches, PREG_SET_ORDER);
    $parts = [];
    foreach ($matches as $part) {
        if ($part[1] !== '') {
            $parts[] = $part[1];
        } elseif ($part[2] !== '') {
            $parts[] = $part[2];
        } else {
            $parts[] = $part[3];
        }
    }
    return $parts;
}

function wwtcRenderPlatoonGraphicCommand(string $cmd, array $job): string
{
    $parts = wwtcSplitCommand($cmd);
    if (!$parts) {
        throw new RuntimeException('WWTC_PLATOON_RENDER_CMD is empty.');
    }
    $spec = $job;
    $spec['width'] = WWTC_PLATOON_GRAPHIC_PX;
    $spec['height'] = WWTC_PLATOON_GRAPHIC_PX;
    $spec['logoPath'] = $job['logoPath'] ?? '';
    $tmp = tempnam(sys_get_temp_dir(), 'wwtc-platoon-job-');
    if ($tmp === false) {
        throw new RuntimeException('Could not write the renderer job file.');
    }
    $specPath = $tmp . '.json';
    @unlink($tmp);
    file_put_contents($specPath, json_encode($spec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $process = proc_open(array_merge($parts, [$specPath]), $descriptors, $pipes);
    if (!is_resource($process)) {
        @unlink($specPath);
        throw new RuntimeException('Could not start the Perfect Platoon renderer.');
    }
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $code = proc_close($process);
    @unlink($specPath);
    $out = (string) ($job['outPath'] ?? '');
    if ($code !== 0 || !is_file($out)) {
        $detail = trim((string) $stderr . "\n" . (string) $stdout);
        throw new RuntimeException(
            'The Perfect Platoon renderer failed'
            . ($detail !== '' ? ': ' . $detail : '.')
            . ($code !== 0 ? " (exit {$code})" : ' (no PNG written)')
        );
    }
    $info = @getimagesize($out);
    if (!$info || (int) $info[0] !== WWTC_PLATOON_GRAPHIC_PX || (int) $info[1] !== WWTC_PLATOON_GRAPHIC_PX) {
        $got = $info ? ((int) $info[0] . 'x' . (int) $info[1]) : 'unreadable';
        throw new RuntimeException("Renderer output must be a 1080×1080 PNG. Got {$got}.");
    }
    return $out;
}

// ---- ledger import (format is tolerant; Sholem's exact columns are TBD) ----

function wwtcLedgerHeaderName(string $header): ?string
{
    $compact = strtolower(trim($header));
    $compact = str_replace(['_', '-', '.'], ' ', $compact);
    $compact = str_replace(' ', '', trim((string) preg_replace('/\s+/', ' ', $compact)));
    $map = [
        'schoolid' => 'school_id',
        'schoolname' => 'school_name',
        'school' => 'school_name',
        'classname' => 'class_name',
        'class' => 'class_name',
        'platoon' => 'class_name',
        'grade' => 'grade',
        'kitah' => 'grade',
        'kita' => 'grade',
        'month' => 'month',
        'monthname' => 'month',
        'hebrewmonth' => 'month',
        'year' => 'year',
        'campaignyear' => 'year',
        'filepath' => 'file_path',
        'file' => 'file_path',
        'path' => 'file_path',
        'graphic' => 'file_path',
        'filename' => 'file_path',
        'madeat' => 'made_at',
        'made' => 'made_at',
        'created' => 'made_at',
        'createdat' => 'made_at',
        'classid' => 'class_id',
    ];
    return $map[$compact] ?? null;
}

/**
 * @return array{rows:array<int,array<string,mixed>>,errors:array<int,array<string,mixed>>,warnings:array<int,string>}
 */
function wwtcParseLedgerDocument(string $raw, string $filename = ''): array
{
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    $trim = ltrim((string) $raw);
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $asJson = $ext === 'json' || ($trim !== '' && ($trim[0] === '{' || $trim[0] === '['));
    if ($asJson) {
        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) {
            return ['rows' => [], 'errors' => [['line' => 1, 'error' => 'That file is not JSON we can read.']], 'warnings' => []];
        }
        return wwtcParseLedgerRecords(wwtcLedgerJsonRecords($decoded), 'json');
    }
    return wwtcParseLedgerRecords(wwtcLedgerCsvRecords((string) $raw), 'csv');
}

function wwtcLedgerJsonRecords(array $decoded): array
{
    foreach (['graphics', 'ledger', 'rows', 'platoons', 'data'] as $key) {
        if (isset($decoded[$key]) && is_array($decoded[$key])) {
            $decoded = $decoded[$key];
            break;
        }
    }
    if ($decoded && wwtcLedgerRowIsAssoc($decoded)) {
        $decoded = [$decoded];
    }
    $records = [];
    $line = 1;
    foreach ($decoded as $item) {
        $line++;
        if (!is_array($item)) {
            $records[] = ['line' => $line, 'fields' => null];
            continue;
        }
        $fields = [];
        foreach ($item as $key => $value) {
            $name = wwtcLedgerHeaderName((string) $key);
            if ($name !== null && !is_array($value)) {
                $fields[$name] = trim((string) $value);
            }
        }
        $records[] = ['line' => $line, 'fields' => $fields];
    }
    return $records;
}

function wwtcLedgerRowIsAssoc(array $row): bool
{
    if ($row === []) {
        return false;
    }
    return array_keys($row) !== range(0, count($row) - 1);
}

function wwtcLedgerCsvRecords(string $raw): array
{
    $lines = preg_split("/\r\n|\n|\r/", $raw);
    $kept = [];
    $numbers = [];
    foreach ($lines as $i => $line) {
        if (trim($line) === '' || preg_match('/^\s*#/', $line)) {
            continue;
        }
        $kept[] = $line;
        $numbers[] = $i + 1;
    }
    if (!$kept) {
        return [];
    }
    $delimiter = wwtcCsvDelimiter($kept[0]);
    $headerCells = str_getcsv($kept[0], $delimiter);
    $names = [];
    $recognized = 0;
    foreach ($headerCells as $cell) {
        $name = wwtcLedgerHeaderName((string) $cell);
        $names[] = $name;
        if ($name !== null) {
            $recognized++;
        }
    }
    $start = 1;
    $startLineShift = 0;
    if ($recognized === 0) {
        // No header we recognise. Documented fallback order.
        $names = ['school_id', 'school_name', 'class_name', 'grade', 'month', 'year', 'file_path'];
        $start = 0;
        $startLineShift = 1;
    }
    $records = [];
    if ($recognized > 0) {
        $records[] = ['line' => $numbers[0], 'fields' => [], 'header' => true];
    }
    for ($i = $start; $i < count($kept); $i++) {
        $cells = str_getcsv($kept[$i], $delimiter);
        $fields = [];
        $blank = true;
        foreach ($names as $c => $name) {
            if ($name === null) {
                continue;
            }
            $value = isset($cells[$c]) ? trim((string) $cells[$c]) : '';
            if ($value !== '') {
                $blank = false;
            }
            $fields[$name] = $value;
        }
        if ($blank) {
            continue;
        }
        $records[] = ['line' => $numbers[$i] ?? ($i + 1), 'fields' => $fields];
    }
    if ($recognized === 0 && $records) {
        $records[0]['warning'] = 'No header row was recognised, so columns were read as school id, school name, class, grade, month, year, file path.';
    }
    unset($startLineShift);
    return $records;
}

function wwtcCsvDelimiter(string $line): string
{
    $counts = [
        ',' => substr_count($line, ','),
        ';' => substr_count($line, ';'),
        "\t" => substr_count($line, "\t"),
    ];
    arsort($counts);
    $best = (string) array_key_first($counts);
    return $counts[$best] > 0 ? $best : ',';
}

/**
 * @param array<int,array<string,mixed>> $records
 * @return array{rows:array<int,array<string,mixed>>,errors:array<int,array<string,mixed>>,warnings:array<int,string>}
 */
function wwtcParseLedgerRecords(array $records, string $kind): array
{
    $rows = [];
    $errors = [];
    $warnings = [];
    foreach ($records as $record) {
        if (!empty($record['header'])) {
            continue;
        }
        if (!empty($record['warning'])) {
            $warnings[] = (string) $record['warning'];
        }
        $line = (int) ($record['line'] ?? 0);
        $fields = $record['fields'] ?? null;
        if (!is_array($fields)) {
            $errors[] = ['line' => $line, 'error' => 'This row is not an object.'];
            continue;
        }
        $built = wwtcBuildLedgerRow($fields, $line);
        if (isset($built['error'])) {
            $errors[] = ['line' => $line, 'error' => $built['error']];
            continue;
        }
        $rows[] = $built;
    }
    if ($kind === 'csv' && !$rows && !$errors) {
        $errors[] = ['line' => 1, 'error' => 'The CSV has no data rows.'];
    }
    return ['rows' => $rows, 'errors' => $errors, 'warnings' => $warnings];
}

/**
 * @param array<string,string> $fields
 * @return array<string,mixed>
 */
function wwtcBuildLedgerRow(array $fields, int $line): array
{
    $parts = wwtcNormalizeClassParts((string) ($fields['class_name'] ?? ''), (string) ($fields['grade'] ?? ''));
    if ($parts['grade'] === '' || $parts['className'] === '') {
        return ['error' => 'Each row needs a class or a grade (1–8, or a Kitah name such as Alef).'];
    }
    $monthRaw = trim((string) ($fields['month'] ?? ''));
    if ($monthRaw === '') {
        return ['error' => 'Each row needs a month. Adar I and Adar II stay separate (Adar 1 and Adar 2 are accepted).'];
    }
    $month = wwtcNormalizeCampaignMonth($monthRaw);
    $year = (int) preg_replace('/\D+/', '', (string) ($fields['year'] ?? ''));
    if ($year < 5700 || $year > 6000) {
        return ['error' => 'Year should be the Hebrew campaign year, for example 5786, not a Gregorian year.'];
    }
    $schoolId = (int) preg_replace('/\D+/', '', (string) ($fields['school_id'] ?? ''));
    $made = trim((string) ($fields['made_at'] ?? ''));
    $madeAt = null;
    if ($made !== '') {
        $stamp = strtotime($made);
        $madeAt = $stamp ? gmdate('Y-m-d H:i:s', $stamp) : null;
    }
    return [
        'line' => $line,
        'school_id' => $schoolId > 0 ? $schoolId : 0,
        'school_name' => trim((string) ($fields['school_name'] ?? '')),
        'class_id' => (int) ($fields['class_id'] ?? 0),
        'class_name' => $parts['className'],
        'grade' => $parts['grade'],
        'grade_label' => wwtcKitahLabel($parts['grade']) ?? $parts['grade'],
        'month' => $month,
        'year' => $year,
        'file_path' => trim((string) ($fields['file_path'] ?? '')),
        'made_at' => $madeAt,
    ];
}

/**
 * Fill school ids from a name when the file has no id. $schools is id => name,
 * the same map as wwtcEligibleSchools().
 *
 * @param array<int|string,string> $schools
 * @return array{rows:array<int,array<string,mixed>>,errors:array<int,array<string,mixed>>}
 */
function wwtcResolveLedgerSchools(array $rows, array $schools): array
{
    $byName = [];
    foreach ($schools as $id => $name) {
        $byName[wwtcNormSchoolName((string) $name)] = (int) $id;
    }
    $ready = [];
    $errors = [];
    foreach ($rows as $row) {
        $id = (int) ($row['school_id'] ?? 0);
        if ($id <= 0) {
            $id = $byName[wwtcNormSchoolName((string) ($row['school_name'] ?? ''))] ?? 0;
        }
        if ($id <= 0) {
            $errors[] = [
                'line' => (int) ($row['line'] ?? 0),
                'error' => 'No school id, and the school name does not match a Tehillim school: ' . ($row['school_name'] ?? ''),
            ];
            continue;
        }
        $row['school_id'] = $id;
        if (trim((string) ($row['school_name'] ?? '')) === '' && isset($schools[$id])) {
            $row['school_name'] = (string) $schools[$id];
        }
        $ready[] = $row;
    }
    return ['rows' => $ready, 'errors' => $errors];
}

function wwtcNormSchoolName(string $name): string
{
    $name = strtolower(trim($name));
    $name = (string) preg_replace('/[^a-z0-9]+/', ' ', $name);
    return trim($name);
}

// ---- perfect platoons (same query as GET /perfect-platoons) ----

/**
 * Perfect platoons for one Shabbos Mevorchim julian day.
 * A class is perfect when every enrolled soldier earned the mission
 * (met count >= class size), the same rule as GET /perfect-platoons.
 * No student names are selected.
 *
 * @return array<int,array<string,mixed>>
 */
function wwtcPerfectPlatoonRows(int $date): array
{
    global $MASHPIA_DB;
    $counts = wwtcCompletionCounts($date);
    $perfect = [];
    foreach ($counts['sizeByClass'] as $sid => $byClass) {
        foreach ($byClass as $cid => $size) {
            if ($size > 0 && ($counts['metByClass'][$sid][$cid] ?? 0) >= $size) {
                $perfect[(int) $cid] = ['sid' => (int) $sid, 'size' => (int) $size];
            }
        }
    }
    if (!$perfect || !isset($MASHPIA_DB)) {
        return [];
    }
    $schools = wwtcEligibleSchools();
    $ids = implode(',', array_map('intval', array_keys($perfect)));
    $meta = $MASHPIA_DB->query(
        "SELECT class_id, class_grade, class_sub, class_teacher FROM classes WHERE class_id IN ($ids)"
    )->fetchAll(PDO::FETCH_ASSOC);
    $out = [];
    foreach ($meta as $c) {
        $cid = (int) $c['class_id'];
        if (!isset($perfect[$cid])) {
            continue;
        }
        $sid = $perfect[$cid]['sid'];
        if (!isset($schools[$sid])) {
            continue;
        }
        $grade = (string) $c['class_grade'];
        $sub = (string) ($c['class_sub'] ?? '');
        $out[] = [
            'schoolId' => $sid,
            'school' => $schools[$sid],
            'classId' => $cid,
            'className' => $grade . ($sub !== '' ? '-' . $sub : ''),
            'teacher' => (string) ($c['class_teacher'] ?? ''),
            'grade' => $grade,
            'size' => $perfect[$cid]['size'],
            'schoolClasses' => isset($counts['sizeByClass'][$sid]) ? count($counts['sizeByClass'][$sid]) : 0,
        ];
    }
    return $out;
}

// ---- database ----

function wwtcPlatoonGraphicsTablesReady(): bool
{
    if (!function_exists('wwtcColumnExists')) {
        return false;
    }
    return wwtcColumnExists('wwtc_platoon_graphics', 'file_path')
        && wwtcColumnExists('wwtc_school_contacts', 'whatsapp');
}

function wwtcPlatoonGraphicsPdo(): PDO
{
    global $MASHPIA_DB;
    if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
        throw new RuntimeException('The database is not available.');
    }
    return $MASHPIA_DB;
}

/** @return array<int,array<string,mixed>> */
function wwtcLoadPlatoonGraphicRows(int $year, string $month, ?array $schoolIds): array
{
    $month = wwtcNormalizeCampaignMonth($month);
    $db = wwtcPlatoonGraphicsPdo();
    $sql = 'SELECT id, school_id, school_name, class_id, class_name, grade, grade_label,
                   campaign_year, month_name, file_path, made_at, sent_at, sent_by
              FROM wwtc_platoon_graphics
             WHERE campaign_year = :y AND month_name = :m';
    $params = [':y' => $year, ':m' => $month];
    if ($schoolIds !== null) {
        if (!$schoolIds) {
            return [];
        }
        $in = [];
        foreach (array_values($schoolIds) as $i => $id) {
            $key = ':s' . $i;
            $in[] = $key;
            $params[$key] = (int) $id;
        }
        $sql .= ' AND school_id IN (' . implode(',', $in) . ')';
    }
    $sql .= ' ORDER BY school_name, grade, class_name, id';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

/** @param int[] $schoolIds @return array<int,string> school id => digits */
function wwtcLoadSchoolContacts(array $schoolIds): array
{
    if (!$schoolIds) {
        return [];
    }
    $db = wwtcPlatoonGraphicsPdo();
    $params = [];
    $in = [];
    foreach (array_values($schoolIds) as $i => $id) {
        $key = ':c' . $i;
        $in[] = $key;
        $params[$key] = (int) $id;
    }
    $stmt = $db->prepare(
        'SELECT school_id, whatsapp FROM wwtc_school_contacts WHERE school_id IN (' . implode(',', $in) . ')'
    );
    $stmt->execute($params);
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $digits = trim((string) ($row['whatsapp'] ?? ''));
        if ($digits !== '') {
            $out[(int) $row['school_id']] = $digits;
        }
    }
    return $out;
}

/** @return 'inserted'|'exists' */
function wwtcInsertPlatoonGraphic(array $row): string
{
    $db = wwtcPlatoonGraphicsPdo();
    $made = $row['made_at'] ?? null;
    $columns = 'school_id, school_name, class_id, class_name, grade, grade_label, campaign_year, month_name, file_path';
    $values = ':school, :name, :class_id, :class_name, :grade, :label, :year, :month, :path';
    $params = [
        ':school' => (int) $row['school_id'],
        ':name' => (string) $row['school_name'],
        ':class_id' => (int) ($row['class_id'] ?? 0),
        ':class_name' => (string) $row['class_name'],
        ':grade' => (string) $row['grade'],
        ':label' => (string) ($row['grade_label'] ?? ''),
        ':year' => (int) $row['year'],
        ':month' => (string) $row['month'],
        ':path' => (string) ($row['file_path'] ?? ''),
    ];
    if (is_string($made) && $made !== '') {
        $columns .= ', made_at';
        $values .= ', :made';
        $params[':made'] = $made;
    }
    $stmt = $db->prepare("INSERT INTO wwtc_platoon_graphics ({$columns}) VALUES ({$values})");
    try {
        $stmt->execute($params);
    } catch (PDOException $e) {
        $mysql = (int) ($e->errorInfo[1] ?? 0);
        if ($mysql === 1062 || $e->getCode() === '23000') {
            return 'exists';
        }
        throw $e;
    }
    return 'inserted';
}

function wwtcSaveSchoolWhatsapp(int $schoolId, ?string $digits, string $who): void
{
    $db = wwtcPlatoonGraphicsPdo();
    $stmt = $db->prepare(
        'INSERT INTO wwtc_school_contacts (school_id, whatsapp, updated_by)
         VALUES (:id, :phone, :who)
         ON DUPLICATE KEY UPDATE whatsapp = VALUES(whatsapp), updated_by = VALUES(updated_by)'
    );
    $stmt->execute([':id' => $schoolId, ':phone' => $digits, ':who' => $who]);
}

/**
 * @param int[] $ids
 * @param int[]|null $schoolIds
 */
function wwtcSetPlatoonGraphicsSent(array $ids, bool $sent, string $who, int $year, string $month, ?array $schoolIds): int
{
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (!$ids) {
        return 0;
    }
    $db = wwtcPlatoonGraphicsPdo();
    $flag = $sent ? 1 : 0;
    // Two names: PDO refuses to bind the same placeholder twice when emulation is off.
    $params = [':sent' => $flag, ':sent2' => $flag, ':who' => $who, ':y' => $year, ':m' => wwtcNormalizeCampaignMonth($month)];
    $in = [];
    foreach ($ids as $i => $id) {
        $key = ':id' . $i;
        $in[] = $key;
        $params[$key] = $id;
    }
    $sql = 'UPDATE wwtc_platoon_graphics
               SET sent_at = CASE WHEN :sent = 1 THEN COALESCE(sent_at, CURRENT_TIMESTAMP) ELSE NULL END,
                   sent_by = CASE WHEN :sent2 = 1 THEN :who ELSE NULL END
             WHERE id IN (' . implode(',', $in) . ')
               AND campaign_year = :y AND month_name = :m';
    if ($schoolIds !== null) {
        if (!$schoolIds) {
            return 0;
        }
        $scope = [];
        foreach (array_values($schoolIds) as $i => $sid) {
            $key = ':sc' . $i;
            $scope[] = $key;
            $params[$key] = (int) $sid;
        }
        $sql .= ' AND school_id IN (' . implode(',', $scope) . ')';
    }
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function wwtcMarkSchoolGraphicsSent(int $schoolId, string $who, int $year, string $month): int
{
    $db = wwtcPlatoonGraphicsPdo();
    $stmt = $db->prepare(
        'UPDATE wwtc_platoon_graphics
            SET sent_at = CURRENT_TIMESTAMP, sent_by = :who
          WHERE school_id = :school AND campaign_year = :y AND month_name = :m AND sent_at IS NULL'
    );
    $stmt->execute([
        ':who' => $who,
        ':school' => $schoolId,
        ':y' => $year,
        ':m' => wwtcNormalizeCampaignMonth($month),
    ]);
    return $stmt->rowCount();
}

function wwtcUpdatePlatoonGraphicPath(int $id, string $path): void
{
    $stmt = wwtcPlatoonGraphicsPdo()->prepare(
        'UPDATE wwtc_platoon_graphics SET file_path = :path WHERE id = :id'
    );
    $stmt->execute([':path' => $path, ':id' => $id]);
}

function wwtcOfficeGraphicFromRow(array $row): array
{
    $grade = (string) $row['grade'];
    $className = (string) $row['class_name'];
    $file = (string) ($row['file_path'] ?? '');
    $id = (int) $row['id'];
    return [
        'id' => $id,
        'className' => $className,
        'grade' => $grade,
        'gradeLabel' => (string) ($row['grade_label'] ?? ''),
        'classLabel' => wwtcPlatoonClassLabel($grade, $className),
        'fileUrl' => ($file !== '' && is_file($file)) ? wwtcPlatoonGraphicPublicUrl($id) : null,
        'madeAt' => (string) ($row['made_at'] ?? ''),
        'sent' => !empty($row['sent']),
        'sentAt' => !empty($row['sent_at']) ? (string) $row['sent_at'] : null,
        'isNew' => !empty($row['isNew']),
    ];
}

/** @return array<int,array<string,mixed>> */
function wwtcOfficeSchoolsFromRows(array $rows, array $contacts, array $logos): array
{
    $rows = wwtcAttachNewFlags($rows);
    $by = [];
    foreach ($rows as $row) {
        $sid = (int) $row['school_id'];
        if (!isset($by[$sid])) {
            $by[$sid] = [
                'id' => $sid,
                'name' => (string) $row['school_name'],
                'logo' => $logos[$sid] ?? null,
                'whatsapp' => $contacts[$sid] ?? null,
                'graphics' => [],
            ];
        }
        $by[$sid]['graphics'][] = wwtcOfficeGraphicFromRow($row);
    }
    $schools = array_values($by);
    usort($schools, static function ($a, $b) {
        return strcasecmp((string) $a['name'], (string) $b['name']);
    });
    return $schools;
}

function wwtcContainGraphicPath(string $path): ?string
{
    $root = realpath(wwtcPlatoonGraphicsDir());
    $file = realpath($path);
    if (!$root || !$file || !is_file($file)) {
        return null;
    }
    $prefix = $root . DIRECTORY_SEPARATOR;
    if ($file !== $root && strpos($file, $prefix) !== 0) {
        return null;
    }
    return $file;
}

function wwtcIsPlatoonGraphicsRoute(string $path): bool
{
    return $path === '/platoon-graphics'
        || $path === '/office/platoon-graphics'
        || $path === '/office/platoon-graphics/contact'
        || $path === '/office/platoon-graphics/sent'
        || (bool) preg_match('#^/platoon-graphics/school/\d+$#', $path)
        || (bool) preg_match('#^/platoon-graphics/file/\d+$#', $path);
}

function wwtcPlatoonGraphicsPeriod(): array
{
    if (function_exists('wwtcHasPeriodQuery') && wwtcHasPeriodQuery()) {
        $period = wwtcQueryPeriod();
        if (!empty($period['holiday'])) {
            return [
                'year' => (int) $period['year'],
                'month' => (string) $period['month'],
                'holiday' => true,
                'jd' => null,
            ];
        }
        return [
            'year' => (int) $period['year'],
            'month' => wwtcNormalizeCampaignMonth((string) $period['month']),
            'holiday' => false,
            'jd' => (int) $period['jd'],
        ];
    }
    $jd = wwtcCurrentDate();
    return [
        'year' => wwtcYear(),
        'month' => wwtcNormalizeCampaignMonth((string) wwtcMonthForDate($jd)),
        'holiday' => false,
        'jd' => $jd,
    ];
}

function wwtcDispatchPlatoonGraphics(string $method, string $path): bool
{
    if (!wwtcIsPlatoonGraphicsRoute($path)) {
        return false;
    }
    wwtcHandlePlatoonGraphics($method, $path);
    return true;
}

function wwtcHandlePlatoonGraphics(string $method, string $path): void
{
    if ($method === 'GET' && preg_match('#^/platoon-graphics/file/(\d+)$#', $path, $m)) {
        wwtcServePlatoonGraphic((int) $m[1]);
        return;
    }
    if ($method === 'GET' && ($path === '/platoon-graphics' || preg_match('#^/platoon-graphics/school/(\d+)$#', $path))) {
        wwtcPublicPlatoonGraphicsResponse($path);
        return;
    }
    if ($path === '/office/platoon-graphics' || $path === '/office/platoon-graphics/contact' || $path === '/office/platoon-graphics/sent') {
        wwtcOfficePlatoonGraphics($method, $path);
        return;
    }
    wwtcError('Not found: ' . $method . ' ' . $path, 404);
}

function wwtcServePlatoonGraphic(int $id): void
{
    if (!wwtcPlatoonGraphicsTablesReady()) {
        wwtcError('No Perfect Platoon graphics have been posted yet.', 404);
    }
    $db = wwtcPlatoonGraphicsPdo();
    $stmt = $db->prepare('SELECT file_path, school_name, class_name, month_name, campaign_year FROM wwtc_platoon_graphics WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $file = $row ? wwtcContainGraphicPath((string) $row['file_path']) : null;
    if (!$row || !$file) {
        wwtcError('That graphic is not on the server.', 404);
    }
    $name = preg_replace('/[^A-Za-z0-9._-]+/', '-', (string) $row['month_name'] . '-' . $row['campaign_year'] . '-' . $row['class_name']);
    header('Content-Type: image/png');
    header('Content-Length: ' . (string) filesize($file));
    header('Content-Disposition: inline; filename="' . trim((string) $name, '-') . '.png"');
    header('Cache-Control: private, max-age=300');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

function wwtcPublicPlatoonGraphicsResponse(string $path): void
{
    $period = wwtcPlatoonGraphicsPeriod();
    $payload = [
        'month' => $period['month'],
        'year' => $period['year'],
        'renderer' => wwtcPlatoonRendererId(),
        'storage' => wwtcPlatoonGraphicsTablesReady() ? 'ready' : 'missing',
        'schools' => [],
    ];
    if ($period['holiday'] || $payload['storage'] !== 'ready') {
        wwtcJson($payload);
    }
    $schoolFilter = null;
    if (preg_match('#^/platoon-graphics/school/(\d+)$#', $path, $m)) {
        $schoolFilter = [(int) $m[1]];
    }
    $rows = wwtcLoadPlatoonGraphicRows((int) $period['year'], (string) $period['month'], $schoolFilter);
    $logos = function_exists('wwtcSchoolLogos') ? wwtcSchoolLogos() : [];
    $payload['schools'] = wwtcPublicSchoolsFromRows($rows, $logos);
    wwtcJson($payload);
}

function wwtcOfficeActorScope(): array
{
    $actor = wwtcRequireActor(['admin']);
    $schoolIds = (($actor['auth'] ?? '') === 'super')
        ? []
        : wwtcAdminAuthIds((int) $actor['id'], 'school');
    $scope = wwtcOfficeSchoolScope($actor, $schoolIds);
    if ($scope === false || (is_array($scope) && !$scope)) {
        wwtcError('Only HQ or a school admin can open the graphics office.', 403);
    }
    return [$actor, $scope];
}

function wwtcOfficePlatoonGraphics(string $method, string $path): void
{
    [$actor, $scope] = wwtcOfficeActorScope();
    if (!wwtcPlatoonGraphicsTablesReady()) {
        if ($method === 'GET') {
            $period = wwtcPlatoonGraphicsPeriod();
            wwtcJson([
                'month' => $period['month'],
                'year' => $period['year'],
                'renderer' => wwtcPlatoonRendererId(),
                'storage' => 'missing',
                'schools' => [],
                'message' => 'Platoon graphics storage is not installed yet. Run api/sql/wwtc_platoon_graphics.sql once on mashpia.',
            ]);
        }
        wwtcError('Platoon graphics storage is not installed yet. Run api/sql/wwtc_platoon_graphics.sql once on mashpia.', 503);
    }
    $period = wwtcPlatoonGraphicsPeriod();
    if ($method === 'PUT' && $path === '/office/platoon-graphics/contact') {
        wwtcOfficeSaveContact($actor, $scope);
        return;
    }
    if ($method === 'POST' && $path === '/office/platoon-graphics/sent') {
        wwtcOfficeMarkSent($actor, $scope, $period);
        return;
    }
    if ($method !== 'GET' || $path !== '/office/platoon-graphics') {
        wwtcError('Not found: ' . $method . ' ' . $path, 404);
    }
    if ($period['holiday']) {
        wwtcJson([
            'month' => $period['month'],
            'year' => $period['year'],
            'renderer' => wwtcPlatoonRendererId(),
            'storage' => 'ready',
            'schools' => [],
        ]);
    }
    $rows = wwtcLoadPlatoonGraphicRows((int) $period['year'], (string) $period['month'], is_array($scope) ? $scope : null);
    $ids = [];
    foreach ($rows as $row) {
        $ids[(int) $row['school_id']] = (int) $row['school_id'];
    }
    $contacts = wwtcLoadSchoolContacts(array_values($ids));
    $logos = function_exists('wwtcSchoolLogos') ? wwtcSchoolLogos() : [];
    wwtcJson([
        'month' => $period['month'],
        'year' => $period['year'],
        'renderer' => wwtcPlatoonRendererId(),
        'storage' => 'ready',
        'schools' => wwtcOfficeSchoolsFromRows($rows, $contacts, $logos),
    ]);
}

function wwtcOfficeSaveContact(array $actor, $scope): void
{
    $input = wwtcInput();
    $schoolId = (int) ($input['schoolId'] ?? 0);
    if ($schoolId <= 0 || !isset(wwtcEligibleSchools()[$schoolId])) {
        wwtcError('School not found.', 404);
    }
    if (is_array($scope) && !in_array($schoolId, array_map('intval', $scope), true)) {
        wwtcError('That school is not yours.', 403);
    }
    $parsed = wwtcNormalizeWhatsapp(isset($input['whatsapp']) ? (string) $input['whatsapp'] : '');
    if ($parsed['error']) {
        wwtcError($parsed['error'], 422);
    }
    wwtcSaveSchoolWhatsapp($schoolId, $parsed['digits'], (string) ($actor['id'] ?? ''));
    wwtcJson(['ok' => true, 'schoolId' => $schoolId, 'whatsapp' => $parsed['digits']]);
}

function wwtcOfficeMarkSent(array $actor, $scope, array $period): void
{
    if ($period['holiday']) {
        wwtcError('Perfect Platoon graphics are kept for Shabbos Mevorchim months.', 422);
    }
    $input = wwtcInput();
    $sent = !empty($input['sent']);
    $who = (string) ($actor['id'] ?? '');
    $year = (int) $period['year'];
    $month = (string) $period['month'];
    if (!empty($input['schoolId'])) {
        $schoolId = (int) $input['schoolId'];
        if (is_array($scope) && !in_array($schoolId, array_map('intval', $scope), true)) {
            wwtcError('That school is not yours.', 403);
        }
        if (!$sent) {
            wwtcError('Unmark one graphic at a time.', 422);
        }
        $updated = wwtcMarkSchoolGraphicsSent($schoolId, $who, $year, $month);
        wwtcJson(['ok' => true, 'updated' => $updated]);
    }
    $ids = $input['ids'] ?? [];
    if (!is_array($ids)) {
        wwtcError('Say which graphics to mark.', 422);
    }
    $updated = wwtcSetPlatoonGraphicsSent($ids, $sent, $who, $year, $month, is_array($scope) ? $scope : null);
    wwtcJson(['ok' => true, 'updated' => $updated]);
}

// ---- CLI ----

function wwtcCliMakePlatoonGraphics(array $argv): int
{
    $opts = wwtcGraphicsCliOptions($argv);
    $year = $opts['year'] > 0 ? (int) $opts['year'] : wwtcYear();
    if ($opts['month'] !== '') {
        $dates = wwtcMonthDatesForYear($year);
        if (!isset($dates[$opts['month']])) {
            fwrite(STDERR, "Month {$opts['month']} is not on the {$year} campaign calendar. Adar I and Adar II are used only in a leap year; a non-leap year uses Adar.\n");
            return 1;
        }
        $month = $opts['month'];
        $jd = (int) $dates[$month];
    } else {
        $jd = wwtcCurrentDate();
        $month = wwtcNormalizeCampaignMonth((string) wwtcMonthForDate($jd));
        if ($month === '') {
            fwrite(STDERR, "Could not name the current Shabbos Mevorchim month.\n");
            return 1;
        }
    }
    if (!wwtcPlatoonGraphicsTablesReady()) {
        fwrite(STDERR, "Platoon graphics storage is not installed. Run api/sql/wwtc_platoon_graphics.sql once on the mashpia database.\n");
        return 1;
    }
    $platoons = wwtcPerfectPlatoonRows($jd);
    $existing = wwtcLoadPlatoonGraphicRows($year, $month, null);
    $fresh = wwtcNewPlatoonJobs($platoons, $existing, $year, $month);
    $already = count($platoons) - count($fresh);
    echo "Perfect platoons {$month} {$year}: " . count($platoons) . " perfect, {$already} already made, " . count($fresh) . " new.\n";
    if ($opts['dryRun'] && !$opts['rerender']) {
        foreach ($fresh as $platoon) {
            $label = wwtcPlatoonClassLabel((string) $platoon['grade'], (string) $platoon['className']);
            echo "would make {$platoon['school']} {$label}\n";
        }
        return 0;
    }
    $targets = $opts['rerender'] ? $existing : $fresh;
    if (!$targets) {
        // Nothing to draw. A missing background is a note, not a failed cron,
        // until a new platoon actually needs the file.
        try {
            wwtcBackgroundPathForMonth($month);
        } catch (RuntimeException $e) {
            fwrite(STDERR, "Note: " . $e->getMessage() . "\n");
        }
        return 0;
    }
    try {
        $background = wwtcBackgroundPathForMonth($month);
    } catch (RuntimeException $e) {
        fwrite(STDERR, $e->getMessage() . "\n");
        return 1;
    }
    $dir = wwtcPlatoonGraphicsDir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        fwrite(STDERR, "Could not create the graphics directory {$dir}. Set WWTC_PLATOON_GRAPHICS_DIR to a writable folder outside the web root.\n");
        return 1;
    }
    $logos = function_exists('wwtcSchoolLogos') ? wwtcSchoolLogos() : [];
    $failed = 0;
    $made = 0;
    foreach ($targets as $platoon) {
        $schoolId = (int) ($platoon['schoolId'] ?? $platoon['school_id'] ?? 0);
        $schoolName = (string) ($platoon['school'] ?? $platoon['school_name'] ?? '');
        $className = (string) ($platoon['className'] ?? $platoon['class_name'] ?? '');
        $grade = (string) ($platoon['grade'] ?? '');
        $parts = wwtcNormalizeClassParts($className, $grade);
        $label = wwtcPlatoonClassLabel($parts['grade'], $parts['className']);
        $job = [
            'schoolId' => $schoolId,
            'schoolName' => $schoolName,
            'className' => $parts['className'],
            'grade' => $parts['grade'],
            'classLabel' => $label,
            'logoPath' => wwtcLocalLogoPath($logos[$schoolId] ?? null),
            'month' => $month,
            'year' => $year,
            'backgroundPath' => $background,
            'outPath' => $dir . '/' . wwtcPlatoonGraphicFilename([
                'schoolId' => $schoolId,
                'className' => $parts['className'],
                'grade' => $parts['grade'],
                'month' => $month,
                'year' => $year,
            ]),
        ];
        try {
            $written = wwtcRenderPlatoonGraphic($job);
            if ($opts['rerender'] && !empty($platoon['id'])) {
                wwtcUpdatePlatoonGraphicPath((int) $platoon['id'], $written);
            }
            if (!$opts['rerender']) {
                $status = wwtcInsertPlatoonGraphic([
                    'school_id' => $schoolId,
                    'school_name' => $schoolName,
                    'class_id' => (int) ($platoon['classId'] ?? $platoon['class_id'] ?? 0),
                    'class_name' => $parts['className'],
                    'grade' => $parts['grade'],
                    'grade_label' => wwtcKitahLabel($parts['grade']) ?? $parts['grade'],
                    'year' => $year,
                    'month' => $month,
                    'file_path' => $written,
                    'made_at' => null,
                ]);
                if ($status === 'exists') {
                    echo "already in the ledger {$schoolName} {$label}\n";
                    continue;
                }
            }
            $made++;
            echo ($opts['rerender'] ? 'redrew ' : 'made ') . "{$schoolName} {$label} -> {$written} (" . wwtcPlatoonRendererId() . ")\n";
        } catch (Throwable $e) {
            $failed++;
            fwrite(STDERR, "FAILED {$schoolName} {$className}: " . $e->getMessage() . "\n");
        }
    }
    echo ($opts['rerender'] ? 'Redrew ' : 'Made ') . "{$made}." . ($failed ? " {$failed} failed." : '') . "\n";
    return $failed ? 2 : 0;
}

function wwtcCliImportPlatoonLedger(array $argv): int
{
    $opts = wwtcGraphicsCliOptions($argv);
    if ($opts['file'] === '') {
        fwrite(STDERR, "Pass --file=ledger.csv or --file=ledger.json\n\n" . wwtcPlatoonGraphicsUsage());
        return 1;
    }
    if (!is_file($opts['file'])) {
        fwrite(STDERR, "No ledger file at {$opts['file']}\n");
        return 1;
    }
    $raw = file_get_contents($opts['file']);
    if ($raw === false) {
        fwrite(STDERR, "Could not read {$opts['file']}\n");
        return 1;
    }
    $parsed = wwtcParseLedgerDocument($raw, $opts['file']);
    foreach ($parsed['warnings'] as $warning) {
        fwrite(STDERR, "Note: {$warning}\n");
    }
    foreach ($parsed['errors'] as $error) {
        fwrite(STDERR, "Line {$error['line']}: {$error['error']}\n");
    }
    if (!wwtcPlatoonGraphicsTablesReady()) {
        fwrite(STDERR, "Platoon graphics storage is not installed. Run api/sql/wwtc_platoon_graphics.sql once on the mashpia database.\n");
        return 1;
    }
    $resolved = wwtcResolveLedgerSchools($parsed['rows'], wwtcEligibleSchools());
    foreach ($resolved['errors'] as $error) {
        fwrite(STDERR, "Line {$error['line']}: {$error['error']}\n");
    }
    $inserted = 0;
    $skipped = 0;
    $dir = wwtcPlatoonGraphicsDir();
    if (!$opts['dryRun'] && !is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        fwrite(STDERR, "Could not create {$dir}\n");
        return 1;
    }
    foreach ($resolved['rows'] as $row) {
        $existing = wwtcLoadPlatoonGraphicRows((int) $row['year'], (string) $row['month'], [(int) $row['school_id']]);
        $key = wwtcPlatoonGraphicKey($row);
        $already = false;
        foreach ($existing as $have) {
            if (wwtcPlatoonGraphicKey($have) === $key) {
                $already = true;
                break;
            }
        }
        if ($already) {
            $skipped++;
            echo "skip existing {$row['school_name']} {$row['class_name']} {$row['month']} {$row['year']}\n";
            continue;
        }
        $path = (string) $row['file_path'];
        if ($path !== '' && is_file($path) && !$opts['dryRun']) {
            $destName = wwtcPlatoonGraphicFilename([
                'schoolId' => $row['school_id'],
                'className' => $row['class_name'],
                'grade' => $row['grade'],
                'month' => $row['month'],
                'year' => $row['year'],
            ]);
            $dest = $dir . '/' . $destName;
            $real = realpath($path);
            $root = realpath($dir);
            if ($real && $root && strpos($real, $root . DIRECTORY_SEPARATOR) === 0) {
                $path = $real;
            } elseif ($real && @copy($real, $dest)) {
                $path = $dest;
            } else {
                fwrite(STDERR, "Line {$row['line']}: could not copy {$row['file_path']} into the graphics directory. The row will still be recorded so it is not made again.\n");
                $path = '';
            }
        } elseif ($path !== '' && !is_file($path)) {
            fwrite(STDERR, "Line {$row['line']}: file not found ({$path}). Recording the graphic anyway so the daily job will not make it again.\n");
            $path = '';
        }
        $row['file_path'] = $path;
        if ($opts['dryRun']) {
            echo "would import {$row['school_name']} {$row['class_name']} {$row['month']} {$row['year']}\n";
            $inserted++;
            continue;
        }
        $status = wwtcInsertPlatoonGraphic($row);
        if ($status === 'exists') {
            $skipped++;
            echo "skip existing {$row['school_name']} {$row['class_name']} {$row['month']} {$row['year']}\n";
        } else {
            $inserted++;
            echo "imported {$row['school_name']} {$row['class_name']} {$row['month']} {$row['year']}\n";
        }
    }
    $bad = count($parsed['errors']) + count($resolved['errors']);
    echo "Imported {$inserted}, skipped {$skipped} already made, {$bad} row(s) need a look.\n";
    return $bad && $inserted === 0 ? 1 : 0;
}
