<?php

declare(strict_types=1);

/**
 * Per-month Perfect Platoon background art.
 *
 * The month header is painted into the background, so each campaign month
 * needs its own file. Paths are relative to this directory. Drop Sholem's
 * files in api/platoon-graphics/backgrounds/ (or point
 * WWTC_PLATOON_BACKGROUNDS_DIR at the folder that holds them). The job
 * refuses to draw a graphic when the file for that month is missing.
 *
 * Adar, Adar I, and Adar II are three different keys. A non-leap year uses
 * Adar. A leap year uses Adar I and Adar II, each with its own art.
 *
 * This file does not ship any artwork. Do not invent stand-in designs.
 */

return [
    'Tishrei' => 'backgrounds/tishrei.png',
    'Cheshvan' => 'backgrounds/cheshvan.png',
    'Kislev' => 'backgrounds/kislev.png',
    'Teves' => 'backgrounds/teves.png',
    'Shvat' => 'backgrounds/shvat.png',
    'Adar' => 'backgrounds/adar.png',
    'Adar I' => 'backgrounds/adar-i.png',
    'Adar II' => 'backgrounds/adar-ii.png',
    'Nissan' => 'backgrounds/nissan.png',
    'Iyar' => 'backgrounds/iyar.png',
    'Sivan' => 'backgrounds/sivan.png',
    'Tammuz' => 'backgrounds/tammuz.png',
    'Av' => 'backgrounds/av.png',
    'Elul' => 'backgrounds/elul.png',
];
