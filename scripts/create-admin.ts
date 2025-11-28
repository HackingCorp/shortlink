import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

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
      console.log('Admin user already exists');
      return;
    }

    // Créer l'utilisateur admin
    const admin = await prisma.user.create({
      data: {
        email,
        password,
        name: 'Admin',
        role: UserRole.ENTERPRISE,
        emailVerified: new Date(),
      },
    });

    console.log('Admin user created successfully:', admin);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
