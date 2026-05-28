import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Token manquant.' }, { status: 400 });
  }
  const invitation = await prisma.teamInvitation.findUnique({
    where: { token },
    select: {
      email: true, expiresAt: true, team: { select: { name: true } }, inviter: { select: { email: true } },
    },
  });
  if (!invitation || invitation.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invitation invalide ou expirée.' }, { status: 404 });
  }
  return NextResponse.json(invitation);
}
