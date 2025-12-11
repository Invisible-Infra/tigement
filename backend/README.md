# Tigement Backend API

PHP REST API for the Tigement table and task management system.

## 🛠️ Tech Stack

- **PHP 7.4+** - Server-side programming language
- **MySQL 5.7+** - Relational database
- **PDO** - PHP Data Objects for database access
- **REST API** - Simple and clean API architecture

## 📋 Features

- RESTful API endpoints for table management
- Database abstraction layer with PDO
- JSON request/response format
- CORS support for frontend integration
- Error handling and validation
- Database connection testing endpoint

## 🚀 Quick Start

### Prerequisites

- PHP 7.4 or higher
- MySQL 5.7+ or MariaDB 10.2+
- Web server (Apache, Nginx) or PHP built-in server

### Installation

1. **Configure Database Connection**

   Copy the example configuration:
   ```bash
   cp config.example.php config.php
   ```

   Edit `config.php` with your credentials:
   ```php
   <?php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'tigement');
   define('DB_USER', 'your_username');
   define('DB_PASS', 'your_password');
   ```

   **Using Environment Variables** (recommended):
   ```php
   <?php
   define('DB_HOST', getenv('MYSQL_HOST'));
   define('DB_NAME', getenv('MYSQL_DATABASE'));
   define('DB_USER', getenv('MYSQL_USER'));
   define('DB_PASS', getenv('MYSQL_PASSWORD'));
   ```

2. **Create Database Schema**

   ```sql
   CREATE DATABASE tigement CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE tigement;

   CREATE TABLE tables (
       id INT AUTO_INCREMENT PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       INDEX idx_created_at (created_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
   ```

3. **Start the Server**

   Using PHP built-in server:
   ```bash
   php -S localhost:8000
   ```

   Or configure your web server to point to the backend directory.

4. **Test the Connection**

   ```bash
   curl http://localhost:8000/api/test-db
   ```

   Expected response:
   ```json
   {
     "success": true,
     "data": {
       "server_time": "2024-01-01 12:00:00"
     }
   }
   ```

## 📁 File Structure

```
backend/
├── index.php           # API entry point and routing
├── Database.php        # Database connection class
├── config.php          # Database configuration (create from config.example.php)
└── config.example.php  # Configuration template
```

## 🔌 API Endpoints

### Test Database Connection

```http
GET /api/test-db
```

**Response:**
```json
{
  "success": true,
  "data": {
    "server_time": "2024-01-01 12:00:00"
  }
}
```

### List All Tables

```http
GET /api/tables
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Table 1",
      "created_at": "2024-01-01 12:00:00",
      "updated_at": "2024-01-01 12:00:00"
    }
  ]
}
```

### Create New Table

```http
POST /api/tables
Content-Type: application/json

{
  "name": "New Table"
}
```

**Response:**
```json
{
  "success": true,
  "id": 2
}
```

### Error Response

All errors return a JSON response:

```json
{
  "success": false,
  "error": "Error message here"
}
```

## 🏗️ Architecture

### Database Class

The `Database.php` file provides a PDO wrapper for database operations:

```php
$db = new Database();

// Execute query
$results = $db->query("SELECT * FROM tables");

// Prepared statements
$stmt = $db->prepare("INSERT INTO tables (name) VALUES (?)");
$stmt->execute([$name]);

// Get last insert ID
$id = $db->lastInsertId();
```

### API Router

The `index.php` file handles:
- Request routing using regex patterns
- HTTP method handling (GET, POST, etc.)
- CORS preflight requests
- JSON encoding/decoding
- Error handling and HTTP status codes

## 🔒 Security Considerations

### Production Deployment

1. **Never commit config.php** - Keep credentials secure
2. **Use HTTPS** - Encrypt data in transit
3. **Validate Input** - Always sanitize user input
4. **Use Prepared Statements** - Prevent SQL injection (already implemented)
5. **Set Proper CORS Headers** - Restrict allowed origins
6. **Rate Limiting** - Implement request throttling
7. **Authentication** - Add API authentication (JWT, OAuth)

### Recommended .htaccess

For Apache, create a `.htaccess` file:

```apache
# Disable directory listing
Options -Indexes

# Protect config file
<Files "config.php">
    Require all denied
</Files>

# Enable CORS (adjust as needed)
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"

# Rewrite rules for clean URLs (optional)
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^api/(.*)$ index.php [QSA,L]
```

## 🔧 Configuration Options

### Database Connection

The Database class uses PDO with these settings:
- **Error Mode**: Exception mode for better error handling
- **Fetch Mode**: Associative arrays by default
- **Character Set**: UTF-8 (utf8mb4)
- **Persistent Connections**: Can be enabled for performance

### PHP Configuration

Recommended `php.ini` settings:

```ini
; Error handling
display_errors = Off
log_errors = On
error_log = /path/to/php-error.log

; Security
expose_php = Off
allow_url_fopen = Off
allow_url_include = Off

; Performance
opcache.enable = 1
opcache.memory_consumption = 128
```

## 🧪 Testing

### Manual Testing with cURL

```bash
# Test database connection
curl http://localhost:8000/api/test-db

# Get all tables
curl http://localhost:8000/api/tables

# Create a table
curl -X POST http://localhost:8000/api/tables \
  -H "Content-Type: application/json" \
  -d '{"name":"My Table"}'
```

### Testing with Postman

Import these endpoints into Postman:

1. GET `http://localhost:8000/api/test-db`
2. GET `http://localhost:8000/api/tables`
3. POST `http://localhost:8000/api/tables` with JSON body

## 📊 Database Schema

### Tables Table

```sql
CREATE TABLE tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at)
);
```

### Future Extensions

Consider adding these tables for full functionality:

```sql
-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY,
    table_id INT,
    name VARCHAR(255) NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    duration INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
);
```

## 🐛 Troubleshooting

### Database Connection Failed

1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `config.php`
3. Ensure database exists: `SHOW DATABASES;`
4. Check MySQL user permissions: `SHOW GRANTS FOR 'username'@'localhost';`

### 500 Internal Server Error

1. Check PHP error logs
2. Verify file permissions
3. Ensure all required PHP extensions are installed: `php -m`

### CORS Issues

Add proper CORS headers in `index.php`:

```php
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
```

## 🚀 Deployment

### Apache

1. Configure virtual host
2. Enable mod_rewrite
3. Set document root to backend directory
4. Configure .htaccess for routing

### Nginx

Example configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    root /path/to/backend;
    index index.php;

    location /api/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

### Docker

Example Dockerfile:

```dockerfile
FROM php:7.4-apache

# Install MySQL PDO extension
RUN docker-php-ext-install pdo pdo_mysql

# Copy application files
COPY . /var/www/html/

# Enable Apache mod_rewrite
RUN a2enmod rewrite

EXPOSE 80
```

## 🤝 Contributing

When contributing to the backend:

1. Follow PSR-12 coding standards
2. Use prepared statements for all database queries
3. Validate all user input
4. Return consistent JSON responses
5. Add error handling for all operations
6. Document new API endpoints

## 📄 License

MIT License - see the root LICENSE file for details.

## 📚 Resources

- [PHP Manual](https://www.php.net/manual/)
- [PDO Documentation](https://www.php.net/manual/en/book.pdo.php)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [REST API Best Practices](https://restfulapi.net/)

