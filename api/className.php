<?php

declare(strict_types=1);

/**
 * Display-only class labels. The same rule as src/lib/formatClassName.js.
 * Stored class_grade / class_sub, class ids, and grouping keys are not rewritten.
 *
 * A leading grade number is removed when the next word is that grade's letter
 * (1 Aleph … 8 Ches), in English or Hebrew, with or without geresh. The letter
 * and the section stay: "1 Aleph Bet" -> "Aleph Bet". Pre-1A and any other
 * shape are returned unchanged.
 */

function wwtcClassNameQuotes(): string
{
    return "['’׳״\"]";
}

function wwtcClassGradeOfToken(string $token): int
{
    $bare = preg_replace('/' . wwtcClassNameQuotes() . '+$/u', '', $token);
    $bare = is_string($bare) ? $bare : $token;
    $hebrew = ['א' => 1, 'ב' => 2, 'ג' => 3, 'ד' => 4, 'ה' => 5, 'ו' => 6, 'ז' => 7, 'ח' => 8];
    if (isset($hebrew[$bare])) {
        return $hebrew[$bare];
    }
    $english = [
        'aleph' => 1, 'alef' => 1,
        'bet' => 2, 'beis' => 2, 'bais' => 2,
        'gimmel' => 3, 'gimel' => 3,
        'dalet' => 4, 'daled' => 4,
        'hei' => 5, 'hey' => 5,
        'vav' => 6,
        'zayin' => 7,
        'ches' => 8, 'chet' => 8,
    ];
    $key = strtolower($bare);
    return $english[$key] ?? 0;
}

function wwtcFormatClassName($name): string
{
    if ($name === null) {
        return '';
    }
    $original = (string) $name;
    if ($original === '') {
        return '';
    }
    $trimmed = trim($original);
    if (!preg_match('/^([1-8])(?:\s+|-)+/u', $trimmed, $lead)) {
        return $original;
    }
    $rest = substr($trimmed, strlen($lead[0]));
    $tokenRe = '/^([A-Za-z]+|[\x{05D0}-\x{05EA}])' . wwtcClassNameQuotes() . '*/u';
    if (!preg_match($tokenRe, $rest, $tokenMatch)) {
        return $original;
    }
    $token = $tokenMatch[0];
    if (wwtcClassGradeOfToken($token) !== (int) $lead[1]) {
        return $original;
    }
    $after = substr($rest, strlen($token));
    if ($after === '') {
        return $token;
    }
    if (preg_match('/^\s/u', $after)) {
        return $token . ' ' . trim($after);
    }
    return $token . $after;
}

/** SMS and PDF have no <bdi>. Isolate a Hebrew label from the English around it. */
function wwtcDisplayClassName($name): string
{
    $text = wwtcFormatClassName($name);
    if ($text === '' || !preg_match('/\p{Hebrew}/u', $text)) {
        return $text;
    }
    $fsi = "\u{2068}";
    $pdi = "\u{2069}";
    if (str_starts_with($text, $fsi) && str_ends_with($text, $pdi)) {
        return $text;
    }
    return $fsi . $text . $pdi;
}

/** Copy a class row and shorten its display labels. Ids and grade keys stay. */
function wwtcPresentClassLabel(array $row): array
{
    if (isset($row['name']) && is_string($row['name'])) {
        $row['name'] = wwtcFormatClassName($row['name']);
    }
    if (isset($row['className']) && is_string($row['className'])) {
        $row['className'] = wwtcFormatClassName($row['className']);
    }
    return $row;
}
