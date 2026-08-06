<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/db_vivr.php';

$apply = in_array('--apply', $argv, true);
$conn = (new VIVRDatabase())->connect();

$sql = "
    SELECT c.id, c.email, c.first_name, c.last_name, c.phone, t.payload
    FROM customer c
    CROSS APPLY (
        SELECT TOP 1 tr.payload
        FROM [order] o
        INNER JOIN tracking tr ON tr.id_order = o.id
        WHERE o.id_customer = c.id
          AND tr.payload IS NOT NULL
          AND ISJSON(tr.payload) = 1
        ORDER BY tr.created_at DESC, tr.id DESC
    ) t
    WHERE c.deleted_at IS NULL
      AND (
          NULLIF(LTRIM(RTRIM(c.email)), '') IS NULL OR
          NULLIF(LTRIM(RTRIM(c.first_name)), '') IS NULL OR
          NULLIF(LTRIM(RTRIM(c.last_name)), '') IS NULL OR
          NULLIF(LTRIM(RTRIM(c.phone)), '') IS NULL
      )
";

$rows = $conn->query($sql)->fetchAll(PDO::FETCH_ASSOC);
$updates = [];

foreach ($rows as $row) {
    $payload = json_decode((string)$row['payload'], true);
    if (!is_array($payload)) {
        continue;
    }

    $customer = $payload['order']['customer'] ?? [];
    $shipping = $payload['order']['shippingAddress'] ?? [];
    $email = trim((string)($customer['email'] ?? $payload['order']['email'] ?? $payload['order']['contactEmail'] ?? ''));
    $firstName = trim((string)($customer['firstName'] ?? ''));
    $lastName = trim((string)($customer['lastName'] ?? ''));
    $phone = trim((string)($customer['phone'] ?? $shipping['phone'] ?? ''));

    $values = [
        'email' => trim((string)($row['email'] ?? '')) === '' ? $email : '',
        'first_name' => trim((string)($row['first_name'] ?? '')) === '' ? $firstName : '',
        'last_name' => trim((string)($row['last_name'] ?? '')) === '' ? $lastName : '',
        'phone' => trim((string)($row['phone'] ?? '')) === '' ? $phone : ''
    ];

    if (array_filter($values, static fn(string $value): bool => $value !== '')) {
        $updates[] = ['id' => (int)$row['id']] + $values;
    }
}

echo sprintf("Customers eligible for backfill: %d\n", count($updates));

if (!$apply) {
    echo "Dry run only. Run again with --apply to update the database.\n";
    exit;
}

$conn->beginTransaction();
try {
    $update = $conn->prepare("
        UPDATE customer
        SET email = COALESCE(NULLIF(email, ''), NULLIF(:email, '')),
            first_name = COALESCE(NULLIF(first_name, ''), NULLIF(:first_name, '')),
            last_name = COALESCE(NULLIF(last_name, ''), NULLIF(:last_name, '')),
            phone = COALESCE(NULLIF(phone, ''), NULLIF(:phone, ''))
        WHERE id = :id
    ");

    foreach ($updates as $values) {
        $update->execute($values);
    }

    $conn->commit();
    echo sprintf("Customers updated: %d\n", count($updates));
} catch (Throwable $error) {
    $conn->rollBack();
    fwrite(STDERR, "Backfill failed; transaction rolled back.\n");
    throw $error;
}
