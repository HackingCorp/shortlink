import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendTeamInvitationEmail } from '@/lib/email';
import { User } from '@prisma/client';

// --- Helper: authenticate and authorize the user (ENTERPRISE or ADMIN roles) ---

async function authorizeUser(): Promise<{ user: User } | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json(
      { success: false, error: 'Authentification requise.' },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Utilisateur non trouvé.' },
      { status: 401 }
    );
  }

  if (!['ENTERPRISE', 'ADMIN'].includes(user.role)) {
    return NextResponse.json(
      { success: false, error: 'Accès non autorisé. Permissions insuffisantes.' },
      { status: 403 }
    );
  }

  return { user };
}

// --- Helper: parse the catch-all params from the URL ---

function parseParams(params?: string[]): {
  teamIdStr?: string;
  action?: string;
  resourceIdStr?: string;
} {
  const [teamIdStr, action, resourceIdStr] = params || [];
  return { teamIdStr, action, resourceIdStr };
}

// --- Route Handlers ---

/**
 * GET /api/v1/teams/{id}/members    -> List team members
 * GET /api/v1/teams/{id}/invitations -> List pending invitations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> }
) {
  const auth = await authorizeUser();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const resolvedParams = await params;
  const { teamIdStr, action } = parseParams(resolvedParams.params);

  if (!teamIdStr) {
    return NextResponse.json(
      { success: false, error: 'Route non trouvée.' },
      { status: 404 }
    );
  }

  const teamId = parseInt(teamIdStr);
  if (isNaN(teamId)) {
    return NextResponse.json(
      { success: false, error: "ID d'équipe invalide." },
      { status: 400 }
    );
  }

  if (action === 'members') {
    return listMembers(teamId);
  }

  if (action === 'invitations') {
    return listInvitations(teamId);
  }

  return NextResponse.json(
    { success: false, error: 'Route non trouvée.' },
    { status: 404 }
  );
}

/**
 * POST /api/v1/teams                   -> Create a new team
 * POST /api/v1/teams/{id}/invitations  -> Create an invitation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> }
) {
  const auth = await authorizeUser();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const resolvedParams = await params;
  const { teamIdStr, action } = parseParams(resolvedParams.params);

  // POST /api/v1/teams -> Create team (no sub-params)
  if (!teamIdStr) {
    return createTeam(request, user);
  }

  const teamId = parseInt(teamIdStr);
  if (isNaN(teamId)) {
    return NextResponse.json(
      { success: false, error: "ID d'équipe invalide." },
      { status: 400 }
    );
  }

  // POST /api/v1/teams/{id}/invitations -> Create invitation
  if (action === 'invitations') {
    return createInvitation(request, user, teamId);
  }

  return NextResponse.json(
    { success: false, error: 'Route non trouvée.' },
    { status: 404 }
  );
}

/**
 * DELETE /api/v1/teams/{id}/members/{memberId}          -> Remove a member
 * DELETE /api/v1/teams/{id}/invitations/{invitationId}  -> Cancel an invitation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ params?: string[] }> }
) {
  const auth = await authorizeUser();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const resolvedParams = await params;
  const { teamIdStr, action, resourceIdStr } = parseParams(resolvedParams.params);

  if (!teamIdStr) {
    return NextResponse.json(
      { success: false, error: 'Route non trouvée.' },
      { status: 404 }
    );
  }

  const teamId = parseInt(teamIdStr);
  if (isNaN(teamId)) {
    return NextResponse.json(
      { success: false, error: "ID d'équipe invalide." },
      { status: 400 }
    );
  }

  if (action === 'members' && resourceIdStr) {
    return removeMember(user, teamId, parseInt(resourceIdStr));
  }

  if (action === 'invitations' && resourceIdStr) {
    return cancelInvitation(user, teamId, parseInt(resourceIdStr));
  }

  return NextResponse.json(
    { success: false, error: 'Route non trouvée.' },
    { status: 404 }
  );
}


// --- Business Logic Functions ---

/**
 * Crée une nouvelle équipe. L'utilisateur qui la crée en devient automatiquement le propriétaire.
 */
async function createTeam(req: NextRequest, user: User): Promise<NextResponse> {
  const body = await req.json();
  const { name } = body;
  const ownerId = user.id;

  if (!name) {
    return NextResponse.json(
      { success: false, error: "Le nom de l'équipe est requis." },
      { status: 400 }
    );
  }

  const existingTeam = await prisma.team.findFirst({ where: { ownerId } });
  if (existingTeam) {
    return NextResponse.json(
      { success: false, error: "Vous êtes déjà propriétaire d'une équipe." },
      { status: 409 }
    );
  }

  try {
    const newTeam = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ data: { name, ownerId } });
      await tx.teamMember.create({ data: { teamId: team.id, userId: ownerId, role: 'OWNER' } });
      await tx.user.update({ where: { id: ownerId }, data: { teams: { connect: { id: team.id } } } });
      return team;
    });
    return NextResponse.json({ success: true, data: newTeam }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Erreur lors de la création de l'équipe." },
      { status: 500 }
    );
  }
}

/**
 * Crée et envoie une invitation pour rejoindre une équipe.
 */
async function createInvitation(req: NextRequest, user: User, teamId: number): Promise<NextResponse> {
  const body = await req.json();
  const { email, role } = body;

  // 1. Vérification des permissions : l'inviteur doit être OWNER ou ADMIN.
  const inviterMembership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });
  if (!inviterMembership || !['OWNER', 'ADMIN'].includes(inviterMembership.role)) {
    return NextResponse.json(
      { success: false, error: 'Permissions insuffisantes pour inviter des membres.' },
      { status: 403 }
    );
  }

  // 2. Création du token et de l'invitation en base de données
  const token = randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return NextResponse.json(
      { success: false, error: 'Équipe non trouvée.' },
      { status: 404 }
    );
  }

  const invitation = await prisma.teamInvitation.create({
    data: { email, role, teamId, token, expiresAt, invitedById: user.id },
  });

  // 3. Envoi de l'e-mail
  try {
    await sendTeamInvitationEmail(email, user.username || user.email, team.name, token);
  } catch (error) {
    // Même si l'email échoue, l'invitation est créée. On peut la renvoyer manuellement.
    console.error("L'envoi de l'email d'invitation a échoué:", error);
  }

  return NextResponse.json({ success: true, data: invitation }, { status: 201 });
}

/**
 * Récupère la liste des membres d'une équipe.
 */
async function listMembers(teamId: number): Promise<NextResponse> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { select: { id: true, email: true, username: true } } },
    orderBy: { role: 'asc' },
  });
  return NextResponse.json({ success: true, data: members });
}

/**
 * Récupère la liste des invitations en attente pour une équipe.
 */
async function listInvitations(teamId: number): Promise<NextResponse> {
  const invitations = await prisma.teamInvitation.findMany({
    where: { teamId, expiresAt: { gt: new Date() } },
  });
  return NextResponse.json({ success: true, data: invitations });
}

/**
 * Retire un membre d'une équipe.
 */
async function removeMember(user: User, teamId: number, memberUserIdToRemove: number): Promise<NextResponse> {
  // 1. Vérification des permissions : l'utilisateur actuel doit être OWNER ou ADMIN.
  const currentUserMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });
  if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
    return NextResponse.json(
      { success: false, error: 'Permissions insuffisantes pour retirer un membre.' },
      { status: 403 }
    );
  }

  // 2. Récupération du membre à supprimer et vérification des règles
  const memberToRemove = await prisma.teamMember.findFirst({
    where: { userId: memberUserIdToRemove, teamId },
  });
  if (!memberToRemove) {
    return NextResponse.json(
      { success: false, error: 'Membre introuvable dans cette équipe.' },
      { status: 404 }
    );
  }
  if (memberToRemove.role === 'OWNER') {
    return NextResponse.json(
      { success: false, error: "Le propriétaire de l'équipe ne peut pas être retiré." },
      { status: 400 }
    );
  }

  // 3. Suppression
  await prisma.teamMember.delete({ where: { id: memberToRemove.id } });
  return NextResponse.json({ success: true, message: "Membre retiré de l'équipe." });
}

/**
 * Annule une invitation en attente.
 */
async function cancelInvitation(user: User, teamId: number, invitationId: number): Promise<NextResponse> {
  // 1. Vérification des permissions : l'utilisateur actuel doit être OWNER ou ADMIN.
  const currentUserMember = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
  });
  if (!currentUserMember || !['OWNER', 'ADMIN'].includes(currentUserMember.role)) {
    return NextResponse.json(
      { success: false, error: 'Permissions insuffisantes pour annuler une invitation.' },
      { status: 403 }
    );
  }

  // 2. Suppression de l'invitation (assurant qu'elle appartient bien à l'équipe)
  try {
    await prisma.teamInvitation.delete({ where: { id: invitationId, teamId } });
    return NextResponse.json({ success: true, message: 'Invitation annulée avec succès.' });
  } catch (error) {
    // Prisma lance une erreur si l'enregistrement n'est pas trouvé
    return NextResponse.json(
      { success: false, error: 'Invitation non trouvée.' },
      { status: 404 }
    );
  }
}
