import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  /**
   * Extend the built-in session types
   */
  interface Session {
    user: {
      /** The user's unique ID */
      id: string;
      username?: string;
      /** The user's role */
      role: string;
      /** The user's plan expiration date */
      planExpiresAt?: string;
    } & DefaultSession['user'];
    accessToken?: string;
  }

  /**
   * Extend the built-in user types
   */
  interface User extends DefaultUser {
    role: string;
    username?: string;
    planExpiresAt?: Date | null;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extend the built-in JWT types
   */
  interface JWT {
    /** The user's unique ID */
    id: string;
    /** The user's username */
    username?: string;
    /** The user's role */
    role: string;
    /** The user's plan expiration date */
    planExpiresAt?: string;
  }
}
