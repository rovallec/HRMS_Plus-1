<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// =====================
// SAFE MODE
// =====================
ini_set('display_errors', 0);
error_reporting(E_ALL);

// =====================
// ENV
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
// INPUT
// =====================
$input = json_decode(file_get_contents("php://input"), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid JSON"]);
    exit;
}

$oldJob = $input['oldJob'] ?? null;
$newJob = $input['newJob'] ?? null;

if (!$oldJob || !$newJob) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "oldJob and newJob are required"
    ]);
    exit;
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
// FETCH PAYLOAD
// =====================
function getPayload($conn, $jobId)
{
    $sql = "

        SELECT TOP 1

            r.job_id,
            r.building_id,
            r.has_changed,
            r.payload,
            r.created_at,

            b.zendesk_id,
            b.building_sfid,
            b.building_name

        FROM kimco_raw r

        INNER JOIN buildings b
            ON b.id = r.building_id

        WHERE r.job_id = :job_id

        ORDER BY r.id DESC

    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute(["job_id" => $jobId]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) return null;

    return [
        "job_id" => (int)$row["job_id"],
        "building_id" => (int)$row["building_id"],
        "building_name" => $row["building_name"],
        "zendesk_id" => $row["zendesk_id"],
        "building_sfid" => $row["building_sfid"],
        "has_changed" => (int)$row["has_changed"],
        "created_at" => $row["created_at"],
        "payload" => json_decode($row["payload"], true)
    ];
}

// =====================
// RESULT
// =====================
$old = getPayload($conn, $oldJob);
$new = getPayload($conn, $newJob);

echo json_encode([
    "success" => true,
    "data" => [
        "old" => $old,
        "new" => $new
    ]
]);