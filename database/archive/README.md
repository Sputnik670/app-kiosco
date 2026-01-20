# Scripts Archivados - Ejecutados Exitosamente

**Fecha de Archivo:** 2026-01-06

Este directorio contiene scripts SQL que ya fueron ejecutados exitosamente en producción y se mantienen como referencia histórica.

---

## ⚠️ IMPORTANTE

**NO EJECUTAR ESTOS SCRIPTS NUEVAMENTE**

Todos estos scripts ya fueron aplicados a la base de datos. Ejecutarlos nuevamente podría causar:
- Duplicación de funciones
- Conflictos de políticas RLS
- Errores de ejecución

---

## Contenido del Archivo

### 1. SETUP-COMPLETO.sql
**Ejecutado:** Fase inicial del proyecto
**Propósito:** Configuración base de tablas y estructura inicial
**Estado:** Obsoleto - Reemplazado por migraciones actuales

---

### 2. CREATE_SECURITY_FUNCTIONS.sql
**Ejecutado:** 2026-01-05
**Propósito:** Creación de la función `get_my_org_id()` para RLS
**Versión:** 1.0.0
**Resultado:** Función creada exitosamente y en uso

**Función creada:**
```sql
public.get_my_org_id() RETURNS UUID
-- Devuelve organization_id del perfil del usuario autenticado
```

---

### 3. UPGRADE_RLS_POLICIES.sql
**Ejecutado:** 2026-01-05
**Propósito:** Profesionalización de políticas RLS en organizations y perfiles
**Versión:** 1.3.0
**Resultado:** 7 políticas creadas exitosamente

**Políticas creadas:**
- organizations: 3 políticas (SELECT, UPDATE, INSERT)
- perfiles: 4 políticas (SELECT, INSERT, UPDATE, DELETE)

---

### 4. CLEAN_GHOST_POLICIES.sql
**Ejecutado:** 2026-01-05
**Propósito:** Limpieza amplia de políticas antiguas en 7 tablas
**Versión:** 1.5.0
**Alcance:** organizations, perfiles, sucursales, productos, stock, caja_diaria, movimientos_caja
**Resultado:** Políticas fantasma eliminadas

---

### 5. SURGICAL_DROP_POLICIES.sql
**Ejecutado:** 2026-01-05
**Propósito:** Eliminación quirúrgica de políticas intrusas
**Versión:** 1.6.0
**Alcance:** SOLO organizations y perfiles
**Resultado:** Conteo final correcto (3 + 4 = 7 políticas)

---

### 6. VERIFY_RLS_UPGRADE.sql
**Ejecutado:** 2026-01-05 (Verificación)
**Propósito:** Verificación de aplicación correcta del upgrade RLS
**Versión:** 1.4.0
**Resultado:** UPGRADE EXITOSO - Sistema listo para producción

---

### 7. QUERY_POLICIES.sql
**Ejecutado:** 2026-01-05 (Diagnóstico)
**Propósito:** Listar políticas actuales en organizations y perfiles
**Uso:** Script de diagnóstico para auditoría
**Resultado:** Útil para identificar políticas intrusas

---

## Estado Actual de la Base de Datos

### Función de Seguridad
✅ `get_my_org_id()` - Activa y en uso

### Políticas RLS Activas

**ORGANIZATIONS (3):**
1. organizations_select_own - SELECT con get_my_org_id()
2. organizations_update_own - UPDATE con get_my_org_id()
3. organizations_insert_new - INSERT permitido

**PERFILES (4):**
1. perfiles_select_organization - SELECT con get_my_org_id()
2. perfiles_insert_own - INSERT con auth.uid()
3. perfiles_update_organization - UPDATE con get_my_org_id()
4. perfiles_delete_organization - DELETE con get_my_org_id()

---

## Documentación de Referencia

Para entender el contexto completo de estos scripts, consulta en `database/`:

- **README_RLS_UPGRADE.md** - Guía técnica del upgrade RLS
- **CHANGELOG_UPGRADE.md** - Historial completo de cambios
- **READY_FOR_PRODUCTION.md** - Checklist de producción
- **AUDIT_STANDARDS.md** - Estándares de auditoría aplicados
- **EXECUTION_GUIDE.md** - Guía de ejecución paso a paso

---

## Si Necesitas Revertir

Si por alguna razón necesitas revertir estos cambios:

1. **Eliminar políticas:**
   ```sql
   DROP POLICY IF EXISTS "organizations_select_own" ON organizations;
   DROP POLICY IF EXISTS "organizations_update_own" ON organizations;
   DROP POLICY IF EXISTS "organizations_insert_new" ON organizations;
   DROP POLICY IF EXISTS "perfiles_select_organization" ON perfiles;
   DROP POLICY IF EXISTS "perfiles_insert_own" ON perfiles;
   DROP POLICY IF EXISTS "perfiles_update_organization" ON perfiles;
   DROP POLICY IF EXISTS "perfiles_delete_organization" ON perfiles;
   ```

2. **Eliminar función:**
   ```sql
   DROP FUNCTION IF EXISTS public.get_my_org_id();
   ```

3. **Recrear políticas antiguas** (si es necesario - consulta git history)

---

## Historial de Archivado

| Fecha | Archivo | Razón |
|-------|---------|-------|
| 2026-01-06 | SETUP-COMPLETO.sql | Obsoleto - Esquema actual integrado |
| 2026-01-06 | CREATE_SECURITY_FUNCTIONS.sql | Ejecutado exitosamente |
| 2026-01-06 | UPGRADE_RLS_POLICIES.sql | Ejecutado exitosamente |
| 2026-01-06 | CLEAN_GHOST_POLICIES.sql | Ejecutado exitosamente |
| 2026-01-06 | SURGICAL_DROP_POLICIES.sql | Ejecutado exitosamente |
| 2026-01-06 | VERIFY_RLS_UPGRADE.sql | Verificación completada |
| 2026-01-06 | QUERY_POLICIES.sql | Script de diagnóstico |

---

**Última actualización:** 2026-01-06
**Archivado por:** Claude - Refactorización Server Actions
**Estado:** Limpieza profunda completada - Infraestructura de seguridad lista
