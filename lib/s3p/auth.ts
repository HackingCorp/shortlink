

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
  return crypto.randomBytes(16).toString('hex');
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

const isDebug = process.env.NODE_ENV === 'development' && process.env.S3P_LOG_LEVEL === 'debug';

// Génération de la chaîne de base selon la spécification S3P officielle
export const createBaseString = (
  method: string,
  url: string,
  params: Record<string, any>
): string => {
  const sortedKeys = Object.keys(params).sort();

  const parameterString = sortedKeys
    .map(key => {
      const value = params[key];
      return `${key}=${value}`;
    })
    .join('&');

  const baseUrl = url.split('?')[0];

  const baseString = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(parameterString)
  ].join('&');

  if (isDebug) {
    console.log('[S3P] Base string created for', method.toUpperCase(), baseUrl);
  }

  return baseString;
};

// Calcul de la signature HMAC-SHA256 selon la spécification S3P
export const calculateSignature = (baseString: string, secret: string): string => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(baseString, 'utf8');
  return hmac.digest('base64');
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
    s3pAuth_signature_method: 'HMAC-SHA256',
    s3pAuth_timestamp: timestamp,
    s3pAuth_token: S3P_CONFIG.ACCESS_TOKEN
  };

  let allParams: Record<string, any>;

  if (method.toUpperCase() === 'POST') {
    allParams = { ...authParams, ...bodyParams };
  } else {
    allParams = { ...authParams, ...queryParams };
  }

  // Filtrer les valeurs null/undefined/vides
  const filteredParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(allParams)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      filteredParams[key] = String(value).trim();
    }
  }

  const baseString = createBaseString(method, url, filteredParams);
  const signature = calculateSignature(baseString, S3P_CONFIG.ACCESS_SECRET);

  const authHeader = 's3pAuth,' + [
    `s3pAuth_nonce="${nonce}"`,
    `s3pAuth_signature="${signature}"`,
    's3pAuth_signature_method="HMAC-SHA256"',
    `s3pAuth_timestamp="${timestamp}"`,
    `s3pAuth_token="${S3P_CONFIG.ACCESS_TOKEN}"`
  ].join(',');

  if (isDebug) {
    console.log('[S3P] Auth header generated for', method, url);
  }

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

    const authHeader = generateAuthHeader('GET', url, {}, queryParams);

    const queryString = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryString.append(key, String(value));
      }
    });

    const fullUrl = queryString.toString() ? `${url}?${queryString}` : url;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[S3P] GET error:', response.status, fullUrl);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        throw new Error(`S3P Error ${response.status}: ${JSON.stringify(errorData)}`);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[S3P] GET request failed:', endpoint);
      throw error;
    }
  }

  async post(endpoint: string, bodyData: Record<string, any> = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const authHeader = generateAuthHeader('POST', url, bodyData, {});

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 60000);

    try {
      const formData = new URLSearchParams();
      Object.entries(bodyData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[S3P] POST error:', response.status, endpoint);
        throw new Error(`S3P POST Error ${response.status}: ${errorText}`);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[S3P] POST request failed:', endpoint);
      throw error;
    }
  }

  async cashoutGet(serviceId?: number): Promise<any> {
    const endpoint = '/cashout';
    const queryParams: Record<string, any> = {
      xApiVersion: '3.0.0'
    };

    if (serviceId !== undefined) {
      queryParams.serviceid = serviceId;
    }

    return await this.get(endpoint, queryParams);
  }

  async verifytxGet(xApiVersion: string, ptn?: string, trid?: string): Promise<any> {
    if (!ptn && !trid) {
      throw new Error('Au moins un des paramètres ptn ou trid est requis');
    }

    const queryParams: Record<string, string> = {};
    if (ptn) queryParams.ptn = ptn;
    if (trid) queryParams.trid = trid;

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

  return this.post('/collectstd', bodyData);
}
  async testCashoutGet(): Promise<void> {
    try {
      const result1 = await this.cashoutGet();
      const result2 = await this.cashoutGet(2);
      if (isDebug) {
        console.log('[S3P] Test cashoutGet results:', { result1, result2 });
      }
    } catch (error) {
      console.error('[S3P] Test cashoutGet failed:', error);
    }
  }
}


export const s3pClient = new S3PAuthClient();