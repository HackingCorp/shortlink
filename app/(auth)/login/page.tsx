'use client';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const result = await signIn('credentials', {
      redirect: false,
      identifier,
      password,
    });
    
    setIsLoading(false);
    if (result?.error) {
      setError('Identifiant ou mot de passe incorrect.');
    } else if (result?.ok) {
      router.replace('/dashboard');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-indigo-600">ShortLink</h1>
            <h2 className="mt-2 text-xl font-semibold text-gray-800">Connectez-vous à votre compte</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-bold text-gray-600 block">Email ou nom d'utilisateur</label>
            <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required className="w-full p-2 border border-gray-300 rounded mt-1"/>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-600 block">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-2 border border-gray-300 rounded mt-1"/>
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button type="submit" disabled={isLoading} className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white text-sm disabled:bg-indigo-400 flex justify-center">
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Se connecter'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
            Pas encore de compte ? <Link href="/register" className="text-indigo-600 hover:underline">Inscrivez-vous</Link>
        </p>
      </div>
    </div>
  );
}