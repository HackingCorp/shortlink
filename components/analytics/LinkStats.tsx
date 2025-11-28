'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { BarChart, ExternalLink, Clock, Users, Globe, Smartphone, Laptop, MapPin } from 'lucide-react';
import { BarChartComponent } from '@/components/charts/BarChartComponent';
import { WorldMapChart } from '@/components/charts/WorldMapChart';
import { LineChartComponent } from '@/components/charts/LineChartComponent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LinkStatsProps {
  shortCode: string;
}

type AnalyticsData = {
  totalClicks: number;
  shareCount: number;
  long_url: string;
  title: string;
  createdAt: string;
  lastClicked: string | null;
  countries: { name: string; clicks: number }[];
  referers: { name: string; clicks: number }[];
  refererSites: { name: string; clicks: number }[];
  devices: { name: string; clicks: number }[];
  browsers: { name: string; clicks: number }[];
  os: { name: string; clicks: number }[];
  dailyClicks: Record<string, number>;
};

export function LinkStats({ shortCode }: LinkStatsProps) {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      console.log('Début du chargement des statistiques pour:', shortCode);
      try {
        const response = await fetch(`/api/v1/links/${shortCode}/stats`);
        console.log('Réponse de l\'API - Statut:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erreur de réponse:', errorText);
          throw new Error('Erreur lors du chargement des statistiques');
        }
        
        const data = await response.json();
        console.log('Données reçues de l\'API:', data);
        
        if (data.success) {
          console.log('Données de statistiques chargées avec succès:', data.data);
          setStats(data.data);
        } else {
          console.error('Erreur dans la réponse:', data.error);
          throw new Error(data.error || 'Erreur inconnue');
        }
      } catch (err) {
        console.error('Erreur lors du chargement des statistiques:', err);
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      } finally {
        setIsLoading(false);
      }
    };

    if (shortCode) {
      fetchStats();
    }
  }, [shortCode]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p>Aucune donnée disponible pour ce lien</p>
      </div>
    );
  }

  // Préparer les données pour le graphique de clics quotidiens
  const dailyClicksData = Object.entries(stats.dailyClicks || {}).map(([date, count]) => ({
    date,
    clics: count
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-8">
      {/* En-tête avec les informations du lien */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart className="h-6 w-6" />
            {stats.title || 'Lien sans titre'}
          </h1>
          <Badge variant="outline" className="text-sm">
            {stats.totalClicks} clic{stats.totalClicks !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 gap-4 flex-wrap">
          <a 
            href={stats.long_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-blue-600 hover:underline truncate max-w-full"
            title={stats.long_url}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            <span className="truncate">{stats.long_url}</span>
          </a>
          
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            <span>Créé le {format(new Date(stats.createdAt), 'PP', { locale: fr })}</span>
          </div>
          
          {stats.lastClicked && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>Dernier clic: {format(new Date(stats.lastClicked), 'PPp', { locale: fr })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Graphique des clics quotidiens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Évolution des clics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <LineChartComponent 
              data={dailyClicksData}
              xKey="date"
              yKey="clics"
              xAxisLabel="Date"
              yAxisLabel="Nombre de clics"
              tooltipLabel="Clics"
            />
          </div>
        </CardContent>
      </Card>

      {/* Grille de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Pays */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pays</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <BarChartComponent 
                data={stats.countries} 
                dataKey="clicks" 
                nameKey="name"
                name="Clics"
                orientation="vertical"
              />
            </div>
          </CardContent>
        </Card>

        {/* Navigateurs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Navigateurs</CardTitle>
            <Laptop className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <BarChartComponent 
                data={stats.browsers} 
                dataKey="clicks" 
                nameKey="name"
                name="Clics"
                orientation="vertical"
              />
            </div>
          </CardContent>
        </Card>

        {/* Systèmes d'exploitation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Systèmes d'exploitation</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <BarChartComponent 
                data={stats.os} 
                dataKey="clicks" 
                nameKey="name"
                name="Clics"
                orientation="vertical"
              />
            </div>
          </CardContent>
        </Card>

        {/* Référents */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sites référents</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <BarChartComponent 
                data={stats.referers} 
                dataKey="clicks" 
                nameKey="name"
                name="Clics"
                orientation="horizontal"
              />
            </div>
          </CardContent>
        </Card>

        {/* Appareils */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Types d'appareils</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <BarChartComponent 
                data={stats.devices} 
                dataKey="clicks" 
                nameKey="name"
                name="Clics"
                orientation="vertical"
              />
            </div>
          </CardContent>
        </Card>
        </div>  
        {/* Carte du monde */}
      {stats.countries.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition Géographique</h3>
          <WorldMapChart data={stats.countries} />
        </div>
      )}
      
      {/* Statistiques de partage et référents */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nombre de partages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partages</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shareCount || 0}</div>
            <p className="text-xs text-muted-foreground">Nombre total de partages</p>
          </CardContent>
        </Card>

        {/* Sites référents */}
        {stats.refererSites && stats.refererSites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sites référents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.refererSites.slice(0, 5).map((ref, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{ref.name}</span>
                    <span className="text-sm text-muted-foreground">{ref.clicks} visites</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
    </div>
  );
}
