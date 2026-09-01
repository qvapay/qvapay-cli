// Acción de `tx watch`: POST del evento a una URL. Falla en silencio ruidoso —
// avisa por stderr pero nunca mata la vigilancia, igual que un 429 del sondeo.

import { createHmac, timingSafeEqual } from "node:crypto"
import pkg from "../../package.json" with { type: "json" }
import type { Transaction } from "./types"

const TIMEOUT_MS = 5000
const USER_AGENT = `qvapay-cli/${pkg.version}`

// Solo https. http se admite contra loopback porque es el caso real de
// desarrollo y ahí no hay red que espíe.
export function validateWebhookUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`--webhook no es una URL válida: "${raw}"`)
  }
  if (url.protocol === "https:") return url
  if (url.protocol === "http:" && isLoopback(url.hostname)) return url
  throw new Error(
    `--webhook exige https (http solo contra localhost); recibido "${url.protocol}//${url.hostname}"`
  )
}

function isLoopback(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1"
  )
}

export interface WebhookEvent {
  event: "transaction"
  sent_at: string
  transaction: Transaction
}

export function buildPayload(t: Transaction, now: Date): string {
  const event: WebhookEvent = {
    event: "transaction",
    sent_at: now.toISOString(),
    transaction: t,
  }
  return JSON.stringify(event)
}

// HMAC-SHA256 del cuerpo exacto. El receptor recalcula y compara; sin esto
// cualquiera que adivine la URL puede inventarse pagos.
export function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

// Comparación en tiempo constante, para quien implemente el receptor en Node.
export function verifySignature(
  body: string,
  secret: string,
  signature: string
): boolean {
  const expected = Buffer.from(signBody(body, secret))
  const got = Buffer.from(signature)
  return expected.length === got.length && timingSafeEqual(expected, got)
}

// Lo mínimo que necesita este módulo; `fetch` encaja y los tests pueden pasar
// un doble sin reimplementar toda la interfaz.
export type FetchLike = (url: URL, init: RequestInit) => Promise<Response>

export interface WebhookResult {
  ok: boolean
  status?: number
  error?: string
}

// Un reintento: un webhook casero que se reinicia no debería costarte el evento.
export async function postWebhook(
  url: URL,
  body: string,
  secret?: string,
  fetchImpl: FetchLike = fetch
): Promise<WebhookResult> {
  let last: WebhookResult = { ok: false, error: "sin intentos" }
  for (let attempt = 0; attempt < 2; attempt++) {
    last = await attemptPost(url, body, secret, fetchImpl)
    if (last.ok) return last
    // 4xx es culpa del emisor o del contrato: reintentar no lo arregla.
    if (last.status && last.status >= 400 && last.status < 500) return last
  }
  return last
}

async function attemptPost(
  url: URL,
  body: string,
  secret: string | undefined,
  fetchImpl: FetchLike
): Promise<WebhookResult> {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-QvaPay-Event": "transaction",
        ...(secret ? { "X-QvaPay-Signature": signBody(body, secret) } : {}),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.ok
      ? { ok: true, status: res.status }
      : { ok: false, status: res.status, error: `HTTP ${res.status}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

// El secreto nunca por argv: la línea de comandos es visible en `ps`.
export function resolveSecret(fromConfig: string | null): string | undefined {
  return process.env.QVAPAY_WEBHOOK_SECRET || fromConfig || undefined
}
