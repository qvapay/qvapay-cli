// Helpers compartidos por los comandos: sesión y errores con exit codes.
import { QvaPayError } from "../lib/client"
import { clearAuth, readAuth } from "../lib/config"

export interface GlobalOpts {
  json?: boolean
  verbose?: boolean
}

// Devuelve el token o null (y fija exit 2 + mensaje) si no hay sesión.
export async function requireToken(opts: GlobalOpts): Promise<string | null> {
  const auth = await readAuth()
  if (auth) return auth.token
  notAuthenticated(opts.json)
  return null
}

export function notAuthenticated(json?: boolean): void {
  if (json) console.log(JSON.stringify({ error: "No autenticado" }))
  else console.error("No autenticado. Ejecuta: qvapay login")
  process.exitCode = 2
}

// Imprime un error y fija el exit code (401 -> 2 no autenticado, resto -> 1).
export function fail(e: unknown, opts: GlobalOpts = {}): void {
  if (e instanceof QvaPayError && e.status === 401) {
    // Token muerto: no dejar la sesión zombie en disco. ponytail: fire-and-forget,
    // el unlink pendiente mantiene vivo el loop y ya traga sus propios errores.
    clearAuth()
    notAuthenticated(opts.json)
    return
  }
  const msg =
    e instanceof QvaPayError
      ? e.message
      : e instanceof Error
        ? `Error inesperado: ${e.message}`
        : "Error inesperado"
  if (opts.json) console.log(JSON.stringify({ error: msg }))
  else console.error(`✖ ${msg}`)
  if (opts.verbose && e instanceof Error && e.stack) console.error(e.stack)
  process.exitCode = 1
}
