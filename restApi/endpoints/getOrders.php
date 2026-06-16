<?php

header('Content-Type: application/json');
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db_vivr.php';

try {

    if (!isset($_GET['id_customer'])) {
        throw new Exception("id_customer is required");
    }

    $idCustomer = $_GET['id_customer'];

    $db = new VIVRDatabase();
    $conn = $db->connect();

    $sql = "
        SELECT *
        FROM [order]
        WHERE id_customer = :id_customer
    ";

    $stmt = $conn->prepare($sql);
    $stmt->bindParam(':id_customer', $idCustomer, PDO::PARAM_INT);
    $stmt->execute();

    $orders = $stmt->fetchAll();

    echo json_encode([
        "success" => true,
        "count" => count($orders),
        "data" => $orders
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}