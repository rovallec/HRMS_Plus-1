<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db_vivr.php';

function respond(array $body, int $status = 200): void {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $uid = trim($input['token'] ?? '');
    $sessionToken = trim($input['sessionToken'] ?? '');
    $email = trim($input['email'] ?? '');

    if (!$uid || !$sessionToken || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        respond(['success' => false, 'error' => 'Invalid request.'], 400);
    }

    $db = new VIVRDatabase();
    $conn = $db->connect();
    $conn->beginTransaction();
    $stmt = $conn->prepare("SELECT t.*, o.order_number FROM tracking t WITH (UPDLOCK, ROWLOCK) INNER JOIN [order] o ON o.id=t.id_order WHERE t.uid=:uid AND t.status='USED' AND t.created_at > DATEADD(HOUR,-24,GETDATE())");
    $stmt->execute(['uid' => $uid]);
    $tracking = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tracking || empty($tracking['access_session_hash']) || !hash_equals($tracking['access_session_hash'], hash('sha256', $sessionToken))) {
        $conn->rollBack();
        respond(['success' => false, 'error' => 'This access session is invalid or expired.'], 403);
    }
    if (!empty($tracking['payload'])) {
        $conn->rollBack();
        respond(['success' => true, 'payload' => json_decode($tracking['payload'], true), 'attemptsRemaining' => max(0, 2 - (int)$tracking['lookup_attempts'])]);
    }

    $attempts = (int)$tracking['lookup_attempts'];
    if ($attempts >= 2) {
        $conn->rollBack();
        respond(['success' => false, 'error' => 'The maximum number of attempts has been reached.', 'attemptsRemaining' => 0], 429);
    }

    $attempts++;
    $update = $conn->prepare('UPDATE tracking SET lookup_attempts=:attempts WHERE id=:id');
    $update->execute(['attempts' => $attempts, 'id' => $tracking['id']]);
    $conn->commit();

    $coleUrl = getenv('COLEHAAN_URL') ?: 'https://shop-csc-d.colehaan.com/api/vivr/v1/orders/lookup';
    $coleKey = getenv('COLEHAAN_API_KEY') ?: getenv('COLUS_APIKEY');
    if (!$coleKey) { throw new Exception('Cole Haan service is not configured.'); }

    $ch = curl_init($coleUrl);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'X-API-Key: '.$coleKey],
        CURLOPT_POSTFIELDS => json_encode(['orderNumber' => $tracking['order_number'], 'email' => $email])]);
    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $payload = json_decode((string)$response, true);
    $remaining = max(0, 2 - $attempts);

    if ($response === false || $httpCode < 200 || $httpCode >= 300 || !is_array($payload) || empty($payload['order'])) {
        $message = $remaining ? 'We could not find the order with that email address.' : 'The maximum number of attempts has been reached.';
        respond(['success' => false, 'error' => $message, 'attemptsRemaining' => $remaining], 422);
    }

    $save = $conn->prepare('UPDATE tracking SET payload=:payload, http_status=:http_status, http_error=NULL WHERE id=:id AND payload IS NULL');
    $save->execute(['payload' => json_encode($payload), 'http_status' => $httpCode, 'id' => $tracking['id']]);
    respond(['success' => true, 'payload' => $payload, 'attemptsRemaining' => $remaining]);
} catch (Throwable $e) {
    if (isset($conn) && $conn->inTransaction()) { $conn->rollBack(); }
    respond(['success' => false, 'error' => 'The order service is unavailable. Please try again.'], 500);
}
