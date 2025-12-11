import { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
    }
  }
}

// Augment the Request interface from auth middleware
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      email: string;
    };
  }
}

export {};

