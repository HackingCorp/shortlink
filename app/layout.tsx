'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Providers } from './Providers';
import { Toaster } from 'react-hot-toast';
import { NotificationProvider } from '@/context/NotificationContext';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-gray-50 antialiased`}>
        <NotificationProvider>
          {/* Toaster pour les notifications toast */}
          <Toaster position="top-center" reverseOrder={false} />
          
          {/* Centre de notifications personnalisé */}
          <NotificationCenter />
          
          <Providers>
            {children}
          </Providers>
        </NotificationProvider>
      </body>
    </html>
  );
}