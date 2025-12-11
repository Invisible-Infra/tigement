# Tigement Frontend

Vue 3 + TypeScript frontend application for Tigement table and task management system.

## 🛠️ Tech Stack

- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development
- **Vite** - Next generation frontend tooling
- **Vue Router** - Official router for Vue.js
- **Pinia** - Intuitive state management
- **Vitest** - Blazing fast unit test framework
- **ESLint** - Code quality and consistency
- **Prettier** - Code formatting

## 📋 Features

### Components

- **Table Management** (`components/table/`)
  - TableList.vue - Display and manage multiple tables
  - TableComponent.vue - Individual table component with drag-and-drop

- **Task Management** (`components/task/`)
  - TaskList.vue - Task list container
  - TaskItem.vue - Individual task with time tracking

- **Authentication** (`components/auth/`)
  - LoginForm.vue - User login
  - RegisterForm.vue - User registration

### Utilities

- **auth.ts** - Authentication helpers
- **csvUtils.ts** - CSV import/export functionality
- **storageUtils.ts** - LocalStorage management
- **timeUtils.ts** - Time formatting and calculation

### Type Definitions

```typescript
// Task interface
interface Task {
  id: string
  name: string
  startTime: string
  endTime: string
  duration: string
}

// Table interface
interface Table {
  id: number
  name: string
  position: { x: number; y: number }
  zIndex: number
}
```

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

The application will be available at `http://localhost:5173/`

### Build for Production

Create optimized production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 🧪 Testing

### Run Unit Tests

```bash
npm run test
```

### Run Tests with UI

```bash
npm run test:ui
```

### Generate Coverage Report

```bash
npm run coverage
```

## 🔧 Configuration

### TypeScript Configuration

The project uses multiple TypeScript configurations:

- `tsconfig.json` - Base configuration
- `tsconfig.app.json` - Application-specific config
- `tsconfig.node.json` - Node.js (Vite) config
- `tsconfig.vitest.json` - Vitest testing config

### Vite Configuration

Edit `vite.config.ts` to customize:

- Base path
- Build output directory
- Plugin configuration
- Development server settings

### Router Configuration

The router is configured with base path `/frontend/` in `src/router/index.ts`. Update this if deploying to a different path.

### Environment Variables

Create a `.env` file in the frontend directory for environment-specific configuration:

```env
VITE_API_URL=http://localhost:8000/api
```

Access in your code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## 📁 Project Structure

```
src/
├── assets/           # Static assets (CSS, images)
├── components/       # Vue components
│   ├── auth/        # Authentication components
│   ├── table/       # Table management components
│   ├── task/        # Task management components
│   └── icons/       # Icon components
├── router/          # Vue Router configuration
├── stores/          # Pinia stores
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── views/           # Page-level components
├── App.vue          # Root component
└── main.ts          # Application entry point
```

## 🎨 Styling

The application uses a custom CSS setup with:

- `assets/base.css` - CSS variables and base styles
- `assets/main.css` - Main application styles
- `style.css` - Additional styles

## 🔌 API Integration

The frontend expects the backend API to be available. Configure the API URL in your environment or update the API calls in the components.

Default API endpoints:
- `GET /api/tables` - Fetch tables
- `POST /api/tables` - Create table

## 🛡️ Authentication

The application supports two modes:

1. **Server Authentication** - Uses backend API for user management
2. **Local Storage Mode** - Works offline using browser's localStorage

Set `useLocal` in localStorage to enable local-only mode:
```javascript
localStorage.setItem('useLocal', 'true')
```

## 📝 Code Quality

### Linting

Check and fix code issues:

```bash
npm run lint
```

### Formatting

Format code with Prettier:

```bash
npm run format
```

## 🔄 Development Workflow

1. Start the development server: `npm run dev`
2. Make your changes
3. Run tests: `npm run test`
4. Check linting: `npm run lint`
5. Build for production: `npm run build`

## 📦 Dependencies

### Production Dependencies
- `vue` - Vue.js framework
- `vue-router` - Routing
- `pinia` - State management
- `uuid` - UUID generation

### Development Dependencies
- `@vitejs/plugin-vue` - Vite Vue plugin
- `typescript` - TypeScript compiler
- `vitest` - Testing framework
- `eslint` - Linting
- `prettier` - Code formatting

## 🐛 Troubleshooting

### Port Already in Use

If port 5173 is busy, Vite will automatically try the next available port. You can also specify a custom port:

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

### Type Errors

Run type checking:

```bash
npm run type-check
```

## 📚 Learn More

- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vitest Documentation](https://vitest.dev/)
- [Pinia Documentation](https://pinia.vuejs.org/)

## 🤝 Contributing

When contributing to the frontend:

1. Follow the existing code style
2. Write unit tests for new features
3. Update TypeScript types as needed
4. Run linting and tests before submitting
5. Keep components small and focused

## 📄 License

MIT License - see the root LICENSE file for details.

