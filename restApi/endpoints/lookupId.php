<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-SIGNATURE");
header("Access-Control-Max-Age: 86400");


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

    if ($line === '' || substr($line, 0, 1) === '#') continue;
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
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "Invalid JSON"
    ]);

    exit;
}


$name = $input['name'] ?? null;
$timestamp = $input['timestamp'] ?? null;


if (!$name) {
    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "name required"
    ]);

    exit;
}


// =====================
// SECURITY
// HMAC FIXED CANONICAL STRING
// =====================
$secret = getenv('API_SECRET');


$headers = getallheaders();

$clientSignature =
    $headers['X-SIGNATURE']
    ?? $headers['x-signature']
    ?? '';


// EXACT SAME STRUCTURE AS ANGULAR
$canonicalString =
    'name=' . ($name ?? '') . '&' .
    'timestamp=' . ($timestamp ?? '');


$expectedSignature = base64_encode(
    hash_hmac(
        'sha256',
        $canonicalString,
        $secret,
        true
    )
);


// =====================
// SIGNATURE VALIDATION
// =====================
if (!$clientSignature) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "error" => "Missing signature"
    ]);

    exit;
}


if (!hash_equals($expectedSignature, $clientSignature)) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "error" => "Unauthorized",
        "debug_expected" => $expectedSignature,
        "debug_received" => $clientSignature,
        "debug_string" => $canonicalString
    ]);

    exit;
}


// =====================
// ANTI REPLAY
// =====================
if ($timestamp) {

    $maxSkew = 300000; // 5 minutes

    $diff = abs(
        (time() * 1000) - $timestamp
    );


    if ($diff > $maxSkew) {

        http_response_code(401);

        echo json_encode([
            "success" => false,
            "error" => "Request expired"
        ]);

        exit;
    }
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
// RESULT
// =====================
$row = null;
$type = null;

$searchValue = '%' . trim($name) . '%';


// =====================
// SEARCH BUILDING FIRST
// =====================
try {

    $stmt = $conn->prepare("
        SELECT TOP 1
            zendesk_id
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
        "exactName" => trim($name)
    ]);


    $row = $stmt->fetch(PDO::FETCH_ASSOC);


    if ($row) {
        $type = 'building';
    }

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Building lookup failed"
    ]);

    exit;
}


// =====================
// SEARCH TENANT
// Only if building was not found
// =====================
if (!$row) {

    try {

        $stmt = $conn->prepare("
            SELECT TOP 1
                zendesk_id
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
            "exactName" => trim($name)
        ]);


        $row = $stmt->fetch(PDO::FETCH_ASSOC);


        if ($row) {
            $type = 'tenant';
        }

    } catch (Exception $e) {

        http_response_code(500);

        echo json_encode([
            "success" => false,
            "error" => "Tenant lookup failed"
        ]);

        exit;
    }
}


// =====================
// NOT FOUND
// =====================
if (!$row) {

    echo json_encode([
        "success" => true,
        "data" => [
            "res" => null
        ]
    ]);

    exit;
}


// =====================
// RESPONSE
// =====================
echo json_encode([
    "success" => true,
    "data" => [
        "res" => [
            "id" => $row["zendesk_id"],
            "type" => $type
        ]
    ]
]);