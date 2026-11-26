<?php

declare(strict_types=1);

// Keeps the costly army-pass cache warm so the public pages that read it
// (/running-totals, /running-totals/breakdown, /stats, /schools) never rebuild
// it on a visitor's request and run past Cloudflare's ~100s limit (a 524).
//
// Each elapsed Shabbos-Mevorchim month's figure comes from a ~60s army pass
// (setArmyResults()+setASR(), cached as army_aggregates.<year>.<jd>):
//
//   - The CURRENT month changes as marks come in, so it is force-rebuilt on
//     every run — new numbers appear within a minute.
//   - EARLIER months are frozen once their weekend passes and hold a long cache
//     life (wwtcFrozenCacheTtl), so they are only rebuilt when their cache is
//     actually cold or stale — e.g. right after a write flushed the cache. A
//     warm earlier month is a cheap no-op, so running this every minute does
//     not keep recomputing them.
//
// Run every minute, as the cPanel account user (so the cache files it writes
// are the same ones Apache reads). Cron:
//
//   * * * * * ea-php72 /home/mashpia/public_html/shabbos-mevorchim-tehillim/api/bin/warm-cache.php >> /home/mashpia/logs/wwtc-warm.log 2>&1

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this from cron or a terminal, not from the web.\n");
    exit(1);
}

require dirname(__DIR__) . '/bootstrap.php';

$year = wwtcYear();
$current = wwtcCurrentDate();
$started = microtime(true);
$forced = 0;
$checked = 0;

foreach (wwtcElapsedMonths() as $mo) {
    $jd = (int) $mo['jd'];
    $key = "army_aggregates.$year.$jd";
    $producer = static function () use ($jd, $year): array {
        return wwtcComputeArmyAggregates($jd, $year);
    };

    if ($jd === $current) {
        // Force a rebuild so new marks show within the minute. wwtcTryRefresh
        // writes atomically under a non-blocking lock, so an overlapping run
        // simply skips.
        wwtcTryRefresh(wwtcCacheFile($key), $producer);
        $forced++;
        fwrite(STDOUT, "forced  army_aggregates.$year.$jd (current)\n");
    } else {
        // Rebuild only if cold or past the long frozen TTL; a warm month is a
        // cache hit and does no work. Uses the same key/TTL wwtcArmyAggregates()
        // reads, so this just repopulates what a visitor would otherwise have to
        // rebuild inline after a flush.
        wwtcCached($key, $producer, wwtcFrozenCacheTtl());
        $checked++;
    }
}

$secs = round(microtime(true) - $started, 1);
fwrite(STDOUT, "done: forced $forced, checked $checked earlier month(s) in {$secs}s\n");
