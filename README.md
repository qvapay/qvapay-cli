```
________                                                   .__  .__
\_____  \___  _______  ___________  ___.__.           ____ |  | |__|
 /  / \  \  \/ /\__  \ \____ \__  \<   |  |  ______ _/ ___\|  | |  |
/   \_/.  \   /  / __ \|  |_> > __ \\___  | /_____/ \  \___|  |_|  |
\_____\ \_/\_/  (____  /   __(____  / ____|          \___  >____/__|
       \__>          \/|__|       \/\/                   \/
```

CLI para tu wallet personal de [QvaPay](https://qvapay.com): TUI interactiva y
comandos directos estilo `gh`. Pensado también para que agentes (Claude Code,
Cursor, Codex, opencode) lo usen vía skill incluida.

```bash
npm i -g @pep3m/qvapay   # o: bun add -g @pep3m/qvapay
qvapay                   # abre la TUI
```

## Instalación

| Canal | Comando | Requiere |
|-------|---------|----------|
| npm / bun / pnpm | `npm i -g @pep3m/qvapay` | Node ≥ 20 o Bun |
| curl (binario autocontenido) | `curl -fsSL https://raw.githubusercontent.com/qvapay/qvapay-cli/master/install.sh \| sh` | nada |

El binario de `install.sh` **verifica el SHA256** contra `SHA256SUMS` antes de
instalar. Lee el script antes de correrlo (`curl … \| sh` a ciegas es antipatrón).

## Uso

Sin subcomando abre la **TUI** (Ink). Con subcomando corre en modo directo:

```bash
qvapay login                 # email + PIN por correo
qvapay whoami
qvapay balance
qvapay tx list --limit 10 --status paid
qvapay tx watch --interval 30   # sondea y muestra las nuevas hasta Ctrl-C
qvapay tx get <uuid>
qvapay send <usuario> <monto> --note "café"
qvapay logout
```

Flags globales:

- `--json` — salida en JSON, para agentes y scripts.
- `--verbose` — log detallado a stderr (el token se redacta).
- `-V, --version`

### `send` y su política

La API de QvaPay **siempre exige un PIN por correo** para transferir: es el
guardarraíl duro que un agente no puede saltarse. Encima hay una política local
(`~/.config/qvapay/config.json`) que acota el daño:

```bash
qvapay config                              # muestra la política actual
qvapay config set send.enabled false       # apaga send por completo
qvapay config set send.maxPerTx 50          # máximo por transacción
qvapay config set send.dailyCap 200         # tope diario acumulado
qvapay config set send.whitelist a,b,c      # solo estos destinatarios
```

`send` requiere terminal interactiva (hay que leer el PIN del correo) y aborta
antes de tocar la API si la política lo bloquea.

## Códigos de salida

| Código | Significado |
|--------|-------------|
| 0 | Éxito |
| 1 | Error genérico (red, API, inesperado) |
| 2 | No autenticado (corre `qvapay login`) |
| 3 | `send` bloqueado por política o sin TTY |
| 4 | Argumento inválido (p. ej. monto ≤ 0) |

## Uso por agentes

Instala la skill en tu agente para que sepa operar el CLI:

```bash
qvapay skill install --agent claude-code   # cursor | codex | opencode
qvapay skill install --agent claude-code --global
```

La skill (`agent/SKILL.md`) documenta lectura libre (balance, tx, whoami) y deja
`send` detrás del PIN humano. Corre siempre con `--json`.

## Seguridad

- Solo se guarda el **token** en `~/.config/qvapay/auth.json` (fichero `600`,
  directorio `700`). La contraseña **nunca** llega a disco.
- Token con `remember=true` (180 días). `qvapay logout` lo borra.

## Desarrollo

Requiere [Bun](https://bun.sh).

```bash
bun install
bun run dev          # CLI en watch
bun run dev:tui      # TUI en watch
bun test
bun run typecheck
bun run lint
```

Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

[MIT](LICENSE) © Pep3M
