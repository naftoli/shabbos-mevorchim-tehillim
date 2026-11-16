<?php

declare(strict_types=1);

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

$tied = wwtcTopTenFromRace([
    ['id' => 2, 'name' => 'Beis', 'pctMet' => 80, 'metMonth' => 4],
    ['id' => 1, 'name' => 'Aleph', 'pctMet' => 80, 'metMonth' => 9],
    ['id' => 3, 'name' => 'Gimmel', 'pctMet' => 70, 'metMonth' => 99],
]);
expect(count($tied) === 3, 'three schools inside the top 10 all stay');
expect($tied[0]['name'] === 'Aleph' && (int) $tied[0]['rank'] === 1, 'more soldiers who met breaks a percent tie, same as The Race');
expect((int) $tied[1]['rank'] === 2 && (int) $tied[2]['rank'] === 3, 'the next places follow the finished-view order');

$shared = [
    ['id' => 1, 'name' => 'Aleph', 'pctMet' => 90, 'metMonth' => 5],
    ['id' => 2, 'name' => 'Beis', 'pctMet' => 90, 'metMonth' => 5],
    ['id' => 3, 'name' => 'Gimmel', 'pctMet' => 10, 'metMonth' => 1],
];
$places = wwtcTopTenFromRace($shared);
expect((int) $places[0]['rank'] === 1 && (int) $places[1]['rank'] === 1, 'a tie shares one Top Base number');
expect((int) $places[2]['rank'] === 3, 'the next place skips, the same way The Race does');

$rows = [];
for ($n = 1; $n <= 9; $n++) {
    $rows[] = ['id' => $n, 'name' => 'School ' . str_pad((string) $n, 2, '0', STR_PAD_LEFT), 'pctMet' => 100 - $n, 'metMonth' => 10];
}
$rows[] = ['id' => 10, 'name' => 'Tied B', 'pctMet' => 90, 'metMonth' => 5];
$rows[] = ['id' => 11, 'name' => 'Tied A', 'pctMet' => 90, 'metMonth' => 5];
$rows[] = ['id' => 12, 'name' => 'After', 'pctMet' => 89, 'metMonth' => 50];
$top = wwtcTopTenFromRace($rows);
$byName = [];
foreach ($top as $row) {
    $byName[$row['name']] = (int) $row['rank'];
}
expect(isset($byName['School 01']) && $byName['School 01'] === 1, 'first place is badge 1');
expect($byName['School 09'] === 9, 'ninth place is badge 9');
expect($byName['Tied A'] === 10 && $byName['Tied B'] === 10, 'the two schools tied for 10th both get badge 10');
expect(!isset($byName['After']), 'rank 12 is not a Top 10 graphic');
expect(count($top) === 11, 'a shared 10th place keeps both schools');

$ledger = [
    ['school_id' => 61, 'campaign_year' => 5786, 'month_name' => 'Cheshvan', 'rank_place' => 3, 'id' => 4, 'file_path' => ''],
];
$work = wwtcTopSchoolWork([
    ['id' => 61, 'name' => 'Cheder', 'rank' => 3, 'logo' => null],
    ['id' => 80, 'name' => 'Other', 'rank' => 4],
], $ledger, 5786, 'Cheshvan', false);
expect(count($work['targets']) === 2, 'a missing file is redrawn and a new school is made');
$actions = [];
foreach ($work['targets'] as $target) {
    $actions[$target['schoolId']] = $target['action'];
}
expect($actions[61] === 'redraw' && $actions[80] === 'make', 'the ledger school is a redraw and the new school is a make');
expect(wwtcTopSchoolAction(3, ['rank_place' => 3], false, true) === 'skip', 'the same rank with a file on disk is left alone');
expect(wwtcTopSchoolAction(2, ['rank_place' => 3], false, true) === 'redraw', 'a new badge number is redrawn');
expect(wwtcTopSchoolClearsSent('redraw', 3, 2) === true, 'a rank change clears the sent mark');
expect(wwtcTopSchoolClearsSent('redraw', 3, 3) === false, 'redrawing the same badge keeps the sent mark');
expect(wwtcTopSchoolAction(1, null, false, false) === 'make', 'a school with no ledger row is new');

$second = wwtcTopSchoolWork([
    ['id' => 80, 'name' => 'Other', 'rank' => 4],
], [
    ['school_id' => 80, 'year' => 5786, 'month' => 'Cheshvan', 'rank_place' => 4, 'file_path' => __FILE__],
], 5786, 'Cheshvan', false);
expect($second['skipped'] === 1 && $second['targets'] === [], 'a second pass does not draw the same Top 10 graphic again');

list($platoonIds, $topIds) = wwtcSplitGraphicIds([9, 'top-4', 'Mendel K.', 'top-nope']);
expect($platoonIds === [9], 'a platoon id stays a platoon id');
expect($topIds === [4], 'a top- id is the Top 10 row, and a name is not an id');

$public = wwtcPublicSchoolsFromRows([[
    'id' => 7,
    'kind' => 'top10',
    'school_id' => 61,
    'school_name' => 'Cheder Menachem (Sample)',
    'class_name' => '',
    'grade' => '',
    'rank_place' => 3,
    'file_path' => '',
    'student' => 'Mendel K.',
    'teacher' => 'Rabbi Cohen',
    'whatsapp' => '17185550101',
]], [61 => '/schoolLogos/sample.png']);
$publicJson = json_encode($public);
expect($public[0]['graphics'][0]['kind'] === 'top10', 'a Top 10 row is marked top10');
expect($public[0]['graphics'][0]['id'] === 'top-7', 'the public id does not collide with a platoon file');
expect((int) $public[0]['graphics'][0]['rank'] === 3, 'the public graphic keeps the badge number');
expect($public[0]['graphics'][0]['classLabel'] === 'Top 10 School', 'the public label is the school celebration, not a class');
expect(!wwtcJsonHasKey($public, 'whatsapp'), 'the Top 10 payload has no whatsapp key');
expect(!wwtcJsonHasKey($public, 'student') && !wwtcJsonHasKey($public, 'teacher'), 'the Top 10 payload has no student or teacher');
expect(strpos($publicJson, 'Mendel') === false, 'the Top 10 JSON does not contain a student name');
expect(strpos($publicJson, 'Rabbi') === false, 'the Top 10 JSON does not contain a teacher name');
expect(strpos($publicJson, '17185550101') === false, 'the Top 10 JSON does not contain a phone number');

expect(wwtcIsPlatoonGraphicsRoute('/platoon-graphics/file/top-7') === true, 'the Top 10 PNG is our route');
expect(wwtcIsPlatoonGraphicsRoute('/platoon-graphics/file/7') === true, 'a platoon PNG route is unchanged');
expect(strpos(wwtcPlatoonGraphicsUsage(), 'wwtc_top_school_graphics.sql') !== false, 'the usage text names the Top 10 SQL file');
expect(wwtcTopSchoolGraphicsTableReady() === false, 'without the database the Top 10 table is not installed');
expect(wwtcTopBaseBadgePath(3) !== null && strpos((string) wwtcTopBaseBadgePath(3), 'top-base-3.webp') !== false, 'badge 3 uses the existing Top Base art');
expect(wwtcTopBaseBadgePath(11) === null, 'there is no badge past 10');

echo "ok   - top 10 school graphics\n";
