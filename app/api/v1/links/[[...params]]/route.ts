import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateShortCode, isReservedSlug } from '@/lib/slugGenerator';
import { authenticateRequest } from '@/lib/apiAuth';

/**
 * Gère la création de liens (anonyme, personnel, ou d'équipe).
 * Endpoint: POST /api/v1/links
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const currentUser = auth.user;

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

    // Validation de l'URL
    let normalizedUrl = longUrl;
    try {
      const urlToValidate = longUrl.startsWith('http://') || longUrl.startsWith('https://')
        ? longUrl
        : `https://${longUrl}`;
      const parsedUrl = new URL(urlToValidate);
      normalizedUrl = urlToValidate;

      // N'autoriser que http et https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json({ success: false, error: 'Seuls les protocoles HTTP et HTTPS sont autorisés.' }, { status: 400 });
      }

      // Bloquer les IPs privées/internes (protection SSRF)
      const hostname = parsedUrl.hostname;
      const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\./,
        /^\[::1\]$/,
        /^\[fc/i,
        /^\[fd/i,
      ];
      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return NextResponse.json({ success: false, error: 'Les URLs pointant vers des adresses internes ne sont pas autorisées.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'URL invalide.' }, { status: 400 });
    }

    let canCustomize = false;
    let finalTeamId: number | null = null;
    
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

    // Déterminer l'ID utilisateur pour le lien
    const userId: number | null = currentUser ? currentUser.id : null;

    // Un même lien ne doit pas avoir plusieurs raccourcis : si cette URL a déjà
    // été raccourcie dans le même contexte (même équipe, même utilisateur, ou
    // anonyme), on renvoie le lien court existant au lieu d'en créer un nouveau.
    // On compare aussi la forme brute pour retrouver les liens créés avant la
    // normalisation (URL stockée sans protocole).
    const existingForUrl = await prisma.link.findFirst({
      where: {
        long_url: { in: [longUrl, normalizedUrl] },
        ...(finalTeamId ? { team_id: finalTeamId } : { user_id: userId, team_id: null }),
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
      orderBy: { created_at: 'asc' },
      include: { user: true, team: true },
    });

    if (existingForUrl) {
      const { config } = await import('@/lib/config');
      return NextResponse.json({
        success: true,
        existing: true,
        data: {
          longUrl: existingForUrl.long_url,
          shortUrl: `${config.appUrl}/${existingForUrl.short_code}`,
          short_code: existingForUrl.short_code,
          title: existingForUrl.title,
          createdAt: existingForUrl.created_at,
          userId: existingForUrl.user_id,
          teamId: existingForUrl.team_id,
          linkedToUser: !!existingForUrl.user_id,
          userName: existingForUrl.user?.name || existingForUrl.user?.email || 'Unknown'
        }
      });
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

      // Reject reserved slugs used by application routes
      if (isReservedSlug(customSlug)) {
        return NextResponse.json(
          { success: false, error: 'Ce slug est réservé et ne peut pas être utilisé.' },
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

    // Créer le lien
    try {
      const linkData: Prisma.LinkUncheckedCreateInput = {
        long_url: normalizedUrl,
        short_code: customSlug || await generateShortCode(prisma),
        title: title || null,
        ...(expiresAt && { expires_at: new Date(expiresAt) }),
        ...(userId !== null && { user_id: userId }),
        ...(finalTeamId && { team_id: finalTeamId }),
      };

      const link = await prisma.link.create({
        data: linkData,
        include: {
          user: true,
          team: true
        }
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
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const user = auth.user;

    if (!user) {
        return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
    }

    const userId = user.id;

    const { searchParams } = new URL(req.url);
    const teamIdStr = searchParams.get('teamId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const skip = (page - 1) * limit;

    try {
        let whereClause: Prisma.LinkWhereInput;

        if (teamIdStr) {
            const teamId = parseInt(teamIdStr);
            const membership = await prisma.teamMember.findUnique({
                where: { teamId_userId: { teamId, userId } }
            });
            if (!membership) {
                return NextResponse.json({ success: false, error: 'Accès non autorisé à cette équipe.' }, { status: 403 });
            }
            whereClause = { team_id: teamId };
        } else {
            whereClause = { user_id: userId, team_id: null };
        }

        const [links, total] = await Promise.all([
            prisma.link.findMany({
                where: whereClause,
                orderBy: { created_at: 'desc' },
                skip,
                take: limit,
            }),
            prisma.link.count({ where: whereClause }),
        ]);

        return NextResponse.json({
            success: true,
            data: links,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Erreur lors de la récupération des liens:", error);
        return NextResponse.json({ success: false, error: 'Une erreur interne est survenue.' }, { status: 500 });
    }
}

/**
 * Gère la suppression d'un lien.
 * Endpoint: DELETE /api/v1/links/{shortCode}
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ params?: string[] }> }) {
    try {
        const { params: routeParams } = await params;
        const shortCode = routeParams?.[0];

        if (!shortCode) {
            return NextResponse.json({ success: false, error: "Code court manquant." }, { status: 400 });
        }

        // Vérifier l'authentification (session ou clé API)
        const auth = await authenticateRequest(req);
        if (auth.error) return auth.error;
        const user = auth.user;

        if (!user) {
            return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
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