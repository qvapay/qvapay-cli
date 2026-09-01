import { expect, test } from "bun:test"
import type { Transaction } from "../src/lib/types"
import {
  describeFilter,
  hasConditions,
  matchesFilter,
  parseFilter,
  party,
  txAmount,
} from "../src/lib/watch"

// Forma real de la API: amount string y positivo, PaidBy/User anidados y
// anulables.
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  uuid: "u1",
  amount: "10",
  description: "pago de prueba",
  status: "paid",
  PaidBy: { username: "alice" },
  User: { username: "bob" },
  ...over,
})

test("party lee el username y tolera null", () => {
  expect(party(tx(), "PaidBy")).toBe("alice")
  expect(party(tx({ User: null }), "User")).toBeUndefined()
  expect(party(tx({ PaidBy: { id: "3" } }), "PaidBy")).toBeUndefined()
})

test("txAmount convierte el string de la API", () => {
  expect(txAmount(tx({ amount: "259.35" }))).toBe(259.35)
  expect(txAmount(tx({ amount: 20 }))).toBe(20)
})

test("sin condiciones todo pasa", () => {
  expect(matchesFilter(tx(), {})).toBe(true)
  expect(hasConditions({})).toBe(false)
})

test("--from compara contra PaidBy, sin importar mayúsculas ni @", () => {
  expect(matchesFilter(tx(), { from: "alice" })).toBe(true)
  expect(matchesFilter(tx(), { from: "ALICE" })).toBe(true)
  expect(matchesFilter(tx(), { from: "bob" })).toBe(false)
  // bob es el receptor, no el pagador
  expect(matchesFilter(tx(), { to: "bob" })).toBe(true)
})

test("--from no casa cuando la parte viene null", () => {
  expect(matchesFilter(tx({ PaidBy: null }), { from: "alice" })).toBe(false)
})

test("--direction se resuelve contra el usuario de la sesión", () => {
  // bob recibe: para bob es entrante, para alice es saliente.
  expect(matchesFilter(tx(), { direction: "in" }, "bob")).toBe(true)
  expect(matchesFilter(tx(), { direction: "out" }, "bob")).toBe(false)
  expect(matchesFilter(tx(), { direction: "out" }, "alice")).toBe(true)
})

test("--min y --max acotan por monto", () => {
  const t = tx({ amount: "50" })
  expect(matchesFilter(t, { min: 50 })).toBe(true)
  expect(matchesFilter(t, { min: 50.01 })).toBe(false)
  expect(matchesFilter(t, { max: 50 })).toBe(true)
  expect(matchesFilter(t, { max: 49.99 })).toBe(false)
  expect(matchesFilter(t, { min: 10, max: 100 })).toBe(true)
})

test("monto ilegible no dispara un filtro de monto", () => {
  expect(matchesFilter(tx({ amount: "n/a" }), { min: 0 })).toBe(false)
})

test("--grep busca en la descripción sin importar mayúsculas", () => {
  expect(matchesFilter(tx(), { grep: "PRUEBA" })).toBe(true)
  expect(matchesFilter(tx(), { grep: "nómina" })).toBe(false)
  expect(matchesFilter(tx({ description: undefined }), { grep: "x" })).toBe(
    false
  )
})

test("las condiciones se combinan en AND", () => {
  const f = { from: "alice", min: 5, grep: "pago" }
  expect(matchesFilter(tx(), f)).toBe(true)
  expect(matchesFilter(tx({ amount: "1" }), f)).toBe(false)
  expect(matchesFilter(tx({ PaidBy: { username: "eve" } }), f)).toBe(false)
})

test("parseFilter normaliza el @ y el número", () => {
  const f = parseFilter({ from: " @Alice ", min: "10.5" })
  expect(f.from).toBe("Alice")
  expect(f.min).toBe(10.5)
})

test("parseFilter rechaza entradas inválidas", () => {
  expect(() => parseFilter({ direction: "arriba" })).toThrow(/--direction/)
  expect(() => parseFilter({ min: "mucho" })).toThrow(/--min/)
  expect(() => parseFilter({ min: "-1" })).toThrow(/--min/)
  expect(() => parseFilter({ min: "100", max: "10" })).toThrow(/--min/)
})

test("describeFilter resume las condiciones activas", () => {
  const d = describeFilter({ direction: "in", from: "alice", min: 100 })
  expect(d).toBe("entrantes, de alice, >= 100")
  expect(describeFilter({ min: 1, max: 9 })).toBe("entre 1 y 9")
})
