SELECT
  tablename AS "Tabla",
  policyname AS "Nombre Politica",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS "Comando"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'perfiles')
ORDER BY tablename, policyname;
