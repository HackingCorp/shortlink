-- Vérifier si la table 'clicks' existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'clicks'
) as clicks_table_exists;

-- Compter le nombre d'entrées dans la table 'clicks'
SELECT COUNT(*) as click_count FROM clicks;

-- Vérifier si la table 'links' existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'links'
) as links_table_exists;

-- Compter le nombre d'entrées dans la table 'links'
SELECT COUNT(*) as link_count FROM links;

-- Vérifier la structure de la table 'clicks'
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clicks';

-- Vérifier la structure de la table 'links'
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'links';
