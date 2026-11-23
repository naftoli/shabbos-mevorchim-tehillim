<?php

declare(strict_types=1);

// Tuesday parent reminder: the same Shabbos Mevorchim calendar as the Wednesday
// job, the verbatim message, the child-page link, opt-out, and SMS fallback.
// Run: php tests/php/ParentReminderTest.php

require __DIR__ . '/../../api/hebrewYear.php';
require __DIR__ . '/../../api/notify-parent.php';

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

$link = 'https://mashpia.com/shabbos-mevorchim-tehillim/?handoff=abc';
$exact = "*Reminder from the Worldwide Tehillim Club*\n"
    . "Did your child say Tehillim this Shabbos Mevorchim? Please mark their kapitlach on the site so they count toward their ladder, their platoon, and the whole worldwide army.\n"
    . $link . "\n"
    . 'Thank you!';
check('the parent message is the verbatim text', wwtcParentReminderMessage($link) === $exact);
check(
    'SMS is that text plus the existing STOP line',
    wwtcParentReminderSms($link) === $exact . "\nReply STOP to opt out."
);
check(
    'the template header is the bold line without the asterisks',
    wwtcParentReminderHeader() === 'Reminder from the Worldwide Tehillim Club'
);
check(
    'the template body keeps every word and uses one link variable',
    wwtcParentReminderTemplateBody() === "Did your child say Tehillim this Shabbos Mevorchim? Please mark their kapitlach on the site so they count toward their ladder, their platoon, and the whole worldwide army.\n{{1}}\nThank you!"
);

check(
    'first Tuesday after a Saturday crosses the March DST change',
    wwtcParentReminderFirstTuesdayAfter('2026-03-07') === '2026-03-10'
);
check(
    'the Tuesday is strictly after the Shabbos',
    wwtcParentReminderFirstTuesdayAfter('2026-11-07') === '2026-11-10'
);

$cheshvan = ['Cheshvan' => '2026-11-07'];
$onTuesday = wwtcParentReminderLatest($cheshvan, '2026-11-10');
check(
    'Cheshvan Tuesday is a parent send day and uses the Wednesday Shabbos detector',
    $onTuesday !== null
    && $onTuesday['month'] === 'Cheshvan'
    && $onTuesday['shabbos'] === '2026-11-07'
    && $onTuesday['wednesday'] === '2026-11-11'
    && wwtcParentReminderIsSendDay($onTuesday, '2026-11-10')
);
check(
    'the Wednesday follow-up day is not the parent send day',
    !wwtcParentReminderIsSendDay(wwtcParentReminderLatest($cheshvan, '2026-11-11'), '2026-11-11')
);
check(
    'the next Tuesday is not the first Tuesday after that Shabbos',
    !wwtcParentReminderIsSendDay(wwtcParentReminderLatest($cheshvan, '2026-11-17'), '2026-11-17')
);
check('before the first Shabbos there is nothing to send', wwtcParentReminderLatest($cheshvan, '2026-11-06') === null);

function campaignSmMap(int $year): array
{
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
    $tuesdays = [];
    foreach ($map as $month => $shabbos) {
        $tuesday = wwtcParentReminderFirstTuesdayAfter($shabbos);
        $tuesdays[$month] = $tuesday;
        $latest = wwtcParentReminderLatest($map, $tuesday);
        check(
            "$year $month sends on its own first Tuesday",
            $latest !== null && $latest['month'] === $month && wwtcParentReminderIsSendDay($latest, $tuesday)
        );
        $dayAfter = nyDay($tuesday, 1);
        check(
            "$year $month does not send the day after",
            !wwtcParentReminderIsSendDay(wwtcParentReminderLatest($map, $dayAfter), $dayAfter)
        );
        check(
            "$year $month Tuesday is the day before that month's Wednesday",
            $tuesday === nyDay(wwtcNotifyFirstWednesdayAfter($shabbos), -1)
        );
    }
    check("$year gives each month its own Tuesday", count($tuesdays) === count(array_unique($tuesdays)));
    if ($leap) {
        check(
            "$year Adar I and Adar II are different Tuesdays",
            $tuesdays['Adar I'] !== $tuesdays['Adar II'] && $map['Adar I'] < $map['Adar II']
        );
    } else {
        check("$year has one Adar", isset($map['Adar']) && !isset($map['Adar I']));
    }
}

check('an unset hour is 08:00', wwtcParentReminderHour([])['hour'] === 8 && wwtcParentReminderHour(['WWTC_PARENT_REMINDER_HOUR' => ''])['error'] === '');
check('hour 15 is accepted', wwtcParentReminderHour(['WWTC_PARENT_REMINDER_HOUR' => '15'])['hour'] === 15);
check('hour 24 is rejected', wwtcParentReminderHour(['WWTC_PARENT_REMINDER_HOUR' => '24'])['error'] !== '');
check('the role enum must name parent', wwtcParentReminderRoleAccepted("enum('base','class')") === false && wwtcParentReminderRoleAccepted("enum('base','class','parent')") === true);

$source = wwtcParentReminderPhoneSourceText();
check(
    'the phone note tells Naftoli the column is missing',
    strpos($source, 'not in this repo') !== false
    && strpos($source, 'WWTC_PARENT_PHONE_COLUMN') !== false
    && strpos($source, 'wwtcParentReminderPhoneQuery') !== false
);

$unset = wwtcParentReminderResolvePhone('', ['admin_phone_mobile'], []);
check('an unset phone column is not configured and does not guess admin_phone_mobile', $unset['configured'] === false && $unset['expression'] === "''");
$missing = wwtcParentReminderResolvePhone('admins.admin_phone_mobile', ['admin_id', 'first'], []);
check('a column that is not on the table is refused', $missing['configured'] === false && strpos($missing['error'], 'not a column') !== false);
$bad = wwtcParentReminderResolvePhone('admins.admin_phone_mobile; DROP TABLE admins', ['admin_phone_mobile'], []);
check('a phone spec cannot carry extra SQL', $bad['configured'] === false && $bad['expression'] === "''");
$otherTable = wwtcParentReminderResolvePhone('schools.school_phone', [], []);
check('a phone spec on another table is refused', $otherTable['configured'] === false);
$adminPhone = wwtcParentReminderResolvePhone('admins.admin_phone_mobile', ['admin_id', 'admin_phone_mobile'], []);
check('a confirmed admins column becomes a.column', $adminPhone['configured'] === true && $adminPhone['expression'] === 'a.admin_phone_mobile');
$userPhone = wwtcParentReminderResolvePhone('users.father_cell', [], ['user_id', 'father_cell']);
check('a confirmed users column becomes u.column', $userPhone['configured'] === true && $userPhone['expression'] === 'u.father_cell');

$defaultSql = wwtcParentReminderPhoneQuery();
check('the default query selects an empty phone', strpos($defaultSql, "'' AS parent_phone") !== false);
check('the default query does not read admin_phone columns', strpos($defaultSql, 'admin_phone') === false);
check(
    'the default query is the parent-child link',
    strpos($defaultSql, 'aa.role_id = 1') !== false
    && strpos($defaultSql, "aa.auth = 'user'") !== false
    && strpos($defaultSql, 'u.user_registered > 0') !== false
    && strpos($defaultSql, 'ut.enrolled = 1') !== false
);
$pointed = wwtcParentReminderPhoneQuery($adminPhone['expression']);
check('a resolved column is the only phone expression in the query', strpos($pointed, 'a.admin_phone_mobile AS parent_phone') !== false);
check('an unsafe expression is not interpolated', strpos(wwtcParentReminderPhoneQuery('a.admin_phone_mobile; DROP'), 'DROP') === false);

$rows = wwtcParentReminderRecipientsFromRows([
    ['parent_admin_id' => 9, 'parent_phone' => '7185550103', 'child_user_id' => 42, 'school_id' => 89, 'class_id' => 555],
    ['parent_admin_id' => 9, 'parent_phone' => '7185550103', 'child_user_id' => 43, 'school_id' => 89, 'class_id' => 556],
    ['parent_admin_id' => 9, 'parent_phone' => '7185550103', 'child_user_id' => 42, 'school_id' => 89, 'class_id' => 555],
    ['parent_admin_id' => 4, 'parent_phone' => '7185550199', 'child_user_id' => 77, 'school_id' => 90, 'class_id' => 1],
    ['parent_admin_id' => 2, 'parent_phone' => '', 'child_user_id' => 0, 'school_id' => 89, 'class_id' => 1],
], [89]);
check('two children of one eligible parent are two recipients', count($rows) === 2 && $rows[0]['userId'] === 42 && $rows[1]['userId'] === 43);
check('a duplicate parent-child row is one recipient', wwtcParentReminderRecipientKey($rows[0]) === 'parent:9:child:42');
check('an ineligible school is excluded', count(array_filter($rows, function ($row) {
    return (int) $row['schoolId'] === 90;
})) === 0);

$secret = 'test-secret-test-secret-test-secret';
$issued = 1700000000;
$exp = $issued + 30 * 86400;
$token = wwtcParentReminderSignHandoff(42, $issued, $exp, $secret);
$json = json_encode(['v' => 1, 'type' => 'handoff', 'id' => 42, 'iat' => $issued, 'exp' => $exp]);
$encoded = rtrim(strtr(base64_encode((string) $json), '+/', '-_'), '=');
$signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $encoded, $secret, true)), '+/', '-_'), '=');
check('the handoff token matches wwtcSignPayload bytes', $token === $encoded . '.' . $signature);
$url = wwtcParentReminderChildUrl('https://mashpia.com/shabbos-mevorchim-tehillim/', $token);
check('the link is the live child page with ?handoff=', $url === 'https://mashpia.com/shabbos-mevorchim-tehillim/?handoff=' . rawurlencode($token));
$other = wwtcParentReminderSignHandoff(43, $issued, $exp, $secret);
check('two children get two different links', $token !== $other);

$env = [
    'WHATSAPP_PROVIDER' => 'meta',
    'WHATSAPP_TOKEN' => 'test-token',
    'WHATSAPP_PHONE_NUMBER_ID' => '555',
    'WHATSAPP_TEMPLATE_LANG' => 'en',
    'WHATSAPP_MAX_PER_SECOND' => '10',
    'TWILIO_ACCOUNT_SID' => 'ACtest',
    'TWILIO_AUTH_TOKEN' => 'twilio-token',
    'TWILIO_FROM' => '+15550001111',
    'WWTC_PARENT_REMINDER_HOUR' => '8',
];
$request = wwtcParentReminderWhatsAppRequest($env, '+17185550103', $link);
$params = $request['payload']['template']['components'][0]['parameters'];
check('the parent template is wwtc_parent_reminder', $request['payload']['template']['name'] === 'wwtc_parent_reminder');
check('the header is static, so the request has no header component', count($request['payload']['template']['components']) === 1 && $request['payload']['template']['components'][0]['type'] === 'body');
check('the only template variable is the link', count($params) === 1 && $params[0]['text'] === $link);
$named = $env;
$named['WHATSAPP_TEMPLATE_PARENT'] = 'custom_parent';
check('WHATSAPP_TEMPLATE_PARENT overrides the name', wwtcParentReminderWhatsAppRequest($named, '+17185550103', $link)['payload']['template']['name'] === 'custom_parent');

function parentRecipients(): array
{
    return [
        ['adminId' => 9, 'userId' => 42, 'role' => 'parent', 'schoolId' => 89, 'classId' => 555, 'phone' => '7185550103', 'email' => ''],
        ['adminId' => 9, 'userId' => 43, 'role' => 'parent', 'schoolId' => 89, 'classId' => 556, 'phone' => '(718) 555-0104', 'email' => ''],
        ['adminId' => 11, 'userId' => 44, 'role' => 'parent', 'schoolId' => 89, 'classId' => 555, 'phone' => '7185550105', 'email' => ''],
    ];
}

function runParent(array $overrides, array $deps, array $envOverride = null): array
{
    global $env, $secret;
    $job = array_merge([
        'today' => '2026-11-10',
        'year' => 5787,
        'months' => ['Cheshvan' => '2026-11-07'],
        'dryRun' => false,
        'only' => null,
        'force' => false,
        'recipients' => parentRecipients(),
        'optOut' => [],
        'sent' => [],
        'publicBase' => 'https://mashpia.com/shabbos-mevorchim-tehillim',
        'secret' => $secret,
        'linkDays' => 30,
        'env' => $envOverride ?? $env,
        'now' => 1700000000,
        'hourNow' => 8,
        'phoneConfigured' => true,
    ], $overrides);
    return wwtcParentReminderExecute($job, $deps);
}

$waCalls = 0;
$smsCalls = 0;
$store = [];
$sent = runParent([], [
    'deliverWhatsApp' => function ($request) use (&$waCalls) {
        $waCalls++;
        return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'wamid.' . $waCalls];
    },
    'deliverSms' => function () use (&$smsCalls) {
        $smsCalls++;
        return ['ok' => true, 'detail' => 'sms'];
    },
    'sleepMicros' => function () {},
    'record' => function ($row) use (&$store) {
        $store[$row['recipientKey']] = $row['outcome'];
    },
]);
check('a due Tuesday sends one WhatsApp per child', $sent['due'] === true && $sent['tuesday'] === '2026-11-10' && $waCalls === 3 && $smsCalls === 0);
check('WhatsApp pacing slept between the three sends', $sent['slept'] === 2 * 100000);
check('the log records parent role keys', isset($store['parent:9:child:42']) && $store['parent:9:child:42'] === 'sent');
$byChild = [];
foreach ($sent['results'] as $result) {
    $byChild[$result['userId']] = $result;
}
$childLink = wwtcParentReminderChildUrl(
    'https://mashpia.com/shabbos-mevorchim-tehillim',
    wwtcParentReminderSignHandoff(42, 1700000000, 1700000000 + 30 * 86400, $secret)
);
check('child 42 gets that child\'s page and the verbatim message', $byChild[42]['bodyWhatsapp'] === wwtcParentReminderMessage($childLink) && $byChild[42]['link'] === $childLink);
check('child 43 gets a different link', $byChild[43]['link'] !== $byChild[42]['link'] && strpos($byChild[43]['link'], 'handoff=') !== false);
check('the SMS fallback text is not used when WhatsApp succeeds', strpos($byChild[42]['bodySms'], 'Reply STOP to opt out.') !== false && $byChild[42]['channel'] === 'whatsapp');

$waCalls2 = 0;
$again = runParent(['sent' => $store], [
    'deliverWhatsApp' => function () use (&$waCalls2) {
        $waCalls2++;
        return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'x'];
    },
    'deliverSms' => function () {
        throw new RuntimeException('sms on a second run');
    },
    'record' => function () {},
]);
check('a second run does not send again', $waCalls2 === 0 && count(array_filter($again['results'], function ($row) {
    return $row['outcome'] === 'already_sent';
})) === 3);

$notDueCalls = 0;
$notDue = runParent(['today' => '2026-11-11'], [
    'deliverWhatsApp' => function () use (&$notDueCalls) {
        $notDueCalls++;
        return ['ok' => true];
    },
]);
check('Wednesday is not a parent send', $notDue['due'] === false && $notDueCalls === 0 && strpos($notDue['output'], 'not the first Tuesday') !== false);

$wrongHourCalls = 0;
$wrongHour = runParent(['hourNow' => 15], [
    'deliverWhatsApp' => function () use (&$wrongHourCalls) {
        $wrongHourCalls++;
        return ['ok' => true];
    },
]);
check('a Tuesday at the wrong hour does not send', $wrongHour['due'] === false && $wrongHourCalls === 0 && strpos($wrongHour['output'], 'WWTC_PARENT_REMINDER_HOUR is 08') !== false);

$forcedCalls = 0;
$forced = runParent(['today' => '2026-11-12', 'hourNow' => 15, 'force' => true, 'only' => '9'], [
    'deliverWhatsApp' => function () use (&$forcedCalls) {
        $forcedCalls++;
        return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'w'];
    },
    'deliverSms' => function () {
        throw new RuntimeException('sms');
    },
    'record' => function () {},
]);
check('--force --only sends that parent\'s children off the schedule', $forcedCalls === 2 && count($forced['results']) === 2);

$dryExploded = false;
$dry = runParent(['dryRun' => true, 'hourNow' => 15], [
    'deliverWhatsApp' => function () use (&$dryExploded) {
        $dryExploded = true;
        throw new RuntimeException('sent');
    },
    'deliverSms' => function () use (&$dryExploded) {
        $dryExploded = true;
        throw new RuntimeException('sent');
    },
    'record' => function () use (&$dryExploded) {
        $dryExploded = true;
        throw new RuntimeException('logged');
    },
]);
check('dry-run does not send or log', $dryExploded === false && strpos($dry['output'], 'DRY RUN') !== false && $dry['results'][0]['outcome'] === 'dry_run');
check(
    'dry-run prints the verbatim SMS with a placeholder link',
    strpos($dry['results'][0]['bodySms'], '*Reminder from the Worldwide Tehillim Club*') !== false
    && strpos($dry['results'][0]['bodySms'], '(child page link — not created in a dry run)') !== false
    && strpos($dry['results'][0]['bodySms'], 'Reply STOP to opt out.') !== false
);

$fallbackSms = '';
$fallback = runParent(['only' => '11'], [
    'deliverWhatsApp' => function () {
        return ['ok' => false, 'notOnWhatsApp' => true, 'detail' => 'whatsapp http 400 code 131026'];
    },
    'deliverSms' => function ($request) use (&$fallbackSms) {
        $fallbackSms = (string) $request['body'];
        return ['ok' => true, 'detail' => 'sms'];
    },
    'record' => function () {},
]);
check('131026 falls back to SMS', $fallback['results'][0]['channel'] === 'sms' && $fallback['results'][0]['outcome'] === 'sent');
check('the SMS body is the verbatim message plus STOP', strpos($fallbackSms, urlencode('Reply STOP to opt out.')) !== false && strpos($fallbackSms, urlencode('*Reminder from the Worldwide Tehillim Club*')) !== false);

$otherSms = 0;
$templateError = runParent(['only' => '11'], [
    'deliverWhatsApp' => function () {
        return ['ok' => false, 'notOnWhatsApp' => false, 'detail' => 'whatsapp http 400 code 132001'];
    },
    'deliverSms' => function () use (&$otherSms) {
        $otherSms++;
        return ['ok' => true];
    },
    'record' => function () {},
]);
check('a template error does not fall back to SMS', $otherSms === 0 && $templateError['results'][0]['outcome'] === 'failed');

$optCalls = 0;
$opt = runParent(['optOut' => ['+1 (718) 555-0103'], 'only' => '9'], [
    'deliverWhatsApp' => function () use (&$optCalls) {
        $optCalls++;
        return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => 'x'];
    },
    'deliverSms' => function () use (&$optCalls) {
        $optCalls++;
        return ['ok' => true];
    },
    'record' => function () {},
]);
$optByChild = [];
foreach ($opt['results'] as $result) {
    $optByChild[$result['userId']] = $result['outcome'];
}
check('an opted-out number is skipped and the sibling still sends', $optCalls === 1 && $optByChild[42] === 'skipped_opt_out' && $optByChild[43] === 'sent');

$badCalls = 0;
$bad = runParent(['only' => '11', 'recipients' => [
    ['adminId' => 11, 'userId' => 44, 'role' => 'parent', 'schoolId' => 89, 'classId' => 555, 'phone' => '555-0101', 'email' => ''],
]], [
    'deliverWhatsApp' => function () use (&$badCalls) {
        $badCalls++;
        return ['ok' => true];
    },
    'deliverSms' => function () use (&$badCalls) {
        $badCalls++;
        return ['ok' => true];
    },
]);
check('an invalid phone is not sent', $badCalls === 0 && $bad['results'][0]['outcome'] === 'skipped_invalid_phone');

$unconfiguredCalls = 0;
$unconfigured = runParent(['phoneConfigured' => false], [
    'deliverWhatsApp' => function () use (&$unconfiguredCalls) {
        $unconfiguredCalls++;
        return ['ok' => true];
    },
    'deliverSms' => function () use (&$unconfiguredCalls) {
        $unconfiguredCalls++;
        return ['ok' => true];
    },
    'record' => function () {
        throw new RuntimeException('logged without a phone source');
    },
]);
check(
    'an unconfigured phone source sends nothing and says so',
    $unconfiguredCalls === 0
    && $unconfigured['exitCode'] === 1
    && $unconfigured['results'][0]['outcome'] === 'skipped_no_phone_source'
    && strpos($unconfigured['output'], 'WWTC_PARENT_PHONE_COLUMN') !== false
);

$noWa = $env;
unset($noWa['WHATSAPP_TOKEN'], $noWa['WHATSAPP_PHONE_NUMBER_ID']);
$smsOnly = 0;
$noConfig = runParent(['only' => '11'], [
    'deliverWhatsApp' => function () {
        throw new RuntimeException('whatsapp without config');
    },
    'deliverSms' => function () use (&$smsOnly) {
        $smsOnly++;
        return ['ok' => true, 'detail' => 'sms'];
    },
    'record' => function () {},
], $noWa);
check('no WhatsApp config uses SMS', $smsOnly === 1 && $noConfig['results'][0]['channel'] === 'sms');

if ($failed > 0) {
    fwrite(STDERR, "$failed check(s) failed\n");
    exit(1);
}
echo "all parent reminder checks passed\n";
