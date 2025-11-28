'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Copy, Link as LinkIcon, Zap } from 'lucide-react';

export default function HomePage() {
  const [longUrl, setLongUrl] = useState('');
  const [shortLink, setShortLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setShortLink('');

    // Validation basique de l'URL
    try {
      new URL(longUrl);
    } catch (err) {
      setError('Veuillez entrer une URL valide (commençant par http:// ou https://)');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/v1/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longUrl }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || 
          `Erreur du serveur (${response.status}): ${response.statusText}`
        );
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la création du lien');
      }
      
      // Utiliser directement le short_code de la réponse
      const shortCode = result.data?.short_code || result.data?.shortCode;
      if (!shortCode) {
        console.error('Réponse API inattendue:', result);
        throw new Error('Format de réponse inattendu de l\'API');
      }
      
      setShortLink(`${window.location.origin}/${shortCode}`);
    } catch (err: any) {
      console.error('Erreur lors de la création du lien:', err);
      setError(err.message || 'Une erreur est survenue lors de la création du lien');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shortLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInNewTab = () => {
    setIsOpening(true);
    window.open(shortLink, '_blank');
    setTimeout(() => setIsOpening(false), 1000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-indigo-50">
      <header className="p-4 flex justify-between items-center bg-white shadow-sm">
        <Link href="/" className="flex items-center">
          <Zap className="h-6 w-6 text-indigo-600 mr-2" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">kut.es</h1>
        </Link>
        <div className="flex items-center space-x-4">
          <Link 
            href="/login" 
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border-2 border-indigo-100 rounded-lg hover:border-indigo-200 transition-colors"
          >
            Se connecter
          </Link>
          <Link 
            href="/register" 
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 shadow-md transition-all"
          >
            S'inscrire
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6">
              Des liens plus courts, des <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">idées plus grandes</span>.
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
              Transformez vos URLs longues en liens courts, mémorables et traçables. Gratuitement et instantanément.
            </p>

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={longUrl}
                    onChange={(e) => setLongUrl(e.target.value)}
                    placeholder="Collez votre URL ici..."
                    required
                    className="block w-full pl-10 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-4 text-lg font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-70"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Zap className="w-5 h-5 mr-2" />
                      Raccourcir
                    </span>
                  )}
                </button>
              </div>
              {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
            </form>

            {shortLink && (
              <div className="mt-6 p-4 bg-white rounded-xl shadow-md max-w-2xl mx-auto animate-fade-in">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="font-mono text-indigo-800 overflow-x-auto max-w-[80%]">
                      {shortLink}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="Copier le lien"
                      >
                        <Copy className="w-4 h-4 mr-1.5" />
                        {copied ? 'Copié !' : 'Copier'}
                      </button>
                      <button
                        onClick={handleOpenInNewTab}
                        disabled={isOpening}
                        className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-70"
                        title="Ouvrir dans un nouvel onglet"
                      >
                        {isOpening ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                        ) : (
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        )}
                        {isOpening ? 'Ouverture...' : 'Ouvrir'}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Cliquez sur "Ouvrir" pour accéder directement au site, ou copiez le lien pour le partager.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full mb-3">Simple et efficace</span>
              <h2 className="text-3xl font-bold mb-4">Comment ça marche ?</h2>
              <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-indigo-600">1</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Collez votre lien</h3>
                <p className="text-gray-600">Copiez et collez n'importe quelle URL longue dans le champ ci-dessus.</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-indigo-600">2</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Cliquez sur Raccourcir</h3>
                <p className="text-gray-600">Notre système génère instantanément un lien court et unique.</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-gray-50 hover:shadow-md transition-shadow">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-indigo-600">3</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Partagez</h3>
                <p className="text-gray-600">Copiez et partagez votre nouveau lien court partout.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Fonctionnalités Premium */}
        <section className="py-16 bg-gradient-to-br from-indigo-50 to-purple-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full mb-3">Fonctionnalités premium</span>
              <h2 className="text-3xl font-bold mb-4">Passez à la vitesse supérieure</h2>
              <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto mb-4 rounded-full"></div>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Créez un compte gratuitement pour débloquer des fonctionnalités avancées
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  icon: '📊', 
                  title: 'Analytiques avancées', 
                  desc: 'Suivez en temps réel les clics, la géolocalisation et les appareils utilisés pour accéder à vos liens.' 
                },
                { 
                  icon: '🔗', 
                  title: 'Liens personnalisés', 
                  desc: 'Créez des liens courts personnalisés avec votre propre nom de marque ou mot-clé.' 
                },
                { 
                  icon: '📱', 
                  title: 'QR Codes', 
                  desc: 'Générez des codes QR pour vos liens courts et suivez leur utilisation.' 
                },
                { 
                  icon: '🛡️', 
                  title: 'Sécurité avancée', 
                  desc: 'Protégez vos liens par mot de passe ou définissez des dates d\'expiration.' 
                },
                { 
                  icon: '🌍', 
                  title: 'Géociblage', 
                  desc: 'Redirigez les utilisateurs vers différentes URLs en fonction de leur localisation.' 
                },
                { 
                  icon: '📈', 
                  title: 'Rapports détaillés', 
                  desc: 'Exportez vos statistiques au format CSV ou PDF pour une analyse approfondie.' 
                },
                { 
                  icon: '🔄', 
                  title: 'Redirections multiples', 
                  desc: 'Créez des liens qui redirigent vers différentes URLs en fonction de règles personnalisées.' 
                },
                { 
                  icon: '🔔', 
                  title: 'Notifications', 
                  desc: 'Recevez des alertes par email lorsque vos liens atteignent certains seuils d\'utilisation.' 
                }
              ].map((feature, index) => (
                <div key={index} className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl flex items-center justify-center text-3xl mb-4 mx-auto transition-transform group-hover:scale-110">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-center text-gray-800">{feature.title}</h3>
                  <p className="text-gray-600 text-center text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center relative">
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-full shadow-xl">
                <Zap className="w-8 h-8 text-indigo-600" />
              </div>
              <div className="bg-white p-8 pt-16 rounded-2xl shadow-lg max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Prêt à booster votre productivité ?</h3>
                <p className="text-gray-600 mb-8 max-w-lg mx-auto">
                  Rejoignez des milliers d'utilisateurs qui optimisent déjà leur partage de liens avec notre plateforme. C'est rapide, sécurisé et totalement gratuit !
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Link 
                    href="/register" 
                    className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg transform hover:-translate-y-0.5 transition-all"
                  >
                    Commencer gratuitement
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                  <Link 
                    href="/features" 
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    En savoir plus
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                <p className="text-xs text-gray-500 mt-4">Aucune carte de crédit requise • Essai de 14 jours</p>
              </div>
            </div>
          </div>
        </section>
      </main>

        {/* Témoignages */}
        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="inline-block px-3 py-1 text-sm font-semibold text-indigo-700 bg-indigo-100 rounded-full mb-3">Ils nous font confiance</span>
              <h2 className="text-3xl font-bold mb-4">Ce que disent nos utilisateurs</h2>
              <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full mb-8"></div>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "La meilleure solution de raccourcissement d'URL que j'ai utilisée. L'interface est intuitive et les statistiques sont précieuses.",
                  author: "Marie D.",
                  role: "Responsable Marketing"
                },
                {
                  quote: "Idéal pour nos campagnes sur les réseaux sociaux. Le suivi des clics nous aide à mesurer le ROI de nos actions.",
                  author: "Thomas L.",
                  role: "Community Manager"
                },
                {
                  quote: "La création de liens personnalisés a considérablement amélioré notre taux de clics. Un outil indispensable !",
                  author: "Sophie M.",
                  role: "Chargée de communication"
                }
              ].map((testimonial, index) => (
                <div key={index} className="bg-gray-50 p-6 rounded-xl hover:shadow-md transition-shadow">
                  <div className="text-indigo-400 text-4xl mb-4">"</div>
                  <p className="text-gray-700 italic mb-6">{testimonial.quote}</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold mr-3">
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{testimonial.author}</p>
                      <p className="text-sm text-gray-600">{testimonial.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Questions fréquentes</h2>
              <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full mb-8"></div>
            </div>
            <div className="space-y-6">
              {[
                {
                  question: "Est-ce vraiment gratuit ?",
                  answer: "Oui, notre service de base est totalement gratuit. Vous pouvez créer des liens courts et les partager sans aucune limite. Nous proposons également des fonctionnalités avancées avec nos abonnements premium."
                },
                {
                  question: "Comment fonctionne le suivi des clics ?",
                  answer: "Chaque fois que quelqu'un clique sur votre lien court, nous enregistrons des informations anonymisées comme la date, l'heure, le pays et le type d'appareil. Vous pouvez consulter ces statistiques dans votre tableau de bord."
                },
                {
                  question: "Puis-je personnaliser mes liens courts ?",
                  answer: "Avec un compte gratuit, vous pouvez personnaliser la fin de vos liens. Les utilisateurs premium peuvent personnaliser complètement leurs URLs courtes."
                },
                {
                  question: "Quelle est la durée de vie d'un lien court ?",
                  answer: "Vos liens courts restent actifs indéfiniment. Cependant, vous pouvez définir une date d'expiration si vous le souhaitez, ou supprimer manuellement un lien à tout moment."
                }
              ].map((faq, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold text-indigo-800 mb-2">{faq.question}</h3>
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <footer className="py-12 bg-gray-900 text-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">kut.es</h3>
                <p className="text-gray-400">La solution tout-en-un pour raccourcir, personnaliser et suivre vos liens.</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Produit</h4>
                <ul className="space-y-2">
                  <li><a href="/features" className="text-gray-400 hover:text-white transition-colors">Fonctionnalités</a></li>
                  <li><a href="/pricing" className="text-gray-400 hover:text-white transition-colors">Tarifs</a></li>
                  <li><a href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Ressources</h4>
                <ul className="space-y-2">
                  <li><a href="/documentation" className="text-gray-400 hover:text-white transition-colors">Documentation</a></li>
                  <li><a href="/api" className="text-gray-400 hover:text-white transition-colors">API</a></li>
                  <li><a href="/support" className="text-gray-400 hover:text-white transition-colors">Support</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Entreprise</h4>
                <ul className="space-y-2">
                  <li><a href="/about" className="text-gray-400 hover:text-white transition-colors">À propos</a></li>
                  <li><a href="/careers" className="text-gray-400 hover:text-white transition-colors">Carrières</a></li>
                  <li><a href="/contact" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8">
              <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="flex items-center justify-center md:justify-start mb-4 md:mb-0">
                  <Zap className="h-5 w-5 text-indigo-400 mr-2" />
                  <span className="text-lg font-bold text-white">kut.es</span>
                </div>
                <div className="flex space-x-6">
                  <a href="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">Confidentialité</a>
                  <a href="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">Conditions d'utilisation</a>
                  <a href="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">Contact</a>
                </div>
              </div>
              <div className="mt-4 text-center text-sm text-gray-400">
                &copy; {new Date().getFullYear()} kut.es. Tous droits réservés.
              </div>
            </div>
          </div>
        </footer>
    </div>
  );
}