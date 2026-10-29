<?php

declare(strict_types=1);

// The logo URL rule shared with the Mivtza Lulav API: a real /schoolLogos/ file,
// else the older files-table logo, else null so the SPA keeps its initials tile.
//
// Run: php tests/php/SchoolLogoTest.php

require __DIR__ . '/../../api/schoolLogo.php';

$tests = 0;
$failures = 0;
function check(string $label, bool $cond): void
{
    global $tests, $failures;
    $tests++;
    if ($cond) {
        echo "ok   - $label\n";
    } else {
        $failures++;
        echo "FAIL - $label\n";
    }
}

check('uploaded file becomes a /schoolLogos/ URL', wwtcSchoolLogoUrl('oholei-torah.png') === '/schoolLogos/oholei-torah.png');
check('spaces in the file name are encoded', wwtcSchoolLogoUrl('Oholei Torah.png') === '/schoolLogos/Oholei%20Torah.png');
check('the generic logo.png placeholder is skipped', wwtcSchoolLogoUrl('logo.png') === null);
check('logo.png falls through to the files-table logo', wwtcSchoolLogoUrl('logo.png', 42) === '/file_view.php?id=42');
check('an empty file uses school_logo_id', wwtcSchoolLogoUrl('', 17, 0) === '/file_view.php?id=17');
check('school_logo_id wins over the kiosk logo', wwtcSchoolLogoUrl('', 17, 99) === '/file_view.php?id=17');
check('kiosk logo is the last resort', wwtcSchoolLogoUrl(null, 0, 99) === '/file_view.php?id=99');
check('a real file wins over a files-table id', wwtcSchoolLogoUrl('base.png', 17) === '/schoolLogos/base.png');
check('no logo at all stays null', wwtcSchoolLogoUrl('', 0, 0) === null);

echo "\n$tests tests, $failures failed\n";
exit($failures ? 1 : 0);
