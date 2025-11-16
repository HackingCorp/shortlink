import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  env: {
    // Variables exposées côté client
    S3P_BASE_URL: process.env.S3P_BASE_URL,
    // Ajoutez ici d'autres variables nécessaires côté client
  },
  publicRuntimeConfig: {
    // Variables accessibles côté client ET serveur
  },
  serverRuntimeConfig: {
    // Variables accessibles uniquement côté serveur
    S3P_ACCESS_TOKEN: process.env.S3P_ACCESS_TOKEN,
    S3P_ACCESS_SECRET: process.env.S3P_ACCESS_SECRET,
  },
  webpack: (config) => {
    return config;
  }
};

export default nextConfig; // C'est ici que module.exports devient export default