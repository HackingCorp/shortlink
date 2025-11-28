import { PrismaClient } from '@prisma/client';

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('Testing database connection...');
    
    // Test 1: Vérifier la connexion
    await prisma.$connect();
    console.log('✅ Connected to the database');
    
    // Test 2: Compter les utilisateurs
    const userCount = await prisma.user.count();
    console.log(`Found ${userCount} users in the database`);
    
    // Test 3: Vérifier les tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;
    console.log('Tables in the database:', tables);
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from the database');
  }
}

testConnection();
