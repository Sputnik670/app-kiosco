# Configuración del MCP de Supabase

## Paso 1: Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (si aún no existe) con tus credenciales de Supabase:

```bash
# Copia el archivo .env.example
cp .env.example .env
```

Luego edita el archivo `.env` y agrega tus credenciales reales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-aqui
```

### ¿Dónde encontrar estas credenciales?

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a Settings → API
4. Copia la URL del proyecto y la clave anon/public

## Paso 2: Aprobar el Servidor MCP

El servidor MCP está configurado en `.mcp.json`. Para usarlo:

### Opción A: Aprobar manualmente (recomendado para primera vez)
1. Reinicia Claude Code
2. Cuando se te pregunte sobre el servidor MCP de Supabase, selecciona "Yes" o "Always"

### Opción B: Auto-aprobar (para desarrollo)
Agrega esto a `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(git push:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ]
  },
  "enableAllProjectMcpServers": true
}
```

## Paso 3: Verificar la Instalación

Para verificar que todo funciona correctamente:

1. Abre una nueva sesión de Claude Code
2. Pregunta: "¿Puedes listar las tablas de la base de datos?"
3. Si el MCP está funcionando, Claude usará el servidor para consultar Supabase

## Ejemplos de Uso

Una vez configurado, puedes interactuar con tu base de datos naturalmente:

- "Muéstrame los primeros 10 usuarios"
- "¿Cuántos productos hay en la tabla productos?"
- "Inserta un nuevo registro en la tabla empleados"
- "Actualiza el estado del pedido con id 123"
- "Describe la estructura de la tabla organizaciones"

## Funcionalidades del MCP

El servidor MCP de Supabase proporciona las siguientes herramientas:

1. **query_table** - Consultar datos
2. **insert_row** - Insertar registros
3. **update_row** - Actualizar registros
4. **delete_row** - Eliminar registros
5. **execute_rpc** - Ejecutar funciones RPC
6. **list_tables** - Listar todas las tablas
7. **get_table_schema** - Obtener esquema de una tabla

## Solución de Problemas

### El servidor no inicia

**Síntoma:** Claude Code no puede conectar con el servidor MCP

**Solución:**
1. Verifica que el archivo `.env` existe y tiene las credenciales correctas
2. Ejecuta `npm install` para asegurar que todas las dependencias están instaladas
3. Verifica que `@modelcontextprotocol/sdk` está en `package.json`

### Errores de permisos

**Síntoma:** Error al consultar tablas: "permission denied" o similar

**Solución:**
1. Verifica las políticas RLS (Row Level Security) en Supabase
2. Para desarrollo, puedes temporalmente deshabilitar RLS en el dashboard de Supabase
3. O configura políticas que permitan acceso con la clave anónima

### No se encuentran tablas

**Síntoma:** El comando `list_tables` no retorna nada

**Solución:**
1. Verifica que tienes tablas en el esquema `public` de tu base de datos
2. Prueba consultar una tabla específica por nombre
3. Verifica que la URL de Supabase es correcta

## Seguridad

- El servidor MCP usa la clave **anónima** de Supabase
- Esta clave está diseñada para uso público y respeta las políticas RLS
- **Nunca** compartas tu archivo `.env` en el repositorio
- El archivo `.env` ya está en `.gitignore` para proteger tus credenciales

## Más Información

- Documentación del servidor: `.claude/mcp-servers/README.md`
- Documentación de Supabase: [https://supabase.com/docs](https://supabase.com/docs)
- Documentación MCP: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
