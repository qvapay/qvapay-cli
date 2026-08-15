import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"
import { AGENTS, installSkill } from "../../commands/skill"
import { type Config, readConfig, writeConfig } from "../../lib/policy"
import { ACCENT, errMsg, FG, GREEN, MUTED, RED } from "../theme"

const SUBTABS = ["Pagos", "Agentes"]

// Config en dos sub-tabs (←/→): política de send (Pagos) e instalar skill
// (Agentes). `onEditing` pausa el input global de App mientras se teclea un campo.
export function ConfigView({ onEditing }: { onEditing: (v: boolean) => void }) {
  const [sub, setSub] = useState(0)
  const [editing, setEditing] = useState(false)

  function setEdit(v: boolean): void {
    setEditing(v)
    onEditing(v)
  }

  useInput((_input, key) => {
    if (editing) return // el sub-view captura el teclado
    if (key.leftArrow) setSub((s) => (s - 1 + SUBTABS.length) % SUBTABS.length)
    else if (key.rightArrow) setSub((s) => (s + 1) % SUBTABS.length)
  })

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        {SUBTABS.map((label, i) => {
          const on = i === sub
          return (
            <Box key={label} marginRight={1}>
              <Text
                color={on ? "white" : MUTED}
                backgroundColor={on ? ACCENT : undefined}
              >
                {` ${label} `}
              </Text>
            </Box>
          )
        })}
        <Text color={MUTED}> ←/→ cambiar</Text>
      </Box>
      {sub === 0 ? <PaymentsConfig setEdit={setEdit} /> : <SkillsConfig />}
    </Box>
  )
}

// --- Pagos: edición de la política de send ---

const ROWS = [
  { key: "enabled", label: "Permitir send" },
  { key: "maxPerTx", label: "Máximo por transacción" },
  { key: "dailyCap", label: "Tope diario" },
  { key: "whitelist", label: "Whitelist" },
] as const

function PaymentsConfig({ setEdit }: { setEdit: (v: boolean) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [sel, setSel] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    readConfig().then(setCfg)
  }, [])

  function save(next: Config): void {
    setCfg(next)
    writeConfig(next).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
    })
  }

  function startEdit(): void {
    if (!cfg) return
    const row = ROWS[sel].key
    if (row === "maxPerTx" || row === "dailyCap")
      setDraft(cfg.send[row]?.toString() ?? "")
    else if (row === "whitelist") setDraft(cfg.send.whitelist.join(", "))
    setEditing(true)
    setEdit(true)
  }

  function commit(): void {
    if (!cfg) return
    const row = ROWS[sel].key
    const send = { ...cfg.send }
    if (row === "maxPerTx" || row === "dailyCap") send[row] = parseNum(draft)
    else if (row === "whitelist")
      send.whitelist = draft
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    save({ ...cfg, send })
    setEditing(false)
    setEdit(false)
  }

  useInput((input, key) => {
    if (!cfg) return
    if (editing) {
      if (key.escape) {
        setEditing(false)
        setEdit(false)
      } else if (key.return) commit()
      else if (key.backspace || key.delete) setDraft((d) => d.slice(0, -1))
      else if (input && !key.ctrl && !key.meta) setDraft((d) => d + input)
      return
    }
    if (key.upArrow || input === "k")
      setSel((s) => (s - 1 + ROWS.length) % ROWS.length)
    else if (key.downArrow || input === "j")
      setSel((s) => (s + 1) % ROWS.length)
    else if (key.return || input === " ") {
      if (ROWS[sel].key === "enabled")
        save({ ...cfg, send: { ...cfg.send, enabled: !cfg.send.enabled } })
      else startEdit()
    }
  })

  if (!cfg) return <Text color={MUTED}>Cargando…</Text>

  return (
    <Box flexDirection="column">
      {ROWS.map((r, i) => {
        const on = i === sel
        const isEdit = on && editing
        return (
          <Text key={r.key} color={on ? FG : MUTED}>
            {on ? "❯ " : "  "}
            {r.label}: {"  "}
            {isEdit ? (
              <Text color={FG}>
                {draft}
                <Text color={ACCENT}>▏</Text>
              </Text>
            ) : (
              <Text color={on ? ACCENT : MUTED}>{display(cfg, r.key)}</Text>
            )}
          </Text>
        )
      })}
      <Box marginTop={1}>
        <Text color={MUTED}>
          <Text color="#9a9ec2">↑↓</Text> elegir {"  "}
          <Text color="#9a9ec2">Enter</Text>{" "}
          {ROWS[sel].key === "enabled" ? "alternar" : "editar"} {"  "}
          {editing ? (
            <Text color="#9a9ec2">Esc cancelar</Text>
          ) : (
            <Text color={GREEN}>{saved ? "✔ guardado" : ""}</Text>
          )}
        </Text>
      </Box>
    </Box>
  )
}

function display(cfg: Config, key: (typeof ROWS)[number]["key"]): string {
  if (key === "enabled") return cfg.send.enabled ? "activado" : "desactivado"
  if (key === "whitelist")
    return cfg.send.whitelist.length ? cfg.send.whitelist.join(", ") : "todos"
  const v = cfg.send[key]
  return v == null ? "sin límite" : String(v)
}

function parseNum(v: string): number | null {
  const t = v.trim()
  if (!t || /^(null|none|off)$/i.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? n : null
}

// --- Agentes: instalar la skill (contenido previo de ConfigView) ---

function SkillsConfig() {
  const [sel, setSel] = useState(0)
  const [global, setGlobal] = useState(false)
  const [result, setResult] = useState<
    { ok: true; path: string } | { ok: false; msg: string } | null
  >(null)

  useInput((input, key) => {
    if (key.upArrow || input === "k")
      setSel((s) => (s - 1 + AGENTS.length) % AGENTS.length)
    else if (key.downArrow || input === "j")
      setSel((s) => (s + 1) % AGENTS.length)
    else if (input === "g") setGlobal((g) => !g)
    else if (key.return) {
      installSkill(AGENTS[sel], { global })
        .then((path) => setResult({ ok: true, path }))
        .catch((e) => setResult({ ok: false, msg: errMsg(e) }))
    }
  })

  return (
    <Box flexDirection="column">
      <Text color={ACCENT}>Integrar la skill de QvaPay en un agente</Text>
      <Box marginTop={1} flexDirection="column">
        {AGENTS.map((a, i) => {
          const on = i === sel
          return (
            <Text key={a} color={on ? FG : MUTED}>
              {on ? "❯ " : "  "}
              <Text color={on ? ACCENT : MUTED}>{a}</Text>
            </Text>
          )
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={MUTED}>
          Destino:{" "}
          <Text color={FG}>{global ? "global (home)" : "proyecto (cwd)"}</Text>
        </Text>
      </Box>
      {result ? (
        <Box marginTop={1}>
          {result.ok ? (
            <Text color={GREEN}>✔ Instalada en {result.path}</Text>
          ) : (
            <Text color={RED}>✖ {result.msg}</Text>
          )}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text color={MUTED}>
          <Text color="#9a9ec2">↑↓</Text> elegir {"  "}
          <Text color="#9a9ec2">g</Text> global/proyecto {"  "}
          <Text color="#9a9ec2">Enter</Text> instalar
        </Text>
      </Box>
    </Box>
  )
}
