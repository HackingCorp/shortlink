const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@example.com';
  const password = await hash('admin123', 12);
  
  try {
    // Vérifier si l'utilisateur admin existe déjà
    const existingAdmin = await prisma.user.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      return;
    }

    // Créer l'utilisateur admin
    const admin = await prisma.user.create({
      data: {
        email,
        password,
        name: 'Admin',
        role: 'ENTERPRISE',
        emailVerified: new Date(),
      },
    });

    console.log('✅ Admin user created successfully');
    console.log('Email:', email);
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
