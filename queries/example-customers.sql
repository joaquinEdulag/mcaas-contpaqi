-- PLANTILLA DE EJEMPLO. NO habilitar hasta adaptar nombres reales.
-- Convención del motor genérico:
--   1er ? = cursor actual
--   2do ? = tamaño del lote
-- El cursor debe ser monotónico y único para evitar omisiones.
SELECT
  id AS id,
  codigo AS code,
  nombre AS name,
  fecha_modificacion AS updatedAt
FROM REPLACE_WITH_REAL_CUSTOMER_TABLE
WHERE id > ?
ORDER BY id ASC
LIMIT ?
