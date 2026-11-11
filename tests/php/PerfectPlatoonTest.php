<?php

declare(strict_types=1);

require __DIR__ . '/../../api/perfectPlatoon.php';

function expect(bool $ok, string $message): void
{
    if ($ok) {
        echo "ok   - $message\n";
        return;
    }
    fwrite(STDERR, "FAIL - $message\n");
    exit(1);
}

expect(wwtcSoldierMetQuota(10, 10) === true, 'said equal to quota counts');
expect(wwtcSoldierMetQuota(10, 36) === true, 'said over quota counts');
expect(wwtcSoldierMetQuota(10, 9) === false, 'said under quota does not count');
expect(wwtcSoldierMetQuota(0, 5) === false, 'a zero quota is not met');
expect(wwtcClassIsPerfect(11, 11) === true, 'every soldier met is a perfect platoon');
expect(wwtcClassIsPerfect(10, 11) === false, 'one soldier short is not perfect');
expect(wwtcClassIsPerfect(0, 0) === false, 'an empty class is not perfect');
// The old /perfect-platoons test was met >= size, so a duplicated mission mark
// could paper over a missing soldier. The shared rule is met === size.
expect(wwtcClassIsPerfect(12, 11) === false, 'more marks than soldiers is not perfect');

// One school, five classes, three of them perfect under three teachers.
// Kapitlach said vs quota only — there is no mission-mark field. "4-boys" and
// "4-Boys" are different classes. A name on the input must not come back out.
$school = 'Sample Cheder';
$sid = 61;
$soldier = static function (int $cid, string $grade, string $sub, string $teacher, int $quota, int $said, string $name) use ($sid, $school): array {
    return [
        'schoolId' => $sid,
        'school' => $school,
        'classId' => $cid,
        'grade' => $grade,
        'sub' => $sub,
        'teacher' => $teacher,
        'quota' => $quota,
        'said' => $said,
        'name' => $name,
        'userId' => 900000 + $cid,
    ];
};
$soldiers = [];
foreach ([401 => ['4', 'boys', 'Rabbi Adler'], 402 => ['4', 'Boys', 'Rabbi Berg'], 403 => ['3', 'Boys', 'Rabbi Klein']] as $cid => $meta) {
    for ($i = 0; $i < 4; $i++) {
        $soldiers[] = $soldier($cid, $meta[0], $meta[1], $meta[2], 12, 36, "Fictional {$cid}-{$i} K.");
    }
}
// 1-Boys: three finished, one short. The classes view would not star this.
for ($i = 0; $i < 3; $i++) {
    $soldiers[] = $soldier(404, '1', 'Boys', 'Rabbi Dale', 8, 24, "Fictional 404-{$i} K.");
}
$soldiers[] = $soldier(404, '1', 'Boys', 'Rabbi Dale', 8, 3, 'Fictional 404-short K.');
// 2-Boys: one child has no quota, so the class is not perfect even though the
// others finished. Same as the class report (quota must be > 0).
$soldiers[] = $soldier(405, '2', 'Boys', 'Rabbi Engel', 8, 24, 'Fictional 405-a K.');
$soldiers[] = $soldier(405, '2', 'Boys', 'Rabbi Engel', 0, 24, 'Fictional 405-noquota K.');
// A second school, so the first school's class count stays 5.
$soldiers[] = [
    'schoolId' => 62,
    'school' => 'Other Sample',
    'classId' => 501,
    'grade' => '5',
    'sub' => 'A',
    'teacher' => 'Rabbi Fox',
    'quota' => 10,
    'said' => 10,
    'name' => 'Fictional Other K.',
];

$rows = wwtcPerfectPlatoonsFromSoldiers($soldiers);
$byId = [];
foreach ($rows as $row) {
    if ((int) $row['schoolId'] === $sid) {
        $byId[(int) $row['classId']] = $row;
    }
}

expect(count($byId) === 3, 'the school contributes three perfect platoons');
expect(isset($byId[401], $byId[402], $byId[403]), 'each perfect class id is its own row');
expect(!isset($byId[404]) && !isset($byId[405]), 'the short class and the no-quota class are left out');
expect($byId[401]['className'] === '4-boys', '4-boys keeps its lowercase spelling');
expect($byId[402]['className'] === '4-Boys', '4-Boys stays a different platoon');
expect($byId[403]['className'] === '3-Boys', '3-Boys keeps its spelling');
expect($byId[401]['teacher'] === 'Rabbi Adler', 'first teacher is Rabbi Adler');
expect($byId[402]['teacher'] === 'Rabbi Berg', 'second teacher is Rabbi Berg');
expect($byId[403]['teacher'] === 'Rabbi Klein', 'third teacher is Rabbi Klein');
$teachers = [$byId[401]['teacher'], $byId[402]['teacher'], $byId[403]['teacher']];
expect(count(array_unique($teachers)) === 3, 'three teachers are not collapsed into one card');
expect($byId[401]['schoolClasses'] === 5 && $byId[403]['schoolClasses'] === 5, 'the slash denominator is every class on the roster, 3 / 5');
expect($byId[401]['size'] === 4 && $byId[402]['size'] === 4 && $byId[403]['size'] === 4, 'size is the soldiers who have a quota');

$public = ['schoolId', 'school', 'classId', 'className', 'teacher', 'grade', 'size', 'schoolClasses'];
foreach ($rows as $row) {
    $keys = array_keys($row);
    sort($keys);
    $want = $public;
    sort($want);
    expect($keys === $want, 'a public row has class fields only');
}
$json = json_encode($rows);
expect(strpos($json, 'Fictional') === false, 'public JSON has no student name');
expect(strpos($json, 'userId') === false, 'public JSON has no user id');
expect(strpos($json, '900') === false, 'public JSON has no soldier id number');

$quotaSql = wwtcPerfectPlatoonQuotaSql();
$doneSql = wwtcPerfectPlatoonDoneSql();
expect(strpos($quotaSql, 'date_tasks_mission_marks') === false, 'quota query does not read mission marks');
expect(strpos($doneSql, 'date_tasks_mission_marks') === false, 'said query does not read mission marks');
expect(strpos($quotaSql, 'dt.quantity') !== false, 'quota is the kapitlach task quantity');
expect(strpos($doneSql, 'date_tasks_marks') !== false && strpos($doneSql, 'done_qty') !== false, 'said is live done_qty');
expect(strpos($quotaSql, 'user_track_history') !== false, 'quota uses the ladder the soldier was on that month');
expect(strpos($quotaSql, 'u.first') === false && strpos($quotaSql, 'u.last') === false, 'quota query selects no student name');
expect(strpos($doneSql, 'u.first') === false && strpos($doneSql, 'u.last') === false, 'said query selects no student name');

echo "ok   - perfect platoon definition\n";
