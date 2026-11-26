<?php

declare(strict_types=1);

/**
 * Tab's finished square posters. The blank already has the border, the header,
 * and the numbered badge. This draws only the school name, the class label,
 * and the school logo, in the boxes measured from the finished samples.
 *
 * Ties share a rank, so they use the same Top Base blank.
 */

function wwtcGraphicLayout(): array
{
    static $layout;
    if ($layout !== null) {
        return $layout;
    }
    $path = dirname(__DIR__) . '/src/lib/graphicLayout.json';
    $raw = file_get_contents($path);
    $decoded = $raw !== false ? json_decode($raw, true) : null;
    if (!is_array($decoded)) {
        throw new RuntimeException('The graphic layout file is missing: src/lib/graphicLayout.json');
    }
    return $layout = $decoded;
}

function wwtcGraphicsAssetDir(): string
{
    return dirname(__DIR__) . '/public/graphics';
}

function wwtcDisplayFontPath(): string
{
    return dirname(__DIR__) . '/src/fonts/BebasNeue-Regular.ttf';
}

function wwtcItalicFontPath(): string
{
    return dirname(__DIR__) . '/src/fonts/Montserrat-ExtraBoldItalic.ttf';
}

function wwtcFinishedArtReady(): bool
{
    return is_file(wwtcTopBlankPath(1))
        && is_file(wwtcTopBlankPath(10))
        && is_file(wwtcPlatoonBlankPath())
        && is_file(wwtcDisplayFontPath())
        && is_file(wwtcItalicFontPath());
}

function wwtcTopBlankPath(int $rank): string
{
    $rank = max(1, min(10, $rank));
    return wwtcGraphicsAssetDir() . '/top-base-blank-' . $rank . '.jpg';
}

function wwtcPlatoonBlankPath(): string
{
    return wwtcGraphicsAssetDir() . '/perfect-platoon-blank.jpg';
}

/** @return array{0:int,1:int,2:int} */
function wwtcHexRgb(string $hex): array
{
    $hex = ltrim($hex, '#');
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}

/** @return array{w:float,h:float} */
function wwtcFontInk(string $font, float $size, string $text): array
{
    if ($text === '') {
        return ['w' => 0.0, 'h' => 0.0];
    }
    $box = imagettfbbox($size, 0, $font, $text);
    if ($box === false) {
        return ['w' => 0.0, 'h' => 0.0];
    }
    $xs = [$box[0], $box[2], $box[4], $box[6]];
    $ys = [$box[1], $box[3], $box[5], $box[7]];
    return ['w' => (float) (max($xs) - min($xs)), 'h' => (float) (max($ys) - min($ys))];
}

/**
 * @param string[] $words
 * @return string[]
 */
function wwtcWrapGraphicLines(array $words, float $maxWidth, callable $measure): array
{
    $lines = [];
    $current = '';
    foreach ($words as $word) {
        $piece = trim((string) $word);
        if ($piece === '') {
            continue;
        }
        $trial = $current === '' ? $piece : $current . ' ' . $piece;
        if ($current === '' || $measure($trial) <= $maxWidth) {
            $current = $trial;
        } else {
            $lines[] = $current;
            $current = $piece;
        }
    }
    if ($current !== '') {
        $lines[] = $current;
    }
    return $lines;
}

/**
 * @param string[] $words
 * @return array{size:float,lines:string[]}
 */
function wwtcFitGraphicText(array $words, float $maxWidth, float $maxHeight, float $maxSize, string $font, float $scaleX, float $pitch): array
{
    $clean = [];
    foreach ($words as $word) {
        $piece = trim((string) $word);
        if ($piece !== '') {
            $clean[] = $piece;
        }
    }
    $min = 8.0;
    if (!$clean || $maxWidth <= 0 || $maxHeight <= 0) {
        return ['size' => $min, 'lines' => []];
    }
    $pack = static function ($size) use ($clean, $maxWidth, $font, $scaleX, $pitch) {
        $lines = wwtcWrapGraphicLines($clean, $maxWidth, static function ($text) use ($font, $size, $scaleX) {
            return wwtcFontInk($font, (float) $size, $text)['w'] * $scaleX;
        });
        $cap = wwtcFontInk($font, (float) $size, 'H')['h'];
        $height = $lines ? (($cap * $pitch) * (count($lines) - 1) + $cap) : 0;
        return ['size' => (float) $size, 'lines' => $lines, 'height' => $height];
    };
    $low = $min;
    $high = max($min, $maxSize);
    $best = $pack($min);
    for ($i = 0; $i < 18; $i++) {
        $size = ($low + $high) / 2;
        $packed = $pack($size);
        $width = 0.0;
        foreach ($packed['lines'] as $line) {
            $width = max($width, wwtcFontInk($font, $size, $line)['w'] * $scaleX);
        }
        if ($packed['height'] <= $maxHeight + 0.5 && $width <= $maxWidth + 0.5) {
            $best = $packed;
            $low = $size;
        } else {
            $high = $size;
        }
    }
    return ['size' => $best['size'], 'lines' => $best['lines']];
}

function wwtcLoadGraphicImage(string $path)
{
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return false;
    }
    $img = @imagecreatefromstring($raw);
    return $img ?: false;
}

/** Draw words centered in a fraction box. Long lines shrink instead of overflowing. */
function wwtcDrawGraphicText($canvas, array $box, string $text, string $font, array $rgb, float $scaleX, bool $upper, float $capFraction, float $pitch): void
{
    $text = trim(preg_replace('/\s+/', ' ', $text));
    if ($text === '') {
        return;
    }
    if ($upper) {
        $text = strtoupper($text);
    }
    $side = imagesx($canvas);
    $x = $box['x'] * $side;
    $y = $box['y'] * $side;
    $w = $box['w'] * $side;
    $h = $box['h'] * $side;
    $maxCap = $capFraction * $side;
    $sample = wwtcFontInk($font, 100, 'H');
    $maxSize = $sample['h'] > 0 ? ($maxCap * 100 / $sample['h']) : $maxCap;
    $fit = wwtcFitGraphicText(explode(' ', $text), $w, $h, $maxSize, $font, $scaleX, $pitch);
    if (!$fit['lines']) {
        return;
    }
    $size = $fit['size'];
    $cap = wwtcFontInk($font, $size, 'H')['h'];
    $step = $cap * $pitch;
    $block = (count($fit['lines']) - 1) * $step + $cap;
    $top = $y + max(0, ($h - $block) / 2);
    foreach ($fit['lines'] as $i => $line) {
        $bb = imagettfbbox($size, 0, $font, $line);
        $minX = min($bb[0], $bb[2], $bb[4], $bb[6]);
        $maxX = max($bb[0], $bb[2], $bb[4], $bb[6]);
        $minY = min($bb[1], $bb[3], $bb[5], $bb[7]);
        $maxY = max($bb[1], $bb[3], $bb[5], $bb[7]);
        $inkW = max(1.0, $maxX - $minX);
        $inkH = max(1.0, $maxY - $minY);
        $pad = 8;
        $tmpW = (int) ceil($inkW) + $pad * 2;
        $tmpH = (int) ceil($inkH) + $pad * 2;
        $tmp = imagecreatetruecolor($tmpW, $tmpH);
        imagealphablending($tmp, false);
        imagesavealpha($tmp, true);
        $clear = imagecolorallocatealpha($tmp, 0, 0, 0, 127);
        imagefilledrectangle($tmp, 0, 0, $tmpW, $tmpH, $clear);
        imagealphablending($tmp, true);
        $tmpColor = imagecolorallocate($tmp, $rgb[0], $rgb[1], $rgb[2]);
        imagettftext(
            $tmp,
            $size,
            0,
            (int) round($pad - $minX),
            (int) round($pad - $minY),
            $tmpColor,
            $font,
            $line
        );
        $drawW = max(1, (int) round($inkW * $scaleX));
        $drawH = max(1, (int) round($inkH));
        $scaled = imagecreatetruecolor($drawW, $drawH);
        imagealphablending($scaled, false);
        imagesavealpha($scaled, true);
        $clear2 = imagecolorallocatealpha($scaled, 0, 0, 0, 127);
        imagefilledrectangle($scaled, 0, 0, $drawW, $drawH, $clear2);
        imagealphablending($scaled, true);
        imagecopyresampled($scaled, $tmp, 0, 0, 0, 0, $drawW, $drawH, $tmpW, $tmpH);
        imagedestroy($tmp);
        $dx = (int) round($x + ($w - $drawW) / 2);
        $dy = (int) round($top + $i * $step);
        imagecopy($canvas, $scaled, $dx, $dy, 0, 0, $drawW, $drawH);
        imagedestroy($scaled);
    }
}

function wwtcPasteGraphicLogo($canvas, string $path, array $box): void
{
    if ($path === '' || !is_file($path)) {
        return;
    }
    $src = wwtcLoadGraphicImage($path);
    if (!$src) {
        return;
    }
    $side = imagesx($canvas);
    $bw = $box['w'] * $side;
    $bh = $box['h'] * $side;
    $sw = imagesx($src);
    $sh = imagesy($src);
    if ($sw < 1 || $sh < 1) {
        imagedestroy($src);
        return;
    }
    $scale = min($bw / $sw, $bh / $sh);
    $dw = max(1, (int) round($sw * $scale));
    $dh = max(1, (int) round($sh * $scale));
    $dx = (int) round($box['x'] * $side + ($bw - $dw) / 2);
    $dy = (int) round($box['y'] * $side + ($bh - $dh) / 2);
    imagecopyresampled($canvas, $src, $dx, $dy, 0, 0, $dw, $dh, $sw, $sh);
    imagedestroy($src);
}

/**
 * @return string written path
 */
function wwtcRenderFinishedGraphic(array $job): string
{
    if (!extension_loaded('gd') || !function_exists('imagettftext')) {
        throw new RuntimeException('The graphic renderer needs php-gd with FreeType.');
    }
    $layout = wwtcGraphicLayout();
    $kind = (($job['kind'] ?? '') === 'top10') ? 'top10' : 'platoon';
    if ($kind === 'top10') {
        $rank = (int) ($job['rank'] ?? 0);
        if ($rank < 1 || $rank > 10) {
            throw new RuntimeException('A Top 10 graphic needs a rank from 1 to 10.');
        }
        $blank = wwtcTopBlankPath($rank);
    } else {
        $blank = wwtcPlatoonBlankPath();
    }
    if (!is_file($blank)) {
        throw new RuntimeException('The poster background is missing: ' . $blank);
    }
    $src = wwtcLoadGraphicImage($blank);
    if (!$src) {
        throw new RuntimeException('The poster background is not a readable image: ' . $blank);
    }
    $canvas = imagecreatetruecolor(WWTC_PLATOON_GRAPHIC_PX, WWTC_PLATOON_GRAPHIC_PX);
    imagealphablending($canvas, true);
    imagecopyresampled($canvas, $src, 0, 0, 0, 0, WWTC_PLATOON_GRAPHIC_PX, WWTC_PLATOON_GRAPHIC_PX, imagesx($src), imagesy($src));
    imagedestroy($src);

    $pitch = (float) ($layout['linePitch'] ?? 1.176);
    $navy = wwtcHexRgb((string) $layout['navy']);
    $blue = wwtcHexRgb((string) $layout['blue']);
    $display = wwtcDisplayFontPath();
    $italic = wwtcItalicFontPath();
    $logo = (string) ($job['logoPath'] ?? '');
    if ($kind === 'top10') {
        wwtcDrawGraphicText(
            $canvas,
            $layout['top']['name'],
            (string) ($job['schoolName'] ?? ''),
            $display,
            $navy,
            (float) $layout['displayScaleX'],
            true,
            (float) $layout['top']['cap'],
            $pitch
        );
        wwtcPasteGraphicLogo($canvas, $logo, $layout['top']['logo']);
    } else {
        wwtcDrawGraphicText(
            $canvas,
            $layout['platoon']['className'],
            (string) ($job['classLabel'] ?? ''),
            $display,
            $navy,
            (float) $layout['displayScaleX'],
            true,
            (float) $layout['platoon']['classCap'],
            $pitch
        );
        wwtcDrawGraphicText(
            $canvas,
            $layout['platoon']['name'],
            (string) ($job['schoolName'] ?? ''),
            $italic,
            $blue,
            (float) $layout['italicScaleX'],
            false,
            (float) $layout['platoon']['nameCap'],
            $pitch
        );
        wwtcPasteGraphicLogo($canvas, $logo, $layout['platoon']['logo']);
    }

    $out = (string) ($job['outPath'] ?? '');
    if ($out === '') {
        imagedestroy($canvas);
        throw new RuntimeException('The renderer was not given an outPath.');
    }
    $dir = dirname($out);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        imagedestroy($canvas);
        throw new RuntimeException("Could not create {$dir} for the graphic.");
    }
    imagepng($canvas, $out, 6);
    imagedestroy($canvas);
    $info = @getimagesize($out);
    if (!$info || (int) $info[0] !== WWTC_PLATOON_GRAPHIC_PX || (int) $info[1] !== WWTC_PLATOON_GRAPHIC_PX) {
        throw new RuntimeException('The graphic renderer did not write a 1080×1080 PNG.');
    }
    return $out;
}
