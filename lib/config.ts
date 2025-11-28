// Configuration des URLs de l'application
const getAppUrl = () => {
  // En production, utilise NEXT_PUBLIC_APP_URL ou déduit du host de la requête
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_APP_URL || 'https://kut.es';
  }
  // En développement, utilise NEXT_PUBLIC_APP_URL ou localhost par défaut
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

export const config = {
  appUrl: getAppUrl(),
  isProduction: process.env.NODE_ENV === 'production',
  getShortUrl: (shortCode: string) => {
    return `${getAppUrl()}/${shortCode}`;
  },
};
