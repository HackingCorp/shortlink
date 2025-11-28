import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Créer le dossier public/leaflet s'il n'existe pas
const leafletDir = path.join(__dirname, '../public/leaflet');
if (!fs.existsSync(leafletDir)) {
  fs.mkdirSync(leafletDir, { recursive: true });
}

// Copier les fichiers nécessaires de leaflet vers le dossier public
const filesToCopy = [
  'node_modules/leaflet/dist/leaflet.css',
  'node_modules/leaflet/dist/leaflet.js',
  'node_modules/leaflet/dist/images/layers.png',
  'node_modules/leaflet/dist/images/layers-2x.png',
  'node_modules/leaflet/dist/images/marker-icon.png',
  'node_modules/leaflet/dist/images/marker-icon-2x.png',
  'node_modules/leaflet/dist/images/marker-shadow.png'
];

filesToCopy.forEach(file => {
  const fileName = path.basename(file);
  const destFile = path.join(leafletDir, fileName);
  
  // Créer le sous-dossier images si nécessaire
  if (fileName.includes('/')) {
    const subDir = path.dirname(file);
    const destDir = path.join(leafletDir, subDir);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
  }
  
  // Copier le fichier s'il n'existe pas déjà ou s'il a été modifié
  if (fs.existsSync(file) && (!fs.existsSync(destFile) || 
      fs.statSync(file).mtime > fs.statSync(destFile).mtime)) {
    fs.copyFileSync(file, destFile);
    console.log(`Copied ${file} to ${destFile}`);
  }
});

console.log('Leaflet assets copied successfully!');
