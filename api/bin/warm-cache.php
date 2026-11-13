<?php

declare(strict_types=1);

// Keeps the costly army-pass cache warm so the public pages that read it
// (/running-totals, /running-totals/breakdown, /stats, /schools) never rebuild
// it on a visitor's request and run past Cloudflare's ~100s limit (a 524).
//
// Each elapsed Shabbos-Mevorchim month's figure comes from a ~60s army pass
// (setArmyResults()+setASR(), cached as army_aggregates.<year>.<jd>). The
// current month changes as marks come in, so warm it every minute. Earlier
// months are frozen once their weekend passes and keep a long cache life
// (wwtcFrozenCacheTtl), so they only need an occasional pass to repopulate the
// cache after a write clears it. Cron (replace the path):
//
//   every minute:            php /ABS/PATH/api/bin/warm-cache.php
//   every 10 min (optional): php /ABS/PATH/api/bin/warm-cache.php --all
//
// The second line is only worth adding during the monthly reporting surge,
// when frequent writes flush the whole cache and an earlier month would
// otherwise rebuild on the next visitor's breakdown request.

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this from cron or a terminal, not from the web.\n");
    exit(1);
}

require dirname(__DIR__) . '/bootstrap.php';

$all = in_array('--all', $argv, true);
$year = wwtcYear();
$current = wwtcCurrentDate();

$targets = [];
foreach (wwtcElapsedMonths() as $mo) {
    $jd = (int) $mo['jd'];
    if ($all || $jd === $current) {
        $targets[] = $jd;
    }
}

// Current month first, so it is always the freshest even when --all has the
// earlier months to get through as well.
usort($targets, static function (int $a, int $b) use ($current): int {
    if ($a === $current) {
        return -1;
    }
    if ($b === $current) {
        return 1;
    }
    return $b <=> $a; // then most recent first
});

$started = microtime(true);
foreach ($targets as $jd) {
    $file = wwtcCacheFile("army_aggregates.$year.$jd");
    // Force a rebuild regardless of freshness: wwtcTryRefresh writes atomically
    // under a non-blocking lock, so an overlapping run simply skips.
    wwtcTryRefresh($file, static function () use ($jd, $year): array {
        return wwtcComputeArmyAggregates($jd, $year);
    });
    $tag = $jd === $current ? ' (current)' : '';
    fwrite(STDOUT, "warmed army_aggregates.$year.$jd$tag\n");
}

$secs = round(microtime(true) - $started, 1);
fwrite(STDOUT, 'done: ' . count($targets) . " month(s) in {$secs}s\n");
