'use client';
import { useSession } from 'next-auth/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BarChart, AlertCircle, TrendingUp, Users, Globe, Monitor } from 'lucide-react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { LockedFeature } from '@/components/ui/LockedFeature';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { WorldMapChart } from '@/components/charts/WorldMapChart';

interface StatItem {
  name: string;
  clicks: number;
}

interface AnalyticsData {
  totalClicks: number;
  uniqueVisitors: number;
  countries: StatItem[];
  browsers: StatItem[];
  os: StatItem[];
  devices: StatItem[];
  cities: StatItem[];
  referers: StatItem[];
}

interface ApiResponse {
  success: boolean;
  data: AnalyticsData;
  error?: string;
}

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const { activeContext } = useWorkspace();
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = useMemo(() => session?.user?.role, [session?.user?.role]);
  const contextKey = useMemo(() => {
    if (!activeContext) return null;
    const contextId = 'id' in activeContext ? activeContext.id : 'personal';
    return `${activeContext.type}-${contextId}`;
  }, [activeContext]);

  const fetchAnalytics = useCallback(async () => {
    if (!activeContext || !userRole || userRole === 'FREE') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      let apiUrl = '/api/v1/stats/analytics';
      if (activeContext.type === 'team') {
        apiUrl += `?teamId=${activeContext.id}`;
      }
      
      console.log('Fetching analytics from:', apiUrl);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} - ${response.statusText}`);
      }
      
      const result: ApiResponse = await response.json();
      console.log('Réponse de l\'API complète:', result);
      
      if (result.success && result.data) {
        console.log('Données analytics reçues:', {
          totalClicks: result.data.totalClicks,
          uniqueVisitors: result.data.uniqueVisitors,
          countries: result.data.countries?.length || 0,
          browsers: result.data.browsers?.length || 0,
          os: result.data.os?.length || 0,
          devices: result.data.devices?.length || 0,
          cities: result.data.cities?.length || 0,
          referers: result.data.referers?.length || 0
        });
        setStats(result.data);
      } else {
        console.error('Erreur dans la réponse API:', result.error);
        setError(result.error || 'Erreur lors du chargement des données');
      }
    } catch (err: any) {
      console.error('Erreur lors de la récupération des analytics:', err);
      setError('Impossible de charger les statistiques. Veuillez réessayer plus tard.');
    } finally {
      setIsLoading(false);
    }
  }, [activeContext, userRole]);

  useEffect(() => {
    console.log('Effect triggered with:', { contextKey, userRole });
    fetchAnalytics();
  }, [contextKey, userRole, fetchAnalytics]);
  const MetricCard = ({ title, value, icon: Icon, subtitle }: { 
    title: string; 
    value: number; 
    icon: any; 
    subtitle?: string; 
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Icon className="h-8 w-8 text-blue-600" />
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-semibold text-gray-900">{value.toLocaleString()}</p>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
        </div>
      </div>
    </div>
  );

  // Composant pour les graphiques
  const ChartCard = ({ title, data, isEmpty = false }: { 
    title: string; 
    data: StatItem[]; 
    isEmpty?: boolean; 
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {isEmpty || !data || data.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          <p>Aucune donnée disponible</p>
        </div>
      ) : (
        <div>
          <BarChartComponent 
  data={data.map(item => ({
    name: item.name, 
    value: item.clicks
  }))} 
  dataKey="value" 
  name="Clics" 
/>
          <div className="mt-4 text-sm text-gray-600">
            Total: {data.reduce((sum, item) => sum + item.clicks, 0)} clics
          </div>
        </div>
      )}
    </div>
  );

  const retryFetch = useCallback(() => {
    console.log('Retry fetch triggered');
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (!userRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (userRole === 'FREE') {
    return (
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <BarChart className="mr-3" /> Analytics
        </h1>
        <LockedFeature featureName="Statistiques Détaillées" requiredPlan="Standard" />
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <BarChart className="mr-3" /> Analytics ({activeContext?.name})
        </h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-4 text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <BarChart className="mr-3" /> Analytics ({activeContext?.name})
        </h1>
        <div className="mt-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button 
                onClick={retryFetch}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-800 flex items-center">
        <BarChart className="mr-3" /> Analytics ({activeContext?.name})
      </h1>
      <p className="text-gray-600 mt-2">Analysez les performances de vos liens en détail.</p>
      

      
      {/* Métriques principales */}
      {stats && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="Total des clics" 
            value={stats.totalClicks || 0} 
            icon={TrendingUp} 
            subtitle="Tous les clics enregistrés"
          />
          <MetricCard 
            title="Visiteurs uniques" 
            value={stats.uniqueVisitors || 0} 
            icon={Users} 
            subtitle="Adresses IP distinctes"
          />
          <MetricCard 
            title="Pays" 
            value={stats.countries?.length || 0} 
            icon={Globe} 
            subtitle="Pays d'origine des clics"
          />
          <MetricCard 
            title="Appareils" 
            value={stats.devices?.length || 0} 
            icon={Monitor} 
            subtitle="Types d'appareils utilisés"
          />
        </div>
      )}
      

      {/* Graphiques */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats && (
          <>
            <ChartCard title="Top Pays" data={stats.countries || []} />
            <ChartCard title="Navigateurs" data={stats.browsers || []} />
            <ChartCard title="Systèmes d'exploitation" data={stats.os || []} />
            <ChartCard title="Types d'appareils" data={stats.devices || []} />
          </>
        )}
        
        {userRole === 'PRO' || userRole === 'ENTERPRISE' ? (
          <>
            {stats && (
              <>
                <ChartCard title="Top Villes" data={stats.cities || []} />
                <ChartCard title="Sites Référents" data={stats.referers || []} />
              </>
            )}
          </>
        ) : (
          <>
            <LockedFeature featureName="Top Villes" requiredPlan="Pro" />
            <LockedFeature featureName="Sites Référents" requiredPlan="Pro" />
          </>
        )}
      </div>

            {/* Carte du monde */}
            {stats && stats.countries && stats.countries.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition Géographique</h3>
          <WorldMapChart data={stats.countries} />
        </div>
      )}



      
      {/* Message si aucune donnée */}
      {stats && stats.totalClicks === 0 && (
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <BarChart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune donnée d'analytics</h3>
          <p className="text-gray-500">
            Vos liens n'ont pas encore été cliqués. Partagez-les pour commencer à voir des statistiques !
          </p>
          <button 
            onClick={retryFetch}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Actualiser
          </button>
        </div>
      )}
    </div>
  );
}