import { expect, test } from "bun:test"
import type { Transaction } from "../src/lib/types"
import {
  clampInterval,
  clampTake,
  newTransactions,
  unwrapTransactions,
} from "../src/lib/wallet"

const tx = (uuid: string): Transaction => ({ uuid, amount: 1 })

test("unwrapTransactions acepta array crudo", () => {
  expect(unwrapTransactions([tx("a"), tx("b")]).length).toBe(2)
})

test("unwrapTransactions extrae de { transactions }", () => {
  const resp = { transactions: [tx("a"), tx("b"), tx("c")], total: 3 }
  expect(unwrapTransactions(resp).map((t) => t.uuid)).toEqual(["a", "b", "c"])
})

test("unwrapTransactions sin transactions devuelve []", () => {
  expect(unwrapTransactions({})).toEqual([])
})

test("clampTake limita a 1-30", () => {
  expect(clampTake(5)).toBe(5)
  expect(clampTake(100)).toBe(30)
  expect(clampTake(0)).toBe(1)
  expect(clampTake(undefined)).toBeUndefined()
  expect(clampTake(Number.NaN)).toBeUndefined()
})

test("newTransactions filtra las vistas y las devuelve cronológicas", () => {
  const seen = new Set(["b"])
  // La API entrega las recientes primero: c, b, a -> salen a, c.
  const nuevas = newTransactions([tx("c"), tx("b"), tx("a")], seen)
  expect(nuevas.map((t) => t.uuid)).toEqual(["a", "c"])
})

test("newTransactions sin nada nuevo devuelve []", () => {
  expect(newTransactions([tx("a")], new Set(["a"]))).toEqual([])
})

test("clampInterval no baja del piso de rate limit", () => {
  expect(clampInterval(1)).toBe(10)
  expect(clampInterval(30)).toBe(30)
  expect(clampInterval(undefined)).toBe(15)
  expect(clampInterval(Number.NaN)).toBe(15)
})
