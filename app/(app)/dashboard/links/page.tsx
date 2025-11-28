'use client';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSession } from 'next-auth/react';
import { FormEvent, useEffect, useState } from 'react';
import { Link as LinkIcon, Copy, Trash2, QrCode, BarChart2, Check } from 'lucide-react';
import { QrCodeModal } from '@/components/ui/QrCodeModal';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

type LinkItem = {
  id: number;
  short_code: string;
  long_url: string;
  title: string | null;
  click_count: number;
  expires_at?: string | null;
};

export default function LinksPage() {
  const { data: session } = useSession();
  const { activeContext, isLoading: isWorkspaceLoading } = useWorkspace();
  
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // États pour le formulaire
  const [longUrl, setLongUrl] = useState('');
  const [title, setTitle] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [selectedLinkForQr, setSelectedLinkForQr] = useState<string | null>(null);

  const canCustomize = 
    activeContext?.type === 'team' || 
    (session?.user?.role && ['STANDARD', 'PRO', 'ENTERPRISE'].includes(session.user.role));

  useEffect(() => {
    if (activeContext) {
      setIsLoading(true);
      let apiUrl = '/api/v1/links';
      if (activeContext.type === 'team') {
        apiUrl += `?teamId=${activeContext.id}`;
      }
      
      fetch(apiUrl)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            setLinks(result.data);
          } else {
            toast.error(result.error || "Impossible de charger les liens.");
          }
        })
        .catch(() => toast.error("Une erreur réseau est survenue."))
        .finally(() => setIsLoading(false));
    }
  }, [activeContext]);

  // Gérer la soumission du formulaire de création de lien
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const body: any = { longUrl };
    if (canCustomize) {
        if (title) body.title = title;
        if (customSlug) body.customSlug = customSlug;
        if (expiresAt) body.expiresAt = expiresAt;
    } else if (expiresAt) {
        body.expiresAt = expiresAt;
    }
    if (activeContext?.type === 'team') {
        body.teamId = activeContext.id;
    }

    try {
        const response = await fetch('/api/v1/links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        
        toast.success('Lien créé avec succès !');
        
        if (result.data && result.data.short_code) {
          setLinks([{
            id: result.data.id,
            short_code: result.data.short_code,
            long_url: result.data.long_url,
            title: result.data.title || null,
            click_count: 0,
            expires_at: result.data.expires_at || null
          }, ...links]);
        } else {
          const res = await fetch(activeContext?.type === 'team' 
            ? `/api/v1/links?teamId=${activeContext.id}` 
            : '/api/v1/links');
          const { data } = await res.json();
          setLinks(data || []);
        }
        
        setLongUrl('');
        setTitle('');
        setCustomSlug('');
        setExpiresAt('');
    } catch (err: any) {
        toast.error(err.message || 'Une erreur est survenue.');
    } finally {
        setIsSubmitting(false);
    }
  };

  // Gérer la copie d'un lien court
  const handleCopy = (shortCode: string) => {
    const url = `${window.location.origin}/${shortCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(shortCode);
    toast.success('Lien copié dans le presse-papiers !');
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Gérer la suppression d'un lien
  const handleDelete = async (shortCode: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce lien ? Cette action est irréversible.")) return;

    const originalLinks = [...links];
    setLinks(links.filter(link => link.short_code !== shortCode)); 
    const toastId = toast.loading('Suppression en cours...');

    try {
      const res = await fetch(`/api/v1/links/${shortCode}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Échec de la suppression");
      toast.dismiss(toastId);
      toast.success("Lien supprimé avec succès.");
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Impossible de supprimer le lien.");
      setLinks(originalLinks); 
    }
  };
  
  // Affiche un squelette pendant le chargement initial des données
  if (isWorkspaceLoading || isLoading) {
    return (
        <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800">Gérer les Liens</h1>
            <div className="mt-8 bg-white p-6 rounded-lg shadow"><SkeletonLoader className="h-24" /></div>
            <div className="mt-8 space-y-3">
                <SkeletonLoader className="h-20 w-full rounded-lg" />
                <SkeletonLoader className="h-20 w-full rounded-lg" />
                <SkeletonLoader className="h-20 w-full rounded-lg" />
            </div>
        </div>
    );
  }

  return (
    <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-800">
            Gérer les Liens ({activeContext?.name})
        </h1>
        
        {/* Formulaire de création */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
            <form onSubmit={handleSubmit}>
                <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-4">
                    <div className="flex-1">
                        <label htmlFor="longUrl" className="block text-sm font-medium text-gray-700">URL de destination</label>
                        <input type="url" id="longUrl" value={longUrl} onChange={e => setLongUrl(e.target.value)} placeholder="https://exemple.com/mon-article-tres-long" required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <button type="submit" disabled={isSubmitting}
                        className="mt-4 sm:mt-0 px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 h-10 flex items-center justify-center disabled:bg-indigo-400 transition-colors"
                    >
                        {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Raccourcir'}
                    </button>
                </div>
                
                {canCustomize ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre (Optionnel)</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Mon super article"
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label htmlFor="customSlug" className="block text-sm font-medium text-gray-700">Slug personnalisé (Optionnel)</label>
                            <div className="flex items-center mt-1">
                                <span className="inline-block bg-gray-100 px-3 py-2 border border-r-0 border-gray-300 rounded-l-md text-sm text-gray-500">ShortLink.fr/</span>
                                <input type="text" id="customSlug" value={customSlug} onChange={e => setCustomSlug(e.target.value)} placeholder="mon-slug"
                                className="block w-full px-3 py-2 border border-gray-300 rounded-r-md shadow-sm"/>
                            </div>
                            <div className="col-span-2">
                                <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-700">Date d'expiration (Optionnel)</label>
                                <input
                                    type="datetime-local"
                                    id="expiresAt"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    min={new Date().toISOString().slice(0, 16)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-gray-500">Passez au plan <span className="font-semibold">Standard</span> pour personnaliser vos liens.</p>
                )}
            </form>
        </div>

        {/* Liste des liens */}
        <div className="mt-8 flow-root">
            <ul role="list" className="-my-4 divide-y divide-gray-200">
                {links.length > 0 ? (
                    links.map((link, index) => {
                        const linkKey = link?.id ? `link-${link.id}` : 
                                      link?.short_code ? `link-${link.short_code}` : 
                                      `link-${index}-${Date.now()}`;
                        
                        return (
                        <li key={linkKey} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 bg-white px-6 my-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-indigo-600 truncate">{link.title || link.long_url}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                                <div className="flex items-center text-sm text-gray-500">
                                    <LinkIcon className="w-4 h-4 mr-1.5 text-gray-400 flex-shrink-0" />
                                    <a href={`${window.location.origin}/${link.short_code}`} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                                        {`${window.location.host}/${link.short_code}`}
                                    </a>
                                </div>
                                {link.expires_at && new Date(link.expires_at) < new Date() ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                        Expiré
                                    </span>
                                ) : link.expires_at ? (
                                    <span className="text-xs text-gray-500">
                                        Expire le {new Date(link.expires_at).toLocaleDateString()}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                            <span className="text-sm font-medium text-gray-800 hidden sm:flex items-center">
                                <BarChart2 className="w-4 h-4 mr-1.5 text-gray-400"/>
                                {link.click_count}
                            </span>
                            <Link href={`/dashboard/links/${link.short_code}`} title="Voir les statistiques" className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 transition-colors">
                                <BarChart2 className="w-5 h-5 sm:hidden"/>
                                <span className="hidden sm:inline">Stats</span>
                            </Link>
                            <a 
                                href={`/${link.short_code}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                title="Ouvrir le lien" 
                                className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <LinkIcon className="w-5 h-5"/>
                            </a>
                            <button 
                                onClick={() => handleCopy(link.short_code)} 
                                title="Copier le lien" 
                                className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                {copiedLink === link.short_code ? <Check className="w-5 h-5 text-green-500"/> : <Copy className="w-5 h-5"/>}
                            </button>
                            <button onClick={() => handleDelete(link.short_code)} title="Supprimer le lien" className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors">
                                <Trash2 className="w-5 h-5"/>
                            </button>
                        </div>
                        </li>
                    );
                    })
                ) : (
                    <li className="w-full">
                        <div className="text-center py-10 bg-white rounded-lg shadow-sm">
                            <p className="text-gray-500">Vous n'avez pas encore créé de lien dans cet espace.</p>
                            <p className="text-sm text-gray-400 mt-1">Commencez par en créer un ci-dessus !</p>
                        </div>
                    </li>
                )}
            </ul>
        </div>
        
        {selectedLinkForQr && <QrCodeModal shortCode={selectedLinkForQr} onClose={() => setSelectedLinkForQr(null)} />}
    </div>
  );
}