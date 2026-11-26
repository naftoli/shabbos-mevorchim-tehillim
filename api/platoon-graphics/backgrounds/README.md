# Month backgrounds

Each Perfect Platoon graphic uses that month's background. The month name is
already in the art, so Cheshvan cannot reuse Tishrei's file.

Put one image per month in this folder, named as `backgrounds.php` expects
(`cheshvan.png`, `adar-i.png`, `adar-ii.png`, and the rest). PNG, JPEG, and
WebP all load. The renderer scales the file to 1080×1080.

`Adar`, `Adar I`, and `Adar II` are three files. A leap year needs both Adar
files. A non-leap year needs `adar.png`.

These files are not in git on purpose. The daily job stops with a message
that names the missing path rather than drawing a made-up poster.
