<?php
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/db_vivr.php';

header('Content-Type: application/json');

try {
    // Init DB connection
    $db = new VIVRDatabase();
    $conn = $db->connect();

    // Query
    $sql = "
        SELECT 
            id,
            email,
            first_name,
            last_name,
            created_at
        FROM customer
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
    ";

    $stmt = $conn->prepare($sql);
    $stmt->execute();

    $customers = $stmt->fetchAll();

    // Response
    echo json_encode([
        "success" => true,
        "count" => count($customers),
        "data" => $customers
    ]);

} catch (Exception $e) {

    http_response_code(500);

    echo json_encode([
        "success" => false,
        "error" => "Failed to fetch customers",
        "details" => $e->getMessage()
    ]);
}