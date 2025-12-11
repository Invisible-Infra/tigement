# Tigement

A modern table and task management application with end-to-end encryption, built with React and Node.js.

## 📋 Overview

Tigement is a privacy-focused, open-source application for managing tasks, tables, notebooks, and diary entries. It features a React TypeScript frontend with a Node.js/Express REST API backend, designed with security and ease of use in mind.

## ✨ Features

- **Task Management**: Create and organize tasks with time tracking
- **Table Management**: Drag-and-drop table organization with spaces
- **Notebooks**: Markdown-based note-taking with rich formatting
- **Diary**: Daily journal entries with calendar integration
- **End-to-End Encryption**: Client-side encryption for complete privacy
- **Authentication**: Secure user registration and login with 2FA support
- **OAuth Integration**: Login with GitHub, Google, Apple, Facebook, Twitter
- **Premium Features**: iCal calendar sync, advanced statistics, unlimited storage
- **Payment Integration**: BTCPay Server, Stripe, PayPal support
- **Responsive Design**: Modern, clean UI that works on desktop and mobile
- **Type Safety**: Full TypeScript support for better development experience

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Context API**: State management for auth and theme

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **TypeScript**: Type-safe backend code
- **PostgreSQL**: Robust relational database
- **JWT**: Secure authentication tokens
- **Passport**: OAuth authentication middleware
- **Bcrypt**: Password hashing

## 📁 Project Structure

```
tigement/
├── frontend/          # React TypeScript application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts (Auth, Theme)
│   │   ├── utils/       # Utility functions
│   │   └── App.tsx      # Main application component
│   └── public/         # Static assets
│
└── backend/           # Node.js/Express API
    └── src/
        ├── routes/      # API route handlers
        ├── middleware/  # Auth and other middleware
        ├── services/    # Business logic (payments, email, OAuth)
        └── db/          # Database migrations and queries
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ 
- Docker and Docker Compose (optional, for easy setup)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/Invisible-Infra/tigement.git
cd tigement

# Create .env file
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration

# Start services
docker-compose up -d
```

The application will be available at:
- Frontend: `http://localhost:8081`
- Backend API: `http://localhost:3000`

### Manual Setup

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The development server will start at `http://localhost:8081`.

#### Build for Production

```bash
npm run build
```

The production files will be generated in the `dist/` directory.

#### Backend Setup

1. **Configure Database**

   Create a PostgreSQL database:
   ```sql
   CREATE DATABASE tigement;
   ```

2. **Configure Environment**

   Copy the example configuration file:
   ```bash
   cd backend
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/tigement
   JWT_SECRET=your-jwt-secret-here
   JWT_REFRESH_SECRET=your-refresh-secret-here
   ```

3. **Install Dependencies and Run Migrations**

   ```bash
   npm install
   npm run migrate  # Run database migrations
   npm run dev      # Start development server
   ```

4. **Test the API**

   ```bash
   curl http://localhost:3000/api/health
   ```

## 🔧 Configuration

### Frontend Configuration

Environment variables can be set in `.env`:

```env
VITE_API_URL=http://localhost:3000
```

### Backend Configuration

See `backend/.env.example` for all available configuration options including:
- Database connection
- JWT secrets
- OAuth providers (GitHub, Google, Apple, Facebook, Twitter)
- Payment gateways (BTCPay, Stripe, PayPal)
- Email/SMTP settings
- Admin emails

## 🔒 Security Features

- **End-to-End Encryption**: All workspace data is encrypted client-side
- **Password Hashing**: Bcrypt with salt rounds
- **JWT Tokens**: Secure authentication with refresh tokens
- **2FA Support**: Time-based one-time passwords (TOTP)
- **Trusted Devices**: Remember devices to reduce 2FA prompts
- **CORS Protection**: Configurable allowed origins
- **SQL Injection Prevention**: Parameterized queries

## 📝 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout and invalidate tokens

### Workspace Endpoints

- `GET /api/workspace` - Get encrypted workspace data
- `POST /api/workspace` - Save encrypted workspace data

### Calendar Endpoints (Premium)

- `POST /api/calendar/token` - Generate iCal token
- `GET /api/calendar/:token/feed.ics` - iCal feed

See individual route files in `backend/src/routes/` for complete API documentation.

## 🧪 Development

### Running Tests

```bash
cd frontend
npm run test
```

### Linting

```bash
npm run lint
```

### Database Migrations

Create a new migration:
```bash
cd backend
# Create migration file in src/db/migrations/
npm run migrate
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

For deployment, you'll need to set up your own infrastructure and configuration based on your requirements.

## 🔗 Links

- **Repository**: [https://github.com/Invisible-Infra/tigement](https://github.com/Invisible-Infra/tigement)
- **Issues**: [https://github.com/Invisible-Infra/tigement/issues](https://github.com/Invisible-Infra/tigement/issues)

## 💡 Support

If you have any questions or need help, please open an issue in the GitHub repository.
