<?php

declare(strict_types=1);

/**
 * Signed-in soldier: progress, social, chat, self-report, own ladder.
 * Loaded by index.php with $method / $path set.
 */

// ---- the signed-in soldier --------------------------------------------------

if ($method === 'GET' && $path === '/me/progress') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    wwtcJson(wwtcKidProgress($kid));
}

if ($method === 'GET' && $path === '/me/social') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    $schoolId = (int) $kid['school_id'];
    $data = wwtcSchoolData($schoolId);

    // Class standings within the school, by % of soldiers who met.
    $classes = $data['classes'];
    usort($classes, static function ($a, $b) {
        return $b['pctMet'] <=> $a['pctMet'] ?: $b['met'] <=> $a['met'];
    });
    $myClassId = (int) $kid['class_id'];
    $classRank = wwtcCompetitionRank($classes, $myClassId, static function ($row) {
        return (int) $row['id'];
    }, ['pctMet', 'met']);
    $className = ''; $classSize = 0; $aheadName = null;
    foreach ($classes as $i => $c) {
        if ($c['id'] === $myClassId) {
            $className = $c['name'];
            $classSize = $c['size'];
            $aheadName = $i > 0 ? $classes[$i - 1]['name'] : null;
            break;
        }
    }

    // This soldier's rank within their class, by said this month.
    $mates = array_values(array_filter($data['students'], static function ($s) use ($myClassId) {
        return $s['classId'] === $myClassId;
    }));
    usort($mates, static function ($a, $b) {
        return $b['said'] <=> $a['said'];
    });
    $myRank = wwtcCompetitionRank($mates, (int) $kid['user_id'], static function ($row) {
        return (int) $row['id'];
    }, ['said']);
    $schoolmates = $data['students'];
    usort($schoolmates, static function ($a, $b) {
        return $b['said'] <=> $a['said'];
    });
    $myRankInSchool = wwtcCompetitionRank($schoolmates, (int) $kid['user_id'], static function ($row) {
        return (int) $row['id'];
    }, ['said']);
    $classPerfect = false;
    foreach ($data['classes'] as $c) {
        if ($c['id'] === $myClassId) {
            $classPerfect = !empty($c['perfect']);
            break;
        }
    }

    // School standing nationwide — same Race order as Home (% soldiers met first).
    // Previously ranked by raw kapitlach said, which disagreed with the main page.
    $ranked = wwtcNationwideSchools();
    $schoolRank = wwtcCompetitionRank($ranked, $schoolId, static function ($row) {
        return (int) $row['id'];
    }, wwtcBaseRankKeys());

    // How many more classmates finishing would pass the class ahead (pctMet).
    $needToPass = 0;
    if ($classRank > 1 && $classSize > 0) {
        $mine = null;
        $ahead = null;
        foreach ($classes as $i => $c) {
            if ($c['id'] === $myClassId) {
                $mine = $c;
                $ahead = $i > 0 ? $classes[$i - 1] : null;
                break;
            }
        }
        if ($mine && $ahead && $mine['met'] < $mine['size']) {
            $targetMet = (int) floor(($ahead['pctMet'] / 100) * $mine['size']) + 1;
            $needToPass = max(1, min($mine['size'] - $mine['met'], $targetMet - $mine['met']));
        }
    }

    wwtcJson([
        'className' => wwtcFormatClassName($className),
        'classRank' => $classRank,
        'totalClasses' => count($classes),
        'classAheadName' => $aheadName === null ? null : wwtcFormatClassName($aheadName),
        'needToPass' => $needToPass,
        'myRankInClass' => $myRank,
        'classSize' => $classSize,
        'myRankInSchool' => $myRankInSchool,
        'schoolSize' => count($schoolmates),
        'classPerfect' => $classPerfect,
        'schoolName' => $kid['school_name'] ?? null,
        'schoolRank' => $schoolRank,
        'totalSchools' => count($ranked),
    ]);
}

// ---- General 613: a scoped talking general ----------------------------------

/** System prompt: General 613 stays warm, on-topic, and easy to hear out loud. */
function wwtcGeneralSystem(string $ctxJson): string
{
    return <<<SYS
You are the child's virtual commander. In every sentence you call yourself "your virtual commander", never "General 613". You are the friendly general of the Worldwide Tehillim Club — a Tzivos Hashem campaign where Jewish children say Tehillim every Shabbos Mevorchim and train, grade by grade, toward saying the whole Sefer Tehillim. You talk to one child at a time. You are a kind general: warm, encouraging, and never harsh or scary.

Your words are spoken out loud. Write the way you talk to a child: one or two short sentences, everyday words, no lists, no markdown, no links, no stage directions. A little emoji is fine in the written chat, but the sentence must still make complete sense if the emoji is taken out.

Your ONLY job is to help this child with the Tehillim Club, and to explain how it works in simple words: how to pick a ladder, what their quota is (the kapitlach and minutes to say), and how to mark it done (on their page, type the kapitlach and minutes and tap Save). Also help with their progress, missions and medals, class and school rank, the next Shabbos Mevorchim, and warm chizuk to say Tehillim.

Rules:
- Stay strictly on those topics: the Worldwide Tehillim Club, Tehillim, Tzivos Hashem, this website, this child's ladder, quota, progress, medals, and encouragement about those. If the child says anything that is not connected, do not answer it at all. Do not explain it, play along, or give a hint. Say only: "I can only help with the Tehillim Club. What would you like to know about your Tehillim?"
- Use ONLY the facts in the child's data below. Never invent numbers, names, Hebrew dates, or ranks. If something isn't in the data, say you don't have it and suggest they check their page.
- The ladder is training, not the goal. Saying the whole Tehillim every Shabbos Mevorchim is the goal. A lower ladder number is more challenging and a bigger quota. Ladder 12 is the gentlest. Use only ladderChoices for kapitlach and minutes. Never invent a quota. If minutes are missing, don't make them up.
- If "answerSheet" is in the data, those are the approved answers. When the child's question matches one, use that answer word for word. If an answer says to ask a counselor or a grown-up, say that and do not invent a fact. Never type the child's kapitlach or minutes for them. Guide them to the "Kapitlach I said" and "Minutes I said" boxes, then Save.
- If "greeting" is in the data, that is what you just said out loud when they arrived. Continue that conversation; don't repeat the whole greeting. If they have not picked a ladder, walk the ladders in ladderChoices, one at a time, and ask if that quota works or if they want a more challenging ladder. The app saves the ladder when they say yes. If they ask to change to a ladder, confirm that ladder's kapitlach and minutes and wait for yes. Only a ladder in ladderChoices can be saved. If a save fails, they can tap "Switch my ladder" on their page.
- Never give medical, legal, or safety advice, and never discuss anything inappropriate or frightening. If a child seems upset or in trouble, gently encourage them to talk to a parent, teacher, or Rabbi.

The child's data (JSON):
$ctxJson
SYS;
}

/** Call the Claude Messages API. Returns the reply text, or null on any failure. */
function wwtcGeneralAsk(string $key, string $model, string $system, array $messages): ?string
{
    $payload = json_encode(
        ['model' => $model, 'max_tokens' => 300, 'system' => $system, 'messages' => $messages],
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['content-type: application/json', 'anthropic-version: 2023-06-01', 'x-api-key: ' . $key],
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 25,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if (!is_string($raw) || $status < 200 || $status >= 300) {
        error_log('WWTC General 613 AI error: status ' . $status . ' ' . $err . ' ' . (is_string($raw) ? mb_substr($raw, 0, 500) : ''));
        return null;
    }
    $data = json_decode($raw, true);
    $text = '';
    foreach ((array) ($data['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'text') {
            $text .= (string) ($block['text'] ?? '');
        }
    }
    $text = trim($text);
    return $text === '' ? null : $text;
}

if ($method === 'POST' && ($path === '/realtime-session' || $path === '/realtime-session.php')) {
    require_once __DIR__ . '/realtime-session.php';
    wwtcHandleRealtimeSession();
}

if ($method === 'POST' && $path === '/chat') {
    $in = wwtcInput();
    $message = trim((string) ($in['message'] ?? ''));
    if ($message === '') {
        wwtcError('Please include a message.', 422);
    }
    $message = mb_substr($message, 0, 600);

    // Server-side only. Set WWTC_AI_KEY in globals.php (gitignored) or the env.
    $key = defined('WWTC_AI_KEY') ? (string) WWTC_AI_KEY : '';
    if (strlen($key) < 10) {
        $key = wwtcEnv('WWTC_AI_KEY');
    }
    if (strlen($key) < 10) {
        wwtcError('Your Virtual Commander’s AI is not configured yet.', 503);
    }
    $model = wwtcEnv('WWTC_AI_MODEL') ?: 'claude-haiku-5-5';

    // The child's own, non-sensitive progress snapshot, as the SPA computed it.
    $ctx = is_array($in['context'] ?? null) ? $in['context'] : [];
    $system = wwtcGeneralSystem((string) json_encode($ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

    // Short rolling history for continuity (child = user, General 613 = assistant).
    $messages = [];
    foreach ((array) ($in['history'] ?? []) as $h) {
        $text = trim((string) ($h['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $messages[] = ['role' => ($h['from'] ?? '') === 'kid' ? 'user' : 'assistant', 'content' => mb_substr($text, 0, 600)];
    }
    $messages = array_slice($messages, -8);
    // The Messages API requires the first turn to be from the user.
    while ($messages && $messages[0]['role'] !== 'user') {
        array_shift($messages);
    }
    if (!$messages || end($messages)['content'] !== $message) {
        $messages[] = ['role' => 'user', 'content' => $message];
    }

    $reply = wwtcGeneralAsk($key, $model, $system, $messages);
    if ($reply === null) {
        wwtcError('Your Virtual Commander is taking a quick break — please try again in a moment.', 502);
    }
    wwtcJson(['reply' => $reply]);
}

// ---- writes: the signed-in soldier's own self-report -----------------------

// A soldier records their own kapitlach + minutes for the current Shabbos
// Mevorchim. Writes the same tables the teacher tool (mark_tehillim2.php) writes,
// scoped by the bearer token to the soldier's own user_id, current month only.
if ($method === 'POST' && $path === '/me/report') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    if (empty($kid['track_id']) || empty($kid['level'])) {
        wwtcError('You are not enrolled in the Tehillim Club yet — ask your teacher.', 409);
    }

    $date = wwtcCurrentDate(); // current Shabbos Mevorchim only

    // Self-reporting closes one week after Shabbos Mevorchim (WWTC_REPORT_GRACE_DAYS).
    // After that the month is locked to the soldier; a teacher can still backfill it
    // with mark_tehillim2.php.
    if (!wwtcReportWindowOpen()) {
        $month = wwtcMonthForDate($date);
        wwtcError(
            'The time to enter your Tehillim' . ($month !== '' ? ' for ' . $month : '')
            . ' has closed — it was due a week after Shabbos Mevorchim. Ask your teacher to add it for you.',
            409
        );
    }

    $input = wwtcInput();
    $hasKap = array_key_exists('kapitlach', $input) || array_key_exists('kapitelach', $input);
    $hasMin = array_key_exists('minutes', $input);
    if (!$hasKap && !$hasMin) {
        wwtcError('Nothing to report.', 422);
    }
    // Kapitlach 0..150 (one Tehillim), minutes 0..770 (the teacher tool's cap).
    $kapitlach = wwtcClampReportKapitlach($input['kapitlach'] ?? $input['kapitelach'] ?? 0);
    $minutes = wwtcClampReportMinutes($input['minutes'] ?? 0);

    // The soldier's mission for this Shabbos Mevorchim, matched exactly as the
    // read side (wwtcKidMonths): priced on the ladder they were on as of this
    // SM, not a ladder they picked during the reporting week.
    $missionId = wwtcMissionIdAsOf($MASHPIA_DB, $kid, $date);
    if (!$missionId) {
        wwtcError('There is no Tehillim mission set for this Shabbos Mevorchim yet.', 409);
    }
    $tasksByGrid = wwtcMissionTasks($MASHPIA_DB, $missionId);

    $userId = (int) $kid['user_id'];
    // The grade line is enforced here, not in the browser. A direct call with
    // no flagConfirmed is refused. flagConfirmed saves a FLAGGED row and, unless
    // the config says flagged amounts count, does not write the counting mark.
    $quotaKap = isset($tasksByGrid[WWTC_GRID_KAPITELACH]) ? (int) $tasksByGrid[WWTC_GRID_KAPITELACH]['quantity'] : 0;
    $quotaMin = isset($tasksByGrid[WWTC_GRID_MINUTES]) ? (int) $tasksByGrid[WWTC_GRID_MINUTES]['quantity'] : 0;
    if (function_exists('wwtcReportQuotaFromEngine')) {
        $priced = wwtcReportQuotaFromEngine(
            $quotaKap,
            $quotaMin,
            function_exists('wwtcCustomLadderCell')
                ? wwtcCustomLadderCell(
                    wwtcActiveCustomLadderForUser($userId),
                    (string) ($kid['class_grade'] ?? ''),
                    wwtcMonthForDate((int) $date)
                )
                : null
        );
        $quotaKap = $priced['kapitlach'];
        $quotaMin = $priced['minutes'];
    }
    $prior = wwtcPriorMark($MASHPIA_DB, $userId, (int) $date);
    $effectiveKap = $hasKap ? $kapitlach : $prior['kapitlach'];
    $effectiveMin = $hasMin ? $minutes : $prior['minutes'];
    $plan = wwtcPlanReport(
        $effectiveKap,
        $effectiveMin,
        $quotaKap,
        $quotaMin,
        (string) ($kid['class_grade'] ?? ''),
        !empty($input['flagConfirmed'])
    );
    if ($plan['action'] === 'confirm') {
        $overCfg = wwtcOverEntryConfig();
        wwtcError((string) $overCfg['confirm'], 409, [
            'code' => 'over_entry',
            'threshold' => [
                'kapitlach' => $plan['line']['kapitlach'],
                'minutes' => $plan['line']['minutes'],
            ],
            'reasons' => $plan['reasons'],
        ]);
    }
    if ($plan['action'] === 'flag' && !$plan['writeMark'] && !wwtcFlagsReady()) {
        wwtcError('Flag review is not installed yet. Run api/sql/wwtc_flagged_entries.sql on mashpia.', 503);
    }

    $kidActor = [
        'type' => 'kid',
        'id' => $userId,
        'name' => trim(($kid['first'] ?? '') . ' ' . ($kid['last'] ?? '')),
    ];
    try {
        $MASHPIA_DB->beginTransaction();
        if ($plan['action'] === 'flag') {
            wwtcSaveFlaggedEntry($MASHPIA_DB, [
                'user_id' => $userId,
                'school_id' => (int) ($kid['school_id'] ?? 0),
                'class_id' => (int) ($kid['class_id'] ?? 0),
                'mark_date' => (int) $date,
                'campaign_year' => wwtcYear(),
                'month_name' => wwtcMonthForDate((int) $date),
                'grade' => $plan['line']['grade'],
                'school_name' => (string) ($kid['school_name'] ?? ''),
                'class_name' => trim((string) ($kid['class_grade'] ?? '') . (string) ($kid['class_sub'] ?? '')),
                'kid_name' => $kidActor['name'],
                'kapitlach' => $plan['kapitlach'],
                'minutes' => $plan['minutes'],
                'quota_kapitlach' => $quotaKap,
                'quota_minutes' => $quotaMin,
                'threshold_kapitlach' => (int) round((float) $plan['line']['kapitlach']),
                'threshold_minutes' => (int) round((float) $plan['line']['minutes']),
                'reasons' => $plan['reasons'],
                'prior_kapitlach' => $prior['kapitlach'],
                'prior_minutes' => $prior['minutes'],
                'prior_reported' => !empty($prior['reported']),
            ], $kidActor);
            if ($plan['writeMark']) {
                if (isset($tasksByGrid[WWTC_GRID_KAPITELACH])) {
                    wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_KAPITELACH], $plan['kapitlach'], true);
                }
                if (isset($tasksByGrid[WWTC_GRID_MINUTES])) {
                    wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_MINUTES], $plan['minutes'], false);
                }
            }
        } else {
            wwtcSupersedeOpenFlag($MASHPIA_DB, $userId, (int) $date, $kidActor);
            if ($hasKap && isset($tasksByGrid[WWTC_GRID_KAPITELACH])) {
                wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_KAPITELACH], $kapitlach, true);
            }
            if ($hasMin && isset($tasksByGrid[WWTC_GRID_MINUTES])) {
                wwtcApplyMark($MASHPIA_DB, $userId, $date, $tasksByGrid[WWTC_GRID_MINUTES], $minutes, false);
            }
        }
        $MASHPIA_DB->commit();
    } catch (\Throwable $e) {
        if ($MASHPIA_DB->inTransaction()) {
            $MASHPIA_DB->rollBack();
        }
        error_log('WWTC /me/report failed for user ' . $userId . ': ' . $e->getMessage());
        wwtcError('Could not save your report. Please try again.', 500);
    }

    // Counting marks feed the cached reports. A withheld flag does not.
    if ($plan['writeMark']) {
        wwtcAfterWrite();
    }

    $progress = wwtcKidProgress(wwtcKidByUserId($userId) ?: $kid);
    $exceptional = null;
    // The grade-line flag replaces the mashpia email. Inside the line, a
    // confirmed exceptional report still sends that note and still counts.
    if ($plan['action'] === 'save' && !empty($input['exceptionalConfirmed'])) {
        $progressQuotaKap = (int) ($progress['current']['quota'] ?? $quotaKap);
        $progressQuotaMin = (int) ($progress['current']['minutes'] ?? $quotaMin);
        $kapHigh = $progressQuotaKap > 0 && $kapitlach >= $progressQuotaKap * 3;
        $minHigh = $minutes >= 180 && ($progressQuotaMin <= 0 || $minutes > $progressQuotaMin);
        if ($kapHigh || $minHigh) {
            $exceptional = wwtcEmailExceptional($kid, $kapitlach, $minutes, $progressQuotaKap, $progressQuotaMin);
        }
    }
    if ($exceptional) {
        $progress['exceptional'] = $exceptional;
    }
    wwtcJson($progress);
}

function wwtcEmailExceptional(array $kid, int $kapitlach, int $minutes, int $quotaKap, int $quotaMin): array
{
    $to = function_exists('wwtcEnv') ? trim(wwtcEnv('WWTC_MASHPIA_EMAIL')) : '';
    $name = trim(($kid['first'] ?? '') . ' ' . ($kid['last'] ?? ''));
    $school = (string) ($kid['school_name'] ?? '');
    $body = "A chayol confirmed an unusually large Tehillim report.\n\n"
        . "Soldier: {$name}\nSchool: {$school}\n"
        . "Kapitlach entered: {$kapitlach} (quota {$quotaKap})\n"
        . "Minutes entered: {$minutes} (quota {$quotaMin})\n\n"
        . "The chayol said this is 100% correct. Please confirm with them.\n"
        . "If it is correct, celebrate. If not, the parents speak with the child and the entry is corrected in the system.\n"
        . "This note does not reject the report. The numbers are already saved.";
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        error_log('WWTC exceptional report (no WWTC_MASHPIA_EMAIL): ' . str_replace("\n", ' | ', $body));
        return ['emailed' => false, 'reason' => 'WWTC_MASHPIA_EMAIL is not set'];
    }
    $ok = @mail($to, 'Tehillim report to confirm', $body, 'Content-Type: text/plain; charset=UTF-8');
    if (!$ok) {
        error_log('WWTC exceptional report mail() failed for ' . $to);
        return ['emailed' => false, 'reason' => 'mail failed'];
    }
    return ['emailed' => true, 'reason' => null];
}

// A soldier chooses their own ladder (training plan). Writes user_tracks.track_id
// for the Tehillim subject; the mapping is ladder 5..12 -> track_id 8..1.
if (($method === 'PUT' || $method === 'POST') && $path === '/me/ladder') {
    $actor = wwtcRequireActor(['kid']);
    $kid = wwtcKidByUserId((int) $actor['id']);
    if (!$kid) {
        wwtcError('Soldier not found.', 404);
    }
    if (empty($kid['track_id'])) {
        wwtcError('You are not enrolled in the Tehillim Club yet — ask your teacher.', 409);
    }
    // A ladder change is always allowed; it takes effect from the NEXT Shabbos
    // Mevorchim (a change after this month's SM date is read as-of the next month —
    // wwtcTrackAsOf), so the current month's quota is never disturbed by it.

    $input = wwtcInput();
    $ladder = (int) ($input['ladder'] ?? 0);
    // Any ladder 5..12 is selectable regardless of grade (track_id = 15 - ladder).
    if ($ladder < 5 || $ladder > 12) {
        wwtcError("Choose a ladder between 5 and 12.", 422);
    }
    $schoolHidden = function_exists('wwtcHiddenLaddersForSchool')
        ? wwtcHiddenLaddersForSchool((int) ($kid['school_id'] ?? 0))
        : [];
    if ($schoolHidden && function_exists('wwtcLadderIsHidden') && wwtcLadderIsHidden($ladder, $schoolHidden)) {
        wwtcError('That ladder is turned off for your school.', 422);
    }
    $track = wwtcTrackFromLadder($ladder);

    // The target track must actually have a mission this month, or the soldier
    // would land on a ladder with no quota (e.g. tracks that aren't set up yet).
    $check = $MASHPIA_DB->prepare(
        'SELECT 1 FROM date_tasks_missions
          WHERE subject_id = ' . WWTC_SUBJECT_ID . '
            AND start_date = :d AND end_date = :d AND school_type_id = :st
            AND track_id = :track AND level = :lvl AND lang_id = :lang
          LIMIT 1'
    );
    $check->execute([
        ':d' => wwtcCurrentDate(), ':st' => (int) $kid['school_type_id'],
        ':track' => $track, ':lvl' => (int) $kid['level'], ':lang' => (int) $kid['lang_id'],
    ]);
    if (!$check->fetchColumn()) {
        wwtcError('That ladder isn’t available for you yet.', 422);
    }

    $stmt = $MASHPIA_DB->prepare(
        'UPDATE user_tracks SET track_id = :track
          WHERE user_id = :uid AND subject_id = ' . WWTC_SUBJECT_ID . ' AND enrolled = 1'
    );
    $stmt->execute([':track' => $track, ':uid' => (int) $kid['user_id']]);

    wwtcAfterWrite();

    wwtcJson(wwtcKidProgress(wwtcKidByUserId((int) $kid['user_id']) ?: $kid));
}
