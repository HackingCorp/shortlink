'use client';
import { useSession } from "next-auth/react";
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BarChart, Link as LinkIcon, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TimelineChart } from '@/components/charts/TimelineChart';

type TimelineData = { date: string; value: number }[];

type GlobalStats = {
    totalLinks: number;
    totalClicks: number;
    timeline: { date: string; clicks: number }[];
};

export default function DashboardPage() {
    const { data: session } = useSession();
    const { activeContext, isLoading: isWorkspaceLoading } = useWorkspace();
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [clicksMonthly, setClicksMonthly] = useState<TimelineData>([]);
    const [linksDaily, setLinksDaily] = useState<TimelineData>([]);
    const [linksMonthly, setLinksMonthly] = useState<TimelineData>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (activeContext) {
            setIsLoading(true);
            const teamParam = activeContext.type === 'team' ? `teamId=${activeContext.id}` : '';

            const fetchAllStats = async () => {
                try {
                    const buildUrl = (path: string, params: Record<string, string>) => {
                        const query = new URLSearchParams();
                        if (activeContext.type === 'team') {
                            query.set('teamId', activeContext.id.toString());
                        }
                        Object.entries(params).forEach(([key, value]) => query.set(key, value));
                        return `${path}?${query.toString()}`;
                    };

                    const [globalRes, clicksMonthlyRes, linksDailyRes, linksMonthlyRes] = await Promise.all([
                        fetch(buildUrl('/api/v1/stats/global', {})),
                        fetch(buildUrl('/api/v1/stats/timeline', { type: 'clicks_monthly', period: '12m' })),
                        fetch(buildUrl('/api/v1/stats/timeline', { type: 'links_daily', period: '30d' })),
                        fetch(buildUrl('/api/v1/stats/timeline', { type: 'links_monthly', period: '12m' }))
                    ]);

                    const globalData = await globalRes.json();
                    if (globalData.success) setStats(globalData.data);

                    const clicksMonthlyData = await clicksMonthlyRes.json();
                    if (clicksMonthlyData.success) setClicksMonthly(clicksMonthlyData.data);

                    const linksDailyData = await linksDailyRes.json();
                    if (linksDailyData.success) setLinksDaily(linksDailyData.data);

                    const linksMonthlyData = await linksMonthlyRes.json();
                    if (linksMonthlyData.success) setLinksMonthly(linksMonthlyData.data);

                } catch (error) {
                    console.error("Erreur lors de la récupération des statistiques:", error);
                } finally {
                    setIsLoading(false);
                }
            };

            fetchAllStats();
        }
    }, [activeContext]);

    if (isWorkspaceLoading || isLoading) {
        return <div>Chargement de votre tableau de bord...</div>
    }

    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800">
                Bonjour, {session?.user?.name || 'Utilisateur'} !
            </h1>
            <p className="mt-2 text-gray-600">
                Voici un aperçu de votre espace <span className="font-semibold text-indigo-600">{activeContext?.name}</span>.
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700">Total des Liens</h3>
                        <LinkIcon className="w-6 h-6 text-gray-400"/>
                    </div>
                    <p className="text-4xl font-bold mt-2 text-gray-900">{stats?.totalLinks ?? 0}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-700">Total des Clics</h3>
                        <BarChart className="w-6 h-6 text-gray-400"/>
                    </div>
                    <p className="text-4xl font-bold mt-2 text-gray-900">{(stats?.totalClicks ?? 0).toLocaleString('fr-FR')}</p>
                </div>
                {/* La stat des membres peut être ajoutée via un autre fetch si nécessaire */}
            </div>
            
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800">Clics (7 derniers jours)</h3>
                    {stats && stats.timeline.length > 0 ? (
                        <TimelineChart data={stats.timeline} dataKey="clicks" yAxisLabel="Clics" />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">Pas de données.</div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800">Clics (12 derniers mois)</h3>
                    {clicksMonthly.length > 0 ? (
                        <TimelineChart data={clicksMonthly} dataKey="value" yAxisLabel="Clics" />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">Pas de données.</div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800">Liens créés (30 derniers jours)</h3>
                    {linksDaily.length > 0 ? (
                        <TimelineChart data={linksDaily} dataKey="value" yAxisLabel="Liens" />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">Pas de données.</div>
                    )}
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800">Liens créés (12 derniers mois)</h3>
                    {linksMonthly.length > 0 ? (
                        <TimelineChart data={linksMonthly} dataKey="value" yAxisLabel="Liens" />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">Pas de données.</div>
                    )}
                </div>
            </div>
        </div>
    );
}