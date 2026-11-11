<?php

declare(strict_types=1);

/**
 * Daily Perfect Platoon graphics job. Cron (replace the path):
 *
 *   15 6 * * * php /ABSOLUTE/PATH/shabbos-mevorchim-tehillim/api/bin/make-platoon-graphics.php >> /var/log/wwtc-platoon-graphics.log 2>&1
 *
 * Reads this month's perfect platoons with the same query as GET /perfect-platoons
 * and draws only the ones that are not already in the ledger.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this from cron or a terminal, not from the web.\n");
    exit(1);
}

require dirname(__DIR__) . '/platoonGraphics.php';

if (wwtcGraphicsCliWantsHelp($argv)) {
    echo wwtcPlatoonGraphicsUsage();
    exit(0);
}

require dirname(__DIR__) . '/bootstrap.php';
exit(wwtcCliMakePlatoonGraphics($argv));
