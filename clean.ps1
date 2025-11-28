# Script de nettoyage pour Windows PowerShell

# Fonction pour supprimer un dossier s'il existe
function Remove-FolderIfExists {
    param ([string]$folder)
    
    if (Test-Path $folder) {
        Write-Host "Suppression de $folder..."
        Remove-Item -Path $folder -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "$folder n'existe pas, passage au suivant..."
    }
}

# Nettoyage des dossiers et fichiers
Write-Host "Début du nettoyage..."

# Suppression des dossiers
Remove-FolderIfExists -folder "node_modules"
Remove-FolderIfExists -folder ".next"

# Suppression des fichiers de verrouillage
if (Test-Path "package-lock.json") {
    Remove-Item -Path "package-lock.json" -Force
    Write-Host "package-lock.json supprimé"
}

if (Test-Path "yarn.lock") {
    Remove-Item -Path "yarn.lock" -Force
    Write-Host "yarn.lock supprimé"
}

if (Test-Path ".pnp.cjs") {
    Remove-Item -Path ".pnp.cjs" -Force
    Write-Host ".pnp.cjs supprimé"
}

if (Test-Path ".pnp.loader.mjs") {
    Remove-Item -Path ".pnp.loader.mjs" -Force
    Write-Host ".pnp.loader.mjs supprimé"
}

Write-Host "Nettoyage terminé. Vous pouvez maintenant exécuter 'npm install' pour une installation propre."
