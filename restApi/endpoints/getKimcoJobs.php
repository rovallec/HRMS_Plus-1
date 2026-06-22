<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

ini_set('display_errors', 0);
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
    // DB CONNECTION
    // =====================
    $conn = new PDO(
        "sqlsrv:Server=" . getenv('DB_KIMCO_CASE') .
        ";Database=" . getenv('DB_KIMCO_DATABSE'),
        getenv('DB_KIMCO_USER'),
        getenv('DB_KIMCO_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // =====================
    // GET JOBS
    // =====================
    $stmt = $conn->query("
        SELECT *
        FROM kimco_job
        ORDER BY id DESC
    ");

    $jobs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "data" => $jobs
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}