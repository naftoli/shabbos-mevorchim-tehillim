<?php

declare(strict_types=1);

/**
 * Monthly Shabbos Mevorchim follow-up.
 *
 * Pure helpers live here so tests can load this file without the Mashpia
 * database. The CLI (notify-wednesday.php) bootstraps the database and calls
 * wwtcNotifyCli(). Kid names are written only into that recipient's PDF.
 *
 * Contact columns — what is certain in this repo, and what is a guess:
 *
 * Certain (already queried by this API):
 *   admin_auths.admin_id, admin_auths.auth, admin_auths.id
 *     auth = 'school' and id = school_id  → base commander
 *     auth = 'class'  and id = class_id   → teacher (WWTC_CLASS_AUTH)
 *   admin_auths has no email and no phone. role_id = 1 with auth = 'user'
 *     is a parent, and those rows are not recipients.
 *   admins.admin_id, admins.first, admins.last (POST /admin/login)
 *   schools.school_id, schools.school_name
 *   classes.class_id, classes.class_grade, classes.class_sub, classes.school_id,
 *     classes.class_era
 *   classes.class_teacher is a display name, not an account (platoonRoll.php).
 *   users.first / users.last are soldiers. This job never messages a child
 *     and does not read a phone or email from users.
 *
 * GUESS for Naftoli — not named anywhere else in this repo. Confirm on the
 * live admins table. The job uses the first of these that exists and is filled:
 *   admins.admin_email            (logged only; we do not send email)
 *   admins.admin_phone_mobile     (preferred — WhatsApp and SMS need a cell)
 *   admins.admin_phone_home
 *   admins.admin_phone_work
 * School office columns (schools.school_phone / school_email), if they exist,
 * are not used. A switchboard number is not the commander's WhatsApp.
 */

require_once __DIR__ . '/compat.php';
require_once __DIR__ . '/className.php';
require_once __DIR__ . '/classOrder.php';

function wwtcNotifyAllowedPhoneColumns(): array
{
    return ['admin_phone_mobile', 'admin_phone_home', 'admin_phone_work'];
}

function wwtcNotifyColumnGuessText(): string
{
    return 'Phone and email are read from admins, not from users, schools, or classes. '
        . 'GUESS for Naftoli: admins.admin_email, and phones in this order: '
        . 'admins.admin_phone_mobile, admins.admin_phone_home, admins.admin_phone_work. '
        . 'None of those columns are named elsewhere in this repo. '
        . 'admin_auths has no email or phone; it only maps auth=school to a school_id '
        . 'and auth=class to a class_id. classes.class_teacher is a name, not a phone. '
        . 'Soldier rows in users are never texted.';
}

function wwtcNotifyPickPhones(array $columns): array
{
    $present = [];
    foreach ($columns as $column) {
        $present[strtolower((string) $column)] = true;
    }
    $phone = null;
    $fallbacks = [];
    foreach (wwtcNotifyAllowedPhoneColumns() as $column) {
        if (!isset($present[$column])) {
            continue;
        }
        if ($phone === null) {
            $phone = 'admins.' . $column;
        } else {
            $fallbacks[] = 'admins.' . $column;
        }
    }
    return [
        'phoneColumn' => $phone,
        'phoneFallbacks' => $fallbacks,
        'emailColumn' => isset($present['admin_email']) ? 'admins.admin_email' : null,
    ];
}

/**
 * Admin columns are a whitelist. $presentAdminColumns comes from
 * information_schema, never from a request.
 */
function wwtcNotifyRecipientSql(array $presentAdminColumns): string
{
    $present = [];
    foreach ($presentAdminColumns as $column) {
        $present[strtolower((string) $column)] = true;
    }
    $extra = [];
    if (isset($present['admin_email'])) {
        $extra[] = 'a.admin_email';
    }
    foreach (wwtcNotifyAllowedPhoneColumns() as $column) {
        if (isset($present[$column])) {
            $extra[] = 'a.' . $column;
        }
    }
    $extraSql = $extra ? (",\n       " . implode(",\n       ", $extra)) : '';
    return "SELECT a.admin_id, a.first, a.last, aa.auth, aa.id AS scope_id,\n"
        . "       c.class_id, c.class_grade, c.class_sub,\n"
        . "       sc.school_id AS auth_school_id, sc.school_name AS auth_school_name,\n"
        . "       cs.school_id AS class_school_id, cs.school_name AS class_school_name"
        . $extraSql . "\n"
        . "  FROM admin_auths aa\n"
        . "  JOIN admins a ON a.admin_id = aa.admin_id\n"
        . "  LEFT JOIN schools sc ON aa.auth = 'school' AND sc.school_id = aa.id\n"
        . "  LEFT JOIN classes c ON aa.auth = 'class' AND c.class_id = aa.id AND c.class_era = 0\n"
        . "  LEFT JOIN schools cs ON cs.school_id = c.school_id\n"
        . " WHERE aa.auth IN ('school', 'class')";
}

function wwtcNotifyRecipientsFromRows(array $rows, array $eligibleSchoolIds): array
{
    $eligible = [];
    foreach ($eligibleSchoolIds as $id) {
        $eligible[(int) $id] = true;
    }
    $out = [];
    foreach ($rows as $row) {
        $auth = (string) ($row['auth'] ?? '');
        $adminId = (int) ($row['admin_id'] ?? 0);
        if ($adminId <= 0) {
            continue;
        }
        $name = trim(((string) ($row['first'] ?? '')) . ' ' . ((string) ($row['last'] ?? '')));
        $email = trim((string) ($row['admin_email'] ?? ''));
        $phone = '';
        foreach (wwtcNotifyAllowedPhoneColumns() as $column) {
            $value = trim((string) ($row[$column] ?? ''));
            if ($value !== '') {
                $phone = $value;
                break;
            }
        }
        if ($auth === 'school') {
            $schoolId = (int) ($row['auth_school_id'] ?? 0);
            if ($schoolId <= 0 || !isset($eligible[$schoolId])) {
                continue;
            }
            $out[] = wwtcNotifyRecipient(
                $adminId,
                $name,
                'base',
                $schoolId,
                (string) ($row['auth_school_name'] ?? ''),
                0,
                '',
                $phone,
                $email
            );
            continue;
        }
        if ($auth !== 'class') {
            continue;
        }
        $classId = (int) ($row['class_id'] ?? 0);
        $schoolId = (int) ($row['class_school_id'] ?? 0);
        if ($classId <= 0 || $schoolId <= 0 || !isset($eligible[$schoolId])) {
            continue;
        }
        $grade = trim((string) ($row['class_grade'] ?? ''));
        $sub = trim((string) ($row['class_sub'] ?? ''));
        $out[] = wwtcNotifyRecipient(
            $adminId,
            $name,
            'class',
            $schoolId,
            (string) ($row['class_school_name'] ?? ''),
            $classId,
            wwtcFormatClassName($grade . ($sub !== '' ? '-' . $sub : '')),
            $phone,
            $email
        );
    }
    return $out;
}

function wwtcNotifyRecipient(
    int $adminId,
    string $name,
    string $role,
    int $schoolId,
    string $schoolName,
    int $classId,
    string $className,
    string $phone,
    string $email
): array {
    return [
        'adminId' => $adminId,
        'name' => $name,
        'role' => $role,
        'schoolId' => $schoolId,
        'schoolName' => $schoolName,
        'classId' => $classId,
        'className' => $className,
        'phone' => $phone,
        'email' => $email,
    ];
}

function wwtcNotifyRecipientKey(array $recipient): string
{
    if (($recipient['role'] ?? '') === 'base') {
        return 'admin:' . (int) $recipient['adminId'] . ':base:' . (int) $recipient['schoolId'];
    }
    return 'admin:' . (int) $recipient['adminId'] . ':class:' . (int) $recipient['classId'];
}

/** Shape returned by wwtcSchoolData(), reduced to classes and soldiers. */
function wwtcNotifySchoolFromReport(array $data, string $schoolName): array
{
    $byClass = [];
    foreach ($data['students'] ?? [] as $student) {
        $classId = (int) ($student['classId'] ?? 0);
        if ($classId <= 0) {
            continue;
        }
        if (!isset($byClass[$classId])) {
            $byClass[$classId] = [
                'id' => $classId,
                'name' => trim((string) ($student['className'] ?? '')),
                'students' => [],
            ];
        }
        $byClass[$classId]['students'][] = [
            'name' => trim((string) ($student['name'] ?? '')),
            'quota' => (int) ($student['quota'] ?? 0),
            'said' => (int) ($student['said'] ?? 0),
        ];
    }
    foreach ($data['classes'] ?? [] as $class) {
        $classId = (int) ($class['id'] ?? 0);
        if ($classId <= 0) {
            continue;
        }
        $name = trim((string) ($class['name'] ?? ''));
        if (!isset($byClass[$classId])) {
            $byClass[$classId] = ['id' => $classId, 'name' => $name, 'students' => []];
        } elseif ($name !== '') {
            // Class label from the shared roster, not the report engine's grade.
            $byClass[$classId]['name'] = $name;
        }
        // The shared roster's star. When it is present it wins over recounting
        // this class's students, which can be a different set than home.
        if (array_key_exists('perfect', $class)) {
            $byClass[$classId]['perfect'] = (bool) $class['perfect'];
        }
        if (array_key_exists('size', $class)) {
            $byClass[$classId]['rosterSize'] = (int) $class['size'];
            $byClass[$classId]['rosterMet'] = (int) ($class['met'] ?? 0);
        }
    }
    return ['name' => $schoolName, 'classes' => array_values($byClass)];
}

/**
 * A class teacher gets only their class. A base commander gets every class
 * in their own school. Anything else in $schools is ignored.
 */
function wwtcNotifySelectClasses(array $recipient, array $schools): array
{
    $school = $schools[(int) ($recipient['schoolId'] ?? 0)] ?? null;
    if (!is_array($school)) {
        return [];
    }
    $classes = $school['classes'] ?? [];
    if (($recipient['role'] ?? '') === 'class') {
        $want = (int) ($recipient['classId'] ?? 0);
        $kept = [];
        foreach ($classes as $class) {
            if ((int) ($class['id'] ?? 0) === $want) {
                $kept[] = $class;
            }
        }
        return $kept;
    }
    return $classes;
}

function wwtcNotifyKidStatus(int $said, int $quota): string
{
    if ($said <= 0) {
        return 'missing';
    }
    if ($quota > 0 && $said >= $quota) {
        return 'full';
    }
    return 'under';
}

function wwtcNotifyStillNeed(int $count, string $action): string
{
    $verb = $count === 1 ? 'needs' : 'need';
    return $count . ' still ' . $verb . ' to ' . $action;
}

/**
 * Incomplete soldiers for one school, grouped by class. `under` reported a
 * kapitlach count above zero and are still short of quota. `notFilled`
 * reported nothing (said <= 0, including no mark). `missing` is both lists
 * in roster order, for clients that still read one list.
 *
 * @param array<int,array<string,mixed>> $students
 * @param array<int,array<string,mixed>> $classes
 * @return array<int,array<string,mixed>>
 */
function wwtcNotCompletedClasses(array $students, array $classes): array
{
    $byClass = [];
    foreach ($students as $s) {
        $said = (int) ($s['said'] ?? 0);
        $quota = (int) ($s['quota'] ?? 0);
        $status = wwtcNotifyKidStatus($said, $quota);
        if ($status === 'full') {
            continue;
        }
        $cid = (int) ($s['classId'] ?? 0);
        if (!isset($byClass[$cid])) {
            $byClass[$cid] = [
                'classId' => $cid,
                'className' => wwtcFormatClassName((string) ($s['className'] ?? '')),
                'size' => 0,
                'missing' => [],
                'under' => [],
                'notFilled' => [],
            ];
        }
        $name = (string) ($s['name'] ?? '');
        if ($status === 'under') {
            $byClass[$cid]['under'][] = $name;
        } else {
            $byClass[$cid]['notFilled'][] = $name;
        }
        $byClass[$cid]['missing'][] = $name;
    }
    foreach ($classes as $c) {
        $id = (int) ($c['id'] ?? 0);
        if (isset($byClass[$id])) {
            $byClass[$id]['size'] = (int) ($c['size'] ?? 0);
            $grade = trim((string) ($c['grade'] ?? ''));
            if ($grade !== '') {
                $byClass[$id]['grade'] = $grade;
            }
        }
    }
    return wwtcSortClasses(array_values($byClass));
}

function wwtcNotifyClassLine(string $name, int $filled, int $total): string
{
    return 'Class ' . $name . ': ' . $filled . ' of ' . $total;
}

/**
 * @return array Report with counts, class lines, and PDF lines. Kid names are
 *               only inside pdfLines (and kidNames, for the caller that builds
 *               the PDF). They are not part of the short message.
 */
function wwtcNotifyComposeReport(array $recipient, array $schools, string $month, int $year, string $fillUrl, string $expiresOn): array
{
    $school = $schools[(int) $recipient['schoolId']] ?? ['name' => '', 'classes' => []];
    $schoolName = trim((string) ($school['name'] ?? ''));
    if ($schoolName === '') {
        $schoolName = trim((string) ($recipient['schoolName'] ?? ''));
    }
    $classes = wwtcNotifySelectClasses($recipient, $schools);
    $prepared = [];
    $filled = 0;
    $total = 0;
    $full = 0;
    $under = 0;
    $missing = 0;
    $perfect = 0;
    $kidNames = [];
    foreach ($classes as $class) {
        $className = trim((string) ($class['name'] ?? ''));
        if ($className === '') {
            $className = trim((string) ($recipient['className'] ?? ''));
        }
        if ($className === '') {
            $className = 'Class';
        }
        $className = wwtcDisplayClassName($className);
        $students = [];
        $classFilled = 0;
        $classTotal = 0;
        $classFull = 0;
        $classUnder = 0;
        $classMissing = 0;
        foreach ($class['students'] ?? [] as $student) {
            $said = (int) ($student['said'] ?? 0);
            $quota = (int) ($student['quota'] ?? 0);
            $status = wwtcNotifyKidStatus($said, $quota);
            $kidName = trim((string) ($student['name'] ?? ''));
            if ($kidName === '') {
                $kidName = '(no name on file)';
            }
            $kidNames[] = $kidName;
            $classTotal++;
            $total++;
            if ($status === 'missing') {
                $missing++;
                $classMissing++;
            } else {
                $filled++;
                $classFilled++;
                if ($status === 'full') {
                    $full++;
                    $classFull++;
                } else {
                    $under++;
                    $classUnder++;
                }
            }
            $detail = '';
            if ($status === 'under') {
                $detail = $quota > 0
                    ? ($said . ' of ' . $quota . ' kapitlach')
                    : ($said . ' kapitlach');
            }
            $students[] = [
                'name' => $kidName,
                'status' => $status,
                'detail' => $detail,
            ];
        }
        usort($students, function ($a, $b) {
            return strcmp($a['name'], $b['name']);
        });
        // A class the report engine omitted still has a roster size. List it
        // when the shared rule says it is perfect, without inventing names.
        if ($classTotal === 0 && !empty($class['perfect']) && (int) ($class['rosterSize'] ?? 0) > 0) {
            $classTotal = (int) $class['rosterSize'];
            $classFull = (int) ($class['rosterMet'] ?? 0);
            $classFilled = $classFull;
            $gap = $classTotal - $classFull;
            if ($gap < 0) {
                $gap = 0;
            }
            $total += $classTotal;
            $full += $classFull;
            $filled += $classFilled;
            $missing += $gap;
            $classMissing += $gap;
        }
        if (array_key_exists('perfect', $class)) {
            $isPerfect = (bool) $class['perfect'];
        } else {
            $isPerfect = $classTotal > 0 && $classFull === $classTotal;
        }
        if ($isPerfect) {
            $perfect++;
        }
        $prepared[] = [
            'name' => $className,
            'grade' => (string) ($class['grade'] ?? ''),
            'filled' => $classFilled,
            'total' => $classTotal,
            'under' => $classUnder,
            'missing' => $classMissing,
            'perfect' => $isPerfect,
            'students' => $students,
        ];
    }
    usort($prepared, 'wwtcCmpClassRows');
    $classLines = [];
    foreach ($prepared as $class) {
        if ($class['total'] <= 0) {
            continue;
        }
        $classLines[] = wwtcNotifyClassLine($class['name'], $class['filled'], $class['total']);
    }
    $incompleteLines = [];
    foreach ($prepared as $class) {
        $classUnder = (int) ($class['under'] ?? 0);
        $classMissing = (int) ($class['missing'] ?? 0);
        if ($classUnder + $classMissing <= 0) {
            continue;
        }
        $incompleteLines[] = 'Class: ' . $class['name'];
        $incompleteLines[] = wwtcNotifyStillNeed($classUnder, 'finish') . ', ' . wwtcNotifyStillNeed($classMissing, 'submit');
    }

    $who = trim((string) ($recipient['name'] ?? ''));
    $scope = ($recipient['role'] ?? '') === 'base' ? 'Full base' : 'Your class';
    $lines = [];
    $add = function ($text, $size, $bold, array $color, $indent = 0, $gap = 2) use (&$lines) {
        $lines[] = [
            'text' => $text,
            'size' => $size,
            'bold' => $bold,
            'color' => $color,
            'indent' => $indent,
            'gap' => $gap,
        ];
    };
    $navy = [0.10, 0.16, 0.36];
    $ink = [0.12, 0.14, 0.18];
    $green = [0.10, 0.40, 0.28];
    $amber = [0.45, 0.30, 0.05];
    $red = [0.50, 0.16, 0.14];
    $muted = [0.35, 0.38, 0.42];

    $add($month . ' ' . $year, 16, true, $navy, 0, 4);
    $add($schoolName !== '' ? $schoolName : 'Base', 13, true, $navy, 0, 1);
    $add($scope . ($who !== '' ? ' - ' . $who : ''), 11, false, $ink, 0, 8);
    $add('Totals', 13, true, $navy, 0, 3);
    $add($total . ' soldiers', 11, false, $ink);
    $add($filled . ' filled it out', 11, false, $ink);
    $add($full . ' did the full quota', 11, false, $green);
    $add(wwtcNotifyStillNeed($under, 'finish'), 11, false, $amber);
    $add(wwtcNotifyStillNeed($missing, 'submit'), 11, false, $red);
    $add('Perfect platoons: ' . $perfect, 11, false, $ink, 0, 8);
    if ($classLines) {
        $add('By class', 13, true, $navy, 0, 3);
        foreach ($prepared as $class) {
            if ($class['total'] <= 0) {
                continue;
            }
            $suffix = $class['perfect'] ? ' - perfect platoon' : '';
            $add(wwtcNotifyClassLine($class['name'], $class['filled'], $class['total']) . $suffix, 11, false, $ink);
        }
        $add('', 8, false, $ink, 0, 6);
    }
    $add('This link expires on ' . $expiresOn . '.', 9, false, $muted, 0, 8);

    $sections = [
        'full' => ['Did full quota', $green],
        'under' => ['Who still needs to finish', $amber],
        'missing' => ['Who still needs to submit', $red],
    ];
    foreach ($sections as $status => $meta) {
        $add($meta[0], 13, true, $meta[1], 0, 3);
        if ($status === 'missing') {
            $add('There is no public page that opens one soldier. A child fills this out after signing in with a serial number.', 9, false, $muted, 0, 3);
        }
        $any = false;
        foreach ($prepared as $class) {
            $rows = [];
            foreach ($class['students'] as $student) {
                if ($student['status'] === $status) {
                    $rows[] = $student;
                }
            }
            if (!$rows) {
                continue;
            }
            $any = true;
            $add('Class: ' . $class['name'], 11, true, $ink, 0, 2);
            if ($status === 'under' || $status === 'missing') {
                $action = $status === 'under' ? 'finish' : 'submit';
                $add(wwtcNotifyStillNeed(count($rows), $action), 10, false, $meta[1], 14, 1);
            }
            foreach ($rows as $student) {
                $add($student['name'], 11, false, $ink, 14, 1);
                if ($student['detail'] !== '') {
                    $add($student['detail'], 10, false, $amber, 14, 1);
                }
                if ($status === 'missing') {
                    $add('Fill out: ' . $fillUrl, 9, false, $navy, 14, 3);
                }
            }
        }
        if (!$any) {
            $add('None', 11, false, $muted, 14, 2);
        }
        $add('', 8, false, $ink, 0, 6);
    }

    return [
        'filled' => $filled,
        'total' => $total,
        'missing' => $missing,
        'full' => $full,
        'under' => $under,
        'perfect' => $perfect,
        'classLines' => $classLines,
        'incompleteLines' => $incompleteLines,
        'kidNames' => $kidNames,
        'pdfLines' => $lines,
        'schoolName' => $schoolName,
    ];
}

function wwtcNotifyBodies(string $role, int $filled, int $total, int $missing, string $link, array $classLines, string $fillUrl = '', int $under = 0, array $incompleteLines = []): array
{
    $scope = $role === 'base' ? 'base' : 'class';
    // Approved WhatsApp templates (wwtc_class_followup / wwtc_base_followup)
    // have four body variables: filled, total, submit-count, link. The
    // approved sentence is "but {{3}} didn't", and {{3}} is only the kids who
    // still need to submit (said <= 0). A template wording change — not a
    // fifth variable — would be needed before the bubble itself can say
    // "X still need to finish, Y still need to submit". SMS is free text, so
    // it already uses that sentence. Do not stuff the phrase into {{3}} while
    // the approved wording still ends with "didn't."
    $templateCounts = $filled . ' out of ' . $total . ' kids in your ' . $scope
        . ' filled out their Shabbos Mevorchim Tehillim, but ' . $missing
        . " didn't.";
    $split = wwtcNotifyStillNeed($under, 'finish') . ', ' . wwtcNotifyStillNeed($missing, 'submit');
    $counts = $filled . ' out of ' . $total . ' kids in your ' . $scope
        . ' filled out their Shabbos Mevorchim Tehillim. ' . $split . '.';
    // {{4}} / $link is the signed PDF. The public sign-in page is a separate
    // SMS line, because the template has no fifth variable for it.
    $whatsapp = $templateCounts . ' See the full report here: ' . $link . '.';
    if ($role === 'base') {
        // The short WhatsApp bubble does not list classes. SMS does, so this
        // sentence stays on the template only and is not repeated in the text.
        $whatsapp .= ' Each class is in the attached report.';
    }
    $whatsapp .= " Please follow up with them today and see why they didn't.";

    $sms = $counts;
    if ($incompleteLines) {
        $sms .= "\n" . implode("\n", $incompleteLines);
    }
    if ($role === 'base' && $classLines) {
        $sms .= "\n" . implode("\n", $classLines);
    }
    $sms .= "\nSee the full report here: " . $link;
    if ($fillUrl !== '') {
        $sms .= "\nLink to fill it out: " . $fillUrl;
    }
    $sms .= "\nPlease follow up with them today and see why they didn't.";
    $sms .= "\nReply STOP to opt out.";
    return ['whatsapp' => $whatsapp, 'sms' => $sms];
}

function wwtcNotifyNormalizePhone(string $raw): array
{
    $raw = trim($raw);
    if ($raw === '') {
        return ['ok' => false, 'e164' => '', 'reason' => 'empty'];
    }
    $hasPlus = isset($raw[0]) && $raw[0] === '+';
    $digits = preg_replace('/\D+/', '', $raw);
    if (!is_string($digits) || $digits === '') {
        return ['ok' => false, 'e164' => '', 'reason' => 'no digits'];
    }
    if (!$hasPlus && strlen($digits) === 11 && $digits[0] === '1') {
        $digits = substr($digits, 1);
    }
    if (!$hasPlus) {
        if (strlen($digits) !== 10) {
            return ['ok' => false, 'e164' => '', 'reason' => 'not a US 10-digit number'];
        }
        $digits = '1' . $digits;
    }
    $length = strlen($digits);
    if ($length < 8 || $length > 15 || $digits[0] === '0') {
        return ['ok' => false, 'e164' => '', 'reason' => 'invalid length'];
    }
    return ['ok' => true, 'e164' => '+' . $digits, 'reason' => ''];
}

function wwtcNotifyYmdFromJd(int $jd): string
{
    $gregorian = jdtogregorian($jd);
    $parts = explode('/', (string) $gregorian);
    if (count($parts) !== 3) {
        return '1970-01-01';
    }
    return sprintf('%04d-%02d-%02d', (int) $parts[2], (int) $parts[0], (int) $parts[1]);
}

function wwtcNotifyTodayNewYork($now = 'now'): string
{
    $zone = new DateTimeZone('America/New_York');
    if ($now instanceof DateTimeInterface) {
        $instant = new DateTimeImmutable('@' . $now->getTimestamp());
        return $instant->setTimezone($zone)->format('Y-m-d');
    }
    return (new DateTimeImmutable('now', $zone))->format('Y-m-d');
}

/** First Wednesday strictly after $ymd. Noon in New York so DST cannot skip a date. */
function wwtcNotifyFirstWednesdayAfter(string $ymd): string
{
    $zone = new DateTimeZone('America/New_York');
    $day = new DateTimeImmutable($ymd . ' 12:00:00', $zone);
    do {
        $day = $day->modify('+1 day');
    } while ($day->format('N') !== '3');
    return $day->format('Y-m-d');
}

/**
 * Latest Shabbos Mevorchim on or before today.
 * $monthToYmd uses the report month names, including "Adar I" and "Adar II".
 * The returned Wednesday is filled in even when today is not that Wednesday.
 */
function wwtcNotifyLatestShabbos(array $monthToYmd, string $todayYmd): ?array
{
    $best = null;
    foreach ($monthToYmd as $month => $ymd) {
        $ymd = (string) $ymd;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd) || $ymd > $todayYmd) {
            continue;
        }
        if ($best === null || $ymd > $best['shabbos']) {
            $best = ['month' => (string) $month, 'shabbos' => $ymd];
        }
    }
    if ($best === null) {
        return null;
    }
    $best['wednesday'] = wwtcNotifyFirstWednesdayAfter($best['shabbos']);
    return $best;
}

function wwtcNotifyIsSendDay(?array $latest, string $todayYmd): bool
{
    return is_array($latest) && (string) ($latest['wednesday'] ?? '') === $todayYmd;
}

function wwtcNotifyNotDueMessage(string $today, ?array $latest): string
{
    if (!$latest) {
        return 'Not sending. No Shabbos Mevorchim on or before ' . $today . ' (America/New_York).';
    }
    return 'Not sending. Today ' . $today . ' America/New_York is not the first Wednesday after the latest Shabbos Mevorchim'
        . ' (' . $latest['month'] . ' on ' . $latest['shabbos'] . ', first Wednesday ' . $latest['wednesday'] . ').';
}

function wwtcNotifyClaimDecision(string $existing): string
{
    if ($existing === 'sent' || $existing === 'pending' || $existing === 'skipped_opt_out') {
        return 'skip';
    }
    return 'go';
}

function wwtcNotifyPerSecond($requested): int
{
    $rate = (int) $requested;
    if ($rate < 1) {
        $rate = 10;
    }
    if ($rate > 19) {
        $rate = 19;
    }
    return $rate;
}

function wwtcNotifyIntervalMicros(int $perSecond): int
{
    return (int) ceil(1000000 / wwtcNotifyPerSecond($perSecond));
}

function wwtcNotifyProviderName(array $env): string
{
    $name = strtolower(trim((string) ($env['WHATSAPP_PROVIDER'] ?? 'meta')));
    if ($name === '360dialog' || $name === '360' || $name === 'dialog360') {
        return '360dialog';
    }
    return 'meta';
}

function wwtcNotifyTemplate(array $env, string $role): string
{
    $key = $role === 'base' ? 'WHATSAPP_TEMPLATE_BASE' : 'WHATSAPP_TEMPLATE_CLASS';
    return trim((string) ($env[$key] ?? ''));
}

function wwtcNotifyWhatsAppReady(array $env, string $role): bool
{
    if (wwtcNotifyTemplate($env, $role) === '') {
        return false;
    }
    if (wwtcNotifyProviderName($env) === '360dialog') {
        return wwtcNotify360Key($env) !== '';
    }
    return trim((string) ($env['WHATSAPP_TOKEN'] ?? '')) !== ''
        && trim((string) ($env['WHATSAPP_PHONE_NUMBER_ID'] ?? '')) !== '';
}

function wwtcNotify360Key(array $env): string
{
    $key = trim((string) ($env['WHATSAPP_360_API_KEY'] ?? ''));
    if ($key === '') {
        $key = trim((string) ($env['WHATSAPP_TOKEN'] ?? ''));
    }
    return $key;
}

function wwtcNotifySmsParts(array $env): array
{
    $sid = trim((string) ($env['TWILIO_ACCOUNT_SID'] ?? ''));
    if ($sid === '') {
        $sid = trim((string) ($env['TWILIO_SID'] ?? ''));
    }
    $token = trim((string) ($env['TWILIO_AUTH_TOKEN'] ?? ''));
    if ($token === '') {
        $token = trim((string) ($env['TWILIO_TOKEN'] ?? ''));
    }
    $from = trim((string) ($env['TWILIO_FROM'] ?? ''));
    return ['sid' => $sid, 'token' => $token, 'from' => $from];
}

function wwtcNotifySmsReady(array $env): bool
{
    $parts = wwtcNotifySmsParts($env);
    return $parts['sid'] !== '' && $parts['token'] !== '' && $parts['from'] !== '';
}

function wwtcNotifyDownloadName(string $month, int $year): string
{
    $slug = strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $month));
    $slug = trim($slug, '-');
    if ($slug === '') {
        $slug = 'month';
    }
    return 'tehillim-' . $slug . '-' . $year . '.pdf';
}

function wwtcNotifyFileId(string $recipientKey, int $year, string $month): string
{
    return substr(hash('sha256', $recipientKey . '|' . $year . '|' . $month), 0, 32);
}

function wwtcNotifyB64Url(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function wwtcNotifyB64UrlDecode(string $raw): string
{
    $padded = strtr($raw, '-_', '+/');
    $pad = strlen($padded) % 4;
    if ($pad > 0) {
        $padded .= str_repeat('=', 4 - $pad);
    }
    $decoded = base64_decode($padded, true);
    return is_string($decoded) ? $decoded : '';
}

function wwtcNotifySign(array $payload, string $secret): string
{
    $json = json_encode($payload);
    if (!is_string($json)) {
        $json = '{}';
    }
    $body = wwtcNotifyB64Url($json);
    return $body . '.' . hash_hmac('sha256', $body, $secret);
}

function wwtcNotifyVerifyToken(string $token, string $secret, int $now): ?array
{
    if ($secret === '' || strpos($token, '.') === false) {
        return null;
    }
    $cut = strrpos($token, '.');
    if ($cut === false) {
        return null;
    }
    $body = substr($token, 0, $cut);
    $sig = substr($token, $cut + 1);
    $expected = hash_hmac('sha256', $body, $secret);
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $json = wwtcNotifyB64UrlDecode($body);
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        return null;
    }
    $exp = (int) ($payload['exp'] ?? 0);
    $file = (string) ($payload['file'] ?? '');
    if ($exp < $now || !preg_match('/^[a-f0-9]{32}$/', $file)) {
        return null;
    }
    return $payload;
}

function wwtcNotifyReportUrl(string $publicBase, string $token): string
{
    return rtrim($publicBase, '/') . '/api/notify-report?t=' . rawurlencode($token);
}

function wwtcNotifyPublicBase(array $env): string
{
    $base = trim((string) ($env['WWTC_PUBLIC_BASE'] ?? ''));
    if ($base === '') {
        $base = 'https://mashpia.com/shabbos-mevorchim-tehillim';
    }
    return rtrim($base, '/');
}

function wwtcNotifyLinkDays(array $env): int
{
    $days = (int) ($env['WWTC_NOTIFY_LINK_DAYS'] ?? 30);
    if ($days < 1) {
        return 30;
    }
    if ($days > 180) {
        return 180;
    }
    return $days;
}

function wwtcNotifyWhatsAppRequest(
    array $env,
    string $role,
    string $e164,
    string $docUrl,
    string $filename,
    int $filled,
    int $total,
    int $missing,
    string $link
): array {
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
            'name' => wwtcNotifyTemplate($env, $role),
            'language' => ['code' => $lang],
            'components' => [
                [
                    'type' => 'header',
                    'parameters' => [[
                        'type' => 'document',
                        'document' => [
                            'link' => $docUrl,
                            'filename' => $filename,
                        ],
                    ]],
                ],
                [
                    'type' => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => (string) $filled],
                        ['type' => 'text', 'text' => (string) $total],
                        ['type' => 'text', 'text' => (string) $missing],
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

function wwtcNotifyReadWhatsAppResult(int $status, $json): array
{
    if ($status >= 200 && $status < 300 && is_array($json) && !isset($json['error'])) {
        $id = '';
        if (isset($json['messages'][0]['id'])) {
            $id = (string) $json['messages'][0]['id'];
        }
        return ['ok' => true, 'notOnWhatsApp' => false, 'detail' => $id !== '' ? $id : 'sent'];
    }
    $code = 0;
    if (is_array($json)) {
        if (isset($json['error']['code'])) {
            $code = (int) $json['error']['code'];
        } elseif (isset($json['errors'][0]['code'])) {
            $code = (int) $json['errors'][0]['code'];
        }
    }
    // 131026 is the Cloud API "message undeliverable" code used when the
    // number is not on WhatsApp. 1013 is the older on-premises code for that.
    $notOnWhatsApp = ($code === 131026 || $code === 1013);
    return [
        'ok' => false,
        'notOnWhatsApp' => $notOnWhatsApp,
        'detail' => 'whatsapp http ' . $status . ' code ' . $code,
    ];
}

function wwtcNotifySmsRequest(array $env, string $e164, string $body): array
{
    $parts = wwtcNotifySmsParts($env);
    return [
        'provider' => 'twilio',
        'url' => 'https://api.twilio.com/2010-04-01/Accounts/' . rawurlencode($parts['sid']) . '/Messages.json',
        'headers' => [
            'Authorization: Basic ' . base64_encode($parts['sid'] . ':' . $parts['token']),
            'Content-Type: application/x-www-form-urlencoded',
        ],
        'body' => http_build_query([
            'To' => $e164,
            'From' => $parts['from'],
            'Body' => $body,
        ]),
    ];
}

function wwtcNotifyCurl(string $url, array $headers, string $body, int $timeout = 30): array
{
    if (!function_exists('curl_init')) {
        return ['status' => 0, 'json' => null, 'raw' => 'curl missing'];
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($raw)) {
        $raw = '';
    }
    $json = json_decode($raw, true);
    return ['status' => $status, 'json' => is_array($json) ? $json : null, 'raw' => $raw];
}

function wwtcNotifyCurlWhatsApp(array $request): array
{
    $encoded = json_encode($request['payload']);
    if (!is_string($encoded)) {
        $encoded = '{}';
    }
    $res = wwtcNotifyCurl($request['url'], $request['headers'], $encoded);
    return wwtcNotifyReadWhatsAppResult($res['status'], $res['json']);
}

function wwtcNotifyCurlSms(array $request): array
{
    $res = wwtcNotifyCurl($request['url'], $request['headers'], (string) $request['body']);
    $ok = $res['status'] >= 200 && $res['status'] < 300;
    return ['ok' => $ok, 'detail' => $ok ? 'sms sent' : ('sms http ' . $res['status'])];
}

function wwtcPdfEscape(string $text): string
{
    $converted = $text;
    if (function_exists('iconv')) {
        $try = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
        if (is_string($try) && $try !== '') {
            $converted = $try;
        }
    }
    $converted = str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', '', ' '], $converted);
    $cleaned = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $converted);
    return is_string($cleaned) ? $cleaned : $converted;
}

function wwtcNotifyRenderPdf(array $lines): string
{
    $pages = new WwtcPdfPages();
    foreach ($lines as $line) {
        $text = (string) ($line['text'] ?? '');
        if ($text === '') {
            $pages->gap((int) ($line['gap'] ?? 6));
            continue;
        }
        $color = $line['color'] ?? [0.1, 0.1, 0.1];
        $pages->text(
            $text,
            (float) ($line['size'] ?? 11),
            !empty($line['bold']),
            [(float) $color[0], (float) $color[1], (float) $color[2]],
            (int) ($line['indent'] ?? 0)
        );
        $pages->gap((int) ($line['gap'] ?? 2));
    }
    return wwtcPdfDocument($pages->finish());
}

class WwtcPdfPages
{
    public $pages = [];
    public $buf = '';
    public $y = 0;
    private $pageH = 792.0;
    private $left = 48.0;

    public function __construct()
    {
        $this->startPage(false);
    }

    private function startPage(bool $keepCurrent): void
    {
        if ($keepCurrent && $this->buf !== '') {
            $this->pages[] = $this->buf;
        }
        $this->buf = "0.102 0.145 0.357 rg 0 756 612 36 re f\n";
        $this->buf .= "1 1 1 rg BT /F2 11 Tf 1 0 0 1 48 770 Tm (Shabbos Mevorchim Tehillim) Tj ET\n";
        $this->buf .= "0.40 0.42 0.46 rg BT /F1 8 Tf 1 0 0 1 48 28 Tm (Private. For this recipient only.) Tj ET\n";
        $this->y = 56;
    }

    public function gap(int $points): void
    {
        $this->y += $points;
    }

    public function text(string $text, float $size, bool $bold, array $rgb, int $indent): void
    {
        $max = (int) floor((516 - $indent) / max(1, $size * 0.52));
        if ($max < 20) {
            $max = 20;
        }
        $words = preg_split('/\s+/', trim($text));
        if (!is_array($words)) {
            $words = [];
        }
        $wrapped = [];
        $current = '';
        foreach ($words as $word) {
            $word = (string) $word;
            if ($current === '') {
                $current = $word;
                continue;
            }
            if (strlen($current . ' ' . $word) > $max) {
                $wrapped[] = $current;
                $current = $word;
            } else {
                $current .= ' ' . $word;
            }
        }
        if ($current !== '') {
            $wrapped[] = $current;
        }
        if (!$wrapped) {
            return;
        }
        $lineHeight = $size + 4;
        $font = $bold ? 'F2' : 'F1';
        foreach ($wrapped as $line) {
            if ($this->y + $lineHeight > 740) {
                $this->startPage(true);
            }
            $x = $this->left + $indent;
            $pdfY = $this->pageH - $this->y - $size;
            $this->buf .= sprintf(
                "%.3f %.3f %.3f rg BT /%s %.2f Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET\n",
                $rgb[0],
                $rgb[1],
                $rgb[2],
                $font,
                $size,
                $x,
                $pdfY,
                wwtcPdfEscape($line)
            );
            $this->y += $lineHeight;
        }
    }

    public function finish(): array
    {
        if ($this->buf !== '') {
            $this->pages[] = $this->buf;
            $this->buf = '';
        }
        return $this->pages;
    }
}

function wwtcPdfDocument(array $streams): string
{
    if (!$streams) {
        $streams = ["BT /F1 12 Tf 48 740 Td (Empty report) Tj ET\n"];
    }
    $objects = [];
    $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
    $pageIds = [];
    $next = 5;
    foreach ($streams as $stream) {
        $stream = (string) $stream;
        $contentId = $next++;
        $pageId = $next++;
        $objects[$contentId] = "<< /Length " . strlen($stream) . " >>\nstream\n" . $stream . "endstream";
        $objects[$pageId] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents '
            . $contentId . ' 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>';
        $pageIds[] = $pageId;
    }
    $kids = [];
    foreach ($pageIds as $pageId) {
        $kids[] = $pageId . ' 0 R';
    }
    $objects[2] = '<< /Type /Pages /Count ' . count($pageIds) . ' /Kids [' . implode(' ', $kids) . '] >>';
    $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    ksort($objects);
    $pdf = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objects as $id => $body) {
        $offsets[$id] = strlen($pdf);
        $pdf .= $id . " 0 obj\n" . $body . "\nendobj\n";
    }
    $xref = strlen($pdf);
    $max = (int) max(array_keys($objects));
    $pdf .= 'xref' . "\n" . '0 ' . ($max + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= $max; $i++) {
        $pdf .= sprintf("%010d 00000 n \n", (int) ($offsets[$i] ?? 0));
    }
    $pdf .= 'trailer << /Size ' . ($max + 1) . " /Root 1 0 R >>\n";
    $pdf .= "startxref\n" . $xref . "\n%%EOF";
    return $pdf;
}

function wwtcNotifyOnlyAdmin($only): ?string
{
    if ($only === null) {
        return null;
    }
    $only = trim((string) $only);
    if ($only === '') {
        return null;
    }
    if (strpos($only, 'admin:') === 0) {
        $only = substr($only, 6);
    }
    return $only;
}

/**
 * Run the send plan. $job carries data. $deps carries side effects
 * (deliverWhatsApp, deliverSms, writePdf, record, sleepMicros, out).
 * Kid names are not included in the returned output text.
 */
function wwtcNotifyExecute(array $job, array $deps = []): array
{
    $today = (string) ($job['today'] ?? wwtcNotifyTodayNewYork());
    $year = (int) ($job['year'] ?? 0);
    $months = $job['months'] ?? [];
    $latest = wwtcNotifyLatestShabbos($months, $today);
    $force = !empty($job['force']);
    $dry = !empty($job['dryRun']);
    $output = '';
    $emit = function (string $line) use (&$output, $deps): void {
        $output .= $line . "\n";
        if (isset($deps['out'])) {
            $deps['out']($line);
        }
    };
    if ((!$latest || !wwtcNotifyIsSendDay($latest, $today)) && !$force) {
        $emit(wwtcNotifyNotDueMessage($today, $latest));
        return [
            'due' => false,
            'month' => $latest['month'] ?? null,
            'wednesday' => $latest['wednesday'] ?? null,
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
            'wednesday' => null,
            'shabbos' => null,
            'output' => $output,
            'results' => [],
            'exitCode' => 0,
            'slept' => 0,
        ];
    }

    $month = (string) $latest['month'];
    $env = $job['env'] ?? [];
    $secret = (string) ($job['secret'] ?? '');
    $publicBase = rtrim((string) ($job['publicBase'] ?? wwtcNotifyPublicBase($env)), '/');
    $fillUrl = $publicBase . '/login';
    $now = (int) ($job['now'] ?? time());
    $days = (int) ($job['linkDays'] ?? wwtcNotifyLinkDays($env));
    $expires = (new DateTimeImmutable('@' . ($now + $days * 86400)))
        ->setTimezone(new DateTimeZone('America/New_York'))
        ->format('F j, Y');
    $only = wwtcNotifyOnlyAdmin($job['only'] ?? null);
    $schools = $job['schools'] ?? [];
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
    $emit($prefix . $month . ' ' . $year . ' — Shabbos ' . $latest['shabbos'] . ' — Wednesday ' . $latest['wednesday']);

    foreach ($job['recipients'] ?? [] as $recipient) {
        if ($only !== null && (string) $recipient['adminId'] !== $only) {
            continue;
        }
        $key = wwtcNotifyRecipientKey($recipient);
        $report = wwtcNotifyComposeReport($recipient, $schools, $month, $year, $fillUrl, $expires);
        $baseResult = [
            'recipientKey' => $key,
            'adminId' => (int) $recipient['adminId'],
            'role' => (string) $recipient['role'],
            'schoolId' => (int) $recipient['schoolId'],
            'classId' => (int) ($recipient['classId'] ?? 0),
            'outcome' => '',
            'channel' => null,
            'provider' => null,
            'bodyWhatsapp' => '',
            'bodySms' => '',
            'pdf' => '',
            'payload' => null,
        ];
        $line = strtoupper((string) $recipient['role'])
            . ' admin=' . (int) $recipient['adminId']
            . ' school=' . (int) $recipient['schoolId'];
        if (($recipient['role'] ?? '') === 'class') {
            $line .= ' class=' . (int) $recipient['classId'] . ' ' . wwtcFormatClassName((string) ($recipient['className'] ?? ''));
        } else {
            $line .= ' ' . (string) ($recipient['schoolName'] ?? $report['schoolName']);
        }
        $line .= ' phone=' . (string) ($recipient['phone'] ?? '');
        if (!empty($recipient['email'])) {
            $line .= ' email=' . $recipient['email'];
        }
        $line .= ' filled=' . $report['filled'] . '/' . $report['total'] . ' missing=' . $report['missing'];

        if ($report['total'] <= 0) {
            $baseResult['outcome'] = 'skipped_empty';
            $results[] = $baseResult;
            $emit($line . ' outcome=skipped_empty');
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

        $link = '(signed report link — not created in a dry run)';
        $filename = wwtcNotifyDownloadName($month, $year);
        $pdf = wwtcNotifyRenderPdf($report['pdfLines']);
        $baseResult['pdf'] = $pdf;
        if (!$dry) {
            $fileId = wwtcNotifyFileId($key, $year, $month);
            if ($secret === '') {
                $baseResult['outcome'] = 'failed';
                $results[] = $baseResult;
                $failures++;
                $emit($line . ' outcome=failed missing signing secret');
                continue;
            }
            if (isset($deps['writePdf'])) {
                $deps['writePdf']($fileId, $pdf);
            }
            $token = wwtcNotifySign([
                'v' => 1,
                'exp' => $now + $days * 86400,
                'file' => $fileId,
                'name' => $filename,
            ], $secret);
            $link = wwtcNotifyReportUrl($publicBase, $token);
        }
        $bodies = wwtcNotifyBodies(
            (string) $recipient['role'],
            (int) $report['filled'],
            (int) $report['total'],
            (int) $report['missing'],
            $link,
            $report['classLines'],
            $fillUrl,
            (int) $report['under'],
            $report['incompleteLines']
        );
        $baseResult['bodyWhatsapp'] = $bodies['whatsapp'];
        $baseResult['bodySms'] = $bodies['sms'];
        $channelPlan = wwtcNotifyWhatsAppReady($env, (string) $recipient['role']) ? 'whatsapp' : (wwtcNotifySmsReady($env) ? 'sms' : 'none');
        $emit($line . ' channel=' . $channelPlan);
        if (($recipient['role'] ?? '') === 'base') {
            foreach ($report['classLines'] as $classLine) {
                $emit('  ' . $classLine);
            }
        }
        if ($dry) {
            $emit('MESSAGE: ' . $bodies['sms']);
            $baseResult['outcome'] = 'dry_run';
            $results[] = $baseResult;
            continue;
        }

        wwtcNotifyRemember($deps, $baseResult, $year, $month, $recipient, $phone['e164'], 'pending', '');
        $sentOk = false;
        if (wwtcNotifyWhatsAppReady($env, (string) $recipient['role'])) {
            if ($waSends > 0) {
                $pause = wwtcNotifyIntervalMicros($rate);
                $slept += $pause;
                if (isset($deps['sleepMicros'])) {
                    $deps['sleepMicros']($pause);
                }
            }
            $waSends++;
            $request = wwtcNotifyWhatsAppRequest(
                $env,
                (string) $recipient['role'],
                $phone['e164'],
                $link,
                $filename,
                (int) $report['filled'],
                (int) $report['total'],
                (int) $report['missing'],
                $link
            );
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
                $smsRequest = wwtcNotifySmsRequest($env, $phone['e164'], $bodies['sms']);
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

    return [
        'due' => true,
        'month' => $month,
        'wednesday' => $latest['wednesday'],
        'shabbos' => $latest['shabbos'],
        'output' => $output,
        'results' => $results,
        'exitCode' => $failures > 0 ? 1 : 0,
        'slept' => $slept,
    ];
}

function wwtcNotifyRemember(array $deps, array $result, int $year, string $month, array $recipient, string $e164, string $outcome, string $detail): void
{
    if (!isset($deps['record'])) {
        return;
    }
    $deps['record']([
        'year' => $year,
        'month' => $month,
        'recipientKey' => $result['recipientKey'],
        'adminId' => (int) $recipient['adminId'],
        'role' => (string) $recipient['role'],
        'schoolId' => (int) $recipient['schoolId'],
        'classId' => (int) ($recipient['classId'] ?? 0),
        'phone' => $e164,
        'email' => (string) ($recipient['email'] ?? ''),
        'channel' => $result['channel'],
        'provider' => $result['provider'],
        'outcome' => $outcome,
        'detail' => substr($detail, 0, 250),
    ]);
}

function wwtcNotifyEnv(string $name): string
{
    if (function_exists('wwtcEnv')) {
        return trim(wwtcEnv($name));
    }
    $value = getenv($name);
    return $value === false ? '' : trim((string) $value);
}

function wwtcNotifyReadEnv(): array
{
    $keys = [
        'WHATSAPP_PROVIDER', 'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_360_API_KEY',
        'WHATSAPP_360_BASE', 'WHATSAPP_TEMPLATE_CLASS', 'WHATSAPP_TEMPLATE_BASE', 'WHATSAPP_TEMPLATE_LANG',
        'WHATSAPP_MAX_PER_SECOND', 'WHATSAPP_GRAPH_VERSION', 'TWILIO_ACCOUNT_SID', 'TWILIO_SID',
        'TWILIO_AUTH_TOKEN', 'TWILIO_TOKEN', 'TWILIO_FROM', 'WWTC_NOTIFY_SIGNING_SECRET',
        'WWTC_TOKEN_SECRET', 'WWTC_NOTIFY_DIR', 'WWTC_NOTIFY_LINK_DAYS', 'WWTC_PUBLIC_BASE',
    ];
    $env = [];
    foreach ($keys as $key) {
        $env[$key] = wwtcNotifyEnv($key);
    }
    return $env;
}

function wwtcNotifyParseArgs(array $argv): array
{
    $out = ['dryRun' => false, 'only' => null, 'force' => false, 'error' => ''];
    foreach (array_slice($argv, 1) as $arg) {
        if ($arg === '--dry-run') {
            $out['dryRun'] = true;
        } elseif ($arg === '--force') {
            $out['force'] = true;
        } elseif (strpos($arg, '--only=') === 0) {
            $out['only'] = substr($arg, 7);
        } elseif ($arg === '--help' || $arg === '-h') {
            $out['error'] = 'help';
        } else {
            $out['error'] = 'Unknown argument: ' . $arg;
        }
    }
    return $out;
}

function wwtcNotifyDir(): string
{
    $env = wwtcNotifyEnv('WWTC_NOTIFY_DIR');
    if ($env !== '') {
        $dir = $env;
    } elseif (defined('MASHPIA_LOG_DIR') && (string) MASHPIA_LOG_DIR !== '') {
        $dir = rtrim((string) MASHPIA_LOG_DIR, '/') . '/wwtc-notify';
    } else {
        $dir = rtrim(sys_get_temp_dir(), '/') . '/wwtc-notify';
    }
    if (!is_dir($dir) && !@mkdir($dir, 0770, true) && !is_dir($dir)) {
        throw new RuntimeException('Could not create the notify directory.');
    }
    return $dir;
}

function wwtcNotifyStoredPath(string $dir, string $fileId): ?string
{
    if (!preg_match('/^[a-f0-9]{32}$/', $fileId)) {
        return null;
    }
    $path = rtrim($dir, '/') . '/' . $fileId . '.pdf';
    if (!is_file($path)) {
        return null;
    }
    $realDir = realpath($dir);
    $real = realpath($path);
    if ($realDir === false || $real === false) {
        return null;
    }
    $prefix = rtrim($realDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    if (strpos($real, $prefix) !== 0) {
        return null;
    }
    return $real;
}

function wwtcNotifyServeReport(string $token): void
{
    $env = wwtcNotifyReadEnv();
    $secret = $env['WWTC_NOTIFY_SIGNING_SECRET'] !== '' ? $env['WWTC_NOTIFY_SIGNING_SECRET'] : $env['WWTC_TOKEN_SECRET'];
    $payload = wwtcNotifyVerifyToken($token, $secret, time());
    $path = null;
    if ($payload) {
        try {
            $path = wwtcNotifyStoredPath(wwtcNotifyDir(), (string) $payload['file']);
        } catch (Throwable $e) {
            $path = null;
        }
    }
    if ($path === null) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Report not found.';
        exit;
    }
    $name = (string) ($payload['name'] ?? 'tehillim-report.pdf');
    $name = preg_replace('/[^A-Za-z0-9._-]/', '', $name);
    if (!is_string($name) || $name === '') {
        $name = 'tehillim-report.pdf';
    }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $name . '"');
    header('Content-Length: ' . (string) filesize($path));
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    header('Cache-Control: private, max-age=0, no-store');
    readfile($path);
    exit;
}

function wwtcNotifyTablesReady(PDO $db): bool
{
    $stmt = $db->query(
        "SELECT TABLE_NAME FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN ('wwtc_notify_sends', 'wwtc_notify_opt_outs')"
    );
    $found = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $name) {
        $found[(string) $name] = true;
    }
    return isset($found['wwtc_notify_sends']) && isset($found['wwtc_notify_opt_outs']);
}

function wwtcNotifyAdminColumns(PDO $db): array
{
    $stmt = $db->query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins'"
    );
    $columns = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $column) {
        $columns[] = (string) $column;
    }
    return $columns;
}

function wwtcNotifyLoadOptOuts(PDO $db): array
{
    $rows = $db->query('SELECT phone_e164 FROM wwtc_notify_opt_outs')->fetchAll(PDO::FETCH_COLUMN);
    $out = [];
    foreach ($rows as $phone) {
        $out[] = (string) $phone;
    }
    return $out;
}

function wwtcNotifyLoadSent(PDO $db, int $year, string $month): array
{
    $stmt = $db->prepare(
        'SELECT recipient_key, outcome FROM wwtc_notify_sends WHERE campaign_year = :y AND month_name = :m'
    );
    $stmt->execute([':y' => $year, ':m' => $month]);
    $out = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $out[(string) $row['recipient_key']] = (string) $row['outcome'];
    }
    return $out;
}

function wwtcNotifyRecordSend(PDO $db, array $row): void
{
    $classId = (int) ($row['classId'] ?? 0);
    $stmt = $db->prepare(
        'INSERT INTO wwtc_notify_sends
            (campaign_year, month_name, recipient_key, admin_id, role, school_id, class_id,
             phone_e164, email, channel, provider, outcome, detail)
         VALUES
            (:y, :m, :k, :admin, :role, :school, :class, :phone, :email, :channel, :provider, :outcome, :detail)
         ON DUPLICATE KEY UPDATE
            phone_e164 = VALUES(phone_e164),
            email = VALUES(email),
            channel = VALUES(channel),
            provider = VALUES(provider),
            outcome = VALUES(outcome),
            detail = VALUES(detail)'
    );
    $stmt->execute([
        ':y' => (int) $row['year'],
        ':m' => (string) $row['month'],
        ':k' => (string) $row['recipientKey'],
        ':admin' => (int) $row['adminId'],
        ':role' => (string) $row['role'],
        ':school' => (int) $row['schoolId'],
        ':class' => $classId > 0 ? $classId : null,
        ':phone' => (string) ($row['phone'] ?? ''),
        ':email' => (string) ($row['email'] ?? ''),
        ':channel' => $row['channel'],
        ':provider' => $row['provider'],
        ':outcome' => (string) $row['outcome'],
        ':detail' => substr((string) ($row['detail'] ?? ''), 0, 250),
    ]);
}

function wwtcNotifyCli(array $argv): int
{
    global $MASHPIA_DB;
    $args = wwtcNotifyParseArgs($argv);
    if ($args['error'] === 'help') {
        echo "Usage: php api/notify-wednesday.php [--dry-run] [--only=<admin id>] [--force]\n";
        echo wwtcNotifyColumnGuessText() . "\n";
        return 0;
    }
    if ($args['error'] !== '') {
        fwrite(STDERR, $args['error'] . "\n");
        return 1;
    }
    $env = wwtcNotifyReadEnv();
    $year = wwtcYear();
    $jdMap = wwtcMonthDatesForYear($year);
    $ymdMap = [];
    foreach ($jdMap as $month => $jd) {
        $ymdMap[(string) $month] = wwtcNotifyYmdFromJd((int) $jd);
    }
    $today = wwtcNotifyTodayNewYork();
    $latest = wwtcNotifyLatestShabbos($ymdMap, $today);
    $due = wwtcNotifyIsSendDay($latest, $today);
    if (!$due && !$args['force']) {
        echo wwtcNotifyNotDueMessage($today, $latest) . "\n";
        return 0;
    }
    if (!$latest) {
        echo 'No Shabbos Mevorchim on or before ' . $today . " in campaign year $year.\n";
        return 0;
    }
    $secret = $env['WWTC_NOTIFY_SIGNING_SECRET'] !== '' ? $env['WWTC_NOTIFY_SIGNING_SECRET'] : $env['WWTC_TOKEN_SECRET'];
    if ($secret === '' && !$args['dryRun']) {
        fwrite(STDERR, "Set WWTC_NOTIFY_SIGNING_SECRET before sending.\n");
        return 1;
    }
    $tablesReady = wwtcNotifyTablesReady($MASHPIA_DB);
    if (!$tablesReady) {
        $message = "Run api/sql/wwtc_notify.sql before sending. Tables wwtc_notify_sends and wwtc_notify_opt_outs are missing.\n";
        if (!$args['dryRun']) {
            fwrite(STDERR, $message);
            return 1;
        }
        echo $message;
    }
    $columns = wwtcNotifyAdminColumns($MASHPIA_DB);
    $pick = wwtcNotifyPickPhones($columns);
    echo 'Contacts: email ' . ($pick['emailColumn'] ?? '(missing admin_email)')
        . '; phone ' . ($pick['phoneColumn'] ?? '(missing)')
        . ($pick['phoneFallbacks'] ? (' then ' . implode(', ', $pick['phoneFallbacks'])) : '')
        . ".\n";
    echo wwtcNotifyColumnGuessText() . "\n";
    if (!$pick['phoneColumn'] && !$args['dryRun']) {
        fwrite(STDERR, "No admin phone column was found, so nothing was sent.\n");
        return 1;
    }
    $rows = $MASHPIA_DB->query(wwtcNotifyRecipientSql($columns))->fetchAll(PDO::FETCH_ASSOC);
    $recipients = wwtcNotifyRecipientsFromRows($rows, array_map('intval', array_keys(wwtcEligibleSchools())));
    $optOut = $tablesReady ? wwtcNotifyLoadOptOuts($MASHPIA_DB) : [];
    $sent = $tablesReady ? wwtcNotifyLoadSent($MASHPIA_DB, $year, (string) $latest['month']) : [];
    $needed = [];
    foreach ($recipients as $recipient) {
        $needed[(int) $recipient['schoolId']] = true;
    }
    $names = wwtcEligibleSchools();
    $jd = (int) $jdMap[$latest['month']];
    $schools = [];
    foreach (array_keys($needed) as $schoolId) {
        try {
            // Quotas follow that school's year (wwtcSchoolData). The month in
            // the message stays the calendar Shabbos Mevorchim everyone shares.
            $data = wwtcSchoolData((int) $schoolId, $jd, $year);
            $schools[(int) $schoolId] = wwtcNotifySchoolFromReport($data, (string) ($names[$schoolId] ?? ''));
        } catch (Throwable $e) {
            fwrite(STDERR, 'School ' . $schoolId . ' report failed: ' . $e->getMessage() . "\n");
        }
    }
    $dir = wwtcNotifyDir();
    $result = wwtcNotifyExecute([
        'today' => $today,
        'year' => $year,
        'months' => $ymdMap,
        'dryRun' => $args['dryRun'],
        'only' => $args['only'],
        'force' => $args['force'],
        'recipients' => $recipients,
        'schools' => $schools,
        'optOut' => $optOut,
        'sent' => $sent,
        'publicBase' => wwtcNotifyPublicBase($env),
        'secret' => $secret,
        'linkDays' => wwtcNotifyLinkDays($env),
        'env' => $env,
        'now' => time(),
    ], [
        'deliverWhatsApp' => 'wwtcNotifyCurlWhatsApp',
        'deliverSms' => 'wwtcNotifyCurlSms',
        'sleepMicros' => function ($micros) {
            usleep((int) $micros);
        },
        'writePdf' => function ($fileId, $bytes) use ($dir) {
            $path = rtrim($dir, '/') . '/' . $fileId . '.pdf';
            $tmp = $path . '.' . getmypid() . '.tmp';
            if (file_put_contents($tmp, $bytes) === false) {
                throw new RuntimeException('Could not write the report PDF.');
            }
            if (!rename($tmp, $path)) {
                @unlink($tmp);
                throw new RuntimeException('Could not store the report PDF.');
            }
            @chmod($path, 0640);
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
