declare module 'passport-apple' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOptions {
    clientID: string;
    teamID: string;
    keyID: string;
    callbackURL: string;
    privateKeyLocation?: string;
    privateKeyString?: string;
    passReqToCallback?: boolean;
    scope?: string[];
  }

  export interface Profile {
    id: string;
    provider: string;
    displayName?: string;
    name?: {
      firstName?: string;
      lastName?: string;
    };
    emails?: Array<{ value: string; verified?: boolean }>;
    _raw?: string;
    _json?: any;
  }

  export type VerifyCallback = (
    error: any,
    user?: any,
    info?: any
  ) => void;

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
  }
}

