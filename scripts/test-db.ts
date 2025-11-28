import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
  ],
});

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Compter les utilisateurs
    const userCount = await prisma.user.count();
    console.log(`Found ${userCount} users in the database.`);
    
    // Test 2: Créer un lien de test
    console.log('Creating a test link...');
    const testLink = await prisma.link.create({
      data: {
        short_code: 'test-' + Date.now(),
        long_url: 'https://example.com',
        title: 'Test Link',
        user: {
          connect: { id: 1 } // Assurez-vous que cet ID existe
        }
      }
    });
    console.log('Test link created:', testLink);
    
    // Test 3: Créer un clic de test
    console.log('Creating a test click...');
    const testClick = await prisma.click.create({
      data: {
        link_id: testLink.id,
        ip_address: '127.0.0.1',
        user_agent: 'Test User Agent',
        referer: 'Test Referer'
      }
    });
    console.log('Test click created:', testClick);
    
    // Test 4: Vérifier le compteur de clics
    const updatedLink = await prisma.link.findUnique({
      where: { id: testLink.id },
      include: { clicks: true }
    });
    console.log('Link with clicks:', updatedLink);
    
  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
