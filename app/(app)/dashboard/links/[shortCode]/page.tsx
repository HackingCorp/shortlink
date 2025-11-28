'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LinkStatsRedirect() {
    const params = useParams();
    const router = useRouter();
    const shortCode = Array.isArray(params.shortCode) ? params.shortCode[0] : params.shortCode;

    useEffect(() => {
        if (typeof shortCode === 'string') {
            // Rediriger immédiatement vers la page de statistiques
            router.push(`/links/${shortCode}/stats`);
        }
    }, [shortCode, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-gray-600">Chargement des statistiques...</p>
        </div>
    );
}