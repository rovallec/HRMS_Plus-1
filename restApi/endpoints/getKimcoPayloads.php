<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

ini_set('display_errors', 1);
error_reporting(E_ALL);

try {

// =====================
    // LOAD ENV
    // =====================
    $envPath = __DIR__ . '/../config/.env';

    if (!file_exists($envPath)) {
        throw new Exception("Missing .env file");
    }

    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {

        $line = trim($line);

        if ($line === '' || $line[0] === '#') continue;
        if (!str_contains($line, '=')) continue;

        [$k, $v] = explode('=', $line, 2);
        putenv(trim($k) . '=' . trim($v));
    }

    // =====================
    // INPUT
    // =====================
    $raw = file_get_contents("php://input");
    $input = json_decode($raw, true);

    if (!$input) {
        throw new Exception("Invalid JSON input");
    }

    $oldJob = $input['oldJob'] ?? null;
    $newJob = $input['newJob'] ?? null;

    if (!$oldJob || !$newJob) {
        throw new Exception("oldJob and newJob are required");
    }

    // =====================
    // ENV VALIDATION
    // =====================
    $server   = getenv('DB_KIMCO_CASE');
    $database = getenv('DB_KIMCO_DATABSE'); // (mantengo tu typo para no romper runtime)
    $username = getenv('DB_KIMCO_USER');
    $password = getenv('DB_KIMCO_PASSWORD');

    if (!$server || !$database || !$username || !$password) {
        throw new Exception("Missing DB environment variables");
    }

    // =====================
    // DB CONNECTION (FORCED TCP - FIX SQL SERVER PIPE ISSUE)
    // =====================
    $conn = new PDO(
        "sqlsrv:Server=tcp:$server,1433;Database=$database",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]
    );

    // =====================
    // GET PAYLOAD STATEMENT (REUSED)
    // =====================
    $stmt = $conn->prepare("
        SELECT json_payload
        FROM kimco_raw
        WHERE job_id = :id
    ");

    // =====================
    // OLD PAYLOAD
    // =====================
    $stmt->execute(["id" => $oldJob]);
    $old = $stmt->fetch(PDO::FETCH_ASSOC);

    // =====================
    // NEW PAYLOAD
    // =====================
    $stmt->execute(["id" => $newJob]);
    $new = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$old || !$new) {
        throw new Exception("Payload not found for one or both jobs");
    }

    // =====================
    // JSON DECODE SAFE
    // =====================
    $oldPayload = json_decode($old['json_payload'], true);
    $newPayload = json_decode($new['json_payload'], true);

    if ($oldPayload === null || $newPayload === null) {
        throw new Exception("Invalid JSON inside payload column");
    }

    // =====================
    // RESPONSE
    // =====================
    echo json_encode([
        "success" => true,
        "data" => [
            "old" => $oldPayload,
            "new" => $newPayload
        ]
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}