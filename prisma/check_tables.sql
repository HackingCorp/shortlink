-- Vérifier les tables existantes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Vérifier la structure de la table links
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'links';

-- Vérifier la structure de la table clicks
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clicks';

-- Vérifier la structure de la table users
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users';
