<?php

declare(strict_types=1);

/**
 * Monthly parent reminder. One message per child.
 *
 * Cron fires every Tuesday at 08:00 America/New_York unless
 * WWTC_PARENT_REMINDER_HOUR says another hour. This script exits without
 * sending unless today, in America/New_York, is the first Tuesday after the
 * latest Shabbos Mevorchim, and the clock hour matches that setting.
 * Leap years use the same month list as the Wednesday job: Adar I and Adar II
 * are separate Shabbosim, so each has its own Tuesday. The Shabbos date comes
 * from wwtcNotifyLatestShabbos() / wwtcMonthDatesForYear() / calculateSM().
 *
 * DST-safe crontab (do not schedule this in UTC). Keep the hour in this line
 * the same number as WWTC_PARENT_REMINDER_HOUR (default 8):
 *
 *   CRON_TZ=America/New_York
 *   0 8 * * 2 cd /path/to/shabbos-mevorchim-tehillim && TZ=America/New_York php api/notify-tuesday.php
 *
 * The script also sets America/New_York itself, so the calendar day is New
 * York even when the server clock is UTC.
 *
 *   php api/notify-tuesday.php --dry-run
 *   php api/notify-tuesday.php --dry-run --only=123
 *   php api/notify-tuesday.php --force --only=123
 *
 * --only=123 is the parent admin id (admins.admin_id), not the child.
 */

date_default_timezone_set('America/New_York');

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script is CLI only.\n");
    exit(1);
}

set_time_limit(0);

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/notify.php';
require __DIR__ . '/notify-parent.php';

exit(wwtcParentReminderCli($argv));
