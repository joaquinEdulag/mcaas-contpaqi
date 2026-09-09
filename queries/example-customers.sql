SELECT
    id AS id,
    nombre AS nombre,
    updatedAt AS updatedAt
FROM prueba_mcaas
WHERE id > ?
ORDER BY id ASC
LIMIT ?