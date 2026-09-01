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
npm i -g @qvapay/cli   # o: bun add -g @qvapay/cli
qvapay                 # abre la TUI
```

## Instalación

| Canal | Comando | Requiere |
|-------|---------|----------|
| npm / bun / pnpm | `npm i -g @qvapay/cli` | Node ≥ 20 o Bun |
| curl (binario autocontenido) | `curl -fsSL https://raw.githubusercontent.com/qvapay/qvapay-cli/master/install.sh \| sh` | nada |

> **¿Venís de `@pep3m/qvapay`?** Desinstalá el viejo antes de instalar el nuevo,
> porque ambos aportan el binario `qvapay` y el symlink colisiona:
> `npm uninstall -g @pep3m/qvapay && npm i -g @qvapay/cli`

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

### `tx watch`: condiciones, acción y parada

Por defecto imprime cada transacción nueva hasta Ctrl-C. Tres ejes opcionales lo
convierten en una automatización:

**Condiciones** (se combinan en AND; sin ninguna, pasa todo):

```bash
qvapay tx watch --from acme                 # solo las que paga ese usuario
qvapay tx watch --to fulano                 # solo las que recibe ese usuario
qvapay tx watch --direction in              # solo entrantes (out = salientes)
qvapay tx watch --min 100 --max 500         # rango de monto
qvapay tx watch --grep nómina               # texto en la descripción
```

`--from` mira quién paga y `--to` quién recibe; el `@` y las mayúsculas dan
igual. `--direction` se resuelve contra el usuario de tu sesión, así que
`--direction in` es "me entró dinero" sin tener que escribir tu propio nombre.

**Acción**: `--webhook <url>` hace un POST del evento. El cuerpo es
`{ event, sent_at, transaction }` y el evento va también en `X-QvaPay-Event`.

```bash
qvapay config set watch.webhookSecret un-secreto-largo
qvapay tx watch --direction in --min 100 --webhook https://midominio.com/hook
```

Con secreto configurado, cada POST lleva `X-QvaPay-Signature: sha256=<hmac>`
sobre el cuerpo exacto; verifícalo en el receptor o cualquiera que adivine la URL
podrá inventarse pagos. El secreto **no se pasa por flag** —la línea de comandos
es visible en `ps`—: sale de `watch.webhookSecret` o de la variable de entorno
`QVAPAY_WEBHOOK_SECRET`, que tiene prioridad. Solo se admite `https` (`http`
únicamente contra `localhost`). Si el POST falla se avisa por stderr y la
vigilancia sigue: el webhook es un aviso, no el registro.

**Parada**:

```bash
qvapay tx watch --from acme --until-match          # sale en la 1ª coincidencia
qvapay tx watch --min 100 --max-events 5           # sale tras 5
qvapay tx watch --from acme --until-match --timeout 3600   # o se rinde en 1 h
```

Sin `--timeout` un watcher espera para siempre; ponlo siempre que lo llame un
script o un agente. Si el plazo vence sin ninguna coincidencia, sale con **5**.

Combinado, el patrón útil es "espera a que me paguen y sigue":

```bash
if qvapay tx watch --from acme --min 100 --until-match --timeout 3600 --json > pago.json; then
  echo "cobrado"; else echo "no llegó a tiempo"; fi
```

**Límites del sondeo**: la API corta a 3 peticiones / 5 s, así que el intervalo
mínimo es 10 s y cada pasada trae 30 transacciones como mucho. Si entraran más
de 30 entre dos sondeos, las de en medio se pierden. La primera pasada solo
siembra el estado: no imprime ni dispara nada, para no avisarte de lo que ya
había pasado.

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
| 4 | Argumento inválido (p. ej. monto ≤ 0, flag mal escrito) |
| 5 | `tx watch --timeout` venció sin coincidencias |

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
