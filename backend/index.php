<?php
header('Content-Type: application/json');

require_once 'config.php';
require_once 'Database.php';

// Handle CORS preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $db = new Database();
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'];

    // Add test endpoint
    if (preg_match('/^\/api\/test-db\/?$/', $uri)) {
        $result = $db->query("SELECT NOW() as server_time")->fetch();
        echo json_encode(['success' => true, 'data' => $result]);
        exit;
    }

    // Basic routing
    if (preg_match('/^\/api\/tables\/?$/', $uri)) {
        switch ($method) {
            case 'GET':
                $tables = $db->query("SELECT * FROM tables ORDER BY created_at DESC");
                echo json_encode(['success' => true, 'data' => $tables]);
                break;
            case 'POST':
                $data = json_decode(file_get_contents('php://input'), true);
                // Add input validation here
                $stmt = $db->prepare("INSERT INTO tables (name) VALUES (?)");
                $stmt->execute([$data['name']]);
                echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
                break;
            default:
                throw new Exception('Method not allowed');
        }
    } else {
        throw new Exception('Route not found');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} 