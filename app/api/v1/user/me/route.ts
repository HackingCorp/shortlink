import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Vérifier l'authentification
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Récupérer les informations de base de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      include: {
        links: {
          select: {
            id: true,
            short_code: true,
            long_url: true,
            clicks: {
              select: {
                id: true,
                clicked_at: true
              },
              orderBy: {
                clicked_at: 'desc'
              },
              take: 1
            },
            _count: {
              select: { clicks: true }
            }
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 5
        },
        _count: {
          select: {
            links: true,
            apiKeys: true
          }
        }
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Type personnalisé pour l'utilisateur avec les relations
    type UserWithRelations = typeof user & {
      links: Array<{
        id: number;
        shortCode: string;
        originalUrl: string;
        clicks: Array<{ id: number; clicked_at: Date }>;
        _count: { clicks: number };
      }>;
      _count: {
        links: number;
        apiKeys: number;
      };
    };

    // Convertir le type de l'utilisateur
    const typedUser = user as unknown as UserWithRelations;

    // Calculer les statistiques de base
    const stats = {
      totalLinks: typedUser._count?.links || 0,
      totalClicks: typedUser.links?.reduce((sum, link) => sum + (link._count?.clicks || 0), 0) || 0,
      totalApiKeys: typedUser._count?.apiKeys || 0,
      lastClicks: typedUser.links?.map(link => ({
        shortCode: link.short_code,
        lastClick: link.clicks[0]?.clicked_at || null,
        totalClicks: link._count?.clicks || 0
      })) || []
    };

    // Supprimer les champs sensibles de l'objet utilisateur
    const { _count, links, password, ...userData } = typedUser as any;

    return NextResponse.json({
      success: true,
      data: {
        user: userData,
        stats
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des informations utilisateur:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
