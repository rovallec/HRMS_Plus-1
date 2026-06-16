<?php

class VIVRDatabase {
    private $pdo;

    // Load .env from /config folder
    public function __construct($configPath = __DIR__ . '/.env') {
        if (!file_exists($configPath)) {
            throw new Exception("Environment file not found at: " . $configPath);
        }

        $lines = file($configPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            $line = trim($line);

            if ($line === '' || str_starts_with($line, '#')) continue;
            if (!str_contains($line, '=')) continue;

            [$key, $value] = explode('=', $line, 2);

            $key = trim($key);
            $value = trim($value);

            putenv("$key=$value");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }

    // Database connection
    public function connect() {
        if ($this->pdo) return $this->pdo;

        $host = getenv('VIVR_DB_SERVER');
        $db   = getenv('VIVR_DB_SCHEMA');
        $user = getenv('VIVR_DB_USER');
        $pass = getenv('VIVR_DB_PASSWORD');

        if (!$host || !$db || !$user) {
            throw new Exception("Missing VIVR DB environment variables.");
        }

        $dsn = sprintf(
            'sqlsrv:Server=%s;Database=%s',
            $host,
            $db
        );

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            $this->pdo = new PDO(
                $dsn,
                $user,
                $pass,
                $options
            );
        } catch (PDOException $e) {
            throw new Exception('VIVR DB connection failed: ' . $e->getMessage());
        }

        return $this->pdo;
    }
}