import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Normalise une URL pour s'assurer qu'elle est absolue.
 */
function normalizeUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `https://${url}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  const { shortCode } = params;

  try {
    const link = await prisma.link.findUnique({
      where: { short_code: shortCode },
      include: { user: { select: { role: true } } },
    });

    if (!link) {
      // Si le lien n'est pas trouvé, on redirige vers la page d'accueil (ou une page 404)
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new NextResponse('Ce lien a expiré.', { status: 410 });
    }

    // Enregistrement du clic en arrière-plan
    prisma.link.update({
      where: { id: link.id },
      data: { click_count: { increment: 1 } }
    }).catch(console.error);
    
    const destinationUrl = normalizeUrl(link.long_url);

    // Logique de redirection intermédiaire
    const creatorRole = link.user?.role;
    const isPersonalLinkOfFreeUser = !link.team_id && (!creatorRole || creatorRole === 'FREE');
    const isAnonymousLink = !link.user_id && !link.team_id;

    if (isPersonalLinkOfFreeUser || isAnonymousLink) {
      const waitPageUrl = new URL('/redirect-wait', req.nextUrl.origin);
      waitPageUrl.searchParams.set('target', destinationUrl);
      return NextResponse.redirect(waitPageUrl);
    }
    
    // Redirection directe finale
    return NextResponse.redirect(destinationUrl);

  } catch (error) {
    console.error(`Erreur de redirection pour le code ${shortCode}:`, error);
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }
}