import { NextResponse } from 'next/server';
import { s3pService } from '@/lib/s3p/client';
import { z } from 'zod';


const GetPackagesSchema = z.object({
  step: z.literal('getPackages'),
  serviceId: z.number().optional(),
});

const CreateQuoteSchema = z.object({
  step: z.literal('createQuote'),
  serviceId: z.string().min(1, "serviceId is required"), 
  amount: z.number(),
  currency: z.string(),
  customer: z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    email: z.string().email(),
    phone: z.string(),
  }),
});

const CollectSchema = z.object({
  step: z.literal('collect'),
  quoteId: z.string().min(1, "quoteId is required"),
  serviceNumber: z.string().min(1, "serviceNumber is required"),
  transactionId: z.string().min(1, "transactionId is required"),
  amount: z.number(),
  currency: z.string(),
  serviceId: z.string(), 
  customer: z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string().min(1, "Customer name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().min(1, "Phone number is required"),
  }),
});

const RequestBodySchema = z.discriminatedUnion('step', [
  GetPackagesSchema,
  CreateQuoteSchema,
  CollectSchema,
]);

// Gestionnaire pour getPackages
async function handleGetPackages(data: z.infer<typeof GetPackagesSchema>) {
  try {
    console.log('[API Cashout] Récupération des packages...');
    const result = await s3pService.getCashoutPackages(data.serviceId);
    
    if (!result.success) {
      console.error('[API Cashout] Erreur lors de la récupération des packages:', result.error);
      return NextResponse.json(
        { 
          success: false,
          error: result.error?.message || 'Échec de la récupération des packages',
          code: result.error?.code || 'UNKNOWN_ERROR'
        }, 
        { status: 500 }
      );
    }
    
    console.log('[API Cashout] Packages récupérés avec succès');
    return NextResponse.json({ 
      success: true,
      data: result.data 
    });
  } catch (error) {
    console.error('[API Cashout] Erreur inattendue lors de la récupération des packages:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors de la communication avec le service de paiement',
        code: 'SERVICE_ERROR'
      },
      { status: 502 }
    );
  }
}

async function handleCreateQuote(data: z.infer<typeof CreateQuoteSchema>) {
  try {
    console.log('[API Cashout] Création du devis avec les données:', data);
    
    const result = await s3pService.createQuote({
      serviceId: data.serviceId, 
      amount: data.amount,
      currency: data.currency,
      customerId: String(data.customer.id),
      customerName: data.customer.name,
      customerEmail: data.customer.email,
      customerPhone: data.customer.phone
    });

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error?.message || 'Échec de la création du devis',
          code: result.error?.code || 'QUOTE_ERROR'
        },
        { status: 500 }
      );
    }

    console.log('[API Cashout] Devis créé avec succès:', result.data);
    return NextResponse.json({ 
      success: true,
      data: {
        ...result.data,
        originalAmount: data.amount,
        originalCurrency: data.currency,
        originalServiceId: data.serviceId
      }
    });
  } catch (error) {
    console.error('[API Cashout] Erreur lors de la création du devis:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Échec de la création du devis',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}

async function handleCollectPayment(data: z.infer<typeof CollectSchema>) {
  try {
    console.log('[API Cashout] Traitement de la collecte de paiement...');
    
    if (!data.customer.email) {
      return NextResponse.json(
        { success: false, error: 'Customer email is required' },
        { status: 400 }
      );
    }

    console.log('[API Cashout] Collect payment params:', {
      quoteId: data.quoteId,
      transactionId: data.transactionId,
      serviceNumber: data.serviceNumber,
      amount: data.amount,
      currency: data.currency,
      serviceId: data.serviceId,
      customer: data.customer
    });

    const collectParams = {
      quoteId: data.quoteId,
      transactionId: data.transactionId,
      phoneNumber: data.serviceNumber,
      customerName: data.customer.name,
      customerEmail: data.customer.email,
      customerId: String(data.customer.id),
      amount: data.amount,
      currency: data.currency,
      serviceId: data.serviceId,
      metadata: {
        service: 'cashout'
      }
    };

    const result = await s3pService.collectPayment(collectParams);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error?.message || 'Échec du traitement du paiement',
          code: result.error?.code || 'PAYMENT_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      data: result.data 
    });
  } catch (error) {
    console.error('[API Cashout] Erreur inattendue lors de la collecte:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors du traitement du paiement',
        code: 'PROCESSING_ERROR'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  console.log('[API Cashout] Nouvelle requête reçue');
  
  try {
    const body = await req.json();
    console.log('[API Cashout] Corps de la requête:', JSON.stringify(body, null, 2));
    
    const parsed = RequestBodySchema.safeParse(body);
    if (!parsed.success) {
      console.error('[API Cashout] Erreur de validation:', parsed.error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Requête invalide',
          details: parsed.error.errors 
        }, 
        { status: 400 }
      );
    }

    const { data } = parsed;

    // Gestion en fonction de l'étape
    switch (data.step) {
      case 'getPackages':
        return handleGetPackages(data);
      case 'createQuote':
        return handleCreateQuote(data);
      case 'collect':
        return handleCollectPayment(data);
      default:
        return NextResponse.json(
          { success: false, error: 'Étape non gérée' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API Cashout] Erreur inattendue:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}