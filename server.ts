import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { paymentVerificationJob } from './lib/cron/paymentVerificationJob.ts';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



// Configuration du service de vérification des paiements
const setupPaymentVerification = () => {
  if (process.env.DISABLE_PAYMENT_VERIFICATION === 'true') {
    console.log('Vérification des paiements désactivée (DISABLE_PAYMENT_VERIFICATION=true)');
    return;
  }

  const cronExpression = process.env.NODE_ENV === 'production' 
    ? '*/5 * * * *'  // Toutes les 5 minutes en production
    : '*/10 * * * *'; // Toutes les 10 minutes en développement

  console.log(`Démarrage du service de vérification des paiements (${cronExpression})...`);
  
  try {
    paymentVerificationJob.start(cronExpression);
    
    // Gestion des arrêts propres
    const stopJob = () => {
      console.log('Arrêt du service de vérification des paiements...');
      paymentVerificationJob.stop();
    };
    
    process.on('SIGINT', stopJob);
    process.on('SIGTERM', stopJob);
    
  } catch (error) {
    console.error('Erreur lors du démarrage du service de vérification des paiements:', error);
  }
};

// Démarrer le service de vérification des paiements
setupPaymentVerification();

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const { pathname, query } = parsedUrl

      if (pathname === '/a') {
        await app.render(req, res, '/a', query)
      } else if (pathname === '/b') {
        await app.render(req, res, '/b', query)
      } else {
        await handle(req, res, parsedUrl)
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})