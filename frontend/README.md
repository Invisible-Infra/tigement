# Tigement Frontend

React + TypeScript frontend application for Tigement task and workspace management system.

## 🛠️ Tech Stack

- **React 18** - UI library with hooks
- **TypeScript** - Type-safe development
- **Vite** - Next generation frontend tooling
- **Tailwind CSS** - Utility-first CSS framework
- **React Context** - State management for auth and theme

## 📋 Features

### Components

- **Workspace Management** - Drag-and-drop tables with multi-space support
- **Task Tracking** - Time-based task management with duration calculation
- **Notebooks** - Markdown editor with formatting toolbar
- **Diary** - Daily journal entries with calendar view
- **Authentication** - Login, register, OAuth integration
- **Profile Management** - User settings, 2FA setup, encryption key management
- **Premium Features** - Payment integration, advanced statistics

### End-to-End Encryption

All workspace data is encrypted client-side before sending to the server:
- Encryption key derived from user password or custom key
- AES-GCM encryption algorithm
- Server never sees unencrypted data

### Utilities

- **encryption.ts** - Client-side encryption/decryption
- **encryptionKey.ts** - Encryption key management
- **csvUtils.ts** - CSV export functionality
- **dateFormat.ts** - Date formatting utilities
- **syncManager.ts** - Background sync with conflict resolution
- **backup.ts** - Local backup creation and restoration

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:8081/`

### Build for Production

Create optimized production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000
```

Access in your code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

### Vite Configuration

Edit `vite.config.ts` to customize:
- Development server settings
- Proxy configuration
- Build options
- Plugin configuration

## 📁 Project Structure

```
src/
├── components/       # React components
│   ├── auth/        # Authentication components
│   ├── admin/       # Admin panel components
│   └── premium/     # Premium feature components
├── contexts/        # React contexts
│   ├── AuthContext.tsx   # Authentication state
│   └── ThemeContext.tsx  # Theme management
├── utils/           # Utility functions
│   ├── encryption.ts     # E2E encryption
│   ├── encryptionKey.ts  # Key management
│   ├── syncManager.ts    # Background sync
│   └── api.ts           # API client
├── App.tsx          # Root component
└── main.tsx         # Application entry point
```

## 🎨 Styling

The application uses Tailwind CSS with custom themes:
- Light theme
- Dark theme
- Custom color schemes
- Responsive design

Themes are managed via `ThemeContext` and stored in localStorage.

## 🔌 API Integration

The frontend communicates with the backend via REST API. All requests include JWT authentication tokens when user is logged in.

API client is centralized in `utils/api.ts`:

```typescript
import { api } from './utils/api'

// Login
await api.post('/auth/login', { email, password })

// Get workspace
const data = await api.get('/workspace')

// Save workspace (encrypted)
await api.post('/workspace', { encrypted_data })
```

## 🛡️ Authentication

The application supports multiple authentication methods:

1. **Email/Password** - Traditional authentication with bcrypt
2. **OAuth Providers** - GitHub, Google, Apple, Facebook, Twitter
3. **2FA** - TOTP-based two-factor authentication
4. **Trusted Devices** - Reduce 2FA prompts for known devices

## 🔄 Sync Strategy

The app implements intelligent background sync:
- Auto-save on changes (debounced)
- Conflict detection and resolution
- Offline support with local storage
- Merge capabilities for conflicting changes

## 📝 Development Workflow

1. Start the development server: `npm run dev`
2. Make your changes
3. Test in browser
4. Build for production: `npm run build`

## 🐛 Troubleshooting

### Port Already in Use

Vite will automatically try the next available port. You can also specify a custom port:

```bash
npm run dev -- --port 3000
```

### Build Errors

Clear the cache and rebuild:

```bash
rm -rf node_modules dist
npm install
npm run build
```

## 📚 Learn More

- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

## 🤝 Contributing

When contributing to the frontend:

1. Follow the existing code style
2. Use TypeScript for all new files
3. Keep components small and focused
4. Add proper error handling
5. Test thoroughly before submitting

## 📄 License

MIT License - see the root LICENSE file for details.

