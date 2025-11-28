const { PrismaClient } = require('@prisma/client');

async function checkTable() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Vérification de l\'existence de la table Transaction...');
    
    // Vérifier si la table existe
    const result = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'Transaction';
    `;
    
    if (result && result.length > 0) {
      console.log('✅ La table Transaction existe');
      
      // Afficher la structure de la table
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'Transaction';
      `;
      
      console.log('\nStructure de la table Transaction :');
      console.table(columns);
    } else {
      console.log('❌ La table Transaction n\'existe pas');
    }
    
  } catch (error) {
    console.error('Erreur lors de la vérification de la table :', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTable();
