import { Configuration, MasterdataApi } from 'maviance-s3p-client';
import { env } from '@/env.mjs';

const config = new Configuration({
  basePath: env.S3P_API_BASE_URL,
  apiKey: `Bearer ${env.S3P_API_KEY}`,
  accessToken: env.S3P_ACCESS_TOKEN,
});

const masterdataApi = new MasterdataApi(config);

export async function getCashoutPackages(serviceId?: number) {
  try {
    const response = await masterdataApi.cashoutGet('3.0.0', serviceId);
    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Erreur S3P - cashoutGet:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Erreur lors de la récupération des packages cashout'
    };
  }
}

export async function getService(serviceId: number) {
  try {
    const response = await masterdataApi.serviceIdGet('3.0.0', serviceId);
    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error('Erreur S3P - serviceIdGet:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Erreur lors de la récupération du service'
    };
  }
}