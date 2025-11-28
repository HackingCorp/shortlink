# 🚀 Guide de Déploiement Amélioré

## Nouvelle Architecture de Déploiement

Le script de déploiement a été amélioré pour gérer correctement les variables d'environnement de production.

### Fichiers de Configuration

1. **`.env`** - Variables de développement (non déployées)
2. **`.env.production`** - Template des variables de production
3. **`.env.production.keys`** - Clés générées (créé automatiquement, non déployé)

### Processus de Déploiement

Le script `deploy.sh` effectue maintenant :

1. ✅ Vérification de l'existence de `.env.production`
2. 🔐 Génération automatique de clés secrètes sécurisées
3. 📋 Affichage de la configuration de production
4. ✅ Validation des variables importantes
5. 📁 Copie sélective des fichiers (exclusions dans `.deployignore`)
6. ⚙️ Création du `.env` final sur le serveur
7. 💾 Sauvegarde locale des clés générées

### Utilisation

```bash
# Déployer avec les variables de production
./deploy.sh
```

### Variables d'Environnement de Production

Le fichier `.env.production` contient :
- URLs de production (https://kut.es)
- Configuration des cookies sécurisés
- Configuration SSL/HTTPS
- Variables de base de données et Redis
- Configuration SMTP
- Clés secrètes (générées automatiquement)

### Sécurité

- ✅ Génération automatique de clés uniques à chaque déploiement
- ✅ Exclusion des fichiers sensibles (`.deployignore`)
- ✅ Configuration HTTPS/SSL appropriée
- ✅ Cookies sécurisés en production

### Structure des Fichiers

```
project/
├── .env                      # Développement (ignoré)
├── .env.production          # Template production (déployé)
├── .env.production.keys     # Clés générées (ignoré)
├── deploy.sh               # Script de déploiement
└── .deployignore           # Fichiers exclus du déploiement
```