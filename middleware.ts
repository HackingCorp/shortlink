import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';
import { NextRequest } from 'next/server';

// Liste des origines autorisées
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3200',
  'https://kut.es',
  'https://www.kut.es',
];

function getCorsHeaders(origin: string | null) {
  // Vérifier si l'origine est autorisée
  const isAllowed = origin && allowedOrigins.includes(origin);

  if (!isAllowed) {
    return null;
  }

  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

// Headers de sécurité
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
};

// Middleware principal
export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const origin = request.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Reject cross-origin requests from unauthorized origins on API routes
    if (origin && !corsHeaders && pathname.startsWith('/api/')) {
      return new NextResponse(null, {
        status: 403,
        headers: securityHeaders,
      });
    }

    // Gestion des requêtes OPTIONS (prévol)
    if (request.method === 'OPTIONS') {
      if (!corsHeaders) {
        return new NextResponse(null, {
          status: 403,
          headers: securityHeaders,
        });
      }
      return new NextResponse(null, {
        status: 204,
        headers: { ...corsHeaders, ...securityHeaders },
      });
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
      '/api/webhooks/',
      '/api/v1/payment/s3p/webhook',
      '/api/v1/payment/enkap/webhook',
    ];

    // Vérifier si le chemin est public
    const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

    // Construire les headers à appliquer
    const headersToApply = corsHeaders
      ? { ...corsHeaders, ...securityHeaders }
      : securityHeaders;

    // Si le chemin est public, on laisse passer la requête
    if (isPublicPath) {
      const response = NextResponse.next();
      Object.entries(headersToApply).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // Pour les autres chemins, ajouter les headers de sécurité
    const response = NextResponse.next();
    Object.entries(headersToApply).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
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

        // Les webhooks ne passent pas par l'auth session
        const webhookPaths = [
          '/api/webhooks/',
          '/api/v1/payment/s3p/webhook',
          '/api/v1/payment/enkap/webhook',
        ];
        const isWebhook = webhookPaths.some(path => pathname.startsWith(path));
        if (isWebhook) return true;

        // Les requêtes avec clé API gèrent leur propre auth dans les routes
        const hasApiKey = req.headers.get('x-api-key');
        if (hasApiKey && pathname.startsWith('/api/v1/')) return true;

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
