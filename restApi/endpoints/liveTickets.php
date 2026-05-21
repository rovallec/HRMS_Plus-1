<?php
require_once __DIR__ . '/../config/api_header.php';

header('Content-Type: application/json');

try {

    // =====================================================
    // RAW BODY
    // =====================================================

    $raw =
        file_get_contents("php://input");

    $encoded =
        json_encode($raw,true);

    $body =
        json_decode($raw, true);

    // DEBUG
    error_log("RAW BODY: " . $raw);

    // =====================================================
    // INPUTS
    // =====================================================

    $lobField =
        $body['lobField'] ?? '';

    $channel =
        strtolower($body['channel'] ?? '');

    $metric =
        strtolower($body['metricType'] ?? '');

    $startUtc =
        $body['intervalStartUtc'] ?? '';

    $endUtc =
        $body['intervalEndUtc'] ?? '';

    // =====================================================
    // DEBUG
    // =====================================================

    error_log("LOB FIELD: " . $lobField);
    error_log("CHANNEL: " . $channel);
    error_log("METRIC: " . $metric);

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!$lobField) {

        http_response_code(400);

        echo json_encode([
            "error" => "Missing lobField",
            "received" => $body
        ]);

        exit;
    }

    // =====================================================
    // ZENDESK
    // =====================================================

    $ZD_BASE_URL =
        "https://cxperts-63539.zendesk.com";

    $ZD_USERNAME =
        "infra.admin@nearsol.com";

    $ZD_TOKEN =
        "gpH8WfZRWelj2SXHne9VEewbH5YyIGPhvEe7bKtV";

    // =====================================================
    // QUERY
    // =====================================================

    $query = '';

    $query .= $lobField . ' ';

    // CHANNEL

    switch ($channel) {

        case 'mail':
        case 'email':
            $query .= 'via:mail ';
            break;

        case 'phone':
            $query .= 'via:phone via:api ';
            break;

        case 'chat':
            $query .= 'via:native_messaging ';
            break;
    }

    // METRIC

    if (str_contains($metric, 'opened')) {

        $query .=
            "created>$startUtc " .
            "created<$endUtc";
    }

    if (str_contains($metric, 'solved')) {

        $query .=
            "status:solved " .
            "solved>$startUtc " .
            "solved<$endUtc";
    }

    if (str_contains($metric, 'backlog')) {

        $query .=
            "status<solved";
    }

    error_log("FINAL QUERY: " . $query);

    // =====================================================
    // URL
    // =====================================================

    $encodedQuery =
        urlencode($query);

    $url =
        "$ZD_BASE_URL/api/v2/search.json" .
        "?query=$encodedQuery" .
        "&per_page=100";

    error_log("URL: " . $url);

    // =====================================================
    // CURL
    // =====================================================

    $ch = curl_init();

    curl_setopt($ch, CURLOPT_URL, $url);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);

    curl_setopt(
        $ch,
        CURLOPT_USERPWD,
        "$ZD_USERNAME/token:$ZD_TOKEN"
    );

    $response =
        curl_exec($ch);

    $httpCode =
        curl_getinfo($ch, CURLINFO_HTTP_CODE);

    $curlError =
        curl_error($ch);

    curl_close($ch);

    // =====================================================
    // CURL ERROR
    // =====================================================

    if ($curlError) {

        http_response_code(500);

        echo json_encode([
            "error" => "CURL FAILED",
            "details" => $curlError
        ]);

        exit;
    }

    // =====================================================
    // ZENDESK ERROR
    // =====================================================

    if ($httpCode !== 200) {

        http_response_code($httpCode);

        echo json_encode([
            "error" => "Zendesk API failed",
            "status" => $httpCode,
            "response" => json_decode($response, true)
        ]);

        exit;
    }

    // =====================================================
    // PARSE
    // =====================================================

    $data =
        json_decode($response, true);

    $output = [];

    foreach (($data['results'] ?? []) as $ticket) {

        $output[] = [

            "ticketId" =>
                $ticket['id'] ?? null,

            "status" =>
                $ticket['status'] ?? '',

            "channel" =>
                $ticket['via']['channel'] ?? '',

            "createdAt" =>
                $ticket['created_at'] ?? ''
        ];
    }

    // =====================================================
    // SUCCESS
    // =====================================================

    echo json_encode([
        "success" => true,
        "query" => $query,
        "count" => count($output),
        "tickets" => $output
    ]);

}
catch (Exception $ex) {

    http_response_code(500);

    echo json_encode([
        "error" => "PHP EXCEPTION",
        "message" => $ex->getMessage(),
        "trace" => $ex->getTraceAsString()
    ]);
}