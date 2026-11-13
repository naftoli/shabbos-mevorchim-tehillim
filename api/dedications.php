<?php

declare(strict_types=1);

/**
 * Army and school dedications (wwtc_dedications). Helpers only; routes live
 * in routes/admin.php. GET /schools/:id also reads through these helpers.
 */

function wwtcDedicationsReady(): bool
{
    return wwtcColumnExists('wwtc_dedications', 'body');
}

function wwtcDedicationRead(string $scope, int $year, string $month, int $schoolId): ?array
{
    if (!wwtcDedicationsReady()) {
        return null;
    }
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        'SELECT body, campaign_year, month_name FROM wwtc_dedications
          WHERE scope = :s AND campaign_year = :y AND month_name = :m AND school_id = :id
          LIMIT 1'
    );
    $stmt->execute([':s' => $scope, ':y' => $year, ':m' => $month, ':id' => $schoolId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return null;
    }
    return ['text' => (string) $row['body'], 'year' => (int) $row['campaign_year'], 'month' => (string) $row['month_name']];
}
