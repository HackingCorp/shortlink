-- Vérifier si la table Transaction existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Transaction') THEN
        -- Créer la table Transaction si elle n'existe pas
        CREATE TABLE "public"."Transaction" (
            "id" TEXT NOT NULL,
            "ptn" TEXT NOT NULL,
            "amount" INTEGER NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'XAF',
            "merchant" TEXT,
            "payItemId" TEXT,
            "customerName" TEXT,
            "customerEmail" TEXT,
            "customerPhone" TEXT,
            "metadata" JSONB,
            "errorCode" TEXT,
            "errorMessage" TEXT,
            "receiptNumber" TEXT,
            "verificationCode" TEXT,
            "verificationTries" INTEGER DEFAULT 0,
            "verifiedAt" TIMESTAMP(3),
            "expiresAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            "userId" INTEGER,
            "status" TEXT NOT NULL DEFAULT 'PENDING',

            CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
        );

        -- Créer les index nécessaires
        CREATE UNIQUE INDEX "Transaction_ptn_key" ON "public"."Transaction"("ptn");
        CREATE INDEX "Transaction_status_idx" ON "public"."Transaction"("status");
        CREATE INDEX "Transaction_customerEmail_idx" ON "public"."Transaction"("customerEmail");
        CREATE INDEX "Transaction_customerPhone_idx" ON "public"."Transaction"("customerPhone");
        CREATE INDEX "Transaction_createdAt_idx" ON "public"."Transaction"("createdAt");

        -- Créer la clé étrangère vers la table User
        ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_userId_fkey" 
            FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

        RAISE NOTICE 'Table Transaction créée avec succès';
    ELSE
        RAISE NOTICE 'La table Transaction existe déjà';
    END IF;
END $$;
