import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processClickInBackground } from '@/lib/analytics';
import { UAParser } from 'ua-parser-js';
import { getClientIp } from 'request-ip';


function normalizeUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

async function getGeoInfo(ip: string) {
  try {
    // Vérifier les adresses locales
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      console.log('IP locale détectée, utilisation des valeurs par défaut');
      return { 
        country: 'Local', 
        city: 'Local', 
        raw_data: { isLocal: true } 
      };
    }

    console.log(`Tentative de géolocalisation pour l'IP: ${ip}`);
    
    const fetchWithTimeout = async (url: string, options = {}, timeout = 2000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };


    try {
      console.log('Essai avec ip-api.com...');
      const response = await fetchWithTimeout(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,region,regionName,isp,org,as,mobile,proxy,hosting,query`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Réponse de ip-api.com:', JSON.stringify(data, null, 2));
        
        if (data.status === 'success' && data.country) {
          return {
            country: data.country,
            city: data.city || data.regionName || 'Inconnu',
            raw_data: { source: 'ip-api.com', ...data }
          };
        }
      }
    } catch (error) {
      console.warn('Échec avec ip-api.com:', error instanceof Error ? error.message : String(error));
    }

    try {
      console.log('Essai avec ipinfo.io...');
      const response = await fetchWithTimeout(
        `https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN || 'test'}`,
        {},
        5000 
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Réponse de ipinfo.io:', JSON.stringify(data, null, 2));

        if (data.country) {
          return {
            country: data.country,
            city: data.city || data.region || 'Inconnu',
            raw_data: { source: 'ipinfo.io', ...data }
          };
        }
      }
    } catch (error) {
      console.warn('Échec avec ipinfo.io:', error instanceof Error ? error.message : String(error));
    }


    try {
      console.log('Dernier essai avec ipapi.co...');
      const response = await fetchWithTimeout(
        `https://ipapi.co/${ip}/json/`,
        { headers: { 'User-Agent': 'shortlink-app/1.0' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Réponse de ipapi.co:', JSON.stringify(data, null, 2));
        
        if (data.country_name) {
          return {
            country: data.country_name,
            city: data.city || data.region || 'Inconnu',
            raw_data: { source: 'ipapi.co', ...data }
          };
        }
      }
    } catch (error) {
      console.warn('Échec avec ipapi.co:', error instanceof Error ? error.message : String(error));
    }

  
    console.warn('Toutes les tentatives de géolocalisation ont échoué');
    return {
      country: 'Inconnu',
      city: 'Inconnu',
      raw_data: { 
        error: 'Toutes les tentatives de géolocalisation ont échoué',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Erreur critique dans getGeoInfo:', error);
    return { 
      country: 'Erreur', 
      city: 'Erreur', 
      raw_data: { 
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString()
      } 
    };
  }
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
             (req as any).socket?.remoteAddress || 
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