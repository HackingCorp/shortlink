const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { username: 'maxime' }
    });

    if (existingUser) {
      console.log('✅ Utilisateur "maxime" existe déjà');
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('password123', 12);

    // Créer l'utilisateur de test
    const user = await prisma.user.create({
      data: {
        username: 'maxime',
        email: 'maxime@example.com',
        password: hashedPassword,
        email_verified: true,
        role: 'ENTERPRISE', // Rôle Enterprise pour tester les fonctionnalités d'équipe
        subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 an
      }
    });

    console.log('✅ Utilisateur de test créé avec succès:');
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log('   Mot de passe: password123');

    // Créer une équipe de test
    const team = await prisma.team.create({
      data: {
        name: 'Équipe de Test',
        description: 'Équipe pour tester les fonctionnalités Enterprise',
        ownerId: user.id
      }
    });

    // Ajouter l'utilisateur comme membre de l'équipe
    await prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId: team.id,
        role: 'OWNER'
      }
    });

    console.log('✅ Équipe de test créée avec succès:');
    console.log(`   Nom: ${team.name}`);
    console.log(`   ID: ${team.id}`);

    // Créer quelques liens de test pour l'équipe
    const links = await Promise.all([
      prisma.link.create({
        data: {
          short_code: 'test1',
          long_url: 'https://example.com/page1',
          title: 'Lien de Test 1',
          description: 'Premier lien de test pour l\'équipe',
          user_id: user.id,
          team_id: team.id
        }
      }),
      prisma.link.create({
        data: {
          short_code: 'test2',
          long_url: 'https://example.com/page2',
          title: 'Lien de Test 2',
          description: 'Deuxième lien de test pour l\'équipe',
          user_id: user.id,
          team_id: team.id
        }
      })
    ]);

    console.log('✅ Liens de test créés:');
    links.forEach(link => {
      console.log(`   ${link.short_code} -> ${link.long_url}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur de test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
