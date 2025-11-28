import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processClickInBackground } from '@/lib/analytics';

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
      // Si le lien n'est pas trouvé, on redirige vers la page d'accueil
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new NextResponse('Ce lien a expiré.', { status: 410 });
    }

    // Récupérer les informations du navigateur
    const userAgent = req.headers.get('user-agent') || 'Inconnu';
    const referer = req.headers.get('referer') || 'Direct';
    const ip = req.headers.get('x-forwarded-for') || 
              req.headers.get('x-real-ip') || 
              (req as any).socket?.remoteAddress || 
              '0.0.0.0';
    
    console.log(`Enregistrement du clic pour le lien ${link.id} (${link.short_code})`);
    console.log(`- IP: ${ip}`);
    console.log(`- User-Agent: ${userAgent.substring(0, 50)}...`);
    console.log(`- Referer: ${referer}`);
    
    try {
      // Enregistrement du clic avec les détails en arrière-plan
      const [_, click] = await Promise.all([
        // Mettre à jour le compteur de clics
        prisma.link.update({
          where: { id: link.id },
          data: { click_count: { increment: 1 } }
        }),
        
        // Enregistrer les détails du clic
        prisma.click.create({
          data: {
            link_id: link.id,
            user_agent: userAgent,
            referer: referer,
            ip_address: ip,
            // Les champs suivants seront mis à jour par le service d'analyse
            country: null,
            city: null,
            device_type: null,
            browser: null,
            os: null,
          }
        })
      ]);
      
      console.log(`Clic enregistré avec l'ID: ${click.id}`);
      
      // Traiter le clic en arrière-plan pour l'enrichissement des données
      processClickInBackground(click.id, ip, userAgent);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du clic:', error);
    }
    
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
