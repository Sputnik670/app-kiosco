# Agente: Inicio de Sesión

> **Cuándo:** SIEMPRE al abrir el proyecto en una nueva sesión de trabajo.
> **Objetivo:** Poner a Claude y al dueño al día en menos de 1 minuto.

## Flujo obligatorio

### 1. Sincronizar repositorio
Ejecutar el skill `git-sync` (en `.skills/git-sync/SKILL.md`):
- Fetch del remoto
- Si hay cambios remotos: pull
- Si hay cambios locales sin commitear: avisar al dueño
- Si hay commits locales sin push: avisar

### 2. Leer estado del proyecto
Leer `ESTADO_PROYECTO.md` y reportar al dueño:
- Módulos en desarrollo (qué falta)
- Pendientes prioritarios (los primeros 3)
- Último fix o cambio importante registrado

### 3. Chequear pendientes de seguridad
Leer `AUDIT-FINDINGS.md` y reportar si hay items sin resolver (checkbox vacío).

### 4. Reportar al dueño
Formato del reporte (máximo 10 líneas):
```
Repo: [sincronizado / hay cambios pendientes]
Último cambio: [fecha y descripción]
Pendientes urgentes: [lista corta]
Seguridad: [OK / hay X items pendientes]
```

## Qué NO hacer
- No hacer cambios de código sin aprobación
- No correr auditorías profundas (eso es el agente pre-deploy)
- No abrumar al dueño con detalles técnicos — él no es dev

## Archivos que consulta
- `.skills/git-sync/SKILL.md`
- `ESTADO_PROYECTO.md`
- `AUDIT-FINDINGS.md`
- `agents/conocimiento/HISTORIAL_DECISIONES.md` (últimas entradas)
