# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Este proyecto sigue [SemVer](https://semver.org/lang/es/).

## [Unreleased]

### Añadido

- `tx watch` acepta **condiciones**: `--from`, `--to`, `--direction in|out`,
  `--min`, `--max` y `--grep`, combinables en AND. `--from`/`--to` comparan
  contra `PaidBy`/`User` ignorando mayúsculas y el `@` inicial; `--direction`
  se resuelve contra el usuario de la sesión.
- `tx watch --webhook <url>` hace POST de `{ event, sent_at, transaction }`
  cuando una transacción cumple las condiciones. Solo `https` (`http` únicamente
  contra localhost), timeout de 5 s y un reintento salvo en 4xx. Un webhook que
  falla avisa por stderr pero **no** detiene la vigilancia.
- Firma opcional `X-QvaPay-Signature: sha256=<hmac>` sobre el cuerpo exacto. El
  secreto sale de `watch.webhookSecret` en el config o de la variable de entorno
  `QVAPAY_WEBHOOK_SECRET` (que tiene prioridad); nunca por flag, porque la línea
  de comandos es visible en `ps`.
- Nueva clave de configuración `watch.webhookSecret`. `config get` nunca imprime
  su valor, solo si está configurado o no.
- `tx watch` puede **parar solo**: `--until-match`, `--max-events <n>` y
  `--timeout <s>`. El plazo manda sobre el intervalo, así que `--timeout 20
  --interval 60` se rinde a los 20 s.
- **Exit code 5**: `--timeout` venció sin coincidencias. Es distinto de 1 para
  que un script sepa que la vigilancia funcionó, pero no pasó nada.

### Corregido

- La skill de agente documentaba `config get maxPerTx`, que siempre fallaba: las
  claves llevan el prefijo (`send.maxPerTx`). También mostraba montos negativos
  en el ejemplo de `tx list`; la API los devuelve como string y siempre en
  positivo, y la dirección se deduce de `PaidBy`/`User`.
- Un flag mal escrito en `tx watch` ya no se reporta como "Error inesperado":
  sale con 4 (argumento inválido) y un mensaje que dice qué esperaba.

## [0.1.7] - 2026-08-20

### Cambiado

- El repositorio pasó a la organización `qvapay`: ahora vive en
  `github.com/qvapay/qvapay-cli`. Se actualizaron `repository`/`homepage`/`bugs`
  en package.json, los enlaces de este changelog y la URL de `install.sh` en el
  README. GitHub redirige las URLs viejas, así que nada se rompe.
- `install.sh` consulta releases del nuevo owner.
- **El paquete npm pasó de `@pep3m/qvapay` a `@qvapay/cli`**, bajo el scope de la
  organización. `@pep3m/qvapay` queda deprecado en 0.1.6: sigue funcionando, pero
  no recibe versiones nuevas.

Para migrar hay que desinstalar el viejo primero, porque los dos paquetes aportan
el binario `qvapay` y el symlink colisiona:

```bash
npm uninstall -g @pep3m/qvapay && npm i -g @qvapay/cli
```

El binario sigue llamándose `qvapay` y los binarios de `install.sh` no cambian:
van por GitHub Releases, ajenos a npm.

## [0.1.6] - 2026-08-14

### Añadido

- `qvapay tx watch`: sondea transacciones e imprime solo las nuevas hasta Ctrl-C.
  Con `--json` emite NDJSON (una línea por transacción), apto para `| jq` o para
  que un agente espere un cobro. Intervalo `--interval <s>`, con piso de 10 s por
  el rate limit del servidor (3 req / 5 s). La primera pasada solo registra lo que
  ya existía, así que toda línea impresa es una transacción nueva.

### Corregido

- Un 401 ahora borra `auth.json`. El token dura ~180 días; al caducar quedaba una
  sesión zombie en disco que solo se limpiaba con `qvapay logout` manual.
- La respuesta cruda de `/transaction/transfer` ya no se imprime en cada
  transferencia; ahora requiere `--verbose`.

### Eliminado

- `checkAuth()`, sin uso desde su introducción.

## [0.1.5] - 2026-08

- README, CONTRIBUTING y licencia MIT.

## [0.1.4] - 2026-08

- CI: se fija `npm@11` (npm@latest exige node 22+ y el runner usa node 20).
- CI: publish por OIDC / trusted publishing, gate `environment: release` con
  revisor humano y actions pineadas por SHA.

## [0.1.2] - 2026-08

- Primer release publicado en npm como `@pep3m/qvapay` (el nombre `qvapay` sin
  scope está tomado; el binario sigue llamándose `qvapay`).
- `repository.url` en package.json, requisito de la provenance de npm.
- Build unificado: bundle npm + 5 binarios compilados con `SHA256SUMS`.

## [0.1.0] - 2026-08

- Versión inicial: TUI en Ink, comandos `login`/`whoami`/`balance`/`tx`/`send`,
  política local de `send` (límites, whitelist) y skill para agentes.

[0.1.7]: https://github.com/qvapay/qvapay-cli/releases/tag/v0.1.7
[0.1.6]: https://github.com/qvapay/qvapay-cli/releases/tag/v0.1.6
[0.1.5]: https://github.com/qvapay/qvapay-cli/releases/tag/v0.1.5
[0.1.4]: https://github.com/qvapay/qvapay-cli/releases/tag/v0.1.4
[0.1.2]: https://github.com/qvapay/qvapay-cli/releases/tag/v0.1.2
[0.1.0]: https://github.com/qvapay/qvapay-cli/releases/tag/v0.1.0
