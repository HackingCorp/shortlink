import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuthorization, AuthenticatedRequest } from '@/lib/authMiddleware';
import prisma from '@/lib/prisma';

async function handler(req: AuthenticatedRequest) {
  const { token } = await req.json();
  const user = req.user;
  if (!token) return NextResponse.json({ error: 'Token manquant.' }, { status: 400 });
  const invitation = await prisma.teamInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.expiresAt < new Date() || invitation.email !== user.email) {
    return NextResponse.json({ error: 'Invitation invalide, expirée ou non destinée à cet utilisateur.' }, { status: 404 });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.teamMember.create({
        data: { teamId: invitation.teamId, userId: user.id, role: invitation.role },
      });
      await tx.user.update({
        where: { id: user.id }, data: { teams: { connect: { id: invitation.teamId } } },
      });
      await tx.teamInvitation.delete({ where: { id: invitation.id } });
    });
    return NextResponse.json({ success: true, message: 'Vous avez rejoint l\'équipe avec succès !' });
  } catch (error) {
    return NextResponse.json({ error: 'Vous êtes probablement déjà membre de cette équipe.' }, { status: 409 });
  }
}

export const POST = withRoleAuthorization(['FREE', 'STANDARD', 'PRO', 'ENTERPRISE'])(handler);
