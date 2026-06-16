<?php

// ======================================================
// DEBUG
// ======================================================

ini_set('display_errors', 1);
error_reporting(E_ALL);

// ======================================================
// HEADERS
// ======================================================

header('Content-Type: application/json');

// ======================================================
// DB
// ======================================================
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db_vivr.php';

try {

    // ======================================================
    // INPUT
    // ======================================================

    $raw = file_get_contents("php://input");
    $input = json_decode($raw, true);

    if (!$input) {
        throw new Exception("Invalid JSON payload");
    }

    $oms = $input['oms'] ?? null;
    $orderNumber = $input['orderNumber'] ?? null;
    $email = $input['email'] ?? null;
    $customer = $oms['order']['customer'] ?? null;

    if (!$oms || !$orderNumber) {
        throw new Exception("Missing OMS or orderNumber");
    }

    $db = new VIVRDatabase();
    $conn = $db->connect();

    // ======================================================
    // 1. UPSERT CUSTOMER
    // ======================================================

    $stmt = $conn->prepare("
        SELECT id FROM customer WHERE email = :email
    ");
    $stmt->execute(['email' => $email]);
    $customerRow = $stmt->fetch();

    if ($customerRow) {
        $customerId = $customerRow['id'];
    } else {

        $stmt = $conn->prepare("
            INSERT INTO customer (email, first_name, last_name)
            OUTPUT INSERTED.id
            VALUES (:email, :first_name, :last_name)
        ");

        $stmt->execute([
            'email' => $email,
            'first_name' => $customer['firstName'] ?? '',
            'last_name' => $customer['lastName'] ?? ''
        ]);

        $customerId = $stmt->fetchColumn();
    }

    // ======================================================
    // 2. UPSERT ORDER
    // ======================================================

    $stmt = $conn->prepare("
        SELECT id FROM [order]
        WHERE order_number = :order_number
    ");

    $stmt->execute([
        'order_number' => $orderNumber
    ]);

    $orderRow = $stmt->fetch();

    if ($orderRow) {
        $orderId = $orderRow['id'];
    } else {

        $stmt = $conn->prepare("
            INSERT INTO [order] (id_customer, order_number)
            OUTPUT INSERTED.id
            VALUES (:id_customer, :order_number)
        ");

        $stmt->execute([
            'id_customer' => $customerId,
            'order_number' => $orderNumber
        ]);

        $orderId = $stmt->fetchColumn();
    }

    // ======================================================
    // 3. INSERT TRACKING
    // ======================================================

    $stmt = $conn->prepare("
        INSERT INTO tracking
        (
            id_order,
            origin,
            payload,
            http_status,
            http_error,
            status
        )
        OUTPUT INSERTED.id, INSERTED.uid
        VALUES
        (
            :id_order,
            :origin,
            :payload,
            :http_status,
            :http_error,
            :status
        )
    ");

    $stmt->execute([
        'id_order' => $orderId,
        'origin' => $input['oring'] ?? null,
        'payload' => json_encode($oms),
        'http_status' => $input['httpCode'] ?? null,
        'http_error' => $input['error'] ?? null,
        'status' => 'ACTIVE'
    ]);

    $tracking = $stmt->fetch();

    // ======================================================
    // RESPONSE
    // ======================================================

    echo json_encode([
        'success' => true,
        'customerId' => $customerId,
        'orderId' => $orderId,
        'trackingId' => $tracking['id'] ?? null,
        'uid' => $tracking['uid'] ?? null
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}