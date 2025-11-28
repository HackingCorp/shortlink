const { paymentVerificationJob } = require('./paymentVerificationJob');

// Démarrer le job de vérification des paiements
if (require.main === module) {
  console.log('Démarrage du service de vérification des paiements...');
  
  // Démarrer le job avec une vérification toutes les 5 minutes
  paymentVerificationJob.start('*/5 * * * *');
  
  // Gérer l'arrêt propre du service
  process.on('SIGINT', () => {
    console.log('Arrêt du service de vérification des paiements...');
    paymentVerificationJob.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Arrêt du service de vérification des paiements (SIGTERM)...');
    paymentVerificationJob.stop();
    process.exit(0);
  });
}

export { paymentVerificationJob };
