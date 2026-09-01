#!/usr/bin/env bun
import { Command } from "commander"
import pkg from "../package.json" with { type: "json" }
import { balanceCommand } from "./commands/balance"
import {
  configCommand,
  configGetCommand,
  configSetCommand,
} from "./commands/config"
import { loginCommand } from "./commands/login"
import { logoutCommand } from "./commands/logout"
import { sendCommand } from "./commands/send"
import { skillInstallCommand } from "./commands/skill"
import { txGetCommand, txListCommand, txWatchCommand } from "./commands/tx"
import { whoamiCommand } from "./commands/whoami"

const program = new Command()

program
  .name("qvapay")
  .description("CLI para la wallet personal de QvaPay")
  .version(pkg.version, "-V, --version")
  .option("--json", "salida en JSON (para agentes y scripts)")
  .option("--verbose", "log detallado a stderr (token redactado)")

program
  .command("login")
  .description("Iniciar sesión (email + PIN por correo)")
  .action(loginCommand)
program.command("logout").description("Cerrar sesión").action(logoutCommand)
program
  .command("whoami")
  .description("Muestra el usuario autenticado")
  .action(() => whoamiCommand(program.opts()))
program
  .command("balance")
  .description("Balance disponible y pendiente")
  .action(() => balanceCommand(program.opts()))

const tx = program.command("tx").description("Transacciones")
tx.command("list")
  .description("Lista transacciones")
  .option("--limit <n>", "cantidad por página (1-30, def. 20)")
  .option("--page <n>", "página")
  .option("--status <estado>", "paid | pending | cancelled (def. paid)")
  .action((opts) => txListCommand({ ...program.opts(), ...opts }))
tx.command("watch")
  .description("Vigila transacciones nuevas; filtra, avisa y para sola")
  .option("--interval <s>", "segundos entre sondeos (mín. 10, def. 15)")
  .option("--status <estado>", "paid | pending | cancelled (def. paid)")
  // condiciones (se combinan en AND)
  .option("--from <usuario>", "solo las que paga ese usuario")
  .option("--to <usuario>", "solo las que recibe ese usuario")
  .option("--direction <in|out>", "solo entrantes (in) o salientes (out)")
  .option("--min <monto>", "monto mínimo")
  .option("--max <monto>", "monto máximo")
  .option("--grep <texto>", "texto en la descripción")
  // acción
  .option("--webhook <url>", "POST del evento a esa URL (https)")
  // parada
  .option("--until-match", "salir en la primera coincidencia")
  .option("--max-events <n>", "salir tras n coincidencias")
  .option("--timeout <s>", "salir con código 5 si no hubo coincidencias")
  .action((opts) => txWatchCommand({ ...program.opts(), ...opts }))
tx.command("get <uuid>")
  .description("Detalle de una transacción")
  .action((uuid) => txGetCommand(uuid, program.opts()))

program
  .command("send <usuario> <monto>")
  .description("Transferir saldo (pide PIN; sujeto a política local)")
  .option("--note <texto>", "nota/descripción de la transferencia")
  .action((to, monto, opts) =>
    sendCommand(to, monto, { ...program.opts(), ...opts })
  )

const config = program
  .command("config")
  .description("Política de send (límites, whitelist)")
  .action(() => configCommand())
config
  .command("get <clave>")
  .description("Leer un valor (send.enabled|maxPerTx|dailyCap|whitelist)")
  .action((clave) => configGetCommand(clave, program.opts()))
config
  .command("set <clave> <valor>")
  .description("Fijar un valor")
  .action((clave, valor) => configSetCommand(clave, valor))

const skill = program
  .command("skill")
  .description("Skill para agentes (claude-code, cursor, codex, opencode)")
skill
  .command("install")
  .description("Instala la skill en el agente indicado")
  .requiredOption("--agent <agente>", "claude-code | cursor | codex | opencode")
  .option("--global", "instalar en el home del agente (no en el proyecto)")
  .action((opts) => skillInstallCommand({ ...program.opts(), ...opts }))

// Sin subcomando -> TUI (Ink, carga perezosa). Con subcomando -> Commander.
if (process.argv.length <= 2) {
  const { startTui } = await import("./tui/app")
  startTui()
} else {
  program.parseAsync().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
