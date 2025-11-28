import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  console.log('Début de la requête de mise à jour de plan');
  try {
    const session = await getServerSession(authOptions);
    console.log('Session récupérée:', { userId: session?.user?.id, role: session?.user?.role });
    
    if (!session?.user?.id) {
      console.error('Erreur: Aucun utilisateur connecté');
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const data = await request.json();
    console.log('Données reçues:', data);
    const { plan } = data;
    const validPlans = ['FREE', 'STANDARD', 'PRO', 'ENTERPRISE'] as const;
    type ValidPlan = typeof validPlans[number];
    
    console.log('Plan demandé:', plan);

    if (!validPlans.includes(plan as ValidPlan)) {
      return NextResponse.json(
        { success: false, error: `Plan non valide. Doit être l'un des suivants: ${validPlans.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('Tentative de mise à jour du plan pour l\'utilisateur:', session.user.id);
    
    // Mettre à jour le rôle de l'utilisateur dans la base de données
    const updateData = {
      role: plan,
      ...(plan !== 'FREE' && { 
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
      })
    };
    console.log('Données de mise à jour:', updateData);
    
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { 
        role: plan,
        // Mettre à jour la date d'expiration pour les abonnements payants
        ...(plan !== 'FREE' && { 
          planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
        })
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true
      }
    });

    const responseData = {
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role
      }
    };
    
    console.log('Mise à jour réussie:', responseData);
    return NextResponse.json(responseData);
      
  } catch (error) {
    console.error('Erreur lors de la mise à jour du plan:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur lors de la mise à jour du plan',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
