# Tigement Backend API

Node.js/Express REST API with TypeScript for the Tigement task management system.

## 🛠️ Tech Stack

- **Node.js 18+** - JavaScript runtime
- **Express** - Web framework
- **TypeScript** - Type-safe backend code
- **PostgreSQL** - Relational database
- **JWT** - Authentication tokens
- **Passport** - OAuth authentication
- **Bcrypt** - Password hashing
- **Nodemailer** - Email sending

## 📋 Features

- RESTful API endpoints for workspace management
- User authentication with JWT tokens
- OAuth integration (GitHub, Google, Apple, Facebook, Twitter)
- Two-factor authentication (2FA) support
- Premium subscription management
- Multiple payment gateways (BTCPay Server, Stripe, PayPal)
- Email notifications
- iCal calendar feed generation
- CalDAV support
- Admin panel and analytics
- Bug reporting system

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- npm or yarn

### Installation

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment**

   Copy the example configuration:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/tigement
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-super-secret-refresh-key
   SESSION_SECRET=your-session-secret
   PORT=3000
   FRONTEND_URL=http://localhost:8081
   ```

3. **Run Database Migrations**

   ```bash
   npm run migrate
   ```

   This creates all necessary database tables and indexes.

4. **Start Development Server**

   ```bash
   npm run dev
   ```

5. **Test the API**

   ```bash
   curl http://localhost:3000/api/health
   ```

## 📁 File Structure

```
backend/
├── src/
│   ├── server.ts         # Express app setup
│   ├── db/
│   │   ├── index.ts      # Database connection pool
│   │   ├── migrate.ts    # Migration runner
│   │   └── migrations/   # SQL migration files
│   ├── routes/           # API route handlers
│   │   ├── auth.ts       # Authentication
│   │   ├── workspace.ts  # Workspace management
│   │   ├── calendar.ts   # Calendar/iCal
│   │   ├── payment.ts    # Payment processing
│   │   └── ...
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts       # JWT authentication
│   │   └── admin.ts      # Admin authorization
│   └── services/         # Business logic
│       ├── btcpay.ts     # BTCPay Server integration
│       ├── stripe.ts     # Stripe integration
│       ├── paypal.ts     # PayPal integration
│       ├── email.ts      # Email sending
│       └── oauth.ts      # OAuth providers
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout

### Workspace

- `GET /api/workspace` - Get encrypted workspace data
- `POST /api/workspace` - Save encrypted workspace data

### Calendar (Premium)

- `POST /api/calendar/token` - Generate iCal subscription token
- `GET /api/calendar/:token/feed.ics` - iCal feed

### Payments

- `GET /api/payment/settings` - Get payment configuration
- `POST /api/payment/btcpay/create-invoice` - Create BTCPay invoice
- `POST /api/payment/stripe/create-checkout` - Create Stripe checkout
- `POST /api/payment/paypal/create-order` - Create PayPal order

### Admin

- `GET /api/admin/users` - List all users (admin only)
- `GET /api/admin/stats` - Get system statistics (admin only)

## 🗄️ Database Schema

The database uses PostgreSQL with 25+ migration files creating:

- **users** - User accounts and authentication
- **subscriptions** - Premium subscription tracking
- **workspaces** - Encrypted workspace data storage
- **refresh_tokens** - JWT refresh token management
- **ical_tokens** - Calendar subscription tokens
- **diary_entries** - Daily journal entries
- **notebooks** - User notebooks
- **calendar_events** - Unencrypted calendar data for iCal
- **btcpay_invoices** - BTCPay Server payment tracking
- **payment_methods** - Enabled payment gateways
- **coupons** - Discount codes and referrals
- **trusted_devices** - 2FA trusted device tracking
- **backup_codes** - 2FA backup codes
- **And more...**

## 🔒 Security Best Practices

### Production Deployment

1. **Use strong secrets** - Generate with `openssl rand -base64 32`
2. **Enable HTTPS** - Use reverse proxy (Nginx, Caddy)
3. **Set NODE_ENV=production** - Disables debug features
4. **Use environment variables** - Never commit secrets
5. **Configure CORS properly** - Restrict allowed origins
6. **Rate limiting** - Add rate limiting middleware
7. **Keep dependencies updated** - Regular `npm audit` and updates

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `SESSION_SECRET` - Secret for OAuth sessions

**Optional but Recommended:**
- `ADMIN_EMAILS` - Comma-separated admin email list
- `FRONTEND_URL` - Your frontend URL for redirects
- `SMTP_*` - Email configuration for password reset

## 🧪 Testing

### Manual Testing with cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get workspace (requires token)
curl http://localhost:3000/api/workspace \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🚀 Deployment

### Docker

See root `Dockerfile` for production container setup.

### Manual Deployment

1. Build TypeScript:
   ```bash
   npm run build
   ```

2. Start production server:
   ```bash
   npm start
   ```

### With Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # E2EE workspaces are submitted as complete encrypted blobs.
    # Must be >= the backend's 20 MB upload limit for the workspace endpoint.
    client_max_body_size 20m;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 🤝 Contributing

When contributing to the backend:

1. Follow TypeScript best practices
2. Use async/await for all database operations
3. Always use parameterized queries (prevent SQL injection)
4. Add proper error handling
5. Return consistent JSON responses
6. Document new API endpoints

## 📄 License

MIT License - see the root LICENSE file for details.

