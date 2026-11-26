<?php

declare(strict_types=1);

/**
 * Tuesday parent reminder. One WhatsApp (or SMS) per child, on the first
 * Tuesday after that Shabbos Mevorchim. The Shabbos itself comes from
 * wwtcNotifyLatestShabbos(), the same detection the Wednesday job uses.
 *
 * PARENT PHONE SOURCE — the only query that reads a parent's phone.
 *
 * This repository does not contain a parent phone column. The confirmed
 * parent link (wwtcParentOwnsChild in api/bootstrap.php) is:
 *   admin_auths.role_id = 1
 *   admin_auths.auth = 'user'
 *   admin_auths.id = users.user_id          (the child)
 *   admin_auths.admin_id = admins.admin_id  (the parent account)
 * admin_auths has no phone. Nothing in this repo reads a phone from users
 * or from a parent profile table.
 *
 * admins.admin_phone_mobile / admin_phone_home / admin_phone_work in
 * api/notify.php are an unconfirmed guess for base commanders and teachers.
 * They are not a parent-phone field. This job does not read them unless
 * Naftoli sets WWTC_PARENT_PHONE_COLUMN to one of those names after
 * confirming the column exists on the live table.
 *
 * Naftoli: set WWTC_PARENT_PHONE_COLUMN=admins.COLUMN or users.COLUMN.
 * The column is checked against information_schema before it is selected.
 * If the phone lives on any other table, edit wwtcParentReminderPhoneQuery()
 * and nowhere else. Until that is done, the job sends nothing.
 *
 * The link is the existing parent handoff (?handoff=), signed the same way
 * as wwtcSignPayload(), so the live site opens that child's page (/me).
 * It uses WWTC_TOKEN_SECRET (the secret the site already verifies) and
 * lasts WWTC_NOTIFY_LINK_DAYS (default 30), not the two-minute tap code.
 */

require_once __DIR__ . '/notify.php';

function wwtcParentReminderHeader(): string
{
    return 'Reminder from the Worldwide Tehillim Club';
}

/** Body submitted to Meta. {{1}} is the child-page link. */
function wwtcParentReminderTemplateBody(): string
{
    return "Did your child say Tehillim this Shabbos Mevorchim? Please mark their kapitlach on the site so they count toward their ladder, their platoon, and the whole worldwide army.\n"
        . "{{1}}\n"
        . 'Thank you!';
}

/** The message, verbatim. The asterisks are the bold header line. */
function wwtcParentReminderMessage(string $link): string
{
    return "*Reminder from the Worldwide Tehillim Club*\n"
        . "Did your child say Tehillim this Shabbos Mevorchim? Please mark their kapitlach on the site so they count toward their ladder, their platoon, and the whole worldwide army.\n"
        . $link . "\n"
        . 'Thank you!';
}

function wwtcParentReminderSms(string $link): string
{
    return wwtcParentReminderMessage($link) . "\nReply STOP to opt out.";
}

function wwtcParentReminderPhoneSourceText(): string
{
    return 'PARENT PHONE SOURCE is not in this repo. Parents are admin_auths rows '
        . "(role_id = 1, auth = 'user', id = the child user_id) and that table has no phone. "
        . 'Naftoli must set WWTC_PARENT_PHONE_COLUMN to admins.COLUMN or users.COLUMN '
        . '(checked against information_schema), or edit wwtcParentReminderPhoneQuery() '
        . 'in api/notify-parent.php if the phone is on another table. '
        . 'The admins.admin_phone_* names are only an unconfirmed guess for commanders '
        . 'and teachers. This job does not read them unless that env var names one.';
}

function wwtcParentReminderHour(array $env): array
{
    $raw = trim((string) ($env['WWTC_PARENT_REMINDER_HOUR'] ?? ''));
    if ($raw === '') {
        return ['hour' => 18, 'error' => ''];
    }
    if (!preg_match('/^\d{1,2}$/', $raw) || (int) $raw > 23) {
        return ['hour' => 18, 'error' => 'WWTC_PARENT_REMINDER_HOUR must be an hour from 0 through 23. The default is 18 (18:00 America/New_York).'];
    }
    return ['hour' => (int) $raw, 'error' => ''];
}

function wwtcParentReminderHourNow($now = 'now'): int
{
    $zone = new DateTimeZone('America/New_York');
    if ($now instanceof DateTimeInterface) {
        $instant = new DateTimeImmutable('@' . $now->getTimestamp());
        return (int) $instant->setTimezone($zone)->format('G');
    }
    return (int) (new DateTimeImmutable('now', $zone))->format('G');
}

/** First Tuesday strictly after $ymd. Noon in New York so DST cannot skip a date. */
function wwtcParentReminderFirstTuesdayAfter(string $ymd): string
{
    $zone = new DateTimeZone('America/New_York');
    $day = new DateTimeImmutable($ymd . ' 12:00:00', $zone);
    do {
        $day = $day->modify('+1 day');
    } while ((string) $day->format('N') !== '2');
    return $day->format('Y-m-d');
}

/**
 * Latest Shabbos Mevorchim on or before today, plus the Tuesday we send on.
 * The Shabbos list is wwtcNotifyLatestShabbos().
 */
function wwtcParentReminderLatest(array $monthToYmd, string $todayYmd): ?array
{
    $latest = wwtcNotifyLatestShabbos($monthToYmd, $todayYmd);
    if ($latest === null) {
        return null;
    }
    $latest['tuesday'] = wwtcParentReminderFirstTuesdayAfter((string) $latest['shabbos']);
    return $latest;
}

function wwtcParentReminderIsSendDay(?array $latest, string $todayYmd): bool
{
    return is_array($latest) && (string) ($latest['tuesday'] ?? '') === $todayYmd;
}

function wwtcParentReminderNotDueMessage(string $today, ?array $latest): string
{
    if (!$latest) {
        return 'Not sending. No Shabbos Mevorchim on or before ' . $today . ' (America/New_York).';
    }
    return 'Not sending. Today ' . $today . ' America/New_York is not the first Tuesday after the latest Shabbos Mevorchim'
        . ' (' . $latest['month'] . ' on ' . $latest['shabbos'] . ', first Tuesday ' . $latest['tuesday'] . ').';
}

function wwtcParentReminderWrongHourMessage(string $today, int $configured, int $nowHour): string
{
    return 'Not sending. Today ' . $today . ' is the parent-reminder Tuesday, but the clock is '
        . sprintf('%02d:00', $nowHour) . ' America/New_York and WWTC_PARENT_REMINDER_HOUR is '
        . sprintf('%02d', $configured) . '.';
}

/**
 * @param array<int,string> $adminsColumns
 * @param array<int,string> $usersColumns
 * @return array{expression:string,configured:bool,error:string,label:string}
 */
function wwtcParentReminderResolvePhone(string $raw, array $adminsColumns, array $usersColumns): array
{
    $raw = trim($raw);
    $empty = ['expression' => "''", 'configured' => false, 'error' => '', 'label' => 'not configured'];
    if ($raw === '') {
        return $empty;
    }
    if (!preg_match('/^(admins|users)\.([A-Za-z_][A-Za-z0-9_]*)$/', $raw, $match)) {
        return [
            'expression' => "''",
            'configured' => false,
            'error' => 'WWTC_PARENT_PHONE_COLUMN must look like admins.COLUMN or users.COLUMN. Got: ' . $raw,
            'label' => 'invalid',
        ];
    }
    $table = $match[1];
    $wanted = $match[2];
    $columns = $table === 'admins' ? $adminsColumns : $usersColumns;
    $live = null;
    foreach ($columns as $column) {
        $column = (string) $column;
        if (strcasecmp($column, $wanted) === 0 && preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $column)) {
            $live = $column;
            break;
        }
    }
    if ($live === null) {
        return [
            'expression' => "''",
            'configured' => false,
            'error' => 'WWTC_PARENT_PHONE_COLUMN=' . $table . '.' . $wanted . ' is not a column on the live ' . $table . ' table.',
            'label' => $table . '.' . $wanted,
        ];
    }
    $alias = $table === 'admins' ? 'a' : 'u';
    return [
        'expression' => $alias . '.' . $live,
        'configured' => true,
        'error' => '',
        'label' => $table . '.' . $live,
    ];
}

/**
 * The only SELECT that reads a parent phone. $phoneExpression is '' (nothing
 * configured) or a.column / u.column from wwtcParentReminderResolvePhone().
 * Any other expression is ignored and the query returns an empty phone.
 */
function wwtcParentReminderPhoneQuery(string $phoneExpression = "''"): string
{
    if ($phoneExpression !== "''" && !preg_match('/^[au]\.[A-Za-z_][A-Za-z0-9_]*$/', $phoneExpression)) {
        $phoneExpression = "''";
    }
    $subject = defined('WWTC_SUBJECT_ID') ? (int) WWTC_SUBJECT_ID : 1;
    $roster = defined('WWTC_ROSTER_WHERE')
        ? WWTC_ROSTER_WHERE
        : 's.school_era IS NULL AND c.class_era = 0 AND u.school_id NOT IN (82, 612)';
    return "SELECT a.admin_id AS parent_admin_id,\n"
        . '       ' . $phoneExpression . " AS parent_phone,\n"
        . "       u.user_id AS child_user_id,\n"
        . "       u.school_id AS school_id,\n"
        . "       c.class_id AS class_id\n"
        . "  FROM admin_auths aa\n"
        . "  JOIN admins a ON a.admin_id = aa.admin_id\n"
        . "  JOIN users u ON u.user_id = aa.id AND u.user_registered > 0\n"
        . "  JOIN classes c ON c.class_id = u.class_id AND c.class_era = 0\n"
        . "  JOIN schools s ON s.school_id = u.school_id\n"
        . '  JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = ' . $subject . " AND ut.enrolled = 1\n"
        . " WHERE aa.role_id = 1\n"
        . "   AND aa.auth = 'user'\n"
        . '   AND ' . $roster;
}

function wwtcParentReminderRecipientKey(array $recipient): string
{
    return 'parent:' . (int) ($recipient['adminId'] ?? 0) . ':child:' . (int) ($recipient['userId'] ?? 0);
}

function wwtcParentReminderRecipientsFromRows(array $rows, array $eligibleSchoolIds): array
{
    $eligible = [];
    foreach ($eligibleSchoolIds as $id) {
        $eligible[(int) $id] = true;
    }
    $seen = [];
    $out = [];
    foreach ($rows as $row) {
        $adminId = (int) ($row['parent_admin_id'] ?? 0);
        $userId = (int) ($row['child_user_id'] ?? 0);
        $schoolId = (int) ($row['school_id'] ?? 0);
        if ($adminId <= 0 || $userId <= 0 || $schoolId <= 0 || !isset($eligible[$schoolId])) {
            continue;
        }
        $key = 'parent:' . $adminId . ':child:' . $userId;
        if (isset($seen[$key])) {
            continue;
        }
        $seen[$key] = true;
        $out[] = [
            'adminId' => $adminId,
            'userId' => $userId,
            'role' => 'parent',
            'schoolId' => $schoolId,
            'classId' => (int) ($row['class_id'] ?? 0),
            'phone' => trim((string) ($row['parent_phone'] ?? '')),
            'email' => '',
        ];
    }
    return $out;
}

/**
 * Same bytes as wwtcSignPayload() for a handoff code: base64url(json) + '.' +
 * base64url(raw hmac-sha256). wwtcVerifySignedPayload() accepts it, and the
 * SPA trades ?handoff= for the child's session and opens /me.
 */
function wwtcParentReminderSignHandoff(int $userId, int $issuedAt, int $expiresAt, string $secret): string
{
    $json = json_encode([
        'v' => 1,
        'type' => 'handoff',
        'id' => $userId,
        'iat' => $issuedAt,
        'exp' => $expiresAt,
    ]);
    if (!is_string($json)) {
        $json = '{}';
    }
    $encoded = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $encoded, $secret, true)), '+/', '-_'), '=');
    return $encoded . '.' . $signature;
}

function wwtcParentReminderChildUrl(string $publicBase, string $token): string
{
    return rtrim($publicBase, '/') . '/?handoff=' . rawurlencode($token);
}

function wwtcParentReminderTemplate(array $env): string
{
    $name = trim((string) ($env['WHATSAPP_TEMPLATE_PARENT'] ?? ''));
    if ($name === '') {
        $name = 'wwtc_parent_reminder';
    }
    return $name;
}

function wwtcParentReminderWhatsAppReady(array $env): bool
{
    if (wwtcParentReminderTemplate($env) === '') {
        return false;
    }
    if (wwtcNotifyProviderName($env) === '360dialog') {
        return wwtcNotify360Key($env) !== '';
    }
    return trim((string) ($env['WHATSAPP_TOKEN'] ?? '')) !== ''
        && trim((string) ($env['WHATSAPP_PHONE_NUMBER_ID'] ?? '')) !== '';
}

function wwtcParentReminderWhatsAppRequest(array $env, string $e164, string $link): array
{
    $provider = wwtcNotifyProviderName($env);
    $lang = trim((string) ($env['WHATSAPP_TEMPLATE_LANG'] ?? ''));
    if ($lang === '') {
        $lang = 'en';
    }
    $version = trim((string) ($env['WHATSAPP_GRAPH_VERSION'] ?? ''));
    if ($version === '') {
        $version = 'v21.0';
    }
    $payload = [
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => ltrim($e164, '+'),
        'type' => 'template',
        'template' => [
            'name' => wwtcParentReminderTemplate($env),
            'language' => ['code' => $lang],
            'components' => [
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $link],
                    ],
                ],
            ],
        ],
    ];
    if ($provider === '360dialog') {
        $base = trim((string) ($env['WHATSAPP_360_BASE'] ?? ''));
        if ($base === '') {
            $base = 'https://waba-v2.360dialog.io';
        }
        return [
            'provider' => '360dialog',
            'url' => rtrim($base, '/') . '/messages',
            'headers' => ['D360-API-KEY: ' . wwtcNotify360Key($env), 'Content-Type: application/json'],
            'payload' => $payload,
        ];
    }
    $phoneId = trim((string) ($env['WHATSAPP_PHONE_NUMBER_ID'] ?? ''));
    return [
        'provider' => 'meta',
        'url' => 'https://graph.facebook.com/' . rawurlencode($version) . '/' . rawurlencode($phoneId) . '/messages',
        'headers' => [
            'Authorization: Bearer ' . trim((string) ($env['WHATSAPP_TOKEN'] ?? '')),
            'Content-Type: application/json',
        ],
        'payload' => $payload,
    ];
}

function wwtcParentReminderRoleAccepted(string $columnType): bool
{
    $type = strtolower(trim($columnType));
    if ($type === '') {
        return false;
    }
    if (strpos($type, 'enum(') === false) {
        return true;
    }
    return strpos($type, "'parent'") !== false;
}

function wwtcParentReminderUserColumns(PDO $db): array
{
    $stmt = $db->query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
    );
    $columns = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $column) {
        $columns[] = (string) $column;
    }
    return $columns;
}

function wwtcParentReminderLogReady(PDO $db): array
{
    $tables = wwtcNotifyTablesReady($db);
    $role = '';
    if ($tables) {
        $stmt = $db->query(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'wwtc_notify_sends'
                AND COLUMN_NAME = 'role'"
        );
        $role = (string) $stmt->fetchColumn();
    }
    return [
        'tables' => $tables,
        'role' => $role,
        'ready' => $tables && wwtcParentReminderRoleAccepted($role),
    ];
}

function wwtcParentReminderReadEnv(): array
{
    $env = wwtcNotifyReadEnv();
    foreach (['WHATSAPP_TEMPLATE_PARENT', 'WWTC_PARENT_PHONE_COLUMN', 'WWTC_PARENT_REMINDER_HOUR'] as $key) {
        $env[$key] = wwtcNotifyEnv($key);
    }
    return $env;
}

function wwtcParentReminderTokenSecret(): string
{
    $secret = '';
    if (defined('WWTC_TOKEN_SECRET')) {
        $secret = trim((string) WWTC_TOKEN_SECRET);
    }
    if (strlen($secret) < 32) {
        $secret = wwtcNotifyEnv('WWTC_TOKEN_SECRET');
    }
    return $secret;
}

/**
 * @param array<string,mixed> $job
 * @param array<string,mixed> $deps
 * @return array<string,mixed>
 */
function wwtcParentReminderExecute(array $job, array $deps = []): array
{
    $today = (string) ($job['today'] ?? wwtcNotifyTodayNewYork());
    $year = (int) ($job['year'] ?? 0);
    $latest = wwtcParentReminderLatest($job['months'] ?? [], $today);
    $force = !empty($job['force']);
    $dry = !empty($job['dryRun']);
    $output = '';
    $emit = function (string $line) use (&$output, $deps): void {
        $output .= $line . "\n";
        if (isset($deps['out'])) {
            $deps['out']($line);
        }
    };
    if ((!$latest || !wwtcParentReminderIsSendDay($latest, $today)) && !$force) {
        $emit(wwtcParentReminderNotDueMessage($today, $latest));
        return [
            'due' => false,
            'month' => $latest['month'] ?? null,
            'tuesday' => $latest['tuesday'] ?? null,
            'shabbos' => $latest['shabbos'] ?? null,
            'output' => $output,
            'results' => [],
            'exitCode' => 0,
            'slept' => 0,
        ];
    }
    if (!$latest) {
        $emit('No Shabbos Mevorchim on or before ' . $today . ' in campaign year ' . $year . '.');
        return [
            'due' => false,
            'month' => null,
            'tuesday' => null,
            'shabbos' => null,
            'output' => $output,
            'results' => [],
            'exitCode' => 0,
            'slept' => 0,
        ];
    }

    $env = $job['env'] ?? [];
    $hour = wwtcParentReminderHour($env);
    $hourNow = array_key_exists('hourNow', $job) ? (int) $job['hourNow'] : wwtcParentReminderHourNow();
    if ($hour['error'] !== '' && !$dry) {
        $emit($hour['error']);
        return [
            'due' => false,
            'month' => $latest['month'],
            'tuesday' => $latest['tuesday'],
            'shabbos' => $latest['shabbos'],
            'output' => $output,
            'results' => [],
            'exitCode' => 1,
            'slept' => 0,
        ];
    }
    if (!$force && !$dry && $hourNow !== (int) $hour['hour']) {
        $emit(wwtcParentReminderWrongHourMessage($today, (int) $hour['hour'], $hourNow));
        return [
            'due' => false,
            'month' => $latest['month'],
            'tuesday' => $latest['tuesday'],
            'shabbos' => $latest['shabbos'],
            'output' => $output,
            'results' => [],
            'exitCode' => 0,
            'slept' => 0,
        ];
    }

    $month = (string) $latest['month'];
    $secret = (string) ($job['secret'] ?? '');
    $publicBase = rtrim((string) ($job['publicBase'] ?? wwtcNotifyPublicBase($env)), '/');
    $now = (int) ($job['now'] ?? time());
    $days = (int) ($job['linkDays'] ?? wwtcNotifyLinkDays($env));
    $only = wwtcNotifyOnlyAdmin($job['only'] ?? null);
    $phoneConfigured = array_key_exists('phoneConfigured', $job) ? !empty($job['phoneConfigured']) : true;
    $sent = $job['sent'] ?? [];
    $optOut = [];
    foreach ($job['optOut'] ?? [] as $number) {
        $norm = wwtcNotifyNormalizePhone((string) $number);
        if ($norm['ok']) {
            $optOut[$norm['e164']] = true;
        }
    }
    $rate = wwtcNotifyPerSecond($env['WHATSAPP_MAX_PER_SECOND'] ?? 10);
    $slept = 0;
    $waSends = 0;
    $results = [];
    $failures = 0;
    $prefix = $dry ? 'DRY RUN ' : '';
    $emit($prefix . 'PARENT ' . $month . ' ' . $year . ' — Shabbos ' . $latest['shabbos'] . ' — Tuesday ' . $latest['tuesday']
        . ' — send hour ' . sprintf('%02d:00', (int) $hour['hour']) . ' America/New_York');
    if (!$phoneConfigured) {
        $emit(wwtcParentReminderPhoneSourceText());
        $emit('Nothing is sent until that phone source is set.');
    }

    $placeholder = '(child page link — not created in a dry run)';
    foreach ($job['recipients'] ?? [] as $recipient) {
        if ($only !== null && (string) $recipient['adminId'] !== $only) {
            continue;
        }
        $key = wwtcParentReminderRecipientKey($recipient);
        $baseResult = [
            'recipientKey' => $key,
            'adminId' => (int) $recipient['adminId'],
            'userId' => (int) $recipient['userId'],
            'role' => 'parent',
            'schoolId' => (int) $recipient['schoolId'],
            'classId' => (int) ($recipient['classId'] ?? 0),
            'outcome' => '',
            'channel' => null,
            'provider' => null,
            'bodyWhatsapp' => '',
            'bodySms' => '',
            'link' => '',
            'payload' => null,
        ];
        $line = 'PARENT admin=' . (int) $recipient['adminId']
            . ' child=' . (int) $recipient['userId']
            . ' school=' . (int) $recipient['schoolId']
            . ' class=' . (int) ($recipient['classId'] ?? 0)
            . ' phone=' . (string) ($recipient['phone'] ?? '');

        if (!$phoneConfigured) {
            $baseResult['outcome'] = 'skipped_no_phone_source';
            $baseResult['bodyWhatsapp'] = wwtcParentReminderMessage($placeholder);
            $baseResult['bodySms'] = wwtcParentReminderSms($placeholder);
            $results[] = $baseResult;
            $emit($line . ' outcome=skipped_no_phone_source');
            if ($dry) {
                $emit('MESSAGE: ' . $baseResult['bodySms']);
            }
            continue;
        }

        $phone = wwtcNotifyNormalizePhone((string) ($recipient['phone'] ?? ''));
        if (!$phone['ok']) {
            $baseResult['outcome'] = 'skipped_invalid_phone';
            $results[] = $baseResult;
            $emit($line . ' outcome=skipped_invalid_phone ' . $phone['reason']);
            if (!$dry) {
                wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, '', 'skipped_invalid_phone', $phone['reason']);
            }
            continue;
        }
        if (isset($optOut[$phone['e164']])) {
            $baseResult['outcome'] = 'skipped_opt_out';
            $results[] = $baseResult;
            $emit($line . ' outcome=skipped_opt_out');
            if (!$dry) {
                wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'skipped_opt_out', 'opt-out');
            }
            continue;
        }
        $existing = (string) ($sent[$key] ?? '');
        if (!$dry && wwtcNotifyClaimDecision($existing) === 'skip') {
            $baseResult['outcome'] = 'already_sent';
            $results[] = $baseResult;
            $emit($line . ' outcome=already_sent');
            continue;
        }

        $link = $placeholder;
        if (!$dry) {
            if (strlen($secret) < 32) {
                $baseResult['outcome'] = 'failed';
                $results[] = $baseResult;
                $failures++;
                $emit($line . ' outcome=failed missing WWTC_TOKEN_SECRET');
                continue;
            }
            $token = wwtcParentReminderSignHandoff(
                (int) $recipient['userId'],
                $now,
                $now + $days * 86400,
                $secret
            );
            $link = wwtcParentReminderChildUrl($publicBase, $token);
        }
        $baseResult['link'] = $link;
        $baseResult['bodyWhatsapp'] = wwtcParentReminderMessage($link);
        $baseResult['bodySms'] = wwtcParentReminderSms($link);
        $channelPlan = wwtcParentReminderWhatsAppReady($env) ? 'whatsapp' : (wwtcNotifySmsReady($env) ? 'sms' : 'none');
        $emit($line . ' channel=' . $channelPlan);
        if ($dry) {
            $emit('MESSAGE: ' . $baseResult['bodySms']);
            $baseResult['outcome'] = 'dry_run';
            $results[] = $baseResult;
            continue;
        }

        wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'pending', '');
        $sentOk = false;
        if (wwtcParentReminderWhatsAppReady($env)) {
            if ($waSends > 0) {
                $pause = wwtcNotifyIntervalMicros($rate);
                $slept += $pause;
                if (isset($deps['sleepMicros'])) {
                    $deps['sleepMicros']($pause);
                }
            }
            $waSends++;
            $request = wwtcParentReminderWhatsAppRequest($env, $phone['e164'], $link);
            $baseResult['payload'] = $request['payload'];
            $wa = isset($deps['deliverWhatsApp'])
                ? $deps['deliverWhatsApp']($request)
                : ['ok' => false, 'notOnWhatsApp' => false, 'detail' => 'no whatsapp sender'];
            if (!empty($wa['ok'])) {
                $baseResult['outcome'] = 'sent';
                $baseResult['channel'] = 'whatsapp';
                $baseResult['provider'] = $request['provider'];
                wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'sent', (string) ($wa['detail'] ?? 'sent'));
                $sentOk = true;
                $emit($line . ' outcome=sent channel=whatsapp provider=' . $request['provider']);
            } elseif (empty($wa['notOnWhatsApp'])) {
                $baseResult['outcome'] = 'failed';
                $baseResult['channel'] = 'whatsapp';
                $baseResult['provider'] = $request['provider'];
                $failures++;
                wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'failed', (string) ($wa['detail'] ?? 'whatsapp failed'));
                $emit($line . ' outcome=failed ' . (string) ($wa['detail'] ?? ''));
                $results[] = $baseResult;
                continue;
            } else {
                $emit($line . ' whatsapp not on that number, trying sms');
            }
        }
        if (!$sentOk) {
            if (!wwtcNotifySmsReady($env)) {
                $baseResult['outcome'] = 'sms_not_configured';
                $failures++;
                wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'sms_not_configured', 'sms not configured');
                $emit($line . ' outcome=sms_not_configured');
            } else {
                $smsRequest = wwtcNotifySmsRequest($env, $phone['e164'], $baseResult['bodySms']);
                $sms = isset($deps['deliverSms'])
                    ? $deps['deliverSms']($smsRequest)
                    : ['ok' => false, 'detail' => 'no sms sender'];
                if (!empty($sms['ok'])) {
                    $baseResult['outcome'] = 'sent';
                    $baseResult['channel'] = 'sms';
                    $baseResult['provider'] = 'twilio';
                    wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'sent', (string) ($sms['detail'] ?? 'sms sent'));
                    $emit($line . ' outcome=sent channel=sms provider=twilio');
                } else {
                    $baseResult['outcome'] = 'failed';
                    $baseResult['channel'] = 'sms';
                    $baseResult['provider'] = 'twilio';
                    $failures++;
                    wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'failed', (string) ($sms['detail'] ?? 'sms failed'));
                    $emit($line . ' outcome=failed ' . (string) ($sms['detail'] ?? ''));
                }
            }
        }
        $results[] = $baseResult;
    }

    $exit = $failures > 0 ? 1 : 0;
    if (!$phoneConfigured && !$dry) {
        $exit = 1;
    }
    return [
        'due' => true,
        'month' => $month,
        'tuesday' => $latest['tuesday'],
        'shabbos' => $latest['shabbos'],
        'output' => $output,
        'results' => $results,
        'exitCode' => $exit,
        'slept' => $slept,
    ];
}

function wwtcParentReminderCli(array $argv): int
{
    global $MASHPIA_DB;
    $args = wwtcNotifyParseArgs($argv);
    if ($args['error'] === 'help') {
        echo "Usage: php api/notify-tuesday.php [--dry-run] [--only=<parent admin id>] [--force]\n";
        echo wwtcParentReminderPhoneSourceText() . "\n";
        echo "Default send hour is 18:00 America/New_York (WWTC_PARENT_REMINDER_HOUR).\n";
        return 0;
    }
    if ($args['error'] !== '') {
        fwrite(STDERR, $args['error'] . "\n");
        return 1;
    }
    $env = wwtcParentReminderReadEnv();
    $hour = wwtcParentReminderHour($env);
    if ($hour['error'] !== '') {
        fwrite(STDERR, $hour['error'] . "\n");
        return 1;
    }
    $year = wwtcYear();
    $jdMap = wwtcMonthDatesForYear($year);
    $ymdMap = [];
    foreach ($jdMap as $month => $jd) {
        $ymdMap[(string) $month] = wwtcNotifyYmdFromJd((int) $jd);
    }
    $today = wwtcNotifyTodayNewYork();
    $latest = wwtcParentReminderLatest($ymdMap, $today);
    $due = wwtcParentReminderIsSendDay($latest, $today);
    if (!$due && !$args['force']) {
        echo wwtcParentReminderNotDueMessage($today, $latest) . "\n";
        return 0;
    }
    if (!$latest) {
        echo 'No Shabbos Mevorchim on or before ' . $today . " in campaign year $year.\n";
        return 0;
    }
    $nowHour = wwtcParentReminderHourNow();
    if (!$args['dryRun'] && !$args['force'] && $nowHour !== (int) $hour['hour']) {
        echo wwtcParentReminderWrongHourMessage($today, (int) $hour['hour'], $nowHour) . "\n";
        return 0;
    }
    $secret = wwtcParentReminderTokenSecret();
    if (strlen($secret) < 32 && !$args['dryRun']) {
        fwrite(STDERR, "Set WWTC_TOKEN_SECRET (at least 32 characters) before sending. The child link is a ?handoff= code the site already verifies with that secret.\n");
        return 1;
    }
    $log = wwtcParentReminderLogReady($MASHPIA_DB);
    if (!$log['ready']) {
        $message = "Run api/sql/wwtc_notify.sql before sending. Need wwtc_notify_sends, wwtc_notify_opt_outs, and role 'parent' on wwtc_notify_sends.\n";
        if (!$args['dryRun']) {
            fwrite(STDERR, $message);
            return 1;
        }
        echo $message;
    }
    $adminsColumns = wwtcNotifyAdminColumns($MASHPIA_DB);
    $usersColumns = wwtcParentReminderUserColumns($MASHPIA_DB);
    $phone = wwtcParentReminderResolvePhone((string) ($env['WWTC_PARENT_PHONE_COLUMN'] ?? ''), $adminsColumns, $usersColumns);
    echo 'Parent phone source: ' . $phone['label'] . ".\n";
    if ($phone['error'] !== '') {
        fwrite(STDERR, $phone['error'] . "\n");
        echo wwtcParentReminderPhoneSourceText() . "\n";
        return 1;
    }
    if (!$phone['configured'] && !$args['dryRun']) {
        echo wwtcParentReminderPhoneSourceText() . "\n";
        fwrite(STDERR, "Nothing was sent. Set WWTC_PARENT_PHONE_COLUMN or edit wwtcParentReminderPhoneQuery() first.\n");
        return 1;
    }
    $rows = $MASHPIA_DB->query(wwtcParentReminderPhoneQuery($phone['expression']))->fetchAll(PDO::FETCH_ASSOC);
    $recipients = wwtcParentReminderRecipientsFromRows($rows, array_map('intval', array_keys(wwtcEligibleSchools())));
    $optOut = $log['tables'] ? wwtcNotifyLoadOptOuts($MASHPIA_DB) : [];
    $sent = ($log['ready']) ? wwtcNotifyLoadSent($MASHPIA_DB, $year, (string) $latest['month']) : [];
    $result = wwtcParentReminderExecute([
        'today' => $today,
        'year' => $year,
        'months' => $ymdMap,
        'dryRun' => $args['dryRun'],
        'only' => $args['only'],
        'force' => $args['force'],
        'recipients' => $recipients,
        'optOut' => $optOut,
        'sent' => $sent,
        'publicBase' => wwtcNotifyPublicBase($env),
        'secret' => $secret,
        'linkDays' => wwtcNotifyLinkDays($env),
        'env' => $env,
        'now' => time(),
        'hourNow' => $nowHour,
        'phoneConfigured' => $phone['configured'],
    ], [
        'deliverWhatsApp' => 'wwtcNotifyCurlWhatsApp',
        'deliverSms' => 'wwtcNotifyCurlSms',
        'sleepMicros' => function ($micros) {
            usleep((int) $micros);
        },
        'record' => function ($row) use ($MASHPIA_DB) {
            wwtcNotifyRecordSend($MASHPIA_DB, $row);
        },
        'out' => function ($line) {
            echo $line, "\n";
        },
    ]);
    return (int) $result['exitCode'];
}
