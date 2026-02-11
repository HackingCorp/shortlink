import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withRoleAuthorization } from '@/lib/authMiddleware';

// Interface pour le type de données du lien
interface LinkData {
    id: number;
    team_id: number | null;
    user_id: number;
    click_count: number;
    share_count: number;
    long_url: string;
    title: string | null;
    created_at: Date;
    updated_at: Date;
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

// Helper pour agréger les données
const aggregateBy = (clicks: { [key: string]: any }[], key: string) => {
    const aggregation = clicks.reduce((acc, click) => {
        const value = click[key] || 'Inconnu';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    return Object.entries(aggregation).map(([name, value]) => ({ name, clicks: value }));
};

// Configuration pour éviter la mise en cache
export const dynamic = 'force-dynamic';

// Définir la fonction GET avec le middleware
const GET = withRoleAuthorization(['STANDARD', 'PRO', 'ENTERPRISE'])(
    async function GET(request: Request, { params }: { params: Promise<{ shortCode: string }> }) {
        try {
            const { shortCode } = await params;
            const user = (request as any).user; // Récupérer l'utilisateur du middleware
            
            // Récupérer les informations de base du lien avec une requête brute
            const link = await prisma.$queryRaw<LinkData[]>`
                SELECT 
                    id, 
                    team_id, 
                    user_id, 
                    click_count, 
                    COALESCE(share_count, 0) as share_count,
                    long_url, 
                    title, 
                    created_at, 
                    updated_at
                FROM "Link" 
                WHERE short_code = ${shortCode}
                LIMIT 1
            `;
            
            if (!link || link.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Lien non trouvé' },
                    { status: 404 }
                );
            }
            
            const linkData = link[0];
            
            // Récupérer les informations utilisateur séparément
            const userData = await prisma.user.findUnique({
                where: { id: linkData.user_id },
                select: {
                    id: true,
                    email: true,
                    role: true
                }
            });
            
            // Fusionner les données
            const linkWithUser = {
                ...linkData,
                user: userData
            };

            // Vérifier si l'utilisateur est le propriétaire
            const isOwner = linkData.user_id === user.id;
            let hasTeamAccess = false;

            // Vérifier les permissions d'équipe si nécessaire
            if (!isOwner && linkData.team_id) {
                const teamMember = await prisma.teamMember.findFirst({
                    where: {
                        teamId: linkData.team_id,
                        userId: user.id,
                        role: {
                            in: ['ADMIN', 'OWNER']
                        }
                    }
                });
                hasTeamAccess = !!teamMember;
            }

            // Vérifier l'accès
            if (!isOwner && !hasTeamAccess) {
                return NextResponse.json(
                    { success: false, error: 'Accès non autorisé.' },
                    { status: 403 }
                );
            }

            // Récupérer les clics
            const clicks = await prisma.click.findMany({
                where: { link_id: linkData.id },
                orderBy: { clicked_at: 'desc' },
                take: 1000
            });
            
            // Agrégation des sites référents avec typage fort
            // Par défaut, on utilise 'kut.es' pour les accès directs
            const refererSites = clicks.reduce<Record<string, number>>((acc, click) => {
                const site = (click as any).referer_site || 'kut.es';
                acc[site] = (acc[site] || 0) + 1;
                return acc;
            }, {});
            
            // Trier par nombre de clics décroissant et formater
            const sortedRefererSites = Object.entries(refererSites)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ name, clicks: count }));
            
            const stats = {
                totalClicks: linkData.click_count || 0,
                shareCount: linkData.share_count || 0,
                long_url: linkData.long_url,
                title: linkData.title || '',
                createdAt: linkData.created_at,
                lastClicked: clicks[0]?.clicked_at || null,
                userId: linkData.user_id,
                teamId: linkData.team_id || null,
                countries: aggregateBy(clicks, 'country'),
                referers: aggregateBy(clicks, 'referer'),
                refererSites: sortedRefererSites,
                devices: aggregateBy(clicks, 'device_type'),
                browsers: aggregateBy(clicks, 'browser'),
                os: aggregateBy(clicks, 'os'),
                dailyClicks: clicks.reduce<Record<string, number>>((acc, click) => {
                    const date = new Date(click.clicked_at).toISOString().split('T')[0];
                    acc[date] = (acc[date] || 0) + 1;
                    return acc;
                }, {})
            };

            return NextResponse.json({ success: true, data: stats });
            
        } catch (error) {
            console.error('Error fetching link stats:', error);
            return NextResponse.json(
                { 
                    success: false, 
                    error: error instanceof Error ? error.message : 'Erreur serveur' 
                },
                { status: 500 }
            );
        }
    }
);

export { GET };
