/**
 * Configuration des rôles et autorisations de l'application
 */

// Tous les rôles de l'application
export type UserRole = 'ADMIN' | 'EDITOR' | 'MEMBER' | 'GUEST' | 'USER' | 'STANDARD' | 'PRO' | 'ENTERPRISE' | 'FREE';

/**
 * Définition des rôles avec leurs libellés et descriptions
 */
export const ROLES = {
  // Rôles d'administration
  ADMIN: {
    label: 'Administrateur',
    description: 'Accès complet à toutes les fonctionnalités d\'administration',
    level: 10,
  },
  EDITOR: {
    label: 'Éditeur',
    description: 'Peut gérer le contenu mais pas les paramètres système',
    level: 8,
  },
  MEMBER: {
    label: 'Membre',
    description: 'Utilisateur enregistré avec des fonctionnalités de base',
    level: 5,
  },
  
  // Rôles des utilisateurs finaux
  ENTERPRISE: {
    label: 'Entreprise',
    description: 'Accès complet avec fonctionnalités avancées et gestion d\'équipe',
    level: 9,
  },
  PRO: {
    label: 'Professionnel',
    description: 'Accès aux fonctionnalités avancées et statistiques détaillées',
    level: 7,
  },
  STANDARD: {
    label: 'Standard',
    description: 'Accès aux fonctionnalités de base et statistiques essentielles',
    level: 6,
  },
  FREE: {
    label: 'Gratuit',
    description: 'Accès limité avec fonctionnalités de base',
    level: 4,
  },
  USER: {
    label: 'Utilisateur',
    description: 'Compte utilisateur standard',
    level: 3,
  },
  GUEST: {
    label: 'Invité',
    description: 'Utilisateur non connecté avec un accès limité',
    level: 1,
  },
} as const;

/**
 * Vérifie si un utilisateur a le rôle requis
 * @param userRole Le rôle de l'utilisateur
 * @param requiredRole Le rôle requis (peut être un tableau de rôles)
 * @returns boolean
 */
export function hasRequiredRole(
  userRole: UserRole | undefined | null,
  requiredRole: UserRole | UserRole[]
): boolean {
  if (!userRole) return false;
  
  const requiredRoles = Array.isArray(requiredRole) 
    ? requiredRole 
    : [requiredRole];
  
  return requiredRoles.includes(userRole);
}

/**
 * Vérifie si un utilisateur a un niveau d'autorisation suffisant
 * @param userRole Le rôle de l'utilisateur
 * @param minLevel Le niveau minimum requis
 * @returns boolean
 */
export function hasMinRoleLevel(
  userRole: UserRole | undefined | null,
  minLevel: number
): boolean {
  if (!userRole) return false;
  const roleLevel = ROLES[userRole]?.level || 0;
  return roleLevel >= minLevel;
}

/**
 * Récupère les informations d'un rôle
 * @param role Le rôle à récupérer
 * @returns Les informations du rôle ou undefined si non trouvé
 */
export function getRoleInfo(role: UserRole) {
  return ROLES[role];
}

/**
 * Liste des rôles disponibles pour le sélecteur de rôles
 */
export const ROLE_OPTIONS = Object.entries(ROLES).map(([value, config]) => ({
  value: value as UserRole,
  label: config.label,
  description: config.description,
}));

/**
 * Vérifie si un utilisateur peut effectuer une action spécifique
 * @param userRole Le rôle de l'utilisateur
 * @param action L'action à vérifier
 * @returns boolean
 */
export function canPerformAction(
  userRole: UserRole | undefined | null,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage_users' | 'manage_links'
): boolean {
  if (!userRole) return false;
  
  const roleLevel = ROLES[userRole]?.level || 0;
  
  switch (action) {
    case 'create':
    case 'read':
      return roleLevel >= 2; // MEMBER et supérieur
    case 'update':
      return roleLevel >= 3; // EDITOR et supérieur
    case 'delete':
    case 'manage_users':
    case 'manage_links':
      return roleLevel >= 4; // ADMIN uniquement
    default:
      return false;
  }
}
