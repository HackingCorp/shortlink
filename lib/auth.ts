import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { getServerSession } from 'next-auth';
import type { PrismaClient } from '@prisma/client';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Configuration des options d'authentification
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as unknown as PrismaClient),

  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: "Email ou Nom d'utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) {
          throw new Error("L'identifiant et le mot de passe sont requis.");
        }
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier.toLowerCase() },
              { username: credentials.identifier },
            ],
          },
        });

        if (!user) throw new Error("Aucun utilisateur trouvé.");
        if (!user.emailVerified) throw new Error("Veuillez d'abord vérifier votre adresse e-mail.");

        // Check account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const remainingMs = user.lockedUntil.getTime() - Date.now();
          const remainingMin = Math.ceil(remainingMs / 60000);
          throw new Error(
            `Compte temporairement verrouillé. Réessayez dans ${remainingMin} minute(s).`
          );
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          // Increment login attempts
          const newAttempts = (user.loginAttempts || 0) + 1;
          const updateData: { loginAttempts: number; lockedUntil?: Date } = {
            loginAttempts: newAttempts,
          };

          // Lock account if threshold reached
          if (newAttempts >= LOCKOUT_THRESHOLD) {
            updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          if (newAttempts >= LOCKOUT_THRESHOLD) {
            throw new Error(
              'Trop de tentatives de connexion. Compte verrouillé pour 15 minutes.'
            );
          }

          throw new Error("Mot de passe incorrect.");
        }

        // Reset login attempts on successful login
        if (user.loginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
            },
          });
        }

        return {
          id: user.id.toString(),
          name: user.username,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  pages: {
    signIn: '/(auth)/login',
    error: '/(auth)/error',
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;

        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          select: { planExpiresAt: true, updatedAt: true },
        });

        if (userData?.planExpiresAt) {
          token.planExpiresAt = userData.planExpiresAt.toISOString();
        }
        // Store password version timestamp for session invalidation
        if (userData?.updatedAt) {
          token.passwordChangedAt = userData.updatedAt.toISOString();
        }
      }

      // Check if password was changed after this token was issued
      if (token.id && token.passwordChangedAt) {
        const userId = typeof token.id === 'string' ? parseInt(token.id as string, 10) : (token.id as number);
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { updatedAt: true },
        });

        if (currentUser && currentUser.updatedAt.toISOString() !== token.passwordChangedAt) {
          // Password was changed - invalidate this session
          return { ...token, invalidated: true };
        }
      }

      if (trigger === 'update' && session?.user) {
        token.role = session.user.role as UserRole;
        if (session.user.planExpiresAt) {
          token.planExpiresAt = session.user.planExpiresAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If token is invalidated, clear session data to force re-login
      if (token.invalidated) {
        session.expires = new Date(0).toISOString();
        return session;
      }

      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (token.planExpiresAt) {
          session.user.planExpiresAt = token.planExpiresAt as string;
        }
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

export const getAuthSession = () => getServerSession(authOptions);

export const getRequiredAuthSession = async () => {
  const session = await getAuthSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return session;
};
