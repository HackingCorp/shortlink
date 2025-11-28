const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

async function checkAndCreateTransactionTable() {
  const prisma = new PrismaClient();
  
  try {
    // Vérifier si la table Transaction existe
    console.log('Vérification de l\'existence de la table Transaction...');
    
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Transaction'
      ) as exists;
    `;
    
    if (tableExists[0].exists) {
      console.log('✅ La table Transaction existe déjà');
      return;
    }
    
    console.log('La table Transaction n\'existe pas. Tentative de création...');
    
    // Créer la table Transaction via une migration SQL brute
    await prisma.$executeRaw`
      CREATE TABLE "Transaction" (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        ptn TEXT NOT NULL UNIQUE,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'XAF',
        merchant TEXT,
        "payItemId" TEXT,
        "customerName" TEXT,
        "customerEmail" TEXT,
        "customerPhone" TEXT,
        metadata JSONB,
        "errorCode" TEXT,
        "errorMessage" TEXT,
        "receiptNumber" TEXT,
        "verificationCode" TEXT,
        "verificationTries" INTEGER DEFAULT 0,
        "verifiedAt" TIMESTAMP(3),
        "expiresAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" INTEGER,
        status TEXT NOT NULL DEFAULT 'PENDING',
        CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
      );
      
      CREATE INDEX "Transaction_ptn_idx" ON "Transaction"("ptn");
      CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
      CREATE INDEX "Transaction_customerEmail_idx" ON "Transaction"("customerEmail");
      CREATE INDEX "Transaction_customerPhone_idx" ON "Transaction"("customerPhone");
      CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");
    `;
    
    console.log('✅ Table Transaction créée avec succès');
    
  } catch (error) {
    console.error('Erreur lors de la vérification/création de la table Transaction:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndCreateTransactionTable();
