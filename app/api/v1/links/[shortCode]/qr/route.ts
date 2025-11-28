import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAuthSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { shortCode: string } }
) {
  try {
    // Vérifier l'authentification
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { shortCode } = params;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/${shortCode}`;

    // Générer le QR code en tant qu'URL de données
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        qr_code_data_url: qrCodeDataUrl
      }
    });
  } catch (error) {
    console.error('Erreur lors de la génération du QR code:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la génération du QR code' },
      { status: 500 }
    );
  }
}
