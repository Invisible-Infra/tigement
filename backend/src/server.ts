import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import session from 'express-session';
import passport from 'passport';
import authRoutes from './routes/auth';
import workspaceRoutes from './routes/workspace';
import calendarRoutes from './routes/calendar';
import subscriptionRoutes from './routes/subscription';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import twoFactorRoutes from './routes/twoFactor';
import paymentRoutes from './routes/payment';
import icalRoutes from './routes/ical';
import caldavRoutes from './routes/caldav';
import notebooksRoutes from './routes/notebooks';
import archivesRoutes from './routes/archives';
import diaryRoutes from './routes/diary';
import bugsRoutes from './routes/bugs';
import oauthRoutes from './routes/oauth';
import couponsRoutes from './routes/coupons';
import announcementsRoutes from './routes/announcements';
import migrationRoutes from './routes/migration';
import tokensRoutes from './routes/tokens';
import apiRoutes from './routes/api';
import docsRoutes from './routes/docs';
import { runMigrations } from './db/migrate';
import { initPaymentSettings } from './db/initPaymentSettings';
import { configureOAuth } from './services/oauth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    /\.tigement\.cz$/,        // All subdomains of tigement.cz
    /\.tigement\.com$/,       // All subdomains of tigement.com
    'https://tigement.cz',    // Root domain
    'https://tigement.com',   // Root domain
    'http://tigement.cz',     // Root domain (HTTP for dev)
    'http://tigement.com',    // Root domain (HTTP for dev)
    'http://localhost:8081',  // Local development
    'http://localhost:3000',  // Local development
  ],
  credentials: true,
}));

// Serve uploaded files (profile pictures, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Apply JSON parsing to all routes except webhook endpoints (which need raw body)
app.use((req, res, next) => {
  if (req.path === '/api/payment/webhook' || req.path === '/api/payment/stripe-webhook') {
    // Skip JSON parsing for webhooks - they need raw body for signature verification
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});

// Session middleware for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport and configure OAuth strategies
app.use(passport.initialize());
configureOAuth();

// Enable CalDAV HTTP methods (PROPFIND, REPORT)
app.use((req, res, next) => {
  // Add DAV header for CalDAV support
  res.set('DAV', '1, 3, calendar-access');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: process.env.VERSION || 'alpha' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/v1', apiRoutes);
// iCal and CalDAV routes disabled - replaced with client-side .ics export for privacy
// app.use('/api/ical', icalRoutes);
// app.use('/caldav', caldavRoutes);
app.use('/api/notebooks', notebooksRoutes);
app.use('/api/archives', archivesRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/bugs', bugsRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api-docs', docsRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Run migrations, initialize settings, then start server
runMigrations()
  .then(() => initPaymentSettings())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Tigement backend running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

