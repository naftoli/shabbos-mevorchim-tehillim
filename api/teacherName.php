<?php

declare(strict_types=1);

/**
 * Class teacher label. Same placeholders as src/lib/teacherName.js.
 * Mashpia stores Na, N/A, none, -, 0, or a blank where no teacher was
 * entered. Those are not a name. A real name is returned trimmed.
 */
function wwtcTeacherName($value): string
{
    $text = trim((string) ($value ?? ''));
    if ($text === '') {
        return '';
    }
    $key = strtolower($text);
    if ($key === 'na' || $key === 'n/a' || $key === 'none' || $key === '-' || $key === '0') {
        return '';
    }
    return $text;
}
