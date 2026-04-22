# Plantillas de Mail — KioscoApp (Nivel A)

> Última actualización: 22 de abril de 2026
> Relacionado con: Bug 4 (mails de Supabase en inglés + branding genérico)

## Qué hay acá

Seis plantillas HTML listas para pegar en **Supabase Dashboard → Authentication → Email Templates**. Cubren los 6 tipos de mail que manda Supabase Auth, todos en español (tuteo neutro) con el branding tipográfico de KioscoApp (sin logo, Nivel A).

| # | Archivo | Template de Supabase | Cuándo se envía |
|---|---|---|---|
| 1 | `01-confirm-signup.html` | **Confirm signup** | Cuando alguien se registra con email/password (crítico para el flujo de alta) |
| 2 | `02-reset-password.html` | **Reset password** | Cuando el usuario pide "olvidé mi contraseña" |
| 3 | `03-invite-user.html` | **Invite user** | Cuando el dueño invita a un empleado desde `invitar-empleado.tsx` |
| 4 | `04-magic-link.html` | **Magic link** | Login sin contraseña (casi no se usa con PKCE email/password, pero quedó prolijo) |
| 5 | `05-change-email.html` | **Change email address** | Cuando un usuario cambia su mail desde configuración |
| 6 | `06-reauthentication.html` | **Reauthentication** | OTP de 6 dígitos para confirmar acciones sensibles |

## Cómo instalar en Supabase (15 min)

1. Entrá a [Supabase Dashboard](https://supabase.com/dashboard/project/vrgexonzlrdptrplqpri) del proyecto `vrgexonzlrdptrplqpri`.
2. Menú lateral → **Authentication** → **Email Templates**.
3. Por cada template de la tabla de arriba:
   - Click en el nombre del template (ej. "Confirm signup").
   - **Subject heading**: copiar del listado de subjects más abajo.
   - **Message (HTML)**: borrar todo el contenido por default y pegar el HTML del archivo correspondiente.
   - **Save changes**.
4. Probar mandándote un mail real (registro de prueba, recupero de password, etc.). Revisá en Gmail web, Gmail móvil y Outlook si podés.

## Subjects sugeridos

Copiar y pegar en el campo "Subject heading" de cada template en Supabase:

| Template | Subject |
|---|---|
| Confirm signup | `Confirmá tu cuenta en KioscoApp` |
| Reset password | `Restablecé tu contraseña de KioscoApp` |
| Invite user | `Te invitaron a unirte a un kiosco en KioscoApp` |
| Magic link | `Tu enlace de acceso a KioscoApp` |
| Change email | `Confirmá tu nueva dirección de mail` |
| Reauthentication | `Tu código de verificación de KioscoApp` |

## Variables de Supabase usadas

Estas variables son reemplazadas por Supabase automáticamente al enviar el mail. No las toques.

- `{{ .ConfirmationURL }}` — URL completa con token (signup, reset, invite, magic link, change email)
- `{{ .Token }}` — Código OTP de 6 dígitos (reauthentication)
- `{{ .Email }}` — Mail actual del usuario (change email, como referencia del mail viejo)
- `{{ .NewEmail }}` — Mail nuevo al que se está cambiando (solo change email)

> Si agregás `{{ .SiteURL }}` o `{{ .RedirectTo }}` en algún template, asegurate de que esas variables estén bien configuradas en **Project Settings → Auth → Site URL** y **Redirect URLs**.

## Decisiones de diseño

- **Sistema de color híbrido**:
  - **Identidad** (wordmark, logo futuro, headers): navy `#1e293b` — matchea el logo de KioscoApp y transmite "gestión seria, confiable".
  - **Acción** (CTAs, links, elementos destacados): indigo `#4f46e5` → violet `#7c3aed` — color de interacción, mantiene energía y llama al click.
  - Este patrón sigue la convención pro de Linear, Stripe y Vercel: un color de identidad neutro-oscuro + un color de acento para acciones.
- **Wordmark tipográfico** "KioscoApp" en navy sólido. Cuando hagamos Nivel B y tengamos el logo final exportado a PNG/SVG, se reemplaza el `<span>` con un `<img>` hospedado en el dominio propio.
- **Tipografía**: stack de fuentes del sistema (`-apple-system, Segoe UI, Roboto, Arial`) porque los clientes de mail no cargan fuentes custom confiablemente.
- **Mobile-first**: el card está en 600px max pero escala bien abajo de 400px. Los CTAs tienen padding generoso (14×32) para dedos.
- **Bulletproof buttons**: los CTAs usan tablas con `bgcolor` + `background-image` para funcionar en Outlook (que no soporta gradientes CSS).
- **Preheader oculto**: cada mail tiene una línea de preview que aparece en la bandeja de entrada de Gmail/Outlook antes de abrirlo.
- **Texto alternativo**: todos los mails tienen el link completo visible como fallback si el botón falla.

## Nivel B — pendiente (2-4 horas cuando empieces a cobrar)

Cuando tengas el primer cliente pagando o antes de la demo comercial grande:

1. **Comprar dominio**. Sugerido: `kioscoapp.com.ar` (matchea la marca actual). Alternativas: `kiosco.app`, `miKioscoapp.com`.
2. **Configurar mail provider**:
   - **Resend** (recomendado) — 3000 mails/mes gratis, integración nativa con Supabase en Dashboard → Auth → SMTP Settings.
   - Alternativas: SendGrid (100/día gratis), AWS SES (más barato a escala pero más engorroso de setear).
3. **Configurar DNS** — SPF, DKIM y DMARC para que no caigan en spam. Resend tiene un wizard que genera los registros automáticamente.
4. **Cambiar remitente** en SMTP Settings a `hola@kioscoapp.com.ar` (o `noreply@` — aunque `hola@` es más humano).
5. **Diseñar logo** y reemplazar el wordmark `<span>` en el header de cada template por un `<img>`:
   ```html
   <img src="https://kioscoapp.com.ar/email/logo.png" alt="KioscoApp" width="180" height="48" style="display:block;" />
   ```
   Hospedarlo en un CDN o en `public/email/` del proyecto Next.js (Vercel sirve `/public` como estático).
6. **Testear deliverability** con [mail-tester.com](https://mail-tester.com) — apuntar a 10/10.

## Si hay que editar los templates

Todos siguen la misma estructura:
- Tabla externa (background `#f8fafc`) → tabla interna centrada (600px max)
- Header con wordmark
- Card blanca con padding generoso
- CTA button en tabla aparte (para Outlook)
- Footer con disclaimer

Para mantener consistencia: cambiá el copy pero no toques la estructura HTML ni los colores. Si querés ajustar la paleta, hacelo en los 6 archivos a la vez (reemplazo global).
