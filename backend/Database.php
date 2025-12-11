<?php
class Database extends PDO {
    public function __construct() {
        try {
            parent::__construct(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME,
                DB_USER,
                DB_PASS,
                array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
            );
        } catch(PDOException $e) {
            echo json_encode(['success' => false, 'error' => 'Connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
} 