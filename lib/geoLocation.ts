export interface GeoInfo {
  country: string;
  city: string;
  raw_data: Record<string, unknown>;
}

/**
 * Checks if an IP address is local/private.
 */
export function isLocalIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip === '0.0.0.0'
  );
}

/**
 * Fetches with a timeout to avoid hanging on unresponsive geo APIs.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 2000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Retrieves geolocation info for an IP address.
 * Tries multiple providers with fallback: ip-api.com -> ipinfo.io -> ipapi.co
 */
export async function getGeoInfo(ip: string): Promise<GeoInfo> {
  try {
    if (isLocalIP(ip)) {
      return {
        country: 'Local',
        city: 'Local',
        raw_data: { isLocal: true },
      };
    }

    // Try ip-api.com first
    try {
      const response = await fetchWithTimeout(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,region,regionName,isp,org,as,mobile,proxy,hosting,query`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.country) {
          return {
            country: data.country,
            city: data.city || data.regionName || 'Inconnu',
            raw_data: { source: 'ip-api.com', ...data },
          };
        }
      }
    } catch (error) {
      console.warn('Geolocation failed with ip-api.com:', error instanceof Error ? error.message : String(error));
    }

    // Try ipinfo.io
    try {
      const response = await fetchWithTimeout(
        `https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN || ''}`,
        {},
        5000
      );

      if (response.ok) {
        const data = await response.json();
        if (data.country) {
          return {
            country: data.country,
            city: data.city || data.region || 'Inconnu',
            raw_data: { source: 'ipinfo.io', ...data },
          };
        }
      }
    } catch (error) {
      console.warn('Geolocation failed with ipinfo.io:', error instanceof Error ? error.message : String(error));
    }

    // Try ipapi.co as last fallback
    try {
      const response = await fetchWithTimeout(
        `https://ipapi.co/${ip}/json/`,
        { headers: { 'User-Agent': 'shortlink-app/1.0' } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.country_name) {
          return {
            country: data.country_name,
            city: data.city || data.region || 'Inconnu',
            raw_data: { source: 'ipapi.co', ...data },
          };
        }
      }
    } catch (error) {
      console.warn('Geolocation failed with ipapi.co:', error instanceof Error ? error.message : String(error));
    }

    return {
      country: 'Inconnu',
      city: 'Inconnu',
      raw_data: {
        error: 'All geolocation attempts failed',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Critical error in getGeoInfo:', error);
    return {
      country: 'Erreur',
      city: 'Erreur',
      raw_data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
