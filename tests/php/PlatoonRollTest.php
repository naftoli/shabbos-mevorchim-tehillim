<?php

declare(strict_types=1);

require __DIR__ . '/../../api/platoonRoll.php';

function expect(bool $ok, string $message): void
{
    if ($ok) {
        echo "ok   - $message\n";
        return;
    }
    fwrite(STDERR, "FAIL - $message\n");
    exit(1);
}

$hq = ['type' => 'admin', 'auth' => 'super', 'id' => 1];
$school = ['type' => 'admin', 'auth' => 'school', 'id' => 9];
$teacherToken = ['type' => 'teacher', 'id' => 4, 'classId' => 555, 'schoolId' => 89];
$soldier = ['type' => 'kid', 'id' => 100];

expect(wwtcCanSeePlatoonRoll(null, 555, 89) === false, 'public caller sees no roll');
expect(wwtcCanSeePlatoonRoll($soldier, 555, 89) === false, 'soldier sees no roll');
expect(wwtcCanSeePlatoonRoll($hq, 555, 89) === true, 'HQ sees any class');
expect(wwtcCanSeePlatoonRoll($school, 555, 89, [89]) === true, 'school admin sees own school');
expect(wwtcCanSeePlatoonRoll($school, 555, 90, [89]) === false, 'school admin does not see another school');
expect(wwtcCanSeePlatoonRoll($school, 555, 90, [], [555]) === true, 'class auth sees that class only');
expect(wwtcCanSeePlatoonRoll($school, 556, 90, [], [555]) === false, 'class auth does not see a different class');
expect(wwtcCanSeePlatoonRoll($teacherToken, 555, 89) === true, 'teacher token sees own class');
expect(wwtcCanSeePlatoonRoll($teacherToken, 556, 89) === false, 'teacher token does not see another class');
expect(WWTC_CLASS_AUTH === 'class', 'class auth string is class');

// Whole-school ladder authority (PUT /admin/ladder, no classId).
expect(wwtcCanManageSchool($hq, 89) === true, 'HQ manages any school');
expect(wwtcCanManageSchool($school, 89, [89]) === true, 'school admin manages own school');
expect(wwtcCanManageSchool($school, 90, [89]) === false, 'school admin does not manage another school');
expect(wwtcCanManageSchool($school, 90, [], [90]) === false, 'class-only auth does not manage a whole school');
expect(wwtcCanManageSchool($soldier, 89) === false, 'soldier does not manage a school');
expect(wwtcCanManageSchool(null, 89) === false, 'public caller does not manage a school');

$rows = [[
    'id' => 7,
    'name' => 'Ahrele Benshimon',
    'goal' => 56,
    'goalLabel' => '56',
    'said' => 150,
    'met' => true,
]];
$summary = [
    'month' => 'Cheshvan',
    'school' => 'Bais Chaya Mushka Iowa',
    'className' => '5-B',
    'completed' => 3,
    'size' => 5,
    'perfect' => false,
];

$public = wwtcPlatoonResponse($summary, $rows, false);
expect($public['roll'] === false, 'public roll flag is false');
expect(!array_key_exists('rows', $public), 'public payload has no rows key');
expect($public['className'] === '5-B', 'public payload keeps the platoon name');
expect($public['completed'] === 3 && $public['size'] === 5, 'public payload keeps the quota counts');
$publicJson = json_encode($public);
expect(strpos($publicJson, 'Ahrele') === false, 'public JSON has no student name');
expect(strpos($publicJson, '150') === false, 'public JSON has no said amount');
expect(strpos($publicJson, '56') === false, 'public JSON has no per-student quota');

$staff = wwtcPlatoonResponse($summary, $rows, true);
expect($staff['roll'] === true, 'staff roll flag is true');
expect($staff['rows'][0]['name'] === 'Ahrele Benshimon', 'staff payload includes the name');
expect($staff['rows'][0]['said'] === 150, 'staff payload includes the amount');
expect(!isset($summary['rows']) && !isset($summary['roll']), 'builder does not write the roll back onto the summary');

echo "ok   - platoon roll gate\n";
