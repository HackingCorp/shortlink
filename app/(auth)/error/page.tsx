'use client';

export default function AuthError() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-red-600">Erreur d'authentification</h1>
          <p className="mt-2 text-gray-600">
            Une erreur est survenue lors de la tentative de connexion. Veuillez réessayer.
          </p>
          <div className="mt-6">
            <a 
              href="/login" 
              className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Retour à la page de connexion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
