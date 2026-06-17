<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: http://localhost:4200");
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
    echo json_encode(["success" => false, "error" => "Missing .env"]);
    exit;
}

foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {

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
    echo json_encode(["success" => false, "error" => "Invalid JSON"]);
    exit;
}

$buildingId = $input['buildingId'] ?? null;
$tenantId   = $input['tenantId'] ?? null;
$timestamp  = $input['timestamp'] ?? null;

if (!$buildingId) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "buildingId required"]);
    exit;
}

// =====================
// SECURITY (HMAC FIXED CANONICAL STRING)
// =====================
$secret = getenv('API_SECRET');

$headers = getallheaders();
$clientSignature = $headers['X-SIGNATURE'] ?? '';

// 🔥 EXACT SAME STRING AS ANGULAR
$canonicalString =
    'buildingId=' . ($buildingId ?? '') . '&' .
    'tenantId=' . ($tenantId ?? '') . '&' .
    'timestamp=' . ($timestamp ?? '');

$expectedSignature = base64_encode(
    hash_hmac('sha256', $canonicalString, $secret, true)
);

// DEBUG (optional)
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

    $maxSkew = 300000; // 5 min
    $diff = abs((time() * 1000) - $timestamp);

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
// BUILDING
// =====================
$buildingRow = null;

try {

    $stmt = $conn->prepare("
        SELECT TOP 1 id, building_name, city, state
        FROM buildings
        WHERE zendesk_id = :id
    ");

    $stmt->execute(["id" => $buildingId]);
    $buildingRow = $stmt->fetch(PDO::FETCH_ASSOC);

} catch (Exception $e) {
    $buildingRow = null;
}

if (!$buildingRow) {

    echo json_encode([
        "success" => true,
        "data" => [
            "building" => null,
            "tenant" => null,
            "lease_personnel" => [],
            "vendors" => [],
            "utility_providers" => [],
            "contacts" => [],
            "emergency_responders" => [],
            "building_notes" => []
        ]
    ]);
    exit;
}

$internalBuildingId = $buildingRow["id"];

$building = [
    "name" => $buildingRow["building_name"],
    "city" => $buildingRow["city"],
    "state" => $buildingRow["state"]
];

// =====================
// TENANT
// =====================
$tenant = null;

if ($tenantId) {

    $stmt = $conn->prepare("
        SELECT dba, unit_id, business_type1, business_type2, gla, lease_end_date
        FROM tenants
        WHERE zendesk_id = :id
    ");

    $stmt->execute(["id" => $tenantId]);
    $tenant = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

// =====================
// HELPERS
// =====================
function safeFetchAll($conn, $sql, $params = []) {
    try {
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        return [];
    }
}

// =====================
// MODULES
// =====================
$lease_personnel = safeFetchAll($conn, "
    WITH ranked AS (
        SELECT lp.name, lp.role, lp.email, lp.phone,
        ROW_NUMBER() OVER (PARTITION BY lp.role ORDER BY lp.name) rn
        FROM lease_personnel lp
        WHERE lp.building_id = :id
    )
    SELECT name, role, email, phone FROM ranked WHERE rn = 1
", ["id" => $internalBuildingId]);

$vendors = safeFetchAll($conn, "
    SELECT vendor_name, type, street, city, state, zip_code, phone_number, notes
    FROM vendors WHERE building_id = :id
", ["id" => $internalBuildingId]);

$utilities = safeFetchAll($conn, "
    SELECT up.utility_type, v.vendor_name, v.street, v.city, v.state, v.zip_code, v.phone_number, v.notes
    FROM utility_providers up
    INNER JOIN vendors v ON v.id = up.vendor_id
    WHERE up.building_id = :id
", ["id" => $internalBuildingId]);

$contacts = safeFetchAll($conn, "
    SELECT name, role, work_phone, mobile_phone, email
    FROM contacts WHERE building_id = :id
", ["id" => $internalBuildingId]);

$emergency = safeFetchAll($conn, "
    SELECT account_name, type, phone
    FROM emergency_responders WHERE building_id = :id
", ["id" => $internalBuildingId]);

$notes = safeFetchAll($conn, "
    SELECT title, description, last_updated
    FROM building_notes
    WHERE building_id = :id
    ORDER BY created_at DESC
", ["id" => $internalBuildingId]);

// =====================
// RESPONSE
// =====================
echo json_encode([
    "success" => true,
    "data" => [
        "building" => $building,
        "tenant" => $tenant,
        "lease_personnel" => $lease_personnel,
        "vendors" => $vendors,
        "utility_providers" => $utilities,
        "contacts" => $contacts,
        "emergency_responders" => $emergency,
        "building_notes" => $notes
    ]
]);