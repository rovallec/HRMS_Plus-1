<?php

// ======================================================
// HEADERS
// ======================================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ======================================================
// DB
// ======================================================
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db_vivr.php';

try {

    $db = new VIVRDatabase();
    $conn = $db->connect();

    // ======================================================
    // INPUT
    // ======================================================

    $input = json_decode(file_get_contents("php://input"), true);
    $uid = $input['token'] ?? '';

    if (!$uid) {
        throw new Exception("Missing token");
    }

    // ======================================================
    // 1. GET VALID TRACKING
    // ======================================================

    $stmt = $conn->prepare("
SELECT *
FROM tracking
WHERE uid = :uid
  AND status = 'ACTIVE'
  AND created_at > DATEADD(HOUR, -24, GETDATE())
    ");

    $stmt->execute([
        'uid' => $uid
    ]);

    $tracking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tracking) {

        echo json_encode([
            'success' => false,
            'message' => 'Token expired or already used'
        ]);

        exit;

    }

    // ======================================================
    // 2. DECODE PAYLOAD
    // ======================================================

    $payload = json_decode($tracking['payload'], true);

    // ======================================================
    // 3. MARK AS USED (SINGLE USE CONSUMPTION)
    // ======================================================

    $update = $conn->prepare("
        UPDATE tracking
        SET status = 'USED'
        WHERE uid = :uid
    ");

    $update->execute([
        'uid' => $uid
    ]);

    // ======================================================
    // 4. RESPONSE
    // ======================================================

    echo json_encode([
        'success' => true,
        'payload' => $payload,
        'tracking' => [
            'uid' => $tracking['uid'],
            'status' => 'USED',
            'created_at' => $tracking['created_at']
        ]
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);

}