-- CONTPAQi Nóminas - Catálogo de empleados (dbo.nom10001)
-- @cursor y @batchSize son enviados automáticamente por el puente.
-- IdEmpleado se utiliza solo como cursor técnico; el vínculo de negocio es CodigoEmpleado.

SELECT TOP (@batchSize)
    e.IdEmpleado AS cursor_id,
    e.IdDepartamento AS contpaqi_id_departamento,
    e.IdPuesto AS contpaqi_id_puesto,

    UPPER(LTRIM(RTRIM(CONVERT(varchar(100), e.CodigoEmpleado)))) AS numero_empleado,

    NULLIF(LTRIM(RTRIM(e.Nombre)), '') AS nombre,
    NULLIF(LTRIM(RTRIM(e.ApellidoPaterno)), '') AS apellido_paterno,
    NULLIF(LTRIM(RTRIM(e.ApellidoMaterno)), '') AS apellido_materno,
    LTRIM(RTRIM(e.NombreLargo)) AS nombre_completo,

    NULLIF(LTRIM(RTRIM(e.LugarNacimiento)), '') AS lugar_nacimiento,
    NULLIF(LTRIM(RTRIM(e.EstadoCivil)), '') AS estado_civil,
    NULLIF(LTRIM(RTRIM(e.Sexo)), '') AS sexo,
    NULLIF(LTRIM(RTRIM(e.NumeroSeguroSocial)), '') AS nss,
    NULLIF(LTRIM(RTRIM(e.CodigoPostal)), '') AS codigo_postal,
    NULLIF(LTRIM(RTRIM(e.Direccion)), '') AS direccion,
    NULLIF(LTRIM(RTRIM(e.Poblacion)), '') AS localidad,
    NULLIF(LTRIM(RTRIM(e.Estado)), '') AS estado_residencia,
    NULLIF(LTRIM(RTRIM(e.CausaBaja)), '') AS causa_baja,
    NULLIF(LOWER(LTRIM(RTRIM(e.CorreoElectronico))), '') AS correo_electronico

FROM dbo.nom10001 AS e
WHERE e.IdEmpleado > @cursor
ORDER BY e.IdEmpleado ASC;
