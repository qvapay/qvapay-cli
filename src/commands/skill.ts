// Instala la skill de agentes. Una plantilla (agent/SKILL.md, embebida) + un map
// de {agente -> ruta+formato}. El instalador la adapta al formato de cada agente.
// ponytail: sin plugins; añadir un agente = una entrada en TARGETS.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import template from "../../agent/SKILL.md" with { type: "text" }
import type { GlobalOpts } from "./util"

type Format = "skill" | "mdc" | "agents"

interface Target {
  project: string // ruta relativa al cwd
  global: string // ruta bajo el home del agente
  format: Format
}

const TARGETS: Record<string, Target> = {
  "claude-code": {
    project: ".claude/skills/qvapay/SKILL.md",
    global: "~/.claude/skills/qvapay/SKILL.md",
    format: "skill",
  },
  cursor: {
    project: ".cursor/rules/qvapay.mdc",
    global: "~/.cursor/rules/qvapay.mdc",
    format: "mdc",
  },
  codex: {
    project: "AGENTS.md",
    global: "~/.codex/AGENTS.md",
    format: "agents",
  },
  opencode: {
    project: "AGENTS.md",
    global: "~/.config/opencode/AGENTS.md",
    format: "agents",
  },
}

interface SkillOpts extends GlobalOpts {
  agent?: string
  global?: boolean
}

// Separa el frontmatter YAML del cuerpo. Devuelve name/description/body.
function parse(tpl: string): {
  name: string
  description: string
  body: string
} {
  const m = tpl.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) return { name: "qvapay", description: "", body: tpl }
  const front = m[1]
  const name = front.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "qvapay"
  const description = front.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ""
  return { name, description, body: m[2] }
}

function render(format: Format): string {
  const { description, body } = parse(template)
  if (format === "skill") return template
  if (format === "mdc") {
    return `---\ndescription: ${description}\nalwaysApply: false\n---\n${body}`
  }
  // agents: envuelto en marcadores para poder actualizar in situ sin duplicar.
  return `<!-- qvapay:start -->\n${body.trim()}\n<!-- qvapay:end -->\n`
}

const START = "<!-- qvapay:start -->"
const END = "<!-- qvapay:end -->"

// Fusiona la sección qvapay en un AGENTS.md existente (reemplaza o añade).
function mergeAgents(existing: string, section: string): string {
  const s = existing.indexOf(START)
  const e = existing.indexOf(END)
  if (s !== -1 && e !== -1) {
    return (
      existing.slice(0, s) + section.trim() + existing.slice(e + END.length)
    )
  }
  return `${existing.trimEnd()}\n\n${section}`
}

export const AGENTS = Object.keys(TARGETS)

// Lógica pura de instalación (reutilizada por el comando y por la TUI).
// Devuelve la ruta escrita. Lanza si el agente es desconocido.
export async function installSkill(
  agent: string,
  opts: { global?: boolean } = {}
): Promise<string> {
  const t = TARGETS[agent]
  if (!t) throw new Error(`agente desconocido: ${agent}`)
  const rel = opts.global ? t.global.replace(/^~/, homedir()) : t.project
  const path = opts.global ? rel : join(process.cwd(), rel)

  const content = render(t.format)
  await mkdir(dirname(path), { recursive: true })

  let final = content
  if (t.format === "agents") {
    let existing = ""
    try {
      existing = await readFile(path, "utf8")
    } catch {
      // no existe; se crea
    }
    final = existing ? mergeAgents(existing, content) : content
  }

  await writeFile(path, final)
  return path
}

export async function skillInstallCommand(opts: SkillOpts): Promise<void> {
  const agent = opts.agent
  if (!agent || !(agent in TARGETS)) {
    console.error(`--agent requerido. Opciones: ${AGENTS.join(", ")}`)
    process.exitCode = 4
    return
  }
  const path = await installSkill(agent, { global: opts.global })
  if (opts.json) console.log(JSON.stringify({ agent, path }))
  else console.log(`✔ Skill instalada para ${agent}: ${path}`)
}
