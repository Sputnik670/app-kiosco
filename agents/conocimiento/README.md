# Knowledge Base para Agentes

Base de conocimiento centralizada para que todos los agentes y desarrolladores trabajen desde el mismo contexto. Estos documentos forman la "verdad única" del proyecto App Kiosco.

---

## Cómo Usar Esta Base de Conocimiento

1. **Antes de trabajar**: Lee el documento relevante a tu tarea
2. **Durante desarrollo**: Usa estos docs como referencia (patrones, checklist, integrations)
3. **Al completar feature**: Actualiza la sección relevante
4. **Para onboarding nuevo agente**: Lee TODO primero (30 min)

---

## Documentos (8 Totales)

### 1. BUGS_CONOCIDOS.md
**Qué**: Registro de bugs encontrados, cómo se corrigieron, y patrones para evitarlos.

**Cuándo leer**:
- Antes de trabajar con DECIMAL (precios, dinero)
- Antes de crear server actions
- Si encuentras error HMAC, RLS, o oauth

**Sections**:
- 8 bugs documentados con soluciones
- Checklist de auditoría
- Ejemplo de código correcto vs incorrecto

---

### 2. PATRONES_CODIGO.md
**Qué**: Estándares de código aprobados. Cómo escribir para App Kiosco.

**Cuándo leer**:
- Antes de escribir cualquier servidor action
- Antes de crear componente
- Antes de hacer queries a Supabase
- Cuando necesitas refresh en "cómo hacemos las cosas aquí"

**Sections**:
- 10 patrones con templates listos para copiar
- Server actions, client components, forms
- Color conventions, mobile-first, error handling

---

### 3. CHECKLIST_PRE_DEPLOY.md
**Qué**: Verificaciones obligatorias antes de push a main.

**Cuándo usar**:
- SIEMPRE antes de `git push main`
- Para cada PR/feature completada
- Pre-launch de integración nueva

**Sections**:
- 10 checks automatizables (TypeScript, grep, etc)
- QA manual (360px testing, touch targets)
- Troubleshooting si algo falla

---

### 4. INTEGRACIONES.md
**Qué**: Estado de todas las integraciones (Supabase, Vercel, MP, SUBE, Cargas Virtuales).

**Cuándo leer**:
- Antes de trabajar con Mercado Pago
- Antes de agregar proveedor de servicios virtuales
- Para entender flujo de webhook
- Variables de entorno, tablas, endpoints

**Sections**:
- Mercado Pago QR (completo con OAuth, webhook, polling)
- SUBE + Cargas Virtuales (búsqueda, comisión)
- Supabase (tablas, RLS, backups)
- Vercel (deployment, logs)

---

### 5. HISTORIAL_DECISIONES.md
**Qué**: Por qué se hizo cada decisión, cuándo, quién aprobó, y si es reversible.

**Cuándo leer**:
- Cuando preguntes "¿por qué?" sobre arquitectura
- Antes de proponer cambio estratégico
- Para entender el "why" detrás de cada feature
- Matriz de decisiones + estado actual

**Sections**:
- 8 decisiones aprobadas (con motivación)
- 7 decisiones descartadas (y por qué)
- 3 decisiones reversibles (pueden cambiar)
- Quién aprueba qué (Ram vs Claude)

---

### 6. METRICAS_NEGOCIO.md
**Qué**: KPIs del piloto, cómo medirlos, targets, y modelo de negocio.

**Cuándo leer**:
- Antes del piloto (entender qué medimos)
- Cuando necesites evaluar éxito
- Para entender pricing, costos, revenue
- Matriz de métricas + ciclo de revisión

**Sections**:
- 6 KPIs del piloto (time-to-sale, diferencia caja, etc)
- Queries SQL para medir cada métrica
- Análisis: qué significa qué número
- Modelo de negocio: pricing, ingresos, costos
- Dashboard de monitoreo

---

### 7. ONBOARDING_CLIENTE.md
**Qué**: Guía paso a paso para onboardear nueva cadena. Rol: Ram (pero cualquiera puede leer).

**Cuándo leer**:
- Cuando tengas cliente nuevo
- Para entender flujo end-to-end (auth → venta)
- Para training de soporte
- Plantillas de email, checklist, troubleshooting

**Sections**:
- 10 pasos (auth, org, branches, stock, MP, empleados, QR, PWA, training, follow-up)
- Tiempo estimado cada paso
- Plantilla de email (magic link)
- Troubleshooting común
- Timing: ~1.5-2 horas sesión inicial

---

### 8. COMPETENCIA.md
**Qué**: Análisis de competidores (Sistar, Verby, MaxKiosco, cuaderno).

**Cuándo leer**:
- Cuando necesites entender mercado
- Para pitch/positioning del producto
- Antes de decidir roadmap feature
- Análisis FODA + estrategia

**Sections**:
- 4 competidores analizados (fortalezas, debilidades, precio)
- Matriz de comparación features
- 3 ventajas defensables de App Kiosco
- Estrategia vs Sistar (directo)
- Recomendaciones Q por trimestre

---

## Matriz de Referencia Rápida

| Documento | Leer si... | Dura | Prioridad |
|-----------|-----------|------|-----------|
| BUGS_CONOCIDOS | trabajas con DECIMAL, server actions, OAuth | 15 min | ✓ CRÍTICA |
| PATRONES_CODIGO | escribes código (cualquiera) | 20 min | ✓ CRÍTICA |
| CHECKLIST_PRE_DEPLOY | vas a hacer push a main | 10 min | ✓ CRÍTICA |
| INTEGRACIONES | trabajas con MP, Supabase, Vercel | 15 min | ✓ CRÍTICA |
| HISTORIAL_DECISIONES | preguntas "¿por qué?" | 15 min | Importante |
| METRICAS_NEGOCIO | evalúas éxito, entiendes pricing | 20 min | Importante |
| ONBOARDING_CLIENTE | vas a entrenar usuario | 20 min | Importante |
| COMPETENCIA | estrategia, positioning, roadmap | 15 min | Importante |

---

## Antes de Empezar (Quick Start, 30 min)

Si nunca trabajaste en App Kiosco, lee en este orden:

1. **PATRONES_CODIGO** (10 min) → Cómo escribir
2. **BUGS_CONOCIDOS** (5 min) → Qué errores evitar
3. **CHECKLIST_PRE_DEPLOY** (5 min) → Antes de push
4. **INTEGRACIONES** (10 min) → Qué está integrado

Después, lee según necesidad.

---

## Guía de Actualización

**Cuándo actualizar esta base**:
- [ ] Encontraste un nuevo bug → agrégalo a BUGS_CONOCIDOS
- [ ] Creaste un nuevo patrón → docúmentalo en PATRONES_CODIGO
- [ ] Completaste feature → actualiza INTEGRACIONES o HISTORIAL_DECISIONES
- [ ] Descubriste métrica nueva → agrégala a METRICAS_NEGOCIO
- [ ] Agregaste integración → documenta en INTEGRACIONES
- [ ] Competencia cambió → actualiza COMPETENCIA

**Cómo actualizar**:
1. Abre el archivo `.md`
2. Busca la sección relevante
3. Agrega o modifica
4. Commit: `git commit -m "docs: actualizar [filename]"`
5. Push: `git push main`

---

## Responsabilidad de Cada Rol

### Claude (Agente)
- Seguir patrones exactamente
- Reportar bugs encontrados (actualizar BUGS_CONOCIDOS)
- Completar CHECKLIST_PRE_DEPLOY antes de push
- Mantener INTEGRACIONES actualizado

### Ram (Dueño)
- Aprobar decisiones
- Entrenar clientes (usar ONBOARDING_CLIENTE)
- Revisar competencia
- Decisión final en roadmap

---

## Información Clave (Rápido)

**Stack**:
```
Frontend: Next.js + React 19 + TypeScript
UI: shadcn/ui + Tailwind + lucide-react
Backend: Supabase (Auth PKCE + PostgreSQL + RLS)
Deploy: Vercel
Project IDs:
  Supabase: vrgexonzlrdptrplqpri
  Vercel Team: team_sPJMb8vptJoaoXAlJOwFDS7d
  Domain: app-kiosco-chi.vercel.app
```

**Reglas Críticas**:
1. Server actions NUNCA importan `@/lib/supabase`
2. DECIMAL siempre castean con `Number()` antes de aritmética
3. RLS siempre filtra por `org_id`
4. CHECKLIST_PRE_DEPLOY SIEMPRE antes de push

**Contacto**:
- Ram: tech-leader, aprueba todo
- Claude: implementa

---

## Índice de Búsqueda

### Por Problema
- "No funciona DECIMAL" → BUGS_CONOCIDOS #1
- "Cómo escribo server action" → PATRONES_CODIGO #1
- "Qué reviso antes de push" → CHECKLIST_PRE_DEPLOY
- "Cómo conectar MP" → INTEGRACIONES (MP section)
- "Por qué no tenemos AFIP" → HISTORIAL_DECISIONES #1
- "Cuál es el target NPS" → METRICAS_NEGOCIO #6
- "Cómo entreno kiosquero" → ONBOARDING_CLIENTE
- "Quién es mi competencia" → COMPETENCIA

### Por Tecnología
- **Supabase**: INTEGRACIONES (Supabase section), BUGS_CONOCIDOS (RLS, DECIMAL)
- **Mercado Pago**: INTEGRACIONES (MP section), PATRONES_CODIGO (encryption)
- **Server Actions**: PATRONES_CODIGO #1, BUGS_CONOCIDOS #2
- **Client Components**: PATRONES_CODIGO #2-3
- **DECIMAL**: BUGS_CONOCIDOS #1, PATRONES_CODIGO #4
- **RLS**: BUGS_CONOCIDOS, INTEGRACIONES

### Por Fase
- **Setup inicial**: ONBOARDING_CLIENTE
- **Desarrollo**: PATRONES_CODIGO, BUGS_CONOCIDOS
- **Testing**: CHECKLIST_PRE_DEPLOY
- **Deploy**: CHECKLIST_PRE_DEPLOY
- **Post-launch**: METRICAS_NEGOCIO
- **Estrategia**: HISTORIAL_DECISIONES, COMPETENCIA

---

## Versionado

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 15-03-2026 | Inicial (8 docs) |

---

## Preguntas Frecuentes

### "¿Qué documento leo si...?"
- ...trabajo con dinero/precios? → BUGS_CONOCIDOS + PATRONES_CODIGO
- ...debo hacer push? → CHECKLIST_PRE_DEPLOY
- ...trabajo con integración? → INTEGRACIONES
- ...necesito entrenar usuario? → ONBOARDING_CLIENTE
- ...necesito entender arquitectura? → HISTORIAL_DECISIONES

### "¿Puedo cambiar los patrones?"
No. Ram aprobó estos patrones. Si necesitas cambiar, propón en chat, Ram decide.

### "¿Qué pasa si no sigo el checklist?"
Deploy fallará o bug llegará a producción. Siempre sigue CHECKLIST_PRE_DEPLOY.

### "¿Dónde reporto bugs?"
1. Agrégalo a BUGS_CONOCIDOS
2. Documenta cómo se corrigió
3. Commit + push

---

## Links Útiles

- **Dashboard Supabase**: https://supabase.com/dashboard/project/vrgexonzlrdptrplqpri
- **Dashboard Vercel**: https://vercel.com/dashboard (team_sPJMb8vptJoaoXAlJOwFDS7d)
- **App (dev)**: https://app-kiosco-chi.vercel.app
- **GitHub**: [en repo]

---

**Última actualización**: 15 de marzo 2026
**Mantenedor**: Claude (agente)
**Aprobado por**: Ram (dueño)

