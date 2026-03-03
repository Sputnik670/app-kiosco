/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔐 ROLES CONSTANTS - Constantes centralizadas para roles del sistema
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Este archivo centraliza todas las constantes relacionadas con roles
 * para evitar strings hardcodeados y facilitar cambios futuros.
 *
 * USO:
 * import { ROLES, ROLE_LABELS, isOwner } from '@/lib/constants/roles'
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { UserRole, UserRoleDisplay } from '@/types/app.types'

// ───────────────────────────────────────────────────────────────────────────────
// VALORES DE ROLES (para BD y lógica)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Roles del sistema (valores en inglés usados en la BD)
 */
export const ROLES = {
  OWNER: 'owner',
  EMPLOYEE: 'employee',
} as const

/**
 * Array de roles válidos
 */
export const VALID_ROLES: UserRole[] = [ROLES.OWNER, ROLES.EMPLOYEE]

// ───────────────────────────────────────────────────────────────────────────────
// LABELS PARA UI (español)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Labels de roles para mostrar en UI (español)
 */
export const ROLE_LABELS: Record<UserRole, UserRoleDisplay> = {
  owner: 'dueño',
  employee: 'empleado',
}

/**
 * Mapeo inverso: español -> inglés
 */
export const ROLE_VALUES: Record<UserRoleDisplay, UserRole> = {
  dueño: 'owner',
  empleado: 'employee',
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un rol es owner
 */
export function isOwnerRole(role: string | null | undefined): boolean {
  return role === ROLES.OWNER
}

/**
 * Verifica si un rol es employee
 */
export function isEmployeeRole(role: string | null | undefined): boolean {
  return role === ROLES.EMPLOYEE
}

/**
 * Obtiene el label en español de un rol
 */
export function getRoleLabel(role: UserRole): UserRoleDisplay {
  return ROLE_LABELS[role] || 'empleado'
}

/**
 * Obtiene el valor en inglés de un rol en español
 */
export function getRoleValue(label: UserRoleDisplay): UserRole {
  return ROLE_VALUES[label] || 'employee'
}

/**
 * Valida si un string es un rol válido
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole)
}

/**
 * Normaliza un rol (acepta español o inglés, retorna inglés)
 */
export function normalizeRole(role: string): UserRole {
  // Si ya está en inglés
  if (isValidRole(role)) {
    return role
  }
  // Si está en español
  if (role === 'dueño') return 'owner'
  if (role === 'empleado') return 'employee'
  // Default
  return 'employee'
}
