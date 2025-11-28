-- Vérifier la connexion et les tables
SELECT 'Connexion réussie' as status;

-- Vérifier la table des clics
SELECT 'Vérification de la table clicks' as check_table, 
       COUNT(*) as row_count 
FROM "Click";

-- Vérifier la table des utilisateurs
SELECT 'Vérification de la table users' as check_table, 
       COUNT(*) as row_count 
FROM "User";

-- Vérifier la table des liens
SELECT 'Vérification de la table links' as check_table, 
       COUNT(*) as row_count 
FROM "Link";
