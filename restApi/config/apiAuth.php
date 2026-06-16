<?php

function api_load_env($path)
{
    if (!file_exists($path)) {
        return false;
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {

        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        putenv(trim($key) . '=' . trim($value));
    }

    return true;
}

// =============================
// CORS GUARD
// =============================
function api_cors()
{
    $allowed = explode(',', getenv('API_ALLOWED_ORIGINS') ?: '');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin && in_array($origin, $allowed)) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        http_response_code(403);
        echo json_encode(["success" => false, "error" => "CORS blocked"]);
        exit;
    }

    header("Access-Control-Allow-Headers: Content-Type, X-SIGNATURE");
    header("Access-Control-Allow-Methods: POST, OPTIONS");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// =============================
// READ JSON BODY
// =============================
function api_body()
{
    $raw = file_get_contents("php://input");
    $body = json_decode($raw, true);

    if (!$body) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Invalid JSON body"]);
        exit;
    }

    return $body;
}

// =============================
// VERIFY SIGNATURE
// =============================
function api_verify_signature($body)
{
    $secret = getenv('API_SECRET');
    $headers = getallheaders();

    $clientSignature = $headers['X-SIGNATURE'] ?? '';

    $expected = hash_hmac(
        'sha256',
        json_encode($body),
        $secret
    );

    if (!hash_equals($expected, $clientSignature)) {
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "Unauthorized"]);
        exit;
    }
}

// =============================
// OPTIONAL TIMESTAMP PROTECTION
// =============================
function api_verify_timestamp($body)
{
    $maxSkew = (int)(getenv('API_MAX_SKEW_MS') ?: 300000);

    if (!isset($body['timestamp'])) {
        return;
    }

    $diff = abs((time() * 1000) - $body['timestamp']);

    if ($diff > $maxSkew) {
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "Request expired"]);
        exit;
    }
}