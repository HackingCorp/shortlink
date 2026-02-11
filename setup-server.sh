#!/bin/bash

# Script de configuration initiale du serveur pour kut.es
# À exécuter avant le premier déploiement

SERVER_IP="${DEPLOY_SERVER_IP:?'DEPLOY_SERVER_IP not set'}"
SERVER_USER="${DEPLOY_SERVER_USER:-root}"
DOMAIN="kut.es"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Configuration initiale du serveur pour ${DOMAIN}${NC}"

# Fonction pour exécuter des commandes SSH
execute_ssh() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$1"
}

echo -e "${YELLOW}📋 Vérification des prérequis sur le serveur...${NC}"

# Vérifier si le réseau web (Traefik) existe
echo -e "${YELLOW}🌐 Vérification du réseau web...${NC}"
WEB_NETWORK_EXISTS=$(execute_ssh "docker network ls | grep web | wc -l")

if [ "$WEB_NETWORK_EXISTS" -eq "0" ]; then
    echo -e "${YELLOW}⚠️ Le réseau web n'existe pas. Création...${NC}"
    execute_ssh "docker network create web"
    echo -e "${GREEN}✅ Réseau web créé${NC}"
else
    echo -e "${GREEN}✅ Réseau web existe déjà${NC}"
fi

# Vérifier si Traefik est en cours d'exécution
echo -e "${YELLOW}🔍 Vérification de Traefik...${NC}"
TRAEFIK_RUNNING=$(execute_ssh "docker ps | grep traefik | wc -l")

if [ "$TRAEFIK_RUNNING" -eq "0" ]; then
    echo -e "${RED}❌ Traefik ne semble pas être en cours d'exécution${NC}"
    echo -e "${YELLOW}⚠️ Assurez-vous que Traefik est configuré et en cours d'exécution avant de déployer${NC}"
    echo -e "${BLUE}ℹ️ Exemple de configuration Traefik minimale :${NC}"
    cat << 'EOF'

version: '3.8'
services:
  traefik:
    image: traefik:v2.9
    container_name: traefik
    restart: unless-stopped
    command:
      - --api.dashboard=true
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
      - --certificatesresolvers.letsencrypt.acme.email=your-email@example.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - web

volumes:
  letsencrypt:

networks:
  web:
    external: true

EOF
else
    echo -e "${GREEN}✅ Traefik est en cours d'exécution${NC}"
fi

# Vérifier les ports utilisés
echo -e "${YELLOW}🔍 Vérification des ports...${NC}"
execute_ssh "netstat -tlnp | grep ':3200 '" && {
    echo -e "${RED}❌ Le port 3200 est déjà utilisé${NC}"
    echo -e "${YELLOW}⚠️ Veuillez choisir un autre port ou arrêter le service utilisant ce port${NC}"
} || {
    echo -e "${GREEN}✅ Le port 3200 est disponible${NC}"
}

execute_ssh "netstat -tlnp | grep ':5433 '" && {
    echo -e "${YELLOW}⚠️ Le port 5433 (PostgreSQL) est déjà utilisé${NC}"
} || {
    echo -e "${GREEN}✅ Le port 5433 est disponible${NC}"
}

execute_ssh "netstat -tlnp | grep ':6380 '" && {
    echo -e "${YELLOW}⚠️ Le port 6380 (Redis) est déjà utilisé${NC}"
} || {
    echo -e "${GREEN}✅ Le port 6380 est disponible${NC}"
}

# Vérifier l'espace disque
echo -e "${YELLOW}💾 Vérification de l'espace disque...${NC}"
execute_ssh "df -h /"

# Vérifier la mémoire
echo -e "${YELLOW}🧠 Vérification de la mémoire...${NC}"
execute_ssh "free -h"

# Créer le répertoire de déploiement
echo -e "${YELLOW}📁 Création du répertoire de déploiement...${NC}"
execute_ssh "mkdir -p /opt/apps/Kut"

# Vérifier la configuration DNS
echo -e "${YELLOW}🌐 Vérification DNS pour ${DOMAIN}...${NC}"
if command -v dig &> /dev/null; then
    DOMAIN_IP=$(dig +short $DOMAIN)
    if [ "$DOMAIN_IP" = "$SERVER_IP" ]; then
        echo -e "${GREEN}✅ DNS configuré correctement${NC}"
    else
        echo -e "${YELLOW}⚠️ DNS: $DOMAIN pointe vers $DOMAIN_IP mais le serveur est $SERVER_IP${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ dig non disponible, impossible de vérifier le DNS${NC}"
fi

echo -e "${GREEN}🎉 Configuration du serveur terminée !${NC}"
echo -e "${BLUE}📋 Résumé :${NC}"
echo -e "  • Réseau web: ${GREEN}✅${NC}"
echo -e "  • Port 3200: ${GREEN}Disponible${NC}"
echo -e "  • Répertoire: ${GREEN}/opt/apps/Kut${NC}"
echo -e "${BLUE}🚀 Vous pouvez maintenant exécuter: ${YELLOW}./deploy.sh${NC}"