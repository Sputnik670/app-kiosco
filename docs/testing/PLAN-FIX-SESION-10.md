# Plan de Fix — Sección 10 (Empleados / Invitaciones)

> Creado: 2026-04-21 al cierre de la sesión QA del mismo día.
> Objetivo: fixear los 4 bugs que bloquean el flujo de invitación de empleados antes de retomar el QA en las Secciones 5+.

---

## Orden de ataque recomendado

El orden no es por severidad sino por **dependencia**: si no fixeamos el bug 2 primero, no podemos testear el bug 1 con un usuario nuevo. Y si no tenemos el template de mail decente (bug 4), el QA manual es penoso.

1. **Bug 2** — Link de invitación cuelga en "Cargando..." (ALTA)
2. **Bug 1** — Invite a email pre-existente no crea membership (CRÍTICA)
3. **Bug 3** — Recovery link dropea al login (MEDIA)
4. **Bug 4** — Mail de invitación en inglés (MEDIA)

Una vez que los 4 están fixeados, corremos un mini-test dedicado que valida los 3 caminos de invitación antes de continuar con la QA general:

- (a) invitar email nuevo (inexistente) → activación funciona → login funciona → rol empleado correcto
- (b) invitar email pre-existente → reclama contraseña → login funciona → rol empleado correcto
- (c) flujo "olvidé contraseña" → llega mail → link abre form de nueva contraseña → login funciona

---

## Bug 2 — Link de invitación cuelga (ALTA)

### Síntoma observado
Firefox limpio, sin sesión. Pegás el link del mail, URL tiene hash con tokens. Página muestra "Cargando..." indefinidamente. Network tab: todas las requests 200 OK, pero aparece un `POST /view` con payload 469B y **solo 2 bytes de respuesta en 234ms**. Iniciador: `script.js:1 (fetch)`. Consola sin errores JS.

### Hipótesis
El flujo de invitación lleva al usuario a una ruta tipo `/auth/confirm` o `/invite/[token]`. Esa ruta hace un fetch/server action para validar el `invite_token` y obtener: organización, sucursal, rol. Si el endpoint devuelve empty o shape incorrecto, el componente queda en estado `loading=true` y nunca transiciona.

### Archivos a investigar
- `app/auth/callback/route.ts` (si existe) — callback de Supabase
- `app/invite/[token]/page.tsx` o similar — página que maneja la invitación
- `lib/actions/auth.actions.ts` o `lib/actions/invite.actions.ts` — server action que resuelve `invite_token`
- `middleware.ts` — chequear si hay un matcher que intercepta la ruta de invite

### Plan de debugging
1. Abrir DevTools con la invitación en curso, reproducir el "Cargando...".
2. Identificar exactamente qué endpoint es el `/view` que devuelve 2 bytes (ver el request body en el Network tab → preview).
3. Leer el código del endpoint que lo está respondiendo. Posibles causas:
   - Server action que retorna `undefined` en vez de `{ success, data }`.
   - `useEffect` en el componente cliente que espera un estado que nunca llega.
   - `invite_token` roto/expirado que pasa silencioso en vez de tirar error.
4. Agregar logging temporal con `console.log` en el server action para ver qué recibe y qué devuelve.
5. Fix según causa raíz. Agregar timeout de UI: si después de 10s no hay respuesta, mostrar mensaje "No pudimos validar tu invitación, contactate con tu dueño" en vez de loader infinito.

### Criterio de aceptación
- Email nuevo + link → en <3s ve el form "Elegí tu contraseña" → submit → entra al dashboard de empleado.
- Si el token es inválido/expirado → mensaje de error claro, no loader infinito.

---

## Bug 1 — Invite a email pre-existente no crea membership (CRÍTICA)

### Síntoma observado
`ramiro.ira92+qaempleado@gmail.com` ya existía en `auth.users` (intentó registrarse antes como dueño sin completar onboarding). El dueño invitó este email desde Sección 10. Al loguearse el "empleado", la app lo trata como dueño huérfano y lo manda al onboarding de crear organización. **No hay fila en `memberships` para ese user_id.**

### Archivo responsable
`lib/actions/auth.actions.ts` (o donde esté `inviteEmployeeAction`) — **hay que confirmar la ruta exacta con Grep antes de editar.**

### Rewrite propuesto (pseudo-código)

```typescript
export async function inviteEmployeeAction(input: {
  email: string
  role: 'empleado' | 'encargado'
  branchId: string
  organizationId: string
}) {
  const { email, role, branchId, organizationId } = input

  // 1. Verificar que el invitador es dueño de la org y el branch
  const owner = await verifyOwner()
  await validateBranchOwnership(branchId, organizationId)

  // 2. Chequear si el email ya existe en auth.users
  // (usar admin client — requiere service_role)
  const supabase = getSupabaseAdmin()
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users.find(u => u.email === email)

  if (existingUser) {
    // 3a. Email existe → NO invitar por auth. Solo crear membership.
    //    Chequear que no exista ya una membership para este user+org (evitar duplicado)
    const { data: existingMembership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', existingUser.id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (existingMembership) {
      return { success: false, error: 'Este usuario ya pertenece a la organización' }
    }

    const { error } = await supabase.from('memberships').insert({
      user_id: existingUser.id,
      organization_id: organizationId,
      branch_id: branchId,
      role,
      status: 'active', // ya tiene cuenta, no necesita activación
    })
    if (error) return { success: false, error: error.message }

    // TODO: enviar mail informativo tipo "Fuiste sumado al equipo de [Org]. Ingresá con tu contraseña."
    await sendTeamAdditionEmail({ email, orgName: owner.orgName, role })

    return { success: true, mode: 'added_existing' }
  }

  // 3b. Email no existe → invitar via Supabase Auth (flujo actual)
  const { data: invite, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { organization_id: organizationId, branch_id: branchId, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  })
  if (error) return { success: false, error: error.message }

  // Crear membership pendiente (se activa cuando el user confirma)
  const { error: memberError } = await supabase.from('memberships').insert({
    user_id: invite.user.id,
    organization_id: organizationId,
    branch_id: branchId,
    role,
    status: 'pending',
  })
  if (memberError) return { success: false, error: memberError.message }

  return { success: true, mode: 'invited_new' }
}
```

### Puntos de atención
- Necesita el **admin client de Supabase** (service_role key), no el anon. Debe correr solo server-side.
- La función `sendTeamAdditionEmail` no existe aún — o se la crea con Resend/Supabase SMTP, o para la v1 simplemente mostrar mensaje en UI al dueño: "Avisale manualmente a [email] que ya puede entrar con su contraseña existente."
- El `status: 'pending'` en memberships requiere que la columna exista. Si no existe, agregar migración: `ALTER TABLE memberships ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended'));`

### Criterio de aceptación
- Invitar email pre-existente → insert en `memberships` → login con contraseña existente entra al dashboard empleado (no al onboarding).
- Invitar mismo email dos veces → error claro "Ya pertenece a la organización".
- Invitar email nuevo → flujo actual sigue funcionando + membership pending creada.

---

## Bug 3 — Recovery link dropea al login (MEDIA)

### Síntoma observado
Usuario olvida contraseña → pide recovery → llega mail → click al link → URL tiene `#access_token=...&type=recovery` → app deja al usuario en `/login` genérico sin form de nueva contraseña.

### Fix
1. En el auth callback (client-side, porque el hash solo existe en el browser, no llega al server), leer `window.location.hash`.
2. Si detecta `type=recovery`, extraer `access_token` y redirigir a `/reset-password?token=<access_token>`.
3. Crear (o validar que existe) la página `/reset-password` con:
   - Form de nueva contraseña + confirmación
   - Llamada a `supabase.auth.updateUser({ password: nuevaPassword })` usando la sesión creada por el token
   - Redirect al dashboard al terminar

### Archivos a tocar
- `app/auth/callback/route.ts` (si es server route) o `app/auth/callback/page.tsx` (si es client)
- `app/reset-password/page.tsx` — crear si no existe

### Criterio de aceptación
- Pedir recovery → abrir mail en el mismo navegador o en otro → ver form "Nueva contraseña" → guardar → login automático → dashboard.

---

## Bug 4 — Mail de invitación en inglés (MEDIA)

### Fix
No toca código del repo, se hace en el dashboard de Supabase.

1. Ir a [Supabase Dashboard](https://supabase.com/dashboard/project/vrgexonzlrdptrplqpri) → Authentication → Email Templates.
2. Personalizar los 4 templates principales:
   - **Confirm signup** — al crear cuenta
   - **Invite user** — cuando el dueño invita
   - **Magic Link** — si se usa
   - **Reset Password** — recovery

### Template sugerido — Invite user

Asunto: `Te invitaron a trabajar en {{ .Data.org_name }} | App Kiosco`

Body HTML (simplificado):

```html
<div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #4f46e5;">¡Hola!</h1>
  <p>{{ .Data.inviter_name }} te invitó a sumarte como <strong>{{ .Data.role }}</strong> en <strong>{{ .Data.org_name }}</strong>.</p>
  <p>Tocá el botón de abajo para activar tu cuenta y elegir tu contraseña:</p>
  <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
    Activar mi cuenta
  </a>
  <p style="color: #666; font-size: 14px; margin-top: 24px;">
    Si no esperabas este mail, podés ignorarlo. Este link vence en 24 horas.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
  <p style="color: #999; font-size: 12px;">App Kiosco — Gestión de kioscos</p>
</div>
```

### Puntos de atención
- Las variables `{{ .Data.org_name }}`, `{{ .Data.inviter_name }}`, `{{ .Data.role }}` requieren que el `inviteUserByEmail(email, { data: { org_name, inviter_name, role } })` pase ese `data` — revisar que el server action lo esté haciendo. Si no, agregarlo.
- Testear con al menos Gmail + Outlook + app móvil de Gmail para verificar que el HTML se renderiza bien.

### Criterio de aceptación
- Mail llega en español, con nombre de la organización, nombre del que invita, rol, y botón grande de activación.
- Nada en inglés. No parece phishing.

---

## Estimación de tiempo

- Bug 2 (debugging): 1 a 2 horas (depende de qué tan rápido encontremos la causa raíz)
- Bug 1 (rewrite server action): 1 hora
- Bug 3 (recovery): 45 minutos
- Bug 4 (templates): 30 minutos
- Migración de DB si hace falta (columna `status` en memberships): 15 minutos
- Testing manual de los 3 caminos post-fix: 30 minutos

**Total estimado:** 4 a 5 horas. Probable media sesión.

---

## Checklist pre-deploy (después de fixear los 4)

- [ ] Bug 2 fixeado y testeado con email nuevo
- [ ] Bug 1 fixeado y testeado con email pre-existente
- [ ] Bug 3 fixeado y testeado con flujo recovery end-to-end
- [ ] Bug 4 templates personalizados en los 4 casos (invite, confirm, magic, reset)
- [ ] Agregado test E2E en `smoke-05-empleados.spec.ts` que cubra al menos el camino de email nuevo
- [ ] Actualizado `CLAUDE.md` con la regla nueva si surge alguna (ej. "usar admin client para auth.admin.*, no browser client")
- [ ] Actualizado `AUDIT-FINDINGS.md` marcando estos bugs como resueltos
- [ ] Smoke test en producción (Vercel) con email real antes de cerrar

---

## Cómo retomar el QA después

Una vez los 4 bugs están deployados:

1. Crear empleado fresco `ramiro.ira92+empleado3@gmail.com` desde el dueño.
2. Confirmar activación y login.
3. Continuar el QA desde Sección 5 (Caja/Ventas) usando esa sesión de empleado.
4. Seguir la secuencia 5 → 6 → 7 → 8 → 9 → 11 → 12 → 14 → 15 → 16 → 17 → 18.
