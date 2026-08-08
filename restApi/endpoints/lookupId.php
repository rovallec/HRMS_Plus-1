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
// METHOD VALIDATION
// =====================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    http_response_code(405);

    echo json_encode([
        "success" => false,
        "error" => "Method not allowed"
    ]);

    exit;
}


// =====================
// INPUT
// =====================
$raw = file_get_contents("php://input");
$input = json_decode($raw, true);


if (!is_array($input)) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "Invalid JSON"
    ]);

    exit;
}


$name = trim($input['name'] ?? '');
$timestamp = $input['timestamp'] ?? null;


// =====================
// INPUT VALIDATION
// =====================
if ($name === '') {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "Search item required"
    ]);

    exit;
}


if (!$timestamp) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "Timestamp required"
    ]);

    exit;
}


// =====================
// SECURITY / HMAC
// =====================
$secret = getenv('API_SECRET');


if (!$secret) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "API secret not configured"
    ]);

    exit;
}


$headers = getallheaders();

$clientSignature =
    $headers['X-SIGNATURE']
    ?? $headers['x-signature']
    ?? '';


// Must match Angular generateSignature(body)
//
// body:
// {
//     name,
//     timestamp
// }
//
// canonical:
// name=...&timestamp=...
//
$canonicalString =
    'name=' . $name .
    '&timestamp=' . $timestamp;


$expectedSignature = base64_encode(
    hash_hmac(
        'sha256',
        $canonicalString,
        $secret,
        true
    )
);


if ($clientSignature === '') {

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
        "error" => "Unauthorized"
    ]);

    exit;
}


// =====================
// ANTI REPLAY
// =====================
$maxSkew = 300000; // 5 minutes

$diff = abs(
    (time() * 1000) - (int)$timestamp
);


if ($diff > $maxSkew) {

    http_response_code(401);

    echo json_encode([
        "success" => false,
        "error" => "Request expired"
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
// LOOKUP
// =====================
try {

    $searchValue = '%' . $name . '%';

    $row = null;
    $type = null;


    // =====================
    // SEARCH BUILDING FIRST
    // =====================
    $stmt = $conn->prepare("
        SELECT TOP 1 id
        FROM buildings
        WHERE name LIKE :name
        ORDER BY
            CASE
                WHEN name = :exactName THEN 0
                ELSE 1
            END,
            name
    ");


    $stmt->execute([
        'name' => $searchValue,
        'exactName' => $name
    ]);


    $row = $stmt->fetch(PDO::FETCH_ASSOC);


    if ($row) {

        $type = 'building';

    } else {

        // =====================
        // SEARCH TENANT
        // =====================
        $stmt = $conn->prepare("
            SELECT TOP 1 id
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
            'name' => $searchValue,
            'exactName' => $name
        ]);


        $row = $stmt->fetch(PDO::FETCH_ASSOC);


        if ($row) {
            $type = 'tenant';
        }

    }

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Lookup failed"
    ]);

    exit;
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
            "id" => $row["id"],
            "type" => $type
        ]
    ]
]);