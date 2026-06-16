<?php

// ======================================================
// DEBUG
// ======================================================

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// ======================================================
// CORS
// ======================================================

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {

    http_response_code(200);
    exit;

}

// ======================================================
// LOAD ENV
// ======================================================

$envPath = __DIR__ . '/../config/.env';

if (file_exists($envPath)) {

    $lines = file(
        $envPath,
        FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES
    );

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

        $value = trim($value, '"');
        $value = trim($value, "'");

        putenv("$key=$value");

    }

}

// ======================================================
// ENV VARIABLES
// ======================================================

$apiKey = getenv('COLUS_APIKEY');

if (!$apiKey) {

    echo json_encode([
        'success' => false,
        'error' => 'Missing COLUS_APIKEY'
    ]);

    exit;

}

// ======================================================
// INPUT
// ======================================================

$rawInput = file_get_contents("php://input");

$input = json_decode($rawInput, true);

if (!$input) {

    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON',
        'rawInput' => $rawInput
    ]);

    exit;

}

$orderNumber = $input['orderNumber'] ?? '';
$email       = $input['email'] ?? '';
$postalCode  = $input['postalCode'] ?? '';
$zip         = $input['zip'] ?? '';

// ======================================================
// VALIDATION
// ======================================================

if (
    empty($orderNumber)
    || empty($email)
) {

    echo json_encode([
        'success' => false,
        'error' => 'Missing required fields',
        'required' => [
            'orderNumber',
            'email'
        ]
    ]);

    exit;

}

// ======================================================
// REQUEST PAYLOAD
// ======================================================

$payload = [

    'orderNumber' => $orderNumber,
    'email'       => $email,
    'postalCode'  => $postalCode,
    'zip'         => $zip

];

// ======================================================
// OMS LOOKUP
// ======================================================

$ch = curl_init();

curl_setopt_array($ch, [

    CURLOPT_URL =>
        'https://shop-csc-d.colehaan.com/api/vivr/v1/orders/lookup',

    CURLOPT_POST => true,

    CURLOPT_RETURNTRANSFER => true,

    CURLOPT_HTTPHEADER => [

        "Content-Type: application/json",
        "Accept: application/json",
        "X-API-Key: {$apiKey}"

    ],

    CURLOPT_POSTFIELDS =>
        json_encode($payload)

]);

$response = curl_exec($ch);

if ($response === false) {

    echo json_encode([

        'success' => false,
        'error' => 'OMS CURL Error',
        'details' => curl_error($ch)

    ]);

    curl_close($ch);

    exit;

}

$httpCode =
    curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

// ======================================================
// FINAL RESPONSE
// ======================================================

echo json_encode([

    'success' => true,

    'httpCode' => $httpCode,

    'data' => json_decode($response, true),

    'rawResponse' => $response

], JSON_PRETTY_PRINT);