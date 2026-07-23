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

    $conn->beginTransaction();
    $stmt = $conn->prepare("
SELECT t.*, o.order_number
FROM tracking t WITH (UPDLOCK, ROWLOCK)
INNER JOIN [order] o ON o.id = t.id_order
WHERE t.uid = :uid
  AND t.status = 'ACTIVE'
  AND t.created_at > DATEADD(HOUR, -24, GETDATE())
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

        $conn->rollBack();
        exit;

    }

    // ======================================================
    // 2. DECODE PAYLOAD
    // ======================================================

    $payload = !empty($tracking['payload']) ? json_decode($tracking['payload'], true) : null;
    $sessionToken = bin2hex(random_bytes(32));
    $sessionHash = hash('sha256', $sessionToken);

    // ======================================================
    // 3. MARK AS USED (SINGLE USE CONSUMPTION)
    // ======================================================

    $update = $conn->prepare("
        UPDATE tracking
        SET status = 'USED', access_session_hash = :session_hash
        WHERE uid = :uid
    ");

    $update->execute([
        'uid' => $uid,
        'session_hash' => $sessionHash
    ]);
    $conn->commit();

    // ======================================================
    // 4. RESPONSE
    // ======================================================

    echo json_encode([
        'success' => true,
        'payload' => $payload,
        'orderNumber' => $tracking['order_number'],
        'sessionToken' => $sessionToken,
        'attemptsRemaining' => max(0, 2 - (int)($tracking['lookup_attempts'] ?? 0)),
        'canChangeOrderNumber' => !(bool)($tracking['order_number_changed'] ?? false),
        'tracking' => [
            'uid' => $tracking['uid'],
            'status' => 'USED',
            'created_at' => $tracking['created_at']
        ]
    ]);

} catch (Exception $e) {

    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);

}
