<?php

/**
 * The soldier's Tzivos Hashem rank — the highest rank_marks row, the same
 * rank the rest of Mashpia shows. That count is every campaign's medals,
 * not Tehillim medals alone. A chayol with a handful of Tehillim medals can
 * already be a 5* General.
 */

function wwtcCurrentRank(PDO $db, int $userId): ?string
{
    $stmt = $db->prepare(
        'SELECT r.rank_name
           FROM rank_marks rm
           JOIN ranks r USING (rank_ord)
          WHERE rm.user_id = :uid
          ORDER BY rm.rank_ord DESC
          LIMIT 1'
    );
    $stmt->execute([':uid' => $userId]);
    $name = $stmt->fetchColumn();
    if (!is_string($name)) {
        return null;
    }
    $name = trim($name);
    return $name === '' ? null : $name;
}
