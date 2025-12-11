# Tigement

A modern table and task management application built with Vue 3 and PHP.

## 📋 Overview

Tigement is a lightweight, open-source application for managing tables and tasks. It features a Vue 3 TypeScript frontend with a PHP REST API backend, designed for simplicity and ease of use.

## ✨ Features

- **Table Management**: Create and organize tables with drag-and-drop positioning
- **Task Tracking**: Manage tasks with time tracking capabilities
- **Authentication**: Built-in user registration and login system
- **Local Storage**: Option to work offline with local storage
- **CSV Export/Import**: Export and import data using CSV utilities
- **Responsive Design**: Modern, clean UI built with Vue 3
- **Type Safety**: Full TypeScript support for better development experience

## 🛠️ Technology Stack

### Frontend
- **Vue 3**: Progressive JavaScript framework
- **TypeScript**: Type-safe JavaScript
- **Vue Router**: Client-side routing
- **Pinia**: State management
- **Vite**: Fast build tool and development server
- **Vitest**: Unit testing framework

### Backend
- **PHP**: Server-side language
- **MySQL**: Database for data persistence
- **REST API**: Simple and clean API architecture

## 📁 Project Structure

```
tigement/
├── frontend/          # Vue 3 TypeScript application
│   ├── src/
│   │   ├── components/  # Vue components
│   │   ├── views/       # Page views
│   │   ├── router/      # Route definitions
│   │   ├── stores/      # Pinia stores
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Utility functions
│   └── public/         # Static assets
│
└── backend/           # PHP REST API
    ├── index.php      # API entry point and routing
    ├── Database.php   # Database connection class
    └── config.example.php  # Configuration template
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PHP** 7.4+ 
- **MySQL** 5.7+ or MariaDB
- Web server (Apache, Nginx, or PHP built-in server)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The development server will start at `http://localhost:5173` (or another port if 5173 is busy).

#### Build for Production

```bash
npm run build
```

The production files will be generated in the `dist/` directory.

### Backend Setup

1. **Configure Database**

   Copy the example configuration file:
   ```bash
   cd backend
   cp config.example.php config.php
   ```

   Edit `config.php` with your database credentials:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'your_database_name');
   define('DB_USER', 'your_username');
   define('DB_PASS', 'your_password');
   ```

2. **Create Database Schema**

   Create a MySQL database and run the following schema:
   ```sql
   CREATE DATABASE your_database_name;
   USE your_database_name;

   CREATE TABLE tables (
       id INT AUTO_INCREMENT PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Start the API Server**

   Using PHP built-in server:
   ```bash
   cd backend
   php -S localhost:8000
   ```

   Or configure your web server (Apache/Nginx) to serve the `backend` directory.

4. **Test the API**

   ```bash
   curl http://localhost:8000/api/test-db
   ```

## 🔧 Configuration

### Frontend Configuration

The frontend is configured to work with the base path `/frontend/`. If you need to change this, edit:

- `frontend/vite.config.ts` - Update the `base` property
- `frontend/src/router/index.ts` - Update the `createWebHistory()` parameter

### Backend API Endpoints

- `GET /api/tables` - List all tables
- `POST /api/tables` - Create a new table
- `GET /api/test-db` - Test database connection

## 🧪 Development

### Running Tests

Frontend tests using Vitest:
```bash
cd frontend
npm run test
```

Run tests with coverage:
```bash
npm run coverage
```

Run tests in UI mode:
```bash
npm run test:ui
```

### Linting and Formatting

```bash
npm run lint
npm run format
```

## 📝 API Documentation

### Tables API

#### Get All Tables
```http
GET /api/tables
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Table 1",
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

#### Create Table
```http
POST /api/tables
Content-Type: application/json

{
  "name": "New Table"
}
```

Response:
```json
{
  "success": true,
  "id": 2
}
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Note

This repository contains only the frontend and backend source code. It does not include:
- Docker configuration files
- Environment-specific configurations
- Deployment scripts
- Production credentials

For deployment, you'll need to set up your own infrastructure and configuration based on your requirements.

## 🔗 Links

- **Repository**: [https://github.com/Invisible-Infra/tigement](https://github.com/Invisible-Infra/tigement)
- **Issues**: [https://github.com/Invisible-Infra/tigement/issues](https://github.com/Invisible-Infra/tigement/issues)

## 💡 Support

If you have any questions or need help, please open an issue in the GitHub repository.

