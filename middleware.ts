import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { NextRequest } from 'next/server';

// Liste des origines autorisées (à adapter selon vos besoins)
const allowedOrigins = [
  'http://localhost:3000',
  'https://votredomaine.com',
  // Ajoutez d'autres origines au besoin
];

// Configuration CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// Middleware principal
export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Gestion des requêtes OPTIONS (prévol)
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, {
        status: 204, // No Content
        headers: corsHeaders,
      });
      return response;
    }

    // Chemins publics qui ne nécessitent pas d'authentification
    const publicPaths = [
      '/api/auth',
      '/_next',
      '/favicon.ico',
      '/api/health',
      '/auth/login',
      '/auth/register',
      '/dashboard/upgrade/confirmation',
      '/api/v1/subscription/renewal-info',
    ];

    // Vérifier si le chemin est public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
    
    // Si le chemin est public, on laisse passer la requête
    if (isPublicPath) {
      const response = NextResponse.next();
      // Ajouter les en-têtes CORS
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Pour les autres chemins, laisser withAuth gérer l'authentification
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = new URL(req.url);
        
        // Chemins qui nécessitent une authentification
        const protectedPaths = [
          '/dashboard',
          '/api/v1/user',
          '/api/v1/payment',
        ];

        // Vérifier si le chemin est protégé
        const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
        
        // Si le chemin n'est pas protégé, on laisse passer
        if (!isProtectedPath) {
          return true;
        }

        // Vérifier si l'utilisateur est authentifié pour les chemins protégés
        return !!token;
      },
    },
    pages: {
      signIn: '/auth/login',
      error: '/auth/error',
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};