import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Récupérer les équipes de l'utilisateur avec les détails complets
    const memberships = await prisma.$queryRaw`
      SELECT tm.*, t.name as team_name
      FROM "TeamMember" tm
      JOIN "Team" t ON tm."teamId" = t.id
      WHERE tm."userId" = ${parseInt(session.user.id)}
    `;

    // Formater la réponse
    const formattedTeams = memberships.map((member: any) => ({
      id: member.teamId,
      name: member.team_name || 'Équipe sans nom',
      role: member.role,
      type: 'team' as const
    }));

    // Créer le contexte personnel par défaut
    const personalContext = {
      type: 'personal' as const,
      name: 'Espace Personnel',
      email: session.user.email
    };

    return NextResponse.json({
      success: true,
      data: {
        teams: formattedTeams,
        personal: personalContext
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des membres:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
