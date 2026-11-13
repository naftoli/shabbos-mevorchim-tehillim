<?php

declare(strict_types=1);

// platoonGraphics.php uses array_key_first()/str_*() (PHP 7.3/8.0). Production
// loads these via bootstrap.php's compat polyfills; load them here too so the
// suite runs on the legacy PHP 7.2 the site deploys to.
require __DIR__ . '/../../api/compat.php';
require __DIR__ . '/../../api/platoonGraphics.php';

function expect(bool $ok, string $message): void
{
    if ($ok) {
        echo "ok   - $message\n";
        return;
    }
    fwrite(STDERR, "FAIL - $message\n");
    exit(1);
}

$kitah = wwtcKitahByGrade();
expect($kitah === [
    '1' => 'Kitah Alef',
    '2' => 'Kitah Beis',
    '3' => 'Kitah Gimmel',
    '4' => 'Kitah Daled',
    '5' => 'Kitah Hei',
    '6' => 'Kitah Vov',
    '7' => 'Kitah Zayin',
    '8' => 'Kitah Ches',
], 'grades 1–8 map to the eight Kitah names');

expect(wwtcKitahLabel('1') === 'Kitah Alef', 'grade 1 is Kitah Alef');
expect(wwtcKitahLabel('Grade 8') === 'Kitah Ches', 'grade 8 is Kitah Ches');
expect(wwtcKitahLabel('Alef') === 'Kitah Alef', 'the name Alef parses back to grade 1');
expect(wwtcKitahLabel('pre1a') === null, 'Pre-1A has no Kitah label');
expect(wwtcKitahLabel('9') === null, 'grade 9 has no Kitah label');
expect(wwtcKitahLabel('') === null, 'a blank grade has no Kitah label');
expect(wwtcPlatoonClassLabel('5', '5-B') === 'Kitah Hei-B', 'a section is kept on the Kitah label');
expect(wwtcPlatoonClassLabel('pre1a', 'pre1a-A') === 'pre1a-A', 'Pre-1A keeps its own class name');
expect(wwtcNormalizeClassParts('Kitah Hei-B', '')['className'] === '5-B', 'Kitah Hei-B is the same class as 5-B');
expect(wwtcNormalizeClassParts('1-A', '1')['className'] === '1-A', '1-A stays 1-A');
expect(wwtcNormalizeClassParts('Hei B', '')['grade'] === '5', 'Hei B is grade 5');

expect(wwtcNormalizeCampaignMonth('Adar I') === 'Adar I', 'Adar I stays Adar I');
expect(wwtcNormalizeCampaignMonth('Adar II') === 'Adar II', 'Adar II stays Adar II');
expect(wwtcNormalizeCampaignMonth('Adar 1') === 'Adar I', 'Adar 1 is Adar I');
expect(wwtcNormalizeCampaignMonth('Adar 2') === 'Adar II', 'Adar 2 is Adar II');
expect(wwtcNormalizeCampaignMonth('Adar') === 'Adar', 'plain Adar is not a leap-year month');
expect(wwtcNormalizeCampaignMonth('cheshvan') === 'Cheshvan', 'month spelling is normalised');
expect(wwtcNormalizeCampaignMonth('Adar I') !== wwtcNormalizeCampaignMonth('Adar II'), 'the two Adars are different keys');

$ledger = [
    ['school_id' => 61, 'class_name' => '1-A', 'grade' => '1', 'year' => 5786, 'month' => 'Cheshvan'],
    ['schoolId' => 61, 'className' => '3-B', 'grade' => '3', 'campaign_year' => 5786, 'month_name' => 'Cheshvan'],
];
$platoons = [
    ['schoolId' => 61, 'school' => 'Cheder', 'className' => '1-A', 'grade' => '1'],
    ['schoolId' => 61, 'school' => 'Cheder', 'className' => 'Kitah Gimmel-B', 'grade' => '3'],
    ['schoolId' => 61, 'school' => 'Cheder', 'className' => '5', 'grade' => '5'],
    ['schoolId' => 80, 'school' => 'Other', 'className' => '1-A', 'grade' => '1'],
];
$fresh = wwtcNewPlatoonJobs($platoons, $ledger, 5786, 'Cheshvan');
expect(count($fresh) === 2, 'only platoons missing from the ledger are queued');
expect($fresh[0]['className'] === '5' && $fresh[1]['schoolId'] === 80, 'the new rows are grade 5 and the other school');
expect(wwtcNewPlatoonJobs($fresh, array_merge($ledger, [
    ['school_id' => 61, 'class_name' => '5', 'grade' => '5', 'year' => 5786, 'month' => 'Cheshvan'],
    ['school_id' => 80, 'class_name' => '1-A', 'grade' => '1', 'year' => 5786, 'month' => 'Cheshvan'],
]), 5786, 'Cheshvan') === [], 'a second pass queues nothing');

$flagged = wwtcAttachNewFlags([
    ['school_id' => 1, 'sent_at' => '2026-11-01', 'class_name' => '3-B'],
    ['school_id' => 1, 'sent_at' => null, 'class_name' => '1-A'],
    ['school_id' => 2, 'sent_at' => null, 'class_name' => '2'],
]);
expect($flagged[1]['isNew'] === true && $flagged[1]['sent'] === false, 'an unsent graphic at an already-sent school is NEW');
expect($flagged[0]['isNew'] === false && $flagged[0]['sent'] === true, 'the graphic that was sent is not NEW');
expect($flagged[2]['isNew'] === false && $flagged[2]['sent'] === false, 'a school that has never been sent is not NEW');

$schools = [
    ['id' => 1, 'name' => 'Sent school', 'graphics' => [['sent' => true], ['sent' => true]]],
    ['id' => 2, 'name' => 'Open school', 'graphics' => [['sent' => true], ['sent' => false, 'isNew' => true]]],
    ['id' => 3, 'name' => 'Fresh school', 'graphics' => [['sent' => false]]],
];
expect(count(wwtcFilterOfficeTab($schools, 'sent')) === 1, 'Sent tab is schools whose graphics are all sent');
expect(count(wwtcFilterOfficeTab($schools, 'to-send')) === 2, 'To send is schools with anything still unsent');
expect(count(wwtcFilterOfficeTab($schools, 'all')) === 3, 'All keeps every school');

$hq = ['type' => 'admin', 'auth' => 'super', 'id' => 1];
$schoolAdmin = ['type' => 'admin', 'auth' => 'school', 'id' => 9];
$soldier = ['type' => 'kid', 'id' => 4];
expect(wwtcOfficeSchoolScope($hq, []) === null, 'HQ sees every school');
expect(wwtcOfficeSchoolScope($schoolAdmin, [61, 0]) === [61], 'a school admin sees only their school');
expect(wwtcOfficeSchoolScope($schoolAdmin, []) === [], 'a school admin with no school is not given the army');
expect(wwtcOfficeSchoolScope($soldier, [61]) === false, 'a soldier cannot open the office');
expect(wwtcOfficeSchoolScope(null, [61]) === false, 'a public caller cannot open the office');
$scoped = wwtcScopeGraphicRows([
    ['school_id' => 61, 'whatsapp' => '17185550101'],
    ['school_id' => 80, 'whatsapp' => '17185550199'],
], [61]);
expect(count($scoped) === 1 && (int) $scoped[0]['school_id'] === 61, 'a school admin does not receive another school');

$rows = [[
    'id' => 9,
    'school_id' => 61,
    'school_name' => 'Cheder Menachem (Sample)',
    'class_name' => '1-A',
    'grade' => '1',
    'grade_label' => 'Kitah Alef',
    'file_path' => '',
    'made_at' => '2026-11-02 12:00:00',
    'whatsapp' => '17185550101',
    'sent_at' => '2026-11-03 12:00:00',
    'sent_by' => '1',
    'student' => 'Mendel K.',
    'name' => 'Mendel K.',
    'teacher' => 'Rabbi Cohen',
]];
$public = wwtcPublicSchoolsFromRows($rows, [61 => '/schoolLogos/sample.png']);
$publicJson = json_encode($public);
expect($public[0]['name'] === 'Cheder Menachem (Sample)', 'the public list keeps the school name');
expect($public[0]['graphics'][0]['classLabel'] === 'Kitah Alef-A', 'the public graphic uses the Kitah label');
expect($public[0]['logo'] === '/schoolLogos/sample.png', 'the public list may include the school shield');
expect(!wwtcJsonHasKey($public, 'whatsapp'), 'the public payload has no whatsapp key');
expect(!wwtcJsonHasKey($public, 'sent_at') && !wwtcJsonHasKey($public, 'sent'), 'the public payload has no sent mark');
expect(!wwtcJsonHasKey($public, 'student') && !wwtcJsonHasKey($public, 'teacher'), 'the public payload has no student or teacher');
expect(strpos($publicJson, '17185550101') === false, 'the public JSON does not contain the phone number');
expect(strpos($publicJson, 'Mendel') === false, 'the public JSON does not contain a student name');

$phone = wwtcNormalizeWhatsapp('+1 (718) 555-0100');
expect($phone['digits'] === '17185550100' && $phone['error'] === null, 'a WhatsApp number keeps its country code as digits');
expect(wwtcNormalizeWhatsapp('')['digits'] === null && wwtcNormalizeWhatsapp('')['error'] === null, 'a blank number clears the contact');
expect(wwtcNormalizeWhatsapp('555')['error'] !== null, 'a short number is rejected');

$csv = <<<CSV
School Name,Class,Kitah,Hebrew Month,Campaign Year,Graphic
Cheder Menachem (Sample),1-A,1,Cheshvan,5786,/tmp/does-not-exist.png
"Bais Chaya Mushka (Sample)",Kitah Hei,Hei,Adar 1,5787,
, , , , ,
# a comment the importer ignores
Nobody,1,1,Cheshvan,2024,
CSV;
$parsed = wwtcParseLedgerDocument($csv, 'ledger.csv');
expect(count($parsed['rows']) === 2, 'the CSV reader keeps the two complete rows');
expect($parsed['rows'][0]['class_name'] === '1-A' && $parsed['rows'][0]['grade'] === '1', 'CSV class 1-A stays grade 1');
expect($parsed['rows'][1]['month'] === 'Adar I' && $parsed['rows'][1]['grade'] === '5', 'Kitah Hei in Adar 1 becomes grade 5, Adar I');
expect($parsed['rows'][1]['file_path'] === '', 'a missing file path is still a ledger row');
expect(count($parsed['errors']) === 1, 'a Gregorian year is reported and skipped');
$resolved = wwtcResolveLedgerSchools($parsed['rows'], [
    61 => 'Cheder Menachem (Sample)',
    80 => 'Bais Chaya Mushka (Sample)',
]);
expect($resolved['rows'][0]['school_id'] === 61 && $resolved['rows'][1]['school_id'] === 80, 'school names match onto ids');
expect($resolved['errors'] === [], 'both sample schools matched');

$json = json_encode([
    'ledger' => [
        ['schoolId' => 61, 'platoon' => 'Gimmel', 'grade' => '3', 'month' => 'Adar II', 'year' => 5787, 'path' => ''],
        ['school' => 'Nobody', 'class' => '1', 'month' => 'Kislev', 'year' => 5786],
    ],
]);
$fromJson = wwtcParseLedgerDocument($json, 'ledger.json');
expect(count($fromJson['rows']) === 2, 'JSON under a ledger key is read');
expect($fromJson['rows'][0]['month'] === 'Adar II' && $fromJson['rows'][0]['school_id'] === 61, 'Adar II and schoolId survive the JSON import');
expect($fromJson['rows'][0]['grade_label'] === 'Kitah Gimmel', 'the imported grade stores its Kitah name');
$missingSchool = wwtcResolveLedgerSchools([$fromJson['rows'][1]], [61 => 'Cheder Menachem (Sample)']);
expect(count($missingSchool['errors']) === 1, 'an unknown school name is reported instead of guessed');

$headerless = "61,Cheder Menachem (Sample),2,2,Nissan,5786,/tmp/a.png\n";
$noHeader = wwtcParseLedgerDocument($headerless, 'plain.csv');
expect(count($noHeader['rows']) === 1 && $noHeader['rows'][0]['month'] === 'Nissan', 'a headerless file uses the documented column order');
expect(count($noHeader['warnings']) === 1, 'a headerless file says which order it assumed');

$map = wwtcLoadBackgroundMap(__DIR__ . '/../../api/platoon-graphics/backgrounds.php');
foreach (['Tishrei', 'Cheshvan', 'Kislev', 'Teves', 'Shvat', 'Adar', 'Adar I', 'Adar II', 'Nissan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul'] as $month) {
    expect(isset($map[$month]) && $map[$month] !== '', "{$month} has its own background entry");
}
expect($map['Adar'] !== $map['Adar I'] && $map['Adar I'] !== $map['Adar II'], 'the three Adar files are different');

$dir = sys_get_temp_dir() . '/wwtc-platoon-test-' . getmypid();
@mkdir($dir, 0775, true);
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
file_put_contents($dir . '/cheshvan.png', $png);
file_put_contents($dir . '/adar-i.png', $png);
$config = $dir . '/backgrounds.php';
file_put_contents($config, "<?php\nreturn ['Cheshvan' => 'backgrounds/cheshvan.png', 'Adar I' => 'backgrounds/adar-i.png', 'Adar II' => 'backgrounds/adar-ii.png'];\n");
// The map paths are relative to the config file's directory. Point them at $dir.
file_put_contents($config, "<?php\nreturn ['Cheshvan' => '{$dir}/cheshvan.png', 'Adar I' => '{$dir}/adar-i.png', 'Adar II' => '{$dir}/missing-adar-ii.png'];\n");
$found = wwtcBackgroundPathForMonth('cheshvan', $config);
expect($found === $dir . '/cheshvan.png', 'a configured background file is returned');
$adar = wwtcBackgroundPathForMonth('Adar 1', $config);
expect($adar === $dir . '/adar-i.png', 'Adar 1 uses the Adar I file, not Adar II');
$threw = false;
$message = '';
try {
    wwtcBackgroundPathForMonth('Adar II', $config);
} catch (RuntimeException $e) {
    $threw = true;
    $message = $e->getMessage();
}
expect($threw, 'a missing Adar II background is an error');
expect(strpos($message, 'Adar II') !== false && strpos($message, 'missing-adar-ii.png') !== false, 'the error names the month and the file');
expect(strpos($message, 'adar-i.png') === false, 'the Adar II error does not blame the Adar I file');

if (!extension_loaded('gd')) {
    echo "ok   - placeholder renderer skipped (php-gd not loaded)\n";
} else {
    $out = $dir . '/out.png';
    $written = wwtcRenderPlatoonGraphic([
        'schoolName' => 'Cheder Menachem (Sample)',
        'classLabel' => 'Kitah Alef-A',
        'logoPath' => null,
        'month' => 'Cheshvan',
        'year' => 5786,
        'backgroundPath' => $dir . '/cheshvan.png',
        'outPath' => $out,
    ]);
    $info = getimagesize($written);
    expect($written === $out && $info && $info[0] === 1080 && $info[1] === 1080, 'the placeholder writes a 1080×1080 PNG');
    $stamp = file_get_contents($written);
    expect(is_string($stamp) && strncmp($stamp, "\x89PNG", 4) === 0, 'the placeholder file is a PNG');
}

// The external renderer runs the command through proc_open()'s array form,
// which is PHP 7.4+. The site's legacy PHP 7.2 only ever uses the GD
// placeholder (no WWTC_PLATOON_RENDER_CMD), so skip this path below 7.4.
if (PHP_VERSION_ID >= 70400) {
    $stub = $dir . '/render-stub.php';
    file_put_contents($stub, "<?php\n\$job = json_decode(file_get_contents(\$argv[1]), true);\nfile_put_contents(\$job['outPath'], 'nope');\n");
    putenv('WWTC_PLATOON_RENDER_CMD=' . PHP_BINARY . ' ' . $stub);
    $commandFailed = false;
    $commandMessage = '';
    try {
        wwtcRenderPlatoonGraphic([
            'schoolName' => 'Sample',
            'classLabel' => 'Kitah Beis',
            'logoPath' => '',
            'month' => 'Cheshvan',
            'year' => 5786,
            'backgroundPath' => $dir . '/cheshvan.png',
            'outPath' => $dir . '/command.png',
        ]);
    } catch (RuntimeException $e) {
        $commandFailed = true;
        $commandMessage = $e->getMessage();
    }
    putenv('WWTC_PLATOON_RENDER_CMD');
    expect($commandFailed && strpos($commandMessage, '1080') !== false, 'a command renderer must write a 1080×1080 PNG');
    expect(wwtcPlatoonRendererId() === 'placeholder', 'with no command configured the renderer is the placeholder');
} else {
    echo "ok   - external command renderer skipped (proc_open array form needs PHP 7.4+)\n";
}

expect(wwtcIsPlatoonGraphicsRoute('/platoon-graphics') === true, 'the public list is our route');
expect(wwtcIsPlatoonGraphicsRoute('/platoon-graphics/school/61') === true, 'one school is our route');
expect(wwtcIsPlatoonGraphicsRoute('/platoon-graphics/file/9') === true, 'the PNG is our route');
expect(wwtcIsPlatoonGraphicsRoute('/office/platoon-graphics/contact') === true, 'the contact save is our route');
expect(wwtcIsPlatoonGraphicsRoute('/schools') === false, 'the school list is not this route');
expect(wwtcIsPlatoonGraphicsRoute('/perfect-platoons') === false, 'perfect platoons stays on its own route');
expect(strpos(wwtcPlatoonGraphicsUsage(), '15 6 * * *') !== false, 'the usage text includes the crontab line');
expect(strpos(wwtcPlatoonGraphicsUsage(), 'wwtc_platoon_graphics.sql') !== false, 'the usage text names the SQL file');

$help = shell_exec(PHP_BINARY . ' ' . escapeshellarg(__DIR__ . '/../../api/bin/make-platoon-graphics.php') . ' --help');
expect(is_string($help) && strpos($help, '15 6 * * *') !== false, 'the CLI prints the crontab without opening the database');

echo "ok   - perfect platoon graphics\n";
