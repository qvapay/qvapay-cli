// Dinero real. Flujo: política local -> confirmación -> dispara PIN por correo
// (solo token) -> PIN del correo -> API -> contador diario. El PIN no viene por
// flag ni lo cubre un --yes.
import * as p from "@clack/prompts"
import { readAuth } from "../lib/config"
import { checkPolicy, dailySpent, readConfig, writeConfig } from "../lib/policy"
import { requestTransferPin, transfer } from "../lib/send"
import { fail, type GlobalOpts, notAuthenticated } from "./util"

interface SendOpts extends GlobalOpts {
  note?: string
}

const today = () => new Date().toISOString().slice(0, 10)

export async function sendCommand(
  to: string,
  amountArg: string,
  opts: SendOpts
): Promise<void> {
  const amount = Number(amountArg)
  if (!Number.isFinite(amount) || amount <= 0) {
    if (opts.json) console.log(JSON.stringify({ error: "monto inválido" }))
    else console.error("Monto inválido: debe ser un número mayor a 0")
    process.exitCode = 4
    return
  }

  const auth = await readAuth()
  if (!auth) {
    notAuthenticated(opts.json)
    return
  }

  const cfg = await readConfig()
  const verdict = checkPolicy(cfg.send, amount, to, dailySpent(cfg, today()))
  if (!verdict.ok) {
    if (opts.json) console.log(JSON.stringify({ error: verdict.reason }))
    else console.error(`Bloqueado por política: ${verdict.reason}`)
    process.exitCode = 3
    return
  }

  if (!process.stdin.isTTY) {
    // El PIN llega por correo y hay que leerlo: send exige terminal interactiva.
    console.error(
      "send requiere terminal interactiva (verificación por correo del PIN)"
    )
    process.exitCode = 3
    return
  }

  // 1. Confirmar destinatario/monto.
  const okConfirm = await p.confirm({
    message: `Enviar ${amount} a @${to}${opts.note ? ` (${opts.note})` : ""}?`,
    initialValue: false,
  })
  if (p.isCancel(okConfirm) || !okConfirm) return cancel()

  // 2. Dispara el PIN por correo (solo token, sin contraseña).
  const s = p.spinner()
  s.start("Solicitando PIN por correo…")
  try {
    await requestTransferPin(auth.token)
    s.stop("PIN enviado. Revisa tu correo.")
  } catch (e) {
    s.stop("Error al solicitar el PIN")
    return fail(e, opts)
  }

  // 3. PIN del correo.
  const pin = await p.password({ message: "PIN recibido por correo" })
  if (p.isCancel(pin)) return cancel()

  // 4. Transferir.
  s.start("Transfiriendo…")
  try {
    const res = await transfer(auth.token, {
      amount,
      to,
      pin,
      description: opts.note,
    })
    s.stop("Transferencia enviada.")
    if (opts.verbose)
      console.error(`[transfer] respuesta: ${JSON.stringify(res)}`)

    const t = today()
    await writeConfig({
      ...cfg,
      daily: { date: t, spent: dailySpent(cfg, t) + amount },
    })

    if (opts.json) console.log(JSON.stringify(res))
    else console.log(`✔ ${res.message} · tx ${res.transaction}`)
  } catch (e) {
    s.stop("La transferencia falló.")
    fail(e, opts)
  }
}

function cancel(): void {
  p.cancel("Cancelado.")
  process.exitCode = 1
}
