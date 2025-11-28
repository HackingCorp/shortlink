import { NextApiRequest, NextApiResponse } from 'next';
import { ApiKey } from '../models/ApiKey';
import { verify } from 'jsonwebtoken';
import { getToken } from 'next-auth/jwt';
import { hasRequiredScopes, updateLastUsed } from '../lib/apiKeyUtils';

interface AuthenticatedRequest extends NextApiRequest {
  apiKey?: any;
  user?: any;
}

/**
 * Middleware pour authentifier les requêtes API avec une clé API
 * @param requiredScopes Les permissions requises pour accéder à la ressource
 */
export const apiKeyAuth = (requiredScopes: string[] = []) => {
  return async (req: AuthenticatedRequest, res: NextApiResponse, next: Function) => {
    try {
      // 1. Vérifier la présence de la clé API dans les en-têtes
      const apiKeyHeader = req.headers['x-api-key'] || req.headers.authorization?.split(' ')[1];
      
      if (!apiKeyHeader) {
        return res.status(401).json({ 
          error: 'API key is required',
          code: 'API_KEY_MISSING'
        });
      }

      // 2. Vérifier le format de la clé
      if (typeof apiKeyHeader !== 'string') {
        return res.status(400).json({ 
          error: 'Invalid API key format',
          code: 'INVALID_API_KEY_FORMAT'
        });
      }

      // 3. Récupérer la clé API depuis la base de données
      const hashedKey = createHash('sha256').update(apiKeyHeader).digest('hex');
      const apiKey = await ApiKey.findOne({ 
        key: hashedKey,
        isActive: true
      }).populate('userId');

      if (!apiKey) {
        return res.status(401).json({ 
          error: 'Invalid API key',
          code: 'INVALID_API_KEY'
        });
      }

      // 4. Vérifier l'expiration
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return res.status(401).json({ 
          error: 'API key has expired',
          code: 'API_KEY_EXPIRED'
        });
      }

      // 5. Vérifier les permissions
      if (!hasRequiredScopes(apiKey, requiredScopes)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredScopes
        });
      }

      // 6. Vérifier le taux d'utilisation
      const isWithinRateLimit = await checkRateLimit(apiKey._id);
      if (!isWithinRateLimit) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }

      // 7. Ajouter la clé API et l'utilisateur à la requête
      req.apiKey = apiKey;
      req.user = apiKey.userId;

      // 8. Mettre à jour la date de dernière utilisation (de manière asynchrone)
      updateLastUsed(apiKey._id);

      next();
    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during authentication',
        code: 'AUTHENTICATION_ERROR'
      });
    }
  };
};

// Fonction utilitaire pour créer un hachage
function createHash(algorithm: string) {
  return require('crypto').createHash(algorithm);
}

// Fonction utilitaire pour vérifier le rate limiting
async function checkRateLimit(keyId: string): Promise<boolean> {
  // Implémentez votre logique de rate limiting ici
  // Par exemple, avec Redis pour un comptage distribué
  return true;
}

/**
 * Middleware pour protéger les routes avec authentification utilisateur ou clé API
 */
export const withApiAuth = (handler: Function, requiredScopes: string[] = []) => {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // Essayer d'abord avec l'authentification utilisateur
      const token = await getToken({ req });
      
      if (token) {
        req.user = token;
        return handler(req, res);
      }

      // Si pas de token utilisateur, essayer avec une clé API
      return apiKeyAuth(requiredScopes)(req, res, () => handler(req, res));
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ 
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED'
      });
    }
  };
};
