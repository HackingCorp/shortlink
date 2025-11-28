import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { useSession, signIn, signOut, getSession } from 'next-auth/react';
import { User } from '../types'; // Assurez-vous que ce type correspond à l'objet User de next-auth
import { toast } from 'react-hot-toast';

export interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
  // La fonction register est retirée car elle est gérée hors du contexte de session.
  // Elle doit appeler une API d'inscription puis utiliser `signIn`.
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: session, status, update } = useSession();

  const loading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = (session?.user as User) || null; // Adapter si la structure de session.user est différente
  
  // Fonction pour rafraîchir les données de l'utilisateur
  const refreshUser = useCallback(async () => {
    try {
      // Force une mise à jour de la session côté client
      await update();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement de la session:', error);
    }
  }, [update]);

  const login = async (identifier: string, password: string): Promise<boolean> => {
    try {
      const result = await signIn('credentials', {
        redirect: false, // Pour gérer la redirection manuellement
        identifier,
        password,
      });

      if (result?.error) {
        toast.error(result.error);
        return false;
      }

      toast.success('Connexion réussie');
      return true;
    } catch (error) {
      toast.error('Une erreur inattendue est survenue.');
      return false;
    }
  };

  const logout = () => {
    signOut({ callbackUrl: '/' }); // Redirige vers l'accueil après déconnexion
    toast.success('Déconnexion réussie');
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    refreshUser,
    loading,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};