<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

// =====================
// SAFE MODE
// =====================
ini_set('display_errors', 0);
error_reporting(E_ALL);

// =====================
// ENV LOADER
// =====================
$envPath = __DIR__ . '/../config/.env';

if (!file_exists($envPath)) {
    echo json_encode(["success" => false, "error" => "Missing .env"]);
    exit;
}

foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {

    $line = trim($line);

    if ($line === '' || str_starts_with($line, '#')) continue;
    if (!str_contains($line, '=')) continue;

    [$k, $v] = explode('=', $line, 2);
    putenv(trim($k) . '=' . trim($v));
}

// =====================
// DB
// =====================
try {

    $conn = new PDO(
        "sqlsrv:Server=" . getenv('DB_KIMCO_CASE') .
        ";Database=" . getenv('DB_KIMCO_DATABSE'),
        getenv('DB_KIMCO_USER'),
        getenv('DB_KIMCO_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "DB connection failed"
    ]);

    exit;
}

// =====================
// QUERY JOBS
// =====================
// asumimos que kimco_raw es el source de truth de jobs
$sql = "

    SELECT

        r.job_id,
        r.building_id,
        b.building_name,
        b.zendesk_id,
        r.has_changed,
        MAX(r.created_at) AS last_run

    FROM kimco_raw r

    INNER JOIN buildings b
        ON b.id = r.building_id

    GROUP BY
        r.job_id,
        r.building_id,
        b.building_name,
        b.zendesk_id,
        r.has_changed

    ORDER BY last_run DESC

";

$stmt = $conn->query($sql);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$jobs = [];

foreach ($rows as $row) {

    $jobs[] = [
        "job_id" => (int)$row["job_id"],
        "building_id" => (int)$row["building_id"],
        "building_name" => $row["building_name"],
        "zendesk_id" => $row["zendesk_id"],
        "has_changed" => (int)$row["has_changed"],
        "last_run" => $row["last_run"]
    ];
}

echo json_encode([
    "success" => true,
    "data" => $jobs
]);