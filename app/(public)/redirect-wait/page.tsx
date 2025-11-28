'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Décoder l'URL cible
    const encodedTarget = searchParams.get('target');
    if (!encodedTarget) {
      setError('URL de destination manquante');
      return;
    }

    try {
      const decodedTarget = decodeURIComponent(encodedTarget);
      // Valider que c'est une URL valide
      new URL(decodedTarget);
      setTargetUrl(decodedTarget);
    } catch (err) {
      console.error('URL de destination invalide:', err);
      setError('URL de destination invalide');
      return;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!targetUrl) return;

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    const redirectTimeout = setTimeout(() => {
      try {
        window.location.href = targetUrl;
      } catch (err) {
        console.error('Erreur lors de la redirection:', err);
        setError('Impossible de procéder à la redirection');
      }
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimeout);
    };
  }, [targetUrl]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Erreur</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (!targetUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-pulse">Chargement de la redirection...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg">
        <h1 className="text-2xl font-bold text-gray-800">Redirection en cours...</h1>
        <p className="mt-4 text-gray-600">
          Vous allez être redirigé vers :
        </p>
        <p className="mt-2 text-sm font-mono bg-gray-100 p-3 rounded break-all text-indigo-700">
          {targetUrl}
        </p>
        <div className="mt-6">
          <div className="relative w-20 h-20 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle className="text-gray-200" strokeWidth="10" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50" />
              <circle 
                className="text-indigo-600" 
                strokeWidth="10" 
                strokeLinecap="round" 
                stroke="currentColor" 
                fill="transparent" 
                r="45" cx="50" cy="50"
                style={{
                  strokeDasharray: 283,
                  strokeDashoffset: 283 - (countdown / 5) * 283,
                  transition: 'stroke-dashoffset 1s linear'
                }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-indigo-600">
              {countdown}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RedirectWaitPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-pulse">Chargement de la redirection...</div>
      </div>
    }>
      <RedirectContent />
    </Suspense>
  );
}