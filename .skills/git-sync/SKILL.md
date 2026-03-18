---
name: git-sync
description: |
  Sincronización automática de Git entre múltiples computadoras. Este skill DEBE ejecutarse al inicio de cada sesión de trabajo, antes de hacer cualquier otra cosa con el código. También usarlo cuando el usuario mencione sincronizar, actualizar el repo, traer cambios, subir cambios, pull, push, o trabajar desde otra computadora. Si Claude detecta que está abriendo un repositorio por primera vez en una sesión, debe ejecutar este skill proactivamente sin que el usuario lo pida.
---

# Git Sync — Sincronización Multi-Máquina

Este skill mantiene el repositorio sincronizado entre las diferentes computadoras del usuario. El usuario NO es desarrollador, así que todo debe ser claro y sin jerga técnica.

## Cuándo ejecutar

- **SIEMPRE** al inicio de cada sesión de trabajo (antes de tocar código)
- Cuando el usuario pide sincronizar, actualizar, o subir cambios
- Cuando el usuario menciona que está en otra computadora

## Flujo de sincronización

### Paso 1: Diagnóstico rápido

Ejecutar estos comandos y analizar el resultado:

```bash
# Estado actual del repo
git status --short

# ¿Hay remoto configurado?
git remote -v

# ¿Cuántos commits locales no se subieron?
git log --oneline @{upstream}..HEAD 2>/dev/null

# ¿Cuántos commits remotos no se bajaron?
git fetch --quiet && git log --oneline HEAD..@{upstream} 2>/dev/null
```

### Paso 2: Resolver según la situación

**Situación A — Todo limpio, hay cambios remotos:**
```bash
git pull --rebase origin main
```
Reportar: "Traje X cambios de la otra máquina. Todo actualizado."

**Situación B — Hay cambios locales sin commitear:**
Primero, guardar los cambios con un commit descriptivo (preguntar al usuario qué hizo si no es obvio, o hacer commit con mensaje genérico tipo "WIP: cambios en progreso desde [notebook/desktop]"). Luego:
```bash
git pull --rebase origin main
git push origin main
```
Reportar: "Guardé tus cambios, traje lo nuevo del remoto y subí todo."

**Situación C — Hay commits locales sin subir:**
```bash
git pull --rebase origin main
git push origin main
```
Reportar: "Subí X commits al remoto. La otra máquina va a recibir estos cambios."

**Situación D — Todo al día:**
Reportar: "Repo sincronizado, estás al día en ambas máquinas."

**Situación E — Conflicto de merge:**
NO intentar resolver automáticamente. Explicar al usuario qué archivos tienen conflicto y ofrecer ayuda para resolverlos uno a uno.

### Paso 3: Resumen

Siempre terminar con un resumen claro:
- Estado actual (sincronizado / pendiente de push en la otra máquina)
- Últimos 3 commits (para dar contexto de lo reciente)
- Si hay cambios sin commitear, mencionarlos

## Formato del reporte

Usar lenguaje simple. En vez de "rebase exitoso", decir "traje los cambios nuevos". En vez de "push completado", decir "subí tus cambios para que estén disponibles en la otra compu".

## Compatibilidad con PowerShell

El usuario trabaja en Windows con PowerShell en la PC de escritorio. En esa máquina:
- No usar `&&` para encadenar comandos (usar `;` o comandos separados)
- Si hay `.git/index.lock`, indicar al usuario que ejecute: `Remove-Item .git\index.lock -Force`
- Si git no está en PATH, indicar que use la terminal integrada de VSCode

## Notas importantes

- El branch principal es `main`
- El remoto es `origin` (GitHub)
- Nunca hacer force push
- Nunca hacer reset --hard sin aprobación explícita
- Si algo sale mal, parar y explicar antes de actuar
