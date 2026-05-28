import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/apiAuth';


export async function GET(request: NextRequest) {
  try {
    // 1. Authentification et récupération de la session
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const userId = auth.user!.id;

    const { searchParams } = new URL(request.url);
    const teamIdStr = searchParams.get('teamId');

    // 2. Logique de contexte (équipe ou personnel)
    let linkWhereClause: Prisma.LinkWhereInput = { user_id: userId, team_id: null };
    
    if (teamIdStr) {
      const teamId = parseInt(teamIdStr);
      if (isNaN(teamId)) {
          return NextResponse.json({ success: false, error: 'ID d\'équipe invalide.' }, { status: 400 });
      }

      // Vérification des permissions
      const teamAccess = await prisma.teamMember.findFirst({
        where: { teamId: teamId, userId: userId }
      });
      if (!teamAccess) {
        return NextResponse.json({ success: false, error: 'Accès non autorisé à cette équipe' }, { status: 403 });
      }
      linkWhereClause = { team_id: teamId };
    }
    
    // Vérifier les liens de l'utilisateur
    const userLinks = await prisma.link.findMany({
      where: linkWhereClause,
      select: { id: true, short_code: true, long_url: true, click_count: true }
    });
    if (userLinks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalClicks: 0,
          uniqueVisitors: 0,
          countries: [],
          browsers: [],
          os: [],
          devices: [],
          cities: [],
          referers: []
        }
      });
    }
    
    const linkIds = userLinks.map(link => link.id);
    const clickWhere = { link_id: { in: linkIds } };

    // Aggregate total clicks and unique visitors in SQL
    const [clickAgg, uniqueVisitorAgg] = await Promise.all([
      prisma.click.count({ where: clickWhere }),
      prisma.click.groupBy({
        by: ['ip_address'],
        where: { ...clickWhere, ip_address: { not: null } },
      }),
    ]);

    const totalClicks = clickAgg;
    const uniqueVisitors = uniqueVisitorAgg.length;

    if (totalClicks === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalClicks: 0,
          uniqueVisitors: 0,
          countries: [],
          browsers: [],
          os: [],
          devices: [],
          cities: [],
          referers: []
        }
      });
    }

    // Run all groupBy queries in parallel using SQL aggregation
    const [countriesRaw, browsersRaw, osRaw, devicesRaw, citiesRaw, referersRaw] = await Promise.all([
      prisma.click.groupBy({
        by: ['country'],
        where: { ...clickWhere, country: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ['browser'],
        where: { ...clickWhere, browser: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ['os'],
        where: { ...clickWhere, os: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ['device_type'],
        where: { ...clickWhere, device_type: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ['city'],
        where: { ...clickWhere, city: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.click.groupBy({
        by: ['referer'],
        where: { ...clickWhere, referer: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Transform groupBy results to { name, clicks } format
    const mapGroupBy = <T extends { _count: { id: number } }>(rows: T[], field: keyof T) =>
      rows.map(row => ({ name: String(row[field]), clicks: row._count.id }));

    const responseData = {
      success: true,
      data: {
        totalClicks,
        uniqueVisitors,
        countries: mapGroupBy(countriesRaw, 'country'),
        browsers: mapGroupBy(browsersRaw, 'browser'),
        os: mapGroupBy(osRaw, 'os'),
        devices: mapGroupBy(devicesRaw, 'device_type'),
        cities: mapGroupBy(citiesRaw, 'city'),
        referers: mapGroupBy(referersRaw, 'referer'),
      }
    };

    return NextResponse.json(responseData);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Erreur inconnue';
    const errObj = error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : { message: String(error) };
    console.error('Erreur détaillée lors de la récupération des statistiques:', errObj);

    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        details: process.env.NODE_ENV === 'development' ? errMsg : undefined
      },
      { status: 500 }
    );
  }
}