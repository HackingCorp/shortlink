-- Vérifier si la table 'ApiKey' existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'ApiKey'
) as apikey_table_exists;

-- Afficher la structure de la table 'ApiKey'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ApiKey';

-- Compter le nombre de clés API
SELECT COUNT(*) as api_key_count FROM "ApiKey";

-- Afficher les premières clés API (sans afficher la clé complète pour des raisons de sécurité)
SELECT id, name, "createdAt", "userId" FROM "ApiKey" LIMIT 10;
