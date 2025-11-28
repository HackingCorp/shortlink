import { NextApiRequest, NextApiResponse } from 'next';
import { ApiKey } from '../models/ApiKey';
import { generateApiKey, formatApiKeyForDisplay } from '../lib/apiKeyUtils';
import { getToken } from 'next-auth/jwt';

export class ApiKeyController {
  /**
   * Crée une nouvelle clé API
   */
  static async createApiKey(req: NextApiRequest, res: NextApiResponse) {
    try {
      // Récupérer l'utilisateur authentifié
      const token = await getToken({ req });
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { name, scopes, rateLimit, expiresInDays } = req.body;

      // Validation des données
      if (!name || !Array.isArray(scopes) || scopes.length === 0) {
        return res.status(400).json({ 
          error: 'Name and at least one scope are required',
          code: 'VALIDATION_ERROR'
        });
      }

      // Générer une nouvelle clé API
      const { key, hashedKey, expiresAt } = generateApiKey();
      
      // Calculer la date d'expiration si spécifiée
let expirationDate: Date | undefined = undefined;
if (expiresInDays && typeof expiresInDays === 'number' && expiresInDays > 0) {
  const date = new Date();
  date.setDate(date.getDate() + expiresInDays);
  expirationDate = date;
}
      // Créer et sauvegarder la clé API
      const apiKey = new ApiKey({
        key: hashedKey,
        name,
        userId: token.sub,
        scopes,
        rateLimit: rateLimit || 60, // 60 requêtes par minute par défaut
        expiresAt: expirationDate || expiresAt,
        isActive: true
      });

      await apiKey.save();

      // Renvoyer la clé en clair (uniquement à ce moment-là)
      res.status(201).json({
        id: apiKey._id,
        name: apiKey.name,
        key, // La clé en clair (à ne montrer qu'une seule fois)
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        // Ne pas renvoyer la clé hachée ni l'ID utilisateur
      });

    } catch (error) {
      console.error('Error creating API key:', error);
      res.status(500).json({ 
        error: 'Failed to create API key',
        code: 'CREATE_API_KEY_ERROR'
      });
    }
  }

  /**
   * Liste les clés API de l'utilisateur
   */
  static async listApiKeys(req: NextApiRequest, res: NextApiResponse) {
    try {
      const token = await getToken({ req });
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const apiKeys = await ApiKey.find({ userId: token.sub })
        .select('-key') // Ne pas renvoyer la clé hachée
        .sort({ createdAt: -1 });

      // Formater les clés pour l'affichage
      const formattedKeys = apiKeys.map(key => ({
        id: key._id,
        name: key.name,
        keyPreview: formatApiKeyForDisplay(key.key),
        scopes: key.scopes,
        rateLimit: key.rateLimit,
        expiresAt: key.expiresAt,
        lastUsed: key.lastUsed,
        isActive: key.isActive,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt
      }));

      res.status(200).json(formattedKeys);
    } catch (error) {
      console.error('Error listing API keys:', error);
      res.status(500).json({ 
        error: 'Failed to list API keys',
        code: 'LIST_API_KEYS_ERROR'
      });
    }
  }

  /**
   * Révoke une clé API
   */
  static async revokeApiKey(req: NextApiRequest, res: NextApiResponse) {
    try {
      const token = await getToken({ req });
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.query;

      // Vérifier que la clé appartient bien à l'utilisateur
      const apiKey = await ApiKey.findOne({ _id: id, userId: token.sub });
      if (!apiKey) {
        return res.status(404).json({ 
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND'
        });
      }

      // Désactiver la clé au lieu de la supprimer
      apiKey.isActive = false;
      await apiKey.save();

      res.status(200).json({ 
        message: 'API key revoked successfully',
        id: apiKey._id
      });
    } catch (error) {
      console.error('Error revoking API key:', error);
      res.status(500).json({ 
        error: 'Failed to revoke API key',
        code: 'REVOKE_API_KEY_ERROR'
      });
    }
  }

  /**
   * Met à jour une clé API
   */
  static async updateApiKey(req: NextApiRequest, res: NextApiResponse) {
    try {
      const token = await getToken({ req });
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const { id } = req.query;
      const { name, scopes, rateLimit, isActive } = req.body;

      // Vérifier que la clé appartient bien à l'utilisateur
      const apiKey = await ApiKey.findOne({ _id: id, userId: token.sub });
      if (!apiKey) {
        return res.status(404).json({ 
          error: 'API key not found',
          code: 'API_KEY_NOT_FOUND'
        });
      }

      // Mettre à jour les champs fournis
      if (name) apiKey.name = name;
      if (Array.isArray(scopes)) apiKey.scopes = scopes;
      if (rateLimit) apiKey.rateLimit = rateLimit;
      if (typeof isActive === 'boolean') apiKey.isActive = isActive;

      await apiKey.save();

      res.status(200).json({
        id: apiKey._id,
        name: apiKey.name,
        scopes: apiKey.scopes,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt,
        updatedAt: apiKey.updatedAt
      });
    } catch (error) {
      console.error('Error updating API key:', error);
      res.status(500).json({ 
        error: 'Failed to update API key',
        code: 'UPDATE_API_KEY_ERROR'
      });
    }
  }
}
