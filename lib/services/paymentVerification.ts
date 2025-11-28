import { S3PMobileWalletService } from '../s3p/mobileWalletService';
import { prisma } from '../prisma';

const s3pMobileWallet = new S3PMobileWalletService();

class PaymentVerificationService {
  /**
   * Vérifie les paiements en attente
   */
  async verifyPendingPayments() {
    try {
      console.log('Début de la vérification des paiements en attente...');
      
      // Récupérer les paiements en attente de plus de 5 minutes
      const pendingPayments = await prisma.payment.findMany({
        where: {
          status: 'pending',
          createdAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000) // Il y a plus de 5 minutes
          },
          metadata: {
            path: ['s3pPTN'],
            not: null
          }
        },
        take: 50 // Limiter à 50 vérifications par exécution
      });

      console.log(`Trouvé ${pendingPayments.length} paiements en attente à vérifier`);

      for (const payment of pendingPayments) {
        try {
          const ptn = payment.metadata?.s3pPTN;
          if (!ptn) continue;

          console.log(`Vérification du paiement ${payment.id} avec PTN: ${ptn}`);
          
          const status = await s3pMobileWallet.verifyTransaction(ptn);
          console.log(`Statut pour le paiement ${payment.id}:`, status.status);

          if (status.status === 'SUCCESS') {
            await this.handleSuccessfulPayment(payment, status);
          } else if (['FAILED', 'CANCELLED'].includes(status.status)) {
            await this.handleFailedPayment(payment, status);
          }
          // Si le statut est toujours PENDING, on laisse la vérification suivante s'en occuper
          
        } catch (error) {
          console.error(`Erreur lors de la vérification du paiement ${payment.id}:`, error);
        }
      }

      console.log('Vérification des paiements terminée');
      return { success: true, checked: pendingPayments.length };
      
    } catch (error) {
      console.error('Erreur critique dans verifyPendingPayments:', error);
      throw error;
    }
  }

  private async handleSuccessfulPayment(payment: any, status: any) {
    const tx = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'succeeded',
          metadata: {
            ...payment.metadata,
            lastVerification: new Date().toISOString(),
            verificationStatus: status
          }
        }
      }),
      prisma.user.update({
        where: { id: payment.userId },
        data: {
          role: payment.plan,
          planStartedAt: payment.periodStart,
          planExpiresAt: payment.periodEnd,
          paymentStatus: 'active',
          paymentMethod: 's3p_mobile_money',
          subscriptionId: payment.paymentId
        }
      })
    ]);

    console.log(`Paiement ${payment.id} marqué comme réussi`);
    // TODO: Envoyer une notification à l'utilisateur
    return tx;
  }

  private async handleFailedPayment(payment: any, status: any) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        metadata: {
          ...payment.metadata,
          lastVerification: new Date().toISOString(),
          failureReason: status.message || 'Échec du paiement',
          verificationStatus: status
        }
      }
    });

    console.log(`Paiement ${payment.id} marqué comme échoué`);
    // TODO: Envoyer une notification d'échec à l'utilisateur
  }
}

export const paymentVerificationService = new PaymentVerificationService();
