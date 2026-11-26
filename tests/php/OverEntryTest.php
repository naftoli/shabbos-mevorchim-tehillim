<?php

declare(strict_types=1);

// Over-entry flagging: the grade line, the confirm the API requires, the
// accept/remove result, and exclusion from totals / ranks / Perfect Platoon / medals.
// Run: php tests/php/OverEntryTest.php

require __DIR__ . '/../../api/overEntry.php';

$tests = 0;
$failures = 0;
function check(string $label, bool $cond): void
{
    global $tests, $failures;
    $tests++;
    if ($cond) {
        echo "ok   - $label\n";
    } else {
        $failures++;
        echo "FAIL - $label\n";
    }
}

$cfg = wwtcOverEntryConfig();
$confirm = "Are you sure this is correct? It will be flagged to your base commander and to HQ, and it's being sent in a duch to the Rebbe.";

check('config keeps the confirm sentence', ($cfg['confirm'] ?? '') === $confirm);
check('flagged reports do not count before review', empty($cfg['flaggedCountsBeforeReview']));
check('kapitlach multiple is 2', (int) ($cfg['kapitlachMultiple'] ?? 0) === 2);
check('Pre-1A ladder top is 46', (int) $cfg['grades']['pre1a']['ladderTopKapitlach'] === 46);
check('Pre-1A minutes cap is 170', (int) $cfg['grades']['pre1a']['minutes'] === 170);
check('12th grade ladder top is the whole Tehillim', (int) $cfg['grades']['12']['ladderTopKapitlach'] === 150);
check('12th grade minutes cap is 240', (int) $cfg['grades']['12']['minutes'] === 240);

check('Pre-1A spellings share a key', wwtcNormalizeGradeKey('Pre-1A') === 'pre1a');
check('1st maps to grade 1', wwtcNormalizeGradeKey('1st') === '1');

$line = wwtcOverEntryLine('pre1a', 2, 10);
check('Pre-1A quota 2 flags above 46', $line['kapitlach'] == 46);
check('Pre-1A minutes line is 170', $line['minutes'] == 170);

$held = wwtcPlanReport(150, 10, 2, 10, 'pre1a', false);
check('150 for Pre-1A without confirm does not write', $held['action'] === 'confirm' && $held['writeMark'] === false);
check('omitting confirm cannot skip the flag', $held['counts'] === false && in_array('kapitlach', $held['reasons'], true));

$flagged = wwtcPlanReport(150, 10, 2, 10, 'Pre-1A', true);
check('confirmed 150 is saved as flagged', $flagged['action'] === 'flag');
check('flagged 150 does not write the counting mark', $flagged['writeMark'] === false && $flagged['counts'] === false);

$exact = wwtcPlanReport(46, 10, 2, 10, 'pre1a', false);
check('exactly the grade line is a normal save', $exact['action'] === 'save' && $exact['writeMark'] === true);

$steep = wwtcPlanReport(92, 10, 46, 80, 'pre1a', true);
check('2× a ladder-top quota is not yet over', $steep['action'] === 'save');
$steepOver = wwtcPlanReport(93, 10, 46, 80, 'pre1a', false);
check('one past 2× the ladder-top quota must be confirmed', $steepOver['action'] === 'confirm' && $steepOver['line']['kapitlach'] == 92);

$minOk = wwtcPlanReport(2, 170, 2, 10, 'pre1a', false);
check('minutes sitting on the cap are saved', $minOk['action'] === 'save');
$minOver = wwtcPlanReport(2, 171, 2, 10, 'pre1a', true);
check('minutes past the cap are flagged', $minOver['action'] === 'flag' && in_array('minutes', $minOver['reasons'], true) && $minOver['writeMark'] === false);

$forced = wwtcPlanReport(3, 10, 2, 10, 'pre1a', true);
check('flagConfirmed cannot flag an amount inside the line', $forced['action'] === 'save' && $forced['writeMark'] === true);

$whole = wwtcPlanReport(150, 20, 150, 120, '12', false);
check('a 12th grader saying the whole Tehillim is inside the line', $whole['action'] === 'save');

check('the report cap is one Tehillim', wwtcReportKapitlachCap() === 150);
check('190 kapitlach are stored as 150', wwtcClampReportKapitlach(190) === 150);
check('a negative report is stored as 0', wwtcClampReportKapitlach(-3) === 0);
check('an amount past one Tehillim is clamped to 150', wwtcClampReportKapitlach(10000) === 150);
check('half kapitlach round half up', wwtcClampReportKapitlach(118.6) === 119);
check('minutes still cap at 770', wwtcClampReportMinutes(771) === 770);

$customMet = wwtcPlanReport(190, 187, 190, 187, '8', false);
check('typing 190 on a custom quota stores 150', $customMet['action'] === 'save' && $customMet['kapitlach'] === 150);
check('the custom kapitlach line is 2× the asked quota', (int) $customMet['line']['kapitlach'] === 380);
check('the custom minutes line is 2× the asked minutes', (int) $customMet['line']['minutes'] === 374);
$customMinOver = wwtcPlanReport(150, 375, 190, 187, '8', false);
check('one past 2× custom minutes must be confirmed', $customMinOver['action'] === 'confirm' && in_array('minutes', $customMinOver['reasons'], true));
$engineMin = wwtcPlanReport(40, 241, 40, 120, '8', false);
check('an engine 8th-grade minutes line is still 240', $engineMin['action'] === 'confirm' && (int) $engineMin['line']['minutes'] === 240);
$pre1aHigh = wwtcPlanReport(190, 10, 2, 10, 'pre1a', true);
check('a Pre-1A 190 is flagged at 150, the whole Tehillim', $pre1aHigh['action'] === 'flag' && $pre1aHigh['kapitlach'] === 150);

check('a flagged amount is excluded from totals', wwtcCountsInPublicTotals('flagged') === false);
check('an accepted amount counts', wwtcCountsInPublicTotals('accepted') === true);
check('an ordinary mark counts', wwtcCountsInPublicTotals(null) === true);
check('a removed amount does not count', wwtcCountsInPublicTotals('removed') === false);

check('totals keep the prior 0, not the flagged 150', wwtcCountedKapitlach(0, 150, 'flagged') === 0);
check('totals keep a prior 4 while 150 is flagged', wwtcCountedKapitlach(4, 150, 'flagged') === 4);
check('ranks use that same counted kapitlach', wwtcCountedKapitlach(0, 150, 'flagged') === 0);
check('a flagged 150 does not earn the mission or the medal', wwtcCountedKapitlach(0, 150, 'flagged') < 2);
check('the prior 4 still earns its own mission', wwtcCountedKapitlach(4, 150, 'flagged') >= 2);

$platoon = [
    ['counted' => 10, 'quota' => 10, 'flagged' => 0, 'status' => null],
    ['counted' => 0, 'quota' => 2, 'flagged' => 150, 'status' => 'flagged'],
];
$platoonMet = true;
foreach ($platoon as $s) {
    $said = wwtcCountedKapitlach((int) $s['counted'], (int) $s['flagged'], $s['status']);
    if ((int) $s['quota'] <= 0 || $said < (int) $s['quota']) {
        $platoonMet = false;
    }
}
check('Perfect Platoon ignores the flagged 150', $platoonMet === false);
$platoon[1] = ['counted' => 150, 'quota' => 2, 'flagged' => 150, 'status' => 'accepted'];
$platoonMet = true;
foreach ($platoon as $s) {
    $said = wwtcCountedKapitlach((int) $s['counted'], (int) $s['flagged'], $s['status']);
    if ((int) $s['quota'] <= 0 || $said < (int) $s['quota']) {
        $platoonMet = false;
    }
}
check('Perfect Platoon counts the amount after it is accepted', $platoonMet === true);

$actor = ['type' => 'admin', 'id' => 9, 'name' => 'HQ Command'];
$at = '2026-11-11T15:04:00+00:00';
$entry = [
    'status' => 'flagged',
    'kapitlach' => 150,
    'minutes' => 25,
    'prior_kapitlach' => 4,
    'prior_minutes' => 10,
    'prior_reported' => 1,
];
$accept = wwtcPlanReview($entry, 'accept', $actor, $at);
check('accept applies the flagged kapitlach', $accept['ok'] && $accept['applyKapitlach'] === 150 && $accept['publicKapitlach'] === 150);
check('accept counts', $accept['counts'] === true && $accept['status'] === 'accepted');
check('accept is logged with who and when', $accept['decision']['actor_name'] === 'HQ Command' && $accept['decision']['actor_id'] === 9 && $accept['decision']['created_at'] === $at && $accept['decision']['action'] === 'accepted');

$remove = wwtcPlanReview($entry, 'remove', $actor, $at);
check('remove restores the prior kapitlach', $remove['ok'] && $remove['applyKapitlach'] === 4 && $remove['publicKapitlach'] === 4);
check('remove does not count the flagged amount', $remove['counts'] === false && $remove['notCounted'] === false && $remove['status'] === 'removed');
check('remove is logged with who and when', $remove['decision']['actor_name'] === 'HQ Command' && $remove['decision']['action'] === 'removed' && $remove['decision']['created_at'] === $at);

$blank = $entry;
$blank['prior_reported'] = 0;
$blank['prior_kapitlach'] = 0;
$cleared = wwtcPlanReview($blank, 'remove', ['type' => 'admin', 'id' => 3, 'name' => 'Base Commander'], $at);
check('remove with no prior value leaves the month not counted', $cleared['applyKapitlach'] === 0 && $cleared['notCounted'] === true && $cleared['publicKapitlach'] === 0);

$again = wwtcPlanReview(['status' => 'accepted', 'kapitlach' => 150], 'accept', $actor, $at);
check('a reviewed entry cannot be accepted twice', $again['ok'] === false);

$accepted = $entry;
$accepted['status'] = 'accepted';
$undo = wwtcPlanReview($accepted, 'remove', $actor, $at);
check('an accepted entry can be removed', $undo['ok'] === true && $undo['status'] === 'removed' && $undo['applyKapitlach'] === 4 && $undo['applyMinutes'] === 10);
check('removing an accepted entry restores the prior mark and is logged', $undo['counts'] === false && $undo['notCounted'] === false && $undo['decision']['action'] === 'removed' && $undo['decision']['actor_name'] === 'HQ Command');

$removed = $entry;
$removed['status'] = 'removed';
$redo = wwtcPlanReview($removed, 'accept', $actor, $at);
check('a removed entry can be accepted', $redo['ok'] === true && $redo['status'] === 'accepted' && $redo['applyKapitlach'] === 150 && $redo['applyMinutes'] === 25);
check('accepting a removed entry counts the flagged numbers and is logged', $redo['counts'] === true && $redo['publicKapitlach'] === 150 && $redo['decision']['action'] === 'accepted' && $redo['decision']['created_at'] === $at);

$removedTwice = wwtcPlanReview($removed, 'remove', $actor, $at);
check('a removed entry cannot be removed twice', $removedTwice['ok'] === false);

$blankAccepted = $blank;
$blankAccepted['status'] = 'accepted';
$clearAccepted = wwtcPlanReview($blankAccepted, 'remove', $actor, $at);
check('removing an accepted entry with no prior value clears the month', $clearAccepted['ok'] === true && $clearAccepted['applyKapitlach'] === 0 && $clearAccepted['notCounted'] === true);

$flags = file_get_contents(__DIR__ . '/../../api/flags.php');
check('stored review re-plans inside the transaction', is_string($flags) && strpos($flags, 'wwtcPlanReview($fresh') !== false);
check('stored review no longer refuses every non-flagged row', is_string($flags) && strpos($flags, "['status'] !== 'flagged'") === false);
check('stored review still applies the mark, logs the decision, and flushes the file cache', is_string($flags) && strpos($flags, 'wwtcApplyMark') !== false && strpos($flags, 'wwtcInsertFlagDecision') !== false && strpos($flags, 'wwtcAfterWrite') !== false);
check('flag review no longer bumps Redis', is_string($flags) && strpos($flags, 'Cache::bumpVersion') === false);

$index = file_get_contents(__DIR__ . '/../../api/index.php');
$board = file_get_contents(__DIR__ . '/../../api/campaignBoard.php');
$soldier = file_get_contents(__DIR__ . '/../../api/routes/soldier.php');
$admin = file_get_contents(__DIR__ . '/../../api/routes/admin.php');
$reports = file_get_contents(__DIR__ . '/../../api/routes/reports.php');
$public = file_get_contents(__DIR__ . '/../../api/routes/public.php');
$bootstrap = file_get_contents(__DIR__ . '/../../api/bootstrap.php');
$apiPhp = $index . $board . $soldier . $admin . $reports . $public . $flags;
check('the flag route still accepts and removes, including a reversal', is_string($admin) && strpos($admin, '#^/admin/flags/(\d+)/(accept|remove)$#') !== false);
check('top base rank keys are pctMet first, then the existing tie-breakers', is_string($board) && strpos($board, "return ['pctMet', 'saidMonth', 'pct', 'minutesPct'];") !== false && strpos($board, 'wwtcBaseRankKeys()') !== false);
check('self-report writes the as-of ladder, not today\'s track_id', is_string($soldier) && strpos($soldier, 'wwtcMissionIdAsOf') !== false);
check('self-report clamps kapitlach through the one-Tehillim helper', is_string($soldier) && strpos($soldier, 'wwtcClampReportKapitlach') !== false);
check('self-report prices over-entry on the custom-ladder quota', is_string($soldier) && strpos($soldier, 'wwtcReportQuotaFromEngine') !== false);
check('flag review looks up tasks on the as-of ladder', is_string($flags) && strpos($flags, 'wwtcMissionIdAsOf') !== false);
check('writes flush the file cache, not Redis', is_string($soldier) && strpos($soldier, 'wwtcAfterWrite()') !== false && strpos($apiPhp, 'Cache::bumpVersion') === false);
check('not-completed is scoped to the admin\'s school', is_string($reports) && preg_match('/not-completed[\s\S]{0,500}wwtcRequireSchoolAdmin/', $reports) === 1);
check('month names accept a historical year', is_string($bootstrap) && strpos($bootstrap, 'function wwtcMonthForDate(int $jd, ?int $year = null)') !== false);
check('reports pass the year into the month helper', is_string($public) && strpos($public, 'wwtcMonthForDate($current, $year)') !== false);
check('the router loads the split route files', is_string($index) && strpos($index, '/routes/admin.php') !== false);

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
