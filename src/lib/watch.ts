// Condiciones de `tx watch`: qué transacciones merecen imprimirse y disparar
// una acción. Puro y testeable como checkPolicy; la CLI solo traduce flags.
//
// Forma real de la API: PaidBy = quien paga, User = quien recibe, y cualquiera
// de los dos puede venir null (pagos a apps, recargas del sistema). El monto
// llega como string y SIEMPRE positivo, así que la dirección se deduce de las
// partes, nunca del signo.

import type { Transaction } from "./types"

export type Direction = "in" | "out"

export interface WatchFilter {
  from?: string // PaidBy.username
  to?: string // User.username
  direction?: Direction
  min?: number
  max?: number
  grep?: string
}

interface Party {
  username?: unknown
}

export function party(
  t: Transaction,
  side: "PaidBy" | "User"
): string | undefined {
  const p = t[side] as Party | null | undefined
  return typeof p?.username === "string" ? p.username : undefined
}

// "@Fulano" y "fulano" son la misma persona.
export function sameUser(a: string | undefined, b: string): boolean {
  if (!a) return false
  return a.toLowerCase() === b.trim().replace(/^@/, "").toLowerCase()
}

// La API manda amount como string; NaN si algún día manda otra cosa.
export function txAmount(t: Transaction): number {
  return Number(t.amount)
}

// Todas las condiciones en AND. `me` es el username de la sesión, necesario
// solo para --direction.
export function matchesFilter(
  t: Transaction,
  f: WatchFilter,
  me?: string
): boolean {
  if (f.from && !sameUser(party(t, "PaidBy"), f.from)) return false
  if (f.to && !sameUser(party(t, "User"), f.to)) return false

  if (f.direction && me) {
    const side = f.direction === "in" ? "User" : "PaidBy"
    if (!sameUser(party(t, side), me)) return false
  }

  if (f.min != null || f.max != null) {
    const amount = txAmount(t)
    // Monto ilegible con filtro de monto activo: no arriesgar un falso positivo.
    if (!Number.isFinite(amount)) return false
    if (f.min != null && amount < f.min) return false
    if (f.max != null && amount > f.max) return false
  }

  if (f.grep) {
    const desc = typeof t.description === "string" ? t.description : ""
    if (!desc.toLowerCase().includes(f.grep.toLowerCase())) return false
  }

  return true
}

export function hasConditions(f: WatchFilter): boolean {
  return Object.values(f).some((v) => v !== undefined)
}

// Resumen para el mensaje de arranque en stderr.
export function describeFilter(f: WatchFilter): string {
  const parts: string[] = []
  if (f.direction) parts.push(f.direction === "in" ? "entrantes" : "salientes")
  if (f.from) parts.push(`de ${f.from}`)
  if (f.to) parts.push(`para ${f.to}`)
  if (f.min != null && f.max != null) parts.push(`entre ${f.min} y ${f.max}`)
  else if (f.min != null) parts.push(`>= ${f.min}`)
  else if (f.max != null) parts.push(`<= ${f.max}`)
  if (f.grep) parts.push(`con "${f.grep}" en la descripción`)
  return parts.join(", ")
}

export interface FilterInput {
  from?: string
  to?: string
  direction?: string
  min?: string
  max?: string
  grep?: string
}

// Traduce y valida los flags. Lanza con un mensaje accionable: un filtro mal
// escrito que se ignore en silencio es peor que no tener filtro.
export function parseFilter(input: FilterInput): WatchFilter {
  const f: WatchFilter = {}

  if (input.from) f.from = input.from.trim().replace(/^@/, "")
  if (input.to) f.to = input.to.trim().replace(/^@/, "")

  if (input.direction) {
    const d = input.direction.trim().toLowerCase()
    if (d !== "in" && d !== "out")
      throw new Error(
        `--direction admite "in" u "out", no "${input.direction}"`
      )
    f.direction = d
  }

  if (input.min != null) f.min = parseAmount(input.min, "--min")
  if (input.max != null) f.max = parseAmount(input.max, "--max")
  if (f.min != null && f.max != null && f.min > f.max)
    throw new Error(`--min (${f.min}) no puede superar a --max (${f.max})`)

  if (input.grep) f.grep = input.grep

  return f
}

function parseAmount(raw: string, flag: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0)
    throw new Error(`${flag} espera un número >= 0, no "${raw}"`)
  return n
}
