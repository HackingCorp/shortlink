'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect, Suspense } from 'react';
import Link from 'next/link';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/v1/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setSuccess('Votre compte est vérifié ! Vous allez être redirigé vers la page de connexion...');
      setTimeout(() => router.push('/login'), 3000);

    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-indigo-600">Vérifiez votre compte</h1>
            <p className="mt-2 text-gray-600">
                Un code à 6 chiffres vous a été envoyé par e-mail.
            </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-bold text-gray-600 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required 
              className="w-full p-2 border border-gray-300 rounded mt-1 bg-gray-50"/>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-600 block">Code de vérification</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value)} required maxLength={6}
              className="w-full p-2 border border-gray-300 rounded mt-1 text-center text-lg tracking-[0.5em]"/>
          </div>
          
          {error && <p className="text-sm text-red-600 text-center animate-shake">{error}</p>}
          {success && <p className="text-sm text-green-600 text-center">{success}</p>}

          <button type="submit" disabled={isLoading || !!success} className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white text-sm disabled:bg-indigo-400 flex justify-center">
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Vérifier'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
            Retour à la <Link href="/login" className="text-indigo-600 hover:underline">connexion</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <VerifyEmailContent />
        </Suspense>
    )
}