// Política local de `send` en ~/.config/qvapay/config.json. Defensa en capas:
// el PIN (que el agente no conoce) es el guardarraíl duro; esto acota el daño.
// El chequeo es puro y testeable; la lectura/escritura es atómica.

import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { configDir } from "./config"

export interface SendPolicy {
  enabled: boolean
  maxPerTx: number | null
  dailyCap: number | null
  whitelist: string[]
}

// Secreto para firmar los webhooks de `tx watch`. Vive aquí y no en argv
// porque la línea de comandos es visible en `ps`.
export interface WatchConfig {
  webhookSecret: string | null
}

export interface Config {
  send: SendPolicy
  daily: { date: string; spent: number } // contador acumulado del día
  watch: WatchConfig
}

export const DEFAULT_CONFIG: Config = {
  send: { enabled: true, maxPerTx: null, dailyCap: null, whitelist: [] },
  daily: { date: "", spent: 0 },
  watch: { webhookSecret: null },
}

function configFile(): string {
  return join(configDir(), "config.json")
}

export async function readConfig(): Promise<Config> {
  try {
    const raw = JSON.parse(await readFile(configFile(), "utf8"))
    return {
      send: { ...DEFAULT_CONFIG.send, ...raw.send },
      daily: { ...DEFAULT_CONFIG.daily, ...raw.daily },
      watch: { ...DEFAULT_CONFIG.watch, ...raw.watch },
    }
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}

export async function writeConfig(cfg: Config): Promise<void> {
  const dir = configDir()
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const file = configFile()
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(cfg, null, 2), { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, file)
}

// Gasto acumulado hoy (0 si el contador es de otro día). `today` inyectable p/ tests.
export function dailySpent(cfg: Config, today: string): number {
  return cfg.daily.date === today ? cfg.daily.spent : 0
}

export type PolicyResult = { ok: true } | { ok: false; reason: string }

// Verifica la política ANTES de tocar la API. Bloqueo => exit 3.
export function checkPolicy(
  policy: SendPolicy,
  amount: number,
  to: string,
  spentToday: number
): PolicyResult {
  if (!policy.enabled)
    return { ok: false, reason: "send está deshabilitado (qvapay config)" }
  if (policy.maxPerTx != null && amount > policy.maxPerTx)
    return {
      ok: false,
      reason: `monto ${amount} supera el máximo por transacción (${policy.maxPerTx})`,
    }
  if (policy.dailyCap != null && spentToday + amount > policy.dailyCap)
    return {
      ok: false,
      reason: `monto ${amount} supera el tope diario restante (${policy.dailyCap - spentToday})`,
    }
  if (policy.whitelist.length > 0 && !policy.whitelist.includes(to))
    return { ok: false, reason: `"${to}" no está en la whitelist` }
  return { ok: true }
}
