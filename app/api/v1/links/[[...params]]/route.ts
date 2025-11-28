import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { User, PrismaClient, UserRole } from '@prisma/client';

// Types pour l'extension de NextAuth
import { DefaultSession, DefaultUser } from 'next-auth';



// ===================================================================
// DÉBUT DU CODE INTÉGRÉ (anciennement lib/slugGenerator.ts)
// ===================================================================

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MIN_LENGTH = 2;
const MAX_LENGTH = 5;
const MAX_RETRIES_PER_LENGTH = 20;

function generateRandomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

/**
 * Génère un code court unique.
 * @param db - L'instance du client Prisma à utiliser pour les requêtes BDD.
 */
async function generateShortCode(db: PrismaClient): Promise<string> {
  const config = await db.systemConfig.findUnique({ where: { id: 1 } });
  if (!config) {
      await db.systemConfig.create({ data: { id: 1, slug_generation_length: MIN_LENGTH }});
  }
  const currentConfig = await db.systemConfig.findUnique({ where: { id: 1 } });
  let currentLength = currentConfig ? currentConfig.slug_generation_length : MIN_LENGTH;

  for (let length = currentLength; length <= MAX_LENGTH; length++) {
    if (length > currentLength) {
      await db.systemConfig.update({
        where: { id: 1 },
        data: { slug_generation_length: length },
      });
      currentLength = length;
    }
    for (let i = 0; i < MAX_RETRIES_PER_LENGTH; i++) {
      const slug = generateRandomString(length);
      const existingLink = await db.link.findUnique({ where: { short_code: slug } });
      if (!existingLink) {
        return slug;
      }
    }
  }
  throw new Error('Impossible de générer un code court unique.');
}
// ===================================================================
// FIN DU CODE INTÉGRÉ
// ===================================================================


/**
 * Gère la création de liens (anonyme, personnel, ou d'équipe).
 * Endpoint: POST /api/v1/links
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id: string; role?: UserRole } | undefined;
    let user: User | null = null;
    let apiUser: User | null = null;
    
    // Vérifier si la requête provient d'une clé API
    const apiKey = req.headers.get('x-api-key');
    
    console.log('=== DEBUG API ===');
    console.log('API Key from header:', apiKey ? 'Present' : 'Not found');
    console.log('Session User:', sessionUser ? 'Present' : 'Not found');
    
    if (apiKey) {
      console.log('Searching for API key in database...');
      try {
        // Récupérer l'utilisateur associé à la clé API
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: { key: apiKey },
          include: { user: true }
        });
        
        console.log('API Key Record found:', !!apiKeyRecord);
        console.log('User associated with API key:', apiKeyRecord?.user ? `ID: ${apiKeyRecord.user.id}` : 'None');
        
        if (apiKeyRecord?.user) {
          apiUser = apiKeyRecord.user;
          // Mettre à jour la date de dernière utilisation
          await prisma.apiKey.update({
            where: { id: apiKeyRecord.id },
            data: { lastUsed: new Date() }
          });
        } else {
          console.log('API key not found or no user associated');
          return NextResponse.json({ 
            success: false, 
            error: 'Clé API invalide ou utilisateur non trouvé.' 
          }, { status: 401 });
        }
      } catch (apiError) {
        console.error('Error fetching API key:', apiError);
        return NextResponse.json({ 
          success: false, 
          error: 'Erreur lors de la vérification de la clé API.' 
        }, { status: 500 });
      }
    } else if (sessionUser?.id) {
      user = await prisma.user.findUnique({ 
        where: { 
          id: parseInt(sessionUser.id) 
        } 
      });
    }

    const body = await req.json();
    const { longUrl, customSlug, title, teamId, expiresAt } = body as {
      longUrl: string;
      customSlug?: string;
      title?: string;
      teamId?: string;
      expiresAt?: string;
    };

    if (!longUrl) {
      return NextResponse.json({ success: false, error: 'URL longue requise.' }, { status: 400 });
    }

    // Déterminer l'utilisateur actuel (session ou API)
    const currentUser = user || apiUser;
    let canCustomize = false;
    let finalTeamId: number | null = null;
    
    console.log('Current user:', currentUser ? `ID: ${currentUser.id}, Role: ${currentUser.role}` : 'None');
    
    // Vérifier les permissions de personnalisation
    if (currentUser) {
      if (teamId) {
        // Vérifier si l'utilisateur est membre de l'équipe avec les bonnes permissions
        const membership = await prisma.teamMember.findFirst({
          where: {
            userId: currentUser.id,
            teamId: parseInt(teamId),
            role: { in: ['ADMIN', 'OWNER'] }
          }
        });
        
        if (membership) {
          finalTeamId = parseInt(teamId);
          canCustomize = true;
        } else {
          return NextResponse.json(
            { success: false, error: 'Vous n\'êtes pas membre de cette équipe ou n\'avez pas les permissions nécessaires.' }, 
            { status: 403 }
          );
        }
      } else {
        // Vérifier les permissions pour les liens personnels
        canCustomize = ['STANDARD', 'PRO', 'ENTERPRISE', 'ADMIN'].includes(currentUser.role || '');
      }
    }

    // Vérifier si un slug personnalisé est fourni et si l'utilisateur a la permission
    if (customSlug) {
      if (!canCustomize) {
        return NextResponse.json(
          { success: false, error: 'Vous n\'avez pas la permission de personnaliser les slugs.' },
          { status: 403 }
        );
      }

      // Valider le format du slug personnalisé (optionnel)
      const slugRegex = /^[a-zA-Z0-9_-]+$/;
      if (!slugRegex.test(customSlug)) {
        return NextResponse.json(
          { success: false, error: 'Le slug personnalisé ne doit contenir que des lettres, chiffres, tirets et underscores.' },
          { status: 400 }
        );
      }

      // Vérifier si le slug personnalisé est déjà utilisé
      const existingLink = await prisma.link.findUnique({
        where: { short_code: customSlug }
      });

      if (existingLink) {
        return NextResponse.json(
          { success: false, error: 'Ce slug est déjà utilisé.' },
          { status: 400 }
        );
      }
    }

    // CORRECTION : Déterminer l'ID utilisateur pour le lien
    let userId: number | null = null;
    
    if (user) {
      // Utilisateur connecté via session
      userId = parseInt(user.id.toString());
    } else if (apiUser) {
      // Utilisateur via clé API - s'assurer que l'ID est bien assigné
      userId = apiUser.id;
      console.log('Using API user ID:', userId);
    }
    
    console.log('Final userId for link:', userId);
    console.log('Final teamId for link:', finalTeamId);
    console.log('Custom slug:', customSlug);
    console.log('Can customize:', canCustomize);
    
    // Créer le lien
    try {
      const linkData: any = {
        long_url: longUrl,
        short_code: customSlug || await generateShortCode(prisma),
        title: title || null,
        ...(expiresAt && { expires_at: new Date(expiresAt) })
      };

      // CORRECTION : Toujours associer le lien à l'utilisateur si disponible
      if (userId !== null) {
        linkData.user_id = userId;
      }

      // Associer à l'équipe si spécifiée
      if (finalTeamId) {
        linkData.team_id = finalTeamId;
      }

      console.log('Link data to create:', linkData);

      const link = await prisma.link.create({
        data: linkData,
        include: {
          user: true,
          team: true
        }
      });

      console.log('Link created:', {
        id: link.id,
        shortCode: link.short_code,
        userId: link.user_id,
        teamId: link.team_id,
        userFromDB: link.user?.id || 'No user linked'
      });

      // Utiliser la configuration centralisée pour l'URL courte
      const { config } = await import('@/lib/config');
      const shortUrl = `${config.appUrl}/${link.short_code}`;
      
      return NextResponse.json({
        success: true,
        data: {
          longUrl: link.long_url,
          shortUrl: shortUrl,
          short_code: link.short_code,  // Assurez-vous que ce champ est inclus
          title: link.title,
          createdAt: link.created_at,
          // Informations additionnelles pour le debugging
          userId: link.user_id,
          teamId: link.team_id,
          // Confirmation que l'utilisateur est bien lié
          linkedToUser: !!link.user_id,
          userName: link.user?.name || link.user?.email || 'Unknown'
        }
      });
    } catch (error) {
      console.error('Error creating link:', error);
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la création du lien' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in POST /api/v1/links:', error);
    return NextResponse.json(
      { success: false, error: 'Une erreur est survenue lors de la création du lien.' },
      { status: 500 }
    );
  }
}

/**
 * Gère la récupération des listes de liens (personnels ou d'équipe).
 * Endpoint: GET /api/v1/links
 * Endpoint: GET /api/v1/links?teamId={id}
 */
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id: string; role?: UserRole } | undefined;
    
    if (!sessionUser?.id) {
        return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    }
    
    const userId = parseInt(sessionUser.id);
    const user = await prisma.user.findUnique({ where: { id: userId }});
    if (!user) {
        return NextResponse.json({ success: false, error: 'Utilisateur non trouvé.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const teamIdStr = searchParams.get('teamId');

    try {
        if (teamIdStr) {
            const teamId = parseInt(teamIdStr);
            const membership = await prisma.teamMember.findUnique({
                where: { teamId_userId: { teamId, userId } }
            });
            if (!membership) {
                return NextResponse.json({ success: false, error: 'Accès non autorisé à cette équipe.' }, { status: 403 });
            }
            const links = await prisma.link.findMany({ where: { team_id: teamId }, orderBy: { created_at: 'desc' } });
            return NextResponse.json({ success: true, data: links });
        } else {
            const links = await prisma.link.findMany({ where: { user_id: userId, team_id: null }, orderBy: { created_at: 'desc' } });
            return NextResponse.json({ success: true, data: links });
        }
    } catch (error) {
        console.error("Erreur lors de la récupération des liens:", error);
        return NextResponse.json({ success: false, error: 'Une erreur interne est survenue.' }, { status: 500 });
    }
}

/**
 * Gère la suppression d'un lien.
 * Endpoint: DELETE /api/v1/links/{shortCode}
 */
export async function DELETE(req: NextRequest, { params }: { params: { params: string[] } }) {
    try {
        const { params: routeParams } = params;
        const shortCode = routeParams?.[0];

        if (!shortCode) {
            return NextResponse.json({ success: false, error: "Code court manquant." }, { status: 400 });
        }

        // Vérifier l'authentification
        const session = await getServerSession(authOptions);
        const sessionUser = session?.user as { id: string; role?: UserRole } | undefined;
        
        if (!sessionUser?.id) {
            return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ 
            where: { id: parseInt(sessionUser.id) } 
        });

        if (!user) {
            return NextResponse.json({ success: false, error: "Utilisateur non trouvé." }, { status: 404 });
        }

        // Récupérer le lien
        const link = await prisma.link.findUnique({ 
            where: { short_code: shortCode } 
        });
        
        if (!link) {
            return NextResponse.json({ success: false, error: "Lien non trouvé." }, { status: 404 });
        }

        // Vérifier les permissions
        const isOwner = link.user_id === user.id;
        const isAdmin = user.isAdmin === true;
        let isTeamAdmin = false;

        // Vérifier les permissions d'équipe si le lien appartient à une équipe
        if (link.team_id) {
            const teamMembership = await prisma.teamMember.findFirst({
                where: {
                    teamId: link.team_id,
                    userId: user.id,
                    role: { in: ['ADMIN', 'OWNER'] }
                }
            });
            isTeamAdmin = !!teamMembership;
        }

        if (!isOwner && !isAdmin && !isTeamAdmin) {
            return NextResponse.json(
                { success: false, error: "Permissions insuffisantes pour supprimer ce lien." }, 
                { status: 403 }
            );
        }

        // Supprimer le lien
        await prisma.link.delete({ 
            where: { 
                short_code: shortCode 
            } 
        });
        
        return NextResponse.json({ 
            success: true, 
            message: "Lien supprimé avec succès." 
        });
    } catch (error) {
        console.error("Erreur lors de la suppression du lien:", error);
        return NextResponse.json(
            { 
                success: false, 
                error: 'Une erreur est survenue lors de la suppression du lien.' 
            }, 
            { status: 500 }
        );
    }
}