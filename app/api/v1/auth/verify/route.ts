import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    
    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Email et code requis.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(), 
        verificationCode: code 
      },
    });

    // Vérifier si l'utilisateur existe et si le code n'est pas expiré
    if (!user || (user.verificationCodeExpiry && new Date(user.verificationCodeExpiry) < new Date())) {
      return NextResponse.json(
        { success: false, error: 'Code invalide ou expiré.' },
        { status: 400 }
      );
    }

    // Mettre à jour l'utilisateur comme vérifié
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: new Date(), 
        verificationCode: null, 
        verificationCodeExpiry: null,
        // Si vous voulez marquer le compte comme actif lors de la vérification
        // active: true
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        message: 'Compte vérifié. Vous pouvez maintenant vous connecter.' 
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error("Erreur de vérification:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur interne du serveur.' 
      },
      { status: 500 }
    );
  }
}

// CORS géré par le middleware principal