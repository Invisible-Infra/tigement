declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  }

  export type VerifyCallback = (error: any, user?: any, info?: any) => void;
  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
  }
}
