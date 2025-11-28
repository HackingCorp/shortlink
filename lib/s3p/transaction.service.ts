// lib/s3p/transaction.service.ts
// Service pour gérer les transactions de paiement S3P

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Créer une nouvelle instance PrismaClient
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Type pour le statut de la transaction
type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

// Type pour les données de création de transaction
interface CreateTransactionData {
  ptn: string;
  amount: number;
  currency?: string;
  merchant?: string;
  payItemId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: any;
  userId?: number;
  expiresAt?: Date;
}

// Type pour la mise à jour d'une transaction
interface UpdateTransactionData {
  status?: TransactionStatus;
  receiptNumber?: string;
  verificationCode?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: any;
  verifiedAt?: Date | null;
}

// Type pour les options de pagination
interface PaginationOptions {
  limit?: number;
  skip?: number;
  status?: TransactionStatus;
}

export interface CreateTransactionInput {
  ptn: string;
  amount: number;
  currency?: string;
  merchant?: string;
  payItemId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: any;
  userId?: number;
  expiresAt?: Date;
}

export interface UpdateTransactionInput {
  status?: TransactionStatus;
  receiptNumber?: string;
  verificationCode?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: any;
  verifiedAt?: Date | null;
}

class TransactionService {
  /**
   * Crée une nouvelle transaction
   */
  async createTransaction(data: CreateTransactionData) {
    try {
      return await prisma.transaction.create({
        data: {
          id: uuidv4(),
          ptn: data.ptn,
          amount: data.amount,
          currency: data.currency || 'XAF',
          merchant: data.merchant,
          payItemId: data.payItemId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
          userId: data.userId,
          expiresAt: data.expiresAt,
          status: 'PENDING',
        },
      });
    } catch (error) {
      console.error('Erreur lors de la création de la transaction:', error);
      throw new Error('Impossible de créer la transaction');
    }
  }

  /**
   * Met à jour une transaction existante
   */
  async updateTransaction(ptn: string, data: UpdateTransactionData) {
    try {
      const updateData: any = { ...data };
      
      // Si le statut est mis à jour vers SUCCESS, on met à jour la date de vérification
      if (data.status === 'SUCCESS' && !data.verifiedAt) {
        updateData.verifiedAt = new Date();
      }

return await prisma.transaction.update({
        where: { ptn },
        data: updateData,
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la transaction:', error);
      throw new Error('Impossible de mettre à jour la transaction');
    }
  }

  /**
   * Récupère une transaction par son PTN
   */
  async getTransactionByPtn(ptn: string) {
    try {
      return await prisma.transaction.findUnique({
        where: { ptn },
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de la transaction par PTN:', error);
      throw new Error('Impossible de récupérer la transaction');
    }
  }

  /**
   * Récupère une transaction par sa référence marchande (merchantReference)
   */
  async getTransactionByMerchantReference(merchantReference: string) {
    try {
      return await prisma.transaction.findFirst({
        where: {
          metadata: {
            path: ['merchantReference'],
            equals: merchantReference,
          },
        },
      });
    } catch (error) {
      console.error('Erreur lors de la récupération de la transaction par référence marchande:', error);
      throw new Error('Impossible de récupérer la transaction par référence marchande');
    }
  }

  /**
   * Vérifie si une transaction a été payée avec succès
   */
  async isTransactionPaid(ptn: string): Promise<boolean> {
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { ptn },
        select: { status: true },
      });

      return transaction?.status === 'SUCCESS';
    } catch (error) {
      console.error('Erreur lors de la vérification du statut de la transaction:', error);
      return false;
    }
  }

  /**
   * Récupère les transactions d'un utilisateur
   */
  async getUserTransactions(
    userId: number, 
    options: PaginationOptions = {}
  ) {
    try {
      const { limit = 10, skip = 0, status } = options;

      const where = { 
        userId,
        ...(status ? { status } : {}) 
      };

      const [transactions, total] = await Promise.all([
prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
prisma.transaction.count({ where }),
      ]);

      return { transactions, total, hasMore: skip + transactions.length < total };
    } catch (error) {
      console.error('Erreur lors de la récupération des transactions:', error);
      throw new Error('Impossible de récupérer les transactions');
    }
  }

  /**
   * Marque les transactions expirées comme expirées
   */
  async expireOldTransactions() {
    try {
const result = await prisma.transaction.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      return result.count;
    } catch (error) {
      console.error('Erreur lors de l\'expiration des transactions:', error);
      return 0;
    }
  }

  /**
   * Vérifie et met à jour le statut d'une transaction via l'API S3P
   */
  async verifyTransactionWithS3P(ptn: string) {
    try {
      // Implémentation de base de vérification
      const transaction = await this.getTransactionByPtn(ptn);
      
      if (!transaction) {
        throw new Error('Transaction non trouvée');
      }

      // Vérification basique du statut
      if (transaction.status === 'SUCCESS') {
        return { success: true, transaction };
      }

      // Si la transaction est en attente et a expiré
      if (transaction.status === 'PENDING' && transaction.expiresAt && transaction.expiresAt < new Date()) {
        await this.updateTransaction(ptn, { status: 'EXPIRED' });
        return { success: false, message: 'Transaction expirée', transaction };
      }

      return { success: false, message: 'Transaction en attente', transaction };
    } catch (error) {
      console.error('Erreur lors de la vérification de la transaction S3P:', error);
      throw new Error('Erreur lors de la vérification de la transaction');
    }
  }
}

export const transactionService = new TransactionService();
