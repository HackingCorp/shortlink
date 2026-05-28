'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Veuillez entrer votre email ou nom d\'utilisateur'),
  password: z.string().min(1, 'Veuillez entrer votre mot de passe'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    // Check rate limit before attempting login
    try {
      const rateLimitRes = await fetch('/api/auth/login', { method: 'POST' });
      if (rateLimitRes.status === 429) {
        const body = await rateLimitRes.json();
        setServerError(body.error || 'Trop de tentatives. Veuillez réessayer plus tard.');
        return;
      }
    } catch {
      // If rate limit check fails, proceed with login
    }

    const result = await signIn('credentials', {
      redirect: false,
      identifier: data.identifier,
      password: data.password,
    });

    if (result?.error) {
      setServerError(result.error);
    } else if (result?.ok) {
      router.replace('/dashboard');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-indigo-600">ShortLink</h1>
            <h2 className="mt-2 text-xl font-semibold text-gray-800">Connectez-vous a votre compte</h2>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="identifier" className="text-sm font-bold text-gray-600 block">Email ou nom d&apos;utilisateur</label>
            <input
              id="identifier"
              type="text"
              {...register('identifier')}
              className={`w-full p-2 border rounded mt-1 ${errors.identifier ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.identifier && (
              <p className="text-sm text-red-600 mt-1">{errors.identifier.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-bold text-gray-600 block">Mot de passe</label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className={`w-full p-2 border rounded mt-1 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-red-600 text-center">{serverError}</p>}
          <button type="submit" disabled={isSubmitting} className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white text-sm disabled:bg-indigo-400 flex justify-center">
            {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Se connecter'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
            Pas encore de compte ? <Link href="/register" className="text-indigo-600 hover:underline">Inscrivez-vous</Link>
        </p>
      </div>
    </div>
  );
}
