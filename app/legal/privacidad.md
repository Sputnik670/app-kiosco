# POLÍTICA DE PRIVACIDAD — APP KIOSCO

**Última actualización:** 8 de mayo de 2026
**Versión:** 2.0

---

## RESUMEN RÁPIDO

**En simple:**
- Recopilamos solo lo necesario para que el servicio funcione.
- No vendemos tus datos a nadie.
- Podés exportar o eliminar tus datos cuando quieras (Ley 25.326).
- Usamos cifrado en tránsito y aislamiento por organización (RLS).
- Almacenamos los datos en servidores de Supabase (infraestructura AWS).

---

## 1. INFORMACIÓN QUE RECOPILAMOS

### Información de cuenta (obligatoria):
- Nombre y apellido del administrador
- Email (para login y comunicaciones)
- Contraseña (cifrada por Supabase Auth, nunca la vemos en texto plano)
- Razón social del comercio
- Número de teléfono (opcional)

### Información de uso del servicio:
- **Productos:** nombre, precio, costo, categoría, stock
- **Ventas:** fechas, montos, métodos de pago, cantidades
- **Empleados:** nombre, rol, horarios de asistencia, métricas de gamificación
- **Proveedores:** nombre, saldo, contactos
- **Movimientos de caja:** ingresos, egresos, arqueos
- **Sucursales:** nombre, dirección
- **Datos de cobro electrónico** del dueño cuando los configura (alias, CBU, identificadores de Mercado Pago, certificados ARCA cifrados)

### Información técnica automática:
- Dirección IP (para seguridad y rate-limiting)
- Tipo de navegador y dispositivo
- Sistema operativo
- Logs de acceso (fecha y hora de login)
- Acciones en el sistema (registradas para auditoría en `audit_logs`)

### Lo que NO recopilamos:
- Números de tarjetas de crédito (los pagos por QR se procesan en Mercado Pago).
- Información personal de tus clientes finales (DNI, domicilio, teléfono) salvo cuando el dueño los carga voluntariamente para facturación.
- Cookies de tracking publicitario.
- Datos de menores de edad (servicio B2B).

---

## 2. CÓMO USAMOS TU INFORMACIÓN

### Usos permitidos:

**A) Prestación del servicio:**
- Mostrar tu inventario y ventas.
- Procesar operaciones de caja.
- Generar reportes y métricas.
- Sincronizar entre sucursales.
- Gestionar usuarios y permisos.

**B) Comunicaciones importantes:**
- Actualizaciones del sistema.
- Avisos de seguridad.
- Notificaciones de cambios en estos términos o en la política de privacidad.
- Soporte técnico ante consultas iniciadas por vos.

**C) Mejoras del producto:**
- Entender qué funcionalidades se usan más.
- Identificar bugs y errores.
- Optimizar rendimiento.
- Priorizar nuevas features.

**D) Cumplimiento legal:**
- Responder a órdenes judiciales legítimas.
- Prevenir fraude.
- Cumplir con obligaciones fiscales.

### Usos NO permitidos:
- Vender tus datos a terceros.
- Publicidad dirigida basada en tus datos.
- Compartir con competidores.
- Usar para marketing no relacionado al servicio.
- Crear perfiles de comportamiento para terceros.

---

## 3. ALMACENAMIENTO Y SEGURIDAD DE DATOS

### Ubicación de los servidores:
- **Proveedor de base de datos:** Supabase (PostgreSQL).
- **Región contratada:** sa-east-1 (San Pablo, Brasil) sobre infraestructura AWS.
- **Cumplimiento del proveedor:** SOC 2, ISO 27001.

### Medidas de seguridad implementadas:

**A) En tránsito:**
- Cifrado TLS 1.2+ en todas las conexiones (HTTPS).

**B) En reposo:**
- Cifrado de base de datos provisto por Supabase/AWS.
- Credenciales sensibles (tokens de Mercado Pago, certificados ARCA, claves privadas) cifradas con AES-256-GCM antes de almacenarse.
- Contraseñas almacenadas con hashing seguro por Supabase Auth (nunca en texto plano).

**C) Acceso:**
- Row Level Security (RLS) habilitada en todas las tablas, con políticas separadas por operación (SELECT/INSERT/UPDATE/DELETE).
- Aislamiento total por organización: ninguna organización puede ver datos de otra.
- Autenticación por Supabase Auth con flujo PKCE.
- Logs de auditoría de cambios en tablas críticas.

**D) Backups:**
- Backups automáticos provistos por Supabase según el plan de infraestructura contratado en cada momento.
- Durante la etapa piloto, **te recomendamos exportar regularmente tus datos** desde el panel de administración como backup propio.

### Limitación:
**Ningún sistema es 100% seguro.** Implementamos medidas razonables según estándares de la industria, pero no podemos garantizar seguridad absoluta contra ataques sofisticados.

---

## 4. COMPARTIR INFORMACIÓN CON TERCEROS

### Compartimos solo con:

**A) Proveedores de infraestructura** (cada uno bajo sus propios términos de privacidad):
- **Supabase:** hosting de base de datos y servicios de autenticación.
- **Vercel:** hosting de la aplicación web.
- **Mercado Pago:** procesamiento de pagos por QR (solo los datos mínimos necesarios para emitir y cobrar la orden).
- **ARCA / AFIP:** datos fiscales necesarios para emitir comprobantes electrónicos cuando el dueño activa esa funcionalidad.

**B) Autoridades** (solo cuando la ley nos obliga):
- Orden judicial válida.
- Requerimiento fiscal de AFIP/ARCA.
- Investigaciones penales oficiales.

Antes de cumplir con un pedido de autoridad, verificamos que sea legítimo y que esté correctamente fundado en derecho.

### NUNCA compartimos con:
- Empresas de publicidad.
- Data brokers.
- Competidores.
- Redes sociales.
- Cualquier tercero sin base legal o contractual.

---

## 5. TUS DERECHOS SOBRE TUS DATOS

Según la Ley 25.326 de la República Argentina, tenés derecho a:

### Acceso:
- Ver todos los datos que tenemos sobre vos.
- Solicitud por email a **ramiro.ira92@gmail.com** con asunto "Ejercicio derecho de acceso".
- Respuesta en **10 días hábiles**.

### Rectificación:
- Corregir datos incorrectos o incompletos.
- Desde tu panel de administración (la mayoría de los datos son editables) o por email.

### Eliminación (derecho al olvido):
- Eliminar tu cuenta y todos tus datos.
- **Permanente e irreversible** después de 30 días desde la cancelación.
- Exportá tus datos antes de eliminar.

### Portabilidad:
- Exportar tus datos en formato CSV o JSON.
- Disponible desde el panel: Configuración → Exportar datos (cuando esté habilitado).
- Incluye: productos, ventas, empleados, proveedores, comprobantes.

### Oposición:
- Oponerte al procesamiento de tus datos por motivos legítimos.
- Limitaciones: si el procesamiento es necesario para cumplir el contrato (prestación del servicio) o por obligación legal (ej: retención fiscal AFIP), no podemos suspenderlo.

### Contacto para ejercer derechos:
**Email:** ramiro.ira92@gmail.com
**Asunto sugerido:** "Ejercicio de derecho de [ACCESO / RECTIFICACIÓN / ELIMINACIÓN / PORTABILIDAD / OPOSICIÓN]"
**Incluir:** nombre, email de cuenta, descripción del pedido.

**Plazo de respuesta:** 10 días hábiles.

---

## 6. RETENCIÓN DE DATOS

| Tipo de dato | Retención |
|--------------|-----------|
| Cuenta activa | Mientras uses el servicio |
| Cuenta cancelada | 30 días (para que puedas exportar antes del borrado) |
| Datos fiscales (facturas emitidas, comprobantes ARCA) | 5 años (obligación legal AFIP/ARCA, art. 48 RG 1415/03) |
| Logs de seguridad y auditoría | 90 días |
| Backups | Según el plan de infraestructura vigente |

Después del período de retención, los datos se eliminan de forma permanente.

---

## 7. COOKIES Y TECNOLOGÍAS DE TRACKING

### Cookies que usamos:

**A) Estrictamente necesarias** (no requieren consentimiento explícito porque son indispensables para el servicio):
- Sesión de login (gestionada por Supabase Auth).
- Preferencias de UI (tema, idioma, configuraciones del usuario).

**B) Funcionales** (opcionales):
- Recordar tu sucursal favorita.
- Preferencias de visualización de reportes.

### Lo que NO usamos:
- Google Analytics.
- Facebook Pixel u otros píxeles publicitarios.
- Cookies publicitarias de terceros.
- Tracking entre sitios.

**Tu navegador:** podés bloquear cookies en la configuración de tu navegador, pero esto puede afectar el funcionamiento del servicio (sobre todo el login persistente).

---

## 8. TRANSFERENCIAS INTERNACIONALES

Los datos se almacenan en infraestructura del proveedor Supabase, con región contratada **sa-east-1 (San Pablo, Brasil)**. Eventualmente, los proveedores de infraestructura pueden replicar metadata operativa (logs, métricas) en otras regiones.

**Protección aplicada:**
- Cumplimiento del proveedor con cláusulas contractuales estándar.
- Certificaciones de seguridad internacionales del proveedor (SOC 2, ISO 27001).
- Cumplimiento con la Ley 25.326 argentina mediante el principio de adecuada protección.

**Base legal de la transferencia:** ejecución del contrato de servicio.

---

## 9. MENORES DE EDAD

App Kiosco es un servicio **B2B (Business to Business)** diseñado para uso comercial.

- No está dirigido a menores de 18 años.
- No recopilamos intencionalmente datos de menores.
- Si detectamos una cuenta de un menor, la suspendemos.

Si sos padre o tutor y considerás que recopilamos datos de un menor sin autorización, contactanos a ramiro.ira92@gmail.com.

---

## 10. CAMBIOS A ESTA POLÍTICA

### Notificación de cambios:
- **Cambios sustanciales:** aviso por email a la dirección registrada con al menos **30 días de anticipación**.
- **Cambios menores** (correcciones de redacción, clarificaciones): se reflejan actualizando la fecha al inicio del documento, sin aviso individual.

### Tu aceptación:
- El uso continuado después del aviso implica aceptación.
- Si no aceptás los cambios sustanciales, podés cancelar tu cuenta sin penalidad antes de la entrada en vigencia.

**Recomendación:** revisá esta política periódicamente.

---

## 11. SEGURIDAD DE TU CUENTA

### Tu responsabilidad:
- Mantener tu contraseña segura.
- No compartir credenciales con terceros no autorizados (cada empleado debe tener su propia cuenta nominal).
- Notificarnos de inmediato si detectás acceso no autorizado.
- Usar contraseñas razonablemente fuertes (mínimo 8 caracteres, combinando letras, números y símbolos).

### Si detectás actividad sospechosa:
1. Cambiá tu contraseña de inmediato.
2. Revisá el log de actividad en el panel (cuando esté disponible).
3. Contactanos: ramiro.ira92@gmail.com.

---

## 12. LEGISLACIÓN APLICABLE

Esta política se rige por:
- **Ley 25.326** — Protección de Datos Personales (Argentina).
- **Decreto 1558/2001** — Reglamentación de la Ley 25.326.
- Disposiciones de la **Agencia de Acceso a la Información Pública (AAIP)**.

**Autoridad de aplicación:** Agencia de Acceso a la Información Pública.
**Web:** https://www.argentina.gob.ar/aaip
**Reclamos:** https://www.argentina.gob.ar/aaip/datospersonales/reclama

---

## 13. CONTACTO — DATOS DEL RESPONSABLE

**Responsable del tratamiento de datos:**
Ramiro Irazoqui Soler — App Kiosco

**Email único de contacto:** ramiro.ira92@gmail.com
**País:** Argentina

**Plazo de respuesta a consultas de privacidad:** 10 días hábiles.

---

## RESUMEN DE TUS DERECHOS (Ley 25.326)

| Derecho | ¿Cómo ejercerlo? |
|---------|------------------|
| Acceso | Email a ramiro.ira92@gmail.com |
| Rectificación | Panel de administración o email |
| Supresión | Eliminar cuenta desde panel o por email |
| Portabilidad | Exportar desde el panel cuando esté habilitado, o por email |
| Oposición | Email explicando el motivo |

**Sin costo:** no cobramos por ejercer tus derechos.

---

## RESOLUCIÓN DE DISPUTAS SOBRE PRIVACIDAD

En caso de conflicto sobre privacidad:

1. **Contacto directo:** ramiro.ira92@gmail.com — intentamos resolverlo extrajudicialmente.
2. **AAIP:** podés realizar un reclamo ante la Agencia de Acceso a la Información Pública.
3. **Justicia:** tribunales competentes en la Ciudad Autónoma de Buenos Aires, Argentina.

---

**Versión:** 2.0
**Vigencia:** A partir del 8 de mayo de 2026
**Reemplaza:** Versión 1.0 del 30 de diciembre de 2024 (PlanetaZEGA, en desuso)
