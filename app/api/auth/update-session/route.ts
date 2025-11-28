import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../[...nextauth]/route';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { update } = await request.json();
    
    // Retourner simplement les données mises à jour
    // La session sera mise à jour côté client via le hook useSession
    return NextResponse.json({
      success: true,
      data: {
        ...session.user,
        ...update
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la session:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour de la session' },
      { status: 500 }
    );
  }
}
