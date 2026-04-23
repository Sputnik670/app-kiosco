# Templates de email para Supabase — Kiosco App

> Versión: 2026-04-22 (Nivel A — sin dominio propio ni logo)
> Paleta: navy `#0f172a`, slate-500 `#475569`, slate-400 `#94a3b8`, slate-50 `#f8fafc`

## Cómo aplicar

1. Abrí el dashboard de Supabase → proyecto **Kiosco App** (`vrgexonzlrdptrplqpri`).
2. En el menú izquierdo: **Authentication → Email Templates**.
3. Vas a ver 5 tabs: *Confirm signup*, *Invite user*, *Magic Link*, *Change Email Address*, *Reset Password*.
4. Para cada uno:
   - Pegá el **Subject** correspondiente en el campo "Subject heading".
   - Borrá todo lo que haya en el "Message (HTML)" y pegá el bloque HTML correspondiente.
   - Click **Save changes** abajo de todo.
5. Listo. Los próximos mails van a salir con la plantilla nueva.

> **Nota:** Los templates usan la variable `{{ .ConfirmationURL }}` que Supabase reemplaza automáticamente por el link de acción. No tocar esa parte.

---

## 1. Confirm signup

> Se envía cuando un dueño nuevo se registra con email + contraseña (si tenés confirmación de email activada).

**Subject:**

```
Confirmá tu cuenta en Kiosco App
```

**Body HTML:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmá tu cuenta</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
<tr><td style="background-color:#0f172a;padding:28px 32px;text-align:center;">
<div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">KIOSCO APP</div>
<div style="color:#94a3b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">Gestión inteligente para tu kiosco</div>
</td></tr>
<tr><td style="padding:36px 32px 28px 32px;">
<h1 style="margin:0 0 12px 0;color:#0f172a;font-size:24px;font-weight:800;line-height:1.3;">¡Bienvenido a Kiosco App!</h1>
<p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">Gracias por registrarte. Solo te falta confirmar tu email y ya vas a poder empezar a usar tu cuenta.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:12px;background-color:#0f172a;">
<a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">Confirmar mi cuenta</a>
</td></tr></table>
<p style="margin:28px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Si el botón no funciona, copiá y pegá este link:<br><span style="color:#475569;word-break:break-all;">{{ .ConfirmationURL }}</span></p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">Si vos no creaste una cuenta, podés ignorar este mail.<br>© 2026 Kiosco App · Gestión cloud para cadenas de kioscos.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
```

---

## 2. Invite user

> Se envía cuando el dueño invita a un empleado nuevo con `admin.inviteUserByEmail`.

**Subject:**

```
Te invitaron al equipo en Kiosco App
```

**Body HTML:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invitación a Kiosco App</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
<tr><td style="background-color:#0f172a;padding:28px 32px;text-align:center;">
<div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">KIOSCO APP</div>
<div style="color:#94a3b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">Gestión inteligente para tu kiosco</div>
</td></tr>
<tr><td style="padding:36px 32px 28px 32px;">
<h1 style="margin:0 0 12px 0;color:#0f172a;font-size:24px;font-weight:800;line-height:1.3;">Te sumaron al equipo</h1>
<p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">El dueño de tu kiosco te invitó a usar Kiosco App como empleado. Aceptá la invitación y configurá tu contraseña en menos de un minuto.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:12px;background-color:#0f172a;">
<a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">Aceptar invitación</a>
</td></tr></table>
<p style="margin:28px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Si el botón no funciona, copiá y pegá este link:<br><span style="color:#475569;word-break:break-all;">{{ .ConfirmationURL }}</span></p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">Si no conocés a quien te invitó, podés ignorar este mail sin hacer nada.<br>© 2026 Kiosco App · Gestión cloud para cadenas de kioscos.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
```

---

## 3. Magic Link

> Se envía cuando alguien elige "ingresar sin contraseña" y pide un link de acceso.

**Subject:**

```
Tu link de acceso a Kiosco App
```

**Body HTML:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Link de acceso</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
<tr><td style="background-color:#0f172a;padding:28px 32px;text-align:center;">
<div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">KIOSCO APP</div>
<div style="color:#94a3b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">Gestión inteligente para tu kiosco</div>
</td></tr>
<tr><td style="padding:36px 32px 28px 32px;">
<h1 style="margin:0 0 12px 0;color:#0f172a;font-size:24px;font-weight:800;line-height:1.3;">Entrá a Kiosco App</h1>
<p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">Hacé click en el botón para entrar al sistema sin contraseña. El link es válido por 1 hora y solo puede usarse una vez.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:12px;background-color:#0f172a;">
<a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">Entrar al sistema</a>
</td></tr></table>
<p style="margin:28px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Si el botón no funciona, copiá y pegá este link:<br><span style="color:#475569;word-break:break-all;">{{ .ConfirmationURL }}</span></p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">Si no pediste este link, podés ignorar este mail.<br>© 2026 Kiosco App · Gestión cloud para cadenas de kioscos.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
```

---

## 4. Reset Password

> Se envía cuando alguien hace click en "¿Olvidaste tu contraseña?".

**Subject:**

```
Restablecer tu contraseña de Kiosco App
```

**Body HTML:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restablecer contraseña</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
<tr><td style="background-color:#0f172a;padding:28px 32px;text-align:center;">
<div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">KIOSCO APP</div>
<div style="color:#94a3b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">Gestión inteligente para tu kiosco</div>
</td></tr>
<tr><td style="padding:36px 32px 28px 32px;">
<h1 style="margin:0 0 12px 0;color:#0f172a;font-size:24px;font-weight:800;line-height:1.3;">Restablecer contraseña</h1>
<p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">Pediste cambiar tu contraseña. Hacé click en el botón para crear una nueva. Si no fuiste vos, podés ignorar este mail con tranquilidad — tu contraseña actual sigue activa.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:12px;background-color:#0f172a;">
<a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">Crear contraseña nueva</a>
</td></tr></table>
<p style="margin:28px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Si el botón no funciona, copiá y pegá este link:<br><span style="color:#475569;word-break:break-all;">{{ .ConfirmationURL }}</span></p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">Por seguridad, este link vence en 1 hora y solo puede usarse una vez.<br>© 2026 Kiosco App · Gestión cloud para cadenas de kioscos.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
```

---

## 5. Change Email Address

> Se envía cuando un usuario pide cambiar el email asociado a su cuenta.

**Subject:**

```
Confirmá tu nuevo email en Kiosco App
```

**Body HTML:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmar cambio de email</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
<tr><td style="background-color:#0f172a;padding:28px 32px;text-align:center;">
<div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">KIOSCO APP</div>
<div style="color:#94a3b8;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">Gestión inteligente para tu kiosco</div>
</td></tr>
<tr><td style="padding:36px 32px 28px 32px;">
<h1 style="margin:0 0 12px 0;color:#0f172a;font-size:24px;font-weight:800;line-height:1.3;">Confirmá tu nuevo email</h1>
<p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">Pediste cambiar la dirección de email asociada a tu cuenta de Kiosco App. Hacé click en el botón para confirmarlo.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:12px;background-color:#0f172a;">
<a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.5px;">Confirmar nuevo email</a>
</td></tr></table>
<p style="margin:28px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">Si el botón no funciona, copiá y pegá este link:<br><span style="color:#475569;word-break:break-all;">{{ .ConfirmationURL }}</span></p>
</td></tr>
<tr><td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
<p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">Si no pediste este cambio, ignorá este mail y tu email actual sigue asociado a la cuenta.<br>© 2026 Kiosco App · Gestión cloud para cadenas de kioscos.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
```

---

## Checklist de verificación después de aplicar

Cuando pases a "Nivel B" (dominio propio + mail provider) vas a querer:

- [ ] Comprar dominio (ej `kioscoapp.com.ar` o similar)
- [ ] Configurar Resend o equivalente como SMTP custom de Supabase
- [ ] Validar dominio (DNS: SPF, DKIM, DMARC)
- [ ] Cambiar el remitente a `hola@<tu-dominio>` en Supabase → Auth → SMTP Settings
- [ ] Agregar logo SVG en el header de los 5 templates (reemplazar el wordmark tipográfico actual)
- [ ] Testear deliverability con [mail-tester.com](https://www.mail-tester.com/)

## Variables disponibles en los templates

- `{{ .ConfirmationURL }}` — URL de acción (ya usada en todos)
- `{{ .Token }}` — Token OTP de 6 dígitos (si activás OTP)
- `{{ .TokenHash }}` — Hash del token
- `{{ .SiteURL }}` — URL del sitio configurado en Auth → URL Configuration
- `{{ .Email }}` — Email del destinatario
- `{{ .Data }}` — Metadata arbitraria del usuario
