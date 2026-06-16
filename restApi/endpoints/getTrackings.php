<?php

header('Content-Type: application/json');
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db_vivr.php';

try {

    if (!isset($_GET['id_order'])) {
        throw new Exception('id_order is required');
    }

    $idOrder = (int)$_GET['id_order'];

    $db = new VIVRDatabase();
    $conn = $db->connect();

    $sql = "
        SELECT
            id,
            id_order,
            origin,
            payload,
            http_status,
            http_error,
            uid,
            status,
            created_at
        FROM tracking
        WHERE id_order = :id_order
        ORDER BY created_at DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id_order', $idOrder, PDO::PARAM_INT);
    $stmt->execute();

    $trackings = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'count' => count($trackings),
        'data' => $trackings
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}