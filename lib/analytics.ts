import prisma from './prisma';

/**
 * Enrichit les informations d'un clic avec des données de géolocalisation et d'appareil
 */
export async function enrichClick(clickId: number, ip: string, userAgent: string) {
  try {
    // Détection du navigateur et de l'OS à partir du User-Agent
    const deviceInfo = detectDevice(userAgent);
    const deviceType = detectDeviceType(userAgent);
    
    // Préparer les données de base
    const updateData: any = {
      browser: deviceInfo.browser || 'Inconnu',
      os: deviceInfo.os || 'Inconnu',
      device_type: deviceType,
      raw_data: {
        user_agent: userAgent,
        detected_at: new Date().toISOString()
      }
    };

    // Si ce n'est pas une adresse IP locale, on essaie la géolocalisation
    if (!isLocalIP(ip)) {
      try {
        console.log(`[DEBUG] Tentative de géolocalisation pour l'IP: ${ip}`);
        const geoData = await fetchGeoData(ip);
        
        if (geoData) {
          console.log('[DEBUG] Données brutes de géolocalisation:', JSON.stringify(geoData, null, 2));
          
          // Mettre à jour les champs de localisation avec des valeurs par défaut explicites
          updateData.country = geoData.country || 'Inconnu';
          updateData.city = geoData.city || 'Inconnu';
          updateData.region = geoData.region || null;
          
          console.log('[DEBUG] Données après traitement:', {
            country: updateData.country,
            city: updateData.city,
            region: updateData.region
          });
          
          // Si on a des coordonnées, on les enregistre
          if (geoData.loc && geoData.loc[0] && geoData.loc[1]) {
            updateData.latitude = parseFloat(geoData.loc[0]);
            updateData.longitude = parseFloat(geoData.loc[1]);
          }
          
          // Mettre à jour les données brutes
          updateData.raw_data = {
            ...updateData.raw_data,
            ip: geoData.ip || ip,
            isp: geoData.isp,
            org: geoData.org,
            as: geoData.as,
            mobile: geoData.mobile,
            proxy: geoData.proxy,
            hosting: geoData.hosting,
            hostname: geoData.hostname,
            location: geoData.loc ? {
              latitude: geoData.loc[0],
              longitude: geoData.loc[1]
            } : null,
            geolocation_source: 'ipinfo.io'
          };
        } else {
          console.warn('Aucune donnée de géolocalisation disponible');
        }
      } catch (error) {
        console.error('Erreur lors de la géolocalisation:', error);
        // En cas d'erreur, on enregistre l'erreur dans les données brutes
        updateData.raw_data = {
          ...updateData.raw_data,
          geolocation_error: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      console.log('IP locale détectée, géolocalisation ignorée');
    }

    // Mettre à jour le clic avec les informations disponibles
    // Ne conserver que les champs qui existent dans le modèle Prisma
    const validUpdateData = {
      country: updateData.country,
      city: updateData.city,
      device_type: updateData.device_type,
      browser: updateData.browser,
      os: updateData.os,
      raw_data: updateData.raw_data,
      user_agent: updateData.user_agent
    };

    console.log('[DEBUG] Données à mettre à jour dans la base de données:', JSON.stringify(validUpdateData, null, 2));
    
    const updatedClick = await prisma.click.update({
      where: { id: clickId },
      data: validUpdateData,
      select: {
        id: true,
        country: true,
        city: true,
        device_type: true,
        browser: true,
        os: true
      }
    });
    
    console.log('[DEBUG] Clic mis à jour dans la base de données:', JSON.stringify(updatedClick, null, 2));
  } catch (error) {
    console.error('Erreur lors de l\'enrichissement du clic:', error);
  }
}

/**
 * Vérifie si l'adresse IP est locale
 */
function isLocalIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' || 
    ip === '::1' || 
    ip.startsWith('192.168.') || 
    ip.startsWith('10.') || 
    ip.startsWith('172.') ||
    ip === '0.0.0.0'
  );
}

/**
 * Récupère les données de géolocalisation depuis ipinfo.io (plus fiable pour le pays/ville)
 */
async function fetchGeoData(ip: string) {
  try {
    // Essayer d'abord avec ipinfo.io (plus fiable pour la localisation)
    const response = await fetch(`https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN || 'YOUR_IPINFO_TOKEN'}`);
    
    if (!response.ok) {
      // Si échec, essayer avec ip-api.com comme solution de secours
      console.log('Essai avec ip-api.com comme solution de secours...');
      return await fetchGeoDataFallback(ip);
    }
    
    const data = await response.json();
    
    // Formater les données pour correspondre à notre modèle
    return {
      country: data.country || null,
      city: data.city || null,
      region: data.region || null,
      loc: data.loc ? data.loc.split(',') : [null, null],
      org: data.org || null,
      hostname: data.hostname || null,
      ip: data.ip || ip,
      // Données supplémentaires pour la rétrocompatibilité
      isp: data.org || null,
      as: data.org ? data.org.split(' ')[0] : null,
      mobile: data.mobile || false,
      proxy: data.proxy || false,
      hosting: data.hosting || false
    };
  } catch (error) {
    console.error('Erreur avec ipinfo.io, tentative avec ip-api.com...', error);
    return await fetchGeoDataFallback(ip);
  }
}

/**
 * Solution de secours avec ip-api.com
 */
async function fetchGeoDataFallback(ip: string) {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,region,regionName,isp,org,as,query,lat,lon,mobile,proxy,hosting`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message || 'Échec de la géolocalisation');
    }
    
    // Formater les données pour correspondre à notre modèle
    return {
      country: data.country || data.countryCode || null,
      city: data.city || null,
      region: data.regionName || data.region || null,
      loc: [data.lat, data.lon],
      org: data.org || data.isp || null,
      ip: data.query || ip,
      // Données supplémentaires
      isp: data.isp || null,
      as: data.as || null,
      mobile: data.mobile || false,
      proxy: data.proxy || false,
      hosting: data.hosting || false
    };
  } catch (error) {
    console.error('Échec de la géolocalisation avec ip-api.com:', error);
    return null;
  }
}

/**
 * Détecte le type d'appareil à partir du User-Agent
 */
function detectDeviceType(userAgent: string): string {
  if (!userAgent) return 'inconnu';
  
  const ua = userAgent.toLowerCase();
  
  // Détection des tablettes
  if (ua.includes('tablet') || ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    return 'tablet';
  }
  
  // Détection des mobiles
  if (ua.includes('mobile') || 
      ua.includes('android') || 
      ua.includes('iphone') || 
      ua.includes('ipod') || 
      ua.includes('windows phone')) {
    return 'mobile';
  }
  
  // Détection des bots et autres
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
    return 'bot';
  }
  
  // Par défaut, on considère que c'est un ordinateur de bureau
  return 'desktop';
}

/**
 * Détecte le navigateur et l'OS à partir du User-Agent
 */
function detectDevice(userAgent: string): { browser: string | null; os: string | null } {
  if (!userAgent) return { browser: 'Inconnu', os: 'Inconnu' };
  
  const ua = userAgent.toLowerCase();
  
  // Détection du navigateur
  let browser = 'Inconnu';
  if (ua.includes('edg/') || ua.includes('edga') || ua.includes('edgios')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    browser = 'Opera';
  } else if (ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Chrome';
  } else if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')) {
    browser = 'Safari';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'Internet Explorer';
  } else if (ua.includes('samsungbrowser')) {
    browser = 'Samsung Browser';
  } else if (ua.includes('chrome') || ua.includes('chromium')) {
    browser = 'Chrome';
  }
  
  // Détection de l'OS
  let os = 'Inconnu';
  if (ua.includes('windows')) {
    os = 'Windows';
    if (ua.includes('windows nt 10') || ua.includes('windows nt 11')) {
      os += ' 10/11';
    } else if (ua.includes('windows nt 6.3')) {
      os += ' 8.1';
    } else if (ua.includes('windows nt 6.2')) {
      os += ' 8';
    } else if (ua.includes('windows nt 6.1')) {
      os += ' 7';
    } else if (ua.includes('windows nt 6.0')) {
      os += ' Vista';
    } else if (ua.includes('windows nt 5.1')) {
      os += ' XP';
    }
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
    if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('cros')) {
      os = 'Chrome OS';
    }
  } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    os = 'iOS';
  } else if (ua.includes('android')) {
    os = 'Android';
  }
  
  return { browser, os };
}

/**
 * Traite un clic en arrière-plan (enrichissement des données)
 */
export async function processClickInBackground(clickId: number, ip: string, userAgent: string) {
  try {
    console.log(`Traitement du clic ${clickId} en arrière-plan...`);
    await enrichClick(clickId, ip, userAgent);
  } catch (error) {
    console.error('Erreur lors du traitement du clic:', error);
    
    // En cas d'erreur, on essaie de sauvegarder au moins les informations de base
    try {
      const deviceInfo = detectDevice(userAgent);
      await prisma.click.update({
        where: { id: clickId },
        data: {
          browser: deviceInfo.browser || 'Inconnu',
          os: deviceInfo.os || 'Inconnu',
          device_type: detectDeviceType(userAgent),
          raw_data: {
            error: 'Erreur lors de l\'enrichissement',
            user_agent: userAgent,
            ip: ip,
            error_message: error instanceof Error ? error.message : String(error)
          }
        }
      });
    } catch (innerError) {
      console.error('Erreur lors de la sauvegarde des informations de base:', innerError);
    }
  }
}
