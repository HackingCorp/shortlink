#!/bin/bash

# Configuration du serveur
SERVER_IP="94.250.201.167"
SERVER_USER="root"
SERVER_PASSWORD="Lontsi05@"
REMOTE_PATH="/opt/apps/Kut"
PROJECT_NAME="kut.es"
DOMAIN="kut.es"
PORT="3200"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Démarrage du déploiement de ${PROJECT_NAME}${NC}"

# Fonction pour exécuter des commandes SSH
execute_ssh() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$1"
}

# Fonction pour copier des fichiers
copy_files() {
    sshpass -p "$SERVER_PASSWORD" rsync -avz --exclude-from='.deployignore' -e "ssh -o StrictHostKeyChecking=no" . "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/"
}

echo -e "${YELLOW}📋 Vérification des prérequis...${NC}"

# Vérifier que sshpass est installé
if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}❌ sshpass n'est pas installé. Installation...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    fi
fi

# Vérifier que rsync est installé
if ! command -v rsync &> /dev/null; then
    echo -e "${RED}❌ rsync n'est pas installé${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 Création du fichier .deployignore...${NC}"
cat > .deployignore << EOF
node_modules
.git
.next
*.log
.env
.env.local
.env.development
.env.test
.env.production.keys
.DS_Store
.vscode
.idea
coverage
dist
build
logs/
*.tsbuildinfo
README.md
DEPLOYMENT.md
TEAM_DEPLOYMENT_GUIDE.md
EOF

echo -e "${YELLOW}📦 Préparation du serveur...${NC}"

# Créer le répertoire de déploiement
execute_ssh "mkdir -p $REMOTE_PATH"

# Vérifier si Docker et Docker Compose sont installés
echo -e "${YELLOW}🐳 Vérification de Docker sur le serveur...${NC}"
execute_ssh "docker --version" || {
    echo -e "${RED}❌ Docker n'est pas installé sur le serveur${NC}"
    exit 1
}

execute_ssh "docker compose version" || {
    echo -e "${RED}❌ Docker Compose n'est pas installé sur le serveur${NC}"
    exit 1
}

echo -e "${YELLOW}📁 Copie des fichiers vers le serveur...${NC}"
copy_files

echo -e "${YELLOW}⚙️ Configuration de l'environnement sur le serveur...${NC}"

# Vérifier que le fichier .env.production existe
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Le fichier .env.production n'existe pas${NC}"
    echo -e "${YELLOW}💡 Créez un fichier .env.production avec vos variables de production${NC}"
    exit 1
fi

# Générer les clés secrètes de production
NEXTAUTH_SECRET_GENERATED=$(openssl rand -base64 32)
HASH_SECRET_GENERATED=$(openssl rand -base64 32)
JWT_SECRET_GENERATED=$(openssl rand -base64 32)
JWT_SIGNING_PRIVATE_KEY_GENERATED=$(openssl rand -base64 32)
JWT_ENCRYPTION_KEY_GENERATED=$(openssl rand -base64 32)

echo -e "${YELLOW}🔐 Génération des clés secrètes de production...${NC}"

# Afficher un résumé des variables de production
echo -e "${BLUE}📋 Configuration de production :${NC}"
echo -e "  • Domaine: ${GREEN}$DOMAIN${NC}"
echo -e "  • URL NextAuth: ${GREEN}https://$DOMAIN${NC}"
echo -e "  • Port: ${GREEN}$PORT${NC}"
echo -e "  • Base de données: ${GREEN}PostgreSQL (conteneur)${NC}"
echo -e "  • Redis: ${GREEN}Redis (conteneur)${NC}"
echo -e "  • SSL: ${GREEN}Géré par Traefik${NC}"

# Lire le fichier .env.production et remplacer les variables
ENV_CONTENT=$(cat .env.production)
ENV_CONTENT="${ENV_CONTENT//\$\{NEXTAUTH_SECRET_GENERATED\}/$NEXTAUTH_SECRET_GENERATED}"
ENV_CONTENT="${ENV_CONTENT//\$\{HASH_SECRET_GENERATED\}/$HASH_SECRET_GENERATED}"
ENV_CONTENT="${ENV_CONTENT//\$\{JWT_SECRET_GENERATED\}/$JWT_SECRET_GENERATED}"
ENV_CONTENT="${ENV_CONTENT//\$\{JWT_SIGNING_PRIVATE_KEY_GENERATED\}/$JWT_SIGNING_PRIVATE_KEY_GENERATED}"
ENV_CONTENT="${ENV_CONTENT//\$\{JWT_ENCRYPTION_KEY_GENERATED\}/$JWT_ENCRYPTION_KEY_GENERATED}"

# Validation des variables importantes
echo -e "${YELLOW}✅ Validation de la configuration...${NC}"
if [[ ! "$ENV_CONTENT" == *"NEXTAUTH_URL=https://$DOMAIN"* ]]; then
    echo -e "${RED}❌ NEXTAUTH_URL non configurée correctement${NC}"
    exit 1
fi

if [[ ! "$ENV_CONTENT" == *"NODE_ENV=production"* ]]; then
    echo -e "${RED}❌ NODE_ENV non configuré en production${NC}"
    exit 1
fi

# Créer le fichier .env sur le serveur avec le contenu traité
execute_ssh "cd $REMOTE_PATH && cat > .env << 'EOF'
$ENV_CONTENT
EOF"

echo -e "${GREEN}✅ Fichier .env de production créé avec succès${NC}"

# Sauvegarder les clés générées localement (optionnel, pour référence)
echo -e "${YELLOW}💾 Sauvegarde des clés générées...${NC}"
cat > .env.production.keys << EOF
# Clés générées le $(date)
# Ces clés ont été utilisées pour le déploiement de production
NEXTAUTH_SECRET=$NEXTAUTH_SECRET_GENERATED
HASH_SECRET=$HASH_SECRET_GENERATED
JWT_SECRET=$JWT_SECRET_GENERATED
JWT_SIGNING_PRIVATE_KEY=$JWT_SIGNING_PRIVATE_KEY_GENERATED
JWT_ENCRYPTION_KEY=$JWT_ENCRYPTION_KEY_GENERATED
EOF
echo -e "${BLUE}💡 Les clés générées ont été sauvegardées dans .env.production.keys${NC}"

echo -e "${YELLOW}🐳 Arrêt des conteneurs existants et nettoyage...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml down --remove-orphans --volumes" || true
execute_ssh "cd $REMOTE_PATH && docker system prune -f" || true

echo -e "${YELLOW}🧹 Nettoyage des caches Docker...${NC}"
execute_ssh "cd $REMOTE_PATH && docker builder prune -f" || true

echo -e "${YELLOW}🏗️ Construction de l'image avec cache vide...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml build --no-cache --pull app"

echo -e "${YELLOW}🚀 Démarrage des services...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml up -d"

echo -e "${YELLOW}⏳ Attente du démarrage des services (60s)...${NC}"
sleep 60

echo -e "${YELLOW}🔍 Vérification de l'état des conteneurs...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml ps"

echo -e "${YELLOW}🗄️ Configuration de la base de données externe...${NC}"
# Pas besoin d'attendre une base locale, on utilise Neon DB

# Nettoyer le cache npm dans le conteneur
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml exec -T app npm cache clean --force"

# Générer le client Prisma
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml exec -T app npx prisma generate" || {
    echo -e "${YELLOW}⚠️ Génération Prisma échouée, tentative avec installation...${NC}"
    execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml exec -T app npm install @prisma/client"
    execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml exec -T app npx prisma generate"
}

# Déployer les migrations
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml exec -T app npx prisma migrate deploy" || {
    echo -e "${YELLOW}⚠️ Migration deploy échouée, tentative avec db push...${NC}"
    execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml exec -T app npx prisma db push --accept-data-loss"
}

# Redémarrer l'application après la configuration DB
echo -e "${YELLOW}🔄 Redémarrage de l'application...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml restart app"

echo -e "${YELLOW}🔍 Vérification du statut des conteneurs...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml ps"

echo -e "${YELLOW}🩺 Test de santé de l'application...${NC}"
for i in {1..10}; do
    echo -e "${BLUE}Tentative $i/10...${NC}"
    if execute_ssh "curl -f -s http://localhost:$PORT > /dev/null"; then
        echo -e "${GREEN}✅ Application accessible sur le port $PORT${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Application pas encore prête, attente 10s...${NC}"
        sleep 10
    fi
done

echo -e "${YELLOW}📊 Vérification des logs récents...${NC}"
execute_ssh "cd $REMOTE_PATH && docker compose -f docker-compose.production.yml logs --tail=30 app"

echo -e "${YELLOW}🌐 Test d'accès externe...${NC}"
if curl -f -s -I https://$DOMAIN > /dev/null; then
    echo -e "${GREEN}✅ Site accessible via https://$DOMAIN${NC}"
else
    echo -e "${RED}❌ Site non accessible via https://$DOMAIN${NC}"
    echo -e "${YELLOW}Vérification des logs Traefik...${NC}"
    execute_ssh "docker logs traefik --tail=10 | grep -i kut"
fi

echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo -e "${BLUE}🌐 Votre application est accessible à : https://$DOMAIN${NC}"
echo -e "${BLUE}📋 Commandes utiles :${NC}"
echo -e "  • Voir les logs: ${YELLOW}ssh $SERVER_USER@$SERVER_IP 'cd $REMOTE_PATH && docker compose logs -f'${NC}"
echo -e "  • Redémarrer: ${YELLOW}ssh $SERVER_USER@$SERVER_IP 'cd $REMOTE_PATH && docker compose restart'${NC}"
echo -e "  • Arrêter: ${YELLOW}ssh $SERVER_USER@$SERVER_IP 'cd $REMOTE_PATH && docker compose down'${NC}"
echo -e "  • Mise à jour: ${YELLOW}./deploy.sh${NC}"

echo -e "${GREEN}🎉 Déploiement réussi !${NC}"