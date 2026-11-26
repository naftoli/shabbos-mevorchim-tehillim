<?php

declare(strict_types=1);

/**
 * Import an existing Perfect Platoon graphics ledger (CSV or JSON) so the
 * daily job does not make those graphics again. The column names are
 * flexible — see api/platoon-graphics/README.md. Sholem's exact file is
 * still to come; this reader accepts the likely shapes.
 *
 *   php api/bin/import-platoon-graphics-ledger.php --file=ledger.csv
 *   php api/bin/import-platoon-graphics-ledger.php --file=ledger.json --dry-run
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run this from a terminal, not from the web.\n");
    exit(1);
}

require dirname(__DIR__) . '/platoonGraphics.php';

if (wwtcGraphicsCliWantsHelp($argv)) {
    echo wwtcPlatoonGraphicsUsage();
    exit(0);
}

require dirname(__DIR__) . '/bootstrap.php';
exit(wwtcCliImportPlatoonLedger($argv));
