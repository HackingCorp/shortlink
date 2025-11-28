import NextAuth, { type NextAuthOptions, type DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';



// Configuration des options d'authentification
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma as any),

  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: "Email ou Nom d'utilisateur", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials.password) {
          throw new Error("L'identifiant et le mot de passe sont requis.");
        }
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.identifier.toLowerCase() },
              { username: credentials.identifier },
            ],
          },
        });

        if (!user) throw new Error("Aucun utilisateur trouvé.");
        if (!user.emailVerified) throw new Error("Veuillez d'abord vérifier votre adresse e-mail.");

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) throw new Error("Mot de passe incorrect.");

        return {
          id: user.id.toString(),
          name: user.username,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/(auth)/login',
    error: '/(auth)/error', // Page pour afficher les erreurs
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Mise à jour du token avec les données de l'utilisateur lors de la connexion
      if (user) {
        token.id = user.id;
        token.role = (user as any).role as UserRole;
        
        // Récupérer les informations d'abonnement de l'utilisateur
        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          select: { planExpiresAt: true }
        });
        
        if (userData?.planExpiresAt) {
          token.planExpiresAt = userData.planExpiresAt.toISOString();
        }
      }
      
      // Mise à jour du token si la session est mise à jour
      if (trigger === 'update' && session?.user) {
        token.role = session.user.role as UserRole;
        if (session.user.planExpiresAt) {
          token.planExpiresAt = session.user.planExpiresAt;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (token.planExpiresAt) {
          session.user.planExpiresAt = token.planExpiresAt as string;
        }
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

// 2. C'est ici que la syntaxe change
// Au lieu d'un export par défaut, on initialise NextAuth dans une variable
const handler = NextAuth(authOptions);

// 3. On exporte ensuite cette variable pour les méthodes GET et POST
// C'est ce que le App Router attend.
export { handler as GET, handler as POST };