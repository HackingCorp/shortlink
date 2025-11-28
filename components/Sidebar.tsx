'use client';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { LayoutDashboard, Link as LinkIcon, BarChart3, Users, Settings, KeyRound, LogOut, Zap, Crown, Star, Award, ArrowUpCircle } from 'lucide-react';
import { WorkspaceSelector } from './WorkspaceSelector';

// Fonction pour obtenir le libellé du rôle
const getRoleLabel = (role: string) => {
  switch(role) {
    case 'FREE': return 'Gratuit';
    case 'STANDARD': return 'Standard';
    case 'PRO': return 'Pro';
    case 'ENTERPRISE': return 'Entreprise';
    default: return role;
  }
};

export function Sidebar() {
  const { data: session, status, update } = useSession();
  const pathname = usePathname();
  const userRole = session?.user?.role || 'FREE';
  
  // État pour stocker les informations de renouvellement
  const [renewalInfo, setRenewalInfo] = useState<{
    subscription: {
      role: string;
      daysRemaining: number;
      isExpired: boolean;
      isExpiringSoon: boolean;
      planExpiresAt: string | null;
      urgencyLevel: 'none' | 'low' | 'medium' | 'high';
    };
  } | null>(null);

  // Récupérer les informations de renouvellement
  useEffect(() => {
    const fetchRenewalInfo = async () => {
      try {
        const response = await fetch('/api/v1/subscription/renewal-info', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setRenewalInfo(data.data);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des informations de renouvellement:', error);
      }
    };

    if (userRole !== 'FREE') {
      fetchRenewalInfo();
    }
  }, [userRole]);

  // Utiliser les données de renouvellement si disponibles, sinon utiliser la session
  const daysUntilDowngrade = renewalInfo?.subscription?.daysRemaining || 0;
  const showDowngradeWarning = userRole !== 'FREE' && 
    (renewalInfo?.subscription?.urgencyLevel === 'high' || 
     renewalInfo?.subscription?.urgencyLevel === 'medium');
  
  const isLoading = status === 'loading';
  
  // Si la session est en cours de chargement, afficher un chargement
  if (isLoading) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
        <div className="p-4 border-b border-gray-200">
          <div className="animate-pulse h-8 w-32 bg-gray-200 rounded"></div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </aside>
    );
  }

  // Regroupement des éléments de navigation par catégorie
  const navSections = [
    {
      title: "Navigation principale",
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['FREE', 'STANDARD', 'PRO', 'ENTERPRISE'] },
        { href: '/dashboard/links', label: 'Liens', icon: LinkIcon, roles: ['FREE', 'STANDARD', 'PRO', 'ENTERPRISE'] },
        { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, roles: ['STANDARD', 'PRO', 'ENTERPRISE'] },
      ]
    },
    {
      title: "Gestion de l'abonnement",
      items: [
        { 
          href: '/dashboard/upgrade', 
          label: 'Mise à niveau', 
          icon: ArrowUpCircle, 
          roles: ['FREE', 'STANDARD'],
          highlight: userRole === 'FREE' || userRole === 'STANDARD',
          badge: userRole === 'FREE' && 'Premium' || userRole === 'STANDARD' && 'PRO'
        },
        { href: '/dashboard/renew', label: 'Renouvellement', icon: Clock, roles: ['STANDARD', 'PRO', 'ENTERPRISE'] },
      ]
    },
    {
      title: "Configuration",
      items: [
        { href: '/dashboard/settings/api-keys', label: 'Clés API', icon: KeyRound, roles: ['PRO', 'ENTERPRISE'] },
        // { href: '/dashboard/team', label: 'Gestion des membres', icon: Users, roles: ['ENTERPRISE'] },
        { href: '/dashboard/settings', label: 'Paramètres', icon: Settings, roles: ['FREE', 'STANDARD', 'PRO', 'ENTERPRISE'] },
      ]
    }
  ];
  
  // Filtrer les éléments selon le rôle de l'utilisateur
  const filteredNavSections = navSections.map(section => ({
    ...section,
    items: section.items.filter(item => item.roles.includes(userRole || 'FREE'))
  })).filter(section => section.items.length > 0); // Supprimer les sections vides

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* En-tête avec logo et statut d'abonnement */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-indigo-600">kut.es</h1>
          <div className="flex flex-col items-end">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              userRole === 'FREE' ? 'bg-gray-100 text-gray-800' :
              userRole === 'STANDARD' ? 'bg-blue-100 text-blue-800' :
              userRole === 'PRO' ? 'bg-purple-100 text-purple-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {getRoleLabel(userRole)}
            </span>
            {userRole !== 'FREE' && daysUntilDowngrade > 0 && (
              <div className="mt-1">
                <span className={`text-xs flex items-center ${
                  daysUntilDowngrade <= 7 ? 'text-red-600' : 
                  daysUntilDowngrade <= 30 ? 'text-amber-600' : 'text-gray-500'
                }`}>
                  {daysUntilDowngrade <= 7 ? <AlertTriangle className="h-3 w-3 mr-1" /> : 
                   daysUntilDowngrade <= 30 ? <Clock className="h-3 w-3 mr-1" /> : 
                   <CheckCircle className="h-3 w-3 mr-1" />}
                  {daysUntilDowngrade} jour{daysUntilDowngrade > 1 ? 's' : ''} restant{daysUntilDowngrade > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sélecteur d'espace de travail */}
      <div className="p-4 border-b border-gray-200">
        <WorkspaceSelector />
      </div>

      {/* Avertissement de rétrogradation */}
      {showDowngradeWarning && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-amber-800">
                Votre abonnement expire dans {daysUntilDowngrade} jour{daysUntilDowngrade > 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Renouvelez pour éviter la rétrogradation en compte gratuit.
              </p>
              <div className="mt-2">
                <Link href="/dashboard/renew" className="inline-flex items-center text-sm font-medium text-amber-700 hover:text-amber-600">
                  Renouveler maintenant <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation principale */}
      <nav className="flex-1 overflow-y-auto py-4">
        {filteredNavSections.map((section, sectionIndex) => (
          <div key={section.title} className={sectionIndex > 0 ? "mt-6" : ""}>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center justify-between px-4 py-2.5 text-sm font-medium mx-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } ${item.highlight ? 'bg-gradient-to-r from-indigo-50/80 to-white border border-indigo-100' : ''}`}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-5 h-5 mr-3 ${
                        isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'
                      }`} />
                      {item.label}
                    </div>
                    {item.badge && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-amber-200 to-amber-100 text-amber-800">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Section utilisateur et actions */}
      <div className="p-4 border-t border-gray-200 space-y-4">
        {/* Bouton de mise à niveau pour les utilisateurs non-ENTERPRISE */}
        {userRole !== 'ENTERPRISE' && (
          <Link 
            href="/dashboard/upgrade"
            className="flex items-center justify-center space-x-2 w-full px-3 py-3 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm hover:shadow"
          >
            <Zap className="w-4 h-4" />
            <span>Mettre à niveau</span>
          </Link>
        )}
        
        {/* Profil utilisateur */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-sm font-medium text-indigo-600">
                {(session?.user?.username || session?.user?.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                {session?.user?.username || session?.user?.email || 'Utilisateur'}
              </p>
              {session?.user?.email && session.user.email !== session?.user?.username && (
                <p className="text-xs text-gray-500 truncate max-w-[120px]">{session.user.email}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-500 hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}