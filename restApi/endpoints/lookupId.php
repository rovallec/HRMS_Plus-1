<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");


// =====================
// CORS PRE-FLIGHT
// =====================
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}


// =====================
// SAFE MODE
// =====================
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);


// =====================
// ENV LOADER
// =====================
$envPath = __DIR__ . '/../config/.env';

if (!file_exists($envPath)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Missing .env"
    ]);

    exit;
}


foreach (
    file(
        $envPath,
        FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES
    ) as $line
) {

    $line = trim($line);

    if ($line === '' || substr($line, 0, 1) === '#') {
        continue;
    }

    if (!str_contains($line, '=')) {
        continue;
    }

    [$k, $v] = explode('=', $line, 2);

    putenv(trim($k) . '=' . trim($v));
}


// =====================
// INPUT
// =====================
$name = trim($_GET['name'] ?? '');


if ($name === '') {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "name required"
    ]);

    exit;
}


// =====================
// DB CONNECTION
// =====================
try {

    $conn = new PDO(
        "sqlsrv:Server=" . getenv('DB_KIMCO_CASE') .
        ";Database=" . getenv('DB_KIMCO_DATABSE'),
        getenv('DB_KIMCO_USER'),
        getenv('DB_KIMCO_PASSWORD'),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        ]
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
// SEARCH BUILDING
// =====================
try {

    $searchValue = '%' . $name . '%';

    $stmt = $conn->prepare("
        SELECT TOP 1
            zendesk_id,
            building_name
        FROM buildings
        WHERE building_name LIKE :name
        ORDER BY
            CASE
                WHEN building_name = :exactName THEN 0
                ELSE 1
            END,
            building_name
    ");

    $stmt->execute([
        "name" => $searchValue,
        "exactName" => $name
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);


    if ($row) {

        echo json_encode([
            "success" => true,
            "data" => [
                "res" => [
                    "id" => $row["zendesk_id"],
                    "type" => "building",
                    "name" => $row["building_name"]
                ]
            ]
        ]);

        exit;
    }

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Building lookup failed",
        "message" => $e->getMessage()
    ]);

    exit;
}


// =====================
// SEARCH TENANT
// =====================
try {

    $stmt = $conn->prepare("
        SELECT TOP 1
            zendesk_id,
            dba
        FROM tenants
        WHERE dba LIKE :name
        ORDER BY
            CASE
                WHEN dba = :exactName THEN 0
                ELSE 1
            END,
            dba
    ");

    $stmt->execute([
        "name" => $searchValue,
        "exactName" => $name
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);


    if ($row) {

        echo json_encode([
            "success" => true,
            "data" => [
                "res" => [
                    "id" => $row["zendesk_id"],
                    "type" => "tenant",
                    "name" => $row["dba"]
                ]
            ]
        ]);

        exit;
    }

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Tenant lookup failed",
        "message" => $e->getMessage()
    ]);

    exit;
}


// =====================
// NOT FOUND
// =====================
echo json_encode([
    "success" => true,
    "data" => [
        "res" => null
    ]
]);