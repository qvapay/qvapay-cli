// Lectura de transacciones: GET /transaction (Bearer).
// take: 1-30 (def. 20) · page · status: paid|pending|cancelled (def. paid).
// Devuelve un array, o { transactions, total } cuando include_total=true.
// Rate limit del servidor: 3 req / 5 s (429).
import { api, QvaPayError } from "./client"
import type { Transaction } from "./types"

type TxResponse =
  | Transaction[]
  | { transactions?: Transaction[]; total?: number }

export interface ListParams {
  take?: number
  page?: number
  status?: string
}

export async function listTransactions(
  token: string,
  params: ListParams = {}
): Promise<Transaction[]> {
  const q = new URLSearchParams()
  if (params.take) q.set("take", String(params.take))
  if (params.page) q.set("page", String(params.page))
  if (params.status) q.set("status", params.status)
  const qs = q.toString()
  const resp = await api<TxResponse>(`/transaction${qs ? `?${qs}` : ""}`, {
    token,
  })
  return unwrapTransactions(resp)
}

export async function getTransaction(
  token: string,
  uuid: string
): Promise<Transaction> {
  const resp = await api<TxResponse>(
    `/transaction?uuid=${encodeURIComponent(uuid)}`,
    { token }
  )
  const tx = unwrapTransactions(resp)[0]
  if (!tx) throw new QvaPayError(`Transacción ${uuid} no encontrada`, 404)
  return tx
}

// La respuesta viene como array crudo o envuelta en { transactions }.
export function unwrapTransactions(resp: TxResponse): Transaction[] {
  return Array.isArray(resp) ? resp : (resp.transactions ?? [])
}

// Las no vistas, en orden cronológico: la API devuelve las recientes primero.
export function newTransactions(
  txs: Transaction[],
  seen: Set<string>
): Transaction[] {
  return txs.filter((t) => !seen.has(t.uuid)).reverse()
}

// Sondeo de `tx watch`. El servidor corta a 3 req / 5 s, así que 10 s es el piso.
export function clampInterval(seconds?: number): number {
  if (seconds == null || Number.isNaN(seconds)) return 15
  return Math.max(10, Math.floor(seconds))
}

// El servidor exige take entre 1 y 30.
export function clampTake(limit?: number): number | undefined {
  if (limit == null || Number.isNaN(limit)) return undefined
  return Math.max(1, Math.min(30, Math.floor(limit)))
}
