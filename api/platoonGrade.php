<?php

declare(strict_types=1);

/**
 * Grade → Kitah labels for Perfect Platoon graphics.
 *
 * Grades 1–8 are the labels Sholem specified. Anything else (Pre-1A, 9–12,
 * a blank) has no Kitah name here — the class keeps its own label. Keep this
 * list in step with src/lib/platoonGrade.js.
 *
 * Adar I and Adar II stay distinct. A later leap-year change can rename the
 * calendar; this helper only normalizes the strings we already accept.
 */

function wwtcKitahByGrade(): array
{
    return [
        '1' => 'Kitah Alef',
        '2' => 'Kitah Beis',
        '3' => 'Kitah Gimmel',
        '4' => 'Kitah Daled',
        '5' => 'Kitah Hei',
        '6' => 'Kitah Vov',
        '7' => 'Kitah Zayin',
        '8' => 'Kitah Ches',
    ];
}

/** Kitah name for grades 1–8, or null when this grade has no Kitah label. */
function wwtcKitahLabel(string $grade): ?string
{
    $parsed = wwtcParseGrade($grade);
    if ($parsed === null) {
        return null;
    }
    $map = wwtcKitahByGrade();
    return $map[$parsed] ?? null;
}

/**
 * "1", "Grade 1", "1st", "Kitah Alef", "Alef" → "1".
 * "pre1a" / "Pre-1A" → "pre1a". Unknown text → null.
 */
function wwtcParseGrade(string $raw): ?string
{
    $text = trim($raw);
    if ($text === '') {
        return null;
    }
    if (preg_match('/pre\s*-?\s*1\s*-?\s*a/i', $text)) {
        return 'pre1a';
    }
    $stripped = preg_replace('/^(kitah|kita|grade|class)\s+/i', '', $text);
    $stripped = trim((string) $stripped);
    if (preg_match('/^(\d{1,2})(?:st|nd|rd|th)?$/i', $stripped, $m)) {
        return (string) (int) $m[1];
    }
    $token = strtolower($stripped);
    $token = (string) preg_replace('/[^a-z]/', '', $token);
    $kitah = [
        'alef' => '1', 'aleph' => '1',
        'beis' => '2', 'bais' => '2', 'bet' => '2', 'vet' => '2',
        'gimmel' => '3', 'gimel' => '3',
        'daled' => '4', 'dalet' => '4',
        'hei' => '5', 'hey' => '5', 'hay' => '5',
        'vov' => '6', 'vav' => '6',
        'zayin' => '7', 'zain' => '7', 'zayen' => '7',
        'ches' => '8', 'chet' => '8', 'het' => '8',
    ];
    return $kitah[$token] ?? null;
}

/**
 * Canonical class name is "{grade}" or "{grade}-{section}", matching
 * GET /perfect-platoons (class_grade + class_sub). "Kitah Hei-B" and "5-B"
 * become the same key so an imported ledger does not queue a second graphic.
 *
 * @return array{grade:string,className:string,section:string}
 */
function wwtcNormalizeClassParts(string $className, string $gradeRaw = ''): array
{
    $className = trim((string) preg_replace('/\s+/', ' ', str_replace(['–', '—'], '-', $className)));
    $gradeRaw = trim($gradeRaw);
    $grade = wwtcParseGrade($gradeRaw);
    $section = '';

    $applyStem = static function (string $stem, string $suffix) use (&$grade, &$section): bool {
        $stemGrade = wwtcParseGrade($stem);
        if ($stemGrade === null) {
            return false;
        }
        if (wwtcParseGrade($suffix) !== null) {
            return false;
        }
        $grade = $grade ?? $stemGrade;
        $section = $suffix;
        return true;
    };

    if (preg_match('/^(.*?)\s*-\s*([A-Za-z0-9]+)$/', $className, $m)) {
        $applyStem($m[1], $m[2]);
    }
    if ($section === '' && preg_match('/^(.*)\s+([A-Za-z0-9]{1,12})$/', $className, $m)) {
        $applyStem($m[1], $m[2]);
    }
    if ($grade === null) {
        $grade = wwtcParseGrade($className);
    }
    if ($grade === null) {
        $fallbackGrade = $gradeRaw !== '' ? $gradeRaw : $className;
        $fallbackClass = $className !== '' ? $className : $fallbackGrade;
        return ['grade' => $fallbackGrade, 'className' => $fallbackClass, 'section' => ''];
    }
    if ($section === '' && $className !== '' && wwtcParseGrade($className) === null && preg_match('/^[A-Za-z0-9]+$/', $className)) {
        $section = $className;
    }
    $classOut = $section !== '' ? $grade . '-' . $section : $grade;
    return ['grade' => $grade, 'className' => $classOut, 'section' => $section];
}

/** What the renderer prints: "Kitah Hei" or "Kitah Hei-B". No Kitah → the class name. */
function wwtcPlatoonClassLabel(string $grade, string $className): string
{
    $parts = wwtcNormalizeClassParts($className, $grade);
    $kitah = wwtcKitahLabel($parts['grade']);
    if ($kitah === null) {
        return $parts['className'] !== '' ? $parts['className'] : $parts['grade'];
    }
    return $parts['section'] !== '' ? $kitah . '-' . $parts['section'] : $kitah;
}

/**
 * Campaign month spellings. Adar I and Adar II are not folded into Adar.
 * "Adar 1" / "Adar 2" are the same two leap-year months.
 */
function wwtcNormalizeCampaignMonth(string $month): string
{
    $raw = trim((string) preg_replace('/\s+/', ' ', $month));
    $key = strtolower($raw);
    $key = str_replace(['_', '.'], ' ', $key);
    $key = trim((string) preg_replace('/\s+/', ' ', $key));
    $compact = str_replace(' ', '', $key);
    $map = [
        'adar i' => 'Adar I',
        'adar 1' => 'Adar I',
        'adari' => 'Adar I',
        'adar1' => 'Adar I',
        'adar ii' => 'Adar II',
        'adar 2' => 'Adar II',
        'adarii' => 'Adar II',
        'adar2' => 'Adar II',
        'adar' => 'Adar',
        'shevat' => 'Shvat',
        'shvat' => 'Shvat',
        'cheshvon' => 'Cheshvan',
        'cheshvan' => 'Cheshvan',
        'kisleiv' => 'Kislev',
        'kislev' => 'Kislev',
        'tevet' => 'Teves',
        'teves' => 'Teves',
        'tamuz' => 'Tammuz',
        'tammuz' => 'Tammuz',
        'tishrei' => 'Tishrei',
        'tishri' => 'Tishrei',
        'nissan' => 'Nissan',
        'nisan' => 'Nissan',
        'iyar' => 'Iyar',
        'iyyar' => 'Iyar',
        'sivan' => 'Sivan',
        'av' => 'Av',
        'elul' => 'Elul',
    ];
    if (isset($map[$key])) {
        return $map[$key];
    }
    if (isset($map[$compact])) {
        return $map[$compact];
    }
    return $raw;
}
