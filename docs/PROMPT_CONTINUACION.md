# Prompt de Continuación - App-Kiosco

> **Copia y pega este prompt en una nueva sesión de Claude Code para continuar el desarrollo.**

---

## PROMPT

```
Soy el desarrollador de App-Kiosco, un sistema POS multi-tenant para kioscos en Argentina. El proyecto fue desarrollado principalmente con asistencia de IA ("vibecoding").

CONTEXTO CRÍTICO:
1. Lee docs/ARCHITECTURE.md para entender la estructura completa
2. El proyecto usa Next.js 14 + Supabase con RLS multi-tenant
3. Acabo de completar una auditoría de seguridad (2 Feb 2026)

ESTADO ACTUAL POST-AUDITORÍA:
✅ Server Actions: Bien estructurados, siguiendo buenas prácticas
✅ RLS: Políticas completas en todas las tablas (corregido hoy)
✅ API sync: Ahora tiene validación de auth y autorización (corregido hoy)
✅ Tipos: Funcionales con workarounds `as unknown as` para JOINs de Supabase

PENDIENTES INMEDIATOS:
1. Aplicar migración 00003_invoicing.sql: `npx supabase db push`
2. Integrar componente <Facturacion> en dashboard-dueno.tsx (ya existe en components/facturacion/)
3. El servicio ARCA está mockeado - CAEs generados NO son válidos fiscalmente

ARCHIVOS CLAVE:
- docs/ARCHITECTURE.md → Documentación completa
- lib/actions/*.actions.ts → Server Actions (lógica de negocio)
- supabase/migrations/00001_complete_schema.sql → Schema V2 con RLS
- supabase/migrations/00003_invoicing.sql → Facturación (pendiente aplicar)
- components/facturacion/index.tsx → UI de facturación lista

PRÓXIMOS PASOS DEL ROADMAP B2B:
1. Integrar facturación en dashboard
2. Implementar reportes exportables (PDF/Excel)
3. Agregar tests unitarios para server actions críticos
4. Integración real con ARCA/AFIP cuando haya certificado

¿Qué tarea quieres que aborde primero?
```

---

## RESUMEN DE CAMBIOS REALIZADOS HOY (2 Feb 2026)

### Correcciones de seguridad aplicadas:

1. **supabase/migrations/00003_invoicing.sql** (líneas 148-165)
   - Agregado: `invoices_no_delete` policy
   - Agregado: `invoice_sales_no_update` policy
   - Agregado: `invoice_sales_no_delete` policy
   - Agregado: Service role bypass policies

2. **app/api/ventas/sync/route.ts** (líneas 60-85)
   - Agregado: Validación de autenticación con `supabase.auth.getUser()`
   - Agregado: Validación de autorización con `get_my_org_id()`
   - Agregado: Check de organizationId contra la del usuario

### Hallazgos de la auditoría:

| Aspecto | Estado | Notas |
|---------|--------|-------|
| RLS multi-tenant | ✅ Sólido | `get_my_org_id()` bien implementada |
| Server Actions | ✅ Correcto | Validaciones en todos los actions |
| Tipos TypeScript | ⚠️ Workarounds | `as unknown as` para JOINs (funcional) |
| Facturación | 🆕 Lista | Código completo, falta integrar |
| ARCA | 🔶 Mock | CAEs simulados, no válidos para AFIP |

---

## GIT STATUS ANTES DE CONTINUAR

Los siguientes archivos están modificados/nuevos y deben committearse:

```
Modificados:
- supabase/migrations/00003_invoicing.sql  (políticas RLS agregadas)
- app/api/ventas/sync/route.ts (validación auth agregada)

Nuevos:
- docs/PROMPT_CONTINUACION.md (este archivo)
```

Comando sugerido:
```bash
git add supabase/migrations/00003_invoicing.sql app/api/ventas/sync/route.ts docs/PROMPT_CONTINUACION.md
git commit -m "fix: add missing RLS policies and auth validation

- Add explicit DELETE policies to invoices and invoice_sales
- Add service_role bypass policies for admin operations
- Add authentication check in /api/ventas/sync endpoint
- Add organization authorization validation
- Add continuation prompt for next session

Security audit completed 2026-02-02"
```
