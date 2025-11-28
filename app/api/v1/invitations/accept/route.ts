import { NextApiResponse } from 'next';
import { withRoleAuthorization, AuthenticatedRequest } from '@/lib/authMiddleware';
import prisma from '@/lib/prisma';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.body;
  const user = req.user;
  if (!token) return res.status(400).json({ error: 'Token manquant.' });
  const invitation = await prisma.teamInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.expiresAt < new Date() || invitation.email !== user.email) {
    return res.status(404).json({ error: 'Invitation invalide, expirée ou non destinée à cet utilisateur.' });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.teamMember.create({
        data: { teamId: invitation.teamId, userId: user.id, role: invitation.role },
      });
      await tx.user.update({
        where: { id: user.id }, data: { teamId: invitation.teamId },
      });
      await tx.teamInvitation.delete({ where: { id: invitation.id } });
    });
    res.status(200).json({ success: true, message: 'Vous avez rejoint l\'équipe avec succès !' });
  } catch (error) {
    res.status(409).json({ error: 'Vous êtes probablement déjà membre de cette équipe.' });
  }
}

export default withRoleAuthorization(['FREE', 'STANDARD', 'PRO', 'ENTERPRISE'])(handler);