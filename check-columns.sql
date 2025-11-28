SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'User';

-- Vérifier spécifiquement la colonne emailNotifications
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'User' AND column_name = 'emailNotifications'
) AS has_email_notifications;
