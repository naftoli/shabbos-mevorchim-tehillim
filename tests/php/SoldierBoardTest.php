<?php

declare(strict_types=1);

// Top Soldiers order: kapitlach, then name, and a limit applies after that
// sort so a tie isn't an arbitrary top-n.
//
// Run: php tests/php/SoldierBoardTest.php

require __DIR__ . '/../../api/soldierBoard.php';

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

$rows = [
    ['id' => 3, 'name' => 'Sholom Ber Goldshmid', 'saidMonth' => 150],
    ['id' => 1, 'name' => 'Ari Stell', 'saidMonth' => 150],
    ['id' => 4, 'name' => 'Zoe Adler', 'saidMonth' => 140],
    ['id' => 2, 'name' => 'Rivka Litvin', 'saidMonth' => 150],
];

$ordered = wwtcOrderSoldiers($rows);
check('higher kapitlach come first', $ordered[0]['saidMonth'] === 150 && $ordered[3]['name'] === 'Zoe Adler');
check(
    'a tie is alphabetical by name',
    array_column(array_slice($ordered, 0, 3), 'name') === ['Ari Stell', 'Rivka Litvin', 'Sholom Ber Goldshmid']
);

$top = wwtcOrderSoldiers($rows, 2);
check('limit slices after the name sort', count($top) === 2 && $top[0]['name'] === 'Ari Stell' && $top[1]['name'] === 'Rivka Litvin');

$same = [
    ['id' => 9, 'name' => 'Chana W.', 'saidMonth' => 74],
    ['id' => 2, 'name' => 'Chana W.', 'saidMonth' => 74],
];
$stable = wwtcOrderSoldiers($same);
check('identical names stay in id order', array_column($stable, 'id') === [2, 9]);

check('no limit returns every soldier', count(wwtcOrderSoldiers($rows)) === 4);
check('a zero limit returns nobody', wwtcOrderSoldiers($rows, 0) === []);

echo "\n$tests tests, $failures failed\n";
exit($failures ? 1 : 0);
