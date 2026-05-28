import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { User, UserRole } from '@prisma/client';

export interface AuthResult {
  user: User | null;
  error?: NextResponse;
}

/**
 * Authenticates a request via session or API key.
 * Returns the user or an error response.
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const apiKey = req.headers.get('x-api-key');

  if (apiKey) {
    try {
      const apiKeyRecord = await prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: { user: true },
      });

      if (apiKeyRecord?.user) {
        await prisma.apiKey.update({
          where: { id: apiKeyRecord.id },
          data: { lastUsed: new Date() },
        });
        return { user: apiKeyRecord.user };
      } else {
        return {
          user: null,
          error: NextResponse.json(
            { success: false, error: 'Cle API invalide ou utilisateur non trouve.' },
            { status: 401 }
          ),
        };
      }
    } catch {
      return {
        user: null,
        error: NextResponse.json(
          { success: false, error: 'Erreur lors de la verification de la cle API.' },
          { status: 500 }
        ),
      };
    }
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { id: string; role?: UserRole } | undefined;

  if (sessionUser?.id) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(sessionUser.id) },
    });
    return { user };
  }

  return { user: null };
}

/**
 * Requires authentication - returns user or 401 error response.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const result = await authenticateRequest(req);
  if (result.error) return result;

  if (!result.user) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: 'Authentification requise.' },
        { status: 401 }
      ),
    };
  }

  return result;
}
