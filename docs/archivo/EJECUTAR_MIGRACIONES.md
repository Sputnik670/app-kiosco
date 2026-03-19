# 🚀 GUÍA DE EJECUCIÓN DE MIGRACIONES - SaaS Kiosco

## ⚠️ IMPORTANTE: Leer antes de ejecutar

Esta guía te llevará paso a paso para preparar tu base de datos de Supabase para producción.

**SITUACIÓN ACTUAL**:
- BD de Supabase está **vacía**
- Todas las migraciones SQL están listas en `supabase/migrations/`
- Código TypeScript está listo
- **FALTA**: Ejecutar las migraciones en el orden correcto

---

## 📋 ORDEN DE EJECUCIÓN ESTRICTO

### Pre-requisitos

1. Abre Supabase Dashboard: https://supabase.com/dashboard
2. Ve a tu proyecto
3. Click en **SQL Editor** (ícono </> en el menú lateral)
4. Ten esta guía abierta en otra pestaña

### PASO 1: Schema Base (Owner-First Model)

#### Migración 1.1: Agregar owner_id a organizations
```bash
# Archivo: supabase/migrations/20260110_add_owner_id.sql
```

**ACCIÓN**:
1. Abre el archivo `supabase/migrations/20260110_add_owner_id.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor de Supabase
4. Click en **Run** (o presiona Ctrl+Enter)
5. ✅ Verifica que dice "Success" en verde

**QUÉ HACE**: Agrega la columna `owner_id` a la tabla `organizations` para vincular cada organización con su dueño.

---

#### Migración 1.2: Crear tabla user_organization_roles
```bash
# Archivo: supabase/migrations/20260111_create_user_org_roles.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260111_create_user_org_roles.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"

**QUÉ HACE**: Crea la tabla principal para el modelo multitenancy. Relaciona usuarios con organizaciones y roles.

---

### PASO 2: Funciones V2 (CRÍTICO)

#### Migración 2.1: Crear funciones V2
```bash
# Archivo: supabase/migrations/20260112_create_v2_functions.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260112_create_v2_functions.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"
6. ✅ Verifica que aparecen mensajes como "✓ Funciones V2 creadas"

**QUÉ HACE**: Crea TODAS las funciones críticas:
- `get_my_org_id_v2()` - Base de RLS
- `create_initial_setup_v2()` - Registro de nuevos dueños
- `invite_employee_v2()` - Invitación de empleados
- `complete_employee_setup_v2()` - Aceptación de invitaciones
- Y 6 funciones más

**⚠️ CRÍTICO**: Sin estas funciones, la app NO funcionará. Verifica que la ejecución fue exitosa.

---

### PASO 3: Limpieza Legacy (Opcional pero recomendado)

#### Migración 3.1: Sanitización completa
```bash
# Archivo: supabase/migrations/20260113_complete_sanitization.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260113_complete_sanitization.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"

---

#### Migración 3.2: Limpieza final
```bash
# Archivo: supabase/migrations/20260113_cleanup_legacy.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260113_cleanup_legacy.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"

---

### PASO 4: Tabla pending_invites

#### Migración 4.1: Crear pending_invites
```bash
# Archivo: supabase/migrations/20260121_create_missing_tables.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260121_create_missing_tables.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"
6. ✅ Verifica mensajes: "✓ Tabla pending_invites creada con éxito"

**QUÉ HACE**: Crea la tabla para almacenar invitaciones de empleados pendientes.

---

### PASO 5: Seguridad RLS (CRÍTICO)

#### Migración 5.1: Habilitar RLS en todas las tablas
```bash
# Archivo: supabase/migrations/20260120_enable_rls_all_tables.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260120_enable_rls_all_tables.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"
6. ✅ Verifica mensaje: "RLS habilitado en X tablas"

**QUÉ HACE**: Activa Row Level Security en 20+ tablas operacionales. **SIN ESTO, hay cross-tenant data leak**.

---

#### Migración 5.2: Crear políticas RLS
```bash
# Archivo: supabase/migrations/20260120_create_rls_policies.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260120_create_rls_policies.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"
6. ✅ Verifica mensajes de políticas creadas (80+ políticas)

**QUÉ HACE**: Crea TODAS las políticas de seguridad que garantizan que:
- Usuarios solo ven datos de su organización
- Owners pueden eliminar, employees no
- Ventas son inmutables (audit trail)

**⚠️ CRÍTICO**: Esta es la migración de seguridad más importante.

---

### PASO 6: Validaciones en Funciones RPC

#### Migración 6.1: Agregar validaciones de organization_id
```bash
# Archivo: supabase/migrations/20260120_add_org_validation_rpcs.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260120_add_org_validation_rpcs.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"

**QUÉ HACE**: Actualiza funciones críticas para validar que los recursos pertenecen a la organización correcta:
- `procesar_venta()` - Valida sucursal, caja, productos
- `verificar_stock_disponible()` - Valida producto y sucursal
- `incrementar_saldo_proveedor()` / `descontar_saldo_proveedor()` - Validan proveedor
- `calcular_horas_trabajadas()` - Filtra por org

---

### PASO 7: Estandarización de Roles

#### Migración 7.1: Consolidar funciones V1 → V2
```bash
# Archivo: supabase/migrations/20260120_standardize_roles.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260120_standardize_roles.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"

**QUÉ HACE**: Hace que las funciones legacy (V1) llamen automáticamente a las nuevas (V2). Garantiza compatibilidad.

---

### PASO 8: Performance (Índices)

#### Migración 8.1: Crear índices de performance
```bash
# Archivo: supabase/migrations/20260121_add_performance_indexes.sql
```

**ACCIÓN**:
1. Abre `supabase/migrations/20260121_add_performance_indexes.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor
4. Click en **Run**
5. ✅ Verifica "Success"
6. ✅ Verifica mensaje: "50+ índices creados"

**QUÉ HACE**: Crea 50+ índices para optimizar:
- Queries de RLS (filtrado por organization_id)
- Búsqueda por código de barras
- Consultas de stock disponible
- Vencimientos próximos
- Historial de ventas

---

## 🔍 VALIDACIÓN POST-MIGRACIÓN

### Test 1: Verificar funciones V2 existen

```sql
SELECT proname FROM pg_proc
WHERE proname IN ('get_my_org_id_v2', 'es_owner_v2', 'create_initial_setup_v2', 'invite_employee_v2')
AND prosecdef = true;
```

**ESPERADO**: Debe retornar 4 filas (las 4 funciones)

---

### Test 2: Verificar RLS está habilitado

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('productos', 'stock', 'ventas', 'sucursales', 'asistencia')
AND rowsecurity = false;
```

**ESPERADO**: Debe retornar **0 filas** (todas tienen RLS = true)

---

### Test 3: Contar políticas RLS

```sql
SELECT tablename, COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('productos', 'stock', 'ventas', 'pending_invites')
GROUP BY tablename
ORDER BY tablename;
```

**ESPERADO**:
- `pending_invites`: 5 políticas
- `productos`: 5 políticas
- `stock`: 5 políticas
- `ventas`: 5 políticas

---

### Test 4: Verificar tabla pending_invites existe

```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'pending_invites';
```

**ESPERADO**: Retorna `1`

---

### Test 5: Verificar organizations tiene owner_id

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name = 'owner_id';
```

**ESPERADO**: Retorna 1 fila con `owner_id | uuid`

---

## ✅ CHECKLIST FINAL

Marca cada paso a medida que lo completes:

- [ ] **PASO 1.1**: Ejecutada migración 20260110_add_owner_id.sql ✅
- [ ] **PASO 1.2**: Ejecutada migración 20260111_create_user_org_roles.sql ✅
- [ ] **PASO 2.1**: Ejecutada migración 20260112_create_v2_functions.sql ✅ (CRÍTICO)
- [ ] **PASO 3.1**: Ejecutada migración 20260113_complete_sanitization.sql ✅
- [ ] **PASO 3.2**: Ejecutada migración 20260113_cleanup_legacy.sql ✅
- [ ] **PASO 4.1**: Ejecutada migración 20260121_create_missing_tables.sql ✅
- [ ] **PASO 5.1**: Ejecutada migración 20260120_enable_rls_all_tables.sql ✅ (CRÍTICO)
- [ ] **PASO 5.2**: Ejecutada migración 20260120_create_rls_policies.sql ✅ (CRÍTICO)
- [ ] **PASO 6.1**: Ejecutada migración 20260120_add_org_validation_rpcs.sql ✅
- [ ] **PASO 7.1**: Ejecutada migración 20260120_standardize_roles.sql ✅
- [ ] **PASO 8.1**: Ejecutada migración 20260121_add_performance_indexes.sql ✅

**VALIDACIONES**:
- [ ] Test 1: Funciones V2 existen ✅
- [ ] Test 2: RLS habilitado (0 filas sin RLS) ✅
- [ ] Test 3: Políticas RLS creadas (5 por tabla) ✅
- [ ] Test 4: pending_invites existe ✅
- [ ] Test 5: organizations.owner_id existe ✅

---

## 🎉 ¡MIGRACIONES COMPLETADAS!

Si todos los tests pasaron, tu base de datos está **LISTA PARA PRODUCCIÓN**.

### Próximos pasos:

1. **Probar registro de usuario**:
   - Ir a tu app (localhost:3000 o Vercel)
   - Intentar registrarse como nuevo dueño
   - Debería llamar a `create_initial_setup_v2()`
   - Crear org + sucursal + perfil + rol

2. **Verificar dashboard funciona**:
   - Login exitoso
   - Dashboard carga sin errores
   - Puede ver capital físico y virtual
   - Puede cambiar de sucursal (si creaste varias)

3. **Deploy a Vercel** (si funciona en local):
   - Push a GitHub
   - Conectar en Vercel
   - Configurar variables de entorno:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
     ```
   - Deploy automático

---

## ❓ Troubleshooting

### Error: "function get_my_org_id_v2 does not exist"
**Solución**: No ejecutaste la migración `20260112_create_v2_functions.sql`. Vuelve al PASO 2.1.

### Error: "permission denied for table productos"
**Solución**: RLS está bloqueando porque:
- No ejecutaste `20260120_enable_rls_all_tables.sql`
- No ejecutaste `20260120_create_rls_policies.sql`
- O el usuario no tiene `organization_id` asignado

**Fix**: Ejecuta PASO 5.1 y 5.2.

### Error: "relation pending_invites does not exist"
**Solución**: No ejecutaste `20260121_create_missing_tables.sql`. Vuelve al PASO 4.1.

### La app carga pero no muestra datos
**Probable causa**: RLS está activo pero el usuario no tiene rol asignado en `user_organization_roles`.

**Fix**:
```sql
-- Verificar que el usuario tiene rol
SELECT * FROM user_organization_roles WHERE user_id = auth.uid();

-- Si no existe, crear manualmente (temporal):
INSERT INTO user_organization_roles (user_id, organization_id, role, is_active)
VALUES ('[user_uuid]', '[org_uuid]', 'owner', true);
```

---

## 📞 Soporte

Si tienes problemas ejecutando las migraciones:

1. Lee el mensaje de error completo
2. Busca en esta guía el error específico
3. Verifica que ejecutaste los pasos en orden
4. Revisa que no saltaste ningún paso crítico

**Documentación adicional**:
- `docs/DEPLOYMENT.md` - Guía completa de deployment
- `docs/SEGURIDAD.md` - Explicación del modelo de seguridad
- `docs/README.md` - Arquitectura y API

---

**Última actualización**: 2026-01-21
**Versión**: 1.0.0
