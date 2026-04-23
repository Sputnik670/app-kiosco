/**
 * @deprecated 2026-04-23 - DESCARTADO.
 *
 * Exploramos brevemente un "modo kiosco dedicado" donde un device anclado al
 * local mostraba el scanner en fullscreen, para que cualquier empleado
 * escaneara su tarjeta ahi. Se abandono a favor del modelo definitivo:
 *
 *   El empleado se loguea en SU propio celular y escanea SU PROPIA tarjeta
 *   desde vista-empleado.tsx -> RelojControl -> QREmpleadoScanner.
 *
 * La tarjeta impresa queda en el local como token fisico anti-fraude.
 * Server-side validamos ownership (membership.user_id === auth.uid) en
 * processEmployeeQRScanAction, asi un empleado no puede fichar por otro.
 *
 * Este archivo queda como stub marcador de la decision.
 * No importar. No extender. No re-habilitar sin revisar el modelo con Ramiro.
 *
 * Ver docs/HANDOFF_2026-04-23_fichaje-qr.md - seccion "Descartado".
 */
export {}
