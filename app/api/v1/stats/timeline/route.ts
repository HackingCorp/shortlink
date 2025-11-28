// app/api/v1/stats/timeline/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

function getDateRange(period: string) {
    const endDate = new Date();
    let startDate = new Date();

    switch (period) {
        case '30d':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '12m':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        default:
            startDate.setDate(endDate.getDate() - 7); 
            break;
    }
    return { startDate, endDate };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');
        const type = searchParams.get('type') || 'clicks_daily'; 
        const period = searchParams.get('period') || '30d'; 

        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Authentification requise.' }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        let whereClause: any = { user_id: userId, team_id: null };

        if (teamId) {
            const membership = await prisma.teamMember.findUnique({
                where: { teamId_userId: { teamId: parseInt(teamId), userId } },
            });
            if (!membership) {
                return NextResponse.json({ success: false, error: "Accès non autorisé à cette équipe." }, { status: 403 });
            }
            whereClause = { teamId: parseInt(teamId) };
        }

        const { startDate } = getDateRange(period);

        let results;

        if (type === 'clicks_monthly' || type === 'clicks_daily') {
            const linkIds = (await prisma.link.findMany({ where: whereClause, select: { id: true } })).map(l => l.id);
            if (linkIds.length === 0) {
                return NextResponse.json({ success: true, data: [] });
            }

            const query = `
                SELECT DATE_TRUNC('${type === 'clicks_monthly' ? 'month' : 'day'}', clicked_at) as date, COUNT(*) as value
                FROM "Click"
                WHERE link_id = ANY($1) AND clicked_at >= $2
                GROUP BY 1
                ORDER BY 1;
            `;
            results = await prisma.$queryRawUnsafe(query, linkIds, startDate);

        } else if (type === 'links_monthly' || type === 'links_daily') {
            const dateTrunc = type === 'links_monthly' ? 'month' : 'day';
            let whereCondition;
            if (teamId) {
                whereCondition = Prisma.sql`team_id = ${parseInt(teamId)}`;
            } else {
                whereCondition = Prisma.sql`user_id = ${userId} AND team_id IS NULL`;
            }

            const query = Prisma.sql`
                SELECT DATE_TRUNC(${dateTrunc}, created_at) as date, COUNT(*) as value
                FROM "Link"
                WHERE ${whereCondition} AND created_at >= ${startDate}
                GROUP BY 1
                ORDER BY 1;
            `;
            results = await prisma.$queryRaw(query);
        } else {
            return NextResponse.json({ success: false, error: 'Type de statistique non valide.' }, { status: 400 });
        }

        const formattedData = (results as any[]).map(item => ({
            date: new Date(item.date).toISOString().split('T')[0],
            value: Number(item.value)
        }));

        return NextResponse.json({ success: true, data: formattedData }, { status: 200 });

    } catch (error) {
        console.error(`Erreur API [${request.url}]:`, error);
        return NextResponse.json(
            { success: false, error: 'Erreur lors de la récupération des statistiques chronologiques' },
            { status: 500 }
        );
    }
}
