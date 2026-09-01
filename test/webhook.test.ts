import { expect, test } from "bun:test"
import type { Transaction } from "../src/lib/types"
import {
  buildPayload,
  type FetchLike,
  postWebhook,
  resolveSecret,
  signBody,
  validateWebhookUrl,
  verifySignature,
} from "../src/lib/webhook"

const tx: Transaction = { uuid: "u1", amount: "10" }

test("validateWebhookUrl acepta https", () => {
  expect(validateWebhookUrl("https://example.com/hook").host).toBe(
    "example.com"
  )
})

test("validateWebhookUrl acepta http solo en loopback", () => {
  expect(validateWebhookUrl("http://localhost:3000/hook").port).toBe("3000")
  expect(validateWebhookUrl("http://127.0.0.1:3000/hook").port).toBe("3000")
  expect(() => validateWebhookUrl("http://example.com/hook")).toThrow(/https/)
})

test("validateWebhookUrl rechaza basura y otros esquemas", () => {
  expect(() => validateWebhookUrl("no-es-url")).toThrow(/URL válida/)
  expect(() => validateWebhookUrl("file:///etc/passwd")).toThrow(/https/)
})

test("buildPayload envuelve la transacción con la marca de tiempo", () => {
  const body = JSON.parse(buildPayload(tx, new Date(0)))
  expect(body.event).toBe("transaction")
  expect(body.sent_at).toBe("1970-01-01T00:00:00.000Z")
  expect(body.transaction.uuid).toBe("u1")
})

test("la firma es estable y verificable", () => {
  const body = buildPayload(tx, new Date(0))
  const sig = signBody(body, "s3cr3t")
  expect(sig).toStartWith("sha256=")
  expect(verifySignature(body, "s3cr3t", sig)).toBe(true)
  expect(verifySignature(body, "otro", sig)).toBe(false)
  expect(verifySignature(`${body} `, "s3cr3t", sig)).toBe(false)
})

test("postWebhook firma solo si hay secreto", async () => {
  const seen: Headers[] = []
  const spy = (async (_u, init) => {
    seen.push(new Headers(init.headers))
    return new Response("", { status: 200 })
  }) as FetchLike

  const url = validateWebhookUrl("https://example.com/hook")
  await postWebhook(url, "{}", "s3cr3t", spy)
  await postWebhook(url, "{}", undefined, spy)
  expect(seen[0]?.get("x-qvapay-signature")).toBe(signBody("{}", "s3cr3t"))
  expect(seen[1]?.get("x-qvapay-signature")).toBeNull()
  expect(seen[0]?.get("x-qvapay-event")).toBe("transaction")
})

test("postWebhook reintenta una vez en fallo de red", async () => {
  let calls = 0
  const spy = (async () => {
    calls++
    if (calls === 1) throw new Error("ECONNREFUSED")
    return new Response("", { status: 200 })
  }) as FetchLike

  const res = await postWebhook(
    validateWebhookUrl("https://example.com/hook"),
    "{}",
    undefined,
    spy
  )
  expect(res.ok).toBe(true)
  expect(calls).toBe(2)
})

test("postWebhook no reintenta un 4xx", async () => {
  let calls = 0
  const spy = (async () => {
    calls++
    return new Response("", { status: 404 })
  }) as FetchLike

  const res = await postWebhook(
    validateWebhookUrl("https://example.com/hook"),
    "{}",
    undefined,
    spy
  )
  expect(res.ok).toBe(false)
  expect(res.status).toBe(404)
  expect(calls).toBe(1)
})

test("postWebhook sí reintenta un 5xx y devuelve el último fallo", async () => {
  let calls = 0
  const spy = (async () => {
    calls++
    return new Response("", { status: 503 })
  }) as FetchLike

  const res = await postWebhook(
    validateWebhookUrl("https://example.com/hook"),
    "{}",
    undefined,
    spy
  )
  expect(res.ok).toBe(false)
  expect(calls).toBe(2)
})

test("resolveSecret prioriza el entorno sobre el config", () => {
  const prev = process.env.QVAPAY_WEBHOOK_SECRET
  process.env.QVAPAY_WEBHOOK_SECRET = "del-entorno"
  expect(resolveSecret("del-config")).toBe("del-entorno")
  process.env.QVAPAY_WEBHOOK_SECRET = ""
  expect(resolveSecret("del-config")).toBe("del-config")
  expect(resolveSecret(null)).toBeUndefined()
  if (prev == null) delete process.env.QVAPAY_WEBHOOK_SECRET
  else process.env.QVAPAY_WEBHOOK_SECRET = prev
})
