<?php
/**
 * Database Configuration Example
 * 
 * Copy this file to config.php and update with your actual database credentials.
 * You can use environment variables or hardcode the values directly.
 */

// Option 1: Using environment variables (recommended for security)
define('DB_HOST', getenv('MYSQL_HOST') ?: 'localhost');
define('DB_NAME', getenv('MYSQL_DATABASE') ?: 'your_database_name');
define('DB_USER', getenv('MYSQL_USER') ?: 'your_username');
define('DB_PASS', getenv('MYSQL_PASSWORD') ?: 'your_password');

// Option 2: Direct values (not recommended for production)
// define('DB_HOST', 'localhost');
// define('DB_NAME', 'your_database_name');
// define('DB_USER', 'your_username');
// define('DB_PASS', 'your_password');

