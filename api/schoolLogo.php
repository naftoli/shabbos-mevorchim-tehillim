<?php

declare(strict_types=1);

/**
 * The school's own logo, from the same /schoolLogos/ file Base Commander
 * shows and uploads to. logo.png there is its generic placeholder
 * (DEFAULT_LOGO), so skip it and try the older files-table logo, which a
 * few schools only have. Null keeps the front end's initials tile.
 * Same rule as the Mivtza Lulav API (lulavSchoolRows).
 */
function wwtcSchoolLogoUrl($logoFile, $logoId = 0, $kioskLogoId = 0): ?string
{
    $logoFile = trim((string) $logoFile);
    $id = (int) ($logoId ?: $kioskLogoId);
    if ($logoFile !== '' && $logoFile !== 'logo.png') {
        return '/schoolLogos/' . rawurlencode($logoFile);
    }
    if ($id > 0) {
        return '/file_view.php?id=' . $id;
    }
    return null;
}
