# Servidor MCP de Supabase

Este directorio contiene el servidor MCP (Model Context Protocol) para Supabase, que permite a Claude Code interactuar directamente con tu base de datos de Supabase.

## Configuración

### 1. Variables de Entorno

Asegúrate de tener un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
```

### 2. Activar el Servidor MCP

El servidor MCP está configurado en `.mcp.json`. Claude Code lo activará automáticamente cuando necesite interactuar con Supabase.

Para aprobar el servidor MCP:
1. Reinicia tu sesión de Claude Code
2. Cuando se te pregunte si quieres activar el servidor MCP de Supabase, selecciona "Yes"
3. O configura `enableAllProjectMcpServers: true` en `.claude/settings.local.json`

## Herramientas Disponibles

### query_table
Consulta datos de una tabla en Supabase.

**Parámetros:**
- `table` (requerido): Nombre de la tabla
- `columns` (opcional): Columnas a seleccionar, por defecto "*"
- `filters` (opcional): Objeto con filtros (ej: `{"status": "active"}`)
- `limit` (opcional): Límite de registros, por defecto 100

**Ejemplo:**
```javascript
{
  "table": "usuarios",
  "columns": "id,nombre,email",
  "filters": {"activo": true},
  "limit": 50
}
```

### insert_row
Inserta un nuevo registro en una tabla.

**Parámetros:**
- `table` (requerido): Nombre de la tabla
- `data` (requerido): Objeto con los datos a insertar

**Ejemplo:**
```javascript
{
  "table": "usuarios",
  "data": {
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  }
}
```

### update_row
Actualiza registros existentes en una tabla.

**Parámetros:**
- `table` (requerido): Nombre de la tabla
- `filters` (requerido): Filtros para identificar qué registros actualizar
- `data` (requerido): Datos a actualizar

**Ejemplo:**
```javascript
{
  "table": "usuarios",
  "filters": {"id": "123"},
  "data": {"activo": false}
}
```

### delete_row
Elimina registros de una tabla.

**Parámetros:**
- `table` (requerido): Nombre de la tabla
- `filters` (requerido): Filtros para identificar qué registros eliminar

**Ejemplo:**
```javascript
{
  "table": "usuarios",
  "filters": {"id": "123"}
}
```

### execute_rpc
Ejecuta una función RPC (procedimiento almacenado) en Supabase.

**Parámetros:**
- `function_name` (requerido): Nombre de la función RPC
- `params` (opcional): Parámetros de la función

**Ejemplo:**
```javascript
{
  "function_name": "calcular_total_ventas",
  "params": {"mes": 12, "año": 2024}
}
```

### list_tables
Lista todas las tablas disponibles en la base de datos.

**Parámetros:** Ninguno

### get_table_schema
Obtiene el esquema de una tabla específica.

**Parámetros:**
- `table` (requerido): Nombre de la tabla

## Uso con Claude Code

Una vez configurado, puedes pedirle a Claude Code que interactúe con tu base de datos:

- "Muéstrame todos los usuarios activos"
- "Inserta un nuevo producto con nombre 'Laptop' y precio 1500"
- "Actualiza el estado del pedido 123 a 'completado'"
- "Cuéntame sobre la estructura de la tabla 'productos'"

Claude Code usará automáticamente el servidor MCP de Supabase para ejecutar estas operaciones.

## Solución de Problemas

### El servidor no se inicia
1. Verifica que las variables de entorno estén configuradas correctamente
2. Asegúrate de que las dependencias estén instaladas: `npm install`
3. Verifica los logs del servidor en la consola de Claude Code

### No se encuentran las tablas
El servidor usa la key anónima de Supabase, que puede tener restricciones de acceso. Asegúrate de que las políticas RLS (Row Level Security) permitan el acceso a las tablas que necesitas consultar.

### Errores de permisos
Verifica que la clave anónima de Supabase tenga los permisos necesarios en tu proyecto. Puedes revisar las políticas de seguridad en el dashboard de Supabase.
