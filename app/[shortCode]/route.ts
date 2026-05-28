import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processClickInBackground } from '@/lib/analytics';
import { UAParser } from 'ua-parser-js';
import { getGeoInfo } from '@/lib/geoLocation';


function normalizeUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await params;

  try {
    const link = await prisma.link.findUnique({
      where: { short_code: shortCode },
      include: { user: { select: { role: true } } },
    });

    if (!link) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new NextResponse('Ce lien a expiré.', { status: 410 });
    }

    // Récupérer les informations de la requête
    const userAgent = req.headers.get('user-agent') || 'Inconnu';
    const referer = req.headers.get('referer') || 'Direct';
    
    
    const isShare = false; 
    
    // Mettre à jour le compteur de partages si nécessaire
    if (isShare) {
      await prisma.link.update({
        where: { id: link.id },
        data: { share_count: { increment: 1 } }
      });
      
      return NextResponse.redirect(normalizeUrl(link.long_url));
    }
    
    // Extraire le nom du site référent
    let refererSite = 'Direct'; 
    if (referer && referer !== 'Direct') {
      try {
        const url = new URL(referer);
        refererSite = url.hostname.replace('www.', '');
        if (refererSite.includes('kut.es') || refererSite.includes('localhost')) {
          refererSite = 'kut.es';
        }
      } catch (e) {
        console.error('Erreur lors de l\'analyse du référent:', e);
      }
    }
    
 
    let ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             req.headers.get('x-real-ip') ||
             '0.0.0.0';
    

    if (process.env.NODE_ENV === 'development' && ip === '::1') {
      ip = '154.160.2.32'; 
      console.log('Mode développement: utilisation d\'une IP de test pour la géolocalisation');
    }
    
    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();
    
    // Récupérer les informations de géolocalisation
    const geoInfo = await getGeoInfo(ip);
    
   
    const clickData = {
      link_id: link.id,
      user_agent: userAgent,
      referer: referer,
      referer_site: refererSite,
      ip_address: ip,
 
      device_type: uaResult.device.type || 'desktop',
      browser: uaResult.browser.name || 'Inconnu',
      os: uaResult.os.name || 'Inconnu',
  
      country: geoInfo.country,
      city: geoInfo.city,
   
      raw_data: JSON.stringify({
        userAgent: uaResult,
        geo: geoInfo.raw_data,
        headers: Object.fromEntries(req.headers.entries())
      })
    };

    try {

      const [updatedLink, click] = await prisma.$transaction([
        // Mettre à jour le compteur de clics
        prisma.link.update({
          where: { id: link.id },
          data: { click_count: { increment: 1 } }
        }),
        
        // Enregistrer les détails du clic
        prisma.click.create({ data: clickData })
      ]);
      
      processClickInBackground(click.id, ip, userAgent);
      console.log(`Clic enregistré avec succès - ID: ${click.id}`, {
        linkId: link.id,
        shortCode: link.short_code,
        clickCount: updatedLink.click_count 
      });
      
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du clic:', error);
    }
    
    const destinationUrl = normalizeUrl(link.long_url);

    // Logique de redirection intermédiaire
    const creatorRole = link.user?.role;
    const isPersonalLinkOfFreeUser = !link.team_id && (!creatorRole || creatorRole === 'FREE');
    const isAnonymousLink = !link.user_id && !link.team_id;

    if (isPersonalLinkOfFreeUser || isAnonymousLink) {
      const encodedTarget = encodeURIComponent(destinationUrl);
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      
      const waitPageUrl = `${cleanBaseUrl}/redirect-wait?target=${encodedTarget}`;
      
      const response = NextResponse.redirect(waitPageUrl);
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      response.headers.set('Pragma', 'no-cache');
      return response;
    }
    
    return NextResponse.redirect(destinationUrl);

  } catch (error) {
    console.error(`Erreur de redirection pour le code ${shortCode}:`, error);
    return NextResponse.redirect(new URL('/', req.nextUrl.origin));
  }
}