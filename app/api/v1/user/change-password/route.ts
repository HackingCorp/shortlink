import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { compare, hash } from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse(JSON.stringify({ 
        success: false, 
        error: 'Non autorisé' 
      }), { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    // Validation du nouveau mot de passe
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return new NextResponse(JSON.stringify({
        success: false,
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères'
      }), { status: 400 });
    }

    if (!currentPassword) {
      return new NextResponse(JSON.stringify({
        success: false,
        error: 'Le mot de passe actuel est requis'
      }), { status: 400 });
    }

    // Récupérer l'utilisateur avec son mot de passe hashé
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        password: true
      }
    });

    if (!user || !user.password) {
      return new NextResponse(JSON.stringify({ 
        success: false, 
        error: 'Utilisateur non trouvé' 
      }), { status: 404 });
    }

    // Vérifier l'ancien mot de passe
    const isPasswordValid = await compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return new NextResponse(JSON.stringify({ 
        success: false, 
        error: 'Le mot de passe actuel est incorrect' 
      }), { status: 400 });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await hash(newPassword, 12);

    // Update password and invalidate other sessions
    // The updatedAt field changes automatically (Prisma @updatedAt),
    // which our JWT callback checks to invalidate stale tokens.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    // Delete all database sessions for this user to force re-login
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès. Les autres sessions ont été déconnectées.'
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    return new NextResponse(JSON.stringify({ 
      success: false, 
      error: 'Une erreur est survenue lors du changement de mot de passe' 
    }), { status: 500 });
  }
}
