import { QvaPayError } from "../lib/client"
import { readAuth } from "../lib/config"
import { readConfig } from "../lib/policy"
import type { Transaction } from "../lib/types"
import {
  clampInterval,
  clampTake,
  getTransaction,
  listTransactions,
  newTransactions,
} from "../lib/wallet"
import {
  describeFilter,
  hasConditions,
  matchesFilter,
  parseFilter,
  type WatchFilter,
} from "../lib/watch"
import {
  buildPayload,
  postWebhook,
  resolveSecret,
  validateWebhookUrl,
} from "../lib/webhook"
import { fail, type GlobalOpts, requireToken, usage } from "./util"

interface ListOpts extends GlobalOpts {
  limit?: string
  page?: string
  status?: string
}

export async function txListCommand(opts: ListOpts): Promise<void> {
  const token = await requireToken(opts)
  if (!token) return

  const take = opts.limit ? clampTake(Number(opts.limit)) : undefined
  const page = opts.page ? Number(opts.page) : undefined

  try {
    const txs = await listTransactions(token, {
      take,
      page,
      status: opts.status,
    })
    if (opts.json) {
      console.log(JSON.stringify(txs, null, 2))
    } else if (txs.length === 0) {
      console.log("Sin transacciones.")
    } else {
      for (const t of txs) console.log(formatRow(t))
    }
  } catch (e) {
    fail(e, opts)
  }
}

interface WatchOpts extends GlobalOpts {
  interval?: string
  status?: string
  // condiciones
  from?: string
  to?: string
  direction?: string
  min?: string
  max?: string
  grep?: string
  // acción
  webhook?: string
  // parada
  untilMatch?: boolean
  maxEvents?: string
  timeout?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Exit 5: se agotó --timeout sin ninguna coincidencia. Distinto de 1 (error)
// para que un script sepa que la vigilancia funcionó, pero no pasó nada.
export const EXIT_NO_MATCH = 5

// Sondea hasta Ctrl-C (o hasta una condición de parada) e imprime solo lo que
// no había visto y pasa el filtro. Con --json, una línea JSON por transacción
// (NDJSON), apto para `| jq` o para un agente.
export async function txWatchCommand(opts: WatchOpts): Promise<void> {
  const token = await requireToken(opts)
  if (!token) return

  let filter: WatchFilter
  let webhookUrl: URL | undefined
  let maxEvents: number | undefined
  let timeoutMs: number | undefined
  try {
    filter = parseFilter(opts)
    if (opts.webhook) webhookUrl = validateWebhookUrl(opts.webhook)
    maxEvents = parsePositiveInt(opts.maxEvents, "--max-events")
    const timeoutS = parsePositiveInt(opts.timeout, "--timeout")
    timeoutMs = timeoutS == null ? undefined : timeoutS * 1000
  } catch (e) {
    return usage(e, opts)
  }

  // --direction necesita saber quién soy; el resto del filtro no.
  const me = filter.direction ? (await readAuth())?.username : undefined
  const secret = webhookUrl
    ? resolveSecret((await readConfig()).watch.webhookSecret)
    : undefined

  const interval = clampInterval(
    opts.interval ? Number(opts.interval) : undefined
  )
  // ponytail: el set vive en memoria y solo crece con lo nuevo; si un watch de
  // semanas llega a molestar, acotarlo a los últimos N uuids.
  const seen = new Set<string>()
  let priming = true // la primera pasada solo siembra el estado, no imprime
  let matched = 0
  const deadline = timeoutMs == null ? null : Date.now() + timeoutMs

  console.error(startupMessage(interval, filter, webhookUrl, secret))
  for (;;) {
    try {
      const txs = await listTransactions(token, {
        take: 30,
        status: opts.status,
      })
      for (const t of newTransactions(txs, seen)) {
        seen.add(t.uuid)
        if (priming) continue
        if (!matchesFilter(t, filter, me)) continue

        matched++
        console.log(opts.json ? JSON.stringify(t) : formatRow(t))
        if (webhookUrl) await deliver(webhookUrl, t, secret)

        if (opts.untilMatch) return
        if (maxEvents != null && matched >= maxEvents) return
      }
      priming = false
    } catch (e) {
      // Red caída o 429 no deben matar la vigilancia; 401 sí, el token no se
      // recupera solo.
      if (e instanceof QvaPayError && e.status === 401) return fail(e, opts)
      console.error(`⚠ ${e instanceof Error ? e.message : e}`)
    }

    if (deadline != null) {
      const left = deadline - Date.now()
      if (left <= 0) return noMatch(matched, opts)
      // No dormir más allá del plazo: un --timeout 20 con --interval 60 debe
      // rendirse a los 20 s, no al minuto.
      await sleep(Math.min(interval * 1000, left))
    } else {
      await sleep(interval * 1000)
    }
  }
}

async function deliver(
  url: URL,
  t: Transaction,
  secret: string | undefined
): Promise<void> {
  const res = await postWebhook(url, buildPayload(t, new Date()), secret)
  if (res.ok) {
    console.error(`→ webhook ${url.host} ${res.status}`)
  } else {
    // El webhook es una notificación, no el registro: que falle no invalida la
    // transacción ya impresa en stdout.
    console.error(`⚠ webhook ${url.host} falló: ${res.error}`)
  }
}

function noMatch(matched: number, opts: WatchOpts): void {
  if (matched > 0) return // hubo coincidencias, el plazo solo cerró la sesión
  const msg = "Se agotó el tiempo sin coincidencias."
  if (opts.json) console.log(JSON.stringify({ error: msg, matched: 0 }))
  else console.error(msg)
  process.exitCode = EXIT_NO_MATCH
}

function startupMessage(
  interval: number,
  filter: WatchFilter,
  url: URL | undefined,
  secret: string | undefined
): string {
  const what = hasConditions(filter)
    ? `transacciones ${describeFilter(filter)}`
    : "transacciones"
  const action = url
    ? ` → POST a ${url.host}${secret ? " (firmado)" : " (sin firmar)"}`
    : ""
  return `Vigilando ${what} cada ${interval}s${action}. Ctrl-C para salir.`
}

function parsePositiveInt(
  raw: string | undefined,
  flag: string
): number | undefined {
  if (raw == null) return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`${flag} espera un entero >= 1, no "${raw}"`)
  return n
}

export async function txGetCommand(
  uuid: string,
  opts: GlobalOpts
): Promise<void> {
  const token = await requireToken(opts)
  if (!token) return

  try {
    const tx = await getTransaction(token, uuid)
    console.log(JSON.stringify(tx, null, 2))
  } catch (e) {
    fail(e, opts)
  }
}

function formatRow(t: Transaction): string {
  const date = (t.created_at ?? "").slice(0, 19).replace("T", " ")
  const status = (t.status ?? "-").padEnd(9)
  const amount = String(t.amount).padStart(10)
  return `${date}  ${amount}  ${status}  ${t.description ?? ""}`
}
