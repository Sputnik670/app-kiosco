# Auditoria de Onboarding

**Fecha**: 2026-03-02
**Agente**: kiosco-onboarding
**Estado del onboarding**: FUNCIONAL

---

## Flujo actual mapeado

| Paso | Pantalla/Componente | Campos | Taps | Tiempo est. | Problemas |
|------|---------------------|--------|------|-------------|-----------|
| 1. Llegar a la app | `page.tsx` | 0 | 0 | 0s | Muestra loader, luego auth |
| 2. Login/Registro | `AuthForm` | email | 1 | 30s | Magic link - espera email |
| 3. Verificar email | Correo | 1 click | 1 | 60-120s | Dependencia externa (email) |
| 4. Crear credenciales | `ProfileSetup` | nombre, password, rol | 4 | 60s | Bueno, pero pide rol |
| 5a. (Dueno) Dashboard | `DashboardDueno` | - | 0 | 0s | Auto-redirect |
| 5b. (Empleado) QR scan | `EscanearQRFichaje` | QR | 1 | 15s | Empleado necesita QR fisico |
| 6. Seleccionar sucursal | `SeleccionarSucursal` | 1 | 1 | 5s | Solo dueno |
| 7. Primera venta | Crear productos primero | N | muchos | 5-15min | Sin catalogo pre-cargado |

## Time-to-Value

- **Tiempo estimado registro -> primera venta**: ~20-30 minutos (dueno)
- **Pasos totales**: 7 pasos
- **Taps totales**: ~15+ (sin contar carga de productos)
- **Cuello de botella**: Magic link (espera email) + carga manual de productos

### Comparacion con target ideal

| Etapa | Target | Actual | Gap |
|-------|--------|--------|-----|
| Registro | 2 min | 2-3 min (magic link delay) | CERCA |
| Setup org + sucursal | 3 min | 1 min (automatico via RPC) | MEJOR |
| Cargar productos | 5 min (20 productos) | 15+ min (manual 1x1) | LEJOS |
| Primera venta | 5 min | 2 min | MEJOR |
| Invitar empleado | 5 min | 3 min | MEJOR |

## Fricciones identificadas

### F1 - Magic link como unico metodo de registro
- **Paso**: 2-3
- **Friccion**: El dueno tiene que ir a su email, buscar el link, hacer click, volver a la app
- **Impacto**: 60-120 segundos de espera muerta. Muchos abandonan.
- **Fix**: Agregar registro con email + password directo (sin magic link)

### F2 - Sin catalogo pre-cargado
- **Paso**: 7
- **Friccion**: El dueno tiene que cargar productos uno por uno antes de poder vender
- **Impacto**: 15+ minutos de trabajo tedioso antes de ver valor
- **Fix**: Ofrecer catalogo base de productos tipicos de kiosco argentino (~200 productos con precios estimados)

### F3 - Empleado necesita QR fisico
- **Paso**: 5b
- **Friccion**: El empleado nuevo tiene que tener el QR del local para poder entrar
- **Impacto**: Si el dueno no imprimo el QR, el empleado no puede trabajar
- **Fix**: Permitir seleccion manual de sucursal como fallback (con validacion)

### F4 - Sin guia paso a paso (wizard)
- **Paso**: Todos
- **Friccion**: No hay wizard de "Paso 1 de 5" que guie al usuario nuevo
- **Impacto**: El dueno no sabe que hacer despues de crear su cuenta
- **Fix**: Implementar onboarding wizard: org -> sucursal -> cargar 5 productos -> hacer venta de prueba -> invitar empleado

## Multi-tenant

| Aspecto | Estado | Detalles |
|---------|--------|---------|
| Creacion atomica org/branch/membership | SI | RPC `completeProfileSetupAction` crea todo en una transaccion |
| RLS activo desde momento 0 | SI | Policies en tablas con organization_id |
| Manejo errores parciales | PARCIAL | Si falla el RPC, el usuario queda sin membership |
| Aislamiento entre orgs | SI | Todas las queries filtran por org_id via RLS |
| Un usuario en multiples orgs | NO | Solo 1 membership activa por usuario |
| Planes/limites (free/pro) | NO IMPLEMENTADO | Sin sistema de planes |

## Flujo del empleado invitado

**Flujo actual**:
1. Dueno va a "Mi Equipo" -> "Invitar Empleado" (`invitar-empleado.tsx`)
2. Ingresa nombre + email del empleado
3. Se crea una invitacion en la DB
4. Empleado recibe email con magic link
5. Empleado abre link -> `ProfileSetup` detecta invitacion automaticamente
6. Empleado solo ve opcion "Soy Empleado" (rol pre-seleccionado)
7. Crea nombre + password -> membership creada automaticamente
8. Redirige a QR scan -> ficha -> trabaja

**Evaluacion**: BUENO - La deteccion automatica de invitacion es elegante.

**Problemas**:
- Depende de magic link (mismo problema que F1)
- Si el email no llega, no hay alternativa
- No hay link/QR directo que el dueno pueda compartir por WhatsApp

## Features faltantes

| Feature | Impacto en conversion | Esfuerzo |
|---------|----------------------|----------|
| Catalogo pre-cargado (200 productos tipicos) | CRITICO - 10x mas rapido | MEDIO |
| Registro con password (sin magic link) | ALTO - elimina friccion principal | BAJO |
| Onboarding wizard paso a paso | ALTO - guia al usuario | MEDIO |
| Link de invitacion por WhatsApp | ALTO - canal natural del dueno | BAJO |
| Sistema de planes (free/pro/enterprise) | CRITICO para monetizar | ALTO |
| Demo/sandbox sin registro | MEDIO - probar antes de comprar | MEDIO |

## Recomendaciones

1. **Prioridad 1**: Agregar registro email+password (eliminar dependencia magic link)
2. **Prioridad 2**: Catalogo pre-cargado de productos tipicos argentinos
3. **Prioridad 3**: Onboarding wizard con progreso visible
4. **Prioridad 4**: Link de invitacion compartible por WhatsApp
5. **Prioridad 5**: Sistema de planes para monetizacion
