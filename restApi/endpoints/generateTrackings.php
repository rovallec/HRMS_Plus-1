<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/db_vivr.php';
require_once __DIR__ . '/../config/api_header.php';


try {

    // ======================================================
    // INPUT
    // ======================================================

    $order = $_GET['order'] ?? null;
    $email = $_GET['email'] ?? null;

    if (!$order || !$email) {
        throw new Exception("Missing order or email");
    }

    // ======================================================
    // DB CONNECTION
    // ======================================================

    $db = new VIVRDatabase();
    $conn = $db->connect();

    // ======================================================
    // GENERATE UID
    // ======================================================

$uid = sprintf(
    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    random_int(0, 0xffff),
    random_int(0, 0xffff),
    random_int(0, 0xffff),
    random_int(0, 0x0fff) | 0x4000,
    random_int(0, 0x3fff) | 0x8000,
    random_int(0, 0xffff),
    random_int(0, 0xffff),
    random_int(0, 0xffff)
);
    // ======================================================
    // INSERT TRACKING (MINIMAL TEST MODE)
    // ======================================================

    $stmt = $conn->prepare("
        INSERT INTO tracking
        (
            id_order,
            origin,
            uid,
            status,
            created_at
        )
        VALUES
        (
            :id_order,
            'PHONE',
            :uid,
            'ACTIVE',
            GETDATE()
        )
    ");

    $stmt->execute([
        'id_order' => $order,
        'uid' => $uid
    ]);

    // ======================================================
    // RESPONSE
    // ======================================================

    echo json_encode([
        'success' => true,
        'uid' => $uid,
        'order' => $order,
        'email' => $email,
        'link' => "http://localhost/customer/$uid"
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);

}