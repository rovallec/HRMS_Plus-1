<?php

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

// =====================================================
// SAFE ERROR HANDLING (CRÍTICO)
// =====================================================

ini_set('display_errors', 0);
error_reporting(0);

// =====================================================
// ENV LOADER
// =====================================================

$envPath = __DIR__ . '/../config/.env';

if (!file_exists($envPath)) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Missing .env file"
    ]);

    exit;
}

$lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

foreach ($lines as $line) {

    if (
        str_starts_with(trim($line), '#')
        || !str_contains($line, '=')
    ) {
        continue;
    }

    list($key, $value) = explode('=', $line, 2);

    putenv(trim($key) . '=' . trim($value));
}

// =====================================================
// DB CONNECTION (SQL SERVER)
// =====================================================

try {

    $server   = getenv('DB_KIMCO_CASE');
    $database = getenv('DB_KIMCO_DATABSE');
    $username = getenv('DB_KIMCO_USER');
    $password = getenv('DB_KIMCO_PASSWORD');

    $conn = new PDO(
        "sqlsrv:Server=$server;Database=$database",
        $username,
        $password
    );

    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "DB connection failed"
    ]);

    exit;
}

// =====================================================
// INPUT
// =====================================================

$buildingId = $_GET['buildingId'] ?? null;
$tenantId   = $_GET['tenantId'] ?? null;

if (!$buildingId) {

    http_response_code(400);

    echo json_encode([
        "success" => false,
        "error" => "buildingId required"
    ]);

    exit;
}

// =====================================================
// BUILDING (FIX COLUMN NAME ISSUE)
// =====================================================

$stmt = $conn->prepare("
    SELECT
        building_name,
        city,
        state
    FROM buildings
    WHERE zendesk_id = :id
");

$stmt->execute(["id" => $buildingId]);

$buildingRaw = $stmt->fetch(PDO::FETCH_ASSOC);

// safe mapping
$building = $buildingRaw ? [
    "name"  => $buildingRaw["building_name"] ?? null,
    "city"  => $buildingRaw["city"] ?? null,
    "state" => $buildingRaw["state"] ?? null
] : null;

// =====================================================
// TENANT
// =====================================================

$tenant = null;

if ($tenantId) {

    $stmt = $conn->prepare("
        SELECT
            tenant_name,
            unit_id
        FROM tenants
        WHERE zendesk_id = :id
    ");

    $stmt->execute(["id" => $tenantId]);

    $tenantRaw = $stmt->fetch(PDO::FETCH_ASSOC);

    $tenant = $tenantRaw ? [
        "name"    => $tenantRaw["tenant_name"] ?? null,
        "unit_id" => $tenantRaw["unit_id"] ?? null
    ] : null;
}

// =====================================================
// LEASE PERSONNEL
// =====================================================

$stmt = $conn->prepare("
    SELECT name, role
    FROM lease_personnel
    WHERE building_id = :id
");

$stmt->execute(["id" => $buildingId]);

$lease_personnel = $stmt->fetchAll(PDO::FETCH_ASSOC);

// =====================================================
// VENDORS
// =====================================================

$stmt = $conn->prepare("
    SELECT vendor_name, type
    FROM vendors
    WHERE building_id = :id
");

$stmt->execute(["id" => $buildingId]);

$vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

// =====================================================
// UTILITIES
// =====================================================

$stmt = $conn->prepare("
    SELECT utility_type, vendor_name
    FROM utility_providers
    WHERE building_id = :id
");

$stmt->execute(["id" => $buildingId]);

$utilities = $stmt->fetchAll(PDO::FETCH_ASSOC);

// =====================================================
// CONTACTS
// =====================================================

$stmt = $conn->prepare("
    SELECT name, role, phone
    FROM contacts
    WHERE building_id = :id
");

$stmt->execute(["id" => $buildingId]);

$contacts = $stmt->fetchAll(PDO::FETCH_ASSOC);

// =====================================================
// EMERGENCY RESPONDERS
// =====================================================

$stmt = $conn->prepare("
    SELECT name, type, phone
    FROM emergency_responders
    WHERE building_id = :id
");

$stmt->execute(["id" => $buildingId]);

$emergency = $stmt->fetchAll(PDO::FETCH_ASSOC);

// =====================================================
// BUILDING NOTES
// =====================================================

$stmt = $conn->prepare("
    SELECT title, note, created_by, created_at
    FROM building_notes
    WHERE building_id = :id
    ORDER BY created_at DESC
");

$stmt->execute(["id" => $buildingId]);

$notes = $stmt->fetchAll(PDO::FETCH_ASSOC);

// =====================================================
// FINAL RESPONSE (ALWAYS SAFE JSON)
// =====================================================

echo json_encode([

    "success" => true,

    "data" => [

        "building" => $building,
        "tenant"   => $tenant,

        "lease_personnel"      => $lease_personnel,
        "vendors"              => $vendors,
        "utility_providers"    => $utilities,

        "contacts"             => $contacts,
        "emergency_responders" => $emergency,

        "building_notes"       => $notes

    ]

]);