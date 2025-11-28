

import crypto from 'crypto';
import { S3P_CONFIG } from './config';

interface S3PAuthParams {
  s3pAuth_nonce: string;
  s3pAuth_signature: string;
  s3pAuth_signature_method: string;
  s3pAuth_timestamp: string;
  s3pAuth_token: string;
}

// Génération d'un nonce unique
export const generateNonce = (): string => {
  return Math.random().toString(36).substr(2) + Date.now().toString(36);
};

export const generateTimestamp = (): string => {
  return Math.floor(Date.now() / 1000).toString();
};

export const percentEncode = (str: string): string => {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E');
};

// Génération de la chaîne de base selon la spécification S3P officielle
export const createBaseString = (
  method: string,
  url: string,
  params: Record<string, any>
): string => {
  console.log('=== DEBUG: Création de la chaîne de base S3P ===');
  console.log('Méthode HTTP:', method.toUpperCase());
  console.log('URL:', url);
  console.log('Paramètres bruts:', JSON.stringify(params, null, 2));

  const sortedKeys = Object.keys(params).sort();
  console.log('Clés triées alphabétiquement:', sortedKeys);

  const parameterString = sortedKeys
    .map(key => {
      const value = params[key];
      
      return `${key}=${value}`;
    })
    .join('&');

  console.log('Chaîne de paramètres (Étape 1):', parameterString);

  const baseUrl = url.split('?')[0]; 
  
  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(parameterString)
  ].join('&');

  console.log('URL de base (FQDN):', baseUrl);
  console.log('URL encodée:', percentEncode(baseUrl));
  console.log('Paramètres encodés:', percentEncode(parameterString));
  console.log('Chaîne de base finale (Étape 2):', baseString);

  return baseString;
};

// Calcul de la signature HMAC-SHA1 selon la spécification S3P
export const calculateSignature = (baseString: string, secret: string): string => {
  console.log('=== DEBUG: Calcul de la signature HMAC-SHA1 ===');
  console.log('Chaîne de base:', baseString);
  console.log('Clé secrète:', secret);

  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(baseString, 'utf8');
  const signature = hmac.digest('base64');

  console.log('Signature calculée (base64):', signature);
  return signature;
};

export const generateAuthHeader = (
  method: string,
  url: string,
  bodyParams: Record<string, any> = {},
  queryParams: Record<string, any> = {}
): string => {
  const nonce = generateNonce();
  const timestamp = generateTimestamp();

  const authParams = {
    s3pAuth_nonce: nonce,
    s3pAuth_signature_method: 'HMAC-SHA1',
    s3pAuth_timestamp: timestamp,
    s3pAuth_token: S3P_CONFIG.ACCESS_TOKEN
  };

  console.log('=== DEBUG: Génération de l\'en-tête Authorization S3P ===');
  console.log('Méthode:', method);
  console.log('URL:', url);
  console.log('Paramètres d\'auth:', authParams);

  let allParams: Record<string, any>;

  if (method.toUpperCase() === 'POST') {
    
    allParams = { ...authParams, ...bodyParams };
    console.log('POST: Utilisation des paramètres du body:', bodyParams);
  } else {
    
    allParams = { ...authParams, ...queryParams };
    console.log('GET: Utilisation des paramètres de requête:', queryParams);
  }

  // Filtrer les valeurs null/undefined/vides
  const filteredParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(allParams)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      filteredParams[key] = String(value).trim();
    }
  }

  console.log('Paramètres filtrés pour signature:', JSON.stringify(filteredParams, null, 2));

  const baseString = createBaseString(method, url, filteredParams);
  const signature = calculateSignature(baseString, S3P_CONFIG.ACCESS_SECRET);

  const authHeader = 's3pAuth,' + [
    `s3pAuth_nonce="${nonce}"`,
    `s3pAuth_signature="${signature}"`,
    's3pAuth_signature_method="HMAC-SHA1"',
    `s3pAuth_timestamp="${timestamp}"`,
    `s3pAuth_token="${S3P_CONFIG.ACCESS_TOKEN}"`
  ].join(',');

  console.log('En-tête Authorization final:', authHeader);
  console.log('=== FIN DEBUG ===\n');

  return authHeader;
};

// Classe principale pour les requêtes S3P authentifiées
export class S3PAuthClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = S3P_CONFIG.BASE_URL;
    
    if (!S3P_CONFIG.ACCESS_TOKEN || !S3P_CONFIG.ACCESS_SECRET) {
      throw new Error('S3P credentials manquantes. Vérifiez S3P_ACCESS_TOKEN et S3P_ACCESS_SECRET dans .env');
    }
  }
  
  async get(endpoint: string, queryParams: Record<string, any> = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('=== DEBUG: Requête GET S3P ===');
    console.log('URL de base:', this.baseUrl);
    console.log('Endpoint:', endpoint);
    console.log('URL complète:', url);
    console.log('Paramètres de requête:', queryParams);
  
    // Générer l'en-tête d'authentification avec les paramètres de requête
    const authHeader = generateAuthHeader('GET', url, {}, queryParams);
    
    // Construire l'URL avec les paramètres de requête
    const queryString = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryString.append(key, String(value));
      }
    });
    
    const fullUrl = queryString.toString() ? `${url}?${queryString}` : url;
  
    console.log('URL finale avec query params:', fullUrl);
    console.log('En-tête Authorization:', authHeader);
  
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[S3P GET] Timeout après 60s sur ${fullUrl}`);
      controller.abort();
    }, 60000);
  
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
  
      clearTimeout(timeoutId);
  
      console.log('=== RÉPONSE S3P GET ===');
      console.log('Status:', response.status, response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
  
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur S3P API:', {
          status: response.status,
          statusText: response.statusText,
          url: fullUrl,
          body: errorText
        });
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        throw new Error(`S3P Error ${response.status}: ${JSON.stringify(errorData)}`);
      }
  
      const responseData = await response.json();
      console.log('Données de réponse:', responseData);
      return responseData;
  
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erreur lors de la requête GET:', error);
      throw error;
    }
  }

  // ✅ REQUÊTE POST CORRECTE
  async post(endpoint: string, bodyData: Record<string, any> = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('=== DEBUG: Requête POST S3P ===');
    console.log('URL:', url);
    console.log('Données du body:', bodyData);

    // Générer l'en-tête d'authentification avec les données du body
    const authHeader = generateAuthHeader('POST', url, bodyData, {});

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[S3P POST] Timeout après 60s sur ${url}`);
      controller.abort();
    }, 60000);

    try {
      // S3P attend des données form-urlencoded
      const formData = new URLSearchParams();
      Object.entries(bodyData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

      console.log('Données form-urlencoded:', formData.toString());

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'x-api-version': '3.0.0',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: formData.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('=== RÉPONSE S3P POST ===');
      console.log('Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erreur S3P API POST:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          body: errorText
        });
        
        throw new Error(`S3P POST Error ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('Données de réponse POST:', responseData);
      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Erreur lors de la requête POST:', error);
      throw error;
    }
  }

  async cashoutGet(serviceId?: number): Promise<any> {
    try {
      console.log('=== DEBUG: cashoutGet selon documentation officielle ===');
      
      const endpoint = '/cashout';
      
      const queryParams: Record<string, any> = {
        xApiVersion: '3.0.0'
      };
      
      
      if (serviceId !== undefined) {
        queryParams.serviceid = serviceId;
      }
      
      console.log('Endpoint:', endpoint);
      console.log('Paramètres de requête:', queryParams);
      
      return await this.get(endpoint, queryParams);
    } catch (error) {
      console.error('Erreur cashoutGet:', error);
      throw error;
    }
  }

  async verifytxGet(xApiVersion: string, ptn?: string, trid?: string): Promise<any> {
    if (!ptn && !trid) {
      throw new Error('Au moins un des paramètres ptn ou trid est requis');
    }

    const queryParams: Record<string, string> = {};
    if (ptn) queryParams.ptn = ptn;
    if (trid) queryParams.trid = trid;

    console.log('[verifytxGet] Vérification transaction:', queryParams);
    return this.get('/verifytx', queryParams);
  }

  async quotesStdPost(body: {
    payItemId: string;
    amount: string;
    currency: string;
    payItemDescr: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    metadata: string;
  }): Promise<any> {
    console.log('[quotesStdPost] Création de devis:', body);
    return this.post('/quotestd', body);
  }

async collectstdPost(xApiVersion: string, bodyData: {
  quoteId: string; 
  customerPhonenumber: string;
  customerEmailaddress: string;
  customerName?: string;
  customerAddress?: string;
  customerNumber?: string;
  serviceNumber?: string;
  trid?: string;
  tag?: string;
  callbackUrl?: string;
  cdata?: string;
}): Promise<any> {
  
  const requiredFields = [
    'quoteId', 
    'customerPhonenumber', 
    'customerEmailaddress'
  ];
  
  for (const field of requiredFields) {
    if (!bodyData[field as keyof typeof bodyData]) {
      throw new Error(`Le champ ${field} est requis pour collectstd`);
    }
  }

  console.log('[collectstdPost] Collecte de paiement:', bodyData);
  return this.post('/collectstd', bodyData);
}
  async testCashoutGet(): Promise<void> {
    try {
      console.log('=== TEST cashoutGet ===');
      
      console.log('Test 1: cashoutGet sans serviceid');
      const result1 = await this.cashoutGet();
      console.log('Résultat sans serviceid:', result1);
      
      console.log('Test 2: cashoutGet avec serviceid=2');
      const result2 = await this.cashoutGet(2);
      console.log('Résultat avec serviceid=2:', result2);
      
    } catch (error) {
      console.error('Test cashoutGet échoué:', error);
    }
  }
}


export const s3pClient = new S3PAuthClient();