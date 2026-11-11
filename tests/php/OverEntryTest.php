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

check('a flagged amount is excluded from totals', wwtcCountsInPublicTotals('flagged') === false);
check('an accepted amount counts', wwtcCountsInPublicTotals('accepted') === true);
check('an ordinary mark counts', wwtcCountsInPublicTotals(null) === true);
check('a removed amount does not count', wwtcCountsInPublicTotals('removed') === false);

check('totals keep the prior 0, not the flagged 150', wwtcCountedKapitlach(0, 150, 'flagged') === 0);
check('totals keep a prior 4 while 150 is flagged', wwtcCountedKapitlach(4, 150, 'flagged') === 4);
check('ranks use that same counted kapitlach', wwtcCountedKapitlach(0, 150, 'flagged') === 0);
check('a flagged 150 does not earn the mission or the medal', wwtcMissionEarned(0, 2, 150, 'flagged') === false);
check('the prior 4 still earns its own mission', wwtcMissionEarned(4, 2, 150, 'flagged') === true);

$platoon = [
    ['counted' => 10, 'quota' => 10, 'flagged' => 0, 'status' => null],
    ['counted' => 0, 'quota' => 2, 'flagged' => 150, 'status' => 'flagged'],
];
check('Perfect Platoon ignores the flagged 150', wwtcPlatoonIsPerfect($platoon) === false);
$platoon[1] = ['counted' => 150, 'quota' => 2, 'flagged' => 150, 'status' => 'accepted'];
check('Perfect Platoon counts the amount after it is accepted', wwtcPlatoonIsPerfect($platoon) === true);

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
check('stored review still applies the mark, logs the decision, and bumps the cache', is_string($flags) && strpos($flags, 'wwtcApplyMark') !== false && strpos($flags, 'wwtcInsertFlagDecision') !== false && strpos($flags, "Cache::bumpVersion('shabbos_mevorchim:v')") !== false);

$route = file_get_contents(__DIR__ . '/../../api/index.php');
check('the flag route still accepts and removes, including a reversal', is_string($route) && strpos($route, '#^/admin/flags/(\d+)/(accept|remove)$#') !== false);
check('top base rank keys are pctMet first, then the existing tie-breakers', is_string($route) && strpos($route, "return ['pctMet', 'saidMonth', 'pct', 'minutesPct'];") !== false && strpos($route, 'wwtcBaseRankKeys()') !== false);

echo "\n$tests checks, $failures failing\n";
exit($failures === 0 ? 0 : 1);
