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

// Unaccepted flags do not count, even when the live mark still holds the
// flagged amount. Accepted uses the reviewed number. "0" is not a prior mark.
expect(wwtcPlatoonCountedSaid(150, ['status' => 'flagged', 'kapitlach' => 150, 'prior_kapitlach' => 0, 'prior_reported' => 0]) === 0, 'a flagged 150 with no prior mark counts as 0');
expect(wwtcPlatoonCountedSaid(150, ['status' => 'flagged', 'kapitlach' => 150, 'prior_kapitlach' => 4, 'prior_reported' => '1']) === 4, 'a flagged 150 keeps the prior 4');
expect(wwtcPlatoonCountedSaid(150, ['status' => 'flagged', 'kapitlach' => 150, 'prior_kapitlach' => 4, 'prior_reported' => '0']) === 0, 'prior_reported 0 is not a prior mark');
expect(wwtcPlatoonCountedSaid(4, ['status' => 'accepted', 'kapitlach' => 150, 'prior_kapitlach' => 4, 'prior_reported' => 1]) === 150, 'an accepted flag counts as the reviewed amount');

$flagged = wwtcApplyFlagsToPlatoonSoldiers([
    ['userId' => 7, 'schoolId' => 1, 'classId' => 1, 'grade' => '3', 'sub' => 'Boys', 'quota' => 12, 'said' => 150, 'name' => 'Fictional Secret'],
], [
    7 => ['status' => 'flagged', 'kapitlach' => 150, 'prior_kapitlach' => 0, 'prior_reported' => 0],
]);
expect($flagged[0]['said'] === 0, 'applying the flag replaces the live 150');
expect(count(wwtcPerfectPlatoonsFromSoldiers($flagged)) === 0, 'that class is not perfect once the flag is withheld');

// The report engine's class list disagrees with the shared roster: wrong
// label, a flagged class starred, a short class starred, a class that is not
// on the roster starred, and two perfect classes missing. Home, the school
// page, and the base/platoon report must come back to the same ids.
$school = 'Sample Cheder';
$sid = 61;
$member = static function (int $cid, string $grade, string $sub, string $teacher, int $quota, int $said, int $uid) use ($sid, $school): array {
    return [
        'schoolId' => $sid,
        'school' => $school,
        'classId' => $cid,
        'grade' => $grade,
        'sub' => $sub,
        'teacher' => $teacher,
        'quota' => $quota,
        'said' => $said,
        'userId' => $uid,
        'name' => 'Fictional Secret',
    ];
};
$raw = [];
for ($i = 0; $i < 4; $i++) {
    $raw[] = $member(401, '4', 'boys', 'Rabbi Adler', 12, 36, 4010 + $i);
    $raw[] = $member(402, '4', 'Boys', 'Rabbi Berg', 12, 36, 4020 + $i);
}
for ($i = 0; $i < 3; $i++) {
    $raw[] = $member(403, '3', 'Boys', 'Rabbi Klein', 12, 36, 4030 + $i);
}
$raw[] = $member(403, '3', 'Boys', 'Rabbi Klein', 12, 150, 4039);
// 405 is perfect only because the override quota is what the soldier entered.
$raw[] = $member(405, '2', 'Boys', 'Rabbi Engel', 5, 5, 4051);
$raw[] = $member(405, '2', 'Boys', 'Rabbi Engel', 8, 8, 4052);
$adjusted = wwtcApplyFlagsToPlatoonSoldiers($raw, [
    4039 => ['status' => 'flagged', 'kapitlach' => 150, 'prior_kapitlach' => 0, 'prior_reported' => 0],
]);
$withoutFlag = wwtcPerfectPlatoonsFromSoldiers($raw);
$flagIds = [];
foreach ($withoutFlag as $row) {
    if ((int) $row['schoolId'] === $sid) {
        $flagIds[] = (int) $row['classId'];
    }
}
sort($flagIds);
expect(in_array(403, $flagIds, true), 'before the flag is withheld, 3-Boys is perfect');

$home = [];
foreach (wwtcPerfectPlatoonsFromSoldiers($adjusted) as $row) {
    if ((int) $row['schoolId'] === $sid) {
        $home[] = (int) $row['classId'];
    }
}
sort($home);
expect($home === [401, 402, 405], 'home lists 4-boys, 4-Boys, and the overridden class');
expect(!in_array(403, $home, true), 'home drops 3-Boys once the flag is withheld');

$unoverridden = $adjusted;
foreach ($unoverridden as $i => $s) {
    if ((int) $s['classId'] === 405 && (int) $s['userId'] === 4051) {
        $unoverridden[$i]['quota'] = 18;
    }
}
$noOverride = [];
foreach (wwtcPerfectPlatoonsFromSoldiers($unoverridden) as $row) {
    if ((int) $row['schoolId'] === $sid) {
        $noOverride[] = (int) $row['classId'];
    }
}
expect(!in_array(405, $noOverride, true), 'without the override that class is not on the home list');

$reportClasses = [
    ['id' => 401, 'name' => '4', 'grade' => '4', 'teacher' => 'Wrong Teacher', 'size' => 11, 'met' => 11, 'perfect' => true, 'quota' => 100, 'said' => 100],
    ['id' => 403, 'name' => '3-Boys', 'grade' => '3', 'teacher' => 'Rabbi Klein', 'size' => 4, 'met' => 4, 'perfect' => true, 'quota' => 48, 'said' => 48],
    ['id' => 404, 'name' => '1-Boys', 'grade' => '1', 'teacher' => 'Rabbi Dale', 'size' => 4, 'met' => 4, 'perfect' => true, 'quota' => 32, 'said' => 32],
    ['id' => 406, 'name' => '9-A', 'grade' => '9', 'teacher' => 'Rabbi Gone', 'size' => 2, 'met' => 2, 'perfect' => true, 'quota' => 20, 'said' => 20],
];
$enginePerfect = [];
foreach ($reportClasses as $c) {
    if (!empty($c['perfect'])) {
        $enginePerfect[] = (int) $c['id'];
    }
}
sort($enginePerfect);
expect($enginePerfect !== $home, 'the report engine on its own lists different classes');

$roster = wwtcPlatoonRoster($adjusted);
$aligned = wwtcAlignSchoolClasses($reportClasses, $roster, $sid);
$schoolIds = [];
$reportIds = [];
$platoonIds = [];
$byAligned = [];
foreach ($aligned as $c) {
    $byAligned[(int) $c['id']] = $c;
    if (empty($c['perfect'])) {
        continue;
    }
    $schoolIds[] = (int) $c['id'];
    $reportIds[] = (int) $c['id'];
    // The platoon report copies met, size, and perfect off this same class row.
    if (!empty($c['perfect'])) {
        $platoonIds[] = (int) $c['id'];
    }
}
sort($schoolIds);
sort($reportIds);
sort($platoonIds);
expect($schoolIds === $home, 'the school page lists the same perfect platoons as home');
expect($reportIds === $home, 'the base report lists the same perfect platoons as home');
expect($platoonIds === $home, 'the platoon report uses that same perfect set');
expect($byAligned[401]['name'] === '4-boys' && $byAligned[401]['teacher'] === 'Rabbi Adler', '4-boys keeps the home label and teacher');
expect($byAligned[401]['size'] === 4 && $byAligned[401]['met'] === 4, 'the fraction is the roster, not the engine 11 of 11');
expect($byAligned[401]['quota'] === 100 && $byAligned[401]['said'] === 100, 'kapitlach totals on a class the engine returned stay the engine figures');
expect(isset($byAligned[402]) && $byAligned[402]['name'] === '4-Boys' && $byAligned[402]['perfect'] === true, '4-Boys was missing from the engine and is added');
expect(isset($byAligned[405]) && $byAligned[405]['perfect'] === true, 'the overridden class was missing and is added');
expect($byAligned[403]['perfect'] === false && $byAligned[404]['perfect'] === false && $byAligned[406]['perfect'] === false, 'flagged, short, and off-roster classes are not perfect');
expect($byAligned[406]['size'] === 2, 'a class that is not on the roster keeps its engine headcount');

$public = json_encode($aligned) . json_encode(wwtcPerfectPlatoonsFromSoldiers($adjusted));
expect(strpos($public, 'Fictional Secret') === false, 'school and home payloads have no student name');
expect(strpos($public, 'userId') === false, 'school and home payloads have no user id');

$patched = wwtcApplyRosterToStudents([
    ['id' => 4039, 'classId' => 403, 'name' => 'Fictional Secret', 'quota' => 12, 'said' => 150, 'met' => true],
    ['id' => 9999, 'classId' => 406, 'name' => 'Fictional Other', 'quota' => 10, 'said' => 10, 'met' => true],
], $roster, $sid);
expect($patched[0]['said'] === 0 && $patched[0]['met'] === false, 'the roll withholds the flagged amount');
expect($patched[1]['said'] === 10 && $patched[1]['met'] === true, 'a soldier the roster does not include is left as the report had them');

require __DIR__ . '/../../api/notify.php';
$notifySchool = wwtcNotifySchoolFromReport([
    'classes' => $aligned,
    'students' => [
        ['classId' => 403, 'className' => '3', 'name' => 'Fictional Secret', 'quota' => 12, 'said' => 150],
        ['classId' => 406, 'className' => '9-A', 'name' => 'Fictional Other', 'quota' => 10, 'said' => 10],
    ],
], $school);
$pdfReport = wwtcNotifyComposeReport(
    wwtcNotifyRecipient(1, 'Commander', 'base', $sid, $school, 0, '', '7185550109', 'commander@example.com'),
    [$sid => $notifySchool],
    'Cheshvan',
    5787,
    'https://example.test/login',
    'December 1'
);
$pdfText = '';
foreach ($pdfReport['pdfLines'] as $line) {
    $pdfText .= $line['text'] . "\n";
}
expect($pdfReport['perfect'] === 3, 'the Wednesday PDF counts the same three perfect platoons');
expect(strpos($pdfText, 'Perfect platoons: 3') !== false, 'the PDF states that count');
expect(strpos($pdfText, 'Class 4-boys: 4 of 4 - perfect platoon') !== false, 'the PDF lists 4-boys');
expect(strpos($pdfText, 'Class 4-Boys: 4 of 4 - perfect platoon') !== false, 'the PDF lists 4-Boys');
expect(strpos($pdfText, 'Class 2-Boys: 2 of 2 - perfect platoon') !== false, 'the PDF lists the overridden class');
expect(strpos($pdfText, '3-Boys') !== false && strpos($pdfText, '3-Boys - perfect platoon') === false, 'the flagged class is not called a perfect platoon');
expect(strpos($pdfText, '9-A - perfect platoon') === false, 'the off-roster class is not called a perfect platoon');
expect(strpos(json_encode(wwtcPerfectPlatoonsFromSoldiers($adjusted)), 'Fictional Secret') === false, 'the public platoon list still has no student name');

echo "ok   - perfect platoon definition\n";
