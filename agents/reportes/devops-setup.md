# Reporte DevOps Setup

> Agente: kiosco-devops
> Fecha: 2026-02-26
> Estado del deploy: LOCAL ONLY (pre-produccion)

---

## Resumen

Se configuraron los tres pilares de infraestructura que faltaban segun SPECIFICATIONS.md (seccion Infraestructura):

| Componente | Antes | Ahora |
|------------|-------|-------|
| CI/CD | No habia pipeline | GitHub Actions configurado |
| Health check endpoint | No existia | `/api/health` creado |
| Documentacion de deploy | Existia parcial | Actualizada con CI/CD, env vars, health check |

---

## Archivos creados/modificados

### Nuevo: `.github/workflows/ci.yml`

Pipeline de integracion continua con GitHub Actions.

- **Trigger:** push a `main`, pull request a `main`
- **Concurrencia:** cancela runs anteriores del mismo branch
- **Timeout:** 15 minutos
- **Cache:** npm via `actions/setup-node` cache
- **Pasos:**
  1. Checkout (`actions/checkout@v4`)
  2. Setup Node.js 20 (`actions/setup-node@v4` con cache npm)
  3. `npm ci` (instalacion determinista)
  4. `npx tsc --noEmit` (verificacion de tipos)
  5. `npx vitest run` (146 tests unitarios)
  6. `npm run build` (compilacion Next.js)
- **Secrets necesarios en GitHub:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- NO hace deploy automatico (manual via Vercel)

### Nuevo: `app/api/health/route.ts`

Endpoint de health check que verifica:

- Estado general de la app (`status: "ok"`)
- Timestamp UTC del servidor
- Version de la app (desde `package.json`)
- Conectividad con Supabase (`"connected"` o `"error"`)
- Uptime del proceso Node.js
- Latencia de respuesta total y de la DB

Caracteristicas:
- Usa `createClient` de `@/lib/supabase-server` (consistente con el resto del proyecto)
- Verifica conectividad via `supabase.auth.getSession()` (liviano, sin necesidad de RLS)
- Siempre retorna HTTP 200 (incluso si Supabase esta caido, reporta `supabase: "error"`)
- Headers `Cache-Control: no-store` para evitar cache
- `dynamic = 'force-dynamic'` para Next.js
- No expone informacion sensible (ni claves ni datos de usuario)

### Modificado: `docs/DEPLOYMENT.md`

Se agregaron tres nuevas secciones:
1. **Variables de Entorno** - tabla completa de todas las env vars necesarias y donde configurarlas
2. **CI/CD Pipeline** - descripcion del pipeline, secrets necesarios, pasos para configurar
3. **Health Check** - formato de respuesta, campos, como verificar el deploy, integracion con monitoreo externo

---

## Checklist de produccion

- [x] Build compila sin errores (verificado 2 veces)
- [x] 146 tests pasan (verificado 2 veces)
- [x] `.env.local` y `.env*` en `.gitignore` (verificado)
- [x] CI/CD pipeline creado (`.github/workflows/ci.yml`)
- [x] Health check endpoint creado (`/api/health`)
- [x] Documentacion de deploy actualizada
- [ ] Secrets configurados en GitHub Actions (pendiente - requiere acceso al repo)
- [ ] Monitoreo activo (Sentry) - no implementado
- [ ] Alertas configuradas - no implementado

---

## Variables de entorno a configurar

### En GitHub Actions (Secrets)

| Secret | Descripcion |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publica de Supabase |

### En Vercel (Environment Variables)

| Variable | Environments |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo si se necesita admin (server only) |

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|-------------|---------|------------|
| Deploy rompe funcionalidad existente | Media | Alto | CI pipeline valida build + 146 tests antes |
| Secrets no configurados en GitHub | Alta (primera vez) | Medio | Documentado paso a paso en DEPLOYMENT.md |
| Supabase free-tier se pausa | Baja | Alto | Workflow `keep-alive.yml` hace ping semanal |
| Sin monitoreo de errores en produccion | Alta | Alto | Implementar Sentry (proximo paso) |

---

## Proximos pasos (recomendados)

### Prioridad alta
1. **Configurar secrets en GitHub Actions** - Para que el CI pipeline funcione al pushear
2. **Integrar Sentry** - `npx @sentry/wizard@latest -i nextjs` para error tracking
3. **Monitoreo externo** - Conectar `/api/health` a UptimeRobot o similar (gratis)

### Prioridad media
4. **Preview deploys** - Configurar Vercel para generar preview URL en cada PR
5. **Agregar linting al CI** - Paso adicional `npx eslint .` en el pipeline
6. **Branch protection rules** - Requerir CI passing antes de merge a main

### Prioridad baja
7. **Staging environment** - Proyecto Supabase separado para testing
8. **Performance budget** - Lighthouse CI para validar bundle size < 300KB
9. **Dependabot** - Actualizacion automatica de dependencias
