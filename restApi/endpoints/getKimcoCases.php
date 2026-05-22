<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// =====================================================
// LOAD .ENV
// =====================================================

$envPath = __DIR__ . '/../config/.env';

if (file_exists($envPath)) {

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {

        if (
            str_starts_with(trim($line), '#')
            || !str_contains($line, '=')
        ) {
            continue;
        }

        list($key, $value) = explode('=', $line, 2);

        $key = trim($key);
        $value = trim($value);

        putenv("$key=$value");

    }

}

try {

    // =====================================================
    // DB
    // =====================================================

    $server =
        getenv('DB_KIMCO_CASE');

    $database =
        getenv('DB_KIMCO_DATABSE');

    $username =
        getenv('DB_KIMCO_USER');

    $password =
        getenv('DB_KIMCO_PASSWORD');

    $conn = new PDO(
        "sqlsrv:Server=$server;Database=$database",
        $username,
        $password
    );

    $conn->setAttribute(
        PDO::ATTR_ERRMODE,
        PDO::ERRMODE_EXCEPTION
    );

    // =====================================================
    // METRICS
    // =====================================================

    $metricSql = "

        SELECT

            COUNT(*) AS total_cases,

            SUM(
                CASE
                    WHEN JSON_VALUE(last_error, '$.error_code') = '200'
                    THEN 1
                    ELSE 0
                END
            ) AS success_cases,

            SUM(
                CASE
                    WHEN JSON_VALUE(last_error, '$.error_code') <> '200'
                         OR JSON_VALUE(last_error, '$.error_code') IS NULL
                    THEN 1
                    ELSE 0
                END
            ) AS failed_cases

        FROM cases

        WHERE
            CAST(created_datetime AS DATE) =
            CAST(GETDATE() AS DATE)

    ";

    $metricStmt =
        $conn->query($metricSql);

    $metrics =
        $metricStmt->fetch(PDO::FETCH_ASSOC);

    $total =
        (int)($metrics['total_cases'] ?? 0);

    $success =
        (int)($metrics['success_cases'] ?? 0);

    $failed =
        (int)($metrics['failed_cases'] ?? 0);

    $successRate =
        $total > 0
            ? round(($success / $total) * 100, 2)
            : 0;

    // =====================================================
    // TIMELINE
    // =====================================================

    $timelineSql = "

        SELECT

            FORMAT(
                created_datetime,
                'HH:mm'
            ) AS hour_bucket,

            COUNT(*) AS total

        FROM cases

        WHERE
            created_datetime >=
            DATEADD(day, -1, GETUTCDATE())

        GROUP BY
            FORMAT(
                created_datetime,
                'HH:mm'
            )

        ORDER BY
            hour_bucket ASC

    ";

    $timelineStmt =
        $conn->query($timelineSql);

    $timelineRows =
        $timelineStmt->fetchAll(PDO::FETCH_ASSOC);

    $timeline = [];

    foreach ($timelineRows as $row) {

        $timeline[] = [

            "time" =>
                $row['hour_bucket'],

            "total" =>
                (int)$row['total']

        ];

    }

    // =====================================================
    // CASES
    // =====================================================

    $casesSql = "

        SELECT

            c.id,

            c.zendesk_ticket_id,

            c.sent_pending,

            c.send_status,

            c.created_datetime,

            c.sent_datetime,

            c.retry_count,

            c.last_error,

            JSON_VALUE(
                c.last_error,
                '$.error_code'
            ) AS kimco_status,

            JSON_VALUE(
                c.last_error,
                '$.error_description'
            ) AS kimco_result

        FROM cases c

        LEFT JOIN jobs j
            ON c.send_job_id = j.id

        WHERE
            CAST(c.created_datetime AS DATE) =
            CAST(GETDATE() AS DATE)

        ORDER BY
            c.created_datetime DESC

    ";

    $casesStmt =
        $conn->query($casesSql);

    $rows =
        $casesStmt->fetchAll(PDO::FETCH_ASSOC);

    $cases = [];

    foreach ($rows as $row) {

        $lastError = null;

        if (!empty($row['last_error'])) {

            $decoded =
                json_decode(
                    $row['last_error'],
                    true
                );

            if ($decoded) {

                $lastError = [

                    "error" =>
                        $decoded['error_code']
                            ?? null,

                    "error_description" =>
                        $decoded['error_description']
                            ?? null

                ];
            }
        }

        $cases[] = [

            "id" =>
                (int)$row['id'],

            "zendesk_ticket_id" =>
                $row['zendesk_ticket_id'],

            "sent_pending" =>
                (int)$row['sent_pending'],

            "send_status" =>
                $row['send_status'],

            "created_datetime" =>
                $row['created_datetime'],

            "sent_datetime" =>
                $row['sent_datetime'],

            "retry_count" =>
                (int)$row['retry_count'],

            "last_error" =>
                $lastError,

            "kimco_status" =>
                $row['kimco_status'],

            "kimco_result" =>
                $row['kimco_result']

        ];

    }

    // =====================================================
    // RESPONSE
    // =====================================================

    echo json_encode([

        "success" => true,

        "metrics" => [

            "total" =>
                $total,

            "success" =>
                $success,

            "failed" =>
                $failed,

            "successRate" =>
                $successRate

        ],

        "timeline" =>
            $timeline,

        "cases" =>
            $cases

    ]);

}
catch (Exception $e) {

    echo json_encode([

        "success" => false,

        "error" => $e->getMessage()

    ]);

}