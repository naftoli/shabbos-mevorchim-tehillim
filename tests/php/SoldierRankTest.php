<?php

declare(strict_types=1);

// The personal page must show the soldier's Tzivos Hashem rank (highest
// rank_marks row), not a label guessed from Tehillim medals.
//
// Run: php tests/php/SoldierRankTest.php

require __DIR__ . '/../../api/soldierRank.php';

final class RankStmt
{
    private $pdo;
    private $sql;
    public function __construct($pdo, string $sql)
    {
        $this->pdo = $pdo;
        $this->sql = $sql;
    }
    public function execute($params = [])
    {
        $this->pdo->lastSql = preg_replace('/\s+/', ' ', trim($this->sql));
        $this->pdo->lastParams = $params;
        return true;
    }
    public function fetchColumn($i = 0)
    {
        return $this->pdo->name;
    }
}

final class RankPDO extends PDO
{
    public $name = false;
    public $lastSql = '';
    public $lastParams = [];
    public function __construct() {}
    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = [])
    {
        return new RankStmt($this, (string) $sql);
    }
}

$failures = 0;
function expect(bool $ok, string $message): void
{
    global $failures;
    if ($ok) {
        echo "ok   - $message\n";
        return;
    }
    $failures++;
    fwrite(STDERR, "FAIL - $message\n");
}

$db = new RankPDO();
$db->name = '5* General';
$rank = wwtcCurrentRank($db, 56037);
expect($rank === '5* General', 'returns the highest rank name');
expect(strpos($db->lastSql, 'ORDER BY rm.rank_ord DESC') !== false, 'picks the highest rank_ord, not the first row');
expect(strpos($db->lastSql, 'LIMIT 1') !== false, 'reads a single rank');
expect(($db->lastParams[':uid'] ?? null) === 56037, 'looks up the signed-in soldier');

$db->name = '  5* General  ';
expect(wwtcCurrentRank($db, 1) === '5* General', 'trims the rank name');

$db->name = false;
expect(wwtcCurrentRank($db, 1) === null, 'no rank_marks row yields no label');

$db->name = '   ';
expect(wwtcCurrentRank($db, 1) === null, 'a blank rank name yields no label');

if ($failures > 0) {
    exit(1);
}
echo "ok   - soldier rank\n";
