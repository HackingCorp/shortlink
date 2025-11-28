# Étape de construction (Builder)
FROM node:18-alpine AS builder

WORKDIR /app

# Mettre à jour les dépôts et installer les dépendances système nécessaires
RUN apk update && apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    openssl \
    postgresql-client \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community

# 1. Copier uniquement les fichiers nécessaires pour l'installation des dépendances
COPY package*.json ./
COPY prisma ./prisma/

# 2. Installer les dépendances avec --legacy-peer-deps pour éviter les conflits
RUN npm install --legacy-peer-deps

# 2.1 Installer Prisma globalement pour éviter les problèmes de chemin
RUN npm install -g prisma

# 3. Copier les fichiers de l'application nécessaires pour le build
COPY . .

# 3.1 Définir les variables d'environnement pour le build
ARG S3P_BASE_URL
ARG S3P_ACCESS_TOKEN
ARG S3P_ACCESS_SECRET
ARG S3P_SERVICE_ID
ARG ENKAP_CONSUMER_KEY
ARG ENKAP_CONSUMER_SECRET
ARG ENKAP_TOKEN_URL
ARG ENKAP_API_BASE_URL

ENV S3P_BASE_URL=$S3P_BASE_URL
ENV S3P_ACCESS_TOKEN=$S3P_ACCESS_TOKEN
ENV S3P_ACCESS_SECRET=$S3P_ACCESS_SECRET
ENV S3P_SERVICE_ID=$S3P_SERVICE_ID
ENV ENKAP_CONSUMER_KEY=$ENKAP_CONSUMER_KEY
ENV ENKAP_CONSUMER_SECRET=$ENKAP_CONSUMER_SECRET
ENV ENKAP_TOKEN_URL=$ENKAP_TOKEN_URL
ENV ENKAP_API_BASE_URL=$ENKAP_API_BASE_URL

# 4. Exécuter le script copy-leaflet-assets et générer le client Prisma
RUN node scripts/copy-leaflet-assets.js

# 4.1 Générer le client Prisma avec la bonne URL de base de données
RUN DATABASE_URL="postgresql://kutes:${DB_PASSWORD}@db:5432/kutes_prod?schema=public" prisma generate

# 5. Construire l'application pour la production
RUN npm run build && \
    # Nettoyer le cache npm
    npm cache clean --force && \
    # Supprimer les fichiers inutiles pour réduire la taille de l'image
    rm -rf node_modules/.cache

# Étape d'exécution finale
FROM node:18-alpine

WORKDIR /app

# Variables d'environnement pour la production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Mettre à jour les dépôts et installer uniquement les dépendances système nécessaires
RUN apk update && apk upgrade && \
    apk add --no-cache \
    openssl \
    postgresql-client \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs && \
    chown -R nextjs:nodejs /app

# Copier les fichiers nécessaires depuis le builder
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js .
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Définir l'utilisateur non-root
USER nextjs

# Exposer le port de l'application
EXPOSE 3200

# Variables d'environnement pour Prisma (peuvent être surchargées)
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Commande de démarrage
CMD ["sh", "-c", "PORT=3200 node server.js"]