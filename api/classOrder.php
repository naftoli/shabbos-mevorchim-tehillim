<?php

declare(strict_types=1);

/**
 * Grade order for class lists. Pre-1A has no leading grade number ("Pre-1A",
 * "pre1a", "P1A"), so a numeric parse or an A–Z sort of the label parks it
 * after 12th grade. Rank 0 puts it first. 1st through 12th keep their numbers,
 * and a section ("1-Boys", "1st Grade A") only breaks a tie inside that grade.
 * Score rankings do not use this.
 */

function wwtcClassOrderParts(string $label): array
{
    $raw = trim($label);
    if (preg_match('/^(?:pre[\s-]*1[\s-]*a|p1a)/i', $raw, $match)) {
        return [
            'rank' => 0,
            'section' => ltrim(substr($raw, strlen($match[0])), " \t-"),
            'raw' => $raw,
        ];
    }
    if (preg_match('/^(\d{1,2})(?:st|nd|rd|th)?/i', $raw, $match)) {
        $rank = (int) $match[1];
        if ($rank >= 1 && $rank <= 12) {
            return [
                'rank' => $rank,
                'section' => ltrim(substr($raw, strlen($match[0])), " \t-"),
                'raw' => $raw,
            ];
        }
    }
    return ['rank' => 100, 'section' => $raw, 'raw' => $raw];
}

function wwtcCmpText(string $a, string $b): int
{
    return $a === $b ? 0 : ($a < $b ? -1 : 1);
}

function wwtcCmpIds($a, $b): int
{
    $sa = (string) $a;
    $sb = (string) $b;
    if (ctype_digit($sa) && ctype_digit($sb)) {
        return (int) $sa <=> (int) $sb;
    }
    return wwtcCmpText($sa, $sb);
}

function wwtcClassRowLabel(array $row): string
{
    foreach (['name', 'className', 'grade'] as $key) {
        $value = trim((string) ($row[$key] ?? ''));
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}

function wwtcCmpClassLabels(string $a, string $b): int
{
    $ka = wwtcClassOrderParts($a);
    $kb = wwtcClassOrderParts($b);
    if ($ka['rank'] !== $kb['rank']) {
        return $ka['rank'] <=> $kb['rank'];
    }
    $section = wwtcCmpText(strtolower($ka['section']), strtolower($kb['section']));
    if ($section !== 0) {
        return $section;
    }
    return wwtcCmpText($ka['raw'], $kb['raw']);
}

function wwtcClassRowParts(array $row): array
{
    $label = wwtcClassRowLabel($row);
    $fromLabel = wwtcClassOrderParts($label);
    if ($fromLabel['rank'] < 100) {
        return $fromLabel;
    }
    // A Hebrew class name has no grade number. The grade field still orders it.
    $grade = trim((string) ($row['grade'] ?? ''));
    if ($grade !== '' && $grade !== $label) {
        $fromGrade = wwtcClassOrderParts($grade);
        if ($fromGrade['rank'] < 100) {
            return ['rank' => $fromGrade['rank'], 'section' => $label, 'raw' => $label];
        }
    }
    return $fromLabel;
}

function wwtcCmpClassRows(array $a, array $b): int
{
    $ka = wwtcClassRowParts($a);
    $kb = wwtcClassRowParts($b);
    if ($ka['rank'] !== $kb['rank']) {
        return $ka['rank'] <=> $kb['rank'];
    }
    $section = wwtcCmpText(strtolower($ka['section']), strtolower($kb['section']));
    if ($section !== 0) {
        return $section;
    }
    $raw = wwtcCmpText($ka['raw'], $kb['raw']);
    if ($raw !== 0) {
        return $raw;
    }
    return wwtcCmpIds($a['id'] ?? $a['classId'] ?? '', $b['id'] ?? $b['classId'] ?? '');
}

function wwtcSortClasses(array $classes): array
{
    usort($classes, 'wwtcCmpClassRows');
    return $classes;
}

/** Nationwide platoon list: school name, then the same grade order inside a school. */
function wwtcCmpPlatoonRows(array $a, array $b): int
{
    $school = wwtcCmpText((string) ($a['school'] ?? ''), (string) ($b['school'] ?? ''));
    if ($school !== 0) {
        return $school;
    }
    return wwtcCmpClassRows($a, $b);
}
