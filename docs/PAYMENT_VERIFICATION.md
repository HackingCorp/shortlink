# Service de Vérification des Paiements

Ce service permet de vérifier périodiquement le statut des paiements en attente et de mettre à jour automatiquement les statuts des abonnements.

## Fonctionnement

Le service s'exécute en arrière-plan selon une planification configurable et effectue les opérations suivantes :

1. Récupère tous les paiements en statut "pending"
2. Vérifie le statut de chaque paiement auprès du fournisseur de paiement (S3P)
3. Met à jour le statut du paiement et de l'abonnement associé si nécessaire
4. Envoie des notifications en cas de succès ou d'échec

## Configuration

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `DISABLE_PAYMENT_VERIFICATION` | Désactive complètement le service si défini à 'true' | `false` |
| `PAYMENT_VERIFICATION_CRON` | Expression CRON pour la planification | `*/5 * * * *` (toutes les 5 minutes) |

### Planification

La planification par défaut est :
- En production : Toutes les 5 minutes (`*/5 * * * *`)
- En développement : Toutes les 10 minutes (`*/10 * * * *`)

Vous pouvez la personnaliser en définissant la variable d'environnement `PAYMENT_VERIFICATION_CRON` avec une expression CRON valide.

## Démarrer le service manuellement

Pour exécuter le service indépendamment du serveur principal :

```bash
# Installer les dépendances si nécessaire
npm install ts-node tsconfig-paths

# Démarrer le service
npx ts-node -r tsconfig-paths/register lib/cron/index.ts
```

## Désactiver le service

Pour désactiver complètement le service, définissez la variable d'environnement :

```bash
export DISABLE_PAYMENT_VERIFICATION=true
```

## Journalisation

Les logs du service sont enregistrés dans la sortie standard avec le préfixe `[PaymentVerification]`.

## Surveillance

Le service expose les métriques suivantes :

- Nombre de paiements vérifiés
- Nombre de mises à jour effectuées
- Nombre d'erreurs
- Dernière exécution

## Dépannage

### Problèmes courants

1. **Erreurs de connexion à la base de données**
   - Vérifiez les paramètres de connexion à la base de données
   - Assurez-vous que le service a les permissions nécessaires

2. **Échecs de vérification des paiements**
   - Vérifiez les logs pour des messages d'erreur spécifiques
   - Vérifiez la connectivité avec l'API du fournisseur de paiement

3. **Performances**
   - Si le service prend trop de temps, envisagez d'ajuster la fréquence de vérification
   - Vérifiez les index sur les tables de la base de données

## Sécurité

- Le service nécessite un accès en lecture/écriture à la base de données
- Les informations sensibles (clés API, tokens) doivent être stockées dans des variables d'environnement
- Les logs ne doivent pas contenir d'informations sensibles

## Maintenance

### Mises à jour

Pour mettre à jour le service :

1. Arrêtez le service
2. Mettez à jour le code
3. Redémarrez le service

### Sauvegarde

Assurez-vous que la base de données est sauvegardée régulièrement, en particulier avant les mises à jour majeures.
