'use client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSession } from 'next-auth/react';
import { KeyRound, Plus, Trash2, Copy, BookOpen } from 'lucide-react';
import { useState, FormEvent, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ApiDocBlock } from '@/components/ui/ApiDocBlock';
import { LockedFeature } from '@/components/ui/LockedFeature';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

type ApiKey = { id: number; name: string; createdAt: string; lastUsed: string | null };

export default function ApiKeysPage() {
  const { activeContext } = useWorkspace();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isProOrHigher = userRole === 'PRO' || userRole === 'ENTERPRISE';
  const isTeamOwner = activeContext?.type === 'team' && activeContext.role === 'OWNER';
  const maxApiKeys = userRole === 'ENTERPRISE' ? 10 : 2; 

  const [activeTab, setActiveTab] = useState<'keys' | 'docs'>('keys');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isProOrHigher) {
      setIsLoading(true);
      fetch('/api/v1/user/api-keys')
        .then(res => res.json())
        .then(data => { if (data.success) setKeys(data.data); })
        .catch(error => console.error('Erreur lors du chargement des clés:', error))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [isProOrHigher]);

  const handleCreateKey = async (e: FormEvent) => {
    e.preventDefault();
    
    // Vérifier la limite de clés
    if (keys.length >= maxApiKeys) {
      toast.error(`Limite de ${maxApiKeys} clé(s) API atteinte. Supprimez une clé existante pour en créer une nouvelle.`);
      return;
    }

    const toastId = toast.loading("Création de la clé...");
    try {
      const res = await fetch('/api/v1/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newKeyName,
          teamId: activeContext?.type === 'team' ? activeContext.id : undefined
        }),
      });
      
      const result = await res.json();
      toast.dismiss(toastId);
      
      if (result.success) {
        toast.success("Clé créée avec succès !");
        setGeneratedKey(result.apiKey);
        setKeys([...keys, result.keyData]);
        setNewKeyName('');
      } else {
        toast.error(result.error || "Une erreur est survenue lors de la création de la clé.");
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.dismiss(toastId);
      toast.error("Une erreur est survenue lors de la communication avec le serveur.");
    }
  };
  
  const handleRevokeKey = async (keyId: number) => {
    if (confirm('Êtes-vous sûr de vouloir révoquer cette clé ? Cette action est irréversible.')) {
        const toastId = toast.loading("Révocation en cours...");
        await fetch('/api/v1/user/api-keys', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyId }),
        });
        toast.dismiss(toastId);
        toast.success("Clé révoquée.");
        setKeys(keys.filter(k => k.id !== keyId));
    }
  };

  if (isLoading) {
    return <div><SkeletonLoader className="h-96 w-full" /></div>
  }

  if (!isProOrHigher) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center"><KeyRound className="mr-3"/> Clés d'API</h1>
        <LockedFeature 
          featureName="Clés d'API" 
          requiredPlan="PRO ou supérieur"
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-800 flex items-center"><KeyRound className="mr-3"/> Clés d'API</h1>
      <p className="text-gray-600 mt-2">Gérez et documentez l'accès programmatique à votre compte d'équipe.</p>

      {/* Onglets de navigation */}
      <div className="border-b border-gray-200 mt-8">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button onClick={() => setActiveTab('keys')} className={`${activeTab === 'keys' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Mes Clés
          </button>
          <button onClick={() => setActiveTab('docs')} className={`${activeTab === 'docs' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
            Documentation
          </button>
        </nav>
      </div>

      {/* Contenu des onglets */}
      <div className="mt-8">
        {activeTab === 'keys' && (
          <div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Créer une nouvelle clé</h2>
                <span className="text-sm text-gray-500">
                  {keys.length}/{maxApiKeys} clés utilisées
                </span>
              </div>
              <form onSubmit={handleCreateKey} className="flex items-end space-x-4">
                <div className="flex-1">
                  <label htmlFor="keyName" className="text-sm font-medium">Nom de la clé</label>
                  <input 
                    type="text" 
                    id="keyName" 
                    value={newKeyName} 
                    onChange={e => setNewKeyName(e.target.value)} 
                    required 
                    placeholder="Ex: Mon script de déploiement" 
                    className="w-full p-2 border rounded mt-1"
                    disabled={keys.length >= maxApiKeys}
                  />
                  {keys.length >= maxApiKeys && (
                    <p className="text-sm text-red-600 mt-1">
                      Vous avez atteint la limite de {maxApiKeys} clé(s). Supprimez une clé existante pour en créer une nouvelle.
                    </p>
                  )}
                </div>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-indigo-600 text-white rounded h-10 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={keys.length >= maxApiKeys || !newKeyName.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" /> Créer
                </button>
              </form>
            </div>
            <div className="mt-8 bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Vos clés</h2>
              <ul className="divide-y divide-gray-200">
                {keys.length > 0 ? keys.map(key => (
                  <li key={key.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-gray-500">Créée le: {new Date(key.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => handleRevokeKey(key.id)} className="text-gray-400 hover:text-red-600 flex items-center text-sm">
                      <Trash2 className="w-4 h-4 mr-1"/> Révoquer
                    </button>
                  </li>
                )) : <p className="text-sm text-gray-500">Vous n'avez pas encore de clé d'API.</p>}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div>
            <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
                <div className="flex">
                    <BookOpen className="w-6 h-6 text-indigo-600 mr-3 mt-1"/>
                    <div>
                        <h2 className="text-xl font-bold text-indigo-900">Documentation de l'API</h2>
                        <p className="mt-1 text-indigo-700">Utilisez votre clé d'API pour créer et gérer des liens par programmation. La clé doit être fournie dans l'en-tête `x-api-key` pour chaque requête.</p>
                    </div>
                </div>
            </div>

            <div className="mt-8">
                <ApiDocBlock 
                    title="Créer un lien"
                    description="Crée un nouveau lien court associé à votre équipe."
                    method="POST"
                    endpoint="/api/v1/links"
                    body={{
                        "longUrl": "https://exemple.com/un-article-interessant",
                        "title": "Titre du lien (optionnel)",
                        "customSlug": "slug-perso (optionnel)",
                        "teamId": "(optionnel)" 
                    }}
                />
                <ApiDocBlock 
                    title="Lister les liens de l'équipe"
                    description="Récupère une liste de tous les liens appartenant à votre équipe."
                    method="GET"
                    endpoint={`/api/v1/links?teamId=${activeContext?.type === 'team' ? activeContext.id : 1}`}
                />
                <ApiDocBlock 
                    title="Supprimer un lien"
                    description="Supprime définitivement un lien court appartenant à votre équipe."
                    method="DELETE"
                    endpoint={`/api/v1/links/VOTRE_SHORT_CODE`}
                />
            </div>
          </div>
        )}
      </div>

      {generatedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
            <h2 className="text-2xl font-bold">Nouvelle Clé d'API Créée</h2>
            <p className="mt-4 text-gray-600">Copiez cette clé et conservez-la en lieu sûr. **Vous ne pourrez plus la voir après avoir fermé cette fenêtre.**</p>
            <div className="mt-4 p-3 bg-gray-100 rounded font-mono text-sm break-all flex items-center justify-between">
              <span>{generatedKey}</span>
              <button onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success("Clé copiée !"); }} className="p-1 text-gray-500 hover:text-indigo-600"><Copy/></button>
            </div>
            <button onClick={() => setGeneratedKey(null)} className="mt-6 w-full py-2 bg-indigo-600 text-white rounded">J'ai copié ma clé</button>
          </div>
        </div>
      )}
    </div>
  );
}