import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

// Type pour l'utilisateur authentifié
interface AuthUser {
  id: string;
  role: string;
}

// Type pour la requête authentifiée
interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Vérifier si l'utilisateur a le rôle requis
async function checkUserRole(session: any, allowedRoles: string[]) {
  if (!session?.user?.role) {
    return { hasAccess: false, error: 'Non authentifié' };
  }
  
  // Vérifier si l'utilisateur a un rôle autorisé
  if (!allowedRoles.includes(session.user.role)) {
    return { 
      hasAccess: false, 
      error: `Accès refusé. Rôle requis: ${allowedRoles.join(' ou ')}`
    };
  }
  
  return { hasAccess: true, userId: session.user.id };
}

// Récupérer les clés API de l'utilisateur
async function listApiKeys(userId: string) {
  return await prisma.apiKey.findMany({
    where: { 
      userId: parseInt(userId) 
    },
    select: { 
      id: true, 
      name: true, 
      createdAt: true, 
      lastUsed: true,
      userId: true
    },
  });
}

// Créer une nouvelle clé API
async function createApiKey(userId: string, name: string) {
  const apiKey = `sk_${randomBytes(24).toString('hex')}`;
  const userIdInt = parseInt(userId);
  
  // Vérifier la limite de clés pour l'utilisateur
  const userKeys = await prisma.apiKey.count({
    where: { 
      userId: userIdInt
    }
  });
  
  // Vérifier si l'utilisateur a atteint sa limite
  const user = await prisma.user.findUnique({
    where: { 
      id: userIdInt
    },
    select: { 
      role: true 
    }
  });
  
  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }
  
  const maxKeys = user.role === 'ENTERPRISE' ? 10 : 2;
  if (userKeys >= maxKeys) {
    throw new Error(`Limite de ${maxKeys} clés API atteinte. Supprimez une clé existante pour en créer une nouvelle.`);
  }
  
  // Créer la nouvelle clé
  return await prisma.apiKey.create({
    data: { 
      name, 
      key: apiKey, 
      userId: userIdInt
    },
  });
}

// Supprimer une clé API
async function revokeApiKey(userId: string, keyId: number) {
  console.log(`Tentative de suppression de la clé ${keyId} pour l'utilisateur ${userId}`);
  
  // Vérifier que la clé appartient bien à l'utilisateur
  const key = await prisma.apiKey.findUnique({
    where: { 
      id: keyId 
    }
  });
  
  console.log('Clé trouvée dans la base de données:', key);
  
  if (!key) {
    console.error('Erreur: Clé non trouvée dans la base de données');
    throw new Error('Clé non trouvée');
  }
  
  if (key.userId !== parseInt(userId)) {
    console.error(`Erreur: L'utilisateur ${userId} n'est pas autorisé à supprimer la clé ${keyId}`);
    throw new Error('Non autorisé');
  }
  
  console.log(`Suppression de la clé ${keyId}...`);
  
  try {
    const result = await prisma.apiKey.delete({ 
      where: { id: keyId }
    });
    
    console.log('Clé supprimée avec succès:', result);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la suppression de la clé:', error);
    throw error;
  }
}

// GET - Récupérer les clés API
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { hasAccess, error, userId } = await checkUserRole(session, ['PRO', 'ENTERPRISE']);
  
    if (!hasAccess || !userId) {
      return NextResponse.json(
        { success: false, error: error || 'Accès non autorisé' },
        { status: 403 }
      );
    }
    
    const keys = await listApiKeys(userId);
    
    // Formater les clés pour inclure les dates au bon format
    const formattedKeys = keys.map(key => ({
      id: key.id,
      name: key.name,
      createdAt: key.createdAt.toISOString(),
      lastUsed: key.lastUsed?.toISOString() || null
    }));
    
    return NextResponse.json({ success: true, data: formattedKeys });
      
  } catch (error: any) {
    console.error('Erreur lors de la récupération des clés API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Créer une nouvelle clé API
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }
    const { hasAccess, error } = await checkUserRole(session, ['PRO', 'ENTERPRISE']);
    
    if (!hasAccess || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: error || 'Accès non autorisé' },
        { status: 403 }
      );
    }
    
    const { name } = await request.json();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Un nom pour la clé est requis' },
        { status: 400 }
      );
    }
    
    const newKey = await createApiKey(session.user.id, name);
    return NextResponse.json({
      success: true, 
      message: 'Clé créée avec succès',
      keyData: {
        id: newKey.id,
        name: newKey.name,
        createdAt: newKey.createdAt.toISOString(),
        lastUsed: newKey.lastUsed?.toISOString() || null
      },
      apiKey: newKey.key
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Erreur lors de la création de la clé API:', error);
    
    if (error.message.includes('Limite de')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la création de la clé' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une clé API
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { hasAccess, error, userId } = await checkUserRole(session, ['PRO', 'ENTERPRISE']);
    
    if (!hasAccess || !userId) {
      return NextResponse.json(
        { success: false, error: error || 'Accès non autorisé' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');
    
    if (!keyId) {
      return NextResponse.json(
        { success: false, error: "L'ID de la clé est requis" },
        { status: 400 }
      );
    }
    
    await revokeApiKey(userId, parseInt(keyId));
    
    return NextResponse.json({ 
      success: true, 
      message: 'Clé révoquée avec succès' 
    });
    
  } catch (error: any) {
    console.error('Erreur lors de la révocation de la clé API:', error);
    
    if (error.message === 'Clé non trouvée' || error.message === 'Non autorisé') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de la suppression de la clé' },
      { status: 500 }
    );
  }
}