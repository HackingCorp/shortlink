import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        
        // Récupération de l'utilisateur authentifié
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Authentification requise.' },
                { status: 401 }
            );
        }
        
        const userId = parseInt(session.user.id);
        let whereClause: any = { user_id: userId, team_id: null };

        // Si un teamId est fourni, on vérifie l'appartenance
        if (teamId) {
            const membership = await prisma.teamMember.findUnique({
                where: { 
                    teamId_userId: { 
                        teamId: parseInt(teamId), 
                        userId 
                    } 
                },
            });
            
            if (!membership) {
                return NextResponse.json(
                    { success: false, error: "Accès non autorisé à cette équipe." },
                    { status: 403 }
                );
            }
            whereClause = { teamId: parseInt(teamId) };
        }

     
        const [totalLinks, totalClicks, linksWithClicks] = await Promise.all([
            prisma.link.count({ where: whereClause }),
            prisma.link.aggregate({
                _sum: { click_count: true },
                where: whereClause,
            }),
            prisma.link.findMany({
                where: whereClause,
                include: {
                    clicks: {
                        where: { 
                            clicked_at: { 
                                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
                            } 
                        },
                        select: { clicked_at: true }
                    }
                }
            })
        ]);
        
        console.log('Résultat de l\'agrégation des clics:', totalClicks);
        
        
        
        const clicksTimeline = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            clicksTimeline.set(dateKey, 0);
        }

        linksWithClicks.forEach(link => {
            link.clicks.forEach(click => {
                const dateStr = click.clicked_at.toISOString().split('T')[0];
                if (clicksTimeline.has(dateStr)) {
                    clicksTimeline.set(dateStr, clicksTimeline.get(dateStr)! + 1);
                }
            });
        });
        
        const timeline = Array.from(clicksTimeline.entries()).map(([date, clicks]) => ({ date, clicks }));

        return NextResponse.json({
            success: true,
            data: {
                totalLinks,
                totalClicks: totalClicks._sum?.click_count || 0,
                timeline,
            }
        }, { status: 200 });
        
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques globales:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: 'Erreur lors de la récupération des statistiques',
                details: error instanceof Error ? error.message : 'Erreur inconnue'
            },
            { status: 500 }
        );
    }
}
