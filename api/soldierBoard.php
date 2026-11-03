<?php

declare(strict_types=1);

/**
 * Order a school's Top Soldiers: kapitlach this month, then name A–Z.
 * Ties share a score, so the name (then id) is the only stable order inside
 * a score. $limit slices after that sort — limiting in SQL first would keep
 * an arbitrary subset of a tie and make them look like places 1..n.
 *
 * @param array<int, array{id?:int|string, name?:string, saidMonth?:int|float}> $rows
 * @return array<int, array>
 */
function wwtcOrderSoldiers(array $rows, ?int $limit = null): array
{
    usort($rows, static function ($a, $b): int {
        $score = ((int) ($b['saidMonth'] ?? 0)) <=> ((int) ($a['saidMonth'] ?? 0));
        if ($score !== 0) {
            return $score;
        }
        $name = strcasecmp((string) ($a['name'] ?? ''), (string) ($b['name'] ?? ''));
        if ($name !== 0) {
            return $name;
        }
        return ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0));
    });
    if ($limit === null) {
        return $rows;
    }
    return array_slice($rows, 0, max(0, $limit));
}
