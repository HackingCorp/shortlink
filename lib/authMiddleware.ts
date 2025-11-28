import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from './prisma';
import { User } from '@prisma/client';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

/**
 * Middleware de haut niveau pour protéger une API.
 * Vérifie la session NextAuth et le rôle de l'utilisateur.
 * @param allowedRoles Array des rôles autorisés (ex: ['PRO', 'ENTERPRISE'])
 */
export function withRoleAuthorization(allowedRoles: string[]) {
  return function(handler: (req: AuthenticatedRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function(req: NextRequest, ...args: any[]) {
      const session = await getServerSession(authOptions);

      if (!session?.user?.email) {
        return NextResponse.json(
          { success: false, error: 'Authentification requise.' },
          { status: 401 }
        );
      }

      const user = await prisma.user.findUnique({ 
        where: { email: session.user.email },
        select: { id: true, email: true, role: true, name: true }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Utilisateur non trouvé.' },
          { status: 401 }
        );
      }

      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { success: false, error: 'Accès non autorisé. Permissions insuffisantes.' },
          { status: 403 }
        );
      }

      (req as any).user = user;
      return handler(req as AuthenticatedRequest, ...args);
    };
  };
}