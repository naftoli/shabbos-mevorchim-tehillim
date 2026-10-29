<?php

declare(strict_types=1);

require __DIR__ . '/../../api/commander-prompt.php';

function expect(bool $ok, string $message): void
{
    if ($ok) {
        return;
    }
    fwrite(STDERR, "FAIL: {$message}\n");
    exit(1);
}

$topics = wwtcKidTopics();
expect(count($topics) >= 10, 'kid question topics load from the sheet');

$prompt = wwtcCommanderInstructions([
    'name' => 'Mushky',
    'ladder' => 8,
    'ladderChoices' => [['ladder' => 8, 'kapitlach' => 22, 'minutes' => 40]],
    'answerSheet' => 'should not be copied',
    'greeting' => 'Hi Mushky.',
]);

expect(str_contains($prompt, 'your virtual commander'), 'names the commander');
expect(str_contains($prompt, 'Worldwide Tehillim Club'), 'names the club');
expect(str_contains($prompt, 'Tzivos Hashem made me!'), 'who made you, verbatim');
expect(str_contains($prompt, 'I can direct you how to do it!'), 'does not enter Tehillim');
expect(str_contains($prompt, 'I can only help with the Tehillim Club. What would you like to know about your Tehillim?'), 'strict off-topic line');
expect(str_contains($prompt, "I'm not sure about that one. Please ask your counselor or a grown-up."), 'counselor line');
expect(str_contains($prompt, 'kapitlach'), 'pronounces kapitlach');
expect(str_contains($prompt, 'Cheshvan'), 'pronounces Cheshvan');
expect(str_contains($prompt, 'Hatzlacha'), 'pronounces Hatzlacha');
expect(str_contains($prompt, 'Moshiach'), 'pronounces Moshiach');
expect(str_contains($prompt, 'Mevorchim'), 'pronounces Mevorchim');
expect(str_contains($prompt, 'Chodesh'), 'pronounces Chodesh');
expect(str_contains($prompt, 'Chassidus'), 'pronounces Chassidus');
expect(str_contains($prompt, 'Shabbos'), 'says Shabbos normally');
expect(str_contains($prompt, 'guttural'), 'explains the ches sound');
expect(str_contains($prompt, 'Mushky'), 'includes the child');
expect(str_contains($prompt, 'change_ladder'), 'documents the ladder tool');
expect(str_contains($prompt, 'get_my_progress'), 'documents the progress tool');
expect(!str_contains($prompt, 'should not be copied'), 'drops client answer sheets');
expect(!str_contains($prompt, 'Frierdiker'), 'does not teach unconfirmed history');
expect(!str_contains($prompt, 'Suggested answer'), 'does not leak sheet notes');
expect(str_contains($prompt, 'OFF TOPIC. Say only:'), 'homework and jokes are refused');

$payload = wwtcRealtimeSessionPayload(['name' => 'Mushky'], 'gpt-realtime-2.1', 'marin');
$session = $payload['session'];
expect($session['model'] === 'gpt-realtime-2.1', 'uses the realtime model');
expect($session['audio']['output']['voice'] === 'marin', 'sets a voice');
expect($session['audio']['input']['turn_detection']['type'] === 'server_vad', 'server VAD');
expect($session['audio']['input']['turn_detection']['interrupt_response'] === true, 'barge-in');
expect($session['audio']['input']['turn_detection']['create_response'] === false, 'gate before the model answers');
$names = array_column($session['tools'], 'name');
expect($names === ['change_ladder', 'get_my_progress'], 'only the two tools');
expect($payload['expires_after']['seconds'] === 600, 'short-lived token');

putenv('OPENAI_REALTIME_MODEL=gpt-realtime');
expect(wwtcRealtimeModel() === 'gpt-realtime', 'model can be pinned');
putenv('OPENAI_REALTIME_MODEL=');
putenv('OPENAI_REALTIME_VOICE=not-a-voice');
expect(wwtcRealtimeVoice() === 'marin', 'unknown voice falls back');
putenv('OPENAI_REALTIME_VOICE=cedar');
expect(wwtcRealtimeVoice() === 'cedar', 'known voice is kept');
putenv('OPENAI_API_KEY=sk-test-key-that-is-long-enough');
expect(wwtcOpenAiKey() === 'sk-test-key-that-is-long-enough', 'reads OPENAI_API_KEY');
expect(!str_contains(json_encode($payload), 'sk-test'), 'session payload has no API key');
putenv('OPENAI_API_KEY=');
expect(wwtcOpenAiKey() === '', 'missing key is empty');

echo "Commander prompt checks passed\n";
