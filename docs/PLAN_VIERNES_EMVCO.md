# Plan viernes — Opción A: Stores + POS + EMVCo

> **Status:** probe validado el 27-abr-2026 23:40 UTC. MP creó un store de prueba con HTTP 201. La hipótesis ganadora es: **omitir `country_id` y `country_name`** (MP infiere del seller AR) + **usar `city_name` reconocida por MP** (ej. `'Don Torcuato'`, no `'Buenos Aires'` si el barrio real es ese).
>
> **Decisión Stores+POS:** confirmada. El blocker del 12-mar-2026 no aplica.
>
> **Quién ejecuta:** sesión gemela del viernes (tiene tokens). Bro orquesta desde PowerShell.

---

## Datos del probe ganador

```
POST https://api.mercadopago.com/users/112855368/stores
HTTP 201 Created
Body sent:
{
  "name": "TEST_PROBE_DELETE_ME",
  "location": {
    "street_number": "123",
    "street_name": "Calle de Prueba",
    "city_name": "Don Torcuato",
    "state_name": "Buenos Aires",
    "latitude": -34.6037,
    "longitude": -58.3816,
    "reference": "..."
  },
  "business_hours": { "monday": [...], "tuesday": [...], ... },
  "external_id": "PROBE_1777333258264"
}

Response:
{
  "id": "81655138",
  "name": "TEST_PROBE_DELETE_ME",
  "external_id": "PROBE_1777333258264",
  "location": {
    "address_line": "Calle de Prueba 123, Don Torcuato, Buenos Aires, Argentina",
    "id": "AR-C", "type": "state", "state_id": "AR-C",
    "city": "Don Torcuato", "zip_code": "C1043XIF",
    ...
  }
}
```

**Borrar manualmente** desde el panel de MP: el store id `81655138` ("TEST_PROBE_DELETE_ME").

---

## Pasos de implementación (en orden, atómicos)

### Paso 1 — Borrar el probe (cleanup)

**`lib/actions/mercadopago.actions.ts`:**
- Borrar la función `probeMercadoPagoApiAction` (~110 líneas, marcada `[TEMPORAL — DEBUG 27-abr-2026]`).
- Borrar las interfaces `ProbeMpApiCallResult` y `ProbeMpApiResult`.

**`components/configuracion-mercadopago.tsx`:**
- Quitar del import: `probeMercadoPagoApiAction`, `ProbeMpApiCallResult`.
- Borrar los useStates `probing`, `probeResults`, `probeError`.
- Borrar el callback `handleProbe`.
- Borrar la `<Card>` "🔬 Diagnóstico API Mercado Pago" (entre la card de Sucursales y la de Webhook secret).

Hacer Edits CHICOS, uno por uno. Verificar con `git diff` y `Read` después de cada uno.

### Paso 2 — Agregar columna `mp_store_id` a `branches`

`supabase/migrations/00014_branches_mp_store_id.sql`:

```sql
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS mp_store_id TEXT;

-- Único por organización (cada sucursal tiene su store).
CREATE UNIQUE INDEX IF NOT EXISTS branches_mp_store_id_unique
  ON branches (organization_id, mp_store_id)
  WHERE mp_store_id IS NOT NULL;

COMMENT ON COLUMN branches.mp_store_id IS
  'ID del Store de Mercado Pago asociado a esta sucursal. Generado por MP al crear el store via POST /users/{user_id}/stores. Se persiste para asociar el POS y reusar el store en re-registros.';
```

Aplicar la migration con MCP de Supabase (`mcp__0631e3ab-...__apply_migration`).

### Paso 3 — Reescribir `registerMercadoPagoPosForBranchAction`

Flujo nuevo (reemplaza el actual que llama al endpoint inexistente):

```ts
export async function registerMercadoPagoPosForBranchAction(
  branchId: string
): Promise<RegisterPosResult> {
  try {
    if (!branchId || typeof branchId !== 'string' || branchId.trim().length === 0) {
      return { success: false, error: 'branchId es requerido' }
    }

    const { supabase, orgId } = await verifyOwner()

    // 1. Buscar la sucursal y validar ownership
    const { data: branch, error: fetchError } = await supabase
      .from('branches')
      .select('id, name, address, city, state, mp_external_pos_id, mp_store_id, organization_id, is_active')
      .eq('id', branchId)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (fetchError || !branch) {
      return { success: false, error: 'Sucursal no encontrada o no pertenece a tu organización' }
    }
    if (branch.is_active === false) {
      return { success: false, error: 'No se puede registrar una sucursal inactiva' }
    }

    // 2. Idempotencia local
    if (branch.mp_external_pos_id && branch.mp_external_pos_id.length > 0) {
      return {
        success: true,
        externalPosId: branch.mp_external_pos_id,
        alreadyRegistered: true,
      }
    }

    // 3. Credenciales MP
    const config = await getDecryptedMercadoPagoConfig(supabase, orgId)
    if (!config) return { success: false, error: 'Credenciales de MP no configuradas. Conectá tu cuenta primero.' }
    if (!config.collecterId) return { success: false, error: 'collector_id no disponible. Reconectá tu cuenta.' }

    // 4. Obtener o crear Store en MP
    let storeId = branch.mp_store_id

    if (!storeId) {
      const externalStoreId = `KIOSCO_${branchId.replace(/-/g, '')}`
      const storeBody = {
        name: (branch.name || 'Sucursal').substring(0, 50),
        external_id: externalStoreId,
        location: {
          street_number: '0',
          street_name: branch.address || 'Sin dirección',
          city_name: branch.city || 'Don Torcuato',  // CRÍTICO: usar city del branch, MP rechaza ciudades fuera de su whitelist
          state_name: branch.state || 'Buenos Aires',
          // NO mandar country_id ni country_name — MP infiere del seller
          latitude: -34.6037,   // TODO: persistir lat/lng en branches en una iteración futura
          longitude: -58.3816,
          reference: branch.name || '',
        },
        business_hours: {
          monday: [{ open: '08:00', close: '22:00' }],
          tuesday: [{ open: '08:00', close: '22:00' }],
          wednesday: [{ open: '08:00', close: '22:00' }],
          thursday: [{ open: '08:00', close: '22:00' }],
          friday: [{ open: '08:00', close: '22:00' }],
          saturday: [{ open: '08:00', close: '22:00' }],
          sunday: [{ open: '08:00', close: '22:00' }],
        },
      }

      const storeResponse = await callMercadoPagoAPI(
        'POST',
        `/users/${config.collecterId}/stores`,
        storeBody,
        config.accessToken
      )

      if (!storeResponse || !storeResponse.id) {
        return {
          success: false,
          error:
            'Mercado Pago rechazó la creación del Store. Verificá que la sucursal tenga ciudad reconocida (ej: "Don Torcuato"). Mirá los logs de Vercel.',
        }
      }

      storeId = String(storeResponse.id)

      // Persistir mp_store_id antes de seguir (recovery si falla POS)
      await supabase
        .from('branches')
        .update({ mp_store_id: storeId })
        .eq('id', branchId)
        .eq('organization_id', orgId)
    }

    // 5. Crear POS en MP
    const externalPosId = `KIOSCO_${branchId.replace(/-/g, '')}`

    const posBody = {
      external_id: externalPosId,
      fixed_amount: false,
      name: (branch.name || 'Caja').substring(0, 50),
      category: 621102,  // Quiosco/Almacén general
      store_id: Number(storeId),
    }

    const posResponse = await callMercadoPagoAPI(
      'POST',
      '/pos',
      posBody,
      config.accessToken
    )

    if (!posResponse || !posResponse.external_id) {
      return {
        success: false,
        error:
          'Store creado en MP pero falló la creación del POS. Mirá los logs de Vercel y reintentá.',
      }
    }

    // 6. Persistir external_pos_id
    const { error: updateError } = await supabase
      .from('branches')
      .update({ mp_external_pos_id: externalPosId })
      .eq('id', branchId)
      .eq('organization_id', orgId)

    if (updateError) {
      logger.error('registerMercadoPagoPos', 'POS creado en MP pero error guardando en BD', updateError)
      return { success: false, error: 'POS registrado en MP pero no pudimos guardarlo localmente. Reintentá.' }
    }

    logger.info('registerMercadoPagoPos', 'POS registrado exitosamente', {
      orgId,
      branchId: branch.id.substring(0, 8),
      storeId,
      externalPosId,
    })

    return { success: true, externalPosId, alreadyRegistered: false }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('registerMercadoPagoPos', 'Error inesperado', err)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
```

**Riesgo:** este Edit es MUY GRANDE. La sesión gemela debería:
1. Borrar la función actual primero (Edit chico).
2. Pegarla nueva con `Write` parcial o varios `Edit` chicos.
3. Verificar `Read` después de cada cambio.
4. Correr `tsc --noEmit` desde PowerShell (NO bash sandbox).

### Paso 4 — Verificar `createMercadoPagoOrderAction`

El path actual es `/instore/orders/qr/seller/collectors/{id}/pos/{external_pos_id}/qrs`. Tras crear POS bajo Store, ese path debería funcionar tal cual (MP vincula el POS al Store internamente). **Probar primero sin modificar nada.**

Si MP devuelve 404 al generar QR (lo cual sugeriría que requiere el path v2 con stores), cambiar a:
```
PUT /instore/qr/seller/collectors/{collector_id}/stores/{external_store_id}/pos/{external_pos_id}/orders
```

donde `{external_store_id}` es el `external_id` del store (ej. `KIOSCO_<orgId>`). En ese caso también hay que ajustar el body.

### Paso 5 — Test + commit + deploy

```powershell
.\node_modules\.bin\tsc --noEmit
```

```powershell
.\node_modules\.bin\vitest run tests/unit/actions/mercadopago-webhook-signature.test.ts
```

```powershell
git add lib/actions/mercadopago.actions.ts components/configuracion-mercadopago.tsx supabase/migrations/00014_branches_mp_store_id.sql
git commit -m "feat(mp): completar migración EMVCo con flujo Stores+POS"
git push origin main
```

### Paso 6 — Validación de producción

1. **Rollback OFF**: si Bro hizo "Promote to Production" del deploy `f9aa499` para QA esta semana, primero hay que volver al deploy más reciente de main. Vercel lo hace solo cuando llega un nuevo commit en main.
2. Configuración → Mercado Pago → Sucursales → Registrar. Esperar status "Registrada".
3. Caja → cobrar QR de $3 con app de Mercado Pago. Tiene que funcionar como antes.
4. Caja → cobrar QR de $3 con MODO o Naranja X o Cuenta DNI. **Esta es la prueba crítica de EMVCo.**
5. Si todo OK, actualizar CLAUDE.md cerrando Tarea #10.

---

## Reglas técnicas heredadas (NO romper)

1. **Edits chicos** (1-3 líneas). Edits grandes (>20 líneas) tienden a truncar el archivo silenciosamente. Verificar con `git diff` después de cada uno.
2. **No usar bash para escribir archivos.** El sandbox bash y el filesystem real (Windows) ven copias distintas. Solo Read/Edit/Write del tool. Bash solo para leer y correr comandos.
3. **`tsc --noEmit` desde PowerShell**, no desde bash. El sandbox tiene cache stale del filesystem y da false positives/negatives.
4. **PowerShell**: no `&&`, paths con backslashes. `git commit -m "msg con espacio"`.
5. **Git**: NO `git add .` (80+ archivos con CRLF noise). Paths explícitos uno por uno.
6. **`.git/index.lock`**: si aparece "Another git process seems to be running", borrarlo con `Remove-Item .git\index.lock` desde PowerShell.

---

## Pendientes después de cerrar EMVCo

- Borrar `TEST_PROBE_DELETE_ME` (store id `81655138`) del panel de MP.
- Webhook secret multi-tenant: rotar y re-pegar con sanitize bulletproof.
- `SKIP_SIGNATURE_HARDCODE = true` en `app/api/mercadopago/webhook/route.ts:268` → `false` cuando se rote el secret.
- Persistir lat/lng en `branches` para no hardcodear `-34.6037, -58.3816` (cualquier sucursal en BA queda igual ahora; problema cuando se sumen sucursales en otras provincias).
- Borrar este archivo (`docs/PLAN_VIERNES_EMVCO.md`) cuando todo esté validado.
