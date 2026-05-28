import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'kut.es - Raccourcisseur d\'URL',
  description: 'Raccourcissez vos liens facilement et suivez leurs performances. Liens courts, analytiques, QR codes et plus encore.',
  openGraph: {
    title: 'kut.es - Raccourcisseur d\'URL',
    description: 'Raccourcissez vos liens facilement et suivez leurs performances. Liens courts, analytiques, QR codes et plus encore.',
    type: 'website',
    siteName: 'kut.es',
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'kut.es - Raccourcisseur d\'URL',
    description: 'Raccourcissez vos liens facilement et suivez leurs performances. Liens courts, analytiques, QR codes et plus encore.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
  colorScheme: 'dark',
};
