<?php

declare(strict_types=1);

// Monthly follow-up: schedule (including leap-year Adar I / Adar II), channel
// fallback, idempotency, dry-run, and a recipient only receiving their own kids.
// Run: php tests/php/NotifyTest.php

require __DIR__ . '/../../api/hebrewYear.php';
require __DIR__ . '/../../api/notify.php';

$failed = 0;
function check(string $name, bool $ok): void
{
    global $failed;
    if ($ok) {
        echo "ok  $name\n";
        return;
    }
    $failed++;
    echo "FAIL $name\n";
}

function nyDay(string $ymd, int $addDays = 0): string
{
    $zone = new DateTimeZone('America/New_York');
    $day = new DateTimeImmutable($ymd . ' 12:00:00', $zone);
    if ($addDays !== 0) {
        $day = $day->modify(($addDays > 0 ? '+' : '') . $addDays . ' day');
    }
    return $day->format('Y-m-d');
}

// ---- schedule --------------------------------------------------------------

check(
    'first Wednesday after a Saturday crosses the March DST change',
    wwtcNotifyFirstWednesdayAfter('2026-03-07') === '2026-03-11'
);
check(
    'the Wednesday is strictly after the Shabbos, not the Shabbos itself',
    wwtcNotifyFirstWednesdayAfter('2026-11-11') === '2026-11-18'
);

$utcEvening = new DateTimeImmutable('2026-11-11 02:30:00', new DateTimeZone('UTC'));
check(
    'the send day is the America/New_York date, not UTC',
    wwtcNotifyTodayNewYork($utcEvening) === '2026-11-10'
);
check(
    'julian day converts to the gregorian Shabbos',
    wwtcNotifyYmdFromJd(gregoriantojd(11, 7, 2026)) === '2026-11-07'
);

$cheshvan = ['Cheshvan' => '2026-11-07'];
$onDay = wwtcNotifyLatestShabbos($cheshvan, '2026-11-11');
check('Cheshvan Wednesday is a send day', wwtcNotifyIsSendDay($onDay, '2026-11-11') && $onDay['month'] === 'Cheshvan');
check('the day after that Wednesday is not a send day', !wwtcNotifyIsSendDay(wwtcNotifyLatestShabbos($cheshvan, '2026-11-12'), '2026-11-12'));
check(
    'the next Wednesday is not the first Wednesday after that Shabbos',
    !wwtcNotifyIsSendDay(wwtcNotifyLatestShabbos($cheshvan, '2026-11-18'), '2026-11-18')
);
check('before the first Shabbos there is nothing to send', wwtcNotifyLatestShabbos($cheshvan, '2026-11-06') === null);

function campaignSmMap(int $year): array
{
    $leap = wwtcIsHebrewLeapYear($year);
    $zone = new DateTimeZone('America/New_York');
    $map = [];
    foreach (wwtcCampaignMonthNames($year) as $month) {
        $phpMonth = [
            'Tishrei' => 1, 'Cheshvan' => 2, 'Kislev' => 3, 'Teves' => 4, 'Shvat' => 5,
            'Adar' => 6, 'Adar I' => 6, 'Adar II' => 7, 'Nissan' => 8, 'Iyar' => 9,
            'Sivan' => 10, 'Tammuz' => 11, 'Av' => 12, 'Elul' => 13,
        ][$month];
        $rosh = DateTimeImmutable::createFromFormat('!n/j/Y', jdtogregorian(jewishtojd($phpMonth, 1, $year)), $zone);
        $shabbos = $rosh->modify('-1 day');
        while ($shabbos->format('N') !== '6') {
            $shabbos = $shabbos->modify('-1 day');
        }
        $map[$month] = $shabbos->format('Y-m-d');
    }
    return $map;
}

foreach ([5787 => true, 5784 => true, 5785 => false] as $year => $leap) {
    $map = campaignSmMap($year);
    $names = wwtcCampaignMonthNames($year);
    check("$year month list matches the campaign", array_keys($map) === $names);
    $wednesdays = [];
    foreach ($map as $month => $shabbos) {
        $wednesday = wwtcNotifyFirstWednesdayAfter($shabbos);
        $wednesdays[$month] = $wednesday;
        $latest = wwtcNotifyLatestShabbos($map, $wednesday);
        check(
            "$year $month sends on its own first Wednesday",
            $latest !== null && $latest['month'] === $month && wwtcNotifyIsSendDay($latest, $wednesday)
        );
        $dayAfter = nyDay($wednesday, 1);
        check(
            "$year $month does not send the day after",
            !wwtcNotifyIsSendDay(wwtcNotifyLatestShabbos($map, $dayAfter), $dayAfter)
        );
    }
    check("$year gives each month its own Wednesday", count($wednesdays) === count(array_unique($wednesdays)));
    if ($leap) {
        check("$year keeps Adar I and Adar II", isset($map['Adar I'], $map['Adar II']) && !isset($map['Adar']));
        check(
            "$year Adar I and Adar II are different Wednesdays",
            $wednesdays['Adar I'] !== $wednesdays['Adar II'] && $map['Adar I'] < $map['Adar II']
        );
        $between = nyDay($wednesdays['Adar I'], 7);
        $still = wwtcNotifyLatestShabbos($map, $between);
        check(
            "$year the Wednesday after Adar I's follow-up is not a send",
            $still !== null && $still['month'] === 'Adar I' && !wwtcNotifyIsSendDay($still, $between)
        );
    } else {
        check("$year has one Adar", isset($map['Adar']) && !isset($map['Adar I']) && !isset($map['Adar II']));
    }
}

// ---- phones, columns, recipients ------------------------------------------

check('US formatted number becomes E.164', wwtcNotifyNormalizePhone('(718) 555-0101')['e164'] === '+17185550101');
check('11 digits with a leading 1 becomes E.164', wwtcNotifyNormalizePhone('17185550101')['e164'] === '+17185550101');
check('a plus already in E.164 is kept', wwtcNotifyNormalizePhone('+972501234567')['e164'] === '+972501234567');
check('a 7-digit number is skipped', wwtcNotifyNormalizePhone('555-0101')['ok'] === false);
check('an empty number is skipped', wwtcNotifyNormalizePhone('   ')['ok'] === false);

$picked = wwtcNotifyPickPhones(['admin_id', 'admin_email', 'admin_phone_work', 'admin_phone_mobile', 'admin_phone_home']);
check('mobile is the phone we send to', $picked['phoneColumn'] === 'admins.admin_phone_mobile');
check('home and work are only fallbacks', $picked['phoneFallbacks'] === ['admins.admin_phone_home', 'admins.admin_phone_work']);
check('email column is admins.admin_email', $picked['emailColumn'] === 'admins.admin_email');
check('missing phone columns stay missing', wwtcNotifyPickPhones(['admin_id'])['phoneColumn'] === null);

$sql = wwtcNotifyRecipientSql(['admin_email', 'admin_phone_mobile', 'admin_phone_home']);
check('recipient SQL reads the admin email and mobile', strpos($sql, 'a.admin_email') !== false && strpos($sql, 'a.admin_phone_mobile') !== false);
check('recipient SQL maps school and class auths', strpos($sql, "aa.auth IN ('school', 'class')") !== false);
check('recipient SQL does not read users', stripos($sql, 'users') === false);
check('a phone column that is not on the whitelist is ignored', strpos(wwtcNotifyRecipientSql(['admin_password', 'user_phone']), 'admin_password') === false);

$rows = wwtcNotifyRecipientsFromRows([
    [
        'admin_id' => 9, 'first' => 'Rivka', 'last' => 'Goldstein', 'auth' => 'school', 'scope_id' => 89,
        'auth_school_id' => 89, 'auth_school_name' => 'Bais Chaya',
        'admin_email' => 'rivka@example.com', 'admin_phone_mobile' => '7185550103', 'admin_phone_home' => '7185550199',
    ],
    [
        'admin_id' => 10, 'first' => 'Leah', 'last' => 'Stein', 'auth' => 'school', 'scope_id' => 90,
        'auth_school_id' => 90, 'auth_school_name' => 'Other Base',
        'admin_phone_mobile' => '7185550104',
    ],
    [
        'admin_id' => 4, 'first' => 'Mrs', 'last' => 'Klein', 'auth' => 'class', 'scope_id' => 555,
        'class_id' => 555, 'class_grade' => '5', 'class_sub' => 'B', 'class_school_id' => 89,
        'class_school_name' => 'Bais Chaya', 'admin_phone_mobile' => '', 'admin_phone_home' => '(718) 555-0101',
    ],
    [
        'admin_id' => 8, 'first' => 'Mrs', 'last' => 'Adler', 'auth' => 'class', 'scope_id' => 556,
        'class_id' => 556, 'class_grade' => '6', 'class_sub' => 'A', 'class_school_id' => 89,
        'class_school_name' => 'Bais Chaya', 'admin_phone_mobile' => '7185550102',
    ],
    [
        'admin_id' => 3, 'first' => 'No', 'last' => 'Class', 'auth' => 'class', 'scope_id' => 999,
        'class_id' => null, 'class_school_id' => null,
    ],
    [
        'admin_id' => 2, 'first' => 'Parent', 'last' => 'One', 'auth' => 'user', 'scope_id' => 50,
    ],
], [89]);
$byKey = [];
foreach ($rows as $recipient) {
    $byKey[wwtcNotifyRecipientKey($recipient)] = $recipient;
}
check('school 89 commander is included', isset($byKey['admin:9:base:89']) && $byKey['admin:9:base:89']['role'] === 'base');
check('an ineligible school commander is excluded', !isset($byKey['admin:10:base:90']));
check('class 555 teacher is included', isset($byKey['admin:4:class:555']) && $byKey['admin:4:class:555']['className'] === '5-B');
check('class 556 teacher is included', isset($byKey['admin:8:class:556']) && $byKey['admin:8:class:556']['schoolId'] === 89);
check('a class auth with no class row is excluded', !isset($byKey['admin:3:class:999']) && count($rows) === 3);
check('a parent auth=user row is not a recipient', count(array_filter($rows, function ($r) { return $r['role'] === 'base' || $r['role'] === 'class'; })) === 3);
check('mobile wins over the home phone', $byKey['admin:9:base:89']['phone'] === '7185550103');
check('home is used when mobile is empty', $byKey['admin:4:class:555']['phone'] === '(718) 555-0101');
check('the guess text names the columns and says they are a guess', strpos(wwtcNotifyColumnGuessText(), 'GUESS for Naftoli') !== false && strpos(wwtcNotifyColumnGuessText(), 'admin_phone_mobile') !== false);

$split = wwtcNotCompletedClasses([
    ['classId' => 1, 'className' => '1', 'name' => 'Full Kid', 'said' => 10, 'quota' => 10],
    ['classId' => 1, 'className' => '1', 'name' => 'Short Kid', 'said' => 4, 'quota' => 10],
    ['classId' => 1, 'className' => '1', 'name' => 'Zero Kid', 'said' => 0, 'quota' => 10],
    ['classId' => 2, 'className' => 'כיתה א', 'name' => 'No Mark', 'said' => 0, 'quota' => 8],
    ['classId' => 3, 'className' => 'Done', 'name' => 'Done Kid', 'said' => 8, 'quota' => 8],
    ['classId' => 4, 'className' => 'Open', 'name' => 'Reported Anyway', 'said' => 5, 'quota' => 0],
], [
    ['id' => 1, 'size' => 8],
    ['id' => 2, 'size' => 25],
    ['id' => 3, 'size' => 1],
    ['id' => 4, 'size' => 2],
]);
check('full soldiers are left out of not-completed', count($split) === 3);
$splitByName = [];
foreach ($split as $class) {
    $splitByName[$class['className']] = $class;
}
$splitNames = [];
foreach ($split as $class) {
    $splitNames[] = $class['className'];
}
check('incomplete classes are in grade order', $splitNames === ['1', 'Open', 'כיתה א']);
check(
    'a numeric class keeps missing in roster order and splits the two groups',
    $splitByName['1']['size'] === 8
    && $splitByName['1']['missing'] === ['Short Kid', 'Zero Kid']
    && $splitByName['1']['under'] === ['Short Kid']
    && $splitByName['1']['notFilled'] === ['Zero Kid']
);
check(
    'a zero mark is not filled out',
    $splitByName['כיתה א']['under'] === [] && $splitByName['כיתה א']['notFilled'] === ['No Mark'] && $splitByName['כיתה א']['size'] === 25
);
check('a mark with no quota is under, not full', $splitByName['Open']['under'] === ['Reported Anyway'] && $splitByName['Open']['notFilled'] === []);
check('one still needs, many still need', wwtcNotifyStillNeed(1, 'finish') === '1 still needs to finish' && wwtcNotifyStillNeed(2, 'submit') === '2 still need to submit');

// ---- messages --------------------------------------------------------------

$link = 'https://mashpia.test/api/notify-report?t=abc';
$fill = 'https://mashpia.test/login';
$teacherBody = wwtcNotifyBodies('class', 25, 30, 5, $link, [], $fill, 3);
check(
    'teacher WhatsApp text is the approved sentence',
    $teacherBody['whatsapp'] === "25 out of 30 kids in your class filled out their Shabbos Mevorchim Tehillim, but 5 didn't. See the full report here: $link. Please follow up with them today and see why they didn't."
);
check('teacher WhatsApp does not call the PDF a fill-out link', strpos($teacherBody['whatsapp'], 'fill it out') === false && strpos($teacherBody['whatsapp'], $fill) === false);
check(
    'teacher SMS separates the report link from the fill-out link',
    strpos($teacherBody['sms'], "See the full report here: $link") !== false
    && strpos($teacherBody['sms'], "Link to fill it out: $fill") !== false
    && strpos($teacherBody['sms'], "Reply STOP to opt out.") !== false
    && strpos($teacherBody['sms'], '/reports') === false
    && strpos($teacherBody['sms'], '/my-class') === false
);
check('teacher SMS counts both incomplete groups', strpos($teacherBody['sms'], '3 still need to finish, 5 still need to submit') !== false);
$baseBody = wwtcNotifyBodies('base', 25, 30, 5, $link, ['Class 5-B: 10 of 12', 'Class 6-A: 15 of 18'], $fill, 3, ['Class: 5-B', '3 still need to finish, 2 still need to submit']);
check('base SMS lists each class and both links', strpos($baseBody['sms'], "Class 5-B: 10 of 12\nClass 6-A: 15 of 18") !== false && strpos($baseBody['sms'], "Link to fill it out: $fill") !== false && strpos($baseBody['sms'], 'attached report') === false);
check('base SMS gives the two incomplete counts their own lines', strpos($baseBody['sms'], "Class: 5-B\n3 still need to finish, 2 still need to submit") !== false);
check(
    'base WhatsApp points at the report and keeps the class note only there',
    $baseBody['whatsapp'] === "25 out of 30 kids in your base filled out their Shabbos Mevorchim Tehillim, but 5 didn't. See the full report here: $link. Each class is in the attached report. Please follow up with them today and see why they didn't."
);

$env = [
    'WHATSAPP_PROVIDER' => 'meta',
    'WHATSAPP_TOKEN' => 'test-token',
    'WHATSAPP_PHONE_NUMBER_ID' => '555',
    'WHATSAPP_TEMPLATE_CLASS' => 'wwtc_class_followup',
    'WHATSAPP_TEMPLATE_BASE' => 'wwtc_base_followup',
    'WHATSAPP_TEMPLATE_LANG' => 'en',
    'WHATSAPP_MAX_PER_SECOND' => '10',
    'TWILIO_ACCOUNT_SID' => 'ACtest',
    'TWILIO_AUTH_TOKEN' => 'twilio-token',
    'TWILIO_FROM' => '+15550001111',
];
$request = wwtcNotifyWhatsAppRequest($env, 'class', '+17185550101', $link, 'tehillim-cheshvan-5787.pdf', 25, 30, 5, $link);
$params = $request['payload']['template']['components'][1]['parameters'];
$encoded = json_encode($request['payload']);
check('meta URL uses the phone number id', $request['url'] === 'https://graph.facebook.com/v21.0/555/messages');
check('meta sends a bearer token', strpos($request['headers'][0], 'Bearer test-token') !== false);
check('the header is a document', $request['payload']['template']['components'][0]['parameters'][0]['type'] === 'document');
check('template variables are filled, total, missing, link', $params[0]['text'] === '25' && $params[1]['text'] === '30' && $params[2]['text'] === '5' && $params[3]['text'] === $link);
check('the document filename has no soldier name', $request['payload']['template']['components'][0]['parameters'][0]['document']['filename'] === 'tehillim-cheshvan-5787.pdf');
check('the template payload has no soldier name', strpos($encoded, 'Ahrele') === false && strpos($encoded, 'Yossi') === false);

$dialog = $env;
$dialog['WHATSAPP_PROVIDER'] = '360dialog';
$dialog['WHATSAPP_360_API_KEY'] = 'd360-key';
$dialogRequest = wwtcNotifyWhatsAppRequest($dialog, 'base', '+17185550101', $link, 'tehillim-cheshvan-5787.pdf', 4, 5, 1, $link);
check('360dialog posts to the partner messages URL', $dialogRequest['url'] === 'https://waba-v2.360dialog.io/messages');
check('360dialog uses the D360-API-KEY header', strpos($dialogRequest['headers'][0], 'D360-API-KEY: d360-key') === false ? false : strpos($dialogRequest['headers'][0], 'D360-API-KEY: d360-key') !== false);
check('a requested 100 per second is clamped under the coexistence cap', wwtcNotifyPerSecond(100) === 19 && wwtcNotifyIntervalMicros(100) === (int) ceil(1000000 / 19));

$ok = wwtcNotifyReadWhatsAppResult(200, ['messages' => [['id' => 'wamid.1']]]);
$missing = wwtcNotifyReadWhatsAppResult(400, ['error' => ['code' => 131026]]);
$legacy = wwtcNotifyReadWhatsAppResult(400, ['errors' => [['code' => 1013]]]);
$other = wwtcNotifyReadWhatsAppResult(400, ['error' => ['code' => 132001]]);
check('a 200 is a WhatsApp send', $ok['ok'] === true && $ok['notOnWhatsApp'] === false);
check('131026 means the number is not on WhatsApp', $missing['ok'] === false && $missing['notOnWhatsApp'] === true);
check('legacy 1013 also means not on WhatsApp', $legacy['notOnWhatsApp'] === true);
check('a template error does not fall back by itself', $other['notOnWhatsApp'] === false);

$sms = wwtcNotifySmsRequest($env, '+17185550101', "Hello\nReply STOP to opt out.");
check('Twilio is the default SMS provider', strpos($sms['url'], '/Accounts/ACtest/Messages.json') !== false);
check('SMS body keeps the STOP line', strpos(urldecode($sms['body']), 'Reply STOP to opt out.') !== false);

$token = wwtcNotifySign(['v' => 1, 'exp' => 2000000000, 'file' => str_repeat('ab', 16), 'name' => 'tehillim-cheshvan-5787.pdf'], 'secret');
$verified = wwtcNotifyVerifyToken($token, 'secret', 1700000000);
check('a signed report token round-trips', is_array($verified) && $verified['file'] === str_repeat('ab', 16));
check('a tampered token is rejected', wwtcNotifyVerifyToken(substr($token, 0, -1) . '0', 'secret', 1700000000) === null);
check('an expired token is rejected', wwtcNotifyVerifyToken($token, 'secret', 2000000001) === null);
$dir = sys_get_temp_dir() . '/wwtc-notify-test-' . getmypid();
@mkdir($dir, 0775, true);
$fileId = str_repeat('cd', 16);
file_put_contents($dir . '/' . $fileId . '.pdf', '%PDF-1.4');
check('a stored report resolves inside the directory', wwtcNotifyStoredPath($dir, $fileId) !== null);
check('a traversal id does not resolve', wwtcNotifyStoredPath($dir, '../' . $fileId) === null);
@unlink($dir . '/' . $fileId . '.pdf');
@rmdir($dir);

check('sent and opt-out rows are not sent again', wwtcNotifyClaimDecision('sent') === 'skip' && wwtcNotifyClaimDecision('skipped_opt_out') === 'skip');
check('a failed row can be retried', wwtcNotifyClaimDecision('failed') === 'go' && wwtcNotifyClaimDecision('') === 'go');

// ---- delivery, privacy, idempotency ---------------------------------------

function sampleSchools(): array
{
    return [
        89 => [
            'name' => 'Bais Chaya',
            'classes' => [
                ['id' => 555, 'name' => '5-B', 'students' => [
                    ['name' => 'Ahrele Benshimon', 'quota' => 20, 'said' => 20],
                    ['name' => 'Dovid (Rosie) Cohen', 'quota' => 20, 'said' => 5],
                    ['name' => 'Yossi Levi', 'quota' => 20, 'said' => 0],
                ]],
                ['id' => 556, 'name' => '6-A', 'students' => [
                    ['name' => 'Mushka Rosen', 'quota' => 10, 'said' => 10],
                    ['name' => 'Chana Weiss', 'quota' => 10, 'said' => 10],
                ]],
            ],
        ],
        90 => [
            'name' => 'Second Base',
            'classes' => [
                ['id' => 700, 'name' => '1-A', 'students' => [
                    ['name' => 'Zalman Ploni', 'quota' => 8, 'said' => 8],
                ]],
            ],
        ],
    ];
}

function sampleRecipients(): array
{
    return [
        wwtcNotifyRecipient(4, 'Mrs Klein', 'class', 89, 'Bais Chaya', 555, '5-B', '718-555-0101', 'klein@example.com'),
        wwtcNotifyRecipient(8, 'Mrs Adler', 'class', 89, 'Bais Chaya', 556, '6-A', '718-555-0102', 'adler@example.com'),
        wwtcNotifyRecipient(9, 'Rivka Goldstein', 'base', 89, 'Bais Chaya', 0, '', '(718) 555-0103', 'rivka@example.com'),
        wwtcNotifyRecipient(10, 'Leah Stein', 'base', 90, 'Second Base', 0, '', '+17185550104', 'leah@example.com'),
    ];
}

function kidWords(): array
{
    return ['Ahrele', 'Benshimon', 'Rosie', 'Yossi', 'Mushka', 'Chana', 'Zalman', 'Ploni'];
}

function withoutKids(string $text): bool
{
    foreach (kidWords() as $word) {
        if (strpos($text, $word) !== false) {
            return false;
        }
    }
    return true;
}

function runJob(array $overrides, array $deps, array $envOverride = null): array
{
    global $env;
    $job = array_merge([
        'today' => '2026-11-11',
        'year' => 5787,
        'months' => ['Cheshvan' => '2026-11-07'],
        'dryRun' => false,
        'only' => null,
        'force' => false,
        'recipients' => sampleRecipients(),
        'schools' => sampleSchools(),
        'optOut' => [],
        'sent' => [],
        'publicBase' => 'https://mashpia.test',
        'secret' => 'test-secret-test-secret-test-secret',
        'linkDays' => 30,
        'env' => $envOverride ?? $env,
        'now' => 1700000000,
    ], $overrides);
    return wwtcNotifyExecute($job, $deps);
}

$fromReport = wwtcNotifySchoolFromReport([
    'classes' => [['id' => 555, 'name' => '5-B']],
    'students' => [
        ['classId' => 555, 'className' => '5-B', 'name' => 'Ahrele Benshimon', 'quota' => 20, 'said' => 20],
        ['classId' => 556, 'className' => '6-A', 'name' => 'Mushka Rosen', 'quota' => 10, 'said' => 0],
    ],
], 'Bais Chaya');
$teacherOnly = wwtcNotifySelectClasses(
    wwtcNotifyRecipient(4, 'Mrs Klein', 'class', 89, 'Bais Chaya', 555, '5-B', '7185550101', ''),
    [89 => $fromReport]
);
check('school data groups soldiers by class', count($fromReport['classes']) === 2);
check('a teacher selection keeps only that class', count($teacherOnly) === 1 && $teacherOnly[0]['students'][0]['name'] === 'Ahrele Benshimon');

$waCalls = 0;
$smsCalls = 0;
$written = [];
$store = [];
$deliverWa = function ($request) use (&$waCalls) {
    $waCalls++;
    return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'wamid.' . $waCalls];
};
$deliverSms = function ($request) use (&$smsCalls) {
    $smsCalls++;
    return ['ok' => true, 'detail' => 'sms'];
};
$sent = runJob([], [
    'deliverWhatsApp' => $deliverWa,
    'deliverSms' => $deliverSms,
    'sleepMicros' => function () {},
    'writePdf' => function ($fileId, $bytes) use (&$written) { $written[$fileId] = $bytes; },
    'record' => function ($row) use (&$store) { $store[$row['recipientKey']] = $row['outcome']; },
]);
check('a due Wednesday sends', $sent['due'] === true && $sent['month'] === 'Cheshvan' && $sent['exitCode'] === 0);
check('four recipients were sent on WhatsApp and SMS was not used', $waCalls === 4 && $smsCalls === 0 && count($sent['results']) === 4);
check('the log text has no soldier names', withoutKids($sent['output']));
check('WhatsApp pacing slept between sends', $sent['slept'] === 3 * 100000);

$byAdmin = [];
foreach ($sent['results'] as $result) {
    $byAdmin[$result['adminId']] = $result;
    check(
        'admin ' . $result['adminId'] . ' message has no soldier names',
        withoutKids($result['bodyWhatsapp']) && withoutKids($result['bodySms']) && withoutKids(json_encode($result['payload']))
    );
    check(
        'admin ' . $result['adminId'] . ' message does not link to a login-gated report',
        strpos($result['bodySms'], '/reports') === false && strpos($result['bodySms'], '/my-class') === false && strpos($result['bodySms'], '/admin') === false
    );
}
check(
    'the teacher sentence uses that class count',
    $byAdmin[4]['bodyWhatsapp'] === "2 out of 3 kids in your class filled out their Shabbos Mevorchim Tehillim, but 1 didn't. See the full report here: " . wwtcNotifyReportUrl('https://mashpia.test', wwtcNotifySign([
        'v' => 1,
        'exp' => 1700000000 + 30 * 86400,
        'file' => wwtcNotifyFileId('admin:4:class:555', 5787, 'Cheshvan'),
        'name' => 'tehillim-cheshvan-5787.pdf',
    ], 'test-secret-test-secret-test-secret')) . ". Please follow up with them today and see why they didn't."
);
check('teacher SMS includes STOP and the sign-in line', strpos($byAdmin[4]['bodySms'], 'Reply STOP to opt out.') !== false && strpos($byAdmin[4]['bodySms'], 'Link to fill it out: https://mashpia.test/login') !== false && strpos($byAdmin[4]['bodySms'], 'See the full report here:') !== false);
check('teacher SMS splits the incomplete kids', strpos($byAdmin[4]['bodySms'], '1 still needs to finish, 1 still needs to submit') !== false && strpos($byAdmin[4]['bodySms'], "Class: 5-B\n1 still needs to finish, 1 still needs to submit") !== false);
check('base SMS lists both of that base\'s classes', strpos($byAdmin[9]['bodySms'], 'Class 5-B: 2 of 3') !== false && strpos($byAdmin[9]['bodySms'], 'Class 6-A: 2 of 2') !== false);
check('base SMS counts both incomplete groups and skips a finished class', strpos($byAdmin[9]['bodySms'], '1 still needs to finish, 1 still needs to submit') !== false && strpos($byAdmin[9]['bodySms'], "Class: 5-B\n1 still needs to finish, 1 still needs to submit") !== false && strpos($byAdmin[9]['bodySms'], 'Class: 6-A') === false);
check('base WhatsApp does not put the class lines in the template body', strpos($byAdmin[9]['bodyWhatsapp'], 'Class 5-B') === false && strpos($byAdmin[9]['bodyWhatsapp'], '4 out of 5 kids in your base') !== false);

check('teacher 4 PDF has their own soldiers', strpos($byAdmin[4]['pdf'], 'Ahrele Benshimon') !== false && strpos($byAdmin[4]['pdf'], 'Yossi Levi') !== false && strpos($byAdmin[4]['pdf'], 'Dovid') !== false);
check('teacher 4 PDF has the under-quota count and the fill-out sign-in', strpos($byAdmin[4]['pdf'], '5 of 20 kapitlach') !== false && strpos($byAdmin[4]['pdf'], 'https://mashpia.test/login') !== false);
check('teacher 4 PDF does not have another class or another base', strpos($byAdmin[4]['pdf'], 'Mushka') === false && strpos($byAdmin[4]['pdf'], 'Zalman') === false && strpos($byAdmin[4]['pdf'], '/reports') === false && strpos($byAdmin[4]['pdf'], '/my-class') === false);
check('teacher 8 PDF is only class 6-A', strpos($byAdmin[8]['pdf'], 'Mushka Rosen') !== false && strpos($byAdmin[8]['pdf'], 'Chana Weiss') !== false && strpos($byAdmin[8]['pdf'], 'Ahrele') === false && strpos($byAdmin[8]['pdf'], 'Yossi') === false);
check('base 89 PDF has every class in the base and not the other base', strpos($byAdmin[9]['pdf'], 'Ahrele Benshimon') !== false && strpos($byAdmin[9]['pdf'], 'Mushka Rosen') !== false && strpos($byAdmin[9]['pdf'], 'Yossi Levi') !== false && strpos($byAdmin[9]['pdf'], 'Zalman') === false);
check('base 90 PDF has only that base', strpos($byAdmin[10]['pdf'], 'Zalman Ploni') !== false && strpos($byAdmin[10]['pdf'], 'Ahrele') === false && strpos($byAdmin[10]['pdf'], 'Mushka') === false);
check('each recipient gets a distinct file', count($written) === 4);
$finishAt = strpos($byAdmin[4]['pdf'], 'Who still needs to finish');
$submitAt = strpos($byAdmin[4]['pdf'], 'Who still needs to submit');
check('statuses are grouped with finish before submit', strpos($byAdmin[4]['pdf'], 'Did full quota') !== false && $finishAt !== false && $submitAt !== false && $finishAt < $submitAt);
check('the PDF drops the old incomplete headings', strpos($byAdmin[4]['pdf'], 'Filled it out but under quota') === false && strpos($byAdmin[4]['pdf'], "Didn't fill it out") === false);
check('the PDF counts both incomplete groups for that class', strpos($byAdmin[4]['pdf'], '1 still needs to finish') !== false && strpos($byAdmin[4]['pdf'], '1 still needs to submit') !== false && strpos($byAdmin[4]['pdf'], 'Class: 5-B') !== false);

$waCalls2 = 0;
$again = runJob(['sent' => $store], [
    'deliverWhatsApp' => function () use (&$waCalls2) { $waCalls2++; return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'x']; },
    'deliverSms' => function () { throw new RuntimeException('sms on a second run'); },
    'writePdf' => function () { throw new RuntimeException('pdf on a second run'); },
]);
check('a second run does not send again', $waCalls2 === 0 && count(array_filter($again['results'], function ($r) { return $r['outcome'] === 'already_sent'; })) === 4);

$notDueCalls = 0;
$notDue = runJob(['today' => '2026-11-12'], [
    'deliverWhatsApp' => function () use (&$notDueCalls) { $notDueCalls++; return ['ok' => true]; },
]);
check('the day after the Wednesday exits with no sends', $notDue['due'] === false && $notDueCalls === 0 && strpos($notDue['output'], 'Not sending') !== false);

$forcedCalls = 0;
$forced = runJob(['today' => '2026-11-12', 'force' => true, 'only' => '4'], [
    'deliverWhatsApp' => function () use (&$forcedCalls) { $forcedCalls++; return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'w']; },
    'deliverSms' => function () { throw new RuntimeException('sms'); },
    'writePdf' => function () {},
    'record' => function () {},
]);
check('--force --only sends just that admin off the schedule', $forcedCalls === 1 && count($forced['results']) === 1 && $forced['results'][0]['adminId'] === 4);

$dryExploded = false;
$dry = runJob(['dryRun' => true], [
    'deliverWhatsApp' => function () use (&$dryExploded) { $dryExploded = true; throw new RuntimeException('sent'); },
    'deliverSms' => function () use (&$dryExploded) { $dryExploded = true; throw new RuntimeException('sent'); },
    'writePdf' => function () use (&$dryExploded) { $dryExploded = true; throw new RuntimeException('wrote'); },
    'record' => function () use (&$dryExploded) { $dryExploded = true; throw new RuntimeException('logged'); },
]);
check('dry-run does not send, write, or log', $dryExploded === false && strpos($dry['output'], 'DRY RUN') !== false);
check('dry-run still shows the base class lines and no soldier names', strpos($dry['output'], 'Class 5-B: 2 of 3') !== false && strpos($dry['output'], 'Class 6-A: 2 of 2') !== false && withoutKids($dry['output']));

$fallbackSms = 0;
$fallback = runJob(['only' => '4'], [
    'deliverWhatsApp' => function () {
        return ['ok' => false, 'notOnWhatsApp' => true, 'detail' => 'whatsapp http 400 code 131026'];
    },
    'deliverSms' => function ($request) use (&$fallbackSms) {
        $fallbackSms++;
        return ['ok' => true, 'detail' => 'sms'];
    },
    'writePdf' => function () {},
    'record' => function () {},
]);
check('131026 falls back to SMS', $fallbackSms === 1 && $fallback['results'][0]['channel'] === 'sms' && $fallback['results'][0]['outcome'] === 'sent');
check('the SMS fallback is that teacher\'s text and has STOP', strpos($fallback['results'][0]['bodySms'], '2 out of 3 kids in your class') !== false && strpos($fallback['results'][0]['bodySms'], 'Reply STOP to opt out.') !== false && withoutKids($fallback['results'][0]['bodySms']));

$noConfigSms = 0;
$noWa = $env;
unset($noWa['WHATSAPP_TOKEN'], $noWa['WHATSAPP_PHONE_NUMBER_ID']);
$noConfig = runJob(['only' => '9'], [
    'deliverWhatsApp' => function () { throw new RuntimeException('whatsapp without config'); },
    'deliverSms' => function () use (&$noConfigSms) { $noConfigSms++; return ['ok' => true, 'detail' => 'sms']; },
    'writePdf' => function () {},
    'record' => function () {},
], $noWa);
check('no WhatsApp config uses SMS', $noConfigSms === 1 && $noConfig['results'][0]['channel'] === 'sms' && strpos($noConfig['results'][0]['bodySms'], 'Class 5-B: 2 of 3') !== false);

$otherSms = 0;
$templateError = runJob(['only' => '4'], [
    'deliverWhatsApp' => function () {
        return ['ok' => false, 'notOnWhatsApp' => false, 'detail' => 'whatsapp http 400 code 132001'];
    },
    'deliverSms' => function () use (&$otherSms) { $otherSms++; return ['ok' => true]; },
    'writePdf' => function () {},
    'record' => function () {},
]);
check('a non-WhatsApp error does not text everyone', $otherSms === 0 && $templateError['results'][0]['outcome'] === 'failed');

$optSms = 0;
$opt = runJob(['optOut' => ['+1 (718) 555-0101'], 'only' => '4'], [
    'deliverWhatsApp' => function () use (&$optSms) { $optSms++; return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'x']; },
    'deliverSms' => function () use (&$optSms) { $optSms++; return ['ok' => true]; },
    'writePdf' => function () {},
    'record' => function () {},
]);
check('an opted-out number is not sent', $optSms === 0 && $opt['results'][0]['outcome'] === 'skipped_opt_out');

$badCalls = 0;
$bad = runJob(['only' => '4', 'recipients' => [
    wwtcNotifyRecipient(4, 'Mrs Klein', 'class', 89, 'Bais Chaya', 555, '5-B', '555-0101', 'klein@example.com'),
]], [
    'deliverWhatsApp' => function () use (&$badCalls) { $badCalls++; return ['ok' => true]; },
    'deliverSms' => function () use (&$badCalls) { $badCalls++; return ['ok' => true]; },
]);
check('an invalid phone is logged and not sent', $badCalls === 0 && $bad['results'][0]['outcome'] === 'skipped_invalid_phone');

$dialogCalls = 0;
$dialogEnv = $env;
$dialogEnv['WHATSAPP_PROVIDER'] = '360dialog';
$dialogEnv['WHATSAPP_360_API_KEY'] = 'd360-key';
runJob(['only' => '8'], [
    'deliverWhatsApp' => function ($request) use (&$dialogCalls) {
        $dialogCalls++;
        if ($request['provider'] !== '360dialog' || strpos($request['url'], '360dialog.io') === false) {
            throw new RuntimeException('wrong provider');
        }
        return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'd'];
    },
    'deliverSms' => function () { throw new RuntimeException('sms'); },
    'writePdf' => function () {},
    'record' => function () {},
], $dialogEnv);
check('the provider switch sends through 360dialog', $dialogCalls === 1);

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all notify checks passed\n";
