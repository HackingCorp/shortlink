import { Lock } from 'lucide-react';

interface LockedFeatureProps {
  featureName: string;
  requiredPlan: string;
  description?: string;
}

export const LockedFeature = ({ featureName, requiredPlan, description }: LockedFeatureProps) => (
  <div className="bg-white p-6 rounded-lg shadow relative overflow-hidden mt-8">
    <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 text-center p-6">
      <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mb-4">
        <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{featureName} est verrouillé</h3>
      <p className="mt-2 text-gray-600 dark:text-gray-300 max-w-md">
        {description || `Cette fonctionnalité est disponible avec le plan ${requiredPlan}.`}
      </p>
      <div className="mt-6 flex gap-3">
        <a 
          href="/dashboard/upgrade"
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Mettre à niveau
        </a>
        <a 
          href="/pricing" 
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
        >
          Voir les plans
        </a>
      </div>
    </div>
    
    <div className="opacity-50 pointer-events-none">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{featureName}</h3>
      <div className="mt-4 space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
      </div>
    </div>
  </div>
);