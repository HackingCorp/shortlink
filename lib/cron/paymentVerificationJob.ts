import { schedule } from 'node-cron';
import { paymentVerificationService } from '@/lib/services/paymentVerification';

class PaymentVerificationJob {
  private job: any = null;

  /**
   * Démarre le job de vérification périodique
   * Par défaut, s'exécute toutes les 10 minutes
   */
  start(cronExpression = '*/10 * * * *'): void {
    if (this.job) {
      this.stop();
    }

    console.log(`Démarrage du job de vérification des paiements avec l'expression: ${cronExpression}`);
    
this.job = schedule(cronExpression, async () => {
      try {
        console.log('Exécution planifiée de la vérification des paiements...');
        await paymentVerificationService.verifyPendingPayments();
      } catch (error) {
        console.error('Erreur lors de l\'exécution du job de vérification:', error);
      }
    }, {
      timezone: 'Africa/Douala'
    });
  }

  /**
   * Arrête le job de vérification
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      console.log('Arrêt du job de vérification des paiements');
    }
  }
}

export const paymentVerificationJob = new PaymentVerificationJob();
