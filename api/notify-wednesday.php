<?php

declare(strict_types=1);

/**
 * Monthly follow-up for base commanders and class teachers.
 *
 * Cron fires every Wednesday at 08:00 America/New_York. This script exits
 * without sending unless today, in America/New_York, is the first Wednesday
 * after the latest Shabbos Mevorchim. Leap years use the same month list as
 * the reports: Adar I and Adar II are separate Shabbosim, so each has its own
 * Wednesday. Dates come from wwtcMonthDatesForYear() / calculateSM().
 *
 * DST-safe crontab (do not schedule this in UTC):
 *
 *   CRON_TZ=America/New_York
 *   0 8 * * 3 cd /path/to/shabbos-mevorchim-tehillim && TZ=America/New_York php api/notify-wednesday.php
 *
 * The script also sets America/New_York itself, so the calendar day is New
 * York even when the server clock is UTC. The hour is still the crontab's job.
 *
 *   php api/notify-wednesday.php --dry-run
 *   php api/notify-wednesday.php --dry-run --only=123
 *   php api/notify-wednesday.php --force --only=123
 */

date_default_timezone_set('America/New_York');

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script is CLI only.\n");
    exit(1);
}

set_time_limit(0);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/notify.php';

exit(wwtcNotifyCli($argv));
