# Documentación de Seguridad - SaaS Kiosco

## Índice
1. [Arquitectura de Seguridad](#arquitectura-de-seguridad)
2. [Row Level Security (RLS)](#row-level-security-rls)
3. [Modelo de Autorización](#modelo-de-autorización)
4. [Funciones de Seguridad](#funciones-de-seguridad)
5. [Políticas por Tabla](#políticas-por-tabla)
6. [Auditoría y Compliance](#auditoría-y-compliance)
7. [Best Practices](#best-practices)

---

## Arquitectura de Seguridad

### Principios de Diseño

1. **Defensa en Profundidad**
   - RLS a nivel de base de datos
   - Validación a nivel de aplicación
   - Autenticación mediante Supabase Auth
   - HTTPS obligatorio (Vercel)

2. **Mínimo Privilegio**
   - Usuarios solo ven datos de su organización
   - Empleados tienen permisos limitados
   - Owners tienen permisos administrativos

3. **Fail-Safe**
   - Por defecto: acceso denegado
   - RLS bloquea todo, políticas permiten explícitamente

### Capas de Seguridad

```
┌─────────────────────────────────────────┐
│  CAPA 1: HTTPS + Vercel Edge Network   │ ← Encriptación en tránsito
├─────────────────────────────────────────┤
│  CAPA 2: Supabase Auth (JWT)           │ ← Autenticación
├─────────────────────────────────────────┤
│  CAPA 3: Server Actions + Middleware   │ ← Validación aplicación
├─────────────────────────────────────────┤
│  CAPA 4: RLS Policies                  │ ← Aislamiento multitenancy
├─────────────────────────────────────────┤
│  CAPA 5: Database Constraints           │ ← Integridad de datos
└─────────────────────────────────────────┘
```

---

## Row Level Security (RLS)

### ¿Qué es RLS?

Row Level Security es una característica de PostgreSQL que permite **filtrar automáticamente** las filas de una tabla basándose en el usuario que ejecuta la consulta.

**Beneficio**: Incluso si hay un bug en el código de la aplicación, la base de datos **garantiza** que un usuario nunca verá datos de otra organización.

### Tablas con RLS Habilitado

Todas las tablas operacionales tienen RLS habilitado:

```sql
-- Verificar RLS está habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```

✅ **Tablas protegidas**:
- `productos`, `stock`, `ventas`, `detalles_venta`
- `movimientos`, `sucursales`, `asistencia`
- `proveedores`, `caja_diaria`, `movimientos_caja`
- `compras`, `historial_precios`
- `misiones`, `movimientos_misiones`
- `user_organization_roles`, `perfiles`

### Cómo Funciona RLS

```sql
-- Sin RLS (INSEGURO):
SELECT * FROM productos; -- Retorna TODOS los productos (cross-tenant leak)

-- Con RLS (SEGURO):
SELECT * FROM productos; -- Retorna SOLO productos de la org del usuario
-- Equivalente a:
SELECT * FROM productos WHERE organization_id = get_my_org_id_v2();
```

---

## Modelo de Autorización

### Modelo V2 (Actual)

```
auth.users (Supabase Auth)
    ↓
user_organization_roles
    ├── user_id (FK → auth.users)
    ├── organization_id (FK → organizations)
    ├── role ('owner', 'employee', 'manager', 'admin')
    ├── sucursal_id (NULL = todas las sucursales)
    └── is_active (soft delete)
```

### Roles Disponibles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `owner` | Dueño de la organización | Acceso total, puede crear sucursales, invitar empleados |
| `admin` | Administrador | Similar a owner, pero no puede eliminar la organización |
| `manager` | Gerente de sucursal | Puede gestionar su sucursal asignada |
| `employee` | Empleado | Puede registrar ventas, fichar asistencia |

### Flujo de Autorización

```typescript
// 1. Usuario se autentica
const { data: { user } } = await supabase.auth.getUser();

// 2. Sistema obtiene rol y organización
const { data: context } = await supabase.rpc('get_user_org_context_v2');
// Retorna: { organization_id, role, sucursal_id }

// 3. RLS filtra automáticamente todas las queries
const { data: productos } = await supabase.from('productos').select('*');
// Solo retorna productos de organization_id del usuario
```

---

## Funciones de Seguridad

### Funciones V2 (Producción)

#### `get_my_org_id_v2()`

**Propósito**: Retorna el `organization_id` del usuario autenticado.

**Uso**: Base de TODAS las políticas RLS.

```sql
CREATE FUNCTION public.get_my_org_id_v2()
RETURNS UUID
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    ELSE 4
  END
  LIMIT 1;
$$;
```

**Características**:
- `SECURITY DEFINER`: Se ejecuta con permisos del propietario de la función
- `STABLE`: Resultado no cambia dentro de la misma transacción (cacheable)
- Prioriza `owner` si el usuario tiene múltiples roles

#### `es_owner_v2()`

**Propósito**: Verifica si el usuario tiene rol de `owner`.

**Uso**: Políticas que requieren permisos de administrador (DELETE, crear sucursales).

```sql
CREATE FUNCTION public.es_owner_v2()
RETURNS BOOLEAN
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_organization_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;
```

#### `get_my_role_v2()`

**Propósito**: Retorna el rol del usuario.

```sql
CREATE FUNCTION public.get_my_role_v2()
RETURNS TEXT
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.user_organization_roles
  WHERE user_id = auth.uid()
    AND is_active = true
  ORDER BY CASE role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'manager' THEN 3
    ELSE 4
  END
  LIMIT 1;
$$;
```

### Funciones Transaccionales con Validación

#### `procesar_venta()` - Validación Completa

```sql
-- Validaciones de seguridad implementadas:
1. ✅ Obtiene organization_id del usuario autenticado
2. ✅ Valida que sucursal pertenece a la org
3. ✅ Valida que caja_diaria pertenece a la org
4. ✅ Valida que productos pertenecen a la org
5. ✅ Valida que stock pertenece a la org
```

**Código de validación**:
```sql
-- 1. Obtener org del usuario
SELECT public.get_my_org_id_v2() INTO v_organization_id;

IF v_organization_id IS NULL THEN
  RAISE EXCEPTION 'Usuario no tiene organización asignada';
END IF;

-- 2. Validar sucursal
IF NOT EXISTS (
  SELECT 1 FROM public.sucursales
  WHERE id = p_sucursal_id AND organization_id = v_organization_id
) THEN
  RAISE EXCEPTION 'La sucursal no pertenece a tu organización';
END IF;
```

---

## Políticas por Tabla

### Template de Políticas

Todas las tablas operacionales siguen este patrón:

```sql
-- SELECT: Todos los usuarios autenticados ven su org
CREATE POLICY "tabla_select_own_org"
ON tabla FOR SELECT
TO authenticated
USING (organization_id = public.get_my_org_id_v2());

-- INSERT: Todos pueden insertar en su org
CREATE POLICY "tabla_insert_own_org"
ON tabla FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_my_org_id_v2());

-- UPDATE: Todos pueden actualizar su org
CREATE POLICY "tabla_update_own_org"
ON tabla FOR UPDATE
TO authenticated
USING (organization_id = public.get_my_org_id_v2())
WITH CHECK (organization_id = public.get_my_org_id_v2());

-- DELETE: Solo owners pueden eliminar
CREATE POLICY "tabla_delete_owners_only"
ON tabla FOR DELETE
TO authenticated
USING (
  organization_id = public.get_my_org_id_v2()
  AND public.es_owner_v2()
);

-- SERVICE ROLE: Bypass completo (para migraciones)
CREATE POLICY "tabla_service_role_bypass"
ON tabla FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Excepciones: Tablas Inmutables

Algunas tablas son **append-only** para auditoría:

```sql
-- VENTAS: No se pueden actualizar ni eliminar
CREATE POLICY "ventas_no_update" ON ventas FOR UPDATE USING (false);
CREATE POLICY "ventas_no_delete" ON ventas FOR DELETE USING (false);

-- MOVIMIENTOS: No se pueden actualizar ni eliminar
CREATE POLICY "movimientos_no_update" ON movimientos FOR UPDATE USING (false);
CREATE POLICY "movimientos_no_delete" ON movimientos FOR DELETE USING (false);

-- MOVIMIENTOS_CAJA: No se pueden actualizar ni eliminar
CREATE POLICY "movimientos_caja_no_update" ON movimientos_caja FOR UPDATE USING (false);
CREATE POLICY "movimientos_caja_no_delete" ON movimientos_caja FOR DELETE USING (false);
```

**Razón**: Compliance y auditoría. Las ventas, movimientos de stock y caja son **registros históricos inmutables**.

### Políticas Especiales

#### Sucursales (Solo Owners)

```sql
-- Solo owners pueden crear/modificar/eliminar sucursales
CREATE POLICY "sucursales_insert_owners_only"
ON sucursales FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_my_org_id_v2()
  AND public.es_owner_v2()
);
```

#### Perfiles (Solo Propios)

```sql
-- Usuarios solo ven/editan su propio perfil
CREATE POLICY "perfiles_select_own"
ON perfiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- No se pueden eliminar perfiles
CREATE POLICY "perfiles_no_delete"
ON perfiles FOR DELETE
TO authenticated
USING (false);
```

#### user_organization_roles (Owners ven todos)

```sql
-- Usuarios ven sus propios roles
CREATE POLICY "user_organization_roles_select_own"
ON user_organization_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Owners ven todos los roles de su org
CREATE POLICY "user_organization_roles_owners_see_org"
ON user_organization_roles FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM public.user_organization_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
      AND is_active = true
  )
);
```

---

## Auditoría y Compliance

### Tablas de Auditoría

**Inmutables (append-only)**:
- `ventas` - Registro de todas las transacciones
- `detalles_venta` - Detalles de items vendidos
- `movimientos` - Movimientos de stock (entradas/salidas)
- `movimientos_caja` - Movimientos de caja (ingresos/gastos)
- `historial_precios` - Cambios de precios históricos
- `movimientos_misiones` - Historial de misiones completadas

**Timestamps automáticos**:
```sql
-- Todas las tablas tienen:
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()

-- Trigger para actualizar updated_at:
CREATE TRIGGER update_tabla_updated_at
BEFORE UPDATE ON tabla
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Logs de Acceso

Supabase registra automáticamente:
- Todos los queries ejecutados
- Usuario que ejecutó cada query
- Timestamp exacto
- Resultados (exitoso/error)

**Ver logs**:
```bash
# En Supabase Dashboard
Logs → Database → Filter by:
  - severity: error
  - query: SELECT * FROM ventas
```

### Retención de Datos

| Tipo de Dato | Retención | Razón |
|--------------|-----------|-------|
| Ventas | Permanente | Legal/Fiscal (5-10 años según país) |
| Movimientos stock | Permanente | Auditoría de inventario |
| Asistencia | 2 años | Laboral |
| Logs de sistema | 30 días | Debugging |
| Backups | 30 días | Recuperación |

### Compliance

**GDPR (Europa)**:
- ✅ Right to Access: Usuarios pueden exportar sus datos
- ✅ Right to Deletion: Soft-delete con `is_active = false`
- ✅ Data Portability: Exportación en JSON/CSV
- ✅ Consent: Términos y privacidad aceptados en signup

**PCI DSS (Pagos con tarjeta)**:
- ⚠️ NO almacenamos datos de tarjetas (delegado a gateway de pago)
- ✅ Datos sensibles nunca en logs
- ✅ HTTPS obligatorio

---

## Best Practices

### Para Desarrolladores

1. **Nunca bypassear RLS en código de aplicación**
   ```typescript
   // ❌ MAL: Usar service_role_key en frontend
   const supabase = createClient(url, SERVICE_ROLE_KEY); // NUNCA!

   // ✅ BIEN: Usar anon_key (RLS se aplica)
   const supabase = createClient(url, ANON_KEY);
   ```

2. **Validar organization_id en funciones RPC**
   ```sql
   -- ❌ MAL: Confiar en el parámetro
   CREATE FUNCTION foo(p_org_id UUID) ...

   -- ✅ BIEN: Obtener del usuario autenticado
   CREATE FUNCTION foo() ...
   BEGIN
     v_org_id := get_my_org_id_v2();
     ...
   ```

3. **Usar SECURITY DEFINER con cuidado**
   ```sql
   -- Solo si es necesario elevar privilegios
   -- Siempre validar inputs
   CREATE FUNCTION privileged_operation()
   SECURITY DEFINER -- ⚠️ Corre como owner de la función
   AS $$
   BEGIN
     -- Validar que el usuario tiene permiso
     IF NOT es_owner_v2() THEN
       RAISE EXCEPTION 'Permiso denegado';
     END IF;
     ...
   ```

### Para Administradores

1. **Rotar service_role_key periódicamente**
   - Cada 3-6 meses
   - Inmediatamente si se compromete

2. **Monitorear intentos de acceso cross-tenant**
   ```sql
   -- Query para detectar intentos sospechosos
   SELECT query, user_email, timestamp
   FROM logs
   WHERE query LIKE '%organization_id%'
   AND severity = 'error'
   AND error_message LIKE '%permission denied%';
   ```

3. **Backups antes de migraciones críticas**
   ```bash
   # Antes de cambiar políticas RLS
   supabase db dump > backup_pre_rls_change.sql
   ```

### Para Usuarios Finales

1. **Contraseñas seguras**
   - Mínimo 12 caracteres
   - Incluir mayúsculas, números, símbolos

2. **No compartir cuentas**
   - Cada empleado debe tener su propio usuario
   - Trazabilidad de auditoría

3. **Reportar accesos sospechosos**
   - Ventas que no reconocen
   - Cambios en inventario no autorizados

---

## Testing de Seguridad

### Test 1: Aislamiento de Organizaciones

```typescript
// 1. Crear 2 organizaciones (A y B)
const orgA = await createOrganization('Org A');
const orgB = await createOrganization('Org B');

// 2. Crear producto en org A
const { data: productA } = await supabaseOrgA
  .from('productos')
  .insert({ nombre: 'Product A', organization_id: orgA.id })
  .select()
  .single();

// 3. Intentar acceder desde org B
const { data: leak } = await supabaseOrgB
  .from('productos')
  .select('*')
  .eq('id', productA.id);

// ✅ ESPERADO: data = null (RLS bloqueó)
expect(leak).toBeNull();
```

### Test 2: Prevención de Escalación de Privilegios

```typescript
// 1. Login como employee
const employee = await supabase.auth.signInWithPassword({
  email: 'employee@test.com',
  password: 'password'
});

// 2. Intentar crear sucursal (solo owners pueden)
const { error } = await supabase
  .from('sucursales')
  .insert({ nombre: 'Nueva Sucursal' });

// ✅ ESPERADO: error = "permission denied" (RLS bloqueó)
expect(error).toBeTruthy();
```

### Test 3: Funciones RPC Validan Ownership

```typescript
// 1. Crear producto de org A
const productA = await createProduct(orgA.id);

// 2. Login como usuario de org B
await supabase.auth.signInWithPassword({
  email: 'userB@test.com',
  password: 'password'
});

// 3. Intentar incrementar saldo de proveedor de org A
const { error } = await supabase.rpc('incrementar_saldo_proveedor', {
  id_input: providerA.id,
  monto_input: 100
});

// ✅ ESPERADO: error = "no pertenece a tu organización"
expect(error.message).toContain('no pertenece a tu organización');
```

---

## Incidentes y Respuesta

### Procedimiento de Respuesta a Incidente

1. **Detección**
   - Monitorear logs de errores RLS
   - Alertas de Supabase/Vercel

2. **Contención**
   - Identificar cuenta comprometida
   - Deshabilitar usuario: `UPDATE auth.users SET banned_until = NOW() + INTERVAL '24 hours'`

3. **Investigación**
   - Revisar logs de acceso del usuario
   - Identificar datos potencialmente expuestos

4. **Remediación**
   - Rotar credenciales afectadas
   - Aplicar parches de seguridad

5. **Post-mortem**
   - Documentar incidente
   - Actualizar políticas/procedimientos

### Contactos de Emergencia

- **Supabase Security**: security@supabase.com
- **Vercel Security**: security@vercel.com

---

## Actualizaciones de Seguridad

Este documento se actualiza con cada cambio de seguridad. Última revisión: 2026-01-20.

**Changelog**:
- 2026-01-20: Migración completa a modelo V2 con RLS
- 2026-01-12: Creación de funciones V2
- 2026-01-11: Creación de user_organization_roles
