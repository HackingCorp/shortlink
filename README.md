# ShortLink - Service de Raccourcissement d'URL

Un service de raccourcissement d'URL moderne, sécurisé et évolutif construit avec Next.js, Prisma, MySQL et Redis.

## Fonctionnalités

- **Raccourcissement d'URL** pour les utilisateurs anonymes et enregistrés
- **Redirection ultra-rapide** avec un temps de réponse inférieur à 500ms
- **Gestion des comptes utilisateurs** avec authentification sécurisée
- **Tableau de bord** pour suivre les performances des liens
- **Personnalisation** des liens pour les utilisateurs enregistrés
- **Génération de QR Code** pour chaque lien raccourci
- **Vérification automatique des paiements** avec mise à jour des statuts d'abonnement
- **Analytiques avancées** (géolocalisation, référents, appareils, etc.)
- **API sécurisée** avec authentification par clé API
- **Rate limiting** intelligent basé sur Redis
- **Conforme RGPD** avec anonymisation des données personnelles

## Prérequis

- Node.js 16+ et npm 8+
- MySQL 8.0+
- Redis 6.0+
- Compte Vercel (pour le déploiement, optionnel)

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votre-utilisateur/shortlink.git
   cd shortlink
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**
   Créez un fichier `.env` à la racine du projet avec les variables suivantes :
   ```env
   # Base de données
   DATABASE_URL="mysql://user:password@localhost:3306/shortlink_db?schema=public"
   
   # Authentification
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="votre-secret-tres-long-et-securise"
   
   # Redis (pour le rate limiting)
   REDIS_URL="redis://localhost:6379"
   
   # Service de vérification des paiements (optionnel)
   DISABLE_PAYMENT_VERIFICATION=false
   PAYMENT_VERIFICATION_CRON="*/5 * * * *"  # Toutes les 5 minutes
   
   # Configuration S3P pour les paiements
   S3P_API_KEY=votre_cle_api_s3p
   S3P_API_SECRET=votre_secret_api_s3p
   S3P_WEBHOOK_SECRET=votre_secret_webhook_s3p
   
   # Configuration du rate limiting
   RATE_LIMIT_WINDOW_MS="900000"  # 15 minutes
   RATE_LIMIT_MAX_REQUESTS="100"  # 100 requêtes par fenêtre
   
   # Environnement
   NODE_ENV="development"
   ```

4. **Initialiser et configurer la base de données**
   ```bash
   # Créer et exécuter les migrations
   npx prisma migrate dev --name init
   
   # Générer le client Prisma
   npx prisma generate
   ```

## Service de Vérification des Paiements

Le service de vérification des paiements s'exécute automatiquement avec le serveur et permet de :

- Vérifier périodiquement le statut des paiements en attente
- Mettre à jour automatiquement les statuts des abonnements
- Gérer les échecs de paiement

### Configuration

Le service est activé par défaut et s'exécute toutes les 5 minutes en production. Vous pouvez le configurer avec les variables d'environnement suivantes :

- `DISABLE_PAYMENT_VERIFICATION` : Désactive le service si défini à 'true'
- `PAYMENT_VERIFICATION_CRON` : Expression CRON pour la planification (par défaut : "*/5 * * * *")

### Documentation complète

Consultez le fichier [docs/PAYMENT_VERIFICATION.md](docs/PAYMENT_VERIFICATION.md) pour une documentation détaillée sur le service de vérification des paiements.

## Démarrage

Pour lancer l'application en mode développement :
   ```bash
   npm run dev
   ```

## Configuration du Rate Limiting

Le système de rate limiting utilise Redis pour stocker les compteurs de requêtes. Il est configurable via les variables d'environnement :

- `RATE_LIMIT_WINDOW_MS` : Durée de la fenêtre de temps en millisecondes (défaut : 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` : Nombre maximum de requêtes autorisées par fenêtre (défaut : 100)

### Utilisation dans le code

```typescript
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rateLimiter';

// Vérifier la limite de débit
const allowed = await checkRateLimit('user:123', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  delayAfter: 50, // Optionnel : ajouter un délai après 50 requêtes
  delayMs: 1000,  // 1 seconde de délai supplémentaire
  prefix: 'api'   // Préfixe pour les clés Redis
});

// Obtenir les en-têtes HTTP pour la réponse
const headers = await getRateLimitHeaders('user:123', {
  windowMs: 15 * 60 * 1000,
  maxRequests: 100
});
```

### En-têtes de réponse

Le serveur renvoie les en-têtes HTTP suivants pour chaque réponse :

- `X-RateLimit-Limit` : Nombre maximum de requêtes autorisées
- `X-RateLimit-Remaining` : Nombre de requêtes restantes dans la fenêtre actuelle
- `X-RateLimit-Reset` : Horodatage de réinitialisation (en secondes depuis l'époque Unix)
- `Retry-After` : Délai d'attente recommandé en secondes (si la limite est atteinte)

## Déploiement

### Vercel

1. Créez un nouveau projet sur [Vercel](https://vercel.com)
2. Configurez les variables d'environnement dans les paramètres du projet
3. Connectez votre dépôt GitHub et activez le déploiement automatique

### Avec Docker

```bash
docker-compose up -d
```

## Sécurité

- Toutes les URLs sont validées et nettoyées pour prévenir les attaques XSS
- Les mots de passe sont hachés avec bcrypt
- Protection CSRF intégrée
- En-têtes de sécurité HTTP stricts (CSP, HSTS, etc.)
- Anonymisation des adresses IP pour la conformité RGPD

## Licence

MIT

## Auteur

Votre nom - [@votre-compte](https://github.com/votre-utilisateur)

## Remerciements

- [Next.js](https://nextjs.org/)
- [Prisma](https://www.prisma.io/)
- [Redis](https://redis.io/)
- [Vercel](https://vercel.com/)