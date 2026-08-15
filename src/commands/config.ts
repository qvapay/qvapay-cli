// Editor de la política de send. Claves: send.enabled, send.maxPerTx,
// send.dailyCap, send.whitelist.
import * as p from "@clack/prompts"
import { readConfig, type SendPolicy, writeConfig } from "../lib/policy"
import type { GlobalOpts } from "./util"

const KEYS = [
  "send.enabled",
  "send.maxPerTx",
  "send.dailyCap",
  "send.whitelist",
]

export async function configGetCommand(
  key: string,
  opts: GlobalOpts
): Promise<void> {
  const cfg = await readConfig()
  const val = pick(cfg.send, key)
  if (val === undefined) return badKey(key)
  console.log(opts.json ? JSON.stringify({ [key]: val }) : format(val))
}

export async function configSetCommand(
  key: string,
  value: string
): Promise<void> {
  const cfg = await readConfig()
  const field = key.replace(/^send\./, "") as keyof SendPolicy
  if (!KEYS.includes(key)) return badKey(key)

  switch (field) {
    case "enabled":
      cfg.send.enabled = /^(true|1|on|yes|sí)$/i.test(value)
      break
    case "maxPerTx":
    case "dailyCap":
      cfg.send[field] = parseNullableNumber(value)
      break
    case "whitelist":
      cfg.send.whitelist = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      break
  }
  await writeConfig(cfg)
  console.log(`${key} = ${format(cfg.send[field])}`)
}

export async function configCommand(): Promise<void> {
  const cfg = await readConfig()
  p.intro("QvaPay · Política de send")

  const enabled = await p.confirm({
    message: "¿Permitir send?",
    initialValue: cfg.send.enabled,
  })
  if (p.isCancel(enabled)) return cancel()

  const maxPerTx = await p.text({
    message: "Máximo por transacción (vacío = sin límite)",
    initialValue: cfg.send.maxPerTx?.toString() ?? "",
    validate: numOrEmpty,
  })
  if (p.isCancel(maxPerTx)) return cancel()

  const dailyCap = await p.text({
    message: "Tope diario acumulado (vacío = sin límite)",
    initialValue: cfg.send.dailyCap?.toString() ?? "",
    validate: numOrEmpty,
  })
  if (p.isCancel(dailyCap)) return cancel()

  const whitelist = await p.text({
    message: "Whitelist (usernames/uuids separados por coma; vacío = todos)",
    initialValue: cfg.send.whitelist.join(", "),
  })
  if (p.isCancel(whitelist)) return cancel()

  cfg.send = {
    enabled,
    maxPerTx: parseNullableNumber(maxPerTx),
    dailyCap: parseNullableNumber(dailyCap),
    whitelist: (whitelist ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }
  await writeConfig(cfg)
  p.outro("Política guardada.")
}

function pick(send: SendPolicy, key: string): unknown {
  const field = key.replace(/^send\./, "") as keyof SendPolicy
  return KEYS.includes(key) ? send[field] : undefined
}

function parseNullableNumber(v: string | undefined): number | null {
  const t = (v ?? "").trim()
  if (!t || /^(null|none|off)$/i.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

function numOrEmpty(v: string): string | undefined {
  if (!v.trim()) return undefined
  return Number.isFinite(Number(v)) && Number(v) > 0
    ? undefined
    : "Número mayor a 0 o vacío"
}

function format(v: unknown): string {
  if (v === null) return "sin límite"
  if (Array.isArray(v)) return v.length ? v.join(", ") : "(vacía)"
  return String(v)
}

function badKey(key: string): void {
  console.error(`Clave desconocida: ${key}. Válidas: ${KEYS.join(", ")}`)
  process.exitCode = 4
}

function cancel(): void {
  p.cancel("Cancelado.")
  process.exitCode = 1
}
