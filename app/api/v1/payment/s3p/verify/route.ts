import { NextRequest, NextResponse } from 'next/server';
import { s3pClient } from '@/lib/s3p/auth';

const S3P_ERROR_CODES = {
  0: { message: 'Paiement réussi', status: 'SUCCESS' },
  703000: { message: 'Transaction échouée', status: 'ERRORED' },
  703201: { message: 'Transaction non confirmée par le client', status: 'CANCELLED' },
  703202: { message: 'Transaction rejetée par le client', status: 'CANCELLED' },
  703108: { message: 'Solde insuffisant', status: 'ERRORED' },
  704005: { message: 'Transaction échouée', status: 'ERRORED' },
};

const getFinalStatus = (s3pStatus: string, errorCode?: number): string => {
  if (s3pStatus === 'SUCCESS') return 'SUCCESS';
  if (s3pStatus === 'ERRORED' && errorCode !== undefined) {
    const errorConfig = S3P_ERROR_CODES[errorCode as keyof typeof S3P_ERROR_CODES];
    return errorConfig ? errorConfig.status : 'ERRORED';
  }
  return s3pStatus;
};

const getErrorMessage = (errorCode?: number): string => {
  if (errorCode === undefined) return '';
  const errorConfig = S3P_ERROR_CODES[errorCode as keyof typeof S3P_ERROR_CODES];
  return errorConfig ? errorConfig.message : `Erreur de paiement (Code: ${errorCode})`;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'transactionId est requis' 
        },
        { status: 400 }
      );
    }

    console.log('[S3P Verify] Vérification de la transaction:', transactionId);
    
    try {
      const result = await s3pClient.verifytxGet('3.0.0', transactionId);

      console.log('[S3P Verify] Réponse S3P brute:', result);
      
      let paymentStatus;
      
      if (Array.isArray(result) && result.length > 0) {
        paymentStatus = result.find(status => status.ptn === transactionId) || result[0];
      } else {
        paymentStatus = result;
      }

      if (!paymentStatus) {
        console.log('[S3P Verify] Aucun statut trouvé pour la transaction');
        return NextResponse.json({
          success: true,
          transactionId: transactionId,
          status: 'PENDING',
          message: 'Transaction en attente de traitement'
        });
      }

      console.log('[S3P Verify] Statut trouvé:', {
        ptn: paymentStatus.ptn,
        status: paymentStatus.status,
        errorCode: paymentStatus.errorCode,
        timestamp: paymentStatus.timestamp
      });

      // Déterminer le statut final avec gestion des erreurs
      const finalStatus = getFinalStatus(paymentStatus.status, paymentStatus.errorCode);
      const errorMessage = getErrorMessage(paymentStatus.errorCode);

      const responseData = {
        success: true,
        transactionId: transactionId,
        status: finalStatus,
        data: paymentStatus,
        ...(errorMessage && { errorMessage }),
        ...(paymentStatus.errorCode !== undefined && { errorCode: paymentStatus.errorCode })
      };

      console.log('[S3P Verify] Réponse finale:', responseData);

      return NextResponse.json(responseData);

    } catch (s3pError: any) {
      console.error('[S3P Verify] Erreur S3P:', s3pError);
      
      const errorMessage = s3pError.message || 'Erreur de vérification';
      
      if (errorMessage.includes('not found') || 
          errorMessage.includes('404') || 
          errorMessage.includes('does not exist')) {
        console.log('[S3P Verify] Transaction non trouvée (encore en traitement)');
        return NextResponse.json({
          success: true,
          transactionId: transactionId,
          status: 'PENDING',
          message: 'Transaction en attente de traitement'
        });
      }

      // Si c'est une erreur d'authentification ou de configuration
      if (errorMessage.includes('401') || 
          errorMessage.includes('403') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('signature')) {
        console.error('[S3P Verify] Erreur d\'authentification S3P');
        return NextResponse.json(
          { 
            success: false,
            error: 'Erreur d\'authentification avec le service de paiement',
            details: errorMessage
          },
          { status: 500 }
        );
      }

      console.error('[S3P Verify] Erreur générale S3P');
      return NextResponse.json(
        { 
          success: false,
          error: 'Erreur du service de paiement',
          details: errorMessage
        },
        { status: 502 }
      );
    }

  } catch (error: any) {
    console.error('[S3P Verify] Erreur inattendue:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur interne du serveur',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, trid } = body;

    if (!transactionId && !trid) {
      return NextResponse.json(
        { 
          success: false,
          error: 'transactionId ou trid est requis' 
        },
        { status: 400 }
      );
    }

    console.log('[S3P Verify] Vérification avec:', { transactionId, trid });
    
    try {
      let result;
      if (transactionId) {
        result = await s3pClient.verifytxGet('3.0.0', transactionId);
      } else {
        result = await s3pClient.verifytxGet('3.0.0', undefined, trid);
      }

      console.log('[S3P Verify] Réponse S3P:', result);
      
      let paymentStatus;
      
      if (Array.isArray(result) && result.length > 0) {
        if (transactionId) {
          paymentStatus = result.find(status => status.ptn === transactionId);
        } else if (trid) {
          paymentStatus = result.find(status => status.trid === trid);
        }
        paymentStatus = paymentStatus || result[0];
      } else {
        paymentStatus = result;
      }

      if (!paymentStatus) {
        return NextResponse.json({
          success: true,
          transactionId: transactionId,
          trid: trid,
          status: 'PENDING',
          message: 'Transaction en attente de traitement'
        });
      }

      const finalStatus = getFinalStatus(paymentStatus.status, paymentStatus.errorCode);
      const errorMessage = getErrorMessage(paymentStatus.errorCode);

      const responseData = {
        success: true,
        transactionId: paymentStatus.ptn || transactionId,
        trid: paymentStatus.trid || trid,
        status: finalStatus,
        data: paymentStatus,
        ...(errorMessage && { errorMessage }),
        ...(paymentStatus.errorCode !== undefined && { errorCode: paymentStatus.errorCode })
      };

      return NextResponse.json(responseData);

    } catch (s3pError: any) {
      console.error('[S3P Verify] Erreur S3P:', s3pError);
      
      const errorMessage = s3pError.message || 'Erreur de vérification';
      
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return NextResponse.json({
          success: true,
          transactionId: transactionId,
          trid: trid,
          status: 'PENDING',
          message: 'Transaction en attente de traitement'
        });
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Erreur lors de la vérification',
          details: errorMessage
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[S3P Verify] Erreur inattendue:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur interne du serveur',
        details: error.message 
      },
      { status: 500 }
    );
  }
}