<?php
require_once __DIR__ . '/../config/api_header.php';
require_once __DIR__ . '/../config/env_loader.php';
require_once __DIR__ . '/../config/db.php';

try {
    $clientId     = getenv('AZURE_CLIENT_ID');
    $tenantId     = getenv('AZURE_TENANT_ID');
    $clientSecret = getenv('AZURE_CLIENT_SECRET');
    $redirectUri  = getenv('AZURE_REDIRECT_URI');

    if (empty($clientId) || empty($tenantId) || empty($clientSecret) || empty($redirectUri)) {
        throw new Exception("Missing Azure configuration values.");
    }

    if (!isset($_GET['code'])) {
        throw new Exception("Missing authorization code.");
    }

    $code = $_GET['code'];
    $tokenUrl = "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token";

    $postData = [
        'client_id'     => $clientId,
        'scope'         => 'openid profile email offline_access User.Read',
        'code'          => $code,
        'redirect_uri'  => $redirectUri,
        'grant_type'    => 'authorization_code',
        'client_secret' => $clientSecret
    ];

    $ch = curl_init($tokenUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        throw new Exception('cURL error: ' . curl_error($ch));
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $tokenData = json_decode($response, true);

    if ($httpCode !== 200 || !isset($tokenData['id_token'])) {
        file_put_contents(__DIR__ . '/../debug_token.log', "Token Response:\n$response\n\n", FILE_APPEND);
        throw new Exception("Token exchange failed: " . ($tokenData['error_description'] ?? 'null'));
    }

    // Decode JWT payload
    $idToken = $tokenData['id_token'];
    $parts = explode('.', $idToken);
    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);

    if (!$payload) {
        throw new Exception("Unable to decode ID token payload.");
    }

    $email = $payload['preferred_username'] ?? $payload['email'] ?? null;
    $name  = $payload['name'] ?? 'Unknown';
    $groups = $payload['groups'] ?? [];

    if (!$email) {
        throw new Exception("Missing email in ID token.");
    }

    // --- OPTIONAL: Fetch full Microsoft Graph profile ---
    $graphData = null;
    if (!empty($tokenData['access_token'])) {
        $headers = [
            'Authorization: Bearer ' . $tokenData['access_token']
        ];
        $ch = curl_init("https://graph.microsoft.com/v1.0/me");
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $graphResponse = curl_exec($ch);
        curl_close($ch);
        $graphData = json_decode($graphResponse, true);
    }

    // DB connection
    $db = new Database();
    $pdo = $db->connect();

    // Ensure user exists in DB
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :email LIMIT 1");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $insert = $pdo->prepare("INSERT INTO users (idRole, username, sso) VALUES (2, :email, 1)");
        $insert->execute([':email' => $email]);
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    $brands = [];
    if (!empty($groups)) {
        $inQuery = implode(',', array_fill(0, count($groups), '?'));
        $brandStmt = $pdo->prepare("SELECT idbrands AS id, brands.name AS name FROM brands WHERE idGroup IN ($inQuery)");
        $brandStmt->execute($groups);
        $brands = $brandStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // --- Build user data ---
    $userData = [
        'idUser'        => $user['idusers'],
        'username'      => $user['username'],
        'role'          => $user['idRole'],
        'sso'           => $user['sso'],
        'email'         => $email,
        'name'          => $name,
        'brands'        => $brands,
        'access_token'  => $tokenData['access_token'] ?? null,
        'refresh_token' => $tokenData['refresh_token'] ?? null,
        'graph'         => $graphData
    ];

    // --- Redirect to Angular ---
    $encoded = base64_encode(json_encode($userData));
    header("Location: https://my.cxperts.us/login?token={$encoded}");
    #header("Location: http://localhost:4200/login?token={$encoded}");
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
