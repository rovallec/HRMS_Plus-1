<?php
// ======= GLOBAL API HEADERS (CORS + JSON defaults) =======

// Permitir solicitudes desde cualquier origen (útil para desarrollo)
header("Access-Control-Allow-Origin: *");

// Permitir los métodos comunes de la API
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Permitir los headers usados por Angular y APIs modernas
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-TA-User, X-TA-Username");

// Si es una solicitud "preflight" (OPTIONS), responder inmediatamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Indicar que todas las respuestas serán JSON
header("Content-Type: application/json; charset=UTF-8");
