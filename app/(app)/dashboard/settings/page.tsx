'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { KeyRound, ArrowUpCircle, UserCircle, Settings, Lock, Mail, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';


const profileSchema = z.object({
  username: z.string().min(3, { message: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' }),
  email: z.string().email({ message: 'Veuillez entrer une adresse email valide' }),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, { message: 'Le mot de passe actuel est requis' }),
  newPassword: z.string().min(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const userRole = session?.user?.role;
  
  // Initialisation des formulaires
  const { register: registerProfile, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors }, reset: resetProfile } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: session?.user?.name || '',
      email: session?.user?.email || ''
    }
  });
  
  const { register: registerPassword, handleSubmit: handlePasswordSubmit, formState: { errors: passwordErrors }, reset: resetPassword } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema)
  });
  
  useEffect(() => {
    if (session?.user) {
      resetProfile({
        username: session.user.name || '',
        email: session.user.email || ''
      });
    }
  }, [session, resetProfile]);
  
  const onSubmitProfile = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la mise à jour du profil');
      }
      
      // Mise à jour de la session
      await update({
        ...session,
        user: {
          ...session?.user,
          name: data.username,
          email: data.email
        }
      });
      
      toast.success('Profil mis à jour avec succès');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Gestion de la soumission du formulaire de mot de passe
  const onSubmitPassword = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors du changement de mot de passe');
      }
      
      toast.success('Mot de passe mis à jour avec succès');
      resetPassword();
      setIsEditingPassword(false);
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };
  
  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleUpgrade = async (targetRole: string) => {
      setIsUpgrading(true);
      const toastId = toast.loading("Mise à niveau de votre compte...");
      
      try {
          const res = await fetch('/api/v1/user/upgrade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetRole }),
          });
          const result = await res.json();
          toast.dismiss(toastId);
          
          if (!result.success) throw new Error(result.error);
          
          toast.success("Compte mis à niveau avec succès !");
          // Force la mise à jour de la session NextAuth pour refléter le nouveau rôle
          await update({ role: targetRole }); 
      } catch (err: any) {
          toast.dismiss(toastId);
          toast.error(err.message || "Erreur lors de la mise à niveau.");
      } finally {
          setIsUpgrading(false);
      }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-800 flex items-center">
        <Settings className="w-8 h-8 mr-3 text-gray-500" />
        Paramètres du compte
      </h1>
      <p className="text-gray-600 mt-2">Gérez vos informations de profil, votre abonnement et vos accès développeur.</p>

      <div className="mt-8 max-w-3xl space-y-8">
        {/* Section Profil */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center">
              <UserCircle className="w-6 h-6 mr-2 text-gray-400" />
              Profil
            </h2>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Modifier
              </button>
            ) : (
              <div className="space-x-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    resetProfile();
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  form="profile-form"
                  disabled={isLoading}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>
          
          <form id="profile-form" onSubmit={handleProfileSubmit(onSubmitProfile)} className="mt-4 space-y-4">
            <div>
              <label htmlFor="username" className="text-sm font-bold text-gray-600 block">
                Nom d'utilisateur
              </label>
              {isEditing ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    className="w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Votre nom d'utilisateur"
                    {...registerProfile('username')}
                  />
                </div>
              ) : (
                <div className="p-2 bg-gray-50 rounded-md">
                  <p className="text-gray-900">{session?.user?.username || 'Non défini'}</p>
                </div>
              )}
              {profileErrors.username && (
                <p className="mt-1 text-sm text-red-600">{profileErrors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-bold text-gray-600 block">
                Adresse e-mail
              </label>
              {isEditing ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    className="w-full pl-10 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="votre@email.com"
                    {...registerProfile('email')}
                    disabled={!isEditing}
                  />
                </div>
              ) : (
                <div className="p-2 bg-gray-50 rounded-md">
                  <p className="text-gray-900">{session?.user?.email || 'Non défini'}</p>
                </div>
              )}
              {profileErrors.email && (
                <p className="mt-1 text-sm text-red-600">{profileErrors.email.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {isEditing 
                  ? 'Un email de confirmation sera envoyé après modification.'
                  : 'Contactez le support pour modifier votre adresse email.'}
              </p>
            </div>
          </form>
        </div>
        
        {/* Section Mot de passe */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center">
              <Lock className="w-6 h-6 mr-2 text-gray-400" />
              Sécurité
            </h2>
            {!isEditingPassword ? (
              <button 
                onClick={() => setIsEditingPassword(true)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Modifier le mot de passe
              </button>
            ) : (
              <div className="space-x-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsEditingPassword(false);
                    resetPassword();
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  form="password-form"
                  disabled={isLoading}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            )}
          </div>
          
          {isEditingPassword ? (
            <form id="password-form" onSubmit={handlePasswordSubmit(onSubmitPassword)} className="mt-4 space-y-4">
              <div>
                <label htmlFor="currentPassword" className="text-sm font-bold text-gray-600 block">
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="currentPassword"
                    type={showPassword.current ? "text" : "password"}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                    {...registerPassword('currentPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword.current ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="newPassword" className="text-sm font-bold text-gray-600 block">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="newPassword"
                    type={showPassword.new ? "text" : "password"}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                    {...registerPassword('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword.new ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Le mot de passe doit contenir au moins 8 caractères</p>
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="text-sm font-bold text-gray-600 block">
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showPassword.confirm ? "text" : "password"}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                    {...registerPassword('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword.confirm ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword.message}</p>
                )}
              </div>
            </form>
          ) : (
            <div className="mt-4">
              <p className="text-gray-600">Dernière mise à jour du mot de passe : </p>
              <p className="text-sm text-gray-500">
              {session?.user && 'passwordUpdatedAt' in session.user 
              ? new Date(String(session.user.passwordUpdatedAt)).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              : 'Date inconnue'}
              </p>
            </div>
          )}
        </div>
        
        {/* Section Abonnement */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold">Votre Abonnement</h2>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-4 sm:mb-0">
                  <p className="text-gray-600">Plan actuel</p>
                  <p className="text-2xl font-bold text-indigo-600 capitalize">{userRole?.toLowerCase()}</p>
              </div>
              {userRole !== 'ENTERPRISE' && (
                  <button 
                      onClick={() => handleUpgrade('ENTERPRISE')} 
                      disabled={isUpgrading}
                      className="flex items-center justify-center px-4 py-2 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors disabled:bg-green-300"
                  >
                      {isUpgrading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                          <>
                              <ArrowUpCircle className="w-5 h-5 mr-2" />
                              Passer au plan Entreprise
                          </>
                      )}
                  </button>
              )}
          </div>
        </div>
        
        {/* Section Développeurs, visible uniquement pour les comptes Entreprise */}
        {userRole === 'ENTERPRISE' && (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">Développeurs</h2>
                <p className="mt-2 text-gray-600">Générez et gérez vos clés d'API pour intégrer Shorty à vos applications.</p>
                <Link href="/dashboard/settings/api-keys" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                    <KeyRound className="w-5 h-5 mr-2" />
                    Gérer les clés d'API
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}