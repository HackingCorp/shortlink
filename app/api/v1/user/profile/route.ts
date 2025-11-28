import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new NextResponse(JSON.stringify({ 
        success: false, 
        error: 'Non autorisé' 
      }), { status: 401 });
    }

    const { username, email } = await req.json();

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (email !== session.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return new NextResponse(JSON.stringify({ 
          success: false, 
          error: 'Cet email est déjà utilisé par un autre compte' 
        }), { status: 400 });
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: username,
        email: email,
        emailVerified: email !== session.user.email ? null : undefined
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true
      }
    });

    // Si l'email a été modifié, envoyer un email de vérification
    if (email !== session.user.email) {
      // TODO: Implémenter l'envoi d'email de vérification
      console.log(`Email de vérification à envoyer à ${email}`);
    }

    return NextResponse.json({ 
      success: true, 
      user: updatedUser 
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    return new NextResponse(JSON.stringify({ 
      success: false, 
      error: 'Une erreur est survenue lors de la mise à jour du profil' 
    }), { status: 500 });
  }
}
