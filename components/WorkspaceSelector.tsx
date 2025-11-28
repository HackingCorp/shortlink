'use client';
import { useWorkspace, PersonalContext, TeamContext } from '@/contexts/WorkspaceContext';
import { Building, ChevronDown, UserCircle } from 'lucide-react';
import { useState } from 'react';

export function WorkspaceSelector() {
  const { activeContext, availableContexts, switchContext, isLoading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return <div className="h-10 bg-gray-200 rounded animate-pulse"></div>;
  }

  if (!activeContext) return null;

  const personalContext: PersonalContext = { type: 'personal', name: 'Espace Personnel' };
  
  const handleSelect = (context: PersonalContext | TeamContext) => {
    switchContext(context);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 bg-gray-50 rounded-md border hover:bg-gray-100"
      >
        <div className="flex items-center space-x-2">
          {activeContext.type === 'personal' ? (
            <UserCircle className="w-5 h-5 text-gray-500" />
          ) : (
            <Building className="w-5 h-5 text-indigo-500" />
          )}
          <span className="text-sm font-semibold text-gray-800">{activeContext.name}</span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-10">
          <ul className="p-1">
            {/* Espace Personnel */}
            <li>
              <button onClick={() => handleSelect(personalContext)} className="w-full text-left flex items-center space-x-2 p-2 rounded hover:bg-gray-100 text-sm">
                <UserCircle className="w-5 h-5 text-gray-500" />
                <span>{personalContext.name}</span>
              </button>
            </li>
            
            {/* Équipes */}
            {availableContexts.length > 0 && (
              <>
                <li className="px-2 pt-2 pb-1 text-xs text-gray-400 font-semibold uppercase">Équipes</li>
                {availableContexts.map(team => (
                  <li key={team.id}>
                    <button onClick={() => handleSelect(team)} className="w-full text-left flex items-center space-x-2 p-2 rounded hover:bg-gray-100 text-sm">
                      <Building className="w-5 h-5 text-indigo-500" />
                      <span>{team.name}</span>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}