'use client';
import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// Types
export type TeamContext = {
  type: 'team';
  id: number;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};
export type PersonalContext = { 
  type: 'personal'; 
  name: string; 
  error?: string; // Propriété optionnelle pour les erreurs
};
export type ActiveContext = TeamContext | PersonalContext;

interface WorkspaceContextProps {
  activeContext: ActiveContext | null;
  availableContexts: TeamContext[];
  switchContext: (context: ActiveContext) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined>(undefined);

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status } = useSession();
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null);
  const [availableContexts, setAvailableContexts] = useState<TeamContext[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ne fetcher les contextes que si l'utilisateur est authentifié
    if (status === 'authenticated' && session?.user) {
      const fetchMemberships = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/v1/user/memberships', {
            credentials: 'include', // Inclure les cookies d'authentification
            headers: {
              'Content-Type': 'application/json',
              // Ajouter un en-tête d'autorisation si nécessaire
              // 'Authorization': `Bearer ${session.accessToken}`
            }
          });
          
          if (!response.ok) {
            if (response.status === 401) {
              // Rediriger vers la page de connexion si non autorisé
              window.location.href = '/auth/login';
              return;
            }
            throw new Error(`Erreur HTTP: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (result.success) {
            setAvailableContexts(result.data.teams || []);
            // On active l'espace perso par défaut
            setActiveContext(result.data.personal || { type: 'personal', name: 'Espace Personnel' });
          } else {
            // Si l'API renvoie success: false mais sans erreur 4xx/5xx
            throw new Error(result.error || 'Erreur inconnue lors de la récupération des membres');
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des membres:', error);
          // En cas d'erreur, on active quand même le perso avec un message d'erreur
          setActiveContext({ 
            type: 'personal', 
            name: 'Espace Personnel',
            error: 'Impossible de charger les équipes'
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchMemberships();
    } else if (status === 'unauthenticated') {
      setIsLoading(false);
    }
  }, [status]);

  const switchContext = (context: ActiveContext) => {
    setActiveContext(context);
  };

  return (
    <WorkspaceContext.Provider value={{ activeContext, availableContexts, switchContext, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};