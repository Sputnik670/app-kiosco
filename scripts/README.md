# Scripts de Utilidad

## generate-types.js

Genera tipos TypeScript automáticamente desde Supabase.

### Método 1: Usando Access Token (Recomendado)

1. **Obtén tu Access Token:**
   - Ve a https://app.supabase.com
   - Ve a tu proyecto → Settings → Access Tokens
   - Haz clic en "Generate new token"
   - Copia el token (⚠️ guárdalo en un lugar seguro)

2. **Ejecuta el script:**

   **Windows (PowerShell):**
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN="tu_token_aqui"
   npm run generate-types
   ```

   **Mac/Linux:**
   ```bash
   SUPABASE_ACCESS_TOKEN=tu_token_aqui npm run generate-types
   ```

### Método 2: Usando Supabase CLI

Si prefieres usar el CLI de Supabase:

1. **Autentícate:**
   ```bash
   npm run generate-types:cli
   # O manualmente:
   npx supabase login
   ```

2. **Genera los tipos:**
   ```bash
   npm run generate-types:cli
   ```

### Nota

⚠️ **IMPORTANTE:** No subas tu Access Token al repositorio. Úsalo solo localmente como variable de entorno.

