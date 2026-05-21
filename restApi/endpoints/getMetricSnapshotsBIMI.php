<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {

    $server = "cxperts.database.windows.net";
    $database = "azmidb";
    $username = "neadmin";
    $password = 'Wh!$ky@N$@dmin@T@ng0!';

    $conn = new PDO(
        "sqlsrv:Server=$server;Database=$database",
        $username,
        $password
    );

    $conn->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

    $sql = "
        SELECT
            ms.id,
            ms.metric_value,
            ms.snapshot_at_utc,

            l.id AS lob_id,
            l.name AS lob_name,
            l.code AS lob_code,

            m.id AS metric_id,
            m.name AS metric_name,
            m.code AS metric_code,

            c.id AS channel_id,
            c.name AS channel_name,
            c.code AS channel_code

        FROM metric_snapshot ms

        INNER JOIN lob l
            ON l.id = ms.lob_id

        INNER JOIN metric m
            ON m.id = ms.metric_id

        INNER JOIN channel c
            ON c.id = ms.channel_id

        ORDER BY
            ms.snapshot_at_utc DESC
    ";

    $stmt = $conn->query($sql);

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        "success" => true,
        "count" => count($data),
        "data" => $data
    ]);

} catch (Exception $e) {

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);

}