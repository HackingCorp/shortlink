import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

// Définition du schéma de validation avec Zod
const upgradeSchema = z.object({
  targetRole: z.enum(['STANDARD', 'PRO', 'ENTERPRISE'], {
    required_error: 'Le rôle cible est requis',
    invalid_type_error: 'Le rôle cible doit être STANDARD, PRO ou ENTERPRISE'
  }),
  isSimulated: z.boolean().optional().default(false),
  paymentReference: z.string().optional()
});

// Types dérivés du schéma
type UpgradeInput = z.infer<typeof upgradeSchema>;

// Hiérarchie des rôles pour la validation des mises à niveau
const ROLE_HIERARCHY = {
  FREE: 0,
  STANDARD: 1,
  PRO: 2,
  ENTERPRISE: 3
} as const;

type Role = keyof typeof ROLE_HIERARCHY;

// Fonction utilitaire pour valider la transition de rôle
function isValidRoleTransition(currentRole: Role, targetRole: Role): boolean {
  // Un utilisateur ne peut pas passer à un rôle inférieur
  return ROLE_HIERARCHY[targetRole] > ROLE_HIERARCHY[currentRole];
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }
    
    const requestData = await request.json();
    
    // Validation des données avec Zod
    const validation = upgradeSchema.safeParse(requestData);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Données de requêtes invalides',
          details: validation.error.format()
        },
        { status: 400 }
      );
    }
    
    const { targetRole, isSimulated, paymentReference } = validation.data;
    const userId = session.user.id;
    
    // Vérifier si l'utilisateur existe et récupérer son rôle actuel
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId, 10) },
      select: {
        id: true,
        role: true,
        planExpiresAt: true
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier si l'utilisateur tente de passer à un rôle inférieur
    if (!isValidRoleTransition(user.role as Role, targetRole as Role)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transition de rôle non autorisée',
          details: `Vous ne pouvez pas passer du plan ${user.role} au plan ${targetRole}`
        },
        { status: 400 }
      );
    }

    // Pour les mises à niveau vers ENTERPRISE, forcer le contact avec l'équipe commerciale
    if (targetRole === 'ENTERPRISE' && !isSimulated) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Contact commercial requis',
          details: 'Veuillez contacter notre équipe commerciale pour souscrire au plan Entreprise.'
        },
        { status: 400 }
      );
    }

    // Calculer les dates de début et de fin d'abonnement
    const now = new Date();
    const planStartedAt = now;
    const planExpiresAt = new Date(now);
    
    // Définir la durée de l'abonnement (1 an pour ENTERPRISE, 1 mois pour les autres)
    if (targetRole === 'ENTERPRISE') {
      planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);
    } else {
      planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
    }

    // Préparer les données pour la création du paiement
    const periodEnd = new Date(now);
    // Ajouter 1 mois ou 1 an selon le plan
    periodEnd.setMonth(periodEnd.getMonth() + (targetRole === 'ENTERPRISE' ? 12 : 1));

    // Mettre à jour l'utilisateur et créer le paiement en parallèle
    const [updatedUser, paymentRecord] = await Promise.all([
      // Mise à jour de l'utilisateur
      prisma.user.update({
        where: { id: parseInt(userId, 10) },
        data: {
          role: targetRole,
          planStartedAt: now,
          planExpiresAt,
          paymentStatus: 'active',
          paymentMethod: isSimulated ? 'simulated' : 'online_payment',
          paymentLastFour: '0000', // Remplacer par les 4 derniers chiffres de la carte si disponible
          subscriptionId: paymentReference || `sub_${Date.now()}`
        },
        select: {
          id: true,
          email: true,
          role: true,
          planStartedAt: true,
          planExpiresAt: true
        }
      }),
      
      // Création du paiement
      prisma.payment.create({
        data: {
          userId: parseInt(userId, 10),
          amount: targetRole === 'ENTERPRISE' ? 3290000 : 
                  targetRole === 'PRO' ? 19990 : 9990, // En FCFA
          currency: 'XAF',
          paymentMethod: isSimulated ? 'SIMULATED' : 'ONLINE_PAYMENT',
          paymentId: `pay_${Date.now()}`,
          status: 'succeeded',
          plan: targetRole,
          periodStart: now,
          periodEnd: periodEnd,
          isYearly: targetRole === 'ENTERPRISE',
          receiptUrl: isSimulated ? null : `https://dashboard.ltcshort.com/invoices/${Date.now()}`,
          metadata: {
            isSimulated,
            previousRole: user.role,
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
            period: targetRole === 'ENTERPRISE' ? 'YEARLY' : 'MONTHLY'
          }
        }
      })
    ]);
    
    // Envoyer un email de confirmation (à implémenter)
    // await sendUpgradeConfirmationEmail(user.email, targetRole, planExpiresAt);

    return NextResponse.json({
      success: true,
      data: {
        user: updatedUser,
        payment: {
          plan: updatedUser.role,
          startedAt: updatedUser.planStartedAt,
          expiresAt: updatedUser.planExpiresAt,
          status: 'active'
        },
        message: `Votre compte a été mis à jour avec succès vers le plan ${targetRole}`
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la mise à jour du rôle:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Une erreur est survenue lors de la mise à jour du rôle',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
