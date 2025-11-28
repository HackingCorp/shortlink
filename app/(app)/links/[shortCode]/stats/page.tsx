import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { LinkStats } from "@/components/analytics/LinkStats";
import prisma from "@/lib/prisma";

export default async function LinkStatsPage({
  params,
}: {
  params: { shortCode: string };
}) {
  const { shortCode } = params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return notFound();
  }

  // Vérifier que le lien existe
  const link = await prisma.link.findUnique({
    where: { short_code: shortCode },
    select: { user_id: true, team_id: true },
  });

  if (!link) return notFound();

  // Récupérer l'utilisateur
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) return notFound();

  // Vérifier les permissions
  const isOwner = link.user_id === user.id;
  let hasAccess = isOwner;

  if (!isOwner && link.team_id) {
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        user_id: user.id,
        team_id: link.team_id,
        role: { in: ["OWNER", "ADMIN", "MEMBER"] },
      },
    });
    hasAccess = !!teamMember;
  }

  if (!hasAccess) return notFound();

  return (
    <div className="container py-8">
      <LinkStats shortCode={shortCode} />
    </div>
  );
}

export const dynamic = "force-dynamic";
