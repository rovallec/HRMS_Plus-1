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

        // REMOVE QUOTES
        $value = trim($value, '"');
        $value = trim($value, "'");

        putenv("$key=$value");

    }

}

// ======================================================
// ENV VARIABLES
// ======================================================

$clientId = getenv('MJ_CLIENT_ID');
$username = getenv('MJ_USERNAME');
$password = getenv('MJ_PASSWORD');
$token    = getenv('MJ_TOKEN');

if (
    !$clientId ||
    !$username ||
    !$password ||
    !$token
) {

    echo json_encode([
        'success' => false,
        'error' => 'Missing ENV variables'
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

$orderNumber = $input['orderNumber'] ?? null;

if (!$orderNumber) {

    echo json_encode([
        'success' => false,
        'error' => 'Missing orderNumber'
    ]);

    exit;

}

// ======================================================
// BASIC AUTH
// ======================================================

$basicAuth = base64_encode(
    $username . ':' . $password . ':' . $token
);

// ======================================================
// GET ACCESS TOKEN
// ======================================================

$ch = curl_init();

curl_setopt_array($ch, [

    CURLOPT_URL =>
        "https://www.marcjacobs.com/dw/oauth2/access_token?client_id={$clientId}",

    CURLOPT_POST => true,

    CURLOPT_RETURNTRANSFER => true,

    CURLOPT_HTTPHEADER => [

        "Authorization: Basic {$basicAuth}",
        "Content-Type: application/x-www-form-urlencoded"

    ],

    CURLOPT_POSTFIELDS => http_build_query([

        'grant_type' =>
            'urn:demandware:params:oauth:grant-type:client-id:dwsid:dwsecuretoken'

    ])

]);

$tokenResponse = curl_exec($ch);

if ($tokenResponse === false) {

    echo json_encode([

        'success' => false,
        'error' => 'Token CURL Error',
        'details' => curl_error($ch)

    ]);

    curl_close($ch);

    exit;

}

$tokenHttpCode =
    curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

$tokenJson =
    json_decode($tokenResponse, true);

if (!isset($tokenJson['access_token'])) {

    echo json_encode([

        'success' => false,
        'error' => 'Unable to get access token',
        'httpCode' => $tokenHttpCode,
        'response' => $tokenJson,
        'raw' => $tokenResponse

    ]);

    exit;

}

$accessToken =
    $tokenJson['access_token'];

// ======================================================
// GET ORDER
// ======================================================

$ch = curl_init();

curl_setopt_array($ch, [

    CURLOPT_URL =>
        "https://www.marcjacobs.com/s/mjsfra/dw/shop/v19_1/orders/{$orderNumber}",

    CURLOPT_RETURNTRANSFER => true,

    CURLOPT_HTTPHEADER => [

        "Authorization: Bearer {$accessToken}",
        "x-dw-client-id: {$clientId}",
        "Content-Type: application/json"

    ]

]);

$orderResponse = curl_exec($ch);

if ($orderResponse === false) {

    echo json_encode([

        'success' => false,
        'error' => 'Order CURL Error',
        'details' => curl_error($ch)

    ]);

    curl_close($ch);

    exit;

}

$orderHttpCode =
    curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

// ======================================================
// FINAL RESPONSE
// ======================================================

echo json_encode([

    'success' => true,

    'httpCode' => $orderHttpCode,

    'data' => json_decode($orderResponse, true)

], JSON_PRETTY_PRINT);