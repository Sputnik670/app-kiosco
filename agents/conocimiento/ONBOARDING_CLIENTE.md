# Proceso de Onboarding de Cliente

Guía paso a paso para onboardear una nueva cadena de kioscos. Rol: Ram (dueño/tech-lead). Duración estimada: 1-2 horas.

---

## Pre-Requisitos

### Qué Necesita el Dueño
- Email válido (para magic link de registro)
- Celular con WhatsApp (para comunicación)
- Conexión a internet (al menos para onboarding)
- Cuenta Mercado Pago (usuario normal, no developer)
- Nota: NO requiere conocimiento técnico

### Qué Necesita Ram
- Acceso a Vercel (para verificar deploy)
- Acceso a Supabase (para crear org en DB)
- Acceso a email para enviar magic links
- Disponibilidad: ~1-2 horas presenciales o por video

---

## Paso 1: Registrar Dueño en Auth (5 min)

**Quién**: Ram
**Dónde**: Supabase > Auth > Users

```sql
-- Opción A: Usar magic link (RECOMENDADO)
-- Supabase genera automáticamente:
-- 1. Email to: dueño@email.com
-- 2. Magic link con expiry 24h
-- 3. Dueño toca link → se registra

-- Opción B: Si Supabase Auth no está disponible
-- (Fallback, no recomendado)
-- Ram crea user manual + establece password temporal
```

**Checklist**:
- [ ] Magic link enviado al email
- [ ] Dueño recibió email
- [ ] Dueño tocó el link
- [ ] Dueño está registrado y autenticado

**Resultado**: Usuario en `auth.users` + primera sesión iniciada

---

## Paso 2: Crear Organización (2 min)

**Quién**: Ram (vía dashboard owner)
**Dónde**: app-kiosco-chi.vercel.app > Administración > Crear Organización

O vía SQL directo (si dashboard no existe):

```sql
INSERT INTO organizations (
  name,
  owner_id,
  created_at
) VALUES (
  'Cadena ABC Kioscos',
  'USER_ID_DEL_DUEÑO',
  NOW()
);

-- Guardar el org_id que se genera
-- Será: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Checklist**:
- [ ] Nombre de cadena correcto
- [ ] Owner_id es usuario del paso 1
- [ ] org_id generado (guardar)
- [ ] Dueño puede ver la organización en la app

**Resultado**: Organización creada, dueño es owner

---

## Paso 3: Configurar Sucursales (Branch Setup) (10 min)

**Quién**: Dueño (con asistencia de Ram via WhatsApp/video)
**Dónde**: app-kiosco-chi.vercel.app > Administración > Sucursales

**Para cada sucursal**:

```
Nombre:         "Kiosco Centro" (ej: calle, zona)
Ubicación:      Dirección completa
Teléfono:       Número de contacto
Gerente:        Nombre empleado responsable
Horario:        Ej: 9am - 9pm
```

**Ejemplo de 3 sucursales**:
| Sucursal | Ubicación | Gerente |
|----------|-----------|---------|
| Centro | Av Corrientes 1000 | Juan |
| Flores | Av Acoyte 2000 | María |
| Liniers | Av Donato Álvarez 500 | Carlos |

**Checklist**:
- [ ] Todas las sucursales cargadas
- [ ] Cada una con nombre único
- [ ] Ram verifica en Supabase

**Resultado**: Branches creadas, listos para stock

---

## Paso 4: Cargar Stock Inicial (30-45 min)

**Quién**: Ram (con dueño sentado al lado)
**Dónde**: app-kiosco-chi.vercel.app > Inventario > Agregar Producto

**Productos para cargar**: Los 20-30 principales

**Datos por producto**:
```
Código SKU:     (opcional, ej: LECHE-001)
Nombre:         Leche entera La Serenísima
Categoría:      Lácteos
Precio costo:   $25.50
Precio venta:   $45.00
Stock inicial:  100 unidades (por sucursal)
```

**Cómo acelerar**:
1. Ram prepara lista Excel con productos + precios
2. Dueño dicta mientras Ram carga
3. Para productos repetidos, copiar + editar

**Atajos**:
- Usar "Importar desde Excel" si existe (future feature)
- O cargar 20 productos principales, resto puede hacerse después

**Checklist**:
- [ ] Stock inicial cargado
- [ ] Precios verificados
- [ ] Al menos 20 productos principales
- [ ] Stock distribuido en sucursales (si hay > 1)

**Resultado**: Dueño puede hacer su primera venta

---

## Paso 5: Conectar Mercado Pago (5-10 min)

**Quién**: Dueño (con asistencia Ram)
**Dónde**: app-kiosco-chi.vercel.app > Ajustes > Conectar con Mercado Pago

**Flujo**:
1. Dueño toca botón "Conectar con MP"
2. Redirige a: https://auth.mercadopago.com/oauth/authorize?...
3. Dueño inicia sesión con su cuenta normal (no developer)
4. MP pide: "¿Permitir que App Kiosco acceda a tu cuenta?"
5. Dueño toca "Sí"
6. Vuelve a la app, token guardado

**Checklist**:
- [ ] OAuth flujo completado sin errores
- [ ] Token guardado en DB (verificar en Supabase)
- [ ] Botón en caja ahora dice "Pagar con MP QR"

**Si falla**:
- Verificar que dueño tiene cuenta MP (crearla en mercadopago.com si no)
- MP_APP_ID y MP_REDIRECT_URI correctos en Vercel
- MP_ENCRYPTION_KEY 64 hex chars

**Resultado**: Pagos con QR listos

---

## Paso 6: Invitar Empleados (5-10 min)

**Quién**: Dueño (independiente)
**Dónde**: app-kiosco-chi.vercel.app > Equipo > Invitar Empleado

**Para cada empleado**:
```
Email:          empleado@email.com (debe tener email)
Nombre:         Juan Pérez
Rol:            Vendedor | Gerente
Sucursal:       Centro (asignar a qué kiosco trabaja)
Salario:        $50,000/mes (opcional, para comisiones)
```

**Checklist**:
- [ ] Todos los empleados invitados
- [ ] Emails correctos (sin typos)
- [ ] Cada uno asignado a su sucursal
- [ ] Ram verifica en Supabase: `memberships` table

**Resultado**: Empleados reciben magic link por email

**Qué pasa después**:
- Empleado toca link en email
- Se registra y obtiene acceso
- Solo ve su sucursal
- Puede fichar, vender, ver gamificación

---

## Paso 7: Generar QR de Fichaje (10 min)

**Quién**: Ram
**Dónde**: app-kiosco-chi.vercel.app > Equipo > Generar QR Fichaje

**Para cada sucursal**:
1. Seleccionar sucursal (ej: "Centro")
2. Generar QR entrada
3. Generar QR salida
4. Imprimir en papel (A4, normal)
5. Pegar QR en entrada del kiosco (entrada/salida)

**Ejemplo**:
```
┌─────────────────────┐
│  Entrada           │
│  ┌─────────────┐   │
│  │  [QR CODE]  │   │
│  │ Toca con    │   │
│  │ celular     │   │
│  └─────────────┘   │
└─────────────────────┘
```

**Checklist**:
- [ ] QR generado para cada sucursal
- [ ] Impreso en tamaño legible (min 5x5cm)
- [ ] Colocado en puerta de entrada
- [ ] QR salida en lugar visible (ej: atrás de puerta)

**Resultado**: Empleados pueden fichar con celular

---

## Paso 8: Instalar PWA (Progressive Web App) (5 min)

**Quién**: Cada empleado (independiente)
**Dónde**: app-kiosco-chi.vercel.app en celular

**Instrucciones**:
1. Abrir Chrome en celular
2. Ir a: https://app-kiosco-chi.vercel.app
3. Tocar menú (3 puntitos) → "Instalar"
4. Confirmar "Instalar App"
5. App instalada en pantalla de inicio

**Para iOS (Safari)**:
1. Abrir Safari
2. Tocar compartir → "Agregar a pantalla de inicio"

**Checklist**:
- [ ] App instalada en todos los celulares
- [ ] Funciona sin internet (si es PWA offline)
- [ ] Ícono visible en pantalla de inicio

**Resultado**: Empleados tienen app en celular, acceso offline

---

## Paso 9: Capacitación en Vivo (15-30 min)

**Quién**: Ram (en video call o presencial)
**Público**: Dueño + empleados principales

**Agenda**:

### A. Registrar una venta (5 min)
```
Flujo: Caja > Registrar venta
1. Toca "Registrar venta"
2. Busca producto (ej: "Leche")
3. Ingresa cantidad (ej: 2)
4. Ve precio total ($90)
5. Selecciona método pago:
   - Efectivo
   - Mercado Pago (QR)
   - Otro
6. Confirma venta
✓ Venta registrada
```

### B. Ver caja de hoy (3 min)
```
Flujo: Dashboard > Mi Caja
Muestra:
- Total vendido hoy: $1,500
- Método más usado: Efectivo 70%
- Diferencia física vs sistema (si cierre)
```

### C. Fichar entrada/salida (2 min)
```
Flujo: Equipo > Fichar
1. Toca "Fichar entrada"
2. Escanea QR de puerta con cámara
3. ✓ "Entrada registrada a las 9:05am"
---
Al salir:
1. Toca "Fichar salida"
2. Escanea QR
3. ✓ "Salida registrada a las 6:00pm"
Sistema registra: 8h 55min trabajadas
```

### D. Ver stock de sucursal (2 min)
```
Flujo: Inventario > Stock
Muestra:
- Todos los productos
- Cantidad por sucursal
- Stock bajo: marca en rojo si < reorden
```

### E. Ver ranking / gamificación (3 min)
```
Flujo: Equipo > Ranking
Muestra:
- Top 3 vendedores (por comisión)
- Misiones activas (ej: "Vender 10 SUBE hoy")
- Capital (puntos) por empleado
- Badges ganados
```

**Checklist**:
- [ ] Todos entienden cómo vender
- [ ] Todos pueden fichar
- [ ] Dueño puede ver reportes
- [ ] Preguntas respondidas

**Resultado**: Team ready to operate

---

## Paso 10: Seguimiento Primer Mes (ongoing)

**Quién**: Ram (contacto por WhatsApp)
**Frecuencia**: Diario semana 1, 3x/semana semana 2-4

**Día 1**:
- "Hola Juan, ¿todo funciona ok? ¿Alguna duda?"
- Responder issues técnicos
- Verificar que vendieron al menos 1 venta

**Día 2-7** (Semana 1):
- Diario: revisar que usan app (ver sales, fichajes)
- Seguimiento: diferencia de caja
- Si < 80% registran ventas: entrenar + resolver bloqueos

**Semana 2-4**:
- 3x/semana: "¿Cómo va? ¿Qué necesitas?"
- Reportar NPS (pregunta: "¿Qué tan probable recomendarías esto?")
- Bug fixes si hay
- Entrenar features avanzadas (si quieren)

**Checklist semanal**:
- [ ] Organización activa (> 1 venta/día)
- [ ] Empleados fichando
- [ ] Diferencia de caja < $10k
- [ ] Dueño responde mensajes

**Si se estanca**:
- Contactar vía WhatsApp (más rápido que email)
- Video call corta (5-10 min)
- Revisar el problema real
- Solucionar juntos

---

## Plantilla de Email (Magic Link)

```
Subject: Bienvenido a App Kiosco

Hola Juan,

Bienvenido a App Kiosco, el sistema de gestión para tu cadena de kioscos.

Toca el siguiente link para completar tu registro:

[MAGIC_LINK]

Este link expira en 24 horas.

¿Preguntas? Escribeme por WhatsApp: +54 9 1234-5678

Saludos,
Ram
App Kiosco
```

---

## Checklist Final de Onboarding

Imprimir esta lista, marcar mientras avanzas:

```
ONBOARDING CHECKLIST

Cadena: ___________________
Dueño: ___________________
Fecha: ___________________

□ Paso 1: Dueño registrado y autenticado
□ Paso 2: Organización creada
□ Paso 3: Sucursales configuradas (____ sucursales)
□ Paso 4: Stock cargado (____ productos principales)
□ Paso 5: Mercado Pago conectado
□ Paso 6: Empleados invitados (____ empleados)
□ Paso 7: QR fichaje generado e impreso
□ Paso 8: PWA instalada en celulares (____ devices)
□ Paso 9: Capacitación completada
□ Paso 10: Seguimiento programado (próximo: ________)

VALIDACIÓN:
□ Primera venta registrada
□ Empleado fichó con QR
□ Dueño puede ver caja diaria
□ Diferencia de caja < $10k

Notas:
_________________________________________________
_________________________________________________

Estado: □ Completado □ En progreso □ Paused

Firma Ram: __________ Fecha: __________
```

---

## Tiempo Estimado por Paso

| Paso | Responsable | Tiempo | Total |
|------|-------------|--------|-------|
| 1. Auth | Ram | 5 min | 5 min |
| 2. Org | Ram | 2 min | 7 min |
| 3. Branches | Dueño + Ram | 10 min | 17 min |
| 4. Stock | Ram + Dueño | 30 min | 47 min |
| 5. MP OAuth | Dueño + Ram | 5 min | 52 min |
| 6. Empleados | Dueño | 10 min | 62 min |
| 7. QR fichaje | Ram | 10 min | 72 min |
| 8. PWA | Empleados | 5 min | 77 min |
| 9. Capacitación | Ram | 30 min | 107 min |
| 10. Seguimiento | Ram | ongoing | - |

**Total**: ~1.5-2 horas sesión inicial + 10-15 min/día semana 1

---

## Troubleshooting Común

### "No me llega el magic link"
- Revisar spam/junk
- Regenerar link desde Supabase > Auth > Users
- Si es Outlook: marcar como "No spam"

### "No puedo conectar Mercado Pago"
- Verificar que dueño tiene cuenta MP (crear en mercadopago.com)
- MP_APP_ID correcto en Vercel
- MP_REDIRECT_URI debe ser: https://app-kiosco-chi.vercel.app/api/mercadopago/oauth/callback

### "Stock no se ve en la caja"
- Verificar que producto tiene stock > 0
- Que empleado ve la sucursal correcta
- Si es multi-sucursal, verificar que stock está asignado a esa sucursal

### "QR no scanea"
- Impreso en tamaño mínimo (5x5cm)
- Código no está dañado (borrado, mojado)
- Re-generar QR si es necesario
- Probar con app nativa de câmara primero

### "Diferencia de caja alta ($10k+)"
- Revisar que todas las ventas se registraron
- Checklist de empleados: ¿aprendieron a registrar?
- Problema: seguían anotando en libreta
- Solución: reentrenamiento, verificar cada entrada

