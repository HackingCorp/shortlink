import { UserRole } from './roles';

/**
 * Configuration des routes protégées de l'application
 */

export const PUBLIC_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  CONTACT: '/contact',
  ABOUT: '/about',
} as const;

export const AUTH_ROUTES = {
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  API_KEYS: '/api-keys',
  BILLING: '/billing',
} as const;

export const ADMIN_ROUTES = {
  DASHBOARD: '/admin',
  USERS: '/admin/users',
  LINKS: '/admin/links',
  TEAMS: '/admin/teams',
  SETTINGS: '/admin/settings',
  ANALYTICS: '/admin/analytics',
} as const;

export const TEAM_ROUTES = {
  DASHBOARD: (teamId: string | number) => `/teams/${teamId}`,
  SETTINGS: (teamId: string | number) => `/teams/${teamId}/settings`,
  MEMBERS: (teamId: string | number) => `/teams/${teamId}/members`,
  INVITATIONS: (teamId: string | number) => `/teams/${teamId}/invitations`,
};

/**
 * Configuration des autorisations pour chaque route
 */
type RouteConfig = {
  path: string;
  roles: UserRole[];
  redirectTo?: string;
  message?: string;
};

export const PROTECTED_ROUTES: Record<string, RouteConfig> = {
  // Routes d'authentification
  [AUTH_ROUTES.DASHBOARD]: {
    path: AUTH_ROUTES.DASHBOARD,
    roles: ['MEMBER', 'EDITOR', 'ADMIN'],
    redirectTo: PUBLIC_ROUTES.LOGIN,
    message: 'Vous devez être connecté pour accéder à cette page',
  },
  [AUTH_ROUTES.PROFILE]: {
    path: AUTH_ROUTES.PROFILE,
    roles: ['MEMBER', 'EDITOR', 'ADMIN'],
    redirectTo: PUBLIC_ROUTES.LOGIN,
  },
  
  // Routes d'administration
  [ADMIN_ROUTES.DASHBOARD]: {
    path: ADMIN_ROUTES.DASHBOARD,
    roles: ['ADMIN'],
    redirectTo: AUTH_ROUTES.DASHBOARD,
    message: 'Accès réservé aux administrateurs',
  },
  [ADMIN_ROUTES.USERS]: {
    path: ADMIN_ROUTES.USERS,
    roles: ['ADMIN'],
    redirectTo: AUTH_ROUTES.DASHBOARD,
    message: 'Vous devez être administrateur pour gérer les utilisateurs',
  },
  [ADMIN_ROUTES.LINKS]: {
    path: ADMIN_ROUTES.LINKS,
    roles: ['ADMIN', 'EDITOR'],
    redirectTo: AUTH_ROUTES.DASHBOARD,
    message: 'Vous devez être éditeur ou administrateur pour gérer les liens',
  },
};

/**
 * Récupère la configuration d'une route protégée
 * @param path Le chemin de la route
 * @returns La configuration de la route ou undefined si non trouvée
 */
export function getRouteConfig(path: string): RouteConfig | undefined {
  return Object.values(PROTECTED_ROUTES).find(route => route.path === path);
}

/**
 * Vérifie si un utilisateur a accès à une route
 * @param userRole Le rôle de l'utilisateur
 * @param path Le chemin de la route
 * @returns Un objet indiquant si l'accès est autorisé et la configuration de la route
 */
export function checkRouteAccess(userRole: UserRole | undefined, path: string) {
  const routeConfig = getRouteConfig(path);
  
  // Si la route n'est pas protégée, l'accès est autorisé
  if (!routeConfig) {
    return { hasAccess: true, config: undefined };
  }
  
  // Si l'utilisateur n'a pas de rôle, accès refusé
  if (!userRole) {
    return { 
      hasAccess: false, 
      config: routeConfig,
    };
  }
  
  // Vérifie si le rôle de l'utilisateur est autorisé
  const hasAccess = routeConfig.roles.includes(userRole);
  
  return { hasAccess, config: routeConfig };
}
