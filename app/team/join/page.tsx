'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { Mail, CheckCircle, XCircle } from 'lucide-react';

type InvitationDetails = {
  email: string; 
  teamName: string; 
  inviterEmail: string;
};

function JoinTeamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { data: session, status } = useSession();
  
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      fetch(`/api/v1/invitations/${token}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setInvitation(data);
        })
        .catch(err => setError(err.message || 'Invitation invalide ou expirée.'))
        .finally(() => setIsLoading(false));
    } else {
      setError("Token d'invitation manquant dans l'URL.");
      setIsLoading(false);
    }
  }, [token]);
  
  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const response = await fetch('/api/v1/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (result.success) {
          // Redirige vers le dashboard. Le WorkspaceContext se mettra à jour.
          router.push('/dashboard');
      } else {
          setError(result.error || "Impossible d'accepter l'invitation.");
          setIsAccepting(false);
      }
    } catch (err) {
      setError("Erreur lors de l'acceptation de l'invitation.");
      setIsAccepting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="text-center p-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        Vérification de l'invitation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-10 text-red-600 flex flex-col items-center">
        <XCircle className="w-12 h-12 mb-4"/>
        Erreur : {error}
      </div>
    );
  }

  if (!invitation) return null;

  if (status === 'loading') {
    return (
      <div className="text-center p-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        Chargement...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
        <div className="text-center">
            <Mail className="w-12 h-12 text-indigo-600 mx-auto mb-4"/>
            <h2 className="text-xl font-semibold">Vous avez été invité à rejoindre <span className="text-indigo-600">{invitation.teamName}</span>.</h2>
            <p className="mt-4 text-gray-600">Connectez-vous ou créez un compte avec l'adresse <span className="font-bold">{invitation.email}</span> pour accepter.</p>
            <div className="mt-6 flex justify-center space-x-4">
                <button 
                  onClick={() => signIn()} 
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Se connecter
                </button>
                <Link 
                  href="/register" 
                  className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  S'inscrire
                </Link>
            </div>
        </div>
    );
  }

  if (session?.user?.email !== invitation.email) {
    return (
      <div className="text-center p-10 text-red-500 flex flex-col items-center">
        <XCircle className="w-12 h-12 mb-4"/>
        Cette invitation est pour l'adresse {invitation.email}.<br/>
        Veuillez vous connecter avec le bon compte.
      </div>
    );
  }

  return (
    <div className="text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4"/>
        <h2 className="text-xl font-semibold">Rejoindre l'équipe <span className="text-indigo-600">{invitation.teamName}</span></h2>
        <p className="mt-4 text-gray-600"><span className="font-medium">{invitation.inviterEmail}</span> vous a invité.</p>
        <button 
          onClick={handleAccept} 
          disabled={isAccepting} 
          className="mt-6 px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed w-full flex justify-center items-center transition-colors"
        >
          {isAccepting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            "Accepter l'invitation"
          )}
        </button>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center p-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          Chargement des détails de l'invitation...
        </div>
      </div>
    </div>
  );
}

export default function JoinTeamPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-lg">
        <Suspense fallback={<LoadingFallback />}>
          <JoinTeamContent />
        </Suspense>
      </div>
    </div>
  );
}