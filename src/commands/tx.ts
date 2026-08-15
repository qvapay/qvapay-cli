import { QvaPayError } from "../lib/client"
import type { Transaction } from "../lib/types"
import {
  clampInterval,
  clampTake,
  getTransaction,
  listTransactions,
  newTransactions,
} from "../lib/wallet"
import { fail, type GlobalOpts, requireToken } from "./util"

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
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Sondea hasta Ctrl-C e imprime solo lo que no había visto. Con --json, una
// línea JSON por transacción (NDJSON), apto para `| jq` o para un agente.
export async function txWatchCommand(opts: WatchOpts): Promise<void> {
  const token = await requireToken(opts)
  if (!token) return

  const interval = clampInterval(
    opts.interval ? Number(opts.interval) : undefined
  )
  // ponytail: el set vive en memoria y solo crece con lo nuevo; si un watch de
  // semanas llega a molestar, acotarlo a los últimos N uuids.
  const seen = new Set<string>()
  let priming = true // la primera pasada solo siembra el estado, no imprime

  console.error(
    `Vigilando transacciones cada ${interval}s. Ctrl-C para salir.`
  )
  for (;;) {
    try {
      const txs = await listTransactions(token, {
        take: 30,
        status: opts.status,
      })
      for (const t of newTransactions(txs, seen)) {
        seen.add(t.uuid)
        if (priming) continue
        console.log(opts.json ? JSON.stringify(t) : formatRow(t))
      }
      priming = false
    } catch (e) {
      // Red caída o 429 no deben matar la vigilancia; 401 sí, el token no se
      // recupera solo.
      if (e instanceof QvaPayError && e.status === 401) return fail(e, opts)
      console.error(`⚠ ${e instanceof Error ? e.message : e}`)
    }
    await sleep(interval * 1000)
  }
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
