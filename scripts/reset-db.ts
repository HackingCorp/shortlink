import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function resetDatabase() {
  try {
    console.log('Starting database reset...');
    
    // Supprimer toutes les données des tables
    const tables = [
      'Account',
      'Session',
      'VerificationToken',
      'ApiKey',
      'Click',
      'Link',
      'TeamMember',
      'TeamInvitation',
      'Team',
      'User',
    ];

    for (const table of tables) {
      try {
        console.log(`Deleting data from ${table}...`);
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`✅ Deleted data from ${table}`);
      } catch (error) {
        console.warn(`⚠️ Could not delete data from ${table}:`, error.message);
      }
    }

    console.log('✅ Database reset completed successfully');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
