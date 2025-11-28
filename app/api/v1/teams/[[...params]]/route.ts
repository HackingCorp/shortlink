import { NextApiResponse } from 'next';
import { withRoleAuthorization, AuthenticatedRequest } from '@/lib/authMiddleware';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendTeamInvitationEmail } from '@/lib/email';
import { NextRequest, NextResponse } from 'next/server';

interface Params {
  params: {
    params?: string[];
  };
}
  // Après
  async function handler(req: AuthenticatedRequest): Promise<NextResponse> {
    const [teamIdStr, action, resourceIdStr] = req.nextUrl?.pathname.split('/').filter(Boolean).slice(3) || [];
    

  
  // Routes qui nécessitent un ID d'équipe (ex: /api/v1/teams/123/...)
  if (teamIdStr) {
    const teamId = parseInt(teamIdStr);
    if (isNaN(teamId)) return res.status(400).json({ success: false, error: 'ID d\'équipe invalide.' });

    switch (req.method) {
      case 'GET':
        // Route: GET /api/v1/teams/{id}/members -> Lister les membres
        if (action === 'members') return listMembers(req, res, teamId);
        // Route: GET /api/v1/teams/{id}/invitations -> Lister les invitations
        if (action === 'invitations') return listInvitations(req, res, teamId);
        break;7

      case 'POST':
        // Route: POST /api/v1/teams/{id}/invitations -> Créer une invitation
        if (action === 'invitations') return createInvitation(req, res, teamId);
        break;

      case 'DELETE':
        // Route: DELETE /api/v1/teams/{id}/members/{memberId} -> Supprimer un membre
        if (action === 'members' && resourceIdStr) return removeMember(req, res, teamId, parseInt(resourceIdStr));
        // Route: DELETE /api/v1/teams/{id}/invitations/{invitationId} -> Annuler une invitation
        if (action === 'invitations' && resourceIdStr) return cancelInvitation(req, res, teamId, parseInt(resourceIdStr));
        break;
    }
  }

  // Si aucune route ne correspond
  return res.status(404).json({ success: false, error: 'Route non trouvée.' });
}

// Protège toutes les routes de ce fichier : seuls les utilisateurs avec les rôles 'ENTERPRISE' ou 'ADMIN' peuvent y accéder.
export default withRoleAuthorization(['ENTERPRISE', 'ADMIN'])(handler);


// --- Fonctions de Logique Métier ---

/**
 * Crée une nouvelle équipe. L'utilisateur qui la crée en devient automatiquement le propriétaire.
 */
async function createTeam(req: AuthenticatedRequest, res: NextApiResponse) {
  const { name } = req.body;
  const ownerId = req.user.id;
  if (!name) return res.status(400).json({ success: false, error: 'Le nom de l\'équipe est requis.' });
  const existingTeam = await prisma.team.findFirst({ where: { ownerId } });
  if (existingTeam) return res.status(409).json({ success: false, error: 'Vous êtes déjà propriétaire d\'une équipe.' });

  try {
    const newTeam = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ data: { name, ownerId } });
      await tx.teamMember.create({ data: { teamId: team.id, userId: ownerId, role: 'OWNER' } });
      await tx.user.update({ where: { id: ownerId }, data: { teamId: team.id } });
      return team;
    });
    return res.status(201).json({ success: true, data: newTeam });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'équipe.' });
  }
}

/**
 * Crée et envoie une invitation pour rejoindre une équipe.
 */
async function createInvitation(req: AuthenticatedRequest, res: NextApiResponse, teamId: number) {
  const { email, role } = req.body;
  const inviter = req.user;

  // 1. Vérification des permissions : l'inviteur doit être OWNER ou ADMIN.
  const inviterMembership = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: inviter.id } } });
  if (!inviterMembership || !['OWNER', 'ADMIN'].includes(inviterMembership.role)) {
      return res.status(403).json({ success: false, error: 'Permissions insuffisantes pour inviter des membres.' });
  }

  // 2. Création du token et de l'invitation en base de données
  const token = randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return res.status(404).json({ success: false, error: "Équipe non trouvée." });
  
  const invitation = await prisma.teamInvitation.create({
      data: { email, role, teamId, token, expiresAt, invitedById: inviter.id }
  });

  // 3. Envoi de l'e-mail
  try {
    await sendTeamInvitationEmail(email, inviter.username || inviter.email, team.name, token);
  } catch (error) {
      // Même si l'email échoue, l'invitation est créée. On peut la renvoyer manuellement.
      console.error("L'envoi de l'email d'invitation a échoué:", error);
  }

  return res.status(201).json({ success: true, data: invitation });
}

/**
 * Récupère la liste des membres d'une équipe.
 */
async function listMembers(req: AuthenticatedRequest, res: NextApiResponse, teamId: number) {
    const members = await prisma.teamMember.findMany({
        where: { teamId },
        include: { user: { select: { id: true, email: true, username: true } } },
        orderBy: { role: 'asc' }, // Affiche OWNER, puis ADMIN, puis MEMBER
    });
    return res.status(200).json({ success: true, data: members });
}

/**
 * Récupère la liste des invitations en attente pour une équipe.
 */
async function listInvitations(req: AuthenticatedRequest, res: NextApiResponse, teamId: number) {
    const invitations = await prisma.teamInvitation.findMany({
        where: { teamId, expiresAt: { gt: new Date() } }, // Uniquement les invitations valides
    });
    return res.status(200).json({ success: true, data: invitations });
}

/**
 * Retire un membre d'une équipe.
 */
async function removeMember(req: AuthenticatedRequest, res: NextApiResponse, teamId: number, memberUserIdToRemove: number) {
  const currentUserId = req.user.id;
  
  // 1. Vérification des permissions : l'utilisateur actuel doit être OWNER ou ADMIN.
  const currentUserMember = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: currentUserId } } });
  if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
      return res.status(403).json({ success: false, error: "Permissions insuffisantes pour retirer un membre." });
  }
  
  // 2. Récupération du membre à supprimer et vérification des règles
  const memberToRemove = await prisma.teamMember.findFirst({ where: { userId: memberUserIdToRemove, teamId } });
  if (!memberToRemove) return res.status(404).json({ success: false, error: "Membre introuvable dans cette équipe." });
  if (memberToRemove.role === 'OWNER') return res.status(400).json({ success: false, error: "Le propriétaire de l'équipe ne peut pas être retiré." });

  // 3. Suppression
  await prisma.teamMember.delete({ where: { id: memberToRemove.id } });
  return res.status(200).json({ success: true, message: "Membre retiré de l'équipe." });
}

/**
 * Annule une invitation en attente.
 */
async function cancelInvitation(req: AuthenticatedRequest, res: NextApiResponse, teamId: number, invitationId: number) {
  const currentUserId = req.user.id;
  
  // 1. Vérification des permissions : l'utilisateur actuel doit être OWNER ou ADMIN.
  const currentUserMember = await prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: currentUserId } } });
  if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
      return res.status(403).json({ success: false, error: "Permissions insuffisantes pour annuler une invitation." });
  }

  // 2. Suppression de l'invitation (assurant qu'elle appartient bien à l'équipe)
  try {
    await prisma.teamInvitation.delete({ where: { id: invitationId, teamId } });
    return res.status(200).json({ success: true, message: "Invitation annulée avec succès." });
  } catch (error) {
      // Prisma lance une erreur si l'enregistrement n'est pas trouvé
      return res.status(404).json({ success: false, error: "Invitation non trouvée." });
  }
}