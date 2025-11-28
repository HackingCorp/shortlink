import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Token manquant.' });
  const invitation = await prisma.teamInvitation.findUnique({
    where: { token },
    select: {
      email: true, expiresAt: true, team: { select: { name: true } }, inviter: { select: { email: true } },
    },
  });
  if (!invitation || invitation.expiresAt < new Date()) {
    return res.status(404).json({ error: 'Invitation invalide ou expirée.' });
  }
  res.status(200).json(invitation);
}