# Inicio Rápido - MCP de Supabase

## Configuración en 3 Pasos

### 1. Configurar Credenciales

Crea un archivo `.env` en la raíz del proyecto:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

**Obtén tus credenciales:**
1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Settings → API
4. Copia URL y anon key

### 2. Aprobar el Servidor MCP

**Primera vez:**
1. Reinicia Claude Code
2. Cuando aparezca el prompt, selecciona "Yes" o "Always"

**O configura auto-aprobación** en `.claude/settings.local.json`:

```json
{
  "enableAllProjectMcpServers": true
}
```

### 3. Empieza a Usar

Interactúa naturalmente con tu base de datos:

```
"Muéstrame todos los usuarios"
"¿Cuántas organizaciones hay?"
"Describe la tabla productos"
```

## Verificar que Funciona

Pregunta a Claude Code:
```
"¿Puedes listar las tablas de mi base de datos Supabase?"
```

Si ves una lista de tablas, ¡todo está funcionando! 🎉

## Herramientas Disponibles

- 📊 **query_table** - Consultar datos
- ➕ **insert_row** - Insertar registros
- ✏️ **update_row** - Actualizar registros
- 🗑️ **delete_row** - Eliminar registros
- 🔧 **execute_rpc** - Ejecutar funciones
- 📋 **list_tables** - Listar tablas
- 🔍 **get_table_schema** - Ver esquema

## Más Información

- Documentación completa: `.claude/MCP_SETUP.md`
- Detalles del servidor: `.claude/mcp-servers/README.md`
