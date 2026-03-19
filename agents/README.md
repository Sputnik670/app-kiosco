# Agentes — App Kiosco

> Actualizado: 19 de marzo de 2026

## Estructura actual: 4 agentes activos

Los 17 agentes originales fueron consolidados en 4 agentes prácticos que se usan en momentos concretos del flujo de trabajo.

| Agente | Carpeta | Cuándo se usa |
|--------|---------|---------------|
| **Inicio de Sesión** | `inicio-sesion/` | SIEMPRE al abrir el proyecto. Sync git, estado, pendientes |
| **Revisión de Código** | `revision-codigo/` | ANTES de escribir o modificar código |
| **Pre-Deploy** | `pre-deploy/` | ANTES de pushear a main (deploy automático) |
| **Comercial** | `comercial/` | Al preparar demos, hablar con clientes, decisiones de producto |

## Base de conocimiento compartida

En `conocimiento/` hay 9 archivos (8 docs + README) que los 4 agentes consultan:

- `BUGS_CONOCIDOS.md` — Errores documentados y cómo evitarlos
- `CHECKLIST_PRE_DEPLOY.md` — Checklist detallado antes de deploy
- `COMPETENCIA.md` — Estrategia vs Sistar, FODA
- `HISTORIAL_DECISIONES.md` — Registro cronológico de decisiones
- `INTEGRACIONES.md` — Estado de Mercado Pago, ARCA, etc.
- `METRICAS_NEGOCIO.md` — KPIs y proyecciones
- `ONBOARDING_CLIENTE.md` — Proceso paso a paso
- `PATRONES_CODIGO.md` — Patrones de código aprobados

## Reportes históricos

En `reportes/` hay 16 reportes de auditorías realizadas entre febrero y marzo 2026.

## Agentes archivados

En `archivo/` están los 17 agentes originales (orquestador, arquitectura, database, seguridad, etc.). Su contenido útil fue absorbido por los 4 agentes activos y la base de conocimiento.

Las carpetas `kiosco-*/` en este directorio contienen un stub que redirige a la nueva estructura.
