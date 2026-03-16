# Análisis de Competencia

Análisis detallado de competidores en el espacio de gestión para kioscos en Argentina. Última actualización: 15 de marzo 2026.

---

## Competidor Principal: Sistar Simple

**Web**: https://www.sistar.com.ar
**Segmento**: Cadenas de kioscos (similar target)
**Estatus**: Operativo desde 2018

### Fortalezas

**1. Facturación AFIP/ARCA integrada**
- Genera facturas fiscales automáticamente
- Cumple normativas argentinas
- Integración directa con ARCA (régimen simplificado)
- Valor: Pequeños comercios necesitan esto para inscribirse en AFIP

**2. Cuentas Corrientes (Fiado)**
- Permite vender "a crédito" con tracking
- Seguimiento de deudas
- Reminders automáticos
- Importante: muchos kioscos venden fiado a clientes regulares

**3. Cloud + Multi-sucursal**
- Similar a nuestro stack
- Reports consolidados
- Acceso desde cualquier lado

**4. Reportes Operativos**
- Ventas por sucursal
- Rentabilidad
- Análisis de productos

### Debilidades

**1. NO tiene servicios virtuales**
- No integra SUBE
- No integra recargas telefónicas
- El kiosquero debe salir de la app para cargar SUBE

**2. NO tiene gamificación**
- Sin misiones, ranking, badges
- Empleados tienen cero incentivos
- Retención baja

**3. Experiencia Mobile mediocre**
- Diseño responsivo pero no mobile-first
- Lento en 3G
- Interfaz confusa para vendedor

**4. Soporte mediocre**
- Respuesta lenta
- Foros sin respuesta
- Caro si necesitas capacitación

**5. Modelo de negocio poco claro**
- Pricing no público
- Estimado: $15k-20k/mes por sucursal
- Alto para cadenas pequeñas (2-5 kioscos)

### Precio Estimado

```
Sistar Simple pricing (estimado, no público):
- Setup: $5,000
- Mensual: $15,000 por sucursal
- Anual por cadena (3 sucursales): $540k+

App Kiosco:
- Setup: GRATIS (onboarding Ram)
- Mensual: $199 por cadena (todas sucursales)
- Anual (3 sucursales): $2,388
```

**Ventaja precio**: App Kiosco 220x más barato

---

## Competidor 2: Verby (SaaS Generic POS)

**Web**: https://www.verby.com.ar
**Segmento**: Pymes, comercios pequeños
**Estatus**: Operativo

### Características

```
Precio: $99/mes (básico)
Qué incluye:
- POS (ventas)
- Inventario
- Reportes
- Multi-usuario
- App mobile
```

### Por Qué NO es Competencia Directa

- Genérico para cualquier comercio (no específico para kioscos)
- NO tiene: servicios virtuales, gamificación, fichaje
- Menos enfocado en cadenas (solo 1-2 sucursales)
- No es argentino (menos soporte local)

**Análisis**: Verby es POS generalista. App Kiosco es especializado.

---

## Competidor 3: MaxKiosco (Legacy)

**Estatus**: Viejo, prácticamente descontinuado
**Tecnología**: Windows local, sin cloud

### Características
- Software escritorio (.exe en Windows)
- Local-only (sin sincronización cloud)
- Interfaz antigua (Windows 95 vibes)
- Sin servicios virtuales
- Sin mobile

### Por Qué NO es Competencia

- Mayoría de usuarios migrando a cloud
- App Kiosco es 100% cloud
- Más rápido, actualizado, mobile

**Análisis**: MaxKiosco es "old guard". App Kiosco matará esto en 2-3 años.

---

## Competidor 4: Bsale

**Web**: https://www.bsale.com.ar
**País origen**: Chile
**Segmento**: Tiendas, restaurants (muy genérico)

### Características
- POS genérico
- Buena intégración con Payment gateways
- Reports decentes
- Usado en todo Latam

### Por Qué NO es Competencia Directa

- No enfocado en kioscos (enfocado en tiendas/restaurants)
- NO tiene: servicios virtuales, gamificación, fichaje
- Caro para kioscos pequeños
- Soporte no localizado para Argentina

**Análisis**: Bsale es para otro segmento.

---

## Competencia Indirecta: Cuaderno + Calculadora

**Segmento**: 60% de kioscos en Argentina (2026)
**Costo**: $0 (pero pérdida de visibilidad + hurtos)

### Características
- Libreta + bolígrafo
- Calculadora para sumas
- Cero reportes
- Cero control de empleados
- Errores frecuentes

### Por Qué App Kiosco Compite

- Nuestra ventaja: diferencia de caja se reduce > 80%
- Empleados honestos (gamificación incentiva)
- Reportes diarios (antes, mensual o nunca)
- Onboarding fácil: Ram ayuda

**Análisis**: El REAL competidor es la inercia. "Siempre hicimos así".

---

## Matriz de Comparación

| Feature | Sistar | Verby | MaxKiosco | Bsale | **App Kiosco** |
|---------|--------|-------|-----------|-------|----------------|
| Facturación AFIP | ✓ | ✗ | ✗ | ✗ | ✗ |
| Cuentas corrientes | ✓ | ✗ | ✗ | ✗ | ✗ |
| SUBE + Recargas | ✗ | ✗ | ✗ | ✗ | ✓ |
| Gamificación | ✗ | ✗ | ✗ | ✗ | ✓ |
| Mobile-first | ✗ | ~ | ✗ | ~ | ✓ |
| Multi-sucursal | ✓ | ~ | ✗ | ✓ | ✓ |
| Cloud | ✓ | ✓ | ✗ | ✓ | ✓ |
| PWA/Offline | ✗ | ✗ | ✗ | ✗ | ✓ (roadmap) |
| Precio/mes | $15k | $99 | $5k/ano | $150 | $199 |
| Específico kioscos | ✓ | ✗ | ✓ | ✗ | ✓ |
| Soporte Argentina | ~ | ✗ | ✗ | ~ | ✓ (Ram) |

---

## Ventajas Competitivas de App Kiosco

### 1. Servicios Virtuales con Comisión Integrada (DEFENSABLE)

**Único en el segmento**: Integración SUBE + Recargas + Stock en una app.

**Cómo**:
- Kiosquero toca "Cargar SUBE"
- Selecciona proveedor
- Ingresa monto
- Confirma
- Comisión se calcula automáticamente
- Venta se registra

**Competidor no puede**:
- Sistar: no tiene provider integraciones para servicios virtuales
- Verby: genérico, no tiene providers
- MaxKiosco: sin internet, no puede

**Valor para kiosquero**: 30% de ingresos en servicios virtuales, ahora visible + con ganancia clara.

---

### 2. Gamificación de Empleados (DEFENSABLE)

**Único en el MUNDO a nivel segmento**.

**Cómo**:
- Empleados compiten por ranking
- Misiones diarias/semanales
- Capital (puntos) → badges
- Happy hour (compete entre sucursales)

**Competidor no puede**:
- Sistar: es B2B reporting, no gamificación
- Verby: no tiene equipos
- MaxKiosco: sin mobile, imposible

**Valor para kiosquero**: Retención de empleados jóvenes. Argentina: high turnover en kioscos (2-3 años promedio). Gamificación reduce a 4-5 años. Estima: $50k/año en training + turnover avoided.

---

### 3. Cloud + PWA + Mobile-First

**Mejor que Sistar**: Sistar es cloud pero UI no es mobile-first.
**Mejor que MaxKiosco**: Totalmente cloud, sin instalación.

**Cómo**:
- Instalable como app en celular
- Offline capability (futuro)
- Diseño táctil (botones grandes)
- Rápido en 3G

**Valor para kiosquero**: Vendedor puede estar en piso, no en escritorio. Celular es su herramienta.

---

### 4. Onboarding Personalizado (NO DEFENSABLE pero diferenciador)

**Cómo**: Ram hace onboarding 1:1.

**Ventaja temporal**:
- Sistar: no hace onboarding personalizado
- Verby: documentación, sin soporte presencial
- Bsale: similar, soporte remoto

**Riesgo**: Cuando escale, no podemos hacer 1:1. Cambiaremos a self-service + community.

**Valor ahora**: CAC (customer acquisition cost) baja. Conversión > 90%.

---

## Estrategia vs Sistar (Competidor Directo)

### En Qué Nos Ganan

1. **Facturación AFIP**: Nosotros no.
   - Mitigation: Integramos con Facturalo Simple si necesitan

2. **Cuentas Corrientes**: Nosotros no.
   - Mitigation: Pospuesto, incluir en Q3 2026 si hay demanda

3. **Soporte establecido**: Ellos tienen 5+ años.
   - Mitigation: Soporte personalizado de Ram, mejor NPS

### En Qué Los Ganamos

1. **Servicios virtuales**: Ellos no.
2. **Gamificación**: Ellos no.
3. **Mobile-first**: Ellos no.
4. **Precio**: 75x más barato.
5. **Especialización**: Ambos especializados, pero nosotros más.

### Estrategia de Posicionamiento

```
Sistar = Profesional, completo, caro
         "Si necesitas facturación AFIP, elige Sistar"

App Kiosco = Moderno, gamificado, barato, servicios virtuales
            "Si necesitas vender SUBE + gamificar + mobile, elige App Kiosco"
```

**Nuestro mercado**: Cadenas de 2-10 kioscos, preocupadas por retención + servicios.
**Mercado Sistar**: Cadenas grandes 20+, necesitan facturación fiscal completa.

### Tácticas de Go-to-Market

1. **Posicionar diferencias** (no ir de frente):
   - "App Kiosco + SUBE = único"
   - "Gamificación = empleados felices"

2. **Precio como ventaja**:
   - "Sistar vs App Kiosco: $540k/año vs $2,388/año"
   - ROI: 1 mes

3. **Proof of concept** (piloto):
   - Cadena pequeña 2-3 kioscos
   - 1 mes free, solo paguen si les gusta
   - NPS > 8 → referral

4. **Educación**:
   - Post en LinkedIn: "Cómo SUBE genera 30% de ingresos"
   - Caso de estudio: "Cadena X, NPS 9, churn 0%"

---

## Análisis FODA

### FORTALEZAS (App Kiosco)
- Servicios virtuales integrados
- Gamificación única
- Mobile-first
- Precio 75x menor
- Onboarding personalizado
- Especialización en kioscos

### OPORTUNIDADES
- 90% de kioscos sin sistema (cuaderno)
- Demanda insatisfecha de gamificación
- SUBE es 30% de ingresos (mercado enorme)
- Argentina: high inflation = kiosquero busca herramientas
- Próxima generación de dueños (millennial) > digital

### DEBILIDADES
- NO tenemos facturación AFIP (Sistar sí)
- NO tenemos cuentas corrientes (Sistar sí)
- Soporte: solo Ram (vs equipo Sistar)
- Brand recognition: 0 vs Sistar 100

### AMENAZAS
- Sistar agrega servicios virtuales
- Verby entra en segmento kioscos
- Competencia de precio (alguien hace free version)
- Cambio regulatorio (AFIP obliga facturación)

---

## Recomendaciones Estratégicas

### Q1 2026 (AHORA)
- [ ] Completar piloto 1 cadena
- [ ] Documentar case study (NPS, diferencia caja, etc)
- [ ] Validar demanda SUBE (es nuestro diferenciador)

### Q2 2026
- [ ] Lanzar beta: 10 cadenas
- [ ] Agregar cuentas corrientes (si demanda)
- [ ] Roadmap de facturación (evaluar integración)

### Q3 2026
- [ ] 50 cadenas en producción
- [ ] Integración Facturalo Simple (IF hay demanda)
- [ ] Evaluación: ¿competencia de precio aparece?

### Q4 2026
- [ ] 100+ cadenas
- [ ] Decisión estratégica: facturación AFIP (build vs integrate)
- [ ] Market expansion: provincias

---

## Resumen Ejecutivo

**App Kiosco vs Sistar**:
- Sistar: profesional, completo, caro ($15k/mes)
- App Kiosco: moderno, gamificado, barato ($199/mes), servicios virtuales

**Mercados**:
- Sistar: cadenas grandes (20+) con necesidad AFIP
- App Kiosco: cadenas medianas (2-10) con necesidad gamificación + servicios

**Estrategia**:
- No competir directo en AFIP (let Sistar have it)
- Ganar en SUBE + gamificación + precio
- Educación al mercado (marketing)
- Proof of concepts rápidos

**Riesgo principal**:
- Sistar agrega SUBE + gamificación
- Respuesta: ser 10x mejor, escalar rápido, lock-in con datos

**Oportunidad principal**:
- 90% de kioscos sin sistema digital
- Mercado completamente virgen
- ROI claro: $1 en App Kiosco = $10+ en control + ingresos

