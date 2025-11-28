'use client';

import { useSession } from 'next-auth/react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { FormEvent, useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, Mail, Users } from 'lucide-react';
import { LockedFeature } from '@/components/ui/LockedFeature';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import toast from 'react-hot-toast';

// Définition des types pour les données de l'API
type Member = {
  id: number;
  user: {
    id: number;
    email: string;
    username: string | null;
  };
  role: string;
};

type Invitation = {
  id: number;
  email: string;
  role: string;
};

export default function TeamPage() {
  const { data: session } = useSession();
  const { activeContext, isLoading: isWorkspaceLoading } = useWorkspace();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // États du formulaire d'invitation
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [isInviting, setIsInviting] = useState(false);

  // L'utilisateur est-il admin ou owner de l'équipe active ?
  const isTeamAdmin = activeContext?.type === 'team' && ['OWNER', 'ADMIN'].includes(activeContext.role);

  // Fonction pour charger toutes les données de la page
  const fetchData = async () => {
      if (activeContext?.type !== 'team' || !session) return;
      setIsLoading(true);
      try {
        const [membersRes, invitesRes] = await Promise.all([
          fetch(`/api/v1/teams/${activeContext.id}/members`),
          fetch(`/api/v1/teams/${activeContext.id}/invitations`),
        ]);
        const membersData = await membersRes.json();
        const invitesData = await invitesRes.json();
        
        if (membersData.success) setMembers(membersData.data);
        if (invitesData.success) setInvitations(invitesData.data);
      } catch (error) {
        toast.error("Impossible de charger les données de l'équipe.");
      } finally {
        setIsLoading(false);
      }
  };
  
  useEffect(() => {
    // Ne fetcher que si on est dans un contexte d'équipe
    if (activeContext?.type === 'team') {
      fetchData();
    }
  }, [activeContext]);

  // Gérer l'envoi d'une invitation
  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!isTeamAdmin || activeContext?.type !== 'team') return;
    
    setIsInviting(true);
    const toastId = toast.loading("Envoi de l'invitation...");
    
    try {
      const response = await fetch(`/api/v1/teams/${activeContext.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const result = await response.json();
      toast.dismiss(toastId);
      
      if (!result.success) throw new Error(result.error);
      
      toast.success("Invitation envoyée !");
      setInvitations([result.data, ...invitations]);
      setInviteEmail('');
      setInviteRole('MEMBER');
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Une erreur est survenue.");
    } finally {
      setIsInviting(false);
    }
  };

  // Gérer la suppression d'un membre
  const handleRemoveMember = async (memberUserId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir retirer ce membre de l'équipe ?") || activeContext?.type !== 'team') return;
    
    const originalMembers = [...members];
    setMembers(members.filter(m => m.user.id !== memberUserId));
    const toastId = toast.loading("Suppression du membre...");

    try {
        const res = await fetch(`/api/v1/teams/${activeContext.id}/members/${memberUserId}`, { method: 'DELETE' });
        if(!res.ok) throw new Error("Échec de la suppression.");
        toast.dismiss(toastId);
        toast.success("Membre retiré de l'équipe.");
    } catch (error) {
        toast.dismiss(toastId);
        toast.error("Impossible de retirer le membre.");
        setMembers(originalMembers);
    }
  };
  
  // Gérer l'annulation d'une invitation
  const handleCancelInvitation = async (invitationId: number) => {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette invitation ?") || activeContext?.type !== 'team') return;

    const originalInvitations = [...invitations];
    setInvitations(invitations.filter(i => i.id !== invitationId));
    const toastId = toast.loading("Annulation de l'invitation...");

    try {
        const res = await fetch(`/api/v1/teams/${activeContext.id}/invitations/${invitationId}`, { method: 'DELETE' });
        if(!res.ok) throw new Error("Échec de l'annulation.");
        toast.dismiss(toastId);
        toast.success("Invitation annulée.");
    } catch (error) {
        toast.dismiss(toastId);
        toast.error("Impossible d'annuler l'invitation.");
        setInvitations(originalInvitations);
    }
  };

  // Affiche un état de chargement global pour la page
  if (isWorkspaceLoading) {
      return <div><SkeletonLoader className="h-96 w-full" /></div>
  }

  // Vérifier si l'utilisateur a un rôle entreprise ou admin
  const hasEnterpriseAccess = session?.user?.role ? ['ENTERPRISE', 'ADMIN'].includes(session.user.role) : false;
  
  // Si l'utilisateur n'a pas accès aux fonctionnalités entreprise
  if (!hasEnterpriseAccess) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Users className="mr-3"/> Gestion d'Équipe
        </h1>
        <LockedFeature 
  featureName="Gestion des Équipes" 
  requiredPlan="Entreprise"
  description={`Votre plan actuel (${session?.user?.role || 'FREE'}) ne donne pas accès à cette fonctionnalité.`}
/>    </div>
    );
  }
  
  // Si l'utilisateur a accès mais n'a pas encore créé ou rejoint d'équipe
  if (activeContext?.type !== 'team') {
    return (
      <div className="animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Users className="mr-3"/> Gestion d'Équipe
        </h1>
        <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Aucune équipe active</h2>
          <p className="mb-4">
            Vous n'avez pas encore créé ou rejoint d'équipe. Créez une nouvelle équipe ou acceptez une invitation existante.
          </p>
          <button 
            onClick={() => window.location.href = '/dashboard/settings/teams'}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Gérer les équipes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-800">Gestion de l'Équipe ({activeContext?.name})</h1>

      {isTeamAdmin && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Inviter un nouveau membre</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row sm:items-end sm:space-x-4">
            <div className="flex-1">
              <label htmlFor="email" className="text-sm font-medium">Adresse e-mail</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required placeholder="collegue@exemple.com" className="w-full p-2 border rounded mt-1"/>
            </div>
            <div className="mt-4 sm:mt-0">
              <label htmlFor="role" className="text-sm font-medium">Rôle</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full p-2 border rounded mt-1 h-10">
                <option value="MEMBER">Membre</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button type="submit" disabled={isInviting} className="mt-4 sm:mt-0 px-6 py-2 bg-indigo-600 text-white rounded h-10 flex items-center justify-center disabled:bg-indigo-400">
              {isInviting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><UserPlus className="w-4 h-4 mr-2" /> Inviter</>}
            </button>
          </form>
        </div>
      )}

      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Membres de l'équipe ({members.length})</h2>
        {isLoading ? <SkeletonLoader className="h-24"/> : (
          <ul className="divide-y divide-gray-200">
            {members.map(member => (
              <li key={member.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{member.user.username || member.user.email}</p>
                  <p className="text-sm text-gray-500">{member.user.email}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-full flex items-center">
                    <Shield className="w-3 h-3 mr-1.5" /> {member.role}
                  </span>
                  {isTeamAdmin && member.role !== 'OWNER' && (
                    <button onClick={() => handleRemoveMember(member.user.id)} title="Retirer le membre" className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors">
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isTeamAdmin && (
        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Invitations en attente ({invitations.length})</h2>
          {isLoading ? <SkeletonLoader className="h-24"/> : invitations.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {invitations.map(inv => (
                <li key={inv.id} className="py-3 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-400"/>
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-sm text-gray-500">Rôle : {inv.role}</p>
                    </div>
                  </div>
                  <button onClick={() => handleCancelInvitation(inv.id)} title="Annuler l'invitation" className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100 transition-colors">
                    <Trash2 className="w-5 h-5"/>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">Aucune invitation en attente.</p>}
        </div>
      )}
    </div>
  );
}