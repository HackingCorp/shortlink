import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { transactionId, merchantReference } = await request.json();

    if (!transactionId && !merchantReference) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID ou Merchant Reference requis' },
        { status: 400 }
      );
    }

    // Récupérer le token d'accès e-nkap
    const accessToken = process.env.ENKAP_ACCESS_TOKEN;
    const baseUrl = process.env.ENKAP_API_URL || 'https://sandbox.enkap.cm';

    if (!accessToken) {
      throw new Error('Configuration e-nkap manquante');
    }

    // Construire l'URL de requête
    const queryParam = transactionId ? `txid=${transactionId}` : `orderMerchantId=${merchantReference}`;
    const url = `${baseUrl}/api/order/status?${queryParam}`;

    console.log(`🔍 Vérification e-nkap: ${url}`);

    // Appeler l'API e-nkap
    const enkapResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!enkapResponse.ok) {
      const errorText = await enkapResponse.text();
      console.error(`❌ Erreur e-nkap ${enkapResponse.status}:`, errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Erreur e-nkap: ${enkapResponse.status}` 
        },
        { status: enkapResponse.status }
      );
    }

    const enkapData = await enkapResponse.json();
    console.log('✅ Réponse e-nkap:', enkapData);

    return NextResponse.json({
      success: true,
      data: {
        status: enkapData.status,
        transactionId: enkapData.orderTransactionId,
        merchantReference: enkapData.merchantReferenceId,
        paymentDate: enkapData.paymentDate,
        paymentProvider: enkapData.paymentProviderName,
        payerAccountName: enkapData.payerAccountName,
        payerAccountNumber: enkapData.payerAccountNumber
      }
    });

  } catch (error) {
    console.error('❌ Erreur vérification e-nkap:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur lors de la vérification du paiement e-nkap' 
      },
      { status: 500 }
    );
  }
}