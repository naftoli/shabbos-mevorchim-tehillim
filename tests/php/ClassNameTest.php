<?php

declare(strict_types=1);

// Display names only. Run: php tests/php/ClassNameTest.php

require __DIR__ . '/../../api/className.php';
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

check('1 Aleph Aleph drops the number', wwtcFormatClassName('1 Aleph Aleph') === 'Aleph Aleph');
check('1 Aleph Bet drops the number', wwtcFormatClassName('1 Aleph Bet') === 'Aleph Bet');
check('2 Bet Bet drops the number', wwtcFormatClassName('2 Bet Bet') === 'Bet Bet');
check('2 Bet Gimmel keeps both letters', wwtcFormatClassName('2 Bet Gimmel') === 'Bet Gimmel');
check('8 Ches Yud drops the number', wwtcFormatClassName('8 Ches Yud') === 'Ches Yud');

check('alef spelling', wwtcFormatClassName('1 alef Aleph') === 'alef Aleph');
check('BEIS spelling', wwtcFormatClassName('2 BEIS Bet') === 'BEIS Bet');
check('bais spelling', wwtcFormatClassName('2 bais Gimmel') === 'bais Gimmel');
check('Gimel spelling', wwtcFormatClassName('3 Gimel Dalet') === 'Gimel Dalet');
check('Daled spelling', wwtcFormatClassName('4 Daled Hei') === 'Daled Hei');
check('Hey spelling', wwtcFormatClassName('5 Hey Vav') === 'Hey Vav');
check('Vav grade', wwtcFormatClassName('6 Vav Zayin') === 'Vav Zayin');
check('Zayin grade', wwtcFormatClassName('7 Zayin Ches') === 'Zayin Ches');
check('Chet spelling', wwtcFormatClassName('8 Chet Tes') === 'Chet Tes');
check('Hebrew aleph', wwtcFormatClassName('1 א א') === 'א א');
check('Hebrew geresh apostrophe', wwtcFormatClassName("1 א' ב'") === "א' ב'");
check('Hebrew geresh', wwtcFormatClassName('1 א׳ ב׳') === 'א׳ ב׳');
check('Hebrew bet', wwtcFormatClassName('2 ב׳ ג') === 'ב׳ ג');
check('Hebrew ches', wwtcFormatClassName('8 ח ט') === 'ח ט');
check('hyphenated section', wwtcFormatClassName('1 Aleph-Bet') === 'Aleph-Bet');
check('hyphen after the number', wwtcFormatClassName('1-Aleph-Aleph') === 'Aleph-Aleph');

check('Pre-1A stays', wwtcFormatClassName('Pre-1A') === 'Pre-1A');
check('Pre-1A A stays', wwtcFormatClassName('Pre-1A A') === 'Pre-1A A');
check('Kindergarten stays', wwtcFormatClassName('Kindergarten') === 'Kindergarten');
check('1st Grade stays', wwtcFormatClassName('1st Grade A') === '1st Grade A');
check('4-boys stays', wwtcFormatClassName('4-boys') === '4-boys');
check('4-Boys stays', wwtcFormatClassName('4-Boys') === '4-Boys');
check('5-B stays', wwtcFormatClassName('5-B') === '5-B');
check('5A stays', wwtcFormatClassName('5A') === '5A');
check('1 Boys stays', wwtcFormatClassName('1 Boys') === '1 Boys');
check('mismatched grade stays', wwtcFormatClassName('1 Bet Aleph') === '1 Bet Aleph');
check('grade 9 stays', wwtcFormatClassName('9 Tes Tes') === '9 Tes Tes');
check('already short stays', wwtcFormatClassName('Aleph Aleph') === 'Aleph Aleph');
check('empty stays empty', wwtcFormatClassName('') === '');
check('null stays empty', wwtcFormatClassName(null) === '');

$hebrew = wwtcDisplayClassName('1 א׳ ב׳');
check('Hebrew plain text is isolated', $hebrew === "\u{2068}א׳ ב׳\u{2069}");
check('isolation is not doubled', wwtcDisplayClassName($hebrew) === $hebrew);
check('English plain text is not isolated', wwtcDisplayClassName('1 Aleph Bet') === 'Aleph Bet');

$row = wwtcPresentClassLabel([
    'id' => 9,
    'name' => '1 Aleph Bet',
    'className' => '2 Bet Gimmel',
    'grade' => '1',
]);
check('present label shortens name', $row['name'] === 'Aleph Bet');
check('present label shortens className', $row['className'] === 'Bet Gimmel');
check('present label leaves the grade key', $row['grade'] === '1');
check('present label leaves the id', $row['id'] === 9);

$schools = [
    1 => [
        'name' => 'Sample',
        'classes' => [[
            'id' => 9,
            'name' => '1 Aleph Bet',
            'students' => [['name' => 'Ahrele', 'quota' => 4, 'said' => 4]],
        ]],
    ],
];
$built = wwtcNotifyRecipientsFromRows([[
    'auth' => 'class',
    'admin_id' => 4,
    'first' => 'Teacher',
    'last' => '',
    'class_id' => 9,
    'class_grade' => '1 Aleph',
    'class_sub' => 'Bet',
    'class_school_id' => 1,
    'class_school_name' => 'Sample',
    'admin_phone_mobile' => '+15555550100',
]], [1]);
check('recipient label drops the number', ($built[0]['className'] ?? '') === 'Aleph-Bet');
$recipient = $built[0];
$report = wwtcNotifyComposeReport($recipient, $schools, 'Cheshvan', 5786, 'https://example/login', 'January 1, 2027');
check('SMS and PDF line uses the short name', ($report['classLines'][0] ?? '') === 'Class Aleph Bet: 1 of 1');
$split = wwtcNotCompletedClasses(
    [
        ['classId' => 9, 'className' => '1 Aleph Bet', 'name' => 'Short', 'said' => 2, 'quota' => 8],
        ['classId' => 9, 'className' => '1 Aleph Bet', 'name' => 'Zero', 'said' => 0, 'quota' => 8],
        ['classId' => 10, 'className' => '2 Bet Gimmel', 'name' => 'Done', 'said' => 8, 'quota' => 8],
    ],
    [['id' => 9, 'size' => 4], ['id' => 10, 'size' => 1]]
);
check('under and notFilled use the short class name', count($split) === 1 && $split[0]['className'] === 'Aleph Bet');
check('under group keeps the short kid', $split[0]['under'] === ['Short']);
check('notFilled group keeps the missing kid', $split[0]['notFilled'] === ['Zero']);
$pdf = '';
foreach ($report['pdfLines'] as $line) {
    $pdf .= $line['text'] . "\n";
}
check('PDF text uses the short name', strpos($pdf, 'Class Aleph Bet: 1 of 1') !== false);
check('PDF does not keep the leading number', strpos($pdf, '1 Aleph') === false);

$hebrewSchools = [
    1 => [
        'name' => 'Sample',
        'classes' => [[
            'id' => 10,
            'name' => '2 ב׳ ב׳',
            'students' => [['name' => 'Mushka', 'quota' => 2, 'said' => 0]],
        ]],
    ],
];
$hebrewRecipient = wwtcNotifyRecipient(5, 'Teacher', 'class', 1, 'Sample', 10, '2 ב׳ ב׳', '', '');
$hebrewReport = wwtcNotifyComposeReport($hebrewRecipient, $hebrewSchools, 'Cheshvan', 5786, 'https://example/login', 'January 1, 2027');
$hebrewLine = $hebrewReport['classLines'][0] ?? '';
check('WhatsApp class line isolates Hebrew', strpos($hebrewLine, "\u{2068}ב׳ ב׳\u{2069}") !== false);
check('WhatsApp class line dropped the number', strpos($hebrewLine, '2 ') === false);
$hebrewClass = $hebrewReport['incompleteLines'][0] ?? '';
check('Class: line uses the short Hebrew name', $hebrewClass === 'Class: ' . "\u{2068}ב׳ ב׳\u{2069}");
$hebrewPdf = '';
foreach ($hebrewReport['pdfLines'] as $line) {
    $hebrewPdf .= $line['text'] . "\n";
}
check('PDF Class: line uses the short Hebrew name', strpos($hebrewPdf, 'Class: ' . "\u{2068}ב׳ ב׳\u{2069}") !== false);

exit($failed > 0 ? 1 : 0);
