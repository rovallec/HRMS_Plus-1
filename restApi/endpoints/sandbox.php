<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/../config/db.php';

function sandboxRespond(array $body, int $status = 200): void {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function canonicalClient(string $client): ?string {
    $value = strtolower(preg_replace('/[^a-z0-9]/i', '', $client));
    return match ($value) {
        'colehaan' => 'ColeHaan',
        'marcjacobs', 'mjmm', 'mjm' => 'MarcJacobs',
        default => null
    };
}

function parseSandboxClients(string $storedClients): array {
    $clients = [];
    foreach (explode(',', $storedClients) as $storedClient) {
        $client = canonicalClient($storedClient);
        if ($client) { $clients[$client] = true; }
    }
    return array_keys($clients);
}

function sendSandboxEmail(string $recipient, string $accessUrl): void {
    $tenantId = getenv('AZURE_TENANT_ID');
    $clientId = getenv('AZURE_CLIENT_ID');
    $clientSecret = getenv('AZURE_CLIENT_SECRET');
    $sender = getenv('SANDBOX_MAIL_SENDER') ?: 'infra.admin@nearsol.com';
    if (!$tenantId || !$clientId || !$clientSecret) {
        throw new RuntimeException('Microsoft Graph is not configured.');
    }

    $tokenRequest = curl_init("https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token");
    curl_setopt_array($tokenRequest, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'scope' => 'https://graph.microsoft.com/.default',
            'grant_type' => 'client_credentials'
        ])
    ]);
    $tokenResponse = curl_exec($tokenRequest);
    $tokenStatus = (int)curl_getinfo($tokenRequest, CURLINFO_HTTP_CODE);
    curl_close($tokenRequest);
    $tokenBody = json_decode((string)$tokenResponse, true);
    if ($tokenStatus < 200 || $tokenStatus >= 300 || empty($tokenBody['access_token'])) {
        throw new RuntimeException('Could not authenticate with Microsoft Graph.');
    }

    $safeUrl = htmlspecialchars($accessUrl, ENT_QUOTES, 'UTF-8');
    $html = '<div style="margin:0;padding:32px;background:#f4f6f8;font-family:Arial,sans-serif;color:#13233f">'
        . '<div style="max-width:600px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(16,35,64,.12)">'
        . '<div style="padding:26px 32px;background:#102b4e;color:#fff;font-size:25px;font-weight:700;letter-spacing:1px">cxperts</div>'
        . '<div style="padding:34px 32px"><h2 style="margin-top:0">Your AI Sandbox access</h2>'
        . '<p>Use the button below to open your chatbot testing environment. This link can only be used once.</p>'
        . '<p style="margin:30px 0"><a href="'.$safeUrl.'" style="display:inline-block;background:#ff7657;color:#fff;text-decoration:none;padding:13px 24px;border-radius:7px;font-weight:700">Open AI Sandbox</a></p>'
        . '<p style="font-size:12px;color:#667085">If you did not request this access, you can ignore this email.</p></div></div></div>';

    $mailRequest = curl_init('https://graph.microsoft.com/v1.0/users/'.rawurlencode($sender).'/sendMail');
    curl_setopt_array($mailRequest, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$tokenBody['access_token'], 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['message' => [
            'subject' => 'Your cxperts AI Sandbox access',
            'body' => ['contentType' => 'HTML', 'content' => $html],
            'toRecipients' => [['emailAddress' => ['address' => $recipient]]]
        ], 'saveToSentItems' => true])
    ]);
    curl_exec($mailRequest);
    $mailStatus = (int)curl_getinfo($mailRequest, CURLINFO_HTTP_CODE);
    curl_close($mailRequest);
    if ($mailStatus < 200 || $mailStatus >= 300) {
        throw new RuntimeException('Microsoft Graph could not send the access email.');
    }
}

try {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $body['action'] ?? '';
    $pdo = (new Database())->connect();

    if ($action === 'request') {
        $email = strtolower(trim($body['email'] ?? ''));
        $generic = ['success' => true, 'message' => 'If your account is authorized, you will receive an access email shortly.'];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sandboxRespond($generic);
        }

        $stmt = $pdo->prepare('SELECT DISTINCT b.name FROM users u INNER JOIN usersbrand ub ON ub.idUser=u.idusers INNER JOIN brands b ON b.idbrands=ub.idBrand WHERE LOWER(u.username)=:email');
        $stmt->execute(['email' => $email]);
        $authorizedClients = [];
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $brandName) {
            $resolvedClient = canonicalClient((string)$brandName);
            if ($resolvedClient) { $authorizedClients[$resolvedClient] = true; }
        }

        if (count($authorizedClients) === 0) { sandboxRespond($generic); }
        // The token owns the complete authorized client set. It is intentionally
        // stored on the token so later widget changes never trust browser input.
        $client = implode(',', array_keys($authorizedClients));

        $rawToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $rawToken);
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE sandboxTokens SET status=0 WHERE requested=:email AND client=:client AND status=1')->execute(['email' => $email, 'client' => $client]);
        $insert = $pdo->prepare('INSERT INTO sandboxTokens (client, token, status, requested) VALUES (:client, :token, 1, :email)');
        $insert->execute(['client' => $client, 'token' => $tokenHash, 'email' => $email]);
        $tokenId = (int)$pdo->lastInsertId();
        $pdo->commit();

        $baseUrl = rtrim(getenv('SANDBOX_BASE_URL') ?: 'https://my.cxperts.us/sandbox', '/');
        try {
            // Keep the token in the query string so the web server only needs
            // to resolve the public /sandbox route. Dynamic path fallbacks on
            // some deployments otherwise redirect to the main login page.
            sendSandboxEmail($email, $baseUrl.'?token='.rawurlencode($rawToken));
        } catch (Throwable $mailError) {
            $pdo->prepare('UPDATE sandboxTokens SET status=0 WHERE idsandboxTokens=:id')->execute(['id' => $tokenId]);
            error_log('Sandbox email error: '.$mailError->getMessage());
        }
        sandboxRespond($generic);
    }

    if ($action === 'access') {
        $rawToken = trim($body['token'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $rawToken)) { sandboxRespond(['success' => false, 'error' => 'Invalid or already used access link.'], 403); }
        $tokenHash = hash('sha256', $rawToken);
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT idsandboxTokens, client FROM sandboxTokens WHERE token=:token AND status=1 FOR UPDATE');
        $stmt->execute(['token' => $tokenHash]);
        $row = $stmt->fetch();
        if (!$row) { $pdo->rollBack(); sandboxRespond(['success' => false, 'error' => 'Invalid or already used access link.'], 403); }
        $clients = parseSandboxClients((string)$row['client']);
        if (count($clients) === 0) {
            $pdo->rollBack();
            sandboxRespond(['success' => false, 'error' => 'No sandbox client is assigned to this access link.'], 403);
        }
        $sessionToken = bin2hex(random_bytes(32));
        $sessionHash = hash('sha256', $sessionToken);
        $pdo->prepare('UPDATE sandboxTokens SET status=0, token=:sessionHash WHERE idsandboxTokens=:id')->execute(['sessionHash' => $sessionHash, 'id' => $row['idsandboxTokens']]);
        $pdo->commit();
        sandboxRespond(['success' => true, 'client' => $clients[0], 'clients' => $clients, 'sessionToken' => $sessionToken]);
    }

    if ($action === 'feedback') {
        $sessionToken = trim($body['sessionToken'] ?? '');
        $feedback = trim($body['feedback'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $sessionToken) || $feedback === '' || mb_strlen($feedback) > 5000) {
            sandboxRespond(['success' => false, 'error' => 'Invalid feedback.'], 400);
        }
        $stmt = $pdo->prepare('UPDATE sandboxTokens SET feedback=:feedback WHERE token=:token AND status=0');
        $stmt->execute(['feedback' => $feedback, 'token' => hash('sha256', $sessionToken)]);
        if ($stmt->rowCount() !== 1) { sandboxRespond(['success' => false, 'error' => 'Your sandbox session is no longer valid.'], 403); }
        sandboxRespond(['success' => true]);
    }

    if ($action === 'resume') {
        $sessionToken = trim($body['sessionToken'] ?? '');
        $requestedClient = canonicalClient($body['client'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $sessionToken) || !$requestedClient) {
            sandboxRespond(['success' => false, 'error' => 'Your sandbox session is invalid.'], 403);
        }
        $stmt = $pdo->prepare('SELECT client FROM sandboxTokens WHERE token=:token AND status=0 LIMIT 1');
        $stmt->execute(['token' => hash('sha256', $sessionToken)]);
        $storedClients = $stmt->fetchColumn();
        $clients = $storedClients !== false ? parseSandboxClients((string)$storedClients) : [];
        if (!in_array($requestedClient, $clients, true)) {
            sandboxRespond(['success' => false, 'error' => 'This client is not authorized for your sandbox session.'], 403);
        }
        sandboxRespond(['success' => true, 'client' => $requestedClient, 'clients' => $clients, 'sessionToken' => $sessionToken]);
    }

    sandboxRespond(['success' => false, 'error' => 'Invalid action.'], 400);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) { $pdo->rollBack(); }
    error_log('Sandbox endpoint error: '.$e->getMessage());
    sandboxRespond(['success' => false, 'error' => 'The sandbox service is temporarily unavailable.'], 500);
}
