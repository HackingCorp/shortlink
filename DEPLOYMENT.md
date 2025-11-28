# Guide de Déploiement Docker

Ce guide explique comment déployer l'application ShortLink en production en utilisant Docker et Docker Compose.

## Prérequis

- Docker (version 20.10.0 ou supérieure)
- Docker Compose (version 2.0.0 ou supérieure)
- Un compte Docker Hub (pour pousser l'image)
- Un serveur avec accès SSH
- Un nom de domaine (recommandé pour la production)

## Structure du Projet

```
shortlink/
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── prisma/
│   └── schema.prisma
└── ...
```

## Configuration Initiale

1. **Sur votre machine de développement** :
   - Créez un nouveau dossier pour votre projet
   - Téléchargez et placez les fichiers du projet (Dockerfile, docker-compose.yml, etc.)
   - Créez le fichier `.env` à partir de l'exemple :
     ```bash
     cp .env.example .env
     ```
   - Modifiez le fichier `.env` avec vos configurations

2. **Construire et pousser l'image Docker** :
   - Connectez-vous à Docker Hub :
     ```bash
     docker login
     ```
   - Construisez l'image :
     ```bash
     docker-compose build
     ```
   - Taguez et poussez l'image :
     ```bash
     docker tag shortlink_app votreutilisateur/shortlink:latest
     docker push votreutilisateur/shortlink:latest
     ```

3. **Sur le serveur de production** :
   - Installez Docker et Docker Compose
   - Créez un dossier pour votre projet et ajoutez le fichier `docker-compose.yml` et `.env`
   - Mettez à jour le fichier `.env` avec les configurations de production, notamment :
     ```env
     # Base de données
     DB_USER=postgres
     DB_PASSWORD=un_mot_de_passe_securise
     DB_NAME=shortlink
     
     # Authentification
     NEXTAUTH_URL=https://votredomaine.com
     NEXTAUTH_SECRET=$(openssl rand -base64 32)
     JWT_SECRET=$(openssl rand -base64 32)
     
     # Email (exemple avec SendGrid)
     SMTP_HOST=smtp.sendgrid.net
     SMTP_PORT=587
     SMTP_USER=apikey
     SMTP_PASS=votre_cle_api_sendgrid
     EMAIL_FROM=noreply@votredomaine.com
     
     # URL de l'application
     BASE_URL=https://votredomaine.com
     ```
   - Téléchargez et démarrez l'application :
     ```bash
     docker-compose pull
     docker-compose up -d
     ```

## Construction et Déploiement Local

1. **Construire l'image Docker** :
   ```bash
   docker-compose build
   ```

2. **Démarrer les services** :
   ```bash
   docker-compose up -d
   ```

3. **Appliquer les migrations de base de données** :
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

4. **Vérifier les logs** :
   ```bash
   docker-compose logs -f app
   ```

## Déploiement en Production

1. **Construire et pousser l'image** :
   ```bash
   # Se connecter à Docker Hub
   docker login
   
   # Tagger l image
   docker tag shortlink_app votreutilisateur/shortlink:latest
   
   # Pousser l image
   docker push votreutilisateur/shortlink:latest
   ```

2. **Sur le serveur de production** :
   - Installez Docker et Docker Compose
   - Copiez les fichiers `docker-compose.yml` et `.env`
   - Mettez à jour les variables d'environnement pour la production
   - Démarrez les services :
     ```bash
     docker-compose pull
     docker-compose up -d
     docker-compose exec app npx prisma migrate deploy
     ```

## Maintenance

- **Mises à jour** :
  ```bash
  git pull origin main
  docker-compose build --no-cache
  docker-compose up -d --force-recreate
  docker-compose exec app npx prisma migrate deploy
  ```

- **Sauvegardes** :
  ```bash
  # Sauvegarder la base de données
  docker-compose exec db pg_dump -U postgres shortlink > backup_$(date +%Y%m%d).sql
  
  # Restaurer une sauvegarde
  cat backup_20230821.sql | docker-compose exec -T db psql -U postgres shortlink
  ```

## Sécurité

- N'utilisez jamais les mots de passe par défaut en production
- Activez HTTPS avec un certificat SSL (Let's Encrypt)
- Mettez à jour régulièrement les dépendances
- Limitez l'accès aux ports exposés avec un pare-feu
- Configurez des sauvegardes automatiques

## Dépannage

- **Voir les logs** :
  ```bash
  docker-compose logs -f
  ```

- **Accéder à la base de données** :
  ```bash
  docker-compose exec db psql -U postgres
  ```

- **Redémarrer un service** :
  ```bash
  docker-compose restart app
  ```

## Accès aux Services

- **Application** : http://localhost:3000
- **Base de données** :
  - Hôte : `db` (nom du service dans le réseau Docker)
  - Port : 5432
  - Utilisateur : `postgres`
  - Mot de passe : `postgres`
  - Base de données : `shortlink`
- **MailHog** (pour les e-mails en développement) :
  - Interface web : http://localhost:8025
  - Serveur SMTP : `mailhog:1025`

## Commandes Utiles

- **Arrêter les services** :
  ```bash
  docker-compose down
  ```

- **Redémarrer un service** :
  ```bash
  docker-compose restart [nom_du_service]
  ```

- **Voir les logs en temps réel** :
  ```bash
  docker-compose logs -f [nom_du_service]
  ```

- **Exécuter une commande dans un conteneur** :
  ```bash
  docker-compose exec [nom_du_service] [commande]
  ```

## Mise à Jour de l'Application

1. **Sur votre machine de développement** :
   - Apportez vos modifications au code localement
   - Reconstruisez l'image Docker :
     ```bash
     docker-compose build
     ```
   - Taguez et poussez la nouvelle image vers Docker Hub :
     ```bash
     docker tag shortlink_app votreutilisateur/shortlink:latest
     docker push votreutilisateur/shortlink:latest
     ```

2. **Sur le serveur de production** :
   - Récupérez la dernière image :
     ```bash
     docker pull votreutilisateur/shortlink:latest
     ```
   - Redémarrez les services :
     ```bash
     docker-compose up -d
     ```

3. Appliquez les migrations si nécessaire :
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

## Dépannage

### Problèmes de Connexion à la Base de Données

Si la base de données n'est pas accessible :

1. Vérifiez que le service est en cours d'exécution :
   ```bash
   docker-compose ps
   ```

2. Vérifiez les logs du service :
   ```bash
   docker-compose logs db
   ```

3. Essayez de vous connecter manuellement :
   ```bash
   docker-compose exec db psql -U postgres
   ```

### Problèmes avec Prisma

Si les migrations échouent :

1. Vérifiez la connexion à la base de données dans `.env`
2. Vérifiez les logs de l'application :
   ```bash
   docker-compose logs app
   ```
3. Essayez de forcer une nouvelle migration :
   ```bash
   docker-compose exec app npx prisma migrate dev --name init
   ```

## Sécurité en Production

1. **Ne jamais utiliser les paramètres par défaut** (mots de passe, secrets, etc.)
2. **Utiliser HTTPS** avec un certificat valide
3. **Limiter l'accès** aux ports exposés
4. **Mettre à jour régulièrement** les images Docker
5. **Sauvegarder régulièrement** les données

## Sauvegarde et Restauration

### Sauvegarder la base de données

```bash
docker-compose exec db pg_dump -U postgres shortlink > backup_$(date +%Y%m%d).sql
```

### Restaurer une sauvegarde

1. Arrêtez l'application :
   ```bash
   docker-compose down
   ```

2. Redémarrez uniquement la base de données :
   ```bash
   docker-compose up -d db
   ```

3. Restaurez la sauvegarde :
   ```bash
   cat backup_20230821.sql | docker-compose exec -T db psql -U postgres shortlink
   ```

4. Redémarrez l'application :
   ```bash
   docker-compose up -d
   ```

## Conclusion

Vous avez maintenant une installation Docker fonctionnelle de ShortLink. Pour toute question ou problème, consultez la documentation officielle ou ouvrez une issue sur le dépôt du projet.
