import { PrismaClient } from '@prisma/client';

// On déclare une variable globale pour stocker l'instance de Prisma.
// Ceci est nécessaire car en développement, Next.js efface le cache des modules à chaque
// rechargement à chaud (hot-reloading), ce qui créerait une nouvelle instance de PrismaClient
// à chaque modification de code, saturant ainsi la base de données de connexions.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// On crée l'instance du client Prisma avec des logs détaillés
const prisma = global.prisma || new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
    { level: 'info', emit: 'stdout' },
  ],
});

// Écoute des événements de requête pour le débogage
prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});

export { prisma };

// En développement, on attache l'instance nouvellement créée à l'objet global.
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// On exporte l'instance unique du client Prisma pour qu'elle puisse être importée
// et utilisée n'importe où dans notre application (API routes, getServerSideProps, etc.).
export default prisma;