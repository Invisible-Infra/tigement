/**
 * OAuth Configuration Service
 * Configures Passport.js strategies for multiple OAuth providers
 */

import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as AppleStrategy } from 'passport-apple';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { query } from '../db';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export function configureOAuth() {
  // GitHub OAuth
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/oauth/github/callback`,
      scope: ['user:email']
    }, handleOAuthCallback('github')));
  }

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/oauth/google/callback`,
      scope: ['profile', 'email']
    }, handleOAuthCallback('google')));
  }

  // Apple OAuth
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
    passport.use(new AppleStrategy({
      clientID: process.env.APPLE_CLIENT_ID,
      teamID: process.env.APPLE_TEAM_ID,
      keyID: process.env.APPLE_KEY_ID,
      callbackURL: `${BACKEND_URL}/api/auth/oauth/apple/callback`,
      privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH || '',
      scope: ['name', 'email']
    }, handleOAuthCallback('apple')));
  }

  // Twitter (X) OAuth
  if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
    passport.use(new TwitterStrategy({
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/oauth/twitter/callback`,
      includeEmail: true
    }, handleOAuthCallback('twitter')));
  }

  // Facebook OAuth
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${BACKEND_URL}/api/auth/oauth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'picture']
    }, handleOAuthCallback('facebook')));
  }

  console.log('OAuth providers configured:', {
    github: !!process.env.GITHUB_CLIENT_ID,
    google: !!process.env.GOOGLE_CLIENT_ID,
    apple: !!process.env.APPLE_CLIENT_ID,
    twitter: !!process.env.TWITTER_CONSUMER_KEY,
    facebook: !!process.env.FACEBOOK_APP_ID
  });
}

/**
 * Generic OAuth callback handler for all providers
 */
function handleOAuthCallback(provider: string) {
  return async (accessToken: string, refreshToken: string, profile: any, done: any) => {
    try {
      const oauthId = profile.id;
      let email = profile.emails?.[0]?.value;
      
      // Log full profile for debugging
      console.log(`OAuth profile received for ${provider}:`, JSON.stringify({
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        name: profile.name,
        emails: profile.emails,
        photos: profile.photos,
        _json: profile._json ? {
          avatar_url: profile._json.avatar_url,
          picture: profile._json.picture,
          login: profile._json.login
        } : undefined
      }, null, 2));
      
      // Handle different profile structures
      let name = profile.displayName;
      if (!name && profile.name) {
        name = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
      }
      
      // Extract avatar with provider-specific fallbacks
      let avatar = profile.photos?.[0]?.value;
      if (!avatar && profile._json) {
        // GitHub specific
        if (profile._json.avatar_url) {
          avatar = profile._json.avatar_url;
        }
        // Google specific
        if (!avatar && profile._json.picture) {
          avatar = profile._json.picture;
        }
      }
      // Facebook fallback
      if (!avatar && profile.picture?.data?.url) {
        avatar = profile.picture.data.url;
      }
      
      // Extract username - prefer displayName for visual display
      let username = profile.displayName || name;
      
      // Fallback to provider-specific username if no display name
      if (!username) {
        username = profile.username || profile._json?.login;
      }
      
      // Last resort: use email prefix
      if (!username && email) {
        username = email.split('@')[0];
      }
      
      // Only limit length, keep original characters (spaces, accents, etc.)
      if (username && username.length > 100) {
        username = username.substring(0, 100);
      }

      // For Twitter, email might not be available
      if (!email && provider === 'twitter') {
        email = `${profile.username}@twitter.oauth`;
      }

      console.log(`Extracted OAuth data for ${provider}:`, { 
        oauthId, 
        email, 
        name, 
        username, 
        avatar,
        hasAvatar: !!avatar,
        hasUsername: !!username
      });

      // Find existing user by OAuth provider + ID
      let userResult = await query(
        'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
        [provider, oauthId]
      );

      let user;

      if (userResult.rows.length === 0) {
        // Check if email exists (for account linking)
        if (email) {
          const emailResult = await query('SELECT * FROM users WHERE email = $1', [email]);
          
          if (emailResult.rows.length > 0) {
            // Link existing account to OAuth
            user = emailResult.rows[0];
            const updateResult = await query(
              `UPDATE users SET oauth_provider = $1, oauth_id = $2, oauth_profile_data = $3,
                               username = COALESCE(username, $4), 
                               profile_picture_url = COALESCE(profile_picture_url, $5)
               WHERE id = $6
               RETURNING username, profile_picture_url`,
              [provider, oauthId, JSON.stringify({ name, avatar }), username, avatar, user.id]
            );
            console.log(`Linked existing account ${user.id} to ${provider}`, {
              updatedUsername: updateResult.rows[0]?.username,
              updatedProfilePicture: updateResult.rows[0]?.profile_picture_url
            });
          }
        }

        // Create new user if not linked
        if (!user) {
          const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
          const isAdmin = email ? adminEmails.includes(email.toLowerCase()) : false;

          const newUserResult = await query(
            `INSERT INTO users (email, oauth_provider, oauth_id, oauth_profile_data, is_admin, username, profile_picture_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [email, provider, oauthId, JSON.stringify({ name, avatar }), isAdmin, username, avatar]
          );
          user = newUserResult.rows[0];
          console.log(`Created new user ${user.id} via ${provider}`, {
            username: user.username,
            profile_picture_url: user.profile_picture_url,
            insertedUsername: username,
            insertedAvatar: avatar
          });

          // Create 10-day trial subscription
          const trialExpiresAt = new Date();
          trialExpiresAt.setDate(trialExpiresAt.getDate() + 10);
          await query(
            `INSERT INTO subscriptions (user_id, plan, status, expires_at) 
             VALUES ($1, 'premium', 'active', $2)
             ON CONFLICT (user_id) DO UPDATE 
             SET plan = 'premium', status = 'active', expires_at = $2`,
            [user.id, trialExpiresAt]
          );
          console.log(`Created trial subscription for user ${user.id}`);
        }
      } else {
        user = userResult.rows[0];
        
        // Update profile data on each login, and set username/avatar if not already set
        const updateResult = await query(
          `UPDATE users SET oauth_profile_data = $1, 
                           username = COALESCE(username, $2),
                           profile_picture_url = COALESCE(profile_picture_url, $3),
                           updated_at = NOW() 
           WHERE id = $4
           RETURNING username, profile_picture_url`,
          [JSON.stringify({ name, avatar }), username, avatar, user.id]
        );
        console.log(`Updated profile data for user ${user.id}`, {
          providedUsername: username,
          providedAvatar: avatar,
          finalUsername: updateResult.rows[0]?.username,
          finalProfilePicture: updateResult.rows[0]?.profile_picture_url
        });
      }

      return done(null, user);
    } catch (error) {
      console.error(`OAuth callback error for ${provider}:`, error);
      return done(error);
    }
  };
}

/**
 * Serialize user for session
 */
passport.serializeUser((user: any, done: (err: any, id?: number) => void) => {
  done(null, user.id);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id: number, done: (err: any, user?: any) => void) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(new Error('User not found'));
    }
  } catch (error) {
    done(error);
  }
});

