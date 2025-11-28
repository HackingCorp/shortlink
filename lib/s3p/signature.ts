import crypto from 'crypto';

/**
 * Encode une chaîne en pourcentage selon les spécifications S3P
 */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/\+/g, '%20');
}

/**
 * Construit la chaîne de base pour la signature S3P
 */
function buildBaseString(method: string, url: string, params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(params[k].toString())}`)
    .join('&');

  return [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString)
  ].join('&');
}

/**
 * Génère une signature HMAC-SHA1 pour les requêtes S3P
 */
export function generateS3PSignature({
  method,
  url,
  params,
  secret
}: {
  method: string;
  url: string;
  params: Record<string, any>;
  secret: string;
}): string {
  const baseString = buildBaseString(method, url, params);
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(baseString);
  return hmac.digest('base64');
}

/**
 * Vérifie une signature S3P
 */
export function verifyS3PSignature({
  method,
  url,
  params,
  secret,
  signature
}: {
  method: string;
  url: string;
  params: Record<string, any>;
  secret: string;
  signature: string;
}): boolean {
  const expectedSignature = generateS3PSignature({ method, url, params, secret });
  return expectedSignature === signature;
}
